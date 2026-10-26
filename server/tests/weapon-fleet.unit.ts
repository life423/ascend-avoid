import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { initializeWeaponSets, spawnWeapon, updateWeapons, deployWeapon } from '../systems/weapons.js';
import { allWeapons, weaponKinds, weaponProfile, orbitalPosition } from '../game/weaponKit.js';
import { PINWHEEL, WEAPON_FLEET } from '../constants/gameConstants.js';

const NOW = 100000;
function required<T>(value: T | undefined): T { assert(value !== undefined); return value; }
function setup() {
  const s = new GameState(0); s.botFill = 0; s.weaponsOn = true; s.time = 1000;
  const a = s.addPlayer('a', 'Builder', NOW), b = s.addPlayer('b', 'Rival', NOW);
  for (const p of [a, b]) { p.spawnProtected = false; p.placeAt(100, 100); }
  initializeWeaponSets(s);
  for (const w of allWeapons(s)) spawnWeapon(s, w.spawnX, w.spawnY, w.kind, w);
  return { s, a, b, builds: allWeapons(s) };
}
{
  const { s, a, b, builds } = setup();
  assert.equal(builds.length, 12); assert.equal(new Set(builds.map(w => w.kind)).size, 6);
  for (const kind of weaponKinds) assert.equal(builds.filter(w => w.kind === kind).length, 2);
  assert.equal(builds.reduce((n, w) => n + w.parts.length, 0), 36);
  const w = required(builds[2]), duplicate = required(builds[8]), part = required(w.parts[0]);
  a.placeAt(part.x - a.width / 2, part.y - a.height / 2); updateWeapons(s, .01, NOW);
  assert.equal(w.owner, a.sessionId); assert.equal(w.progress, 1);
  assert(w.parts.every(p => p.owner === a.sessionId), 'first pickup reserves the entire matching set');
  assert.equal(w.claimedAt, s.time, 'claim animation uses a synchronized start time');
  const sibling = required(w.parts[1]);
  b.placeAt(sibling.x - b.width / 2, sibling.y - b.height / 2); updateWeapons(s, .01, NOW);
  assert.equal(sibling.carriedBy, '', 'a rival cannot collect a reserved sibling');
  a.placeAt(required(duplicate.parts[0]).x - a.width / 2, required(duplicate.parts[0]).y - a.height / 2); updateWeapons(s, .01, NOW);
  assert.equal(duplicate.owner, '', 'a player cannot hoard a second incomplete set');
  b.placeAt(required(duplicate.parts[0]).x - b.width / 2, required(duplicate.parts[0]).y - b.height / 2);
  a.placeAt(100, 100); updateWeapons(s, .01, NOW);
  assert.equal(duplicate.owner, b.sessionId, 'a duplicate set remains available to other players');
  s.time += PINWHEEL.CLAIM_MS + 1000; updateWeapons(s, .01, NOW);
  assert.equal(w.owner, a.sessionId, 'holding a part keeps radar and ownership linked');
  for (const p of w.parts) { p.carriedBy = ''; p.x = 500 + p.kind * 200; p.y = 700; }
  a.placeAt(100, 100); s.time = w.claimUntil; updateWeapons(s, .01, NOW);
  assert.equal(w.owner, ''); assert(w.parts.every(p => !p.owner), 'dropping every part unlocks the set after recovery time');
  const d = required(duplicate.parts[1]); a.placeAt(d.x - a.width / 2, d.y - a.height / 2);
  b.state = 'dead'; updateWeapons(s, .01, NOW);
  assert.equal(duplicate.owner, a.sessionId, 'knockout immediately releases the set for another collector');
  s.players.delete(a.sessionId); updateWeapons(s, .01, NOW);
  assert.equal(duplicate.owner, '', 'disconnect cannot strand locked parts');
}
for (const kind of weaponKinds) {
  const { s, a, b, builds } = setup(), w = required(builds.find(w => w.kind === kind));
  for (const part of [...w.parts]) {
    assert(part);
    a.placeAt(part.x - a.width / 2, part.y - a.height / 2); updateWeapons(s, .01, NOW);
  }
  assert.equal(w.phase, 'carried', `${kind} assembles from collected cargo`);
  assert(deployWeapon(s, a)); const x = w.x, y = w.y;
  s.time = w.at; updateWeapons(s, 0, NOW);
  assert.equal(w.phase, 'active'); assert.equal(w.x, x); assert.equal(w.y, y);
  assert.equal(w.at - s.time, weaponProfile(kind).activeMs);
  if (weaponProfile(kind).orbit) {
    s.time += 3000; updateWeapons(s, .02, NOW);
    assert(Math.hypot(w.x - x, w.y - y) > 100, `${kind} crosses the arena`);
  }
  b.placeAt(100, 100); a.state = 'dead'; updateWeapons(s, .02, NOW);
  assert.equal(w.phase, 'active', 'an activated weapon completes its lifetime after owner knockout');
  s.time = w.at; updateWeapons(s, .01, NOW);
  assert.equal(w.phase, 'waiting'); assert.equal(w.kind, kind, 'duplicate slots retain their recipe');
}
{
  const { s, a, b, builds } = setup(), w = required(builds.find(w => w.kind === 'ricochet'));
  w.phase = 'active'; w.owner = a.sessionId; w.at = s.time + 16000; w.nextShotAt = Infinity; w.activatedAt = s.time;
  const bolt = new WeaponBoltSchema(); bolt.x = s.worldWidth - 5; bolt.y = 1600; bolt.angle = 0; bolt.bornAt = s.time;
  w.bolts.set('bounce', bolt); updateWeapons(s, .02, NOW);
  assert.equal(bolt.bounces, 1); assert(Math.cos(bolt.angle) < 0);
  b.setGems(100, s.worldWidth, s.worldHeight); b.placeAt(s.worldWidth - 150 - b.width / 2, 1600 - b.height / 2);
  updateWeapons(s, .3, NOW);
  assert(b.gems < 100 && b.injuredUntil > s.time, 'reflected bolts hit with normal damage and injury');
}
{
  const { s, a, b, builds } = setup(), w = required(builds.find(w => w.kind === 'ion'));
  w.phase = 'active'; w.owner = a.sessionId; w.at = s.time + 16000; w.activatedAt = s.time; w.originX = 2000; w.originY = 2000; w.angle = 0;
  b.setGems(100, s.worldWidth, s.worldHeight);
  let pos = orbitalPosition(w.originX, w.originY, 0, s.worldWidth, s.worldHeight);
  b.placeAt(pos.x + 200 - b.width / 2, pos.y - b.height / 2); updateWeapons(s, 0, NOW);
  assert.equal(b.gems, 100, 'beam warning is harmless');
  s.time += WEAPON_FLEET.ION_WARNING_MS;
  pos = orbitalPosition(w.originX, w.originY, WEAPON_FLEET.ION_WARNING_MS, s.worldWidth, s.worldHeight);
  b.placeAt(pos.x + 200 - b.width / 2, pos.y - b.height / 2); updateWeapons(s, 0, NOW);
  assert.equal(b.gems, 88, 'beam has a defined, injuring firing window');
  updateWeapons(s, 0, NOW); assert.equal(b.gems, 88, 'beam cannot drain every simulation tick');
}
{
  const { s, a, b, builds } = setup(), w = required(builds.find(w => w.kind === 'sentinel'));
  w.phase = 'active'; w.owner = a.sessionId; w.at = s.time + 16000; w.nextShotAt = s.time + 850; w.activatedAt = s.time; w.originX = 1700; w.originY = 1700;
  b.placeAt(2000, 1800); updateWeapons(s, 0, NOW); const aim = w.angle;
  b.placeAt(1800, 2100); s.time += 800; updateWeapons(s, .02, NOW);
  assert.equal(w.angle, aim, 'aim lock leaves a dodgeable telegraph'); assert.equal(w.bolts.size, 0);
  s.time += 50; updateWeapons(s, .02, NOW); assert.equal(w.bolts.size, 1);
}
for (const [ox, oy] of [[56, 56], [2000, 2000], [3944, 3944]] as const) {
  let prior = orbitalPosition(ox, oy, 0, 4000, 4000);
  assert.deepEqual(prior, { x: ox, y: oy });
  for (let age = 20; age <= 16000; age += 20) {
    const pos = orbitalPosition(ox, oy, age, 4000, 4000);
    assert(pos.x >= 56 && pos.x <= 3944 && pos.y >= 56 && pos.y <= 3944);
    assert(Math.hypot(pos.x - prior.x, pos.y - prior.y) < 60, 'orbit entry and traversal have no teleport'); prior = pos;
  }
}
console.log('Weapon fleet passed: six recipes, duplicate reservations, unlocking, carrying, deployment, orbital continuity, reflected damage, aim warnings and ion windows.');
