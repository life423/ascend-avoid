import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { closestFloorPoint, isFloor, jackpotSpot, layoutToString, pickLayout } from "../game/layouts.js";
import { moveTurbinesOntoFloor } from "./turbines.js";
import { reshuffleLanes } from "./traffic.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { PLAYER_STATE, SHIFT } = GAME_CONSTANTS;
import { updateJackpot } from "./gems.js";

/** Run the arena shift: start it when it's due, move through its phases, and bring the arena back */
export function updateShift(state: GameState, deltaTime: number, now: number) : void {
  // Switched off: the arena stays whole, so no warnings, grace, drop, showers or jackpot
  if (!state.shiftsOn) return;
  if (state.time >= state.phaseEndsAt) {
    if (state.shiftPhase === "normal") startGrace(state, now);
    else if (state.shiftPhase === "grace") startShift(state);
    else endShift(state);
    return;
  }
  if (state.shiftPhase !== "shift" || !state.layout) return;
  const left = state.phaseEndsAt - state.time;
  if (state.time >= state.nextShowerAt) {
    state.nextShowerAt = state.time + SHIFT.SHOWER_EVERY_MS;
    // Richer as the shift goes on: 1-gem drops, then 2, then 3
    const progress = 1 - left / SHIFT.SHIFT_MS;
    state.dropGems(SHIFT.SHOWER_GEMS, progress < 1 / 3 ? 1 : progress < 2 / 3 ? 2 : 3, now);
  }
  if (!state.jackpotDropped && left <= SHIFT.JACKPOT_DROPS_WITH_MS_LEFT) {
    const spot = jackpotSpot(state.layout);
    state.dropJackpot(spot.x, spot.y, SHIFT.DROP_MS * 1.5);
  }
  updateJackpot(state, deltaTime);
}

/** Show the new shape. Nobody can be hurt while everyone gets onto it, and gems drop there to lead the way */
export function startGrace(state: GameState, now: number) : void {
  // New traffic patterns too, so nobody memorizes them
  reshuffleLanes(state);
  const people: { x: number; y: number }[] = [];
  state.players.forEach((player) => {
    if (player.state === PLAYER_STATE.ALIVE) people.push({ x: player.x + player.width / 2, y: player.y + player.height / 2 });
  });
  const picked = pickLayout(people, state.players.size, state.lastLayoutName);
  state.layout = picked.layout;
  state.lastLayoutName = picked.name;
  state.floor = layoutToString(picked.layout);
  state.shiftPhase = "grace";
  state.phaseEndsAt = state.time + SHIFT.GRACE_MS;
  state.dropGems(SHIFT.GRACE_GEMS, 1, now);
  moveTurbinesOntoFloor(state);
}

/** The rest of the arena drops away; gems lying out there move onto the floor */
export function startShift(state: GameState) : void {
  state.shiftPhase = "shift";
  state.phaseEndsAt = state.time + SHIFT.SHIFT_MS;
  state.nextShowerAt = state.time + SHIFT.SHOWER_EVERY_MS;
  state.jackpotDropped = false;
  const layout = state.layout;
  if (!layout) return;
  state.gems.forEach((gem) => {
    if (isFloor(layout, gem.x, gem.y)) return;
    const spot = closestFloorPoint(layout, gem.x, gem.y);
    gem.moveTo(spot.x, spot.y);
  });
}

/** The whole arena comes back, until the next shift */
export function endShift(state: GameState) : void {
  state.shiftPhase = "normal";
  state.phaseEndsAt = state.time + SHIFT.EVERY_MS;
  state.layout = null;
  state.floor = "";
  state.jackpotOn = false;
  state.jackpotHolder = "";
  state.jackpotProgress = 0;
}

/**
 * Over the edge during a shift: it counts as a hit. With gems, half of them burst out and the
 * player lands back on the nearest floor, blinking; with none, they're knocked out.
 */
export function fall(state: GameState, player: PlayerSchema, now: number) : void {
  state.credit(player, "edge", now);
  if (player.gems <= 0 || !state.layout) {
    player.knockOut(now);
    return;
  }
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  const spot = closestFloorPoint(state.layout, centerX, centerY);
  player.placeAt(spot.x - player.width / 2, spot.y - player.height / 2);
  // Skidding onward, away from the edge
  state.hitPlayer(player, now, { x: spot.x - centerX, y: spot.y - centerY });
}
