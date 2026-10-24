import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { GemSchema } from "../schema/GemSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { GEMS, PLAYER_STATE, SHIFT } = GAME_CONSTANTS;

/**
 * The jackpot goes to whoever stands on it alone for JACKPOT_CLAIM_MS. A shove starts their
 * claim over, and while two or more are on it, nobody's claim moves.
 */
export function updateJackpot(state: GameState, deltaTime: number) : void {
  if (!state.jackpotOn || state.time < state.jackpotLandsAt) return;
  const on: PlayerSchema[] = [];
  state.players.forEach((player) => {
    if (player.state !== PLAYER_STATE.ALIVE || player.capturedBy || player.flying || player.stunned || player.sliding) return;
    const box = player.hitBox();
    const dx = Math.max(box.x - state.jackpotX, 0, state.jackpotX - (box.x + box.width));
    const dy = Math.max(box.y - state.jackpotY, 0, state.jackpotY - (box.y + box.height));
    if (Math.hypot(dx, dy) <= SHIFT.JACKPOT_RADIUS) on.push(player);
  });
  if (on.length === 0) {
    if (state.jackpotHolder) state.jackpotHolder = "";
    if (state.jackpotProgress) state.jackpotProgress = 0;
    return;
  }
  if (on.length > 1) return;
  const claimant = on[0];
  if (claimant.sessionId !== state.jackpotHolder || claimant.sliding) {
    state.jackpotHolder = claimant.sessionId;
    state.jackpotProgress = 0;
    if (claimant.sliding) return;
  }
  state.jackpotProgress = Math.min(1, state.jackpotProgress + (deltaTime * 1000) / SHIFT.JACKPOT_CLAIM_MS);
  if (state.jackpotProgress < 1) return;
  claimant.setGems(claimant.gems + SHIFT.JACKPOT_VALUE, state.worldWidth, state.worldHeight);
  state.jackpotOn = false;
  state.onEvent?.("jackpot", { byId: claimant.sessionId, by: claimant.name, value: SHIFT.JACKPOT_VALUE });
}

/** Keep the field stocked: every gem picked up reappears somewhere else */
export function topUpField(state: GameState) : void {
  while (state.fieldGems < state.fieldGemTarget && state.gems.size < GEMS.MAX_GEMS) state.addGem();
}

/** Pick up every gem the player is touching */
export function collectGems(state: GameState, player: PlayerSchema, now: number, fromX = player.x, fromY = player.y) : void {
  // Everything the player passed over this tick counts, so a skid can't skip a gem
  // (unless they were moved somewhere else entirely, like a respawn)
  const moved = Math.hypot(player.x - fromX, player.y - fromY);
  const path = moved > 300
    ? player
    : {
        x: Math.min(fromX, player.x),
        y: Math.min(fromY, player.y),
        width: player.width + Math.abs(player.x - fromX),
        height: player.height + Math.abs(player.y - fromY),
      };
  let collected = 0;
  const taken: string[] = [];
  state.gems.forEach((gem, id) => {
    if (!gem.touches(path, now, player.sessionId)) return;
    collected += gem.value;
    taken.push(id);
    if (!gem.sprayed) state.fieldGems--;
  });
  if (collected === 0) return;
  taken.forEach((id) => state.gems.delete(id));
  player.setGems(player.gems + collected, state.worldWidth, state.worldHeight);
}

/** Burst gems outward from a point, spread around the circle; big piles make bigger gems */
export function sprayGems(state: GameState, centerX: number, centerY: number, total: number, now: number, owner = "") : void {
  // Browsers draw a burst for anything more than a gem or two
  if (total >= 3) state.onEvent?.("burst", { x: Math.round(centerX), y: Math.round(centerY), count: total });
  const room = Math.max(1, GEMS.MAX_GEMS - state.gems.size);
  const pieces = Math.min(total, GEMS.SPRAY_PIECES, room);
  const turn = Math.random() * Math.PI * 2;
  for (let i = 0; i < pieces; i++) {
    const value = Math.floor(total / pieces) + (i < total % pieces ? 1 : 0);
    const gem = new GemSchema(centerX, centerY, value);
    const angle = turn + (i / pieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = GEMS.SPRAY_SPEED_MIN + Math.random() * (GEMS.SPRAY_SPEED_MAX - GEMS.SPRAY_SPEED_MIN);
    gem.spray(angle, speed, now, owner);
    state.gems.set(`g${state.nextGemId++}`, gem);
  }
}
