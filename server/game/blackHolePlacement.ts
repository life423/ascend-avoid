import { ARENA_RULES, BLACK_HOLE, GEMS, WORLD } from '../constants/gameConstants.js';
import type { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import type { GameState } from '../schema/GameState.js';
import { arenaClearance, constrainArenaPoint } from './arenaBoundary.js';
import { fanClearOfHole, PLACEMENT } from './arenaPlacement.js';
import { blackHoleReservesSpace } from './blackHole.js';
import { distanceToSegment } from './geometry.js';
import { allWeapons } from './weaponKit.js';
import { relicReservesHazard } from '../systems/relic.js';

interface Point { x: number; y: number }
interface Core extends Point { radius: number }

// A bounded, conservative route proof: false negatives defer a relocation rather than
// forcing a hole into a narrow gap. This is deliberately independent of combat tuning.
const GRID = 64;
const ROUTE_GAP = 24;
const CORRIDOR_GAP = 64;
const MACHINE_RADIUS = 56;
const neighbours = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

function maximumWidth(state: GameState): number {
  return Math.max(ARENA_RULES.PLAYER_SIZE, Math.min(state.worldWidth, state.worldHeight) * GEMS.SIZE_MAX_SHARE);
}

/** All four legal corner-body positions must reach the center without crossing a rim.
 * Fans already have their own fixed housing/intake reservations below. This proves
 * routes around holes, not globally unobstructed paths through the existing fans,
 * transient players, or optional shifting-floor layouts.
 */
function giantRoutesClear(state: GameState, holes: Core[]): boolean {
  const width = state.worldWidth, height = state.worldHeight;
  const radius = maximumWidth(state) / 2, padding = radius + ARENA_RULES.EDGE_MARGIN;
  if (width <= padding * 2 || height <= padding * 2) return false;
  const expanded = holes.map(h => ({ ...h, radius: h.radius + radius + BLACK_HOLE.RIM_CLEARANCE + ROUTE_GAP }));
  const clear = (p: Point) => arenaClearance(p.x, p.y, width, height) >= padding - 1e-6
    && expanded.every(h => Math.hypot(p.x - h.x, p.y - h.y) >= h.radius);
  const segmentClear = (a: Point, b: Point) => expanded.every(h => distanceToSegment(h.x, h.y, a.x, a.y, b.x, b.y) >= h.radius);
  const corners = [[0, 0], [width, 0], [0, height], [width, height]].map(([x, y]) => {
    const corner = { x, y }; constrainArenaPoint(corner, width, height, padding); return corner;
  });
  // Most unsuitable locations fail this constant-sized check, before any flood fill.
  if (!clear({ x: width / 2, y: height / 2 }) || corners.some(corner => !clear(corner))) return false;
  const count = GRID + 1, dx = (width - padding * 2) / GRID, dy = (height - padding * 2) / GRID;
  const points: Point[] = [], open = new Uint8Array(count * count), seen = new Uint8Array(count * count);
  for (let y = 0; y <= GRID; y++) for (let x = 0; x <= GRID; x++) {
    const p = { x: padding + x * dx, y: padding + y * dy };
    points.push(p); open[y * count + x] = Number(clear(p));
  }
  const center = GRID / 2 * count + GRID / 2;
  if (!open[center]) return false;
  const queue = new Uint32Array(count * count); queue[0] = center; seen[center] = 1;
  let tail = 1;
  for (let head = 0; head < tail; head++) {
    const id = queue[head], x = id % count, y = Math.floor(id / count);
    for (const [nx, ny] of neighbours) {
      const col = x + nx, row = y + ny;
      if (col < 0 || col > GRID || row < 0 || row > GRID) continue;
      const next = row * count + col;
      if (seen[next] || !open[next] || !segmentClear(points[id], points[next])) continue;
      seen[next] = 1; queue[tail++] = next;
    }
  }
  return corners.every(corner => {
    // Rounded small arenas can have projected corner centers between grid nodes.
    const col = Math.round((corner.x - padding) / dx), row = Math.round((corner.y - padding) / dy);
    for (let yy = Math.max(0, row - 1); yy <= Math.min(GRID, row + 1); yy++) for (let xx = Math.max(0, col - 1); xx <= Math.min(GRID, col + 1); xx++) {
      const id = yy * count + xx;
      if (seen[id] && segmentClear(corner, points[id])) return true;
    }
    return false;
  });
}

/** Revalidate a warned location immediately before it opens. Moving far enough is
 * a selector requirement, not an activation requirement: hole.x/y is already new.
 */
export function blackHoleSpotClear(state: GameState, hole: BlackHoleSchema, x: number, y: number): boolean {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const candidate = { x, y, radius: hole.radius, phase: 'warning' };
  const ring = hole.radius + BLACK_HOLE.RING_RADIUS - BLACK_HOLE.CORE_RADIUS + 8;
  if (arenaClearance(x, y, state.worldWidth, state.worldHeight) < ring) return false;
  if (relicReservesHazard(state, x, y, hole.radius + BLACK_HOLE.RIM_CLEARANCE)) return false;
  if (!state.isFloorAt(x, y) || neighbours.some(([dx, dy]) => !state.isFloorAt(x + dx * ring, y + dy * ring))) return false;
  if (state.turbines.some(fan => !fanClearOfHole(fan, candidate))) return false;
  for (const player of state.players.values()) if (player.state === 'alive') {
    const bodyRadius = Math.max(player.width, player.height) / 2;
    if (Math.hypot(x - player.x - player.width / 2, y - player.y - player.height / 2) < ring + bodyRadius + BLACK_HOLE.PLAYER_CLEARANCE) return false;
  }
  for (const weapon of allWeapons(state)) {
    if ((weapon.phase === 'active' || weapon.phase === 'charging')
      && Math.hypot(x - weapon.x, y - weapon.y) < ring + MACHINE_RADIUS + PLACEMENT.PART_GAP) return false;
    if (weapon.phase === 'parts' && weapon.parts.some(part => !part.carriedBy
      && Math.hypot(x - part.x, y - part.y) < ring + PLACEMENT.PART_RADIUS + PLACEMENT.PART_GAP)) return false;
  }
  const others = state.blackHoles.filter(other => other !== hole && blackHoleReservesSpace(other));
  const bodyWidth = maximumWidth(state);
  if (others.some(other => Math.hypot(x - other.x, y - other.y)
    < bodyWidth + hole.radius + other.radius + BLACK_HOLE.RIM_CLEARANCE * 2 + CORRIDOR_GAP)) return false;
  return giantRoutesClear(state, [...others, candidate]);
}

/** Shuffle a fixed normalized grid; exhaustion leaves the slot dormant for retry.
 * No rejection loop, unsafe fallback, or change to the current physical core size.
 */
export function findBlackHoleSpot(state: GameState, hole: BlackHoleSchema): Point | null {
  const candidates: Point[] = [];
  const minimumMove = BLACK_HOLE.RELOCATE_MIN * Math.min(1, state.worldWidth / WORLD.WIDTH, state.worldHeight / WORLD.HEIGHT);
  const lastCore = hole.lastCorePosition;
  for (let row = 0; row <= 16; row++) for (let col = 0; col <= 16; col++) {
    const candidate = { x: state.worldWidth * (.1 + col * .05), y: state.worldHeight * (.1 + row * .05) };
    if (Math.hypot(candidate.x - hole.x, candidate.y - hole.y) < minimumMove) continue;
    if (lastCore && Math.hypot(candidate.x - lastCore.x, candidate.y - lastCore.y) < minimumMove) continue;
    candidates.push(candidate);
  }
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  return candidates.find(p => blackHoleSpotClear(state, hole, p.x, p.y)) ?? null;
}
