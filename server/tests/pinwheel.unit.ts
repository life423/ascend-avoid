import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { spawnWeapon, updateWeapons, puffWeaponParts, deployWeapon } from '../systems/weapons.js';
import { PINWHEEL } from '../constants/gameConstants.js';

const NOW = 100000;
function setup() {
  const s = new GameState(0); s.botFill = 0; s.weaponsOn = true; s.time = 1000;
  const a = s.addPlayer('builder', 'Builder', NOW);
  const b = s.addPlayer('rival', 'Rival', NOW);
  for (const p of [a, b]) { p.spawnProtected = false; p.placeAt(1400, 1400); p.facing = 0; }
  spawnWeapon(s, 2000, 2000);
  return { s, w: s.pinwheel, a, b };
}
{
  const { s, w, a, b } = setup();
  const hub = w.parts[0]; assert(hub);
  b.placeAt(1000, 1000);
  a.placeAt(hub.x - a.width / 2, hub.y - a.height / 2);
  a.facing = Math.PI;
  assert(!a.inhaling);
  updateWeapons(s, 0.01, NOW);
  assert.equal(hub.carriedBy, a.sessionId, 'gliding over a part picks it up without inhaling or facing it');
  assert.equal(w.owner, a.sessionId);
  assert.equal(w.claimUntil, s.time + 18000);
  a.placeAt(1000, 1000);
  updateWeapons(s, 0.01, NOW);
  hub.carriedBy = ''; hub.x = 1700; hub.y = 1700;
  b.placeAt(hub.x - b.width / 2, hub.y - b.height / 2);
  updateWeapons(s, 0.01, NOW);
  assert.equal(hub.carriedBy, '', 'touching cannot steal another player\'s claimed loose part');
  assert.equal(hub.owner, a.sessionId);
  s.time = w.claimUntil;
  updateWeapons(s, 0.01, NOW + 18000);
  assert.equal(hub.carriedBy, b.sessionId, 'a touching rival can collect the part once its claim expires');
  assert.equal(w.owner, b.sessionId);
}
{
  const { s, w, a, b } = setup();
  const hub = w.parts[0]; assert(hub);
  b.placeAt(1000, 1000);
  hub.x = a.x + a.width * 0.8 + 90; hub.y = a.y + a.height / 2;
  const start = hub.x;
  a.startInhale(NOW);
  updateWeapons(s, 0.1, NOW);
  assert(hub.x < start && !hub.carriedBy, 'inhale pulls in a part before physical contact');
  for (let tick = 0; tick < 5 && !hub.carriedBy; tick++) updateWeapons(s, 0.1, NOW);
  assert.equal(hub.carriedBy, a.sessionId, 'inhaling still collects parts from a distance');
}
{
  const { s, w, a, b } = setup();
  const abandoned = w.parts[1]; assert(abandoned);
  abandoned.owner = 'departed-contributor';
  updateWeapons(s, 0.01, NOW);
  assert.equal(abandoned.owner, '', 'a disconnected contributor cannot strand a required part');
  a.startInhale(NOW);
  const hub = w.parts[0]; assert(hub);
  hub.x = a.x + a.width * 0.8 + 5; hub.y = a.y + a.height / 2;
  updateWeapons(s, 0.1, NOW);
  assert.equal(w.owner, a.sessionId); assert.equal(w.claimUntil, s.time + 18000);
  s.time += 1000; updateWeapons(s, 0.1, NOW + 1000);
  assert.equal(w.claimUntil, s.time + PINWHEEL.CLAIM_MS, 'carrying a piece keeps the matching set reserved');
  a.stopInhale(NOW + 1000);
  a.placeAt(900, 900); a.facing = Math.PI / 2;
  updateWeapons(s, 0.1, NOW + 1000);
  assert.equal(hub.carriedBy, a.sessionId, 'releasing inhale keeps the part carried');
  assert(Math.hypot(hub.x - a.x - a.width / 2, hub.y - a.y - a.height / 2) < a.width / 2 + 44, 'cargo follows movement and turning');
  b.placeAt(1400, 1400); b.startInhale(NOW + 1000);
  updateWeapons(s, 0.1, NOW + 1000);
  assert.equal(hub.owner, a.sessionId, 'rival suction cannot steal a claimed part');
  const x = hub.x;
  b.placeAt(hub.x - 110, hub.y - b.height / 2); b.facing = 0;
  puffWeaponParts(s, b); updateWeapons(s, 0.1, NOW + 1000);
  assert(hub.x > x + 30 && !hub.carriedBy, 'gusts knock carried pieces loose');
  b.stopInhale(NOW + 1000);
  s.time = w.claimUntil; updateWeapons(s, 0.01, NOW + s.time);
  assert.equal(w.owner, ''); assert(w.parts.every(p => p.owner === ''), 'abandoned parts unlock after 18 seconds');
}
{
  const { s, w, a, b } = setup();
  w.owner = a.sessionId; w.claimUntil = s.time + 18000; w.progress = 3;
  for (const part of w.parts) { part.x = 2000 + part.kind * 20; part.y = 2000; part.owner = part.kind === 2 ? b.sessionId : a.sessionId; }
  updateWeapons(s, 0.01, NOW);
  assert.equal(w.phase, 'carried'); assert.equal(w.owner, a.sessionId, 'contributing the last piece does not steal the weapon');
  assert.equal(w.parts.length, 0);
  assert.equal(deployWeapon(s, b), false, 'a rival cannot place the builder\'s weapon');
  a.placeAt(2500, 2300); a.facing = Math.PI / 2;
  updateWeapons(s, 0.01, NOW);
  assert(w.x > 2400 && w.y > 2200, 'the complete weapon moves with its builder');
  assert.equal(w.bolts.size, 0, 'carrying does not fire the weapon');
  s.time += PINWHEEL.CLAIM_MS + 2000;
  updateWeapons(s, 0.01, NOW);
  assert.equal(w.phase, 'carried', 'the builder chooses placement; the weapon never auto-places at a timer deadline');
  assert(deployWeapon(s, a));
  assert.equal(w.phase, 'charging');
  s.time = w.at; updateWeapons(s, 0.01, NOW);
  assert.equal(w.phase, 'active');
  s.time += PINWHEEL.SHOT_MS; updateWeapons(s, 0.01, NOW);
  assert.equal(w.bolts.size, 1, 'the assembled wheel actually fires');
  b.setGems(100, s.worldWidth, s.worldHeight); b.placeAt(2250, 1950);
  a.placeAt(2100, 1990);
  w.bolts.clear();
  const bolt = new WeaponBoltSchema(); bolt.x = 2090; bolt.y = 2000; bolt.bornAt = s.time - 3000; // Already-live projectile: launch safety is tested separately.
 bolt.angle = 0;
  w.bolts.set('test', bolt);
  updateWeapons(s, 0.4, NOW);
  assert.equal(b.gems, 76, 'a swept bolt removes 24 gems from a 100-gem target, up from 16');
  assert(b.injuredUntil > s.time, 'a damaging Pinwheel hit exposes gems');
  assert.equal(a.gems, 24, 'the builder receives the actual removed gems');
  assert(!b.stunned, 'weapon bolts do not repeatedly stun targets');
  assert(!b.sliding && !b.recovering && b.puffVx > 0, 'a bolt push retains steering instead of starting an impact skid');
  assert(!w.bolts.has('test'), 'each bolt hits once');
  s.time = w.at; updateWeapons(s, 0.01, NOW);
  assert.equal(w.phase, 'waiting'); assert.equal(w.bolts.size, 0);
}
for (const gems of [0, 7, 10, 20, 100, 1000]) {
  const { s, w, a, b } = setup();
  a.placeAt(1500, 1500); b.setGems(gems, s.worldWidth, s.worldHeight); b.placeAt(2200, 2000 - b.width / 2);
  w.owner = a.sessionId; w.phase = 'active'; w.at = s.time + 8000; w.nextShotAt = s.time + 10000;
  const bolt = new WeaponBoltSchema(); bolt.x = 2090; bolt.y = 2000; bolt.angle = 0; bolt.bornAt = s.time - 3000; // Already-live projectile: launch safety is tested separately.

  w.bolts.set('damage', bolt);
  const credit: Record<string, unknown>[] = []; s.onEvent = (type, data) => { if (type === 'credit') credit.push(data); };
  updateWeapons(s, .4, NOW);
  const lost = Math.min(gems, Math.ceil(gems * PINWHEEL.HIT_SHARE), Math.max(PINWHEEL.HIT_MIN_GEMS, Math.ceil(Math.sqrt(gems) * PINWHEEL.HIT_PER_ROOT)));
  const out = gems - lost < 8;
  assert.equal(b.state, out ? 'dead' : 'alive'); assert.equal(b.gems, out ? 0 : gems - lost);
  assert(credit.some(c => c.how === 'pinwheel' && c.out === out && c.byId === a.sessionId));
  assert.equal(a.gems, gems - b.gems, 'actual bolt losses reward the assembler, including knockouts');
  assert.equal([...s.gems.values()].reduce((sum, g) => sum + g.value, 0), 0, 'rewarded gems do not also spill');
  if (out) { s.weaponsOn = false; s.update(0, b.respawnAt); assert(b.spawnProtected && b.width === 20 && b.state === 'alive'); }
}
{
  const { s, w, a, b } = setup(); a.placeAt(100, 100); b.placeAt(100, 400);
  w.owner = a.sessionId; w.phase = 'active'; w.at = s.time + 8000; w.nextShotAt = s.time + PINWHEEL.SHOT_MS;
  const angles = new Map<string, number>();
  for (let i = 0; i < 200; i++) {
    s.time += 20; updateWeapons(s, .02, NOW + s.time);
    for (const [id, bolt] of w.bolts) angles.set(id, bolt.angle);
  }
  assert(angles.size >= 12 && angles.size <= 13, 'spaced spinning fire launches about three bolts per second');
  assert(new Set([...angles.values()].map(a => Math.floor(a * 10))).size >= 10, 'straight bullets retain the outward spiral with wider gaps');
}
console.log('Pinwheel regressions passed: claims, carrying, rapid spiral fire, mass-scaled damage, knockout credit and respawn.');
