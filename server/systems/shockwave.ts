import type { GameState } from '../schema/GameState.js';
import { SHOCKWAVE } from '../constants/gameConstants.js';
import { weaponCoreRadius } from '../game/weaponFairness.js';
import { weaponDamage } from './weaponDamage.js';
import { pulsarContact, pulsarHeading } from '../game/pulsar.js';

/** The gun can turn after release; the emitted crescent retains its own origin and heading. */
export function updateShockwave(state: GameState, dt: number, now: number, w = state.pinwheel): void {
  w.angle = pulsarHeading(w, state.time);
  if (state.time >= w.beatAt) {
    w.pulseFacing = w.angle; w.pulseX = w.x; w.pulseY = w.y;
    w.pulseAt = state.time; w.beatAt = state.time + SHOCKWAVE.BEAT_MS;
    w.pulseHits.clear(); w.pulseGrazes.clear();
  }
  const age = state.time - w.pulseAt;
  const previousAge = age - dt * 1000;
  const wave = { x: w.pulseX, y: w.pulseY, facing: w.pulseFacing, at: w.pulseAt };
  for (const p of state.players.values()) {
    const point = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
    const previous = w.pulsePositions.get(p.sessionId) ?? point;
    w.pulsePositions.set(p.sessionId, point);
    if (!w.pulseAt || (age > SHOCKWAVE.WAVE_MS && previousAge >= SHOCKWAVE.WAVE_MS) || p.sessionId === w.owner || p.state !== 'alive' || p.spawnProtected || p.capturedBy || p.flying || w.pulseHits.has(p.sessionId)) continue;
    const body = p.width / 2;
    const core = weaponCoreRadius(p.width);
    const coreContact = pulsarContact(wave, previous, point, previousAge, age, core);
    const outerContact = !coreContact && body > core && pulsarContact(wave, previous, point, previousAge, age, body);
    if (outerContact && !coreContact && body > core && !w.pulseGrazes.has(p.sessionId)) {
      w.pulseGrazes.add(p.sessionId);
      state.onEvent?.('impact', { x: point.x, y: point.y, size: 28, glancing: true });
    }
    if (!coreContact) continue;
    w.pulseHits.add(p.sessionId);
    const push = Math.max(SHOCKWAVE.MIN_PUSH_SPEED, SHOCKWAVE.PUSH_SPEED / Math.sqrt(p.weight()));
    const x = p.x + body, y = p.y + body, size = p.width;
    const amount = Math.min(p.gems, Math.max(SHOCKWAVE.DAMAGE_MIN_GEMS, Math.ceil(p.gems * SHOCKWAVE.DAMAGE_SHARE)));
    const { lost, out, earned, blocked } = weaponDamage(state, p, w.owner, amount, now);
    if (blocked) continue;
    state.credit(p, 'pulsar', now, w.owner, { gems: lost, earned, out, x, y, size });
    if (out) continue;
    p.pushWithControl(Math.cos(w.pulseFacing), Math.sin(w.pulseFacing), push);
  }
  for (const id of w.pulsePositions.keys()) if (!state.players.has(id)) w.pulsePositions.delete(id);
}
