import { ARENA_RULES } from '../../server/constants/gameConstants'

/**
 * How suction looks (browsers only). A creature's suction power grows with its size,
 * (width / newborn width) ^ POWER_GROWTH up to POWER_MAX, and everything about its inhale scales
 * with it: more, longer, thicker, faster streaks and a brighter cone; gems it steals fly faster
 * and glow more. Mouth and cone size already grow with the creature itself.
 */
export const INHALE_LOOK = {
    POWER_GROWTH: 0.5,
    POWER_MAX: 4,
    STREAKS: 6, // streaks in a newborn's cone...
    STREAKS_PER_POWER: 4, // ...plus this many per point of power (about 20 for a 12x giant)
    STREAK_SPEED: 260, // units a second a newborn's streaks rush in, times power
    STREAK_LENGTH: 14, // plus 10 per point of power
    GLOW: 0.22, // cone brightness, plus 0.06 per point of power
    THEFT_FLIGHT_MS: 450, // how long a stolen gem takes to fly over, divided by the square root of the thief's power
} as const

/** How strong a creature's suction looks: 1 for a newborn, growing with size (see INHALE_LOOK) */
export function suctionPower(width: number): number {
    return Math.min(INHALE_LOOK.POWER_MAX, Math.pow(Math.max(1, width / ARENA_RULES.PLAYER_SIZE), INHALE_LOOK.POWER_GROWTH))
}

/** How a creature's airflow is moving (see drawAirflow) */
export type Airflow = { heading: number; along: number; x: number; y: number; at: number; inhaling: boolean; since: number; hookId: string; hookedAt: number; coherence: number; rope?: { x: number; y: number }[] }

/** A point on a quadratic curve from (ax, ay) through control (bx, by) to (cx, cy) */
export function onCurve(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, t: number): { x: number; y: number } {
    const k = 1 - t
    return { x: k * k * ax + 2 * k * t * bx + t * t * cx, y: k * k * ay + 2 * k * t * by + t * t * cy }
}
