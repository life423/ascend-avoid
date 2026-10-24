import type { GameState } from '../schema/GameState.js';
import { SHOCKWAVE } from '../constants/gameConstants.js';

/** Each expanding wave hits once. Previous radial distance catches players crossing a wave between ticks. */
export function updateShockwave(state: GameState, dt: number, now: number): void {
  const w = state.pinwheel;
  if (state.time >= w.beatAt) {
    w.pulseAt = state.time; w.beatAt = state.time + SHOCKWAVE.BEAT_MS;
    w.pulseHits.clear();
  }
  const age = state.time - w.pulseAt;
  const previousAge = age - dt * 1000;
  const radius = SHOCKWAVE.START_RADIUS + SHOCKWAVE.RANGE * Math.min(1, Math.max(0, age / SHOCKWAVE.WAVE_MS));
  const previousRadius = previousAge <= 0 ? 0 : SHOCKWAVE.START_RADIUS + SHOCKWAVE.RANGE * Math.min(1, previousAge / SHOCKWAVE.WAVE_MS);
  for (const p of state.players.values()) {
    const dx = p.x + p.width / 2 - w.x, dy = p.y + p.height / 2 - w.y;
    const distance = Math.hypot(dx, dy), previous = w.pulseDistances.get(p.sessionId) ?? distance;
    w.pulseDistances.set(p.sessionId, distance);
    if (!w.pulseAt || (age > SHOCKWAVE.WAVE_MS && previousAge >= SHOCKWAVE.WAVE_MS) || p.sessionId === w.owner || p.state !== 'alive' || p.spawnProtected || p.capturedBy || p.flying || w.pulseHits.has(p.sessionId)) continue;
    const body = p.width / 2;
    if (Math.min(previous, distance) - body > radius || Math.max(previous, distance) + body < previousRadius) continue;
    w.pulseHits.add(p.sessionId);
    const push = Math.max(SHOCKWAVE.MIN_PUSH, SHOCKWAVE.PUSH / Math.sqrt(p.weight()));
    p.shoveAlong(distance > 0 ? dx / distance : 1, distance > 0 ? dy / distance : 0, push, w.owner, now, 'drum');
  }
  for (const id of w.pulseDistances.keys()) if (!state.players.has(id)) w.pulseDistances.delete(id);
}
