import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { spawnWeapon, updateWeapons } from '../systems/weapons.js';
import { weaponProfile, orbitalPosition, allWeapons } from '../game/weaponKit.js';
import { weaponShots } from '../game/weaponShots.js';
import { firstImpact } from '../game/incomingShot.js';
import { BotProjectileDodge } from '../game/botProjectiles.js';
import { BotBrain } from '../game/bots.js';
import { WEAPON_FLEET, WEAPON_SHOTS, type WeaponKind } from '../constants/gameConstants.js';

const NOW = 100000;
function scene(kind: WeaponKind = 'pinwheel', gems = 100, bot = false) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = true;
  s.surgesOn = false; s.setTurbines('off'); s.time = 0;
  const owner = s.addPlayer('owner', 'Owner', NOW), target = s.addPlayer('target', 'Target', NOW);
  owner.placeAt(100, 100); target.setGems(gems, 4200, 4200); target.isBot = bot;
  owner.dropProtection(); target.dropProtection();
  spawnWeapon(s, 2100, 2100, kind);
  const w = s.pinwheel; w.phase = 'active'; w.owner = owner.sessionId; w.at = 20000;
  w.originX = w.x; w.originY = w.y; w.activatedAt = 0; w.nextShotAt = w.nextAimAt = Infinity;
  const bolt = new WeaponBoltSchema(); bolt.x = 2148; bolt.y = 2100; bolt.angle = 0; bolt.bornAt = 0;
  w.bolts.set('one', bolt);
  return { s, w, target, owner, bolt };
}

