import { CANNON, INHALE } from "../constants/gameConstants.js";

/** How hard a captive this wide struggles in the mouth of a captor this wide (1: just small enough to swallow; never below CANNON.STRUGGLE_MIN) */
export function struggleStrength(captiveWidth: number, captorWidth: number): number {
  return Math.max(CANNON.STRUGGLE_MIN, Math.min(1, (captiveWidth / Math.max(1, captorWidth)) * INHALE.EAT_RATIO));
}

/** How fast a captor this wide launches its captive (units a second) */
export function launchSpeed(captorWidth: number): number {
  return CANNON.SPEED + CANNON.SPEED_PER_WIDTH * captorWidth;
}

/** How many gems a flier hitting at this speed knocks out of a target holding this many */
export function impactGems(targetGems: number, speed: number): number {
  if (targetGems <= 0) return 0;
  const pace = Math.max(0.5, Math.min(1.25, speed / CANNON.IMPACT_SPEED_REF));
  return Math.min(targetGems, Math.round(CANNON.IMPACT_BASE + CANNON.IMPACT_SHARE * targetGems * pace));
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
