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
export function drawCreature(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, facing: number, timestamp = 0, mouth = '', inhaling = false): void {
    const r = size / 2
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = Math.max(1.5, size * 0.06)
    ctx.stroke()
    const fx = Math.cos(facing)
    const fy = Math.sin(facing)
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
    // The mouth: wide open while inhaling (drawn where the server has it, so a captive held there is really in it), bulging with a rock when full
    const m = mouthOf(x, y, size, facing)
    if (inhaling) {
        ctx.fillStyle = '#10151f'
        ctx.beginPath()
        ctx.arc(m.x, m.y, mouthRadius(size) * (1 + 0.12 * Math.sin(timestamp / 60)), 0, Math.PI * 2)
        ctx.fill()
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
 * A creature fired as a living cannonball: the same creature, shaped for it. The round body becomes a spiked
 * arrowhead along its flight: a sharp nose ahead, a rounded base behind, spikes bristling down both edges and
 * across the back, the outline running hot, and its eyes screwed shut, braced for the hit. Still its own
 * colour, so everyone can see who's been fired.
 */
export function drawProjectile(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, heading: number, timestamp: number): void {
    const r = size / 2
    const nose = r * 1.7
    const base = -r * 0.7
    const half = r * 0.95
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(heading)
    // The body: an arrowhead, nose first, with a rounded base
    ctx.beginPath()
    ctx.moveTo(nose, 0)
    ctx.lineTo(base, -half)
    ctx.arc(base, 0, half, -Math.PI / 2, Math.PI / 2, true)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    // The outline runs hot: a soft glow under a crisp line
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(255, 190, 110, 0.4)'
    ctx.lineWidth = Math.max(4, size * 0.18)
    ctx.stroke()
    ctx.strokeStyle = 'rgba(255, 236, 205, 0.95)'
    ctx.lineWidth = Math.max(1.5, size * 0.06)
    ctx.stroke()
    // Spikes: down both edges, and across the back, bristling
    ctx.fillStyle = '#ffffff'
    const spike = (px: number, py: number, nx: number, ny: number, length: number) => {
        const w = r * 0.14
        ctx.beginPath()
        ctx.moveTo(px + nx * length, py + ny * length)
        ctx.lineTo(px - ny * w, py + nx * w)
        ctx.lineTo(px + ny * w, py - nx * w)
        ctx.closePath()
        ctx.fill()
    }
    const edgeLength = Math.hypot(nose - base, half)
    const ex = (nose - base) / edgeLength
    const ey = half / edgeLength
    let i = 0
    for (const side of [-1, 1]) {
        // Along this edge from the base corner toward the nose; the spike points away from the body
        const nx = ey
        const ny = -ex * side
        for (const t of [0.22, 0.5, 0.78]) {
            const px = base + (nose - base) * t
            const py = side * (-half + half * t)
            spike(px, py, nx, ny, r * (0.5 + 0.08 * Math.sin(timestamp / 45 + i * 1.9)))
            i++
        }
    }
    for (const a of [Math.PI - 0.75, Math.PI, Math.PI + 0.75]) {
        spike(base + Math.cos(a) * half, Math.sin(a) * half, Math.cos(a), Math.sin(a), r * (0.45 + 0.08 * Math.sin(timestamp / 45 + i * 1.9)))
        i++
    }
    // Eyes screwed shut: two short lines, angled like a wince
    ctx.strokeStyle = '#10151f'
    ctx.lineCap = 'round'
    ctx.lineWidth = Math.max(1.5, size * 0.07)
    for (const side of [-1, 1]) {
        const cx = r * 0.15
        const cy = side * r * 0.4
        ctx.beginPath()
        ctx.moveTo(cx - r * 0.16, cy - side * r * 0.07)
        ctx.lineTo(cx + r * 0.16, cy + side * r * 0.07)
        ctx.stroke()
    }
    ctx.restore()
}
