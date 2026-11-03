import { arenaCornerRadius } from '../../server/game/arenaBoundary';

/** Exact circular arcs from the physical wall, also scaled for the minimap. */
export function traceArena(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius = arenaCornerRadius(width, height)): void {
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.arcTo(x + width, y, x + width, y + radius, radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius);
    ctx.lineTo(x + radius, y + height);
    ctx.arcTo(x, y + height, x, y + height - radius, radius);
    ctx.lineTo(x, y + radius);
    ctx.arcTo(x, y, x + radius, y, radius);
    ctx.closePath();
}
