import { CANNON, INHALE } from "../constants/gameConstants.js";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How firmly a captor this wide holds a captive this wide: HOLD_MIN when just big enough to catch it, more each time it's twice as big again, up to HOLD_MAX */
export function holdFirmness(captorWidth: number, captiveWidth: number): number {
  const ratio = captorWidth / Math.max(1, captiveWidth);
  return clamp(CANNON.HOLD_MIN + CANNON.HOLD_PER_DOUBLING * Math.log2(Math.max(1, ratio / INHALE.EAT_RATIO)), CANNON.HOLD_MIN, CANNON.HOLD_MAX);
}

/** Whether a captor this wide can swallow a captive this wide holding this many gems: it must be SWALLOW_RATIO wider, unless the captive is empty (nothing to gain), when being bigger at all is enough; never a smaller or same-size captor */
export function canSwallowWhole(captorWidth: number, captiveWidth: number, captiveGems: number): boolean {
  if (captiveGems <= 0) return captorWidth > captiveWidth;
  return captorWidth >= captiveWidth * CANNON.SWALLOW_RATIO;
}

/** How fast a captor this wide launches its captive (units a second) */
export function launchSpeed(captorWidth: number): number {
  return CANNON.SPEED + CANNON.SPEED_PER_WIDTH * captorWidth;
}

/** The launch direction: the captor's facing, shifted by the captive's sideways push up to LAUNCH_INFLUENCE */
export function launchAngle(facing: number, steerX: number, steerY: number): number {
  const side = steerX * -Math.sin(facing) + steerY * Math.cos(facing);
  return facing + clamp(side, -1, 1) * CANNON.LAUNCH_INFLUENCE;
}

/** How many gems a flier this wide hitting at this speed knocks out of a target holding this many: diminishing (square root) against giants, never more than IMPACT_MAX_SHARE of them */
export function impactGems(targetGems: number, speed: number, flierWidth: number): number {
  if (targetGems <= 0) return 0;
  const pace = clamp(speed / CANNON.IMPACT_SPEED_REF, 0.5, 1.25);
  const mass = clamp(Math.sqrt(flierWidth / 20), 1, 2.5);
  const knocked = Math.round(CANNON.IMPACT_BASE + CANNON.IMPACT_PER_ROOT * pace * mass * Math.sqrt(targetGems));
  return Math.min(targetGems, Math.ceil(targetGems * CANNON.IMPACT_MAX_SHARE), knocked);
}

/** One step of a flight: drag slows it, and only the sideways part of the flier's steering bends it */
export function flightStep(vx: number, vy: number, steerX: number, steerY: number, deltaTime: number): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed < 1e-6) return { vx: 0, vy: 0 };
  const ux = vx / speed;
  const uy = vy / speed;
  const side = steerX * -uy + steerY * ux;
  const nx = vx - uy * side * CANNON.STEER * deltaTime;
  const ny = vy + ux * side * CANNON.STEER * deltaTime;
  const keep = (speed * Math.exp(-CANNON.DRAG * deltaTime)) / Math.max(1e-6, Math.hypot(nx, ny));
  return { vx: nx * keep, vy: ny * keep };
}
