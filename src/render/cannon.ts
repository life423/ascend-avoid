import type { MultiplayerMode } from '../core/GameModes'
import type { SyncedGameState } from '../types/synced'
import { TURBINE } from '../../server/constants/gameConstants'
import { noReturnGap } from '../../server/game/turbine'
import { GOLD } from './style'

/** Where each flying creature was last frame, for its speed streaks */
const lastSeen = new Map<string, { x: number; y: number; t: number }>()

/**
 * The living cannonball, and the turbines' danger: each turbine's point of no return (a faint dashed
 * arc across its intake); around a creature caught in a mouth, a gold ring filling as it slips toward
 * freedom and, only if its captor can swallow it, a red arc closing as the swallow builds; and speed
 * streaks behind a flying one
 */
export function drawCannon(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
    ctx.save()
    const ring = TURBINE.BODY_RADIUS + noReturnGap()
    ctx.setLineDash([10, 12])
    ctx.lineWidth = 2
    ctx.strokeStyle = 'rgba(255, 120, 90, 0.35)'
    state.turbines.forEach((turbine) => {
        ctx.beginPath()
        ctx.arc(turbine.x, turbine.y, ring, turbine.intake - TURBINE.INTAKE_ARC, turbine.intake + TURBINE.INTAKE_ARC)
        ctx.stroke()
    })
    ctx.setLineDash([])
    state.players.forEach((player, id) => {
        const at = mode.drawnPositions.get(id) ?? player
        const cx = at.x + player.width / 2
        const cy = at.y + player.height / 2
        const radius = player.width / 2
        if (player.capturedBy) {
            ctx.lineWidth = 3
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
            ctx.beginPath()
            ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2)
            ctx.stroke()
            ctx.strokeStyle = GOLD
            ctx.beginPath()
            ctx.arc(cx, cy, radius + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * player.struggle)
            ctx.stroke()
            // Only when its captor can swallow it: a red arc outside the gold one, closing as the swallow builds
            if (player.swallowable) {
                ctx.lineWidth = 4
                ctx.strokeStyle = 'rgba(255, 70, 70, 0.22)'
                ctx.beginPath()
                ctx.arc(cx, cy, radius + 14, 0, Math.PI * 2)
                ctx.stroke()
                ctx.strokeStyle = 'rgba(255, 70, 70, 0.95)'
                ctx.beginPath()
                ctx.arc(cx, cy, radius + 14, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * player.swallowing)
                ctx.stroke()
            }
        }
        if (!player.flying) {
            lastSeen.delete(id)
            return
        }
        const last = lastSeen.get(id)
        lastSeen.set(id, { x: cx, y: cy, t: timestamp })
        if (!last || timestamp <= last.t) return
        const dx = cx - last.x
        const dy = cy - last.y
        const d = Math.hypot(dx, dy)
        if (d < 0.5) return
        const ux = dx / d
        const uy = dy / d
        ctx.lineWidth = 2
        ctx.strokeStyle = 'rgba(220, 240, 255, 0.55)'
        for (const offset of [-0.6, 0, 0.6]) {
            const sx = cx - ux * radius - uy * offset * radius
            const sy = cy - uy * radius + ux * offset * radius
            ctx.beginPath()
            ctx.moveTo(sx, sy)
            ctx.lineTo(sx - ux * radius * 1.8, sy - uy * radius * 1.8)
            ctx.stroke()
        }
    })
    ctx.restore()
}
