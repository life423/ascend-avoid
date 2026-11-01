import { BLACK_HOLE, TURBINE } from '../constants/gameConstants.js';
import { distanceToSegment } from './geometry.js';

interface Point { x: number; y: number }
interface Fan extends Point { intake: number }
interface Hole extends Point { radius: number }

/** Visual reservation includes the part's claim badge/label, not its smaller pickup hitbox. */
export const PLACEMENT = { PART_RADIUS: 48, PART_GAP: 16, HAZARD_GAP: 260, RETRY_MS: 250 } as const;
const clusterRadius = 145;
// The flared intake corner is wider than the circular fan housing; the outlet can sweep.
const fanRadius = Math.hypot(TURBINE.BODY_RADIUS * 1.15, TURBINE.BODY_RADIUS * .8) + 2;
const offsets = [0, 1, 2].map(i => ({ x: Math.cos(i * Math.PI * 2 / 3) * clusterRadius, y: Math.sin(i * Math.PI * 2 / 3) * clusterRadius }));
const holeRadius = (hole: Hole) => Math.max(BLACK_HOLE.RING_RADIUS + 8, hole.radius + 24);

/** Distance to the fan's inner intake sector, including its two side edges. */
function intakeDistance(point: Point, fan: Fan): number {
  const x = fan.x + Math.cos(fan.intake) * TURBINE.BODY_RADIUS;
  const y = fan.y + Math.sin(fan.intake) * TURBINE.BODY_RADIUS;
  const dx = point.x - x, dy = point.y - y, d = Math.hypot(dx, dy);
  const angle = Math.atan2(Math.sin(Math.atan2(dy, dx) - fan.intake), Math.cos(Math.atan2(dy, dx) - fan.intake));
  if (Math.abs(angle) <= TURBINE.INTAKE_ARC) return Math.max(0, d - TURBINE.DANGER_REACH);
  return Math.min(...[-1, 1].map(side => {
    const edge = fan.intake + side * TURBINE.INTAKE_ARC;
    return distanceToSegment(point.x, point.y, x, y, x + Math.cos(edge) * TURBINE.DANGER_REACH, y + Math.sin(edge) * TURBINE.DANGER_REACH);
  }));
}

/** Used in both spawn directions: parts avoid existing fans and new fans avoid loose parts. */
export function partClearOfFan(part: Point, fan: Fan): boolean {
  const space = PLACEMENT.PART_RADIUS + PLACEMENT.PART_GAP;
  return Math.hypot(part.x - fan.x, part.y - fan.y) >= fanRadius + space && intakeDistance(part, fan) >= space;
}

/** Fixed black-hole landmarks reserve a visible gap from later fan spawns. */
export function fanClearOfHole(fan: Point, hole: Hole): boolean {
  return Math.hypot(fan.x - hole.x, fan.y - hole.y) >= fanRadius + holeRadius(hole) + PLACEMENT.HAZARD_GAP;
}

interface Space {
  width: number; height: number;
  fans: Iterable<Fan>; holes: Iterable<Hole>; parts: Iterable<Point>;
}

/** Keep a three-part set together. Try nearby spots, then a bounded grid; never force a bad fallback. */
export function findPartLayout(space: Space, x: number, y: number): { x: number; y: number; parts: Point[] } | null {
  const fans = Array.from(space.fans), holes = Array.from(space.holes), occupied = Array.from(space.parts);
  const margin = PLACEMENT.PART_RADIUS + PLACEMENT.PART_GAP;
  const minX = margin - Math.min(...offsets.map(p => p.x)), maxX = space.width - margin - Math.max(...offsets.map(p => p.x));
  const minY = margin - Math.min(...offsets.map(p => p.y)), maxY = space.height - margin - Math.max(...offsets.map(p => p.y));
  if (minX > maxX || minY > maxY) return null;
  const clampX = (value: number) => Math.max(minX, Math.min(maxX, value));
  const clampY = (value: number) => Math.max(minY, Math.min(maxY, value));
  const preferred = { x: clampX(x), y: clampY(y) };
  const candidates = [preferred];
  for (let radius = 160; radius <= 800; radius += 160) for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8;
    candidates.push({ x: clampX(preferred.x + Math.cos(a) * radius), y: clampY(preferred.y + Math.sin(a) * radius) });
  }
  const grid: Point[] = [];
  for (let row = 0; row < 7; row++) for (let col = 0; col < 7; col++) grid.push({ x: minX + (maxX - minX) * col / 6, y: minY + (maxY - minY) * row / 6 });
  grid.sort((a, b) => Math.hypot(a.x - preferred.x, a.y - preferred.y) - Math.hypot(b.x - preferred.x, b.y - preferred.y));
  for (const anchor of [...candidates, ...grid]) {
    const parts = offsets.map(p => ({ x: anchor.x + p.x, y: anchor.y + p.y }));
    if (parts.every(part => fans.every(fan => partClearOfFan(part, fan))
      && holes.every(hole => Math.hypot(part.x - hole.x, part.y - hole.y) >= holeRadius(hole) + margin)
      && occupied.every(other => Math.hypot(part.x - other.x, part.y - other.y) >= PLACEMENT.PART_RADIUS * 2 + PLACEMENT.PART_GAP))) {
      return { ...anchor, parts };
    }
  }
  return null;
}