for (const kind of ['pinwheel', 'sentinel', 'ricochet'] as const) for (const bot of [false, true]) for (const gems of [0, 100, 1000]) {
  const { s, w, target, owner } = scene(kind, gems, bot);
  target.placeAt(2190 - target.width / 2, 2100 - target.height / 2);
  for (let ms = 20; ms <= 800; ms += 20) { s.time = ms; updateWeapons(s, .02, NOW + ms); }
  assert.equal(target.gems, gems, `${kind}: a newly arrived satellite cannot deal point-blank damage`);
  assert.equal(target.injuredUntil, 0); assert.equal(owner.weaponDamage, 0); assert.equal(w.bolts.size, 0);
}
// A long tick must judge safety at first contact, rather than at its already-armed endpoint.
for (const live of [false, true]) {
  const { s, w, target, bolt } = scene();
  target.placeAt(2190 - target.width / 2, 2100 - target.height / 2);
  w.hitAt.set(target.sessionId, 800);
  if (live) bolt.bornAt = -3000;
  s.time = 20; updateWeapons(s, .02, NOW + 20);
  assert.equal(w.bolts.size, 0, 'a cooldown contact still consumes the bolt instead of letting it arm inside a body');
  assert.equal(target.gems, 100); assert.equal(w.hitAt.get(target.sessionId), 800, 'blocked hits cannot extend the cooldown');
}
for (const contactMs of [480, 560]) {
  const { s, w, target, owner } = scene(); const speed = weaponProfile('pinwheel').speed;
  s.time = 600;
  target.placeAt(2148 + speed * (contactMs - 400) / 1000 + weaponProfile('pinwheel').radius, 2100 - target.height / 2);
  updateWeapons(s, .2, NOW + 600);
  assert.equal(target.gems < 100, contactMs >= WEAPON_SHOTS.ARM_MS);
  assert.equal(owner.weaponDamage > 0, contactMs >= WEAPON_SHOTS.ARM_MS);
  assert.equal(w.bolts.size, 0, 'a harmless contact consumes the charge instead of arming inside a creature');
}
// A damaging hit must leave actual movement/turning available, not merely stunned=false.
for (const kind of ['pinwheel', 'sentinel', 'ricochet', 'comet', 'ion'] as const) {
  const roles = [];
  for (const bot of [false, true]) for (const gems of [100, 1000, 10000]) {
    const { s, w, target, owner, bolt } = scene(kind, gems, bot);
    s.time = 800;
    if (kind === 'ion') {
      w.activatedAt = s.time - WEAPON_FLEET.ION_WARNING_MS;
      const at = orbitalPosition(w.originX, w.originY, WEAPON_FLEET.ION_WARNING_MS, 4200, 4200, kind);
      const angle = .75 * .1;
      target.placeAt(at.x + Math.cos(angle) * 180 - target.width / 2, at.y + Math.sin(angle) * 180 - target.height / 2);
    } else {
      bolt.bornAt = -3000;
      target.placeAt(bolt.x + 20 - target.width / 2, bolt.y - target.height / 2);
    }
    updateWeapons(s, .1, NOW + s.time);
    assert(target.gems < gems && target.state === 'alive', `${kind}: an ordinary central hit lands`);
    assert(!target.stunned && !target.sliding && !target.recovering, `${kind}: no hidden control-locking skid`);
    assert(target.breathingBlocked && owner.weaponDamage === gems - target.gems, 'injury and exact builder credit remain');
    const x = target.x, y = target.y, facing = target.facing;
    target.steer(0, 1);
    target.updateMovement(4200, 4200, NOW + s.time + 33, 1 / 30);
    assert(target.y > y + .1 && target.facing > facing, `${kind}: movement and rotation respond on the first tick after impact`);
    assert(target.x > x, `${kind}: the hit still produces a brief push`);
    const lost = gems - target.gems;
    for (let i = 1; i <= 30; i++) target.updateMovement(4200, 4200, NOW + s.time + 33 + i * 1000 / 30, 1 / 30);
    assert(target.x - x < 65, `${kind}: removing the skid cannot increase its existing push distance`);
    assert.equal(target.puffVx, 0, 'the horizontal impact impulse expires');
    roles.push({ lost, x: target.x - x, y: target.y - y, facing: target.facing });
  }
  assert.deepEqual(roles.slice(0, 3), roles.slice(3), `${kind}: bot and human input produces identical impact recovery`);
}
{
  const { s, w, target, bolt } = scene();
  const range = weaponProfile('pinwheel').range;
  bolt.bornAt = -3000;
  target.placeAt(bolt.x + range + 30, 2100 - target.height / 2);
  s.time = 2000; updateWeapons(s, 2, NOW + 2000);
  assert.equal(target.gems, 100, 'a long frame cannot hit beyond the finite range');
  assert.equal(bolt.traveled, range); assert.equal(w.bolts.size, 0);
}
for (const kind of ['sentinel', 'ricochet'] as const) for (const origin of [400, 2100, 3800]) {
  const period = weaponProfile(kind).shotMs, start = period - WEAPON_SHOTS.CHARGE_MS;
  const at = orbitalPosition(origin, origin, start, 4200, 4200, kind);
  for (let age = start; age <= period; age += 25) assert.deepEqual(orbitalPosition(origin, origin, age, 4200, 4200, kind), at, 'a satellite holds its position throughout the visible charge');
  const after = orbitalPosition(origin, origin, period + 20, 4200, 4200, kind);
  assert(Math.hypot(after.x - at.x, after.y - at.y) < 5, 'travel resumes smoothly without teleporting');
}
{
  const { s, target, bolt, w } = scene('sentinel', 0);
  target.placeAt(2548 - target.width / 2, 2100 - target.height / 2); bolt.bornAt = -3000;
  const targetCircle = { x: 2548, y: 2100, vx: 0, vy: 0, radius: target.width / 2 };
  assert(firstImpact(targetCircle, weaponShots(allWeapons(s), s.time, target.sessionId), WEAPON_SHOTS.WARNING_S));
  assert.equal(weaponShots(allWeapons(s), s.time, w.owner).length, 0, 'own bolts never trigger danger/dodge');
  const dodge = new BotProjectileDodge(() => 0);
  assert.equal(dodge.move(target, s, NOW), undefined, 'bots cannot react on the first observation');
  assert.equal(dodge.move(target, s, NOW + 249), undefined);
  const move = dodge.move(target, s, NOW + 250);
  assert(move === 'up' || move === 'down', 'a read shot produces an ordinary sideways steering choice');
  target.steer(0, move === 'up' ? -1 : 1); const before = target.y;
  target.updateMovement(4200, 4200, NOW + 350, .1);
  assert(Math.abs(target.y - before) > 5 && Math.abs(target.y - before) < 33, 'a bot accelerates at normal player speed');
}
{
  const { s, target, bolt } = scene('pinwheel', 0); target.placeAt(2548 - target.width / 2, 2090); bolt.bornAt = -3000;
  const random = Math.random; Math.random = () => .5;
  try {
    const brain = new BotBrain(); brain.think(target, s, NOW);
    const move = brain.think(target, s, NOW + 600);
    assert(move === 'up' || move === 'down', 'the real bot brain integrates the same projectile dodge');
  } finally { Math.random = random; }
}
{
  const { s, target, bolt } = scene('pinwheel', 0);
  target.placeAt(2190, 2090);
  assert.equal(firstImpact({ x: 2200, y: 2100, vx: 0, vy: 0, radius: 10 }, weaponShots(allWeapons(s), 0, target.sessionId), WEAPON_SHOTS.WARNING_S), null, 'a charge that will fizzle is not advertised as a damaging threat');
  bolt.traveled = weaponProfile('pinwheel').range;
  assert.equal(firstImpact({ x: 2200, y: 2100, vx: 0, vy: 0, radius: 10 }, weaponShots(allWeapons(s), 0, target.sessionId), WEAPON_SHOTS.WARNING_S), null, 'expired-range projectiles cannot trigger warnings');
}
console.log('Projectile counterplay passed: close-launch fizzles, exact contact-time safety, real range caps, settled charges, shared warnings, steerable impacts at three sizes across five weapons, bot/player parity and owner immunity.');
