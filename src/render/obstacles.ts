import type { MultiplayerMode } from '../core/GameModes'
import { getSprite } from '../utils/sprites'

/** Obstacles use the solo sprites; vertical ones are drawn turned on their side */
export function drawObstacle(_mode: MultiplayerMode, ctx: CanvasRenderingContext2D, obstacle: any, timestamp: number) : void {
    const sprite = getSprite('obstacle', obstacle.variant, timestamp)
    if (obstacle.height <= obstacle.width) {
        ctx.drawImage(sprite, obstacle.x, obstacle.y, obstacle.width, obstacle.height)
        return
    }
    ctx.save()
    ctx.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2)
    ctx.rotate(Math.PI / 2)
    ctx.drawImage(sprite, -obstacle.height / 2, -obstacle.width / 2, obstacle.height, obstacle.width)
    ctx.restore()
}
