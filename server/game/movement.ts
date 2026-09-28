import { ARENA_RULES } from "../constants/gameConstants.js";

export type Direction = "up" | "down" | "left" | "right";
export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

/** Which movement keys are held (or, for newPresses, were just pressed) */
export type Keys = Record<Direction, boolean>;

/** Seconds until the next repeat hop, per direction, while that direction is held */
export type HopTimers = Record<Direction, number>;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const NO_KEYS: Keys = { up: false, down: false, left: false, right: false };

export function newHopTimers(): HopTimers {
  return { up: 0, down: 0, left: 0, right: 0 };
}

/** Keys that went from released to pressed between two snapshots */
export function newPresses(before: Keys, after: Keys): Keys {
  return {
    up: after.up && !before.up,
    down: after.down && !before.down,
    left: after.left && !before.left,
    right: after.right && !before.right,
  };
}

/**
 * Which hops happen this frame: pressing a direction hops right away, and holding it keeps
 * hopping, the first repeat after HOP_REPEAT_DELAY seconds and then every HOP_REPEAT.
 * The browser runs this and tells the server about each hop.
 */
export function hopsThisFrame(held: Keys, presses: Keys, timers: HopTimers, deltaTime: number): Direction[] {
  const { HOP_REPEAT_DELAY, HOP_REPEAT } = ARENA_RULES;
  const hops: Direction[] = [];
  for (const direction of DIRECTIONS) {
    if (presses[direction]) {
      hops.push(direction);
      timers[direction] = HOP_REPEAT_DELAY;
    } else if (held[direction]) {
      timers[direction] -= deltaTime;
      if (timers[direction] <= 0) {
        hops.push(direction);
        // After a long frame, carry on at the normal rhythm rather than catching up
        timers[direction] = Math.max(timers[direction] + HOP_REPEAT, HOP_REPEAT / 2);
      }
    } else {
      timers[direction] = 0;
    }
  }
  return hops;
}

/** Move one hop in a direction, staying inside the world. The server and the browser both use this. */
export function hop(player: Box, direction: Direction, worldWidth: number, worldHeight: number): void {
  const { HOP, EDGE_MARGIN } = ARENA_RULES;
  if (direction === "up") player.y -= HOP;
  else if (direction === "down") player.y += HOP;
  else if (direction === "left") player.x -= HOP;
  else player.x += HOP;
  player.x = Math.max(EDGE_MARGIN, Math.min(player.x, worldWidth - player.width - EDGE_MARGIN));
  player.y = Math.max(EDGE_MARGIN, Math.min(player.y, worldHeight - player.height - EDGE_MARGIN));
}
