import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { spawnPinwheel, updatePinwheel, puffWeaponParts } from '../systems/pinwheel.js';
import { PINWHEEL } from '../constants/gameConstants.js';

const NOW = 100000;
function setup() {
  const s = new GameState(0); s.botFill = 0; s.weaponsOn = true; s.time = 1000;
  const a = s.addPlayer('builder', 'Builder', NOW);
  const b = s.addPlayer('rival', 'Rival', NOW);
  for (const p of [a, b]) { p.spawnProtected = false; p.placeAt(1400, 1400); p.facing = 0; }
  spawnPinwheel(s, 2000, 2000);
  return { s, w: s.pinwheel, a, b };
}
{
  const { s, w, a, b } = setup();
  const abandoned = w.parts[1]; assert(abandoned);
  abandoned.owner = 'departed-contributor';
  updatePinwheel(s, 0.01, NOW);
  assert.equal(abandoned.owner, '', 'a disconnected contributor cannot strand a required part');
  a.startInhale(NOW);
  const hub = w.parts[0]; assert(hub);
  hub.x = a.x + a.width * 0.8 + 5; hub.y = a.y + a.height / 2;
  updatePinwheel(s, 0.1, NOW);
  assert.equal(w.owner, a.sessionId); assert.equal(w.claimUntil, s.time + 18000);
  const claim = w.claimUntil;
  s.time += 1000; updatePinwheel(s, 0.1, NOW + 1000);
  assert.equal(w.claimUntil, claim, 'holding the same part cannot renew a claim forever');
  a.stopInhale(NOW + 1000);
  b.placeAt(1400, 1400); b.startInhale(NOW + 1000);
  updatePinwheel(s, 0.1, NOW + 1000);
  assert.equal(hub.owner, a.sessionId, 'rival suction cannot steal a claimed part');
  const x = hub.x;
  hub.x += 60; puffWeaponParts(s, b); updatePinwheel(s, 0.1, NOW + 1000);
  assert(hub.x > x + 60, 'gusts can disrupt claimed pieces');
  b.stopInhale(NOW + 1000);
  s.time = claim; updatePinwheel(s, 0.01, NOW + claim);
  assert.equal(w.owner, ''); assert(w.parts.every(p => p.owner === ''), 'abandoned parts unlock after 18 seconds');
}
{
  const { s, w, a, b } = setup();
  w.owner = a.sessionId; w.claimUntil = s.time + 18000; w.progress = 3;
  for (const part of w.parts) { part.x = 2000 + part.kind * 20; part.y = 2000; part.owner = part.kind === 2 ? b.sessionId : a.sessionId; }
  updatePinwheel(s, 0.01, NOW);
  assert.equal(w.phase, 'charging'); assert.equal(w.owner, a.sessionId, 'contributing the last piece does not steal the weapon');
  assert.equal(w.parts.length, 0);
  s.time = w.at; updatePinwheel(s, 0.01, NOW);
  assert.equal(w.phase, 'active');
  s.time += PINWHEEL.SHOT_MS; updatePinwheel(s, 0.01, NOW);
  assert.equal(w.bolts.size, 1, 'the assembled wheel actually fires');
  b.setGems(100, s.worldWidth, s.worldHeight); b.placeAt(2250, 1950);
  a.placeAt(2100, 1990);
  w.bolts.clear();
  const bolt = new WeaponBoltSchema(); bolt.x = 2090; bolt.y = 2000; bolt.bornAt = s.time; bolt.angle = 0;
  w.bolts.set('test', bolt);
  updatePinwheel(s, 0.4, NOW);
  assert(b.gems < 100 && b.gems >= 94, 'swept collision hits a target across a long tick with bounded damage');
  assert.equal(a.gems, 0, 'the builder is not hit by their weapon');
  assert(!b.stunned, 'weapon bolts do not repeatedly stun targets');
  assert(!w.bolts.has('test'), 'each bolt hits once');
  s.time = w.at; updatePinwheel(s, 0.01, NOW);
  assert.equal(w.phase, 'waiting'); assert.equal(w.bolts.size, 0);
}
console.log('Pinwheel regressions passed: claims, disruption, expiry, assembly ownership, firing and bounded hits.');
