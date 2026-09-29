import { ARENA_RULES, GEMS } from "../constants/gameConstants.js";

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
 * hopping, the first repeat after HOP_REPEAT_DELAY seconds and then every `repeat` seconds
 * (bigger players keep a slower rhythm). The browser runs this and tells the server about each hop.
 */
export function hopsThisFrame(
  held: Keys,
  presses: Keys,
  timers: HopTimers,
  deltaTime: number,
  repeat: number = ARENA_RULES.HOP_REPEAT
): Direction[] {
  const { HOP_REPEAT_DELAY } = ARENA_RULES;
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
        timers[direction] = Math.max(timers[direction] + repeat, repeat / 2);
      }
    } else {
      timers[direction] = 0;
    }
  }
  return hops;
}

/** How far one hop goes for a player this wide: HOP while small, then a little more than your own size */
export function hopLength(width: number): number {
  return Math.max(ARENA_RULES.HOP, width + ARENA_RULES.HOP_BEYOND_SIZE);
}

/**
 * A hop that runs into someone stops against them instead of passing over (a small player could
 * otherwise hop clean over another). Moves `box` back to the contact point and returns which of
 * `others` it ran into (the first along the hop), or -1. The server and the browser both use this.
 */
export function stopAgainst(box: Box, direction: Direction, fromX: number, fromY: number, others: Box[]): number {
  const path = {
    x: Math.min(fromX, box.x),
    y: Math.min(fromY, box.y),
    width: box.width + Math.abs(box.x - fromX),
    height: box.height + Math.abs(box.y - fromY),
  };
  let hit = -1;
  let nearest = Infinity;
  for (let i = 0; i < others.length; i++) {
    const o = others[i];
    if (!(path.x < o.x + o.width && path.x + path.width > o.x && path.y < o.y + o.height && path.y + path.height > o.y)) continue;
    const along =
      direction === "right" ? o.x - fromX : direction === "left" ? fromX - o.x : direction === "down" ? o.y - fromY : fromY - o.y;
    if (along < nearest) {
      nearest = along;
      hit = i;
    }
  }
  if (hit < 0) return -1;
  const o = others[hit];
  if (direction === "right") box.x = Math.max(fromX, Math.min(box.x, o.x - box.width));
  else if (direction === "left") box.x = Math.min(fromX, Math.max(box.x, o.x + o.width));
  else if (direction === "down") box.y = Math.max(fromY, Math.min(box.y, o.y - box.height));
  else box.y = Math.min(fromY, Math.max(box.y, o.y + o.height));
  return hit;
}

/** Seconds between hops while holding a direction: six a second when small, four at full size */
export function holdRepeat(width: number): number {
  const growth = Math.max(0, Math.min(1, (width - ARENA_RULES.PLAYER_SIZE) / (GEMS.MAX_SIZE - ARENA_RULES.PLAYER_SIZE)));
  return ARENA_RULES.HOP_REPEAT * (1 + 0.5 * growth);
}

/**
 * Move one hop in a direction, staying inside the world. Hops grow with the player, so one hop
 * always clears your own body. The server and the browser both use this.
 */
export function hop(player: Box, direction: Direction, worldWidth: number, worldHeight: number, scale = 1): void {
  const { EDGE_MARGIN } = ARENA_RULES;
  // A dash is several hops' worth at once (scale)
  const length = hopLength(player.width) * scale;
  if (direction === "up") player.y -= length;
  else if (direction === "down") player.y += length;
  else if (direction === "left") player.x -= length;
  else player.x += length;
  player.x = Math.max(EDGE_MARGIN, Math.min(player.x, worldWidth - player.width - EDGE_MARGIN));
  player.y = Math.max(EDGE_MARGIN, Math.min(player.y, worldHeight - player.height - EDGE_MARGIN));
}
