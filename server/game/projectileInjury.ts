import { CANNON, GEMS, PROJECTILE_INJURY } from '../constants/gameConstants.js';
import { bodyMass } from './creatureSize.js';

export interface ProjectileInjuryImpact {
  speed: number;
  ammoWidth: number;
  targetWidth: number;
  kind: 'missile' | 'turbine';
  deliberate: boolean;
  /** Immutable launch snapshots, never a lookup of the current owner. */
  shooterWidth?: number;
  shooterMassBonus?: number;
}

/** Existing proportional impact power, expressed independently of banked gems.
 * The flat gem-damage term is deliberately excluded: chip damage and overflow
 * score must not grant a full injury. A player's existing physical rival-share
 * floor remains meaningful even with the standard 60-unit ammunition shell.
 */
export function projectileInjuryPower(hit: ProjectileInjuryImpact): number {
  const { speed, ammoWidth, targetWidth } = hit;
  if (!Number.isFinite(speed + ammoWidth + targetWidth) || speed <= 0 || ammoWidth <= 0 || targetWidth <= 0) return 0;
  const ammo = bodyMass(ammoWidth), target = Math.max(GEMS.BASE_MASS, bodyMass(targetWidth));
  if (!Number.isFinite(ammo + target)) return 0;
  const playerShot = hit.kind === 'missile' && hit.deliberate;
  const storedBonus = hit.shooterMassBonus ?? 0;
  const bonus = playerShot && Number.isFinite(storedBonus) ? Math.max(0, Math.min(ammo * CANNON.SHOOTER_MASS_CAP, storedBonus)) : 0;
  const relativeMass = (ammo + bonus) / target;
  const pivot = hit.kind === 'turbine' ? CANNON.TURBINE_IMPACT_MASS_PIVOT : CANNON.IMPACT_MASS_PIVOT;
  // Retain the existing impact pace and rival-share rules; this is an injury gate only.
  const pace = Math.max(0.65, Math.min(1.15, speed / CANNON.IMPACT_SPEED_REF));
  const massPower = Math.min(CANNON.IMPACT_MAX_SHARE, CANNON.IMPACT_MAX_SHARE * relativeMass / (relativeMass + pivot) * pace);
  const shooterWidth = hit.shooterWidth ?? 0;
  const rivalPower = playerShot && Number.isFinite(shooterWidth) && shooterWidth > 0
    ? Math.min(CANNON.IMPACT_MAX_SHARE, CANNON.PEER_HIT_SHARE * (shooterWidth / targetWidth) ** 2) : 0;
  return Math.max(massPower, rivalPower);
}

export function projectileEarnsInjury(hit: ProjectileInjuryImpact): boolean {
  return projectileInjuryPower(hit) >= PROJECTILE_INJURY.MIN_POWER_SHARE;
}
