import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { SHOT_FOLLOW } from '../constants/gameConstants.js';

function invalid(p: PlayerSchema): boolean { return p.state !== 'alive' || !!p.capturedBy || !!p.gulping || p.flying || p.stunned || p.sliding || p.recovering; }
export function clearShotFollow(p: PlayerSchema): void { p.followUntil = 0; p.followActive = false; p.followSpeed = p.followTravel = 0; }

/** First successful hit owns this fixed destination. Repeated hits cannot redirect or extend it. */
export function offerShotFollow(state: GameState, id: string, x: number, y: number): void {
  const p = state.players.get(id);
  if (!p || invalid(p) || p.followActive || p.followUntil > state.time || !Number.isFinite(x + y)) return;
  if (Math.hypot(x - p.x - p.width / 2, y - p.y - p.height / 2) <= Math.max(SHOT_FOLLOW.STOP_DISTANCE, p.width / 2 + 16)) return;
  p.followX = Math.max(0, Math.min(state.worldWidth, x)); p.followY = Math.max(0, Math.min(state.worldHeight, y));
  p.followUntil = state.time + SHOT_FOLLOW.WINDOW_MS; p.followPressId = p.inhalePressId;
  p.followActive = false; p.followSpeed = p.followTravel = 0;
}

/** A fresh inhale edge is mandatory: an already-held inhale remains ordinary inhale. */
export function followConsumesInhale(state: GameState, p: PlayerSchema): boolean {
  if (!p.followUntil) return false;
  if (invalid(p) || state.time >= p.followUntil) { clearShotFollow(p); return false; }
  if (!p.followActive && p.inhaling && p.inhalePressId > p.followPressId) {
    p.followActive = true; p.followUntil = state.time + SHOT_FOLLOW.DURATION_MS;
    p.theftContinuations.clear(); p.dropLatch();
  }
  return p.followActive;
}

/** Earliest segment entry into an expanded obstacle rectangle; no corner-cutting or tunnelling. */
function entry(ax: number, ay: number, dx: number, dy: number, x: number, y: number, w: number, h: number): number {
  let lo = 0, hi = 1;
  for (const [p, v, a, b] of [[ax, dx, x, x + w], [ay, dy, y, y + h]]) {
    if (Math.abs(v) < 1e-9) { if (p < a || p > b) return 1; continue; }
    const t1 = (a - p) / v, t2 = (b - p) / v;
    lo = Math.max(lo, Math.min(t1, t2)); hi = Math.min(hi, Math.max(t1, t2));
    if (lo > hi) return 1;
  }
  return lo;
}

export function updateShotFollow(state: GameState, p: PlayerSchema, dt: number): void {
  if (!followConsumesInhale(state, p)) return;
  if (!p.inhaling) { clearShotFollow(p); return; }
  const dx = p.followX - p.x - p.width / 2, dy = p.followY - p.y - p.height / 2, distance = Math.hypot(dx, dy);
  const stop = Math.max(SHOT_FOLLOW.STOP_DISTANCE, p.width / 2 + 16), remaining = SHOT_FOLLOW.MAX_TRAVEL - p.followTravel;
  if (distance <= stop + .01 || remaining <= .01) { clearShotFollow(p); return; }
  p.followSpeed = Math.min(SHOT_FOLLOW.SPEED, p.followSpeed + SHOT_FOLLOW.ACCELERATION * Math.max(0, dt));
  const step = Math.min(p.followSpeed * Math.min(.1, Math.max(0, dt)), distance - stop, remaining);
  const mx = dx / distance * step, my = dy / distance * step, box = p.hitBox();
  let fraction = 1;
  for (const o of state.obstacles) fraction = Math.min(fraction, entry(box.x, box.y, mx, my, o.x - box.width, o.y - box.height, o.width + box.width, o.height + box.height));
  if (fraction < 1) fraction = Math.max(0, fraction - 2 / Math.max(1, step));
  const x = p.x, y = p.y;
  p.nudge(mx * fraction, my * fraction, state.worldWidth, state.worldHeight);
  const moved = Math.hypot(p.x - x, p.y - y); p.followTravel += moved;
  if (fraction < 1 || moved + .01 < step || distance - moved <= stop + .01 || p.followTravel >= SHOT_FOLLOW.MAX_TRAVEL - .01) clearShotFollow(p);
}
