import type { MultiplayerMode } from '../core/GameModes'
import { CANNON, GEMS, INHALE, PLAYER_COLORS } from '../../server/constants/gameConstants'
import { drawBreath, drawCreature, drawDizzy, drawProjectile, mouthOf } from './creatures'
import { FONT, GOLD, drawCrown, drawRobot, roundedRect } from './style'
import { SMOOTHING, SNAP_DISTANCE } from './shared'
import { drawAirflow } from './stream'
import type { SyncedGameState, SyncedPlayer } from '../types/synced'
import { drawInjury } from './injury'
import { formatGems } from '../utils/score'

const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)')

/** Where a captive is drawn this frame while it's being sucked in: its center, and how far down the throat it has shrunk */
export interface HeldPose {
    x: number
    y: number
    scale: number
}

/** How long a caught creature takes to slide down the throat and out of sight */
export const SUCK_MS = 280

/** How long a creature takes to swell back to full size as it comes back out (let go, slipped free, or fired) */
export const EMERGE_MS = 220

/** The captor holding this player at its mouth right now (both alive, and the captor's hold agrees), or null */
export function captorOf(state: SyncedGameState, player: SyncedPlayer, sessionId: string): { id: string; captor: SyncedPlayer } | null {
    if (!player.capturedBy || player.state !== 'alive') return null
    const captor = state.players.get(player.capturedBy)
    if (!captor || captor.state !== 'alive' || captor.gulping !== sessionId) return null
    return { id: player.capturedBy, captor }
}


/** Which way each flying creature is heading, frame to frame (kept from the last frame that moved it enough to tell) */
const headings = new Map<string, number>()

