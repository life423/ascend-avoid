import type { GameState } from '../schema/GameState.js';
import { SHOCKWAVE } from '../constants/gameConstants.js';
import { sprayGems } from './gems.js';
import { knockOutWithGems } from './inhale.js';

/** Each expanding wave hits once. Previous radial distance catches players crossing a wave between ticks. */
export function updateShockwave(state: GameState, dt: number, now: number, w = state.pinwheel): void {
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
    const x = p.x + body, y = p.y + body, size = p.width;
    let lost = Math.min(p.gems, Math.max(SHOCKWAVE.DAMAGE_MIN_GEMS, Math.ceil(p.gems * SHOCKWAVE.DAMAGE_SHARE)));
    const out = p.gems - lost < SHOCKWAVE.KO_GEMS;
    if (out) { lost = p.gems; knockOutWithGems(state, p, now); }
    else {
      p.injure(state.time);
      p.setGems(p.gems - lost, state.worldWidth, state.worldHeight);
      sprayGems(state, x, y, lost, now, p.sessionId);
    }
    state.credit(p, 'pulsar', now, w.owner, { gems: lost, out, x, y, size });
    if (out) continue;
    p.shoveAlong(distance > 0 ? dx / distance : 1, distance > 0 ? dy / distance : 0, push, w.owner, now, 'pulsar');
  }
  for (const id of w.pulseDistances.keys()) if (!state.players.has(id)) w.pulseDistances.delete(id);
}
