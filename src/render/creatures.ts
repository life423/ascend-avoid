import type { Breath } from '../core/OnlineControls'
import { ARENA_RULES } from '../../server/constants/gameConstants'

/** A coordinate moved by `distance` between `low` and `high`, bouncing off the ends (how balls move) */
export function bounce(position: number, distance: number, low: number, high: number): number {
    const span = high - low
    if (span <= 0) return low
    let p = (position - low + distance) % (2 * span)
    if (p < 0) p += 2 * span
    return low + (p > span ? 2 * span - p : p)
}

/** Where the mouth sits: this share of the body's width out from its center, along its facing (the server's own figure: see inhale.ts) */
export const MOUTH_OFFSET = 0.3

/** The mouth's center for a creature drawn at (x, y) with this size, facing this way */
export function mouthOf(x: number, y: number, size: number, facing: number): { x: number; y: number } {
    return { x: x + Math.cos(facing) * size * MOUTH_OFFSET, y: y + Math.sin(facing) * size * MOUTH_OFFSET }
}

/** How wide the open mouth is: 24% of the body's radius for a newborn, growing with size to 36% for giants, so bigger looks hungrier */
export function mouthRadius(size: number): number {
    const relative = Math.max(1, size / ARENA_RULES.PLAYER_SIZE)
    return (size / 2) * Math.min(0.36, 0.24 + 0.035 * Math.log2(relative))
}

