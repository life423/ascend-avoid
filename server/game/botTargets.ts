import { injuryVulnerable, stealWeight } from '../systems/inhale.js';
import { theftWindowAllows } from './injuryTheft.js';
import { BOTS, INHALE, PLAYER_STATE } from '../constants/gameConstants.js';
import { airflowQuality } from './airflow.js';
import { canCatch } from './cannon.js';
import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';

/** Shared by movement and mouth decisions: healthy targets are useful only if capturable. */
export function botPreyAvailable(world: GameState, bot: PlayerSchema, other: PlayerSchema, now: number): boolean {
  if (other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.capturedBy || other.flying || now < other.suctionSafeUntil) return false;
  if (injuryVulnerable(world, bot)) return false;
  return (other.width * INHALE.EAT_RATIO <= bot.width && now >= other.recaptureAfter)
    || (other.gems > 0 && theftWindowAllows(other, world.time));
}

/** Proactive caution before an idle predator starts inhaling. Preserve the
 * existing nearby-body warning, but also recognize its actual mouth-facing
 * reach against this bot's radius. The small existing safety margin supplies
 * a warning at the tip; this does not change real inhale geometry or forces.
 */
export function botCaptureThreat(world: GameState, bot: PlayerSchema): { player: PlayerSchema; distance: number } | null {
  const cx = bot.x + bot.width / 2, cy = bot.y + bot.height / 2;
  let nearest: { player: PlayerSchema; distance: number } | null = null;
  world.players.forEach(other => {
    if (other === bot || other.state !== PLAYER_STATE.ALIVE || !canCatch(other.width, bot.width) || injuryVulnerable(world, other)) return;
    const distance = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy) - other.width / 2;
    const nearby = distance < BOTS.FLEE_RANGE;
    const mouthThreat = !nearby && !other.capturedBy && !other.flying && !other.gulping
      && airflowQuality(world.mouthed(other), { x: cx, y: cy, width: bot.width + 2 * BOTS.SAFETY_MARGIN }) > 0;
    if ((nearby || mouthThreat) && (!nearest || distance < nearest.distance)) nearest = { player: other, distance };
  });
  return nearest;
}

/** Visible, eligible incoming suction, nearest first; do not wait for the first stolen gem. */
export function botSuctionThreat(world: GameState, bot: PlayerSchema, now: number): PlayerSchema | null {
  if (bot.spawnProtected || now < bot.suctionSafeUntil || bot.flying || bot.capturedBy) return null;
  let nearest: PlayerSchema | null = null, distance = Infinity;
  world.players.forEach(other => {
    if (other === bot || other.state !== PLAYER_STATE.ALIVE || !other.inhaling || other.flying || other.capturedBy || other.gulping || stealWeight(world, other, bot) <= 0) return;
    const d = Math.hypot(other.x + other.width / 2 - bot.x - bot.width / 2, other.y + other.height / 2 - bot.y - bot.height / 2);
    if (d < distance) { nearest = other; distance = d; }
  });
  return nearest;
}
