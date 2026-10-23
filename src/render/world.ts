import { BOMBS, TURBINE } from '../../server/constants/gameConstants'
import { GOLD, wedge } from './style'

/** A turbine about to switch on: a pulsing ring filling up, a warning sign, and a hint of where the intake will pull */
export function drawTurbineWarning(ctx: CanvasRenderingContext2D, x: number, y: number, intake: number, progress: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    const pulse = 0.5 + 0.5 * Math.sin(timestamp / 120)
    ctx.save()
    ctx.fillStyle = `rgba(255, 209, 102, ${0.06 + 0.1 * progress})`
    wedge(ctx, x + Math.cos(intake) * r, y + Math.sin(intake) * r, TURBINE.INTAKE_REACH * progress, intake, TURBINE.INTAKE_ARC)
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.35 + 0.45 * pulse})`
    ctx.lineWidth = 3
    ctx.setLineDash([10, 8])
    ctx.lineDashOffset = -timestamp / 30
    ctx.beginPath()
    ctx.arc(x, y, r + 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(x, y, r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 209, 102, 0.95)'
    ctx.font = `800 ${Math.round(r * 0.9)}px Montserrat, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', x, y + 2)
    ctx.restore()
}

/** The intake's suction: a cone strongest near the mouth, its inner zone tinted red, and streaks rushing in */
export function drawIntakeWind(ctx: CanvasRenderingContext2D, x: number, y: number, intake: number, power: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    const mx = x + Math.cos(intake) * r
    const my = y + Math.sin(intake) * r
    ctx.save()
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, TURBINE.INTAKE_REACH)
    glow.addColorStop(0, `rgba(120, 200, 255, ${0.32 * power})`)
    glow.addColorStop(1, 'rgba(120, 200, 255, 0)')
    ctx.fillStyle = glow
    wedge(ctx, mx, my, TURBINE.INTAKE_REACH, intake, TURBINE.INTAKE_ARC)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 107, 107, ${0.14 * power})`
    wedge(ctx, mx, my, TURBINE.DANGER_REACH, intake, TURBINE.INTAKE_ARC)
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 107, 107, ${0.55 * power})`
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.arc(mx, my, TURBINE.DANGER_REACH, intake - TURBINE.INTAKE_ARC, intake + TURBINE.INTAKE_ARC)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(210, 238, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 22; i++) {
        const lane = ((i * 0.618) % 1) * 2 - 1
        const phase = (timestamp / 900 + i * 0.37) % 1
        const distance = TURBINE.INTAKE_REACH * Math.pow(1 - phase, 1.6)
        const angle = intake + lane * TURBINE.INTAKE_ARC * 0.9 * (0.3 + 0.7 * (distance / TURBINE.INTAKE_REACH))
        const length = 10 + 34 * phase
        ctx.globalAlpha = Math.min(1, phase * 3) * 0.6 * power
        ctx.beginPath()
        ctx.moveTo(mx + Math.cos(angle) * distance, my + Math.sin(angle) * distance)
        ctx.lineTo(mx + Math.cos(angle) * Math.max(0, distance - length), my + Math.sin(angle) * Math.max(0, distance - length))
        ctx.stroke()
    }
    ctx.restore()
}

/** The exhaust's wind: a cone where it points right now, with streamlines blowing out */
export function drawExhaustWind(ctx: CanvasRenderingContext2D, x: number, y: number, exhaust: number, power: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    const nx = x + Math.cos(exhaust) * r
    const ny = y + Math.sin(exhaust) * r
    ctx.save()
    const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, TURBINE.EXHAUST_REACH)
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.2 * power})`)
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = glow
    wedge(ctx, nx, ny, TURBINE.EXHAUST_REACH, exhaust, TURBINE.EXHAUST_ARC)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 16; i++) {
        const lane = ((i * 0.618) % 1) * 2 - 1
        const phase = (timestamp / 600 + i * 0.29) % 1
        const distance = 10 + TURBINE.EXHAUST_REACH * phase
        const angle = exhaust + lane * TURBINE.EXHAUST_ARC * 0.85 * Math.min(1, 0.4 + phase)
        const length = 16 + 30 * (1 - phase)
        ctx.globalAlpha = (1 - phase) * 0.7 * power
        ctx.beginPath()
        ctx.moveTo(nx + Math.cos(angle) * distance, ny + Math.sin(angle) * distance)
        ctx.lineTo(nx + Math.cos(angle) * (distance + length), ny + Math.sin(angle) * (distance + length))
        ctx.stroke()
    }
    ctx.restore()
}

/** The machine: a fixed intake funnel, a nozzle that turns with the exhaust, and a fan that spins (slowing as it powers down) */
export function drawTurbineBody(ctx: CanvasRenderingContext2D, x: number, y: number, intake: number, exhaust: number, power: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    ctx.save()
    ctx.translate(x, y)
    ctx.save()
    ctx.rotate(exhaust)
    ctx.fillStyle = '#3a4a5c'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.fillRect(r * 0.55, -r * 0.32, r * 0.72, r * 0.64)
    ctx.strokeRect(r * 0.55, -r * 0.32, r * 0.72, r * 0.64)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.45 * power})`
    ctx.fillRect(r * 1.22, -r * 0.27, 5, r * 0.54)
    ctx.restore()
    ctx.save()
    ctx.rotate(intake)
    ctx.fillStyle = '#2b3846'
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(r * 0.6, -r * 0.45)
    ctx.lineTo(r * 1.15, -r * 0.8)
    ctx.lineTo(r * 1.15, r * 0.8)
    ctx.lineTo(r * 0.6, r * 0.45)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
    body.addColorStop(0, '#5a6f84')
    body.addColorStop(1, '#1e2833')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.85)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.rotate((timestamp / 90) * power)
    ctx.fillStyle = 'rgba(200, 225, 240, 0.85)'
    for (let i = 0; i < 5; i++) {
        ctx.rotate((Math.PI * 2) / 5)
        ctx.beginPath()
        ctx.ellipse(r * 0.38, 0, r * 0.36, r * 0.12, 0.5, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = '#1e2833'
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
}

/** A puff of air where a turbine just fired a gem (k: 0 to 1 over the puff) */
export function drawLaunchPuff(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, k: number): void {
    ctx.save()
    ctx.globalAlpha = 1 - k
    ctx.fillStyle = 'rgba(235, 245, 255, 0.6)'
    for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.45
        const distance = 8 + 26 * k
        ctx.beginPath()
        ctx.arc(x + Math.cos(angle + spread) * distance, y + Math.sin(angle + spread) * distance, 5 + 9 * k, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.restore()
}

/** Gem colors: most are gold, some cyan, blue or pink (all worth the same), for a livelier field */
export const GEM_COLORS = [GOLD, GOLD, GOLD, '#4fe3d9', '#5aa8ff', '#ff7ad9']

/** A gem's color, fixed by its id so it never changes */
export function gemColor(id: string): string {
    let hash = 0
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0
    return GEM_COLORS[Math.abs(hash) % GEM_COLORS.length] ?? GOLD
}

export function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, color: string = GOLD): void {
    const alpha = ctx.globalAlpha
    ctx.globalAlpha = alpha * 0.2
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = alpha
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.78, y)
    ctx.lineTo(x, y + radius)
    ctx.lineTo(x - radius * 0.78, y)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.78, y)
    ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.fill()
}

