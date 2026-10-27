import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import type { PinwheelSchema, WeaponPartSchema } from '../schema/PinwheelSchema.js';
import { INHALE, PINWHEEL } from '../constants/gameConstants.js';
import { allWeapons } from '../game/weaponKit.js';

/** Losing cargo or contact always starts the next attempt from zero. */
export function resetPartTheft(part: WeaponPartSchema): void { part.theftBy = ''; part.theftMs = 0; }
function freeBuildSlot(state: GameState, thief: PlayerSchema, set: PinwheelSchema): boolean {
  return !allWeapons(state).some(w => w !== set && w.owner === thief.sessionId && (w.phase === 'parts' || w.phase === 'carried'));
}
function transfer(state: GameState, w: PinwheelSchema, part: WeaponPartSchema, thief: PlayerSchema, victim: PlayerSchema): void {
  for (const p of w.parts) { p.owner = thief.sessionId; p.carriedBy = ''; resetPartTheft(p); p.vx = p.vy = 0; }
  part.carriedBy = thief.sessionId;
  w.owner = thief.sessionId; w.progress = 1 << part.kind; w.claimUntil = state.time + PINWHEEL.CLAIM_MS; w.claimedAt = state.time;
  thief.dropProtection();
  state.onEvent?.('weaponTheft', { byId: thief.sessionId, by: thief.name, fromId: victim.sessionId, from: victim.name, kind: w.kind, part: part.kind });
}

/** Cargo can be stolen from a healthy carrier; loose reserved siblings cannot be taken by contact. */
export function tryPartTheft(state: GameState, w: PinwheelSchema, part: WeaponPartSchema, victim: PlayerSchema, dt: number, now: number): void {
  if (w.phase !== 'parts' || w.owner !== victim.sessionId || part.carriedBy !== victim.sessionId || victim.state !== 'alive' || victim.capturedBy || victim.flying) { resetPartTheft(part); return; }
  let nearest = Infinity, chosen: PlayerSchema | undefined;
  if (!victim.spawnProtected && now >= victim.suctionSafeUntil) for (const thief of state.players.values()) {
    if (thief === victim || !thief.inhaling || thief.state !== 'alive' || thief.stunned || thief.capturedBy || thief.gulping || thief.flying || thief.followActive || !freeBuildSlot(state, thief, w)) continue;
    const fx = Math.cos(thief.facing), fy = Math.sin(thief.facing);
    const dx = part.x - thief.x - thief.width * .5 - fx * thief.width * .3;
    const dy = part.y - thief.y - thief.height * .5 - fy * thief.width * .3;
    const d = Math.hypot(dx, dy), reach = Math.min(240, INHALE.REACH + thief.width * INHALE.REACH_PER_SIZE);
    // Use ordinary part-contact distance in the near field. Suction can bring cargo
    // behind the mouth point while it still touches the inhaler's physical body.
    const touching = Math.hypot(part.x - thief.x - thief.width / 2, part.y - thief.y - thief.height / 2) <= thief.width / 2 + PINWHEEL.PART_RADIUS;
    if (d > reach || (!touching && d > 1 && (dx * fx + dy * fy) / d < Math.cos(INHALE.ARC * Math.PI / 180))) continue;
    if (d < nearest) { nearest = d; chosen = thief; }
  }
  if (!chosen) { resetPartTheft(part); return; }
  if (part.theftBy !== chosen.sessionId) { part.theftBy = chosen.sessionId; part.theftMs = 0; }
  part.theftMs += dt * 1000;
  if (part.theftMs >= PINWHEEL.PART_THEFT_MS) transfer(state, w, part, chosen, victim);
}

/** A successful capture completes the close inhale; take one cargo piece if the captor has room. */
export function stealCapturedPart(state: GameState, thief: PlayerSchema, victim: PlayerSchema): void {
  for (const w of allWeapons(state)) {
    if (w.phase !== 'parts' || w.owner !== victim.sessionId || !freeBuildSlot(state, thief, w)) continue;
    const part = w.parts.find(p => p.carriedBy === victim.sessionId);
    if (part) { transfer(state, w, part, thief, victim); return; }
  }
}
