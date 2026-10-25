import { INHALE, PLAYER_STATE } from '../constants/gameConstants.js';
import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';

/** Shared by movement and mouth decisions: healthy targets are useful only if capturable. */
export function botPreyAvailable(world: GameState, bot: PlayerSchema, other: PlayerSchema, now: number): boolean {
  if (other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.capturedBy || other.flying || now < other.suctionSafeUntil) return false;
  return (other.width * INHALE.EAT_RATIO <= bot.width && now >= other.recaptureAfter)
    || (other.gems > 0 && world.time < other.injuredUntil);
}

/** Observable incoming theft, nearest first; ignore stale robbery markers and active shields. */
export function botRobber(world: GameState, bot: PlayerSchema, now: number): PlayerSchema | null {
  if (world.time >= bot.injuredUntil || bot.spawnProtected || now < bot.suctionSafeUntil) return null;
  let nearest: PlayerSchema | null = null, distance = Infinity;
  world.players.forEach(other => {
    if (other === bot || other.state !== PLAYER_STATE.ALIVE || !other.inhaling || other.flying || other.capturedBy || !other.robbing.split(',').includes(bot.sessionId)) return;
    const d = Math.hypot(other.x + other.width / 2 - bot.x - bot.width / 2, other.y + other.height / 2 - bot.y - bot.height / 2);
    if (d < distance) { nearest = other; distance = d; }
  });
  return nearest;
}
