import { ARENA_RULES, BLACK_HOLE } from '../constants/gameConstants.js';

/** First entry into a circle along a swept segment, including starts inside; null for a miss. */
export function circleEntry(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): number | null {
  const x = ax - cx, y = ay - cy, dx = bx - ax, dy = by - ay;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return null;
  const b = x * dx + y * dy, discriminant = b * b - a * c;
  if (discriminant <= 0) return null; // A tangent does not enter the core.
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}

/** Shared authoritative/predicted soft-rim routing. No velocity, damage, input or score changes. */
export function slideBlackHoleRims(body: { x: number; y: number; width: number; height: number },
  fromX: number, fromY: number, holes: Iterable<{ x: number; y: number; radius: number }>, worldWidth: number, worldHeight: number, dt: number): { x: number; y: number } {
  const half = body.width / 2, edge = ARENA_RULES.EDGE_MARGIN;
  const clamp = (x: number, y: number) => ({ x: Math.max(edge + half, Math.min(worldWidth - edge - half, x)),
    y: Math.max(edge + half, Math.min(worldHeight - edge - half, y)) });
  let end = clamp(body.x + half, body.y + body.height / 2);
  const start = { x: fromX + half, y: fromY + body.height / 2 };
  for (const hole of holes) {
    const r = hole.radius + half + BLACK_HOLE.RIM_CLEARANCE;
    const sx = start.x - hole.x, sy = start.y - hole.y, initial = Math.hypot(sx, sy);
    const dx = end.x - start.x, dy = end.y - start.y, travel = Math.hypot(dx, dy);
    if (initial < r - .001) {
      // Growth/debug placement can start inside the rim: recover gradually, never teleport.
      const ex = end.x - hole.x, ey = end.y - hole.y, distance = Math.hypot(ex, ey);
      const nx = distance > .001 ? ex / distance : initial > .001 ? sx / initial : 1;
      const ny = distance > .001 ? ey / distance : initial > .001 ? sy / initial : 0;
      const recovery = Math.min(Math.max(0, r - distance), BLACK_HOLE.RIM_RECOVERY_SPEED * Math.min(.1, Math.max(0, dt)));
      let candidate = clamp(end.x + nx * recovery, end.y + ny * recovery);
      if (Math.hypot(candidate.x - hole.x, candidate.y - hole.y) < initial && travel > 0) candidate = clamp(start.x, start.y);
      if (Math.hypot(candidate.x - start.x, candidate.y - start.y) < recovery * .2 && recovery > 0) {
        const side = (-ny * (worldWidth / 2 - hole.x) + nx * (worldHeight / 2 - hole.y)) >= 0 ? 1 : -1;
        candidate = clamp(end.x - ny * recovery * side, end.y + nx * recovery * side);
      }
      end = candidate; continue;
    }
    if (initial >= r - .001 && sx * dx + sy * dy >= 0 && Math.hypot(end.x - hole.x, end.y - hole.y) >= r - .001) continue;
    const t = circleEntry(start.x, start.y, end.x, end.y, hole.x, hole.y, r);
    if (t === null || travel < 1e-8) continue;
    const contactX = start.x + dx * t, contactY = start.y + dy * t;
    const angle = Math.atan2(contactY - hole.y, contactX - hole.x), cross = Math.cos(angle) * dy - Math.sin(angle) * dx;
    const open = -Math.sin(angle) * (worldWidth / 2 - hole.x) + Math.cos(angle) * (worldHeight / 2 - hole.y);
    const side = Math.abs(cross) > travel * .05 ? Math.sign(cross) : Math.sign(open) || 1;
    const arc = Math.min(Math.PI / 2, travel * (1 - t) / r);
    let chosen = clamp(contactX, contactY), best = -Infinity;
    for (const sign of [side, -side]) {
      const a = angle + arc * sign, raw = { x: hole.x + Math.cos(a) * r, y: hole.y + Math.sin(a) * r };
      const candidate = clamp(raw.x, raw.y), clear = Math.hypot(candidate.x - hole.x, candidate.y - hole.y);
      const score = (clear >= r - .001 ? 1000 : clear - r) - Math.hypot(candidate.x - raw.x, candidate.y - raw.y) + (sign === side ? 1 : 0);
      if (score > best) { best = score; chosen = candidate; }
    }
    end = chosen;
  }
  return { x: end.x - half, y: end.y - body.height / 2 };
}
