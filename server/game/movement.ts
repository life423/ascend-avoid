import { ARENA_RULES, FACING } from "../constants/gameConstants.js";

export type Direction = "up" | "down" | "left" | "right";

/** Which movement keys are held */
export type Keys = Record<Direction, boolean>;

/** Seconds until the next repeat hop, per direction, while that direction is held */
export type HopTimers = Record<Direction, number>;

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Smaller bodies always walk faster; the legal size range needs no flat speed floor. */
export function moveSpeed(width: number): number {
  return ARENA_RULES.MOVE_SPEED * Math.pow(ARENA_RULES.PLAYER_SIZE / Math.max(ARENA_RULES.PLAYER_SIZE, width), ARENA_RULES.SPEED_FALLOFF);
}

/**
 * One step of walking, the same on the server and in the browser: velocity eases toward where
 * you're steering (so you start and stop smoothly), then the box moves, staying inside the world.
 * `steer` is no longer than 1; a light push walks slower.
 */
export function walk(
  box: Box,
  velocity: { x: number; y: number },
  steer: { x: number; y: number },
  deltaTime: number,
  worldWidth: number,
  worldHeight: number
): void {
  const speed = moveSpeed(box.width);
  // Never faster than your top speed (growing slows you at once)
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
  const margin = ARENA_RULES.EDGE_MARGIN;
  box.x = Math.max(margin, Math.min(box.x + velocity.x * deltaTime, worldWidth - box.width - margin));
  box.y = Math.max(margin, Math.min(box.y + velocity.y * deltaTime, worldHeight - box.height - margin));
}

/** How far one hop goes for a player this wide: HOP while small, then a little more than your own size */
export function hopLength(width: number): number {
  return Math.max(ARENA_RULES.HOP, width + ARENA_RULES.HOP_BEYOND_SIZE);
}

/**
 * Move one hop in a direction, staying inside the world. Hops grow with the player, so one hop
 * always clears your own body. The server and the browser both use this.
 */
export function hop(player: Box, direction: Direction, worldWidth: number, worldHeight: number, scale = 1): void {
  const { EDGE_MARGIN } = ARENA_RULES;
  // (scale: several hops' worth at once)
  const length = hopLength(player.width) * scale;
  if (direction === "up") player.y -= length;
  else if (direction === "down") player.y += length;
  else if (direction === "left") player.x -= length;
  else player.x += length;
  player.x = Math.max(EDGE_MARGIN, Math.min(player.x, worldWidth - player.width - EDGE_MARGIN));
  player.y = Math.max(EDGE_MARGIN, Math.min(player.y, worldHeight - player.height - EDGE_MARGIN));
}

/** How fast a creature can turn at most (radians a second): heavier creatures turn slower, and everyone turns slower while inhaling */
export function turnRate(width: number, inhaling = false): number {
  const light = ARENA_RULES.PLAYER_SIZE / Math.max(ARENA_RULES.PLAYER_SIZE, width);
  return FACING.TURN_RATE * Math.pow(light, FACING.TURN_FALLOFF) * (inhaling ? FACING.INHALE_TURN : 1);
}

/** How fast a creature's turning can build up or slow down (radians a second, each second): heavy ones are slow to start and slow to stop */
export function turnAccel(width: number): number {
  return FACING.TURN_ACCEL * Math.pow(ARENA_RULES.PLAYER_SIZE / Math.max(ARENA_RULES.PLAYER_SIZE, width), FACING.ACCEL_FALLOFF);
}

/**
 * One step of turning like a real body, the same on the server and in the browser: the spin
 * (radians a second) builds toward `target` at turnAccel, never past turnRate, easing off in time
 * to stop right on it; with no target (null) the spin dies away. Returns the new facing and spin.
 */
export function turnStep(facing: number, spin: number, target: number | null, width: number, inhaling: boolean, deltaTime: number): { facing: number; spin: number } {
  const accel = turnAccel(width);
  let want = 0;
  let diff = 0;
  if (target !== null) {
    diff = Math.atan2(Math.sin(target - facing), Math.cos(target - facing));
    want = Math.sign(diff) * Math.min(turnRate(width, inhaling), Math.sqrt(2 * accel * Math.abs(diff)));
  }
  const step = accel * deltaTime;
  const next = Math.abs(want - spin) <= step ? want : spin + Math.sign(want - spin) * step;
  // Arriving: stop right on the target instead of wobbling past it
  if (target !== null && Math.sign(next) === Math.sign(diff) && Math.abs(diff) <= Math.abs(next * deltaTime)) return { facing: target, spin: 0 };
  const turned = facing + next * deltaTime;
  return { facing: Math.atan2(Math.sin(turned), Math.cos(turned)), spin: next };
}
