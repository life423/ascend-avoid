/**
 * Implementation of multiplayer game mode.
 */
/** How much of the gap to the server position another player's drawing closes each frame */
export const SMOOTHING = 0.35

/** Jump straight to the server position when it's this far off (world units), e.g. a respawn */
export const SNAP_DISTANCE = 150

/** How long a notice (someone joined, a shove, the jackpot) stays up */
export const JOIN_NOTICE_MS = 3500

/** Grid spacing on the arena floor (world units) */
export const GRID = 100

/** How long a hit's burst ring lasts */
export const BURST_MS = 500

/** How long "+1" floats above you after grabbing gems */
export const PICKUP_TEXT_MS = 800

/** The part of the world on screen: its center, size (world units) and scale (pixels per unit) */
export interface View {
    x: number
    y: number
    width: number
    height: number
    scale: number
}
