import type { GameState } from '../schema/GameState.js';
import { EXHALE } from '../constants/gameConstants.js';
import { waveActive, waveIntercepts, distanceToWave } from '../game/gustWave.js';
import { airflowQuality } from '../game/airflow.js';
import { puffImpulses } from '../game/puffImpulse.js';
export function updateGustWaves(state: GameState, now: number): void {
  for (const [id, wave] of state.gustWaves) {
    const owner = state.players.get(wave.owner);
    if (!owner || owner.state !== 'alive' || owner.capturedBy || owner.flying || state.time - wave.at >= EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_FADE_MS) {
      state.gustWaves.delete(id);
      continue;
    }
    if (!waveActive(wave, state.time))
      continue;
    const candidates: {
      id: string;
      width: number;
      falloff: number;
    }[] = [];
    for (const [otherId, other] of state.players) {
      if (other === owner || other.state !== 'alive' || other.spawnProtected || other.capturedBy || other.flying)
        continue;
      const mouth = { x: other.x + other.width / 2 + Math.cos(other.facing) * other.width * .3, y: other.y + other.height / 2 + Math.sin(other.facing) * other.width * .3 };
      const crossed = other.inhaling && airflowQuality(state.mouthed(other), state.bodyOf(owner)) > 0 && waveIntercepts(wave, state.time, mouth, { x: owner.x + owner.width / 2, y: owner.y + owner.height / 2 });
      if (crossed && !wave.parried.has(otherId)) {
        other.stopInhale(now);
        other.dropLatch();
        other.lockOn.delete(owner.sessionId);
        other.heldFor.delete(owner.sessionId);
        other.inhaleBlockedUntil = Math.max(other.inhaleBlockedUntil, now + EXHALE.PARRY_MS);
        wave.parried.add(otherId);
        state.onEvent?.('parry', { id: owner.sessionId, targetId: otherId });
      }
      if (!wave.pushed.has(otherId) && (crossed || distanceToWave(wave, { x: other.x + other.width / 2, y: other.y + other.height / 2 }) <= other.width / 2 + EXHALE.WAVE_THICKNESS / 2)) {
        wave.pushed.add(otherId);
        candidates.push({ id: otherId, width: other.width, falloff: .7 });
      }
    }
    const impulses = puffImpulses(wave.width, candidates), total = impulses.hits.reduce((sum, hit) => sum + hit.impulse, 0), scale = total ? Math.min(1, wave.remainingImpulse / total) : 0;
    for (const hit of impulses.hits) {
      const speed = hit.velocity * scale;
      state.players.get(hit.id)?.pushWithControl(-Math.cos(wave.facing), -Math.sin(wave.facing), speed);
      if (speed > 0) state.onEvent?.('gustHit', { id: owner.sessionId, targetId: hit.id, rear: true });
    }
    wave.remainingImpulse = Math.max(0, wave.remainingImpulse - total * scale);
  }
}
