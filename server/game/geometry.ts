import { SUCTION } from "../constants/gameConstants.js";

/** How strongly suction moves a body: the puller's width over the target's, softened and kept in bounds (see SUCTION) */
export function suctionScale(pullerWidth: number, targetWidth: number): number {
  return Math.min(SUCTION.MAX, Math.max(SUCTION.MIN, Math.pow(pullerWidth / Math.max(1, targetWidth), SUCTION.SOFTEN)));
}

/** Distance from a point to a rectangle (0 when the point is inside it) */
export function distanceToRect(px: number, py: number, x: number, y: number, width: number, height: number): number {
  const dx = Math.max(x - px, 0, px - (x + width));
  const dy = Math.max(y - py, 0, py - (y + height));
  return Math.hypot(dx, dy);
}
