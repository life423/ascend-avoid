export const FONT = 'Montserrat, system-ui, sans-serif'

export const GOLD = '#ffd166'

/** A rounded rectangle path, or a plain one where roundRect isn't supported */
export function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius)
    else ctx.rect(x, y, width, height)
}

/** A gold gem: a faceted diamond with a soft glow */
/** A wedge from (x, y): `reach` long, `arc` radians either side of `angle` */
export function wedge(ctx: CanvasRenderingContext2D, x: number, y: number, reach: number, angle: number, arc: number): void {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, reach, angle - arc, angle + arc)
    ctx.closePath()
}

/** Phones and tablets (the header is hidden there online, and the HUD takes its place) */
export const COMPACT = window.matchMedia('(max-width: 1199px)')

/** A HUD pill or card: dark glass with a teal rim */
export function hudPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
    ctx.fillStyle = 'rgba(6, 16, 30, 0.8)'
    roundedRect(ctx, x, y, w, h, r)
    ctx.fill()
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.55)'
    ctx.lineWidth = 1.5
    ctx.stroke()
}

/** The leader's crown, standing on (centerX, bottom) */
export function drawCrown(ctx: CanvasRenderingContext2D, centerX: number, bottom: number, width: number): void {
    const height = width * 0.7
    ctx.beginPath()
    ctx.moveTo(centerX - width / 2, bottom)
    ctx.lineTo(centerX - width / 2, bottom - height * 0.55)
    ctx.lineTo(centerX - width / 4, bottom - height * 0.25)
    ctx.lineTo(centerX, bottom - height)
    ctx.lineTo(centerX + width / 4, bottom - height * 0.25)
    ctx.lineTo(centerX + width / 2, bottom - height * 0.55)
    ctx.lineTo(centerX + width / 2, bottom)
    ctx.closePath()
    ctx.fillStyle = GOLD
    ctx.fill()
    ctx.strokeStyle = 'rgba(120, 80, 0, 0.8)'
    ctx.lineWidth = Math.max(1, width * 0.06)
    ctx.stroke()
}