/** The jackpot crystal: a big violet gem with a glow */
export function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.fillStyle = 'rgba(179, 136, 255, 0.25)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.7, y - radius * 0.2)
    ctx.lineTo(x + radius * 0.45, y + radius)
    ctx.lineTo(x - radius * 0.45, y + radius)
    ctx.lineTo(x - radius * 0.7, y - radius * 0.2)
    ctx.closePath()
    ctx.fillStyle = '#b388ff'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.7, y - radius * 0.2)
    ctx.lineTo(x, y + radius * 0.1)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fill()
}

/**
 * A bomb: round, black, with a fuse. Lit, its spark and a red glow blink faster as the fuse runs
 * down, and its blast circle shows on the ground so everyone can see where not to be.
 */
export function drawBomb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fuseLeft: number | null, timestamp: number): void {
    const lit = fuseLeft !== null
    const urgency = lit ? 1 - Math.max(0, Math.min(1, fuseLeft / BOMBS.FUSE_MS)) : 0
    const blink = lit && Math.sin(timestamp / Math.max(35, (fuseLeft ?? 0) / 10)) > 0
    if (lit) {
        ctx.save()
        ctx.fillStyle = `rgba(255, 80, 60, ${0.05 + 0.12 * urgency})`
        ctx.strokeStyle = `rgba(255, 110, 90, ${0.35 + 0.45 * urgency})`
        ctx.lineWidth = 2
        ctx.setLineDash([10, 8])
        ctx.beginPath()
        ctx.arc(x, y, BOMBS.BLAST_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
    }
    if (blink) {
        ctx.fillStyle = 'rgba(255, 70, 50, 0.45)'
        ctx.beginPath()
        ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = '#23262f'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.beginPath()
    ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()
    // The fuse
    const tipX = x + radius * 0.95
    const tipY = y - radius * 1.2
    ctx.strokeStyle = '#c9a36b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x + radius * 0.5, y - radius * 0.75)
    ctx.quadraticCurveTo(x + radius * 1.1, y - radius * 0.9, tipX, tipY)
    ctx.stroke()
    if (lit) {
        ctx.fillStyle = blink ? '#fff2b0' : '#ff8c3a'
        ctx.beginPath()
        ctx.arc(tipX, tipY, blink ? 5 : 3.5, 0, Math.PI * 2)
        ctx.fill()
    }
}

/** A comet: a glowing violet head with a tail trailing back along its path */
export function drawComet(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy) || 1
    const ux = vx / speed
    const uy = vy / speed
    for (let i = 5; i >= 1; i--) {
        ctx.fillStyle = `rgba(167, 139, 250, ${0.34 - i * 0.055})`
        ctx.beginPath()
        ctx.arc(x - ux * radius * 0.85 * i, y - uy * radius * 0.85 * i, radius * (1 - i * 0.15), 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = 'rgba(167, 139, 250, 0.25)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c4b5fd'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.beginPath()
    ctx.arc(x + ux * radius * 0.25, y + uy * radius * 0.25, radius * 0.42, 0, Math.PI * 2)
    ctx.fill()
}

/** A ball: a glowing orb with a highlight */
export function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.fillStyle = 'rgba(255, 92, 138, 0.22)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff5c8a'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 210, 225, 0.8)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.beginPath()
    ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.3, 0, Math.PI * 2)
    ctx.fill()
}