export function drawPlayer(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, player: SyncedPlayer, sessionId: string, isLocal: boolean, isLeader: boolean, timestamp: number, held?: HeldPose) : void {
    if (player.state !== 'alive') {
        return // knocked out: gone until they're back
    }

    // Back out of a mouth (let go, slipped free, fired or expelled): it swells back up to size as it comes out
    if (!held && mode.captures.has(sessionId)) {
        mode.captures.delete(sessionId)
        mode.emerges.set(sessionId, timestamp)
    }
    let emerge = 1
    const emergedAt = mode.emerges.get(sessionId)
    if (emergedAt !== undefined) {
        const k = (timestamp - emergedAt) / EMERGE_MS
        if (k >= 1) mode.emerges.delete(sessionId)
        else emerge = 0.25 + 0.75 * (1 - Math.pow(1 - k, 3))
    }

    // Your own player is drawn where your hops put it; other players ease toward the
    // server position so ~20 updates a second still look smooth at 60 fps
    let drawn = mode.drawnPositions.get(sessionId)
    const before = drawn ? { x: drawn.x, y: drawn.y } : null
    if (held) {
        // Being sucked in: drawn where its captor's mouth is this frame, so the two never drift apart
        drawn = { x: held.x - player.width / 2, y: held.y - player.height / 2 }
        mode.drawnPositions.set(sessionId, drawn)
    } else if (isLocal && mode.predicted) {
        drawn = { x: mode.predicted.x, y: mode.predicted.y }
        mode.drawnPositions.set(sessionId, drawn)
    } else if (!drawn || Math.hypot(player.x - drawn.x, player.y - drawn.y) > SNAP_DISTANCE) {
        drawn = { x: player.x, y: player.y }
        mode.drawnPositions.set(sessionId, drawn)
    } else {
        drawn.x += (player.x - drawn.x) * SMOOTHING
        drawn.y += (player.y - drawn.y) * SMOOTHING
    }

    ctx.save()
    if (player.spawnProtected || mode.inGrace) {
        // Just back in: translucent inside a soft bubble until the protection wears off
        ctx.globalAlpha = 0.45 + 0.15 * Math.sin(timestamp / 90)
        ctx.strokeStyle = 'rgba(160, 235, 255, 0.95)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(drawn.x + player.width / 2, drawn.y + player.height / 2, player.width * 0.85, 0, Math.PI * 2)
        ctx.stroke()
    }
    if (player.recovering) {
        // Keep damage readable; injury must not resemble blinking invincibility.
        ctx.globalAlpha = 0.9
    }
    // Size changes pop: a quick overshoot and settle, centered on where the player is
    let grow = mode.drawnSizes.get(sessionId)
    if (!grow) {
        grow = { size: player.width, speed: 0 }
        mode.drawnSizes.set(sessionId, grow)
    }
    grow.speed = (grow.speed + (player.width - grow.size) * 0.3) * 0.6
    grow.size += grow.speed
    // ...plus a little pop for every gem it gains (settling over 130ms), however big it already is
    const gemPop = mode.gemPops.get(sessionId)
    const pop = gemPop ? 1 + gemPop.amount * Math.max(0, 1 - (timestamp - gemPop.at) / 130) : 1
    const size = Math.max(4, grow.size) * pop * (held?.scale ?? 1) * emerge
    const left = drawn.x + (player.width - size) / 2
    const top = drawn.y + (player.height - size) / 2
    const centerX = drawn.x + player.width / 2
    const centerY = drawn.y + player.height / 2
    const world = mode.multiplayerManager?.getState() as SyncedGameState | undefined
    const shieldLeft = world ? player.launchSafeUntil - mode.worldNow(world, timestamp) : 0
    if (shieldLeft > 0 && !player.flying) {
        const u = 1 / Math.max(0.001, Math.abs(ctx.getTransform().a))
        const radius = size / 2 + 8 * u
        ctx.save()
        ctx.strokeStyle = 'rgba(115, 244, 216, 0.15)'
        ctx.lineWidth = 5 * u
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
        ctx.stroke()
        ctx.strokeStyle = '#86edce'
        ctx.lineWidth = 2 * u
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, shieldLeft / CANNON.LAND_SAFE_MS))
        ctx.stroke()
        if (isLocal) {
            ctx.font = `700 ${10 * u}px ${FONT}`
            ctx.textAlign = 'center'
            ctx.fillStyle = '#acffe4'
            ctx.fillText('SUCTION SAFE', centerX, centerY + radius + 16 * u)
        }
        ctx.restore()
    }
    if (player.inhaling) {
        // Draining someone (harder the bigger it is next to them) or holding a captive: the inhale looks stronger
        const victim = player.stealingFrom ? world?.players.get(player.stealingFrom) : null
        const grip = victim ? Math.min(INHALE.BODY_PULL_MAX, Math.max(0.3, player.width / victim.width)) : 0
        const intensity = player.gulping ? 1.8 : victim ? 1 + 0.5 * grip : 1
        drawAirflow(mode, ctx, sessionId, player, centerX, centerY, size, isLocal ? mode.localFacing : (player.facing ?? -Math.PI / 2), timestamp, intensity, isLocal)
    } else {
        const flow = mode.flows.get(sessionId)
        if (flow) flow.inhaling = false
    }
    if (isLocal) {
        // Your breath: draining around you while you inhale, refilling while you catch it
        mode.breath = mode.breathOf(Boolean(player.inhaling), performance.now(), Number(player.beamQuality) || 0)
        drawBreath(ctx, centerX, centerY, size, mode.breath, timestamp)
    }
    if (isLocal && player.gems < GEMS.SURVIVE_AT) {
        // One hit from behind from being knocked out: a cracked red ring
        ctx.save()
        ctx.setLineDash([5, 4])
        ctx.strokeStyle = `rgba(255, 90, 90, ${0.45 + 0.25 * Math.sin(timestamp / 250)})`
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(left + size / 2, top + size / 2, size / 2 + 4, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
    }
    if (player.sliding) {
        // Dust kicked up by a slide or a skid
        ctx.fillStyle = 'rgba(200, 210, 220, 0.35)'
        for (let i = 0; i < 3; i++) {
            ctx.beginPath()
            ctx.arc(left + size * (0.2 + 0.3 * i), top + size + 3 + Math.sin(timestamp / 60 + i * 2) * 2, size * 0.14, 0, Math.PI * 2)
            ctx.fill()
        }
    }
    // A round creature whose eyes show which way it faces (its back is where it's vulnerable)
    const facing = isLocal ? mode.localFacing : (player.facing ?? -Math.PI / 2)
    // Fired: it flies nose first, the way it's actually moving
    if (player.flying) {
        const dx = before ? drawn.x - before.x : 0
        const dy = before ? drawn.y - before.y : 0
        if (Math.hypot(dx, dy) > 0.5) headings.set(sessionId, Math.atan2(dy, dx))
    } else {
        headings.delete(sessionId)
    }
    const heading = headings.get(sessionId) ?? facing
    // Pressed against someone, the body gives a little along the line of contact
    const squash = squashFor(mode, sessionId, left + size / 2, top + size / 2, size)
    // A full belly breathes gently; the captive cannot nudge its captor.
    const holding = player.gulping ? world?.players.get(player.gulping) : undefined
    const quiver = holding ? 1 + 0.008 * Math.sin(timestamp / 300) : 1
    // Exhaling: the body puffs out as the air goes, then settles
    const puff = mode.puffs.find((p) => p.by === sessionId)
    const puffed = puff ? 1 + 0.14 * Math.sin(Math.PI * Math.min(1, (timestamp - puff.at) / 260)) : 1
    const injuryRemaining = player.continuedTheft ? 1000 : (player.injuredUntil ?? 0) - (world ? mode.worldNow(world, timestamp) : 0)
    const injuryAge = INHALE.INJURY_MS - injuryRemaining
    const impactPop = !REDUCED_MOTION.matches && player.injuredUntil > 0 && injuryAge >= 0 && injuryAge < 220 ? Math.sin(Math.PI * injuryAge / 220) : 0
    const bulge = quiver * puffed
    ctx.save()
    if (impactPop > 0) {
        ctx.translate(centerX, centerY); ctx.rotate(facing)
        ctx.scale(1 - .08 * impactPop, 1 + .06 * impactPop)
        ctx.rotate(-facing); ctx.translate(-centerX, -centerY)
    }
    if (player.stunned) {
        ctx.translate(centerX, centerY)
        ctx.rotate(0.045 * Math.sin(timestamp / 55))
        ctx.translate(-centerX, -centerY)
    }
    if (squash.amount > 0 || bulge !== 1) {
        ctx.translate(left + size / 2, top + size / 2)
        if (bulge !== 1) ctx.scale(bulge, bulge)
        if (squash.amount > 0) {
            ctx.rotate(squash.angle)
            ctx.scale(1 - squash.amount, 1 + squash.amount * 0.5)
            ctx.rotate(-squash.angle)
        }
        ctx.translate(-(left + size / 2), -(top + size / 2))
    }
    const color = isLocal ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
    // Cheeks inflate during the gulp, then stay full until firing or release.
    const heldFor = world && holding ? mode.worldNow(world, timestamp) - (player.gulpEndsAt - holding.captureHoldMs) : 0
    const cheekProgress = holding ? Math.max(0, Math.min(1, heldFor / SUCK_MS)) : 0
    const cheeks = 1 - Math.pow(1 - cheekProgress, 3)
    if (player.flying) drawProjectile(ctx, left + size / 2, top + size / 2, size, color, heading, timestamp)
    else drawCreature(ctx, left + size / 2, top + size / 2, size, color, facing, timestamp, player.mouth ?? '', Boolean(player.inhaling), cheeks, Boolean(player.stunned))
    if (!held && !player.flying && player.injuredUntil > 0) drawInjury(ctx, centerX, centerY, size, facing, injuryAge, injuryRemaining, REDUCED_MOTION.matches)
    ctx.restore()
    const weaponProtection = world ? Math.max(0, player.weaponSafeUntil - mode.worldNow(world, timestamp)) : 0
    if (!held && !player.flying && weaponProtection > 0) {
        const u = 1 / Math.max(.001, Math.abs(ctx.getTransform().a)), r = size / 2 + 7 * u
        ctx.save(); ctx.strokeStyle = '#9dcaff'; ctx.lineWidth = 2 * u
        ctx.globalAlpha = Math.min(.7, weaponProtection / 250)
        for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; ctx.beginPath(); ctx.arc(centerX, centerY, r, a + .12, a + .7); ctx.stroke() }
        ctx.restore()
    }
    // The hold badge stays beneath the puffed cheeks and clear eyes.
    if (player.gulping) drawMouthful(mode, ctx, player, left + size / 2, top + size / 2, size, facing, timestamp)
    // Dazed: spiral pupils, a slight wobble, and a halo outside the face.
    if (player.stunned) {
        drawDizzy(ctx, centerX, centerY, size, timestamp)
        ctx.save()
        if (isLocal) {
            const u = 1 / Math.max(0.001, Math.abs(ctx.getTransform().a))
            ctx.font = `800 ${10 * u}px ${FONT}`
            ctx.textAlign = 'center'
            ctx.fillStyle = '#ffe29b'
            ctx.fillText('STUNNED', centerX, centerY + size / 2 + 26 * u)
        }
        ctx.restore()
    }
    ctx.globalAlpha = 1
    ctx.font = `600 16px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = isLocal ? '#ffffff' : '#cfd8dc'
    const label = String(player.name ?? '')
    const labelX = drawn.x + player.width / 2
    ctx.fillText(label, labelX, drawn.y - 6)
    if (player.isBot) drawRobot(ctx, labelX - ctx.measureText(label).width / 2 - 11, drawn.y - 14, 12)
    if (isLeader) {
        drawCrown(ctx, drawn.x + player.width / 2, drawn.y - 26, 22)
        // What the leader is worth
        ctx.font = `800 14px ${FONT}`
        ctx.fillStyle = GOLD
        ctx.fillText(formatGems(player.gems), drawn.x + player.width / 2, drawn.y - 50)
    }
    ctx.restore()
}

/** A compact hold countdown below the body keeps the face and eyes unobscured. */
function drawMouthful(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, captor: SyncedPlayer, cx: number, cy: number, size: number, facing: number, timestamp: number): void {
    const state = mode.multiplayerManager?.getState() as SyncedGameState | undefined
    const id = captor.gulping
    const captive = state?.players.get(id)
    if (!state || !captive || !captorOf(state, captive, id)) return
    const localId = mode.multiplayerManager?.localSessionId
    const own = captor.sessionId === localId
    const m = mouthOf(cx, cy, size, facing)
    if (!mode.captures.has(id)) {
        const from = mode.centerOf(id, captive)
        mode.captures.set(id, { at: timestamp, x: from.x, y: from.y })
    }
    mode.drawnPositions.set(id, { x: m.x - captive.width / 2, y: m.y - captive.height / 2 })
    if (id === localId) {
        mode.breath = mode.breathOf(false, performance.now(), 0)
        // The local captive has its own interior view.
        return
    }
    const u = 1 / Math.max(0.001, Math.abs(ctx.getTransform().a))
    const width = (own ? 118 : 76) * u
    const height = (own ? 38 : 28) * u
    const x = cx - width / 2
    const y = cy + size / 2 + 12 * u
    const now = mode.worldNow(state, timestamp)
    const remaining = Math.max(0, (captor.gulpEndsAt - now) / 1000)
    const loading = Math.max(0, Math.min(1, (captor.gulpEndsAt - now) / Math.max(1, captive.captureHoldMs)))
    const ready = true
    ctx.save()
    ctx.fillStyle = 'rgba(9, 19, 32, 0.95)'
    roundedRect(ctx, x, y, width, height, 10 * u)
    ctx.fill()
    ctx.strokeStyle = ready ? GOLD : 'rgba(255,255,255,0.3)'
    ctx.lineWidth = u
    ctx.stroke()
    drawCreature(ctx, x + 16 * u, y + height / 2 - 2 * u, 16 * u, id === localId ? '#ffffff' : PLAYER_COLORS[captive.playerIndex % PLAYER_COLORS.length], -Math.PI / 2)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.font = '700 ' + 10 * u + 'px ' + FONT
    ctx.fillStyle = ready ? GOLD : '#dce8ee'
    const label = own ? `FIRE · ${remaining.toFixed(1)}s` : `${remaining.toFixed(1)}s`
    ctx.fillText(label, x + 30 * u, y + (own ? 13 : 10) * u)
    const barX = x + 30 * u
    const barY = y + height - 9 * u
    const barW = width - 40 * u
    ctx.fillStyle = 'rgba(255,255,255,0.12)'
    roundedRect(ctx, barX, barY, barW, 3 * u, 1.5 * u)
    ctx.fill()
    ctx.fillStyle = GOLD
    roundedRect(ctx, barX, barY, Math.max(u, barW * loading), 3 * u, 1.5 * u)
    ctx.fill()
    // The aim line begins beyond the body, so it never crosses the eyes either.
    if (own) {
        const fx = Math.cos(facing), fy = Math.sin(facing)
        const from = size / 2 + 10 * u
        const reach = from + 420
        const fade = ctx.createLinearGradient(cx + fx * from, cy + fy * from, cx + fx * reach, cy + fy * reach)
        fade.addColorStop(0, 'rgba(255,209,102,.75)')
        fade.addColorStop(1, 'rgba(255,209,102,0)')
        ctx.strokeStyle = fade
        ctx.lineWidth = 2 * u
        ctx.setLineDash([6 * u, 8 * u])
        ctx.beginPath()
        ctx.moveTo(cx + fx * from, cy + fy * from)
        ctx.lineTo(cx + fx * reach, cy + fy * reach)
        ctx.stroke()
    }
    ctx.restore()
}

/** Pressed against another creature: how much this one squishes, and along which line (lighter ones squish more) */
export function squashFor(mode: MultiplayerMode, id: string, x: number, y: number, size: number) : { angle: number; amount: number } {
    const state = mode.multiplayerManager?.getState()
    if (!state) return { angle: 0, amount: 0 }
    const self = state.players.get(id) as SyncedPlayer | undefined
    let angle = 0
    let amount = 0
    state.players.forEach((other: SyncedPlayer, otherId: string) => {
        if (otherId === id || other.state !== 'alive') return
        // A captor and its captive overlap on purpose (one is in the other's mouth): no squish between them
        if (other.capturedBy === id || self?.capturedBy === otherId) return
        const at = mode.drawnPositions.get(otherId) ?? other
        const ox = at.x + other.width / 2
        const oy = at.y + other.height / 2
        const d = Math.hypot(ox - x, oy - y)
        const overlap = (size + other.width) / 2 - d
        if (overlap <= 0 || d < 1e-6) return
        const squash = Math.min(0.14, (overlap / size) * (other.width / (other.width + size)) * 1.6)
        if (squash > amount) {
            amount = squash
            angle = Math.atan2(oy - y, ox - x)
        }
    })
    return { angle, amount }
}
