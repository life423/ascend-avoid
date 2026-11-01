import { CANNON, GEMS, INHALE } from "../constants/gameConstants.js";
import { bodyMass, creatureSize, gemsForGrowthMass } from './creatureSize.js';

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Conserved capture reward, selected by physical body width rather than a percentage of the score. */
export function captureGrowthTransfer(gems: number, worldWidth?: number, worldHeight?: number): number {
  if (!Number.isFinite(gems) || gems <= 0) return 0;
  if (creatureSize(gems, worldWidth, worldHeight) <= CANNON.BULLET_SIZE) return 0;
  let lo = 0, hi = gems;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (creatureSize(mid, worldWidth, worldHeight) <= CANNON.BULLET_SIZE) lo = mid;
    else hi = mid - 1;
  }
  return gems - lo;
}

/** Smooth, monotone interpolation through the provisional 5s / 8s / 12s anchors. */
export function captureHoldMs(captorWidth: number, captiveWidth: number): number {
  const ratio = clamp(captorWidth / Math.max(1, captiveWidth), INHALE.EAT_RATIO, 4);
  const low = ratio <= 2;
  const t = low ? (ratio - INHALE.EAT_RATIO) / (2 - INHALE.EAT_RATIO) : (ratio - 2) / 2;
  const smooth = t * t * (3 - 2 * t);
  return low ? CANNON.HOLD_MIN_MS + smooth * (CANNON.HOLD_DOUBLE_MS - CANNON.HOLD_MIN_MS)
    : CANNON.HOLD_DOUBLE_MS + smooth * (CANNON.HOLD_MAX_MS - CANNON.HOLD_DOUBLE_MS);
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
export function launchSpeed(captorWidth: number, captiveWidth: number = CANNON.BULLET_SIZE): number {
  const ratio = clamp(captorWidth / Math.max(1, captiveWidth), INHALE.EAT_RATIO, CANNON.LAUNCH_RATIO_CAP);
  const doublings = Math.log2(ratio / INHALE.EAT_RATIO);
  return clamp(CANNON.LAUNCH_SPEED_MIN + CANNON.LAUNCH_SPEED_PER_DOUBLING * doublings, CANNON.LAUNCH_SPEED_MIN, CANNON.LAUNCH_SPEED_MAX);
}

/** Width is proportional to the square root of mass, so keeping 10% width retains about 1% mass. */
export function missileMassAfterImpact(gems: number, width: number = creatureSize(gems)): number {
  return Math.floor(gemsForGrowthMass(Math.max(0, bodyMass(width * CANNON.MISSILE_WIDTH_KEEP) - GEMS.BASE_MASS)));
}

/** Stored physical-mass bonus: only a player's deliberate captive launch sets it. */
export function shooterMassContribution(shooterWidth: number, ammoWidth: number): number {
  const ammo = bodyMass(ammoWidth), shooter = bodyMass(shooterWidth);
  if (!Number.isFinite(ammo + shooter) || ammo <= 0) return 0;
  return Math.min(ammo * CANNON.SHOOTER_MASS_CAP, Math.sqrt(ammo * shooter) * CANNON.SHOOTER_MASS_WEIGHT);
}

/** Physical shooter size adds credible rival damage without softening stronger early impacts. */
export function impactGems(targetGems: number, speed: number, flierWidth: number, targetWidth: number = creatureSize(targetGems), storedShooterMass = 0, kind: 'missile' | 'turbine' = 'missile', shooterWidth = 0): number {
  if (targetGems <= 0) return 0;
  const ammo = bodyMass(flierWidth);
  // Keep the existing CURRENT pre-impact ammunition mass rule. If ammunition changes,
  // its stored shooter bonus still cannot overwhelm that current physical body.
  const bonus = Math.max(0, Math.min(ammo * CANNON.SHOOTER_MASS_CAP, Number.isFinite(storedShooterMass) ? storedShooterMass : 0));
  const relativeMass = (ammo + bonus) / Math.max(GEMS.BASE_MASS, bodyMass(targetWidth));
  const pace = clamp(speed / CANNON.IMPACT_SPEED_REF, 0.65, 1.15);
  const pivot = kind === 'turbine' ? CANNON.TURBINE_IMPACT_MASS_PIVOT : CANNON.IMPACT_MASS_PIVOT;
  const base = kind === 'turbine' ? CANNON.TURBINE_IMPACT_BASE_GEMS : CANNON.IMPACT_BASE_GEMS;
  const share = CANNON.IMPACT_MAX_SHARE * relativeMass / (relativeMass + pivot);
  const energy = base * relativeMass / (relativeMass + 1);
  const massDamage = Math.min(targetGems, Math.max(1, Math.round(Math.min(targetGems * CANNON.IMPACT_MAX_SHARE, (targetGems * share + energy) * pace))));
  if (kind !== 'missile' || CANNON.PEER_HIT_SHARE <= 0 || !Number.isFinite(shooterWidth) || shooterWidth <= 0 || targetWidth <= 0) return massDamage;
  const rivalShare = Math.min(CANNON.IMPACT_MAX_SHARE, CANNON.PEER_HIT_SHARE * (shooterWidth / targetWidth) ** 2);
  return Math.max(massDamage, Math.min(targetGems, Math.max(1, Math.round(targetGems * rivalShare))));
}

/** A launcher at least 20% wider shatters on any missile hit; other shots retain relative-energy lethality. */
export function lethalPlayerImpact(speed: number, ammoWidth: number, targetWidth: number, storedBonus = 0, shooterWidth = 0): boolean {
  if (!Number.isFinite(speed + ammoWidth + targetWidth + storedBonus) || speed <= 0 || ammoWidth <= 0 || targetWidth <= 0) return false;
  const ammo = bodyMass(ammoWidth), bonus = Math.max(0, Math.min(ammo * CANNON.SHOOTER_MASS_CAP, storedBonus));
  const pace = clamp(speed / CANNON.IMPACT_SPEED_REF, 0, 1.15);
  const force = (ammo + bonus) / bodyMass(targetWidth) * pace * pace >= CANNON.LETHAL_ENERGY_RATIO;
  const advantage = Number.isFinite(shooterWidth) && shooterWidth >= targetWidth * CANNON.SHATTER_SHOOTER_RATIO;
  return force || advantage;
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
