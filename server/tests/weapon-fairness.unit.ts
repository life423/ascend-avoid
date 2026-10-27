import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { PinwheelSchema, WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { spawnWeapon, updateWeapons } from '../systems/weapons.js';
import { weaponDamage } from '../systems/weaponDamage.js';
import { updateFlights } from '../systems/flights.js';
import { allWeapons, orbitalPosition, weaponKinds, weaponProfile } from '../game/weaponKit.js';
import { weaponCoreRadius, weaponHitPause } from '../game/weaponFairness.js';
import { WEAPON_FAIRNESS, WEAPON_FLEET } from '../constants/gameConstants.js';

const NOW = 100000;
function setup(gems = 5000, bot = false) {
  const s = new GameState(0); s.botFill = 0; s.weaponsOn = true; s.surgesOn = false; s.setTurbines('off'); s.time = 1000;
  const owner = s.addPlayer('owner', 'Owner', NOW), p = s.addPlayer('target', 'Target', NOW);
  owner.placeAt(100, 100); p.setGems(gems, 4200, 4200); owner.spawnProtected = p.spawnProtected = false; p.isBot = bot;
  const credits: any[] = [], impacts: any[] = [];
  s.onEvent = (type, data) => { if (type === 'credit') credits.push(data); if (type === 'impact') impacts.push(data); };
  return { s, owner, p, credits, impacts };
}
function activate(s: GameState, owner: string, kind: string, w = s.pinwheel) {
  spawnWeapon(s, 2100, 2100, kind as typeof w.kind, w); w.owner = owner; w.phase = 'active';
  w.at = s.time + 16000; w.nextAimAt = w.nextShotAt = Infinity; w.angle = 0;
  w.activatedAt = s.time; w.originX = w.x; w.originY = w.y;
  return w;
}
function bolt(s: GameState, w: PinwheelSchema, id = 'hit') {
  const b = new WeaponBoltSchema(); b.x = 2148; b.y = 2100; b.angle = 0; b.bornAt = s.time; w.bolts.set(id, b);
}
for (const bot of [false, true]) for (const kind of weaponKinds.filter(k => k !== 'pulsar')) for (const graze of [false, true]) {
  const { s, owner, p, credits } = setup(5000, bot), w = activate(s, owner.sessionId, kind), profile = weaponProfile(kind);
  const width = p.width, offset = graze ? 170 : 0;
  if (kind === 'ion') {
    s.time += WEAPON_FLEET.ION_WARNING_MS;
    const at = orbitalPosition(w.originX, w.originY, WEAPON_FLEET.ION_WARNING_MS, 4200, 4200);
    p.placeAt(at.x + 250 - width / 2, at.y + offset - width / 2); updateWeapons(s, 0, NOW);
  } else {
    p.placeAt(2350 - width / 2, 2100 + offset - width / 2); bolt(s, w); updateWeapons(s, 500 / profile.speed, NOW);
  }
  const original = Math.min(5000, Math.ceil(5000 * profile.share), Math.max(profile.minimum, Math.ceil(Math.sqrt(5000) * profile.root)));
  const lost = graze ? Math.max(1, Math.round(original * WEAPON_FAIRNESS.GRAZE_DAMAGE_SHARE)) : original;
  assert.equal(p.gems, 5000 - lost, `${kind}: full center hit or quarter-damage outer graze`);
  assert.equal(owner.gems, lost); assert.equal(owner.weaponDamage, lost); assert.equal(s.gems.size, 0);
  assert.equal(p.injuredUntil > s.time, !graze, 'only a direct hit opens injury');
  assert.equal(p.sliding, !graze, 'grazes do not repeatedly interrupt walking');
  assert.equal(credits.length, 1); assert.equal(credits[0].glancing, graze);
  assert.equal(p.weaponSafeUntil, s.time + weaponHitPause(width));
}
{
  const {s,owner,p}=setup(),w=activate(s,owner.sessionId,'pinwheel');
  p.placeAt(2600-p.width/2,2100-p.height/2);bolt(s,w);updateWeapons(s,.3,NOW);
  assert.equal(p.gems,4830,'a center-line approach is full damage at first shell contact, before reaching the core');
}
{
  const {s,owner,p,credits}=setup(),w=activate(s,owner.sessionId,'pinwheel');
  p.placeAt(1900-p.width/2,2100-p.height/2);bolt(s,w);updateWeapons(s,.01,NOW);
  assert(credits[0].glancing,'an overlapping weapon firing AWAY from the center only grazes');assert.equal(p.injuredUntil,0);
}
{
  const {s,owner,p,credits}=setup(),w=activate(s,owner.sessionId,'ion');s.time+=WEAPON_FLEET.ION_WARNING_MS;
  const at=orbitalPosition(w.originX,w.originY,WEAPON_FLEET.ION_WARNING_MS,4200,4200);
  p.placeAt(at.x+800-p.width/2,at.y-p.height/2);updateWeapons(s,0,NOW);
  assert(credits[0].glancing,'a beam tip cannot deal a direct hit to a core beyond its visible reach');assert.equal(p.injuredUntil,0);
}
for (const gems of [20, 40, 100]) {
  const { s, owner, p } = setup(gems), w = activate(s, owner.sessionId, 'pinwheel');
  const width = p.width; p.placeAt(2350 - width / 2, 2100 + width * .4 - width / 2); bolt(s, w); updateWeapons(s, .6, NOW);
  const expected = Math.min(gems, Math.ceil(gems * .45), Math.max(12, Math.ceil(Math.sqrt(gems) * 2.4)));
  assert.equal(p.gems, gems - expected, 'small-body edge hits retain existing damage'); assert.equal(p.weaponSafeUntil, s.time);
}
for (const core of [false, true]) {
  const { s, owner, p, credits, impacts } = setup(), w = activate(s, owner.sessionId, 'pulsar');
  p.placeAt(w.x + (core ? 180 : 600) - p.width / 2, w.y - p.height / 2); w.beatAt = s.time;
  updateWeapons(s, 0, NOW);
  for (let age = 25; age <= 950; age += 25) { s.time = 1000 + age; updateWeapons(s, .025, NOW + age); }
  assert.equal(p.gems, core ? 3750 : 5000, 'wave damage waits for the bounded core; shell-only contact is harmless');
  assert.equal(credits.length, core ? 1 : 0); assert.equal(owner.gems, core ? 1250 : 0);
  assert.equal(impacts.filter(i => i.glancing).length, 1, 'one quiet deflection flash per wave');
  assert.equal(p.injuredUntil > 0, core);
}
{
  const { s, owner, p, credits } = setup(); const other = s.addPlayer('other', 'Other builder', NOW); other.placeAt(100, 500);
  const w = activate(s, owner.sessionId, 'pinwheel'), second = new PinwheelSchema(); s.weaponSets.push(second);
  activate(s, other.sessionId, 'sentinel', second); p.placeAt(2350 - p.width / 2, 2100 - p.height / 2);
  bolt(s, w); bolt(s, second); updateWeapons(s, .6, NOW);
  const firstLoss = 5000 - p.gems, until = p.weaponSafeUntil, injury = p.injuredUntil;
  assert(firstLoss > 0); assert.equal(other.gems, 0); assert.equal(credits.length, 1, 'independent recipes share one guard');
  assert.equal(second.bolts.size, 0, 'guarded bolts are consumed instead of lodging inside a giant');
  s.time += 100; bolt(s, w, 'during-local-cooldown'); updateWeapons(s, .1, NOW + 100);
  assert.equal(w.bolts.size, 0); assert.equal(p.gems, 5000 - firstLoss); assert.equal(p.weaponSafeUntil, until, 'blocked hits cannot extend protection');
  s.time = until; bolt(s, second, 'after'); updateWeapons(s, .6, NOW + 900);
  assert(other.gems > 0, 'a later well-aimed hit can damage normally'); assert.equal(p.injuredUntil, injury, 'active injury remains non-refreshing');
  assert.equal(p.gems + owner.gems + other.gems, 5000, 'all transferred damage remains conserved');
  s.spawn(p, NOW + 2000); assert.equal(p.weaponSafeUntil, 0, 'respawn clears the guard');
  p.weaponSafeUntil = 99999; p.knockOut(NOW); assert.equal(p.weaponSafeUntil, 0, 'death clears the guard');
}
{
  const { s, owner, p } = setup(); p.placeAt(2350 - p.width / 2, 2100 - p.height / 2); p.weaponSafeUntil = 99999;
  const shot = s.addPlayer('shot', 'Cannonball', NOW); shot.setGems(1000, 4200, 4200);
  shot.placeAt(1800 - shot.width / 2, 2100 - shot.height / 2); shot.spawnProtected = false;
  shot.launch(NOW, 2000, 0, owner.sessionId, 5000, 0); updateFlights(s, NOW + 300, .3);
  assert(p.gems < 5000, 'weapon guard does not grant cannonball immunity');
}
{
  const { s, owner, p } = setup(); p.injure(s.time); const deadline = p.injuredUntil;
  weaponDamage(s, p, owner.sessionId, 100, NOW, true); assert.equal(p.injuredUntil, deadline, 'a graze cannot clear or extend existing injury');
  assert.equal(weaponCoreRadius(100), 50); assert.equal(weaponCoreRadius(1000), 90);
  assert.equal(weaponHitPause(180), 0); assert.equal(weaponHitPause(500), 900); assert.equal(weaponHitPause(1260), 900);
  assert(allWeapons(s).length > 0);
}
console.log('Weapon fairness passed: all recipes and bot parity, direct/grazing hits, bounded pulse core, shared guard, consumed blocked bolts, exact rewards, injury, cleanup and independent cannon rules.');
