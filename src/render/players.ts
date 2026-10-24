import type { MultiplayerMode } from '../core/GameModes'
import { GEMS, INHALE, PLAYER_COLORS } from '../../server/constants/gameConstants'
import { drawBreath, drawCreature } from './creatures'
import { FONT, GOLD, drawCrown, drawRobot } from './style'
import { SMOOTHING, SNAP_DISTANCE } from './shared'
import { drawAirflow } from './stream'
import type { SyncedPlayer } from '../types/synced'

export function drawPlayer(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, player: SyncedPlayer, sessionId: string, isLocal: boolean, isLeader: boolean, timestamp: number) : void {
    if (player.state !== 'alive') return // knocked out: gone until they're back

    // Your own player is drawn where your hops put it; other players ease toward the
    // server position so ~20 updates a second still look smooth at 60 fps
    let drawn = mode.drawnPositions.get(sessionId)
    if (isLocal && mode.predicted) {
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
    const size = Math.max(4, grow.size) * pop
    const left = drawn.x + (player.width - size) / 2
    const top = drawn.y + (player.height - size) / 2
    const centerX = drawn.x + player.width / 2
    const centerY = drawn.y + player.height / 2
    if (player.inhaling) {
        // Draining someone (harder the bigger it is next to them) or holding someone to swallow: the inhale looks stronger
        const world = mode.multiplayerManager?.getState()
        const victim = player.stealingFrom ? world?.players?.get(player.stealingFrom) : null
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
    // Pressed against someone, the body gives a little along the line of contact
    const squash = squashFor(mode, sessionId, left + size / 2, top + size / 2, size)
    ctx.save()
    if (squash.amount > 0) {
        ctx.translate(left + size / 2, top + size / 2)
        ctx.rotate(squash.angle)
        ctx.scale(1 - squash.amount, 1 + squash.amount * 0.5)
        ctx.rotate(-squash.angle)
        ctx.translate(-(left + size / 2), -(top + size / 2))
    }
    drawCreature(ctx, left + size / 2, top + size / 2, size, isLocal ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length], facing, timestamp, player.mouth ?? '', Boolean(player.inhaling))
    ctx.restore()
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

/** Pressed against another creature: how much this one squishes, and along which line (lighter ones squish more) */
export function squashFor(mode: MultiplayerMode, id: string, x: number, y: number, size: number) : { angle: number; amount: number } {
    const state = mode.multiplayerManager?.getState()
    if (!state) return { angle: 0, amount: 0 }
    let angle = 0
    let amount = 0
    state.players.forEach((other: SyncedPlayer, otherId: string) => {
        if (otherId === id || other.state !== 'alive') return
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
