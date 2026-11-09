import type { MultiplayerMode } from '../core/GameModes'
import type { SyncedPlayer } from '../types/synced'
import { RELIC } from '../../server/constants/gameConstants'
import { RELIC_STYLE } from './relicComet'
import { COMPACT, FONT, roundedRect } from './style'

const CUE_MS = 2600
const CUE_TEXT = 'Relic unlocked'
const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null

/** Track physical qualification independently of the relic's spawn and claim state. */
export class RelicUnlockCue {
    private sessionId = ''
    private unlocked = false
    private shownAt: number | null = null

    reset(): void {
        this.sessionId = ''
        this.unlocked = false
        this.shownAt = null
    }

    update(player: SyncedPlayer | undefined, now: number): void {
        if (!player) return
        if (player.sessionId !== this.sessionId) {
            this.reset()
            this.sessionId = player.sessionId
        }
        if (player.state === 'dead') {
            this.unlocked = false
            this.shownAt = null
            return
        }
        if (player.state !== 'alive' || this.unlocked || player.width < RELIC.MIN_WIDTH) return
        this.unlocked = true
        this.shownAt = now
    }

    draw(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, mode: MultiplayerMode, now: number): void {
        if (this.shownAt === null) return
        const age = now - this.shownAt
        if (age >= CUE_MS) { this.shownAt = null; return }

        const u = mode.cssScale
        const availableWidth = canvas.width - mode.hudInsets.left - mode.hudInsets.right
        const width = Math.min(156 * u, availableWidth - 20 * u)
        const height = 30 * u
        const x = mode.hudInsets.left + (availableWidth - width) / 2
        const y = COMPACT.matches
            ? Math.max(mode.hudInsets.top + 153 * u, mode.minimapBottom) + 10 * u
            : Math.max(mode.hudInsets.top + 76 * u, mode.chromeBottom + 72 * u)
        if (width < 106 * u || y + height > canvas.height - mode.hudInsets.bottom - 12 * u) return

        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        if (!reducedMotion?.matches) ctx.globalAlpha *= Math.max(0, Math.min(1, age / 110, (CUE_MS - age) / 260))
        roundedRect(ctx, x, y, width, height, height / 2)
        ctx.fillStyle = '#261c19'
        ctx.strokeStyle = RELIC_STYLE.relic
        ctx.lineWidth = u
        ctx.fill()
        ctx.stroke()

        ctx.font = `800 ${12 * u}px ${FONT}`
        const textWidth = Math.min(ctx.measureText(CUE_TEXT).width, width - 36 * u)
        const groupX = x + (width - textWidth - 20 * u) / 2
        const ix = groupX + 6 * u, iy = y + height / 2
        ctx.beginPath()
        ctx.moveTo(ix - 3 * u, iy - 5 * u)
        ctx.lineTo(ix + 3 * u, iy - 5 * u)
        ctx.lineTo(ix + 6 * u, iy)
        ctx.lineTo(ix + 3 * u, iy + 5 * u)
        ctx.lineTo(ix - 3 * u, iy + 5 * u)
        ctx.lineTo(ix - 6 * u, iy)
        ctx.closePath()
        ctx.fillStyle = RELIC_STYLE.relic
        ctx.fill()
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(CUE_TEXT, groupX + 20 * u, iy, textWidth)
        ctx.restore()
    }
}
