import type { MultiplayerMode } from '../core/GameModes'
import { GEMS, INHALE, PLAYER_COLORS } from '../../server/constants/gameConstants'
import { MOUTH_OFFSET, drawBreath, drawCreature, drawProjectile, mouthOf, mouthRadius } from './creatures'
import { FONT, GOLD, drawCrown, drawRobot } from './style'
import { SMOOTHING, SNAP_DISTANCE } from './shared'
import { drawAirflow } from './stream'
import type { SyncedGameState, SyncedPlayer } from '../types/synced'

/** Where a captive is drawn this frame while it's being sucked in: its center, and how far down the throat it has shrunk */
export interface HeldPose {
    x: number
    y: number
    scale: number
}

/** How long a caught creature takes to slide down the throat and out of sight */
export const SUCK_MS = 280

/** How long a creature takes to swell back to full size as it comes back out (let go, slipped free, fired or expelled) */
export const EMERGE_MS = 220

/** The captor holding this player at its mouth right now (both alive, and the captor's hold agrees), or null */
export function captorOf(state: SyncedGameState, player: SyncedPlayer, sessionId: string): { id: string; captor: SyncedPlayer } | null {
    if (!player.capturedBy || player.state !== 'alive') return null
    const captor = state.players.get(player.capturedBy)
    if (!captor || captor.state !== 'alive' || captor.gulping !== sessionId) return null
    return { id: player.capturedBy, captor }
}

/** True while a captor is drawing its captive, so a captive never draws one of its own (the server never allows it; the loop must still end) */
let drawingMouthful = false

/** Which way each flying creature is heading, frame to frame (kept from the last frame that moved it enough to tell) */
const headings = new Map<string, number>()

