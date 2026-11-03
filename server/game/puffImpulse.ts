import { ARENA_RULES, EXHALE } from '../constants/gameConstants.js';
import { bodyMass } from './creatureSize.js';
import type { Box } from './movement.js';
import { constrainArena } from './arenaBoundary.js';

/** Brief air drift adds to walking; it never switches a creature into a locked skid. */
export function puffDrift(box: Box, velocity: { x: number; y: number }, seconds: number, worldWidth: number, worldHeight: number, drag: number = EXHALE.DRAG): void {
  const slow = Math.exp(-drag * seconds), travel = (1 - slow) / drag;
  box.x += velocity.x * travel;
  box.y += velocity.y * travel;
  constrainArena(box, worldWidth, worldHeight, velocity);
  velocity.x *= slow;
  velocity.y *= slow;
  if (Math.abs(velocity.x) < 1) velocity.x = 0;
  if (Math.abs(velocity.y) < 1) velocity.y = 0;
}

export interface PuffBody { id: string; width: number; falloff: number }
/** A confirmed rear hit can bank its unboosted recoil against a nearby wall.
 * The existing drag distance bounds both wall proximity and slip travel. There
 * is no recoil in open space, without tangent input, or without a hit budget.
 */
export function rearWallSlip(box: Box, speed: number, input: { x: number; y: number }, worldWidth: number, worldHeight: number): ReturnType<typeof wallPuffRecoil> {
  if (speed <= 0) return { x: 0, y: 0, redirected: false };
  const probe = { x: box.x, y: box.y, width: box.width, height: box.height };
  const wall = constrainArena(probe, worldWidth, worldHeight, undefined, ARENA_RULES.EDGE_MARGIN + speed / EXHALE.DRAG);
  if (!wall.hit) return { x: 0, y: 0, redirected: false };
  const slip = wallPuffRecoil(box, { x: wall.nx * speed, y: wall.ny * speed }, input, worldWidth, worldHeight);
  // Only the banked tangent is granted; never attract the creature to the wall.
  if (!slip.redirected) return { x: 0, y: 0, redirected: false };
  return { x: slip.slideX ?? 0, y: slip.slideY ?? 0, redirected: true, slideX: slip.slideX, slideY: slip.slideY };
}
/** A wall can redirect blocked recoil from a valid hit, never add impulse or create an empty-puff dash. */
export function wallPuffRecoil(box: Box, recoil: { x: number; y: number }, input: { x: number; y: number }, worldWidth: number, worldHeight: number): { x: number; y: number; redirected: boolean; slideX?: number; slideY?: number } {
  const end = { x: box.x + recoil.x / EXHALE.DRAG, y: box.y + recoil.y / EXHALE.DRAG, width: box.width, height: box.height };
  const contact = constrainArena(end, worldWidth, worldHeight);
  const speed = Math.hypot(recoil.x, recoil.y);
  if (!contact.hit || !speed) return { ...recoil, redirected: false };
  const usable = { x: (end.x - box.x) * EXHALE.DRAG, y: (end.y - box.y) * EXHALE.DRAG };
  const blocked = Math.hypot(recoil.x - usable.x, recoil.y - usable.y);
  const tx = -contact.ny, ty = contact.nx, intent = input.x * tx + input.y * ty;
  if (Math.abs(intent) <= EXHALE.WALL_SLIP_INPUT) return { ...recoil, redirected: false };
  const candidate = { x: usable.x + tx * Math.sign(intent) * blocked, y: usable.y + ty * Math.sign(intent) * blocked };
  const scale = Math.min(1, speed / Math.max(1e-9, Math.hypot(candidate.x, candidate.y)));
  const at = { x: box.x + candidate.x * scale / EXHALE.DRAG, y: box.y + candidate.y * scale / EXHALE.DRAG, width: box.width, height: box.height };
  constrainArena(at, worldWidth, worldHeight);
  const next = { x: (at.x - box.x) * EXHALE.DRAG, y: (at.y - box.y) * EXHALE.DRAG };
  const capped = Math.min(1, speed / Math.max(1e-9, Math.hypot(next.x, next.y)));
  next.x *= capped; next.y *= capped;
  if (next.x * input.x + next.y * input.y <= usable.x * input.x + usable.y * input.y + 1e-9)
    return { ...recoil, redirected: false };
  return { ...next, redirected: true, slideX: next.x - usable.x, slideY: next.y - usable.y };
}

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
