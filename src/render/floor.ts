import type { MultiplayerMode } from '../core/GameModes'
import { SHIFT } from '../../server/constants/gameConstants'
import { FONT, GOLD } from './style'
import { drawCrystal } from './world'
import { GRID, View } from './shared'

/** The arena floor: a faint grid, and the wall around the world */
export function drawFloor(_mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: any, view: View) : void {
    const left = Math.max(0, view.x - view.width / 2)
    const right = Math.min(state.worldWidth, view.x + view.width / 2)
    const top = Math.max(0, view.y - view.height / 2)
    const bottom = Math.min(state.worldHeight, view.y + view.height / 2)
    ctx.save()
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.09)'
    ctx.lineWidth = 1 / view.scale
    ctx.beginPath()
    for (let x = Math.ceil(left / GRID) * GRID; x <= right; x += GRID) {
        ctx.moveTo(x, top)
        ctx.lineTo(x, bottom)
    }
    for (let y = Math.ceil(top / GRID) * GRID; y <= bottom; y += GRID) {
        ctx.moveTo(left, y)
        ctx.lineTo(right, y)
    }
    ctx.stroke()
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.75)'
    ctx.lineWidth = 6
    ctx.strokeRect(0, 0, state.worldWidth, state.worldHeight)
    ctx.restore()
}

/**
 * The shift on the floor: during the grace period the tiles about to drop away pulse red,
 * faster as time runs out; during the shift they're a dark void. The floor's edge is outlined.
 */
export function drawShiftFloor(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: any, view: View, timestamp: number) : void {
    const floor: string = state.floor
    if (!floor) return
    const grid = SHIFT.GRID
    const tile = state.worldWidth / grid
    const grace = state.shiftPhase === 'grace'
    let fill = 'rgba(1, 3, 8, 0.93)'
    if (grace) {
        const left = Math.max(0, Math.min(1, (state.phaseEndsAt - mode.worldNow(state, timestamp)) / SHIFT.GRACE_MS))
        const speed = 4 + (1 - left) * 14
        fill = `rgba(255, 80, 80, ${0.16 + 0.16 * (0.5 + 0.5 * Math.sin((timestamp / 1000) * speed))})`
    }
    const firstCol = Math.max(0, Math.floor((view.x - view.width / 2) / tile))
    const lastCol = Math.min(grid - 1, Math.floor((view.x + view.width / 2) / tile))
    const firstRow = Math.max(0, Math.floor((view.y - view.height / 2) / tile))
    const lastRow = Math.min(grid - 1, Math.floor((view.y + view.height / 2) / tile))
    const isVoid = (row: number, col: number) => row >= 0 && row < grid && col >= 0 && col < grid && floor[row * grid + col] === '0'
    ctx.save()
    ctx.fillStyle = fill
    for (let row = firstRow; row <= lastRow; row++) {
        for (let col = firstCol; col <= lastCol; col++) {
            if (isVoid(row, col)) ctx.fillRect(col * tile, row * tile, tile, tile)
        }
    }
    ctx.strokeStyle = grace ? 'rgba(255, 130, 130, 0.9)' : 'rgba(79, 209, 197, 0.7)'
    ctx.lineWidth = 4
    ctx.setLineDash(grace ? [16, 10] : [])
    ctx.beginPath()
    for (let row = firstRow; row <= lastRow; row++) {
        for (let col = firstCol; col <= lastCol; col++) {
            if (isVoid(row, col)) continue
            const x = col * tile
            const y = row * tile
            if (isVoid(row - 1, col)) { ctx.moveTo(x, y); ctx.lineTo(x + tile, y) }
            if (isVoid(row + 1, col)) { ctx.moveTo(x, y + tile); ctx.lineTo(x + tile, y + tile) }
            if (isVoid(row, col - 1)) { ctx.moveTo(x, y); ctx.lineTo(x, y + tile) }
            if (isVoid(row, col + 1)) { ctx.moveTo(x + tile, y); ctx.lineTo(x + tile, y + tile) }
        }
    }
    ctx.stroke()
    ctx.restore()
}

/** The jackpot crystal: a shadow while it drops, then a big crystal with a ring showing the claim */
export function drawJackpot(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: any, localId: string | null, timestamp: number) : void {
    if (!state.jackpotOn) return
    const x = state.jackpotX
    const y = state.jackpotY
    const untilLanding = state.jackpotLandsAt - mode.worldNow(state, timestamp)
    ctx.save()
    if (untilLanding > 0) {
        const fall = 1 - Math.min(1, untilLanding / (SHIFT.DROP_MS * 1.5))
        ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + 0.35 * fall})`
        ctx.beginPath()
        ctx.ellipse(x, y + 16, 20 + 30 * fall, 8 + 12 * fall, 0, 0, Math.PI * 2)
        ctx.fill()
        drawCrystal(ctx, x, y - (1 - fall) * 160, 30)
        ctx.restore()
        return
    }
    drawCrystal(ctx, x, y, 30 * (1 + 0.06 * Math.sin(timestamp / 150)))
    if (state.jackpotProgress > 0) {
        ctx.strokeStyle = state.jackpotHolder === localId ? GOLD : '#ffffff'
        ctx.lineWidth = 5
        ctx.beginPath()
        ctx.arc(x, y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.jackpotProgress)
        ctx.stroke()
    }
    ctx.font = `700 16px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = GOLD
    ctx.fillText(`+${SHIFT.JACKPOT_VALUE}`, x, y - 40)
    ctx.restore()
}
