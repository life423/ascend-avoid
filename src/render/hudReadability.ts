export interface HudRect { x: number; y: number; width: number; height: number }
export interface HudFocus { x: number; y: number; radius: number }

/** Screen-space face and the first stretch of active airflow, never the whole giant body. */
export function hudFocus(x: number, y: number, width: number, facing: number, scale: number, inhaling: boolean, pixel: number): HudFocus[] {
    const dx = Math.cos(facing), dy = Math.sin(facing), size = width * scale
    const points = [{ x: x + dx * size * .21, y: y + dy * size * .21, radius: size * .28 + 6 * pixel }]
    if (inhaling) {
        const reach = Math.min(width * .35, 160) * scale
        for (const t of [.5, 1]) points.push({ x: x + dx * (size * .3 + reach * t), y: y + dy * (size * .3 + reach * t), radius: Math.min(size * .1, 32 * scale) + 6 * pixel })
    }
    return points
}

/** Continuous coverage avoids a binary on/off edge when the camera or face turns slightly. */
export function hudObstruction(rect: HudRect, focus: HudFocus[], pixel: number): number {
    return focus.reduce((coverage, point) => {
        const dx = Math.max(rect.x - point.x, 0, point.x - rect.x - rect.width)
        const dy = Math.max(rect.y - point.y, 0, point.y - rect.y - rect.height)
        const edge = 12 * pixel
        return Math.max(coverage, Math.max(0, Math.min(1, (point.radius + edge - Math.hypot(dx, dy)) / (Math.min(point.radius, 28 * pixel) + edge))))
    }, 0)
}

/** Fade only glass and rim; score/name glyphs remain opaque. No HUD moves, including reduced motion. */
export class HudBackingFade {
    alpha = 1
    private target = 1
    private clearAfter = 0
    private at: number | null = null
    update(coverage: number, now: number): number {
        const elapsed = this.at === null ? 16 : Math.max(0, Math.min(100, now - this.at))
        this.at = now
        if (coverage > .01) {
            this.target = 1 - .78 * Math.min(1, coverage)
            this.clearAfter = now + 180
        } else if (now >= this.clearAfter) this.target = 1
        const duration = this.target < this.alpha ? 140 : 300
        this.alpha += (this.target - this.alpha) * (1 - Math.exp(-elapsed / duration))
        return this.alpha
    }
}
