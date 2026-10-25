import { ARENA_RULES, CANNON, GEMS, INHALE } from "../constants/gameConstants.js";
import { bodyMass, creatureSize, gemsForGrowthMass } from './creatureSize.js';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function escapeLength(captorWidth: number, captiveWidth: number): number {
  const ratio = captorWidth / Math.max(1, captiveWidth);
  return ratio >= 4 ? 5 : ratio >= 2 ? 4 : 3;
}

export function captureLoadMs(keys: number): number {
  return CANNON.ARM_MS + Math.max(0, Math.min(2, keys - 3)) * 300;
}

/** Whether a mouth this wide can catch (hold at its mouth) a creature this wide: INHALE.EAT_RATIO times as wide, whatever the creature holds (an empty one is no exception) */
export function canCatch(captorWidth: number, preyWidth: number): boolean {
  return preyWidth * INHALE.EAT_RATIO <= captorWidth;
}

/**
 * How fast a captor this wide launches a captive this wide (units a second): LAUNCH_SPEED_MIN when just big
 * enough to catch it, LAUNCH_SPEED_PER_DOUBLING more every time it's twice as wide again relative to the
 * captive, up to LAUNCH_SPEED_MAX. Doubling the size advantage adds a fixed amount, so giants hit hard
 * without the speed ever running away.
 */
export function launchSpeed(captorWidth: number, captiveWidth: number = ARENA_RULES.PLAYER_SIZE): number {
  const ratio = clamp(captorWidth / Math.max(1, captiveWidth), INHALE.EAT_RATIO, CANNON.LAUNCH_RATIO_CAP);
  const doublings = Math.log2(ratio / INHALE.EAT_RATIO);
  return clamp(CANNON.LAUNCH_SPEED_MIN + CANNON.LAUNCH_SPEED_PER_DOUBLING * doublings, CANNON.LAUNCH_SPEED_MIN, CANNON.LAUNCH_SPEED_MAX);
}

/** Width is proportional to the square root of mass, so keeping 10% width retains about 1% mass. */
export function missileMassAfterImpact(gems: number, width: number = creatureSize(gems)): number {
  return Math.floor(gemsForGrowthMass(Math.max(0, bodyMass(width * CANNON.MISSILE_WIDTH_KEEP) - GEMS.BASE_MASS)));
}

/** Pre-impact projectile mass sets the threat; a tiny shot chips a giant instead of erasing its growth. */
export function impactGems(targetGems: number, speed: number, flierWidth: number, targetWidth: number = creatureSize(targetGems)): number {
  if (targetGems <= 0) return 0;
  const relativeMass = bodyMass(flierWidth) / Math.max(GEMS.BASE_MASS, bodyMass(targetWidth));
  const pace = clamp(speed / CANNON.IMPACT_SPEED_REF, 0.65, 1.15);
  const share = CANNON.IMPACT_MAX_SHARE * relativeMass / (relativeMass + CANNON.IMPACT_MASS_PIVOT);
  return Math.min(targetGems, Math.max(1, Math.round(targetGems * Math.min(CANNON.IMPACT_MAX_SHARE, share * pace))));
}

/** One flight step. Player-fired missiles supply zero steering; turbine throws allow lateral input. */
export function flightStep(vx: number, vy: number, steerX: number, steerY: number, deltaTime: number, drag: number = CANNON.DRAG): { vx: number; vy: number } {
  const speed = Math.hypot(vx, vy);
  if (speed < 1e-6) return { vx: 0, vy: 0 };
  const ux = vx / speed;
  const uy = vy / speed;
  const side = steerX * -uy + steerY * ux;
  const nx = vx - uy * side * CANNON.STEER * deltaTime;
  const ny = vy + ux * side * CANNON.STEER * deltaTime;
  const keep = (speed * Math.exp(-drag * deltaTime)) / Math.max(1e-6, Math.hypot(nx, ny));
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
