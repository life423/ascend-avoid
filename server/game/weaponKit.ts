import { PINWHEEL, SHOCKWAVE, WEAPON_FLEET, WEAPON_RECIPES, WEAPON_SHOTS, type WeaponKind } from '../constants/gameConstants.js';

/** The original slot stays in place on the wire; independent duplicate builds are appended. */
export function allWeapons<T>(state: { pinwheel: T; weaponSets?: Iterable<T> }): T[] {
  return [state.pinwheel, ...Array.from(state.weaponSets ?? [])];
}

export const weaponKinds = Object.keys(WEAPON_RECIPES) as WeaponKind[];
export const weaponProfile = (kind: string) => {
  const base = { activeMs: PINWHEEL.ACTIVE_MS as number, shotMs: PINWHEEL.SHOT_MS as number, speed: PINWHEEL.BOLT_SPEED as number, range: PINWHEEL.BOLT_RANGE as number, radius: PINWHEEL.BOLT_RADIUS as number, share: PINWHEEL.HIT_SHARE as number, root: PINWHEEL.HIT_PER_ROOT as number, minimum: PINWHEEL.HIT_MIN_GEMS as number, orbit: false, aimed: false, color: '#ffd47d' };
  switch (kind) {
    case 'pulsar': return { ...base, activeMs: SHOCKWAVE.ACTIVE_MS, color: '#80e7de' };
    case 'sentinel': return { ...base, activeMs: 16000, shotMs: 1600, speed: 460, range: 750, share: .18, root: 1.6, minimum: 8, orbit: true, aimed: true, color: '#83c9ff' };
    case 'ricochet': return { ...base, activeMs: 16000, shotMs: 1100, speed: 420, range: 800, share: .16, root: 1.6, minimum: 8, orbit: true, color: '#c3a5ff' };
    case 'ion': return { ...base, activeMs: 16000, share: .12, root: 1.6, minimum: 8, orbit: true, color: '#71f5df' };
    case 'comet': return { ...base, activeMs: 12000, shotMs: 1500, speed: 440, range: 1400, radius: 16, share: .35, root: 3, minimum: 12, aimed: true, color: '#ffad82' };
    default: return base;
  }
};

/** Join a broad arena orbit continuously from placement, then traverse it without teleporting. */
export function orbitalPosition(originX: number, originY: number, age: number, width: number, height: number, kind = ''): { x: number; y: number } {
  if (kind === 'sentinel' || kind === 'ricochet') {
    const cycle = weaponProfile(kind).shotMs, moving = cycle - WEAPON_SHOTS.CHARGE_MS;
    const phase = Math.max(0, age) % cycle, t = Math.min(1, phase / moving);
    // Ease to a stop for the charge, then ease out again; never jump between orbit poses.
    age = Math.floor(Math.max(0, age) / cycle) * moving + moving * t * t * (3 - 2 * t);
  }
  const cx = width / 2, cy = height / 2, rx = width * .35, ry = height * .32;
  const initial = Math.atan2((originY - cy) / ry, (originX - cx) / rx);
  const angle = initial + Math.max(0, age) / WEAPON_FLEET.ORBIT_MS * Math.PI * 2;
  const t = Math.max(0, Math.min(1, age / WEAPON_FLEET.ORBIT_ENTRY_MS));
  const blend = t * t * (3 - 2 * t);
  return { x: originX + (cx + Math.cos(angle) * rx - originX) * blend, y: originY + (cy + Math.sin(angle) * ry - originY) * blend };
}

export function ionFiring(age: number): boolean {
  const phase = Math.max(0, age) % WEAPON_FLEET.ION_PERIOD_MS;
  return age >= 0 && phase >= WEAPON_FLEET.ION_WARNING_MS && phase < WEAPON_FLEET.ION_WARNING_MS + WEAPON_FLEET.ION_FIRE_MS;
}
