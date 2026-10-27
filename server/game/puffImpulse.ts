import { EXHALE } from '../constants/gameConstants.js';
import { bodyMass } from './creatureSize.js';

export interface PuffBody { id: string; width: number; falloff: number }
/** One finite impulse budget, conserving momentum before ordinary drag/boundary collisions. */
export function puffImpulses(width: number, targets: readonly PuffBody[]): { recoil: number; hits: { id: string; impulse: number; velocity: number }[] } {
  const mass = Math.max(.001, bodyMass(width));
  const raw = targets.map(target => {
    const m = Math.max(.001, bodyMass(target.width)), reduced = mass * m / (mass + m);
    return { id: target.id, mass: m, impulse: Math.min(reduced * EXHALE.IMPULSE_RELATIVE_SPEED * Math.max(0, Math.min(1, target.falloff)), m * EXHALE.IMPULSE_ADDED_SPEED_CAP) };
  });
  const total = raw.reduce((sum, hit) => sum + hit.impulse, 0), scale = total > 0 ? Math.min(1, mass * EXHALE.IMPULSE_RECOIL_CAP / total) : 0;
  const hits = raw.map(hit => ({ id: hit.id, impulse: hit.impulse * scale, velocity: hit.impulse * scale / hit.mass }));
  return { recoil: hits.reduce((sum, hit) => sum + hit.impulse, 0) / mass, hits };
}