export function drawPlayer(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, player: SyncedPlayer, sessionId: string, isLocal: boolean, isLeader: boolean, timestamp: number, held?: HeldPose) : void {
    if (player.state !== 'alive') {
        // Gulped: riding inside its swallower, out of sight; it comes back out wherever the server puts it
        if (player.state === 'gulped') mode.drawnPositions.delete(sessionId)
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
        // Just hit: blink until traffic can touch you again
        ctx.globalAlpha = Math.floor(timestamp / 90) % 2 ? 0.25 : 0.9
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
    if (player.inhaling) {
        // Draining someone (harder the bigger it is next to them) or holding someone to swallow: the inhale looks stronger
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
    // Holding someone inside: the body quivers with their struggle; someone swallowed whole riding inside: it bulges, pulsing, until they pop back out
    const holding = player.gulping ? world?.players.get(player.gulping) : undefined
    const quiver = holding ? 1 + 0.02 * Math.sin(timestamp / 45) * (0.4 + 0.6 * Math.min(1, holding.struggle)) : 1
    // Exhaling: the body puffs out as the air goes, then settles
    const puff = mode.puffs.find((p) => p.by === sessionId)
    const puffed = puff ? 1 + 0.14 * Math.sin(Math.PI * Math.min(1, (timestamp - puff.at) / 260)) : 1
    const bulge = (swallowedInside(world, sessionId) ? 1 + 0.05 * (0.6 + 0.4 * Math.sin(timestamp / 90)) : 1) * quiver * puffed
    ctx.save()
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
    if (player.flying) drawProjectile(ctx, left + size / 2, top + size / 2, size, color, heading, timestamp)
    else drawCreature(ctx, left + size / 2, top + size / 2, size, color, facing, timestamp, player.mouth ?? '', Boolean(player.inhaling))
    ctx.restore()
    // Holding someone: they're sucked in, out of sight, and show as a lump and an arc at the mouth (see drawMouthful)
    if (player.gulping) drawMouthful(mode, ctx, player, left + size / 2, top + size / 2, size, facing, timestamp)
    // Stunned by a Core: a few little stars wheeling over its head
    if (player.stunned) {
        ctx.save()
        ctx.fillStyle = 'rgba(255, 228, 130, 0.95)'
        for (let i = 0; i < 3; i++) {
            const a = timestamp / 220 + (i * Math.PI * 2) / 3
            const sx = left + size / 2 + Math.cos(a) * size * 0.42
            const sy = top - 4 + Math.sin(a) * size * 0.12
            const star = 2.5 + size * 0.025
            ctx.beginPath()
            ctx.moveTo(sx, sy - star * 1.6)
            ctx.lineTo(sx + star * 0.5, sy - star * 0.5)
            ctx.lineTo(sx + star * 1.6, sy)
            ctx.lineTo(sx + star * 0.5, sy + star * 0.5)
            ctx.lineTo(sx, sy + star * 1.6)
            ctx.lineTo(sx - star * 0.5, sy + star * 0.5)
            ctx.lineTo(sx - star * 1.6, sy)
            ctx.lineTo(sx - star * 0.5, sy - star * 0.5)
            ctx.closePath()
            ctx.fill()
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
        ctx.fillText(`${player.gems}`, drawn.x + player.width / 2, drawn.y - 50)
    }
    ctx.restore()
}

/**
 * The captive in this captor's mouth. Just caught, it slides from where it was down the throat and out of
 * sight in SUCK_MS, shrinking as it goes (seen through the mouth opening and wherever it still pokes out
 * past the body; the body hides the rest). Then it's gone from the map: a lump under the skin shows where
 * it's pushing (it slides sideways as the captive slips sideways), and one small arc at the mouth shows
 * progress: gold as it works free, red (only if it can be swallowed) as the swallow builds.
 */
function drawMouthful(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, captor: SyncedPlayer, cx: number, cy: number, size: number, facing: number, timestamp: number): void {
    if (drawingMouthful) return
    const state = mode.multiplayerManager?.getState() as SyncedGameState | undefined
    const captiveId = captor.gulping
    const captive = state?.players.get(captiveId)
    if (!state || !captive || !captorOf(state, captive, captiveId)) return
    const r = size / 2
    const m = mouthOf(cx, cy, size, facing)
    const localId = mode.multiplayerManager?.localSessionId ?? null
    // Just caught: remember when, and where it was, so it can be seen sliding in from there
    let caught = mode.captures.get(captiveId)
    if (!caught) {
        const from = mode.centerOf(captiveId, captive)
        caught = { at: timestamp, x: from.x, y: from.y }
        mode.captures.set(captiveId, caught)
    }
    // Where the server holds it, relative to the server's mouth: along the facing (pushing straight out; the
    // hold wants it 0.45 of its width out) and across it (slipping sideways), which is how its struggle shows
    const serverFacing = captor.facing ?? facing
    const sfx = Math.cos(serverFacing)
    const sfy = Math.sin(serverFacing)
    const ox = captive.x + captive.width / 2 - (captor.x + captor.width / 2 + sfx * captor.width * MOUTH_OFFSET)
    const oy = captive.y + captive.height / 2 - (captor.y + captor.height / 2 + sfy * captor.width * MOUTH_OFFSET)
    const along = ox * sfx + oy * sfy - 0.45 * captive.width
    const across = -ox * sfy + oy * sfx
    const fx = Math.cos(facing)
    const fy = Math.sin(facing)
    // The lump: just inside the mouth when subdued, moving with the struggle (half as far along, fully across)
    const lx = m.x + fx * (along * 0.5 - size * 0.08) - fy * across
    const ly = m.y + fy * (along * 0.5 - size * 0.08) + fx * across
    // Its drawn position stays at the mouth, so when it comes back out it starts from there; your breath still shows
    mode.drawnPositions.set(captiveId, { x: m.x - captive.width / 2, y: m.y - captive.height / 2 })
    if (captiveId === localId) mode.breath = mode.breathOf(false, performance.now(), 0)

    const aperture = Math.min(r * 0.42, mouthRadius(size) * 1.25)
    const outline = Math.max(1.5, size * 0.06)
    const k = Math.min(1, (timestamp - caught.at) / SUCK_MS)

    ctx.save()
    // The dark of the throat
    ctx.fillStyle = '#10151f'
    ctx.beginPath()
    ctx.arc(m.x, m.y, aperture, 0, Math.PI * 2)
    ctx.fill()
    if (k < 1) {
        // Sliding in: from where it was to the mouth, shrinking as it goes down the throat; seen through the
        // opening and wherever it's still outside the body, which hides the rest
        const ease = k * k
        const px = caught.x + (m.x - caught.x) * ease
        const py = caught.y + (m.y - caught.y) * ease
        ctx.save()
        ctx.beginPath()
        const pad = size * 3
        ctx.rect(cx - pad, cy - pad, pad * 2, pad * 2)
        ctx.moveTo(cx + r, cy)
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.moveTo(m.x + aperture, m.y)
        ctx.arc(m.x, m.y, aperture, 0, Math.PI * 2)
        ctx.clip('evenodd')
        drawingMouthful = true
        try {
            drawPlayer(mode, ctx, captive, captiveId, captiveId === localId, false, timestamp, { x: px, y: py, scale: 1 - 0.85 * ease })
        } finally {
            drawingMouthful = false
        }
        ctx.restore()
    } else {
        // Inside: a lump under the skin where it's pushing
        ctx.save()
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(1, r - outline * 0.5), 0, Math.PI * 2)
        ctx.clip()
        const lump = captive.width * 0.45
        ctx.fillStyle = 'rgba(16, 21, 31, 0.22)'
        ctx.beginPath()
        ctx.arc(lx, ly, lump, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)'
        ctx.lineWidth = Math.max(1.5, size * 0.03)
        ctx.beginPath()
        ctx.arc(lx, ly, lump, 0, Math.PI * 2)
        ctx.stroke()
        ctx.restore()
    }
    // The lip: a shadow just inside the opening, and the body's outline carrying on round it
    ctx.lineWidth = outline
    ctx.strokeStyle = 'rgba(16, 21, 31, 0.55)'
    ctx.beginPath()
    ctx.arc(m.x, m.y, Math.max(1, aperture - outline * 0.6), 0, Math.PI * 2)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.arc(m.x, m.y, aperture, 0, Math.PI * 2)
    ctx.stroke()
    // Progress, at the mouth: gold as the captive works free; red, outside it, as the swallow builds
    const ring = aperture + outline + 4
    ctx.lineCap = 'round'
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    ctx.beginPath()
    ctx.arc(m.x, m.y, ring, 0, Math.PI * 2)
    ctx.stroke()
    if (captive.struggle > 0) {
        ctx.strokeStyle = GOLD
        ctx.beginPath()
        ctx.arc(m.x, m.y, ring, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, captive.struggle))
        ctx.stroke()
    }
    if (captive.swallowable && captive.swallowing > 0) {
        ctx.strokeStyle = 'rgba(255, 70, 70, 0.95)'
        ctx.beginPath()
        ctx.arc(m.x, m.y, ring + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, captive.swallowing))
        ctx.stroke()
    }
    if (captor.sessionId === localId) {
        // Loaded: your shot, a dotted line out of the mouth the way you're facing, fading with distance
        const reach = 820
        const line = ctx.createLinearGradient(m.x, m.y, m.x + fx * reach, m.y + fy * reach)
        line.addColorStop(0, 'rgba(255, 209, 102, 0.85)')
        line.addColorStop(1, 'rgba(255, 209, 102, 0)')
        ctx.strokeStyle = line
        ctx.lineWidth = 3
        ctx.lineCap = 'butt'
        ctx.setLineDash([10, 14])
        ctx.lineDashOffset = -((timestamp / 18) % 24)
        ctx.beginPath()
        ctx.moveTo(m.x + fx * (ring + 10), m.y + fy * (ring + 10))
        ctx.lineTo(m.x + fx * reach, m.y + fy * reach)
        ctx.stroke()
        ctx.setLineDash([])
    }
    ctx.restore()
}

/** Whether someone swallowed whole is riding inside this creature right now */
function swallowedInside(state: SyncedGameState | undefined, sessionId: string): boolean {
    if (!state) return false
    let inside = false
    state.players.forEach((other: SyncedPlayer) => {
        if (other.state === 'gulped' && other.insideOf === sessionId) inside = true
    })
    return inside
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
