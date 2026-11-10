import { ARENA_RULES, BLACK_HOLE, GEMS, TURBINE } from '../constants/gameConstants.js';
import type { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import type { GameState } from '../schema/GameState.js';
import { arenaClearance, arenaCornerRadius } from './arenaBoundary.js';
import { blackHoleReservesSpace } from './blackHole.js';
import { distanceToSegment } from './geometry.js';

interface Hazard { x: number; y: number; radius: number }

const GRID = 40;
const MIN_REGION_NODES = 4;
const CLEARANCE = 4;
const NEIGHBOURS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Keep a new fan or rim from splitting an existing maximum-body route.
 * Compare surviving regions so an older barrier can clear on its normal schedule.
 */
export function preservesGiantRoutes(state: GameState, candidate: Hazard, movingHole?: BlackHoleSchema): boolean {
  const width = state.worldWidth, height = state.worldHeight;
  const body = Math.max(ARENA_RULES.PLAYER_SIZE, Math.min(width, height) * GEMS.SIZE_MAX_SHARE) / 2;
  const pad = body + ARENA_RULES.EDGE_MARGIN;
  if (width <= pad * 2 || height <= pad * 2) return false;
  const expand = (hazard: Hazard) => ({ ...hazard, radius: hazard.radius + body + CLEARANCE });
  const before = [
    ...state.blackHoles.filter(h => h !== movingHole && blackHoleReservesSpace(h))
      .map(h => expand({ x: h.x, y: h.y, radius: h.radius + BLACK_HOLE.RIM_CLEARANCE })),
    ...state.turbines.filter(fan => fan.phase !== 'ending')
      .map(fan => expand({ x: fan.x, y: fan.y, radius: TURBINE.BODY_RADIUS })),
  ];
  const added = expand(candidate);
  if (arenaCornerRadius(width, height) <= pad) {
    // In the rectangular centre domain, one wall or disk alone cannot be bridged.
    const walls = [added.x - pad, width - pad - added.x, added.y - pad, height - pad - added.y];
    const contacts = walls.filter(distance => distance <= added.radius).length
      + before.filter(h => Math.hypot(h.x - added.x, h.y - added.y) <= h.radius + added.radius).length;
    if (contacts < 2) return true;
  }

  const size = GRID + 1, count = size * size;
  const dx = (width - pad * 2) / GRID, dy = (height - pad * 2) / GRID;
  const points = Array.from({ length: count }, (_, i) => ({ x: pad + i % size * dx, y: pad + Math.floor(i / size) * dy }));
  const floor = points.map(p => arenaClearance(p.x, p.y, width, height) >= pad - 1e-6);
  const queue = new Uint32Array(count);
  const regions = (hazards: Hazard[]) => {
    const labels = new Int16Array(count);
    const representatives: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!floor[i] || hazards.some(h => Math.hypot(points[i].x - h.x, points[i].y - h.y) < h.radius)) labels[i] = -1;
    }
    let label = 0;
    for (let i = 0; i < count; i++) {
      if (labels[i] !== 0) continue;
      queue[0] = i; labels[i] = ++label;
      let tail = 1;
      for (let head = 0; head < tail; head++) {
        const id = queue[head], col = id % size, row = Math.floor(id / size);
        for (const [ox, oy] of NEIGHBOURS) {
          const x = col + ox, y = row + oy;
          if (x < 0 || x >= size || y < 0 || y >= size) continue;
          const next = y * size + x;
          if (labels[next] !== 0 || hazards.some(h => distanceToSegment(h.x, h.y, points[id].x, points[id].y, points[next].x, points[next].y) < h.radius)) continue;
          labels[next] = label;
          queue[tail++] = next;
        }
      }
      if (tail >= MIN_REGION_NODES) representatives.push(i);
    }
    return { labels, representatives };
  };

  const after = regions([...before, added]).representatives;
  if (after.length === 0) return false;
  if (after.length === 1) return true;
  const earlier = regions(before).labels;
  return new Set(after.map(id => earlier[id])).size === after.length;
}
