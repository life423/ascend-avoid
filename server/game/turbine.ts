import { GEMS, TURBINE } from "../constants/gameConstants.js";

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
