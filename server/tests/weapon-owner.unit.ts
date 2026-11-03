import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { spawnWeapon, updateWeapons } from '../systems/weapons.js';
import { orbitalPosition, weaponKinds, weaponProfile } from '../game/weaponKit.js';
import { WEAPON_FLEET } from '../constants/gameConstants.js';
const NOW = 100000;
for (const bot of [false, true]) for (const kind of weaponKinds) {
  const s = new GameState(0); s.botFill = 0; s.setTurbines('off'); s.time = 1000;
  const owner = s.addPlayer('owner', 'Owner', NOW), victim = s.addPlayer('victim', 'Victim', NOW);
  for (const p of [owner, victim]) { p.setGems(100, 4200, 4200); p.dropProtection(); p.isBot = bot; }
  spawnWeapon(s, 2100, 2100, kind); const w = s.pinwheel;
  w.owner = owner.sessionId; w.phase = 'active'; w.at = 20000; w.activatedAt = s.time;
  w.originX = w.x; w.originY = w.y; w.angle = 0; w.nextShotAt = Infinity;
  let x = 2300, y = 2100;
  if (kind === 'pulsar') {
    x = w.x + 150; y = w.y; w.beatAt = s.time;
  } else if (kind === 'ion') {
    s.time += WEAPON_FLEET.ION_WARNING_MS;
    const at = orbitalPosition(w.originX, w.originY, WEAPON_FLEET.ION_WARNING_MS, 4200, 4200);
    x = at.x + 200; y = at.y;
  } else {
    const bolt = new WeaponBoltSchema(); bolt.x = 2140; bolt.y = 2100; bolt.bornAt = s.time - 3000; bolt.angle = 0;
    w.bolts.set('test', bolt);
  }
  for (const p of [owner, victim]) p.placeAt(x - p.width / 2, y - p.width / 2);
  if (kind === 'pulsar') { updateWeapons(s, 0, NOW); s.time += 500; updateWeapons(s, .5, NOW + 500); }
  else updateWeapons(s, kind === 'ion' ? 0 : 200 / weaponProfile(kind).speed, NOW);
  const lost = 100 - victim.gems;
  assert(lost > 0, `${kind} actually hits the unprotected control at the owner's position`);
  assert.equal(owner.gems, 100 + lost, `${kind} owner loses nothing and receives exactly the real reward`);
  assert.equal(owner.weaponDamage, lost); assert.equal(owner.injuredUntil, 0);
  assert.equal(owner.puffVx, 0); assert.equal(owner.puffVy, 0);
  s.removePlayer(owner.sessionId); updateWeapons(s, .01, NOW + 1000);
  assert.equal(w.owner, ''); assert.equal(w.phase, 'waiting'); assert.equal(w.bolts.size, 0);
}
console.log('Weapon owner safety passed: six actual attack paths against overlapping owner/control, both actor roles, conserved rewards, no owner injury/push and disconnect cleanup.');
