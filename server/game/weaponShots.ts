import { WEAPON_SHOTS } from '../constants/gameConstants.js';
import { weaponProfile } from './weaponKit.js';
import type { IncomingShot } from './incomingShot.js';

interface ShotSource {
  owner: string;
  kind: string;
  phase: string;
  x: number;
  y: number;
  angle: number;
  nextShotAt: number;
  bolts: { forEach(fn: (bolt: { x: number; y: number; angle: number; bornAt: number; traveled: number }, id: string) => void): void };
}

/** Only replicated, committed projectiles. No secret future aim or player-specific protection. */
export function weaponShots(weapons: readonly ShotSource[], time: number, localId: string, lead = 0,
  visible: (x: number, y: number, radius: number) => boolean = () => false): IncomingShot[] {
  const shots: IncomingShot[] = [];
  weapons.forEach((weapon, index) => {
    if (weapon.owner === localId) return;
    const profile = weaponProfile(weapon.kind);
    const delay = (weapon.nextShotAt - time) / 1000 - lead;
    if (weapon.phase === 'active' && profile.orbit && weapon.kind !== 'ion' && delay >= 0 && delay <= WEAPON_SHOTS.CHARGE_MS / 1000) {
      const vx = Math.cos(weapon.angle) * profile.speed, vy = Math.sin(weapon.angle) * profile.speed;
      const x = weapon.x + Math.cos(weapon.angle) * 48, y = weapon.y + Math.sin(weapon.angle) * 48;
      // A virtual start behind the settled muzzle represents the remaining charge delay.
      shots.push({ id: `weapon:${index}:charge:${weapon.nextShotAt}`, x: x - vx * delay, y: y - vy * delay,
        vx, vy, radius: profile.radius, visible: visible(weapon.x, weapon.y, 60),
        arming: delay + WEAPON_SHOTS.ARM_MS / 1000, remaining: delay + profile.range / profile.speed });
    }
    weapon.bolts.forEach((bolt, id) => {
      const vx = Math.cos(bolt.angle) * profile.speed, vy = Math.sin(bolt.angle) * profile.speed;
      const x = bolt.x + vx * lead, y = bolt.y + vy * lead;
      shots.push({ id: `weapon:${index}:${id}:${bolt.bornAt}`, x, y, vx, vy, radius: profile.radius,
        visible: visible(x, y, profile.radius), remaining: (profile.range - bolt.traveled) / profile.speed - lead,
        arming: Math.max(0, (WEAPON_SHOTS.ARM_MS - (time - bolt.bornAt)) / 1000 - lead) });
    });
  });
  return shots;
}
