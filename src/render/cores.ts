import type { MultiplayerMode } from '../core/GameModes'
import { CORE } from '../../server/constants/gameConstants'
import { airflowOnCore } from '../../server/game/corePhysics'
import { FONT } from './style'
import type { SyncedCore, SyncedGameState, SyncedPlayer } from '../types/synced'

/**
 * The Cores: dense, heavy orbs with a metal rim and a glowing heart (teal at rest, hot orange when
 * moving fast enough to stun), turning rings, and a trail at speed. Drawn a little ahead of the
 * server (carrying on at their velocity, easing to each update). Where someone's airflow is holding
 * one off, the squeezed air shows: a crescent between them and streams bending round the Core.
 */
export function drawCores(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number) : void {
    if (!state.cores) return
    const dt = Math.min(0.1, Math.max(0, (timestamp - mode.coresDrawnAt) / 1000))
    mode.coresDrawnAt = timestamp
    const localId = mode.multiplayerManager?.localSessionId
    const present = new Set<string>()
    state.cores.forEach((core: SyncedCore) => {
        present.add(core.id)
        let drawn = mode.coresDrawn.get(core.id)
        if (!drawn) {
            drawn = { x: core.x, y: core.y }
            mode.coresDrawn.set(core.id, drawn)
        }
        drawn.x += core.vx * dt
        drawn.y += core.vy * dt
        const ease = Math.min(1, dt * 12)
        drawn.x += (core.x - drawn.x) * ease
        drawn.y += (core.y - drawn.y) * ease
        if (Math.hypot(core.x - drawn.x, core.y - drawn.y) > 200) {
            drawn.x = core.x
            drawn.y = core.y
        }
        const x = drawn.x
        const y = drawn.y
        const r = core.radius
        const speed = Math.hypot(core.vx, core.vy)
        const danger = Math.min(1, Math.max(0, (speed * CORE.MASS - CORE.STUN_MOMENTUM * 0.6) / (CORE.STUN_MOMENTUM * 0.4)))
        ctx.save()
        // Squeezed air between it and anyone whose airflow is holding it off
        state.players.forEach((player: SyncedPlayer, id: string) => {
            if (!player.inhaling || player.state !== 'alive') return
            const isLocal = id === localId
            const at = isLocal && mode.predicted ? mode.predicted : (mode.drawnPositions.get(id) ?? player)
            const inhaler = { x: at.x + player.width / 2, y: at.y + player.height / 2, width: player.width, facing: isLocal ? mode.localFacing : player.facing, inhaling: true }
            const { pressure } = airflowOnCore(inhaler, { x, y, vx: core.vx, vy: core.vy, radius: r })
            if (pressure < 0.05) return
            const toward = Math.atan2(inhaler.y - y, inhaler.x - x)
            ctx.lineCap = 'round'
            ctx.strokeStyle = `rgba(200, 240, 255, ${0.15 + 0.45 * pressure})`
            ctx.lineWidth = 2 + 3 * pressure
            ctx.beginPath()
            ctx.arc(x, y, r + 7, toward - 0.9, toward + 0.9)
            ctx.stroke()
            ctx.lineWidth = 1.5
            const phase = (timestamp / 400) % 1
            for (const side of [-1, 1]) {
                ctx.globalAlpha = 0.5 * pressure
                ctx.beginPath()
                ctx.arc(x, y, r + 14 + 6 * phase, toward + side * 0.6, toward + side * (0.6 + 1.6 * (1 - phase)), side < 0)
                ctx.stroke()
            }
            ctx.globalAlpha = 1
        })
        // A trail when it's really moving (hot when it could stun)
        if (speed > 120) {
            const tailX = x - core.vx * 0.12
            const tailY = y - core.vy * 0.12
            const trail = ctx.createLinearGradient(tailX, tailY, x, y)
            trail.addColorStop(0, 'rgba(120, 200, 255, 0)')
            trail.addColorStop(1, danger > 0 ? `rgba(255, 150, 80, ${0.1 + 0.35 * danger})` : 'rgba(120, 200, 255, 0.2)')
            ctx.strokeStyle = trail
            ctx.lineWidth = r * 1.4
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.moveTo(tailX, tailY)
            ctx.lineTo(x, y)
            ctx.stroke()
        }
        // Its shadow, then a dense dark body with a metal rim
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)'
        ctx.beginPath()
        ctx.ellipse(x + r * 0.15, y + r * 0.25, r * 1.05, r * 0.95, 0, 0, Math.PI * 2)
        ctx.fill()
        const body = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r)
        body.addColorStop(0, '#3a4a66')
        body.addColorStop(0.6, '#1a2235')
        body.addColorStop(1, '#0a0e18')
        ctx.fillStyle = body
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(170, 195, 220, 0.75)'
        ctx.lineWidth = 2.5
        ctx.stroke()
        // Two slow rings turning around it (faster when it moves)
        const spin = timestamp / 1600 + (core.vx + core.vy) / 2000
        ctx.strokeStyle = 'rgba(140, 200, 255, 0.35)'
        ctx.lineWidth = 1.5
        for (const tilt of [0.35, 1.9]) {
            ctx.beginPath()
            ctx.ellipse(x, y, r * 0.78, r * 0.3, spin + tilt, 0, Math.PI * 2)
            ctx.stroke()
        }
        // The heart: teal at rest, hot orange when fast enough to stun
        const pulse = 0.85 + 0.15 * Math.sin(timestamp / 260)
        const red = Math.round(79 + 176 * danger)
        const green = Math.round(227 - 87 * danger)
        const blue = Math.round(217 - 157 * danger)
        const heart = ctx.createRadialGradient(x, y, 0, x, y, r * 0.55 * pulse)
        heart.addColorStop(0, `rgba(${red}, ${green}, ${blue}, 0.95)`)
        heart.addColorStop(1, `rgba(${red}, ${green}, ${blue}, 0)`)
        ctx.fillStyle = heart
        ctx.beginPath()
        ctx.arc(x, y, r * 0.55 * pulse, 0, Math.PI * 2)
        ctx.fill()
        // Development only: velocity and speed
        if (CORE.DEBUG) {
            ctx.strokeStyle = '#ff4fd8'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x + core.vx * 0.3, y + core.vy * 0.3)
            ctx.stroke()
            ctx.fillStyle = '#ff4fd8'
            ctx.font = `12px ${FONT}`
            ctx.fillText(`${Math.round(speed)} u/s`, x + r + 6, y - r)
        }
        ctx.restore()
    })
    for (const id of [...mode.coresDrawn.keys()]) if (!present.has(id)) mode.coresDrawn.delete(id)
}
