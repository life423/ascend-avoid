/** Shared seam geometry for the injured shell and finishing shatter. Front/eyes stay clear. */
export const INJURY_CRACKS: ReadonlyArray<ReadonlyArray<readonly [number, number]>> = [
    [[.96, -.18], [.78, -.24], [.72, -.43], [.52, -.49], [.48, -.76]],
    [[.78, -.24], [.61, -.10], [.55, .08], [.33, .17]],
    [[.72, -.43], [.81, -.58]],
    [[.94, .27], [.74, .33], [.67, .55], [.46, .63], [.40, .83]],
    [[.74, .33], [.60, .21], [.44, .28]],
    [[.67, .55], [.77, .63]],
]

let glow: HTMLCanvasElement | null = null
function shellGlow(): HTMLCanvasElement {
    if (glow) return glow
    glow = document.createElement('canvas'); glow.width = glow.height = 128
    const paint = glow.getContext('2d')!
    const gradient = paint.createRadialGradient(64, 64, 6, 64, 64, 64)
    gradient.addColorStop(0, 'rgba(255, 102, 57, .65)')
    gradient.addColorStop(.55, 'rgba(244, 107, 60, .3)')
    gradient.addColorStop(1, 'rgba(255, 79, 34, 0)')
    paint.fillStyle = gradient; paint.fillRect(0, 0, 128, 128)
    return glow
}

/** Cached internal glow with a slow two-second pulse; no invincibility-style flashing. */
export function drawInjury(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, facing: number, age: number, remaining: number, reduced: boolean, pixelRatio = 1): void {
    if (remaining <= 0) return
    const r = size / 2, unit = pixelRatio / Math.max(.001, Math.abs(ctx.getTransform().a))
    const heal = Math.min(1, remaining / 850), open = reduced ? 1 : Math.min(1, Math.max(0, age / 160))
    const pulse = reduced ? .7 : .7 + .12 * Math.sin(age * Math.PI / 1000)
    ctx.save(); ctx.translate(x, y); ctx.rotate(facing + Math.PI)
    ctx.beginPath(); ctx.arc(0, 0, r * .96, 0, Math.PI * 2); ctx.clip()
    ctx.globalAlpha = pulse * heal * .6
    ctx.drawImage(shellGlow(), r * .04, -r * .86, r * 1.2, r * 1.72)
    ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.miterLimit = 2
    for (const seam of INJURY_CRACKS) {
        ctx.beginPath()
        seam.forEach(([sx, sy], i) => { if (i) ctx.lineTo(sx * r, sy * r); else ctx.moveTo(sx * r, sy * r) })
        ctx.globalAlpha = heal * open
        ctx.strokeStyle = 'rgba(75, 37, 36, .8)'; ctx.lineWidth = Math.max(1.65 * unit, size * .016) * heal; ctx.stroke()
        ctx.strokeStyle = '#f28a60'; ctx.lineWidth = Math.max(.85 * unit, size * .008) * heal; ctx.stroke()
        ctx.globalAlpha = heal * open * .75
        ctx.strokeStyle = '#ffe0b7'; ctx.lineWidth = Math.max(.35 * unit, size * .003) * heal; ctx.stroke()
    }
    ctx.restore()
}
