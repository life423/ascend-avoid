import { GEMS, TURBINE } from "../constants/gameConstants.js";
import { moveSpeed } from "./movement.js";
import type { Box } from './movement.js';

/**
 * Turbine math shared by the server and every browser, so they all agree exactly: where a
 * turbine's exhaust points at any moment, and where a gem it fired is at any moment.
 */

/** Where the exhaust points at world time `time`: opposite the intake, sweeping across EXHAUST_SWEEP and back every EXHAUST_CYCLE_MS */
export function exhaustAngle(intake: number, sweepFrom: number, time: number): number {
  const swing = Math.sin(((time - sweepFrom) / TURBINE.EXHAUST_CYCLE_MS) * Math.PI * 2);
  return intake + Math.PI + (TURBINE.EXHAUST_SWEEP / 2) * swing;
}

/** How long (seconds) a gem fired at `speed` flies before it settles */
export function launchDuration(speed: number): number {
  return Math.log(Math.max(1, speed / TURBINE.LAUNCH_STOP_SPEED)) / GEMS.SPRAY_FRICTION;
}

/** Where a fired gem is `seconds` after leaving (x, y): slowing as it goes, bouncing off the world's walls */
export function launchPosition(
  x: number,
  y: number,
  angle: number,
  speed: number,
  seconds: number,
  worldWidth: number,
  worldHeight: number
): { x: number; y: number; done: boolean } {
  const total = launchDuration(speed);
  const t = Math.max(0, Math.min(seconds, total));
  const travelled = (speed * (1 - Math.exp(-GEMS.SPRAY_FRICTION * t))) / GEMS.SPRAY_FRICTION;
  const r = GEMS.RADIUS;
  return {
    x: fold(x + Math.cos(angle) * travelled, r, worldWidth - r),
    y: fold(y + Math.sin(angle) * travelled, r, worldHeight - r),
    done: seconds >= total,
  };
}

/** A position folded back into [lo, hi], as if it bounced off both ends */
function fold(value: number, lo: number, hi: number): number {
  const span = hi - lo;
  if (span <= 0) return lo;
  const period = span * 2;
  const m = (((value - lo) % period) + period) % period;
  return lo + (m <= span ? m : period - m);
}

/** How fast (units a second) a turbine's intake pulls a creature this wide whose edge is `gap` from it: TURBINE.PULL_RATIO times the creature's own top speed at the intake, easing (squared) to nothing at its reach */
export function intakePull(width: number, gap: number): number {
  const closeness = Math.max(0, 1 - gap / TURBINE.INTAKE_REACH);
  return moveSpeed(width) * (fitsTurbine(width) ? TURBINE.PULL_RATIO : 0.45) * closeness * closeness;
}

/** The narrowest visible throat, shared with rendering. Large creatures cannot use the comeback launch. */
export function fitsTurbine(width: number): boolean {
  return width <= TURBINE.OPENING_WIDTH;
}

/** Shared solid housing correction keeps prediction from drawing a creature inside the fan. */
export function turbineBodyPush(body: Box, turbine: { x: number; y: number; intake: number }): { x: number; y: number } {
  const dx = body.x + body.width / 2 - turbine.x, dy = body.y + body.height / 2 - turbine.y;
  const d = Math.hypot(dx, dy), overlap = TURBINE.BODY_RADIUS + body.width / 2 - d;
  if (overlap <= 0) return { x: 0, y: 0 };
  return { x: (d > 1e-6 ? dx / d : Math.cos(turbine.intake)) * overlap,
    y: (d > 1e-6 ? dy / d : Math.sin(turbine.intake)) * overlap };
}

/** How close to a turbine's intake (edge to edge) nobody, whatever its size, can walk away any more */
export function noReturnGap(): number {
  return TURBINE.INTAKE_REACH * (1 - 1 / Math.sqrt(TURBINE.PULL_RATIO));
}
