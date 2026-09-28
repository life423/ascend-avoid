import { ARENA_RULES } from "../constants/gameConstants.js";

/** Which movement keys are held (or, for newPresses, were just pressed) */
export interface Keys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const NO_KEYS: Keys = { up: false, down: false, left: false, right: false };

/** Keys that went from released to pressed between two snapshots. Each press is one hop. */
export function newPresses(before: Keys, after: Keys): Keys {
  return {
    up: after.up && !before.up,
    down: after.down && !before.down,
    left: after.left && !before.left,
    right: after.right && !before.right,
  };
}

/**
 * Move a player the way solo play does (src/entities/Player.move): each key press is one
 * hop, and holding up also drifts you upward. The server and the client both use this, so
 * the client's instant prediction of your own moves matches what the server decides.
 */
export function movePlayer(
  player: Box,
  hops: Keys,
  holdingUp: boolean,
  deltaTime: number,
  arenaWidth: number,
  arenaHeight: number
): void {
  const { HOP, ASCEND_SPEED, TOP_LINE, SIDE_MARGIN, BOTTOM_MARGIN } = ARENA_RULES;
  if (holdingUp && player.y > TOP_LINE) player.y -= ASCEND_SPEED * deltaTime;
  if (hops.up && player.y > TOP_LINE - player.height / 2) player.y -= HOP;
  if (hops.down && player.y + player.height <= arenaHeight - BOTTOM_MARGIN) player.y += HOP;
  if (hops.right && player.x < arenaWidth - player.width - SIDE_MARGIN) player.x += HOP;
  if (hops.left && player.x > SIDE_MARGIN) player.x -= HOP;
  player.x = Math.max(0, Math.min(player.x, arenaWidth - player.width));
  player.y = Math.max(TOP_LINE, Math.min(player.y, arenaHeight - player.height));
}
