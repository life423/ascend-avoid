import type { MultiplayerMode } from '../core/GameModes'
import { ARENA_RULES, INHALE, LATCH } from '../../server/constants/gameConstants'
import { cleanAir, latchSizeFactor, streamLook } from '../../server/game/airflow'
import { moveSpeed } from '../../server/game/movement'
import { Airflow, INHALE_LOOK, onCurve, suctionPower } from './airflow'
import { gemColor } from './world'
import type { SyncedGem, SyncedPlayer } from '../types/synced'

/**
 * An inhale drawn as moving air rather than a fixed cone: streaks flowing into the mouth along
 * curved lines, always inside the real pull area (which is only hinted at, with a dotted edge
 * where the pull ends). At rest the flow is shorter and broader; going forward it stretches long
 * and narrow; turning, its far end trails behind and swings round; draining someone, it tightens
 * into a channel and leans toward them. Big creatures pull a wide, heavy, turbulent flow, small
 * ones a quick narrow stream; low on breath it thins, flickers and breaks up; and little side
 * streams peel off to each gem and creature it's pulling.
 */
export function drawAirflow(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, id: string, player: SyncedPlayer, x: number, y: number, size: number, facing: number, timestamp: number, intensity: number, isLocal: boolean) : void {
    const reach = INHALE.REACH + size * INHALE.REACH_PER_SIZE
    const arc = (INHALE.ARC * Math.PI) / 180
    const power = Math.min(6, suctionPower(size) * intensity)
    // 1 for a newborn, up to 3 for a giant
    const heft = Math.min(3, Math.sqrt(size / ARENA_RULES.PLAYER_SIZE))
    let flow = mode.flows.get(id)
    if (!flow) {
        flow = { heading: facing, along: 0, x, y, at: timestamp, inhaling: false, since: timestamp, hookId: '', hookedAt: timestamp, coherence: 0 }
        mode.flows.set(id, flow)
    }
    if (!flow.inhaling) {
        flow.inhaling = true
        flow.since = timestamp
        flow.heading = facing
    }
    const dt = Math.min(0.1, Math.max(0.001, (timestamp - flow.at) / 1000))
    // The far end trails the mouth through a turn (a small creature's catches up faster)
    const turn = Math.atan2(Math.sin(facing - flow.heading), Math.cos(facing - flow.heading))
    flow.heading += turn * Math.min(1, dt * (14 / heft))
    // How fast it's going forward, as a share of its top speed
    const forward = ((x - flow.x) * Math.cos(facing) + (y - flow.y) * Math.sin(facing)) / dt / moveSpeed(size)
    flow.along += (Math.max(-1, Math.min(1, forward)) - flow.along) * Math.min(1, dt * 6)
    flow.x = x
    flow.y = y
    flow.at = timestamp
    // Breath: yours exactly; anyone else's guessed from how long they've been inhaling
    const breath = isLocal ? mode.stamina : Math.max(0, 1 - (timestamp - flow.since) / INHALE.MAX_MS)
    const weak = breath < 0.3 ? 1 - breath / 0.3 : 0
    // The shape, always inside the real pull area
    const ahead = Math.max(0, flow.along)
    const tight = Math.min(1, Math.max(0, (intensity - 1) / 0.8))
    const length = reach * (0.72 + 0.28 * ahead)
    // (and the cone itself narrows as its air goes into a stream)
    const spread = arc * (1 - 0.35 * ahead) * (1 - 0.4 * tight) * (1 - 0.6 * Math.max(0, Math.min(1, (flow.coherence - LATCH.BEAM_FOCUS_FROM) / (LATCH.BEAM_FULL_AT - LATCH.BEAM_FOCUS_FROM))))
    // It leans toward whoever it's draining
    const world = mode.multiplayerManager?.getState()
    const weakened = Boolean(player.continuedTheft || world && player.injuredUntil > mode.worldNow(world, timestamp))
    // Focused on its latched creature if it has one, else whoever it's robbing
    const target = player.latchTarget ? world?.players?.get(player.latchTarget) : player.stealingFrom ? world?.players?.get(player.stealingFrom) : null
    const mouthX = x + Math.cos(facing) * size * 0.3
    const mouthY = y + Math.sin(facing) * size * 0.3
    let lean = 0
    let toward = facing
    let hookLength = length
    if (target) {
        const tx = target.x + target.width / 2
        const ty = target.y + target.height / 2
        toward = Math.atan2(ty - mouthY, tx - mouthX)
        lean = Math.max(-arc, Math.min(arc, Math.atan2(Math.sin(toward - facing), Math.cos(toward - facing)))) * 0.6
        hookLength = Math.min(reach, Math.hypot(tx - mouthX, ty - mouthY))
    }
    // Hooked on someone a while (the lock building), the curling air straightens into beams
    // running from them straight into the mouth; it curls again the moment the hook breaks
    const hookId = target ? String(player.stealingFrom) : ''
    if (hookId !== flow.hookId) {
        flow.hookId = hookId
        flow.hookedAt = timestamp
    }
    // How focused the stream is: the latch's airflow quality, from the server (it frays back into a cone as that falls)
    // The cone's own streaks stay a cone; the connection to a latched creature is its own stream (drawStream)
    const straight = 0
    // Coherence follows the latch's real airflow quality; it rises smoothly but falls fast, so a broken latch frays straight back into the cone
    const latchedQuality = player.latchTarget ? Math.max(0, Math.min(1, Number(player.latchQuality) || 0)) : 0
    flow.coherence = latchedQuality >= flow.coherence
        ? flow.coherence + (latchedQuality - flow.coherence) * Math.min(1, dt * 8)
        : Math.max(latchedQuality, flow.coherence - dt * 4)
    const fraying = Math.max(0, flow.coherence - latchedQuality)
    const coherent = Math.max(0, Math.min(1, (flow.coherence - LATCH.BEAM_FOCUS_FROM) / (LATCH.BEAM_FULL_AT - LATCH.BEAM_FOCUS_FROM)))
    const beamShare = coherent * coherent * (3 - 2 * coherent)
    // ...pinching tighter the longer the hold (as the drain escalates)
    const pinch = 1 - 0.5 * straight
    ctx.save()
    // The real pull area, only hinted at
    const hint = ctx.createRadialGradient(mouthX, mouthY, 0, mouthX, mouthY, reach)
    hint.addColorStop(0, `rgba(180, 230, 255, ${Math.min(0.07, 0.025 + 0.008 * power) * (1 - 0.6 * Math.max(0, Math.min(1, (flow.coherence - LATCH.BEAM_FOCUS_FROM) / (LATCH.BEAM_FULL_AT - LATCH.BEAM_FOCUS_FROM))))})`)
    hint.addColorStop(0.6, 'rgba(180, 230, 255, 0)')
    ctx.fillStyle = hint
    ctx.beginPath()
    ctx.moveTo(mouthX, mouthY)
    ctx.arc(mouthX, mouthY, reach, facing - arc, facing + arc)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = weakened ? 'rgba(255, 174, 148, .45)' : 'rgba(200, 240, 255, 0.16)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 9])
    ctx.beginPath()
    ctx.arc(mouthX, mouthY, reach, facing - arc, facing + arc)
    ctx.stroke()
    ctx.setLineDash([])
    // The streaks, each riding a curved line from far out into the mouth
    const far = flow.heading + lean
    // (as the stream forms, the cone gives its air to it)
    const streaks = Math.max(3, Math.round((8 + 5 * heft + 3 * power) * (1 - 0.6 * weak) * (1 - 0.7 * beamShare)))
    const period = (length / (INHALE_LOOK.STREAK_SPEED * power * (1.6 / heft))) * 1000
    const turbulence = 0.06 * heft * (1 - 0.5 * tight) + 0.12 * weak
    const segment = 0.1 + 0.04 * power
    ctx.lineCap = 'round'
    ctx.strokeStyle = weakened ? '#ffae94' : 'rgba(220, 245, 255, 1)'
    for (let i = 0; i < streaks; i++) {
        // Low on breath, the flow breaks up
        if (weakened && i % 3 !== 0 || weak > 0 && (i + Math.floor(timestamp / 120)) % 3 === 0) continue
        const lane = Math.sin(i * 2.3 + 0.7)
        const t = (((timestamp / period + i / streaks + 0.37 * Math.sin(i * 1.7)) % 1) + 1) % 1
        // Curling in from the flow, or (hooked) a straight beam from the victim
        const curled = far + lane * spread
        const beam = toward + lane * spread * 0.2 * pinch
        const startAngle = curled + Math.atan2(Math.sin(beam - curled), Math.cos(beam - curled)) * straight
        const span = length + (hookLength - length) * straight
        const ax = mouthX + Math.cos(startAngle) * span
        const ay = mouthY + Math.sin(startAngle) * span
        const bendAngle = facing + lane * spread * 0.5 + lean * 0.5
        const wobble = Math.sin(timestamp / (180 * heft) + i * 1.9) * turbulence * span * (1 - straight)
        const curveX = mouthX + Math.cos(bendAngle) * span * 0.45 - Math.sin(facing) * wobble
        const curveY = mouthY + Math.sin(bendAngle) * span * 0.45 + Math.cos(facing) * wobble
        const bx = curveX + ((ax + mouthX) / 2 - curveX) * straight
        const by = curveY + ((ay + mouthY) / 2 - curveY) * straight
        const reachOf = segment * (1 + 0.8 * straight)
        const from = onCurve(ax, ay, bx, by, mouthX, mouthY, t)
        const mid = onCurve(ax, ay, bx, by, mouthX, mouthY, Math.min(1, t + reachOf / 2))
        const to = onCurve(ax, ay, bx, by, mouthX, mouthY, Math.min(1, t + reachOf))
        const flicker = weak > 0 ? 0.5 + 0.5 * Math.sin(timestamp / 40 + i) : 1
        ctx.globalAlpha = (weakened ? .45 : 1) * Math.min(0.95, (0.45 + 0.08 * power) * (1 + 0.4 * straight)) * Math.min(1, t * 4) * (1 - 0.6 * weak * (1 - flicker))
        ctx.lineWidth = (0.8 + 0.45 * power) * (0.55 + 0.25 * heft) * (1 + 0.3 * straight) * (1 - 0.5 * weak)
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.quadraticCurveTo(mid.x, mid.y, to.x, to.y)
        ctx.stroke()
    }
    // The stream to a latched creature, drawn from the real airflow numbers
    const streamTarget = player.latchTarget ? world?.players?.get(player.latchTarget) : null
    if (streamTarget && flow.coherence > 0.02) {
        drawStream(mode, ctx, id, player, streamTarget, mouthX, mouthY, facing, timestamp, flow.coherence, fraying, power, heft, flow, dt, weakened)
    }
    // Side streams peeling off to each creature it's robbing and each gem in its pull
    const pulled: { x: number; y: number; color: string }[] = []
    for (const victimId of String(player.robbing ?? '').split(',')) {
        const victim = victimId ? world?.players?.get(victimId) : null
        if (victim) pulled.push({ x: victim.x + victim.width / 2, y: victim.y + victim.height / 2, color: 'rgba(220, 245, 255, 1)' })
    }
    world?.gems?.forEach((gem: SyncedGem, gemId: string) => {
        if (pulled.length >= 8) return
        const dx = gem.x - mouthX
        const dy = gem.y - mouthY
        const d = Math.hypot(dx, dy)
        if (d > reach || d < 1) return
        const off = Math.acos(Math.max(-1, Math.min(1, (dx * Math.cos(facing) + dy * Math.sin(facing)) / d)))
        if (off <= arc) pulled.push({ x: gem.x, y: gem.y, color: gemColor(gemId) })
    })
    ctx.lineWidth = 1.5
    pulled.forEach((source, j) => {
        const side = j % 2 ? 1 : -1
        const dx = mouthX - source.x
        const dy = mouthY - source.y
        const bx = (source.x + mouthX) / 2 - dy * 0.2 * side
        const by = (source.y + mouthY) / 2 + dx * 0.2 * side
        ctx.strokeStyle = source.color
        for (let k = 0; k < 2; k++) {
            const t = (timestamp / 520 + k / 2 + j * 0.13) % 1
            const from = onCurve(source.x, source.y, bx, by, mouthX, mouthY, t)
            const to = onCurve(source.x, source.y, bx, by, mouthX, mouthY, Math.min(1, t + 0.14))
            ctx.globalAlpha = 0.7 * Math.min(1, t * 3) * (1 - 0.5 * weak)
            ctx.beginPath()
            ctx.moveTo(from.x, from.y)
            ctx.lineTo(to.x, to.y)
            ctx.stroke()
        }
    })
    // The mouth glows and throbs, harder and faster the stronger the pull
    ctx.globalAlpha = 1 - 0.5 * weak
    const throb = 0.5 + 0.5 * Math.sin((timestamp / 1000) * Math.PI * 2 * (2 + power))
    const core = (size / 2) * (0.35 + 0.1 * power) * (0.85 + 0.15 * throb) * 2
    const rush = ctx.createRadialGradient(mouthX, mouthY, 0, mouthX, mouthY, core)
    rush.addColorStop(0, `rgba(235, 250, 255, ${Math.min(0.7, 0.22 + 0.1 * power)})`)
    rush.addColorStop(1, 'rgba(235, 250, 255, 0)')
    ctx.fillStyle = rush
    ctx.beginPath()
    ctx.arc(mouthX, mouthY, core, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
}

/**
 * The stream between an inhaler and its latched creature, drawn only from the airflow numbers
 * (game/airflow streamLook): it narrows and smooths as quality rises, bends as the creature slips
 * off your facing (the air leaves your mouth along it and curves to them), runs continuous when the
 * beam is efficient on breath and breaks up when it's wasteful, churns where bodies press together,
 * and, between two inhaling each other, the flows meet in a turbulent pressure zone pushed toward
 * whichever side is losing. Coherence, not brightness, says how strong it is.
 */
export function drawStream(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, id: string, player: SyncedPlayer, target: SyncedPlayer, mouthX: number, mouthY: number, facing: number, timestamp: number, coherence: number, fraying: number, power: number, heft: number, flow: Airflow, dt: number, weakened = false) : void {
    const at = mode.drawnPositions.get(player.latchTarget) ?? target
    const tx = at.x + target.width / 2
    const ty = at.y + target.height / 2
    const dx = tx - mouthX
    const dy = ty - mouthY
    const dist = Math.hypot(dx, dy)
    if (dist < 1) return
    const nx = -dy / dist
    const ny = dx / dist
    const me = mode.drawnPositions.get(id) ?? player
    const mutual = Boolean(target.inhaling) && target.latchTarget === id
    const mine = coherence * latchSizeFactor(player.width, target.width)
    const theirs = mutual ? (Number(target.latchQuality) || 0) * latchSizeFactor(target.width, player.width) : 0
    const look = streamLook({
        quality: coherence,
        beamQuality: Number(player.beamQuality) || 0,
        clean: cleanAir({ x: me.x + player.width / 2, y: me.y + player.height / 2, width: player.width }, { x: tx, y: ty, width: target.width }),
        mine,
        theirs,
        fraying,
    })
    // Where my air comes from: the creature, or (inhaling each other) where our flows meet
    const sourceX = mouthX + dx * look.boundary
    const sourceY = mouthY + dy * look.boundary
    const span = dist * look.boundary
    // The stream is a rope of air: it leaves your mouth along your facing, its far end holds on its
    // source, and in between it eases toward a smooth curve, the far part slowly (slowest when the
    // stream is coherent), so turning winds it and a tight line holds its curve before relaxing
    const points = 10
    const rest = (u: number) => {
        const k = 1 - u
        const bx = mouthX + Math.cos(facing) * span * 0.45
        const by = mouthY + Math.sin(facing) * span * 0.45
        const cx = sourceX + (mouthX - sourceX) * 0.25
        const cy = sourceY + (mouthY - sourceY) * 0.25
        return {
            x: k * k * k * mouthX + 3 * k * k * u * bx + 3 * k * u * u * cx + u * u * u * sourceX,
            y: k * k * k * mouthY + 3 * k * k * u * by + 3 * k * u * u * cy + u * u * u * sourceY,
        }
    }
    const last = flow.rope?.[points]
    if (!flow.rope || flow.rope.length !== points + 1 || !last || Math.hypot(last.x - sourceX, last.y - sourceY) > 300) {
        flow.rope = Array.from({ length: points + 1 }, (_, i) => rest(i / points))
    }
    const rope = flow.rope
    const knot = (i: number) => rope[i] as { x: number; y: number }
    rope[0] = { x: mouthX, y: mouthY }
    rope[points] = { x: sourceX, y: sourceY }
    for (let i = 1; i < points; i++) {
        const u = i / points
        const goal = rest(u)
        const rate = 14 * (1 - u) + (1.2 + 6 * (1 - look.coherence)) * u
        const ease = 1 - Math.exp(-rate * Math.min(0.1, Math.max(0, dt)))
        knot(i).x += (goal.x - knot(i).x) * ease
        knot(i).y += (goal.y - knot(i).y) * ease
    }
    // A point along the rope: u 0 at its source, 1 at the mouth (the way the air travels)
    const along = (u: number) => {
        const f = (1 - Math.max(0, Math.min(1, u))) * points
        const i = Math.min(points - 1, Math.floor(f))
        const r = f - i
        return { x: knot(i).x + (knot(i + 1).x - knot(i).x) * r, y: knot(i).y + (knot(i + 1).y - knot(i).y) * r }
    }
    const width = target.width * 0.5 * (1 - 0.85 * look.coherence) + 1.5
    const lanes = Math.round(4 + 8 * look.efficiency + 2 * heft)
    const segment = 0.12 + 0.25 * look.coherence + 0.15 * look.efficiency
    const period = (Math.max(30, span) / (INHALE_LOOK.STREAK_SPEED * Math.max(1, power) * (0.8 + 0.6 * look.coherence))) * 1000
    ctx.save()
    ctx.lineCap = 'round'
    ctx.strokeStyle = weakened ? '#ffae94' : look.recharging ? 'rgba(190, 255, 235, 1)' : 'rgba(220, 245, 255, 1)'
    ctx.lineWidth = 1.1 + 1.3 * look.coherence
    const pointAt = (u: number, lane: number, phase: number) => {
        const base = along(u)
        const ahead = along(u + 0.03)
        const behind = along(u - 0.03)
        const tangent = Math.hypot(ahead.x - behind.x, ahead.y - behind.y)
        const sideX = tangent > 1e-6 ? -(ahead.y - behind.y) / tangent : nx
        const sideY = tangent > 1e-6 ? (ahead.x - behind.x) / tangent : ny
        const offset = width * lane * (1 - u * 0.8) + Math.sin(timestamp / 70 + phase + u * 6) * look.turbulence * width * 0.8
        return { x: base.x + sideX * offset, y: base.y + sideY * offset }
    }
    for (let i = 0; i < lanes; i++) {
        // A wasteful beam is broken up; an efficient one runs unbroken
        if (weakened && i % 3 !== 0 || look.efficiency < 0.5 && look.coherence < 0.6 && (i + Math.floor(timestamp / 90)) % 3 === 0) continue
        const lane = lanes > 1 ? (i / (lanes - 1)) * 2 - 1 : 0
        const t = (((timestamp / period + i * 0.37) % 1) + 1) % 1
        const end = Math.min(1, t + segment)
        const from = pointAt(t, lane, i * 2.1)
        const mid = pointAt((t + end) / 2, lane, i * 2.1)
        const to = pointAt(end, lane, i * 2.1)
        ctx.globalAlpha = (weakened ? .4 : 1) * (0.3 + 0.5 * look.coherence) * Math.min(1, t * 4)
        ctx.beginPath()
        ctx.moveTo(from.x, from.y)
        ctx.quadraticCurveTo(mid.x, mid.y, to.x, to.y)
        ctx.stroke()
    }
    // Smothered: where the bodies press together, the air bunches up and churns
    const churn = (cx: number, cy: number, radius: number, strength: number, seed: number) => {
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(220, 240, 255, 1)'
        const count = Math.round(4 + 6 * strength)
        for (let j = 0; j < count; j++) {
            const a = timestamp / (160 + 40 * (j % 3)) + j * 1.7 + seed
            const r = radius * (0.4 + 0.6 * ((j * 0.618) % 1))
            ctx.globalAlpha = 0.25 + 0.45 * strength
            ctx.beginPath()
            ctx.arc(cx + Math.cos(a * 0.7) * r * 0.5, cy + Math.sin(a * 0.9) * r * 0.5, r * 0.45, a, a + 1.6 + strength)
            ctx.stroke()
        }
    }
    const smother = 1 - cleanAir({ x: me.x + player.width / 2, y: me.y + player.height / 2, width: player.width }, { x: tx, y: ty, width: target.width })
    if (smother > 0.02) churn((mouthX + tx) / 2, (mouthY + ty) / 2, Math.min(player.width, target.width) * 0.6, smother, 0)
    // Inhaling each other: a turbulent pressure zone where the flows meet (drawn once per pair), bigger the more even the contest
    if (mutual && look.boundary < 0.98 && id < player.latchTarget) {
        const balance = 1 - Math.abs(mine - theirs) / Math.max(1e-6, mine + theirs)
        churn(sourceX, sourceY, Math.min(player.width, target.width) * (0.5 + 0.7 * balance), 0.4 + 0.6 * balance, 1.3)
    }
    ctx.restore()
}
