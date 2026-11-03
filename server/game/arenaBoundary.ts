import { ARENA_RULES } from '../constants/gameConstants.js';
import type { Box } from './movement.js';

export interface Vector { x: number; y: number }

/** One physical outline for the server, prediction, world drawing and minimap. */
export function arenaCornerRadius(width: number, height: number): number {
  return Math.max(0, Math.min(ARENA_RULES.CORNER_RADIUS, Math.min(width, height) / 4));
}

/** Signed distance inward from the visible rounded wall (negative outside). */
export function arenaClearance(x: number, y: number, width: number, height: number): number {
  const r = arenaCornerRadius(width, height);
  const qx = Math.abs(x - width / 2) - (width / 2 - r);
  const qy = Math.abs(y - height / 2) - (height / 2 - r);
  return r - Math.hypot(Math.max(0, qx), Math.max(0, qy)) - Math.min(0, Math.max(qx, qy));
}

export function arenaContains(box: Box, width: number, height: number, margin: number = ARENA_RULES.EDGE_MARGIN): boolean {
  return arenaClearance(box.x + box.width / 2, box.y + box.height / 2, width, height) >= Math.max(box.width, box.height) / 2 + margin - 1e-7;
}

/** World objects use centre coordinates rather than a player's top-left box. */
export function constrainArenaPoint(point: Vector, width: number, height: number, padding: number): void {
  const box = { x: point.x, y: point.y, width: 0, height: 0 };
  constrainArena(box, width, height, undefined, padding);
  point.x = box.x; point.y = box.y;
}

/** Project the physical circular body inside the wall; remove only outward velocity. */
export function constrainArena(box: Box, width: number, height: number, velocity?: Vector, margin: number = ARENA_RULES.EDGE_MARGIN): { hit: boolean; nx: number; ny: number } {
  const radius = arenaCornerRadius(width, height);
  const pad = Math.max(box.width, box.height) / 2 + margin;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  // Legal growth stays below the corner radius; the fallback also handles tiny test arenas.
  const inset = Math.max(pad, radius), round = Math.max(0, radius - pad);
  const qx = Math.max(Math.min(inset, width / 2), Math.min(width - inset, x));
  const qy = Math.max(Math.min(inset, height / 2), Math.min(height - inset, y));
  const dx = x - qx, dy = y - qy, distance = Math.hypot(dx, dy);
  if (distance <= round + 1e-9) return { hit: false, nx: 0, ny: 0 };
  const nx = dx / distance, ny = dy / distance;
  box.x = qx + nx * round - box.width / 2;
  box.y = qy + ny * round - box.height / 2;
  if (velocity) {
    const outward = velocity.x * nx + velocity.y * ny;
    if (outward > 0) { velocity.x -= nx * outward; velocity.y -= ny * outward; }
  }
  return { hit: true, nx, ny };
}

/** First wall contact along a straight flight. Convexity makes this bounded search unambiguous. */
export function arenaExit(box: Box, dx: number, dy: number, width: number, height: number): number | null {
  const end = { x: box.x + dx, y: box.y + dy, width: box.width, height: box.height };
  if (arenaContains(end, width, height)) return null;
  if (!arenaContains(box, width, height)) return 0;
  let lo = 0, hi = 1;
  for (let i = 0; i < 32; i++) {
    const t = (lo + hi) / 2;
    if (arenaContains({ x: box.x + dx * t, y: box.y + dy * t, width: box.width, height: box.height }, width, height)) lo = t;
    else hi = t;
  }
  return lo;
}
