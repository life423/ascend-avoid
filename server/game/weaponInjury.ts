import { GEMS, WEAPON_INJURY } from '../constants/gameConstants.js';
import { bodyMass } from './creatureSize.js';

/** Accepted damage expressed in existing gem-mass units against the pre-hit
 * physical body. This is impact credit, not a change to the growth formula or
 * a measurement of visible shrink after late-size tapering/rounding.
 */
export function weaponInjuryShare(lostGems: number, width: number): number {
  const mass = bodyMass(width);
  if (!Number.isFinite(lostGems + mass) || lostGems <= 0 || mass <= 0) return 0;
  return lostGems * GEMS.GROWTH_MASS_PER_GEM / mass;
}

/** Server-only, per victim. Each hit expires independently: trickled damage
 * cannot keep an old contribution alive by resetting one common deadline.
 */
export class WeaponInjuryPressure {
  private hits: { at: number; share: number }[] = [];

  clear(): void { this.hits.length = 0; }

  pressure(time: number): number {
    this.hits = this.hits.filter(hit => hit.at <= time && time - hit.at < WEAPON_INJURY.BURST_WINDOW_MS);
    return this.hits.reduce((sum, hit) => sum + hit.share, 0);
  }

  /** Only call after actual, non-grazing, non-lethal damage was accepted. */
  hit(time: number, lostGems: number, preHitWidth: number): boolean {
    const prior = this.pressure(time), share = weaponInjuryShare(lostGems, preHitWidth);
    if (share <= 0) return false;
    if (prior + share >= WEAPON_INJURY.MASS_SHARE - 1e-12) {
      this.clear();
      return true;
    }
    this.hits.push({ at: time, share });
    return false;
  }
}
