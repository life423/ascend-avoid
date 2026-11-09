import { EXHALE, GEMS, RELIC, SHIFT, TURBINE } from '../constants/gameConstants.js';
import { arenaClearance } from '../game/arenaBoundary.js';
import { gemClearOfHoles } from '../game/arenaPlacement.js';
import type { GameState } from '../schema/GameState.js';
import { GemSchema } from '../schema/GemSchema.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';

const WIDE_SHARE = 0.4;
const HEADINGS = 32;
const WIDE_OFFSETS = [90, 160, 270, 440, 700];
const NEAR_OFFSETS = [32, ...WIDE_OFFSETS];
type Point = { x: number; y: number };

function fanPoints(x: number, y: number, halfSize: number, count: number, offsets: readonly number[],
  canLand: (point: Point) => boolean, occupied: Point[]): Point[] {
  const turn = Math.random() * 2 * Math.PI;
  const points: Point[] = [];
  for (let i = 0; i < count; i++) {
    const preferred = turn + i * 2 * Math.PI / count;
    let spot: Point | undefined;
    for (const offset of offsets) {
      for (let step = 0; step < HEADINGS; step++) {
        // Alternate around the intended angle to fan along the wall when the direct path is blocked.
        const side = step % 2 ? (step + 1) / 2 : -step / 2;
        const angle = preferred + side * 2 * Math.PI / HEADINGS;
        const dx = Math.cos(angle), dy = Math.sin(angle);
        const distance = halfSize / Math.max(Math.abs(dx), Math.abs(dy)) + offset;
        const candidate = { x: Math.round(x + dx * distance), y: Math.round(y + dy * distance) };
        if (!canLand(candidate) || occupied.some(point => Math.hypot(candidate.x - point.x, candidate.y - point.y) < GEMS.SETTLED_SPACING)) continue;
        spot = candidate;
        break;
      }
      if (spot) break;
    }
    if (!spot) break;
    points.push(spot);
    occupied.push(spot);
  }
  return points;
}

/** Place the whole spill outside the survivor before committing the gem debit. */
export function sprayRelicCometGems(state: GameState, target: PlayerSchema, x: number, y: number, total: number, now: number,
  survivorWidth = target.width): boolean {
  if (total <= 0) return false;
  // Pickup uses a rectangle. Pad it for the distance the impact can carry a stationary survivor.
  const drift = (Math.hypot(target.puffVx, target.puffVy) + RELIC.SHOVE_SPEED) / EXHALE.DRAG +
    Math.hypot(target.gustVx, target.gustVy) / EXHALE.REAR_DRAG;
  const halfSize = survivorWidth / 2 + GEMS.RADIUS + drift + 2;
  const canLand = (point: Point): boolean => (
    (Math.abs(point.x - x) >= halfSize || Math.abs(point.y - y) >= halfSize) &&
    arenaClearance(point.x, point.y, state.worldWidth, state.worldHeight) >= GEMS.RADIUS + 2 &&
    state.isFloorAt(point.x, point.y) && gemClearOfHoles(point, state.blackHoles) &&
    state.turbines.every(fan => Math.hypot(point.x - fan.x, point.y - fan.y) >= TURBINE.BODY_RADIUS + GEMS.RADIUS)
  );
  const wide = Math.round(total * WIDE_SHARE), near = total - wide;
  // The field limit is soft for combat drops. Keep at most one slot per share when full.
  const room = Math.max(2, GEMS.MAX_GEMS - state.gems.size);
  const pieces = Math.min(total, GEMS.SPRAY_PIECES, room);
  const widePieces = wide > 0 ? Math.min(wide, Math.max(pieces - near, Math.round(pieces * WIDE_SHARE))) : 0;
  const occupied: Point[] = [];
  const nearPoints = fanPoints(x, y, halfSize, pieces - widePieces, NEAR_OFFSETS, canLand, occupied);
  const widePoints = fanPoints(x, y, halfSize, widePieces, WIDE_OFFSETS, canLand, occupied);
  if (!occupied.length) {
    // If terrain blocks the whole fan, preserve the spill at the nearest legal tile center.
    let distance = Infinity;
    let fallback: Point | undefined;
    for (let row = 0; row < SHIFT.GRID; row++) for (let col = 0; col < SHIFT.GRID; col++) {
      const point = { x: Math.round((col + .5) * state.worldWidth / SHIFT.GRID),
        y: Math.round((row + .5) * state.worldHeight / SHIFT.GRID) };
      const gap = Math.hypot(point.x - x, point.y - y);
      if (gap < distance && canLand(point)) {
        fallback = point;
        distance = gap;
      }
    }
    if (!fallback) return false;
    nearPoints.push(fallback);
  }

  if (total >= 3) state.onEvent?.('burst', { x: Math.round(x), y: Math.round(y), count: total });
  const groups = [
    { points: nearPoints, value: widePoints.length ? near : total },
    { points: widePoints, value: nearPoints.length ? wide : total },
  ];
  for (const { points, value } of groups) points.forEach((point, i) => {
    const piece = Math.floor(value / points.length) + (i < value % points.length ? 1 : 0);
    const gem = new GemSchema(point.x, point.y, piece);
    gem.spray(0, 0, now, target.sessionId);
    state.gems.set(`g${state.nextGemId++}`, gem);
  });
  return true;
}
