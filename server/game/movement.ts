import { ARENA_RULES, FACING } from "../constants/gameConstants.js";

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

/** Top speed for a creature this wide: quick when small, slowing smoothly as it grows (no floor or ceiling) */
export function moveSpeed(width: number): number {
  return ARENA_RULES.MOVE_SPEED * Math.pow(ARENA_RULES.PLAYER_SIZE / Math.max(ARENA_RULES.PLAYER_SIZE, width), ARENA_RULES.SPEED_FALLOFF);
}

/**
 * One step of walking, the same on the server and in the browser: velocity eases toward where
 * you're steering (so you start and stop smoothly), or holds a dash's velocity, then the box moves,
 * staying inside the world. `steer` is no longer than 1; a light push walks slower.
 */
export function walk(
  box: Box,
  velocity: { x: number; y: number },
  steer: { x: number; y: number },
  deltaTime: number,
  worldWidth: number,
  worldHeight: number,
  dash: { x: number; y: number } | null = null
): void {
  const speed = moveSpeed(box.width);
  if (dash) {
    velocity.x = dash.x;
    velocity.y = dash.y;
  } else {
    // Coming out of a dash, drop straight back to walking speed
    const current = Math.hypot(velocity.x, velocity.y);
    if (current > speed) {
      velocity.x *= speed / current;
      velocity.y *= speed / current;
    }
    const blend = 1 - Math.exp(-ARENA_RULES.MOVE_RESPONSE * deltaTime);
    velocity.x += (steer.x * speed - velocity.x) * blend;
    velocity.y += (steer.y * speed - velocity.y) * blend;
    if (steer.x === 0 && Math.abs(velocity.x) < 2) velocity.x = 0;
    if (steer.y === 0 && Math.abs(velocity.y) < 2) velocity.y = 0;
  }
  const margin = ARENA_RULES.EDGE_MARGIN;
  box.x = Math.max(margin, Math.min(box.x + velocity.x * deltaTime, worldWidth - box.width - margin));
  box.y = Math.max(margin, Math.min(box.y + velocity.y * deltaTime, worldHeight - box.height - margin));
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

/** How fast a creature turns (radians a second): small ones whip around, big ones still quickly enough to defend */
export function turnRate(width: number): number {
  return FACING.TURN_SMALL * Math.pow(ARENA_RULES.PLAYER_SIZE / Math.max(ARENA_RULES.PLAYER_SIZE, width), FACING.TURN_FALLOFF);
}

/** Turn from one heading toward another (radians), by at most `step` the short way round */
export function turnToward(current: number, target: number, step: number): number {
  const diff = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  if (Math.abs(diff) <= step) return target;
  return current + Math.sign(diff) * step;
}
