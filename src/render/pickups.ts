import type { MultiplayerMode } from '../core/GameModes'
import { FONT, GOLD } from './style'
import { PICKUP_TEXT_MS } from './shared'

/** "+1" rising above you when you grab gems, and a red "-1" for each one someone steals */
export function drawPickups(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, me: any, timestamp: number) : void {
    mode.pickups = mode.pickups.filter((pickup) => timestamp - pickup.at < PICKUP_TEXT_MS)
    if (!me || mode.pickups.length === 0) return
    const position = mode.predicted ?? me
    ctx.save()
    ctx.font = `700 18px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'bottom'
    ctx.fillStyle = GOLD
    for (const pickup of mode.pickups) {
        const t = (timestamp - pickup.at) / PICKUP_TEXT_MS
        if (t < 0) continue
        ctx.globalAlpha = 1 - t
        ctx.fillStyle = pickup.amount > 0 ? GOLD : '#ff6b6b'
        ctx.fillText(pickup.amount > 0 ? `+${pickup.amount}` : `${pickup.amount}`, position.x + me.width / 2, position.y - 30 - t * 34)
    }
    ctx.restore()
}
