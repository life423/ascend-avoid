import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { ARENA_RULES, PLAYER_STATE } = GAME_CONSTANTS;

/** Soft contact permits compression and sliding while both creatures retain steering. */
export function keepApart(state: GameState, player: PlayerSchema) : void {
  if (player.state !== PLAYER_STATE.ALIVE) return;
  state.players.forEach((other) => {
    if (other === player || other.state !== PLAYER_STATE.ALIVE) return;
    // A captive is held where its captor's mouth puts it (see holdCaptive), not pushed off its body
    if (other.capturedBy === player.sessionId || player.capturedBy === other.sessionId) return;
    const dx = other.x + other.width / 2 - (player.x + player.width / 2);
    const dy = other.y + other.height / 2 - (player.y + player.height / 2);
    const distance = Math.hypot(dx, dy);
    const overlap = (player.width + other.width) / 2 - distance;
    if (overlap <= -ARENA_RULES.CONTACT_TOUCH) return;
    const nx = distance > 1e-6 ? dx / distance : 1;
    const ny = distance > 1e-6 ? dy / distance : 0;
    // A little contact friction while pressed together; moving away peels off freely.
    const stepX = player.x + player.width / 2 - player.tickX;
    const stepY = player.y + player.height / 2 - player.tickY;
    const stepToward = stepX * nx + stepY * ny;
    const step = Math.hypot(stepX, stepY);
    if (step > 1e-6 && stepToward >= -0.2 * step) {
      const grip = ARENA_RULES.CONTACT_GRIP;
      player.nudge(-(stepX - stepToward * nx) * grip, -(stepY - stepToward * ny) * grip, state.worldWidth, state.worldHeight);
    }
    // Soft bodies: a little squish before they push back hard
    const excess = overlap - ARENA_RULES.CONTACT_SQUISH * Math.min(player.width, other.width);
    if (excess <= 0) return;
    // How far each moved (or grew) toward the other this tick
    const mine = Math.max(0, (player.x + player.width / 2 - player.tickX) * nx + (player.y + player.height / 2 - player.tickY) * ny + player.width / 2 - player.tickRadius);
    const theirs = Math.max(0, -((other.x + other.width / 2 - other.tickX) * nx + (other.y + other.height / 2 - other.tickY) * ny) + other.width / 2 - other.tickRadius);
    // Whoever moved (or grew) into the other gives way; when both push, the lighter one gives way more
    // (mass only decides it when both are walking into each other: not growing, not being pulled)
    const movedIn = (player.x + player.width / 2 - player.tickX) * nx + (player.y + player.height / 2 - player.tickY) * ny;
    const theyMovedIn = -((other.x + other.width / 2 - other.tickX) * nx + (other.y + other.height / 2 - other.tickY) * ny);
    const walking = player.velocity();
    const theirWalking = other.velocity();
    const bothPush = walking.x * nx + walking.y * ny > 1 && -(theirWalking.x * nx + theirWalking.y * ny) > 1 && movedIn > 0 && theyMovedIn > 0;
    const mineHeavy = bothPush ? movedIn * other.width * other.width : mine;
    const theirsHeavy = bothPush ? theyMovedIn * player.width * player.width : theirs;
    // Scale separation: something enormous walking into something tiny pushes it aside instead of being stopped (being pulled never shoves)
    const dwarfs = player.width >= other.width * ARENA_RULES.SCALE_SHOVE_RATIO && walking.x * nx + walking.y * ny > 1;
    const dwarfed = other.width >= player.width * ARENA_RULES.SCALE_SHOVE_RATIO && -(theirWalking.x * nx + theirWalking.y * ny) > 1;
    const share = dwarfs ? 0 : dwarfed ? 1 : mineHeavy + theirsHeavy > 1e-6 ? mineHeavy / (mineHeavy + theirsHeavy) : 0.5;
    player.nudge(-nx * excess * share, -ny * excess * share, state.worldWidth, state.worldHeight);
    other.nudge(nx * excess * (1 - share), ny * excess * (1 - share), state.worldWidth, state.worldHeight);
    if (mine > 0 && !dwarfs) player.blockAlong(nx, ny);
    if (theirs > 0 && !dwarfed) other.blockAlong(-nx, -ny);
  });
}
