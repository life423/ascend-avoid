import { ARENA_RULES, EXHALE } from '../constants/gameConstants.js';
import { bodyMass } from './creatureSize.js';
import type { Box } from './movement.js';

/** Brief air drift adds to walking; it never switches a creature into a locked skid. */
export function puffDrift(box: Box, velocity: { x: number; y: number }, seconds: number, worldWidth: number, worldHeight: number, drag: number = EXHALE.DRAG): void {
  const slow = Math.exp(-drag * seconds), travel = (1 - slow) / drag;
  const margin = ARENA_RULES.EDGE_MARGIN;
  const x = box.x + velocity.x * travel, y = box.y + velocity.y * travel;
  box.x = Math.max(margin, Math.min(x, worldWidth - box.width - margin));
  box.y = Math.max(margin, Math.min(y, worldHeight - box.height - margin));
  velocity.x = box.x === x ? velocity.x * slow : 0;
  velocity.y = box.y === y ? velocity.y * slow : 0;
  if (Math.abs(velocity.x) < 1) velocity.x = 0;
  if (Math.abs(velocity.y) < 1) velocity.y = 0;
}

export interface PuffBody { id: string; width: number; falloff: number }
/** Rear wind has a separate finite budget; its recipients can always walk and turn. */
export function rearGustImpulses(width: number, targets: readonly PuffBody[]): { id: string; impulse: number; velocity: number }[] {
  const base = puffImpulses(width, targets);
  return base.hits.map(hit => {
    const scale = Math.min(EXHALE.REAR_IMPULSE_SCALE, EXHALE.REAR_SPEED_CAP / Math.max(1e-9, hit.velocity));
    return { id: hit.id, velocity: hit.velocity * scale, impulse: hit.impulse * scale };
  });
}
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
