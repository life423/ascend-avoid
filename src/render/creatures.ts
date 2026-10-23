import type { Breath } from '../core/OnlineControls'

/** A coordinate moved by `distance` between `low` and `high`, bouncing off the ends (how balls move) */
export function bounce(position: number, distance: number, low: number, high: number): number {
    const span = high - low
    if (span <= 0) return low
    let p = (position - low + distance) % (2 * span)
    if (p < 0) p += 2 * span
    return low + (p > span ? 2 * span - p : p)
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
        ctx.arc(ex + fx * r * 0.1, ey + fy * r * 0.1, r * 0.13, 0, Math.PI * 2)
        ctx.fill()
    }
    // The mouth: wide open while inhaling, bulging with a rock when full
    const mx = x + fx * r * 0.74
    const my = y + fy * r * 0.74
    if (inhaling) {
        ctx.fillStyle = '#10151f'
        ctx.beginPath()
        ctx.arc(mx, my, r * (0.24 + 0.03 * Math.sin(timestamp / 60)), 0, Math.PI * 2)
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
