/** Damage is readable on the rear shell, away from eyes, without an overlay or countdown. */
export function drawInjury(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, facing: number, age: number, remaining: number, reduced: boolean): void {
    if (remaining < -220) return
    const r = size / 2, u = 1 / Math.max(.001, Math.abs(ctx.getTransform().a))
    const opening = Math.max(0, Math.min(1, age / 160))
    const healing = Math.max(0, Math.min(1, remaining / 850))
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(facing + Math.PI)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    if (remaining > 0) {
        const depth = (reduced ? 1 : opening) * healing
        // Broken seams are a shape cue as well as a color cue. The face stays untouched.
        for (const offset of [-.95, 0, .95]) {
            ctx.save(); ctx.rotate(offset)
            ctx.beginPath()
            ctx.moveTo(r * 1.025, -r * .08 * depth)
            ctx.lineTo(r * .94, r * .025 * depth)
            ctx.lineTo(r * .88, -r * .025 * depth)
            ctx.lineTo(r * (1 - .28 * depth), r * .055 * depth)
            ctx.moveTo(r * .88, -r * .025 * depth)
            ctx.lineTo(r * .85, -r * .11 * depth)
            ctx.lineTo(r * (1 - .21 * depth), -r * .14 * depth)
            ctx.strokeStyle = '#402536'; ctx.lineWidth = Math.max(3.5 * u, size * .035); ctx.stroke()
            ctx.strokeStyle = '#ffbd77'; ctx.lineWidth = Math.max(1.5 * u, size * .014); ctx.stroke()
            ctx.restore()
        }
        if (!reduced && age < 300) {
            const hit = age / 300
            ctx.strokeStyle = `rgba(255, 189, 119, ${.65 * (1 - hit)})`
            ctx.lineWidth = 2 * u
            ctx.beginPath(); ctx.arc(0, 0, r * (1.05 + .45 * hit), -.95, .95); ctx.stroke()
        }
    } else if (!reduced) {
        const seal = -remaining / 220
        ctx.strokeStyle = `rgba(255, 241, 206, ${.55 * Math.sin(Math.PI * seal)})`
        ctx.lineWidth = Math.max(2 * u, size * .025)
        ctx.beginPath(); ctx.arc(0, 0, r * 1.025, -1.2, 1.2); ctx.stroke()
    }
    ctx.restore()
}
