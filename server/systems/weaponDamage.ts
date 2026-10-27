import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { PINWHEEL, WEAPON_FAIRNESS } from '../constants/gameConstants.js';
import { weaponHitPause } from '../game/weaponFairness.js';
import { sprayGems } from './gems.js';

/** Actual lost gems are paid once to the assembler, never both paid and spilled. */
export function weaponDamage(state: GameState, target: PlayerSchema, ownerId: string, amount: number, now: number, glancing = false): { lost: number; out: boolean; earned: number; blocked?: boolean } {
  if (state.time < target.weaponSafeUntil) return { lost: 0, out: false, earned: 0, blocked: true };
  const pause = weaponHitPause(target.width);
  if (glancing) amount = Math.max(1, Math.round(amount * WEAPON_FAIRNESS.GRAZE_DAMAGE_SHARE));
  const out = target.gems - amount < PINWHEEL.KO_GEMS;
  const lost = out ? target.gems : Math.min(target.gems, amount);
  const x = target.x + target.width / 2, y = target.y + target.height / 2;
  if (!out && lost > 0 && !glancing) target.injure(state.time);
  if (lost > 0 || out) target.weaponSafeUntil = state.time + pause;
  target.setGems(target.gems - lost, state.worldWidth, state.worldHeight);
  if (out) { target.knockOut(now); state.clearTheftFor(target.sessionId); }
  const builder = state.players.get(ownerId);
  if (builder && builder !== target) {
    builder.weaponDamage += lost;
    if (out) builder.weaponKnockouts++;
    if (builder.state === 'alive') builder.setGems(builder.gems + lost, state.worldWidth, state.worldHeight);
    else builder.pendingWeaponGems += lost;
  } else if (lost > 0) sprayGems(state, x, y, lost, now, target.sessionId);
  return { lost, out, earned: builder && builder !== target ? lost : 0 };
}
