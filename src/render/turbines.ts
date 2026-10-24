import type { MultiplayerMode } from '../core/GameModes'
import { GEMS, TURBINE } from '../../server/constants/gameConstants'
import { exhaustAngle } from '../../server/game/turbine'
import { drawExhaustWind, drawGem, drawIntakeWind, drawTurbineBody, drawTurbineWarning } from './world'
import type { SyncedGameState, SyncedTurbine, SyncedTurbineFlight } from '../types/synced'

/** Gems lying around, and sprayed ones sliding to a stop (eased, like other players) */
/** Turbines, under the gems and players: warnings, the intake's suction, the exhaust's wind, and the machines */
export function drawTurbines(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number) : void {
    if (!state.turbines?.length) return
    const now = mode.worldNow(state, timestamp)
    state.turbines.forEach((turbine: SyncedTurbine) => {
        if (turbine.phase === 'warning') {
            const progress = Math.max(0, Math.min(1, 1 - (turbine.phaseEndsAt - now) / TURBINE.WARNING_MS))
            drawTurbineWarning(ctx, turbine.x, turbine.y, turbine.intake, progress, timestamp)
            return
        }
        const power = turbine.phase === 'ending' ? Math.max(0, Math.min(1, (turbine.phaseEndsAt - now) / TURBINE.POWER_DOWN_MS)) : 1
        const exhaust = exhaustAngle(turbine.intake, turbine.sweepFrom, now)
        drawIntakeWind(ctx, turbine.x, turbine.y, turbine.intake, power, timestamp)
        drawExhaustWind(ctx, turbine.x, turbine.y, exhaust, power, timestamp)
        drawTurbineBody(ctx, turbine.x, turbine.y, turbine.intake, exhaust, power, timestamp)
    })
}

/**
 * Gems on their way through turbines, over everything: out of the victim's body (a pop where it
 * leaves), rushing into the intake, then across the machine to the exhaust. Everyone sees the
 * same ones, timed by the server; once fired, the gem itself takes over (see drawGems).
 */
export function drawTurbineFlights(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number) : void {
    if (!state.flights?.size) return
    const now = mode.worldNow(state, timestamp)
    const turbines = new Map<string, any>()
    state.turbines?.forEach((turbine: SyncedTurbine) => turbines.set(turbine.id, turbine))
    const r = TURBINE.BODY_RADIUS
    state.flights.forEach((flight: SyncedTurbineFlight) => {
        const turbine = turbines.get(flight.turbine)
        if (!turbine || now >= flight.fireAt) return
        const mouthX = turbine.x + Math.cos(turbine.intake) * r
        const mouthY = turbine.y + Math.sin(turbine.intake) * r
        if (now < flight.arriveAt) {
            const k = Math.max(0, Math.min(1, (now - flight.startAt) / Math.max(1, flight.arriveAt - flight.startAt)))
            if (k < 0.25) {
                // Popping out of the victim
                ctx.strokeStyle = `rgba(255, 209, 102, ${0.8 * (1 - k * 4)})`
                ctx.lineWidth = 2
                ctx.beginPath()
                ctx.arc(flight.fromX, flight.fromY, 6 + 40 * k, 0, Math.PI * 2)
                ctx.stroke()
            }
            for (let back = 2; back >= 0; back--) {
                const e = Math.max(0, k - back * 0.06) ** 2
                ctx.globalAlpha = back ? 0.25 / back : 1
                drawGem(ctx, flight.fromX + (mouthX - flight.fromX) * e, flight.fromY + (mouthY - flight.fromY) * e, GEMS.RADIUS * (1 - back * 0.15))
            }
            ctx.globalAlpha = 1
            return
        }
        // Across the machine, from the intake to where the exhaust will be pointing when it fires
        const k = (now - flight.arriveAt) / Math.max(1, flight.fireAt - flight.arriveAt)
        const out = exhaustAngle(turbine.intake, turbine.sweepFrom, flight.fireAt)
        const nx = turbine.x + Math.cos(out) * r
        const ny = turbine.y + Math.sin(out) * r
        const a = (1 - k) * (1 - k)
        const b = 2 * (1 - k) * k
        const c = k * k
        ctx.globalAlpha = 0.85
        drawGem(ctx, a * mouthX + b * turbine.x + c * nx, a * mouthY + b * turbine.y + c * ny, GEMS.RADIUS * 0.75)
        ctx.globalAlpha = 1
    })
}
