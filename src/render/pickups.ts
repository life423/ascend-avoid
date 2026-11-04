import type { MultiplayerMode } from '../core/GameModes'
import { FONT, GOLD } from './style'
import { PICKUP_TEXT_MS } from './shared'
import type { SyncedPlayer } from '../types/synced'
import { formatGems } from '../utils/score'
import { pickupLabels } from './pickupReadability'

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)')

/** Readable gain/loss counters above the name and, for the leader, crown and gem score. */
export function drawPickups(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, me: SyncedPlayer, timestamp: number, isLeader = false) : void {
    mode.pickups = mode.pickups.filter((pickup) => timestamp - pickup.at < PICKUP_TEXT_MS)
    if (!me || mode.pickups.length === 0) return
    const position = mode.predicted ?? me
    ctx.save()
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    const transform = ctx.getTransform(), pixel = mode.cssScale / Math.max(.001, Math.hypot(transform.a, transform.b))
    ctx.strokeStyle = '#07121e'; ctx.lineWidth = 2.5 * pixel; ctx.lineJoin = 'round'
    for (const label of pickupLabels(mode.pickups, timestamp, PICKUP_TEXT_MS, pixel, isLeader, reducedMotion.matches)) {
        ctx.font = `700 ${label.fontSize}px ${FONT}`
        ctx.globalAlpha = label.alpha
        ctx.fillStyle = label.amount > 0 ? GOLD : '#ff6b6b'
        const text = label.amount > 0 ? `+${formatGems(label.amount)}` : formatGems(label.amount)
        const x = position.x + me.width / 2, y = position.y - label.offsetY
        ctx.strokeText(text, x, y); ctx.fillText(text, x, y)
    }
    ctx.restore()
}
