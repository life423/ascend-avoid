import type { PlayerSchema } from '../schema/PlayerSchema.js';
/** An active injury is the only theft window; holding inhale never extends it. */
export function theftWindowAllows(victim: PlayerSchema, time: number): boolean {
  return victim.injuredUntil > time;
}
