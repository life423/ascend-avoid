/** Shared seam geometry for the injured shell and finishing shatter. Front/eyes stay clear. */
export const INJURY_CRACKS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [[.98, -.1], [.77, .02], [.61, -.11], [.32, .05]],
    [[.78, .02], [.71, .25], [.43, .34], [.28, .57]],
    [[.61, -.11], [.63, -.37], [.44, -.51], [.51, -.79]],
    [[.43, .34], [.65, .53], [.67, .73]],
    [[.32, .05], [.15, -.1], [-.06, -.05]],
    [[.44, -.51], [.2, -.52], [.07, -.68]],
    [[.71, .25], [.94, .4]],
]

let glow: HTMLCanvasElement | null = null
function shellGlow(): HTMLCanvasElement {
    if (glow) return glow
    glow = document.createElement('canvas'); glow.width = glow.height = 128
    const paint = glow.getContext('2d')!
    const gradient = paint.createRadialGradient(64, 64, 6, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255, 91, 30, .9)')
    gradient.addColorStop(.55, 'rgba(255, 79, 34, .55)')
    gradient.addColorStop(1, 'rgba(255, 79, 34, 0)')
    paint.fillStyle = gradient; paint.fillRect(0, 0, 128, 128)
    return glow
}

/** Cached internal glow with a slow two-second pulse; no invincibility-style flashing. */
export function drawInjury(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, facing: number, age: number, remaining: number, reduced: boolean): void {
    if (remaining <= 0) return
    const r = size / 2, unit = 1 / Math.max(.001, Math.abs(ctx.getTransform().a))
    const heal = Math.min(1, remaining / 850), open = reduced ? 1 : Math.min(1, Math.max(0, age / 160))
    const pulse = reduced ? .7 : .7 + .12 * Math.sin(age * Math.PI / 1000)
    ctx.save(); ctx.translate(x, y); ctx.rotate(facing + Math.PI)
    ctx.globalAlpha = pulse * heal
    ctx.drawImage(shellGlow(), -r * .12, -r * .84, r * 1.1, r * 1.68)
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    for (const seam of INJURY_CRACKS) {
        ctx.beginPath()
        seam.forEach(([sx, sy], i) => { if (i) ctx.lineTo(sx * r, sy * r); else ctx.moveTo(sx * r, sy * r) })
        ctx.globalAlpha = heal * open
        ctx.strokeStyle = '#402536'; ctx.lineWidth = Math.max(4 * unit, size * .045) * heal; ctx.stroke()
        ctx.strokeStyle = '#ff653d'; ctx.lineWidth = Math.max(2.5 * unit, size * .025) * heal; ctx.stroke()
        ctx.strokeStyle = '#ffbd77'; ctx.lineWidth = Math.max(1.25 * unit, size * .011) * heal; ctx.stroke()
    }
    ctx.restore()
}
