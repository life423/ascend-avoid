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

/** Two people: the players icon */
export function drawPeople(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(1, size * 0.11)
    ctx.beginPath()
    ctx.arc(x - size * 0.16, y - size * 0.16, size * 0.19, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x - size * 0.16, y + size * 0.44, size * 0.36, Math.PI * 1.12, Math.PI * 1.88)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + size * 0.22, y - size * 0.1, size * 0.15, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x + size * 0.26, y + size * 0.44, size * 0.28, Math.PI * 1.2, Math.PI * 1.85)
    ctx.stroke()
}

/** A little robot head, marking bots, centered on (centerX, centerY) */
export function drawRobot(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
    const width = size
    const height = size * 0.8
    ctx.fillStyle = '#9fb3c8'
    roundedRect(ctx, centerX - width / 2, centerY - height / 2, width, height, size * 0.2)
    ctx.fill()
    ctx.fillRect(centerX - size * 0.06, centerY - height / 2 - size * 0.28, size * 0.12, size * 0.28)
    ctx.beginPath()
    ctx.arc(centerX, centerY - height / 2 - size * 0.32, size * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(5, 12, 24, 0.9)'
    ctx.fillRect(centerX - width * 0.3, centerY - height * 0.15, width * 0.2, height * 0.25)
    ctx.fillRect(centerX + width * 0.1, centerY - height * 0.15, width * 0.2, height * 0.25)
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
