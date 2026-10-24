import { CANNON, INHALE } from "../constants/gameConstants.js";

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** How firmly a captor this wide holds a captive this wide: HOLD_MIN when just big enough to catch it, more each time it's twice as big again, up to HOLD_MAX */
export function holdFirmness(captorWidth: number, captiveWidth: number): number {
  const ratio = captorWidth / Math.max(1, captiveWidth);
  return clamp(CANNON.HOLD_MIN + CANNON.HOLD_PER_DOUBLING * Math.log2(Math.max(1, ratio / INHALE.EAT_RATIO)), CANNON.HOLD_MIN, CANNON.HOLD_MAX);
}

/** Whether a mouth this wide can catch (hold at its mouth) a creature this wide: INHALE.EAT_RATIO times as wide, whatever the creature holds (an empty one is no exception) */
export function canCatch(captorWidth: number, preyWidth: number): boolean {
  return preyWidth * INHALE.EAT_RATIO <= captorWidth;
}

/** Whether a captor this wide can swallow a captive this wide: it must be SWALLOW_RATIO wider, whatever the captive holds (an empty one is no exception; never a smaller or same-size captor) */
export function canSwallowWhole(captorWidth: number, captiveWidth: number): boolean {
  return captorWidth >= captiveWidth * CANNON.SWALLOW_RATIO;
}

/** The gems a swallowed creature loses as it pops back out: SWALLOW_PENALTY_SHARE of them (rounded up), never more than SWALLOW_PENALTY_MAX, nothing if it has none */
export function swallowPenalty(gems: number): number {
  if (gems <= 0) return 0;
  return Math.min(CANNON.SWALLOW_PENALTY_MAX, Math.ceil(gems * CANNON.SWALLOW_PENALTY_SHARE));
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

/**
 * How many gems a flier this wide hitting at this speed knocks out of a target holding this many: a flat
 * amount plus one growing with the square root of its gems (times speed and the flier's mass), or
 * IMPACT_SHARE of everything it holds (times speed), whichever is more, so a giant that's hit really
 * shrinks; never more than IMPACT_MAX_SHARE of them
 */
export function impactGems(targetGems: number, speed: number, flierWidth: number): number {
  if (targetGems <= 0) return 0;
  const pace = clamp(speed / CANNON.IMPACT_SPEED_REF, 0.5, 1.25);
  const mass = clamp(Math.sqrt(flierWidth / 20), 1, 2.5);
  const knocked = Math.round(CANNON.IMPACT_BASE + CANNON.IMPACT_PER_ROOT * pace * mass * Math.sqrt(targetGems));
  const share = Math.round(targetGems * CANNON.IMPACT_SHARE * pace);
  return Math.min(targetGems, Math.ceil(targetGems * CANNON.IMPACT_MAX_SHARE), Math.max(knocked, share));
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

/** Whether a flier that moved from (ax, ay) to (bx, by) this tick passed within `radius` of (cx, cy): swept along the path, so a fast flier can't skip through a small target between ticks */
export function sweptHit(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const length2 = dx * dx + dy * dy;
  const t = length2 > 1e-9 ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / length2)) : 1;
  return Math.hypot(ax + dx * t - cx, ay + dy * t - cy) < radius;
}
