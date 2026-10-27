import { WEAPON_FAIRNESS } from '../constants/gameConstants.js';

/** Physical dimensions, never score: small bodies retain their existing hit area. */
export function weaponCoreRadius(width: number): number {
  return Math.min(width / 2, WEAPON_FAIRNESS.CORE_RADIUS_MAX);
}

/** Center-line shots remain full hits even when they first touch a large body's outside. */
export function weaponGraze(width: number, cx: number, cy: number, ax: number, ay: number, angle: number, projectileRadius: number, reach = Infinity): boolean {
  if (width / 2 <= WEAPON_FAIRNESS.CORE_RADIUS_MAX) return false;
  const lateral = Math.abs((cx - ax) * Math.sin(angle) - (cy - ay) * Math.cos(angle));
  const along = (cx - ax) * Math.cos(angle) + (cy - ay) * Math.sin(angle);
  const beyond = Math.max(0, -along, along - reach);
  return Math.hypot(lateral, beyond) > weaponCoreRadius(width) + projectileRadius;
}

/** Shared protection ramps with body size; existing per-weapon timers still apply. */
export function weaponHitPause(width: number): number {
  const start = WEAPON_FAIRNESS.CORE_RADIUS_MAX * 2;
  return Math.round(WEAPON_FAIRNESS.SHARED_HIT_MS * Math.max(0, Math.min(1,
    (width - start) / (WEAPON_FAIRNESS.FULL_GUARD_WIDTH - start))));
}