/** A round creature with eyes toward where it faces, so everyone can see which side is its back */
export function drawCreature(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, facing: number, timestamp = 0, mouth = '', inhaling = false, cheeks = 0): void {
    const r = size / 2
    const fullness = Math.max(0, Math.min(1, cheeks))
    ctx.fillStyle = color
    ctx.beginPath()
    if (fullness > 0) {
        // One continuous silhouette: two soft cheek bulges, with no seams across the face.
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(facing)
        ctx.scale(r, r)
        ctx.moveTo(-1, 0)
        ctx.bezierCurveTo(-1, -0.552, -0.552, -1, 0, -1)
        ctx.bezierCurveTo(0.22, -1 - 0.22 * fullness, 0.63, -0.91 - 0.28 * fullness, 0.74, -0.67 - 0.06 * fullness)
        ctx.bezierCurveTo(0.91, -0.5, 1, -0.28, 1, 0)
        ctx.bezierCurveTo(1, 0.28, 0.91, 0.5, 0.74, 0.67 + 0.06 * fullness)
        ctx.bezierCurveTo(0.63, 0.91 + 0.28 * fullness, 0.22, 1 + 0.22 * fullness, 0, 1)
        ctx.bezierCurveTo(-0.552, 1, -1, 0.552, -1, 0)
        ctx.closePath()
        ctx.restore()
    } else ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = Math.max(1.5, size * 0.06)
    ctx.stroke()
    const fx = Math.cos(facing)
    const fy = Math.sin(facing)
    if (fullness > 0) {
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(facing)
        for (const side of [-1, 1]) {
            // Blush sits outside the eye circles, even on the smallest creature.
            ctx.fillStyle = `rgba(255, 153, 153, ${0.32 * fullness})`
            ctx.beginPath()
            ctx.ellipse(r * 0.22, side * r * 0.81, r * 0.22, r * 0.105, side * 0.15, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.65 * fullness})`
            ctx.lineWidth = Math.max(1, size * 0.012)
            ctx.lineCap = 'round'
            ctx.beginPath()
            ctx.ellipse(r * 0.24, side * r * 0.82, r * 0.28, r * 0.19, 0, side < 0 ? Math.PI * 1.15 : Math.PI * 0.15, side < 0 ? Math.PI * 1.65 : Math.PI * 0.65)
            ctx.stroke()
        }
        ctx.restore()
    }
    // A small curved mouth reads as a face; the airflow carries the inhale effect.
    const m = mouthOf(x, y, size, facing)
    if (inhaling || fullness > 0) {
        ctx.save()
        ctx.translate(m.x, m.y)
        ctx.rotate(facing)
        ctx.strokeStyle = 'rgba(24, 47, 61, 0.8)'
        ctx.lineWidth = Math.max(1.2, size * 0.012)
        ctx.lineCap = 'round'
        const pulse = fullness > 0 ? 0.7 : 1 + 0.06 * Math.sin(timestamp / 100)
        ctx.beginPath()
        ctx.moveTo(r * 0.04, -r * 0.12 * pulse)
        ctx.quadraticCurveTo(r * 0.17, 0, r * 0.04, r * 0.12 * pulse)
        ctx.stroke()
        ctx.restore()
    } else if (mouth) {
        // A bomb held in the mouth (sparking if its fuse is running)
        const bx = x + fx * r * 0.82
        const by = y + fy * r * 0.82
        ctx.fillStyle = '#23262f'
        ctx.beginPath()
        ctx.arc(bx, by, r * 0.32, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.lineWidth = Math.max(1, size * 0.03)
        ctx.stroke()
        if (mouth === 'lit' && Math.sin(timestamp / 60) > 0) {
            ctx.fillStyle = '#ffb347'
            ctx.beginPath()
            ctx.arc(bx + fx * r * 0.3, by + fy * r * 0.3, Math.max(2.5, r * 0.12), 0, Math.PI * 2)
            ctx.fill()
        }
    }
    for (const side of [-1, 1]) {
        const ex = x + fx * r * 0.42 - fy * r * 0.36 * side
        const ey = y + fy * r * 0.42 + fx * r * 0.36 * side
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(ex, ey, r * 0.26, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(16, 21, 31, 0.55)'
        ctx.lineWidth = Math.max(1, size * 0.025)
        ctx.stroke()
        ctx.fillStyle = '#10151f'
        ctx.beginPath()
        ctx.arc(ex, ey, r * 0.13, 0, Math.PI * 2)
        ctx.fill()
    }

}

/**
 * Your breath around your creature: draining while you inhale (blue, then amber, then flashing red
 * when it's nearly gone), and refilling while you catch it, with little puffs rising
 */
export function drawBreath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, breath: Breath, timestamp: number): void {
    if (breath.phase === 'ready') return
    const r = size / 2 + 8
    const start = -Math.PI / 2
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    if (breath.phase === 'inhaling') {
        const left = breath.left
        ctx.strokeStyle =
            left > 0.5 ? 'rgba(160, 230, 255, 0.95)' : left > 0.25 ? 'rgba(255, 209, 102, 0.95)' : `rgba(255, 107, 107, ${0.7 + 0.3 * Math.sin(timestamp / 60)})`
        ctx.beginPath()
        ctx.arc(x, y, r, start, start + Math.PI * 2 * Math.max(0.01, left))
        ctx.stroke()
    } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, r, start, start + Math.PI * 2 * Math.max(0.01, breath.back))
        ctx.stroke()
        // Catching your breath: little puffs rising
        for (let i = 0; i < 3; i++) {
            const t = (timestamp / 700 + i / 3) % 1
            ctx.fillStyle = `rgba(220, 235, 255, ${0.5 * (1 - t)})`
            ctx.beginPath()
            ctx.arc(x + (i - 1) * size * 0.18, y - size / 2 - 10 - t * 16, 2.5 + t * 2.5, 0, Math.PI * 2)
            ctx.fill()
        }
    }
    ctx.restore()
}

/**
 * A creature fired as a living cannonball: the same creature, shaped for it. The round body bristles with
 * spikes all the way round and spins as it flies, a buzzsaw streaking across the arena (the streaks behind
 * it show the way it's going); the outline runs hot, and its eyes are screwed shut, braced for the hit.
 * Still its own colour, so everyone can see who's been fired.
 */
export function drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, heading: number, timestamp: number): void {
    const r = size / 2
    const spin = heading + (timestamp / 1000) * Math.PI * 2 * 2.5
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(spin)
    // The body
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.92, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
    // The outline runs hot: a soft glow under a crisp line
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.4)'
    ctx.lineWidth = Math.max(4, size * 0.18)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 236, 205, 0.95)'
    ctx.lineWidth = Math.max(1.5, size * 0.06)
    ctx.stroke()
    // Spikes all the way round
    ctx.fillStyle = '#ffffff'
    const spikes = 10
    for (let i = 0; i < spikes; i++) {
        const a = (i / spikes) * Math.PI * 2
        const bx = Math.cos(a) * r * 0.9
        const by = Math.sin(a) * r * 0.9
        const length = r * 0.55
        const half = r * 0.17
        ctx.beginPath()
        ctx.moveTo(bx + Math.cos(a) * length, by + Math.sin(a) * length)
        ctx.lineTo(bx - Math.sin(a) * half, by + Math.cos(a) * half)
        ctx.lineTo(bx + Math.sin(a) * half, by - Math.cos(a) * half)
        ctx.closePath()
        ctx.fill()
    }
    // Eyes screwed shut, spinning with it: two short lines, angled like a wince
    ctx.strokeStyle = '#10151f'
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1.5, size * 0.07)
    for (const side of [-1, 1]) {
        const cx = r * 0.3
        const cy = side * r * 0.36
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.16, cy - side * r * 0.07)
        ctx.lineTo(cx + r * 0.16, cy + side * r * 0.07)
        ctx.stroke()
    }
    ctx.restore()
}
