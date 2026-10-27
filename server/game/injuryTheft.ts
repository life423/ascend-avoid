import type { PlayerSchema } from '../schema/PlayerSchema.js';
/** A continuation belongs to this attacker and this injury, not to late arrivals. */
export function theftWindowAllows(thief: PlayerSchema, victim: PlayerSchema, time: number): boolean {
  return victim.injuredUntil > time || victim.injuredUntil > 0 && thief.theftContinuations.get(victim.sessionId) === victim.injuredUntil;
}
