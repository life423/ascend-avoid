import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { WEAPON_INJURY, GEMS, INHALE, EXHALE } from '../constants/gameConstants.js';
import { WeaponInjuryPressure, weaponInjuryShare } from '../game/weaponInjury.js';
import { bodyMass } from '../game/creatureSize.js';
import { weaponDamage } from '../systems/weaponDamage.js';
import { exhale, updateInhales } from '../systems/inhale.js';
const NOW = 100000, W = 4200;
function scene(bot = false) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off'); s.time = 1000; s.now = NOW;
  const p = s.addPlayer('target', 'Target', NOW), owner = s.addPlayer('builder', 'Builder', NOW);
  p.setGems(5000, W, W); p.placeAt(2100, 2100); owner.placeAt(100, 100);
  p.dropProtection(); owner.dropProtection(); p.isBot = bot;
  return { s, p, owner };
}
assert.equal(WEAPON_INJURY.MASS_SHARE, .05); assert.equal(WEAPON_INJURY.BURST_WINDOW_MS, 2000);
assert.equal(INHALE.INJURY_MS, 7000); assert.equal(EXHALE.BREATH_COST, .75);
assert.equal(weaponInjuryShare(100, 600), 50 / 1800);
assert.equal(weaponInjuryShare(100, 300), 50 / 450);
for (const value of [0, -1, Infinity, NaN]) assert.equal(weaponInjuryShare(value, 600), 0);
{
  const p = new WeaponInjuryPressure();
  assert(!p.hit(0, 90, 600)); assert(p.hit(900, 90, 600), 'two accepted half-threshold hits earn injury');
  assert.equal(p.pressure(900), 0, 'an earned injury consumes the burst');
  assert(p.hit(1000, 180, 600), 'one threshold-sized physical impact is sufficient');
}
{
  const p = new WeaponInjuryPressure();
  for (let i = 0; i < 10; i++) assert(!p.hit(i * 1900, 80, 600), 'trickled hits cannot keep older contributions alive');
  assert(p.pressure(17100) > 0); assert.equal(p.pressure(19100), 0, 'hits expire at the exact rolling-window boundary');
  assert(!p.hit(20000, 90, 600)); assert(!p.hit(22000, 90, 600), 'a hit at expiry starts fresh');
  assert.equal(p.pressure(21000), 0, 'future timestamps cannot survive a clock reset');
}
for (const bot of [false, true]) {
  const { s, p, owner } = scene(bot);
  const massBefore = bodyMass(p.width);
  const first = weaponDamage(s, p, owner.sessionId, 110, NOW);
  assert.deepEqual(first, { lost: 110, out: false, earned: 110 });
  assert.equal(p.injuredUntil, 0); assert(!p.breathingBlocked);
  const pressure = p.weaponInjury.pressure(s.time);
  assert.equal(pressure, 110 * GEMS.GROWTH_MASS_PER_GEM / massBefore);
  s.time += 500;
  for (let i = 0; i < 30; i++) assert(weaponDamage(s, p, owner.sessionId, 10000, NOW + 500).blocked);
  assert.equal(p.weaponInjury.pressure(s.time), pressure); assert.equal(p.gems, 4890);
  s.time += 400; const second = weaponDamage(s, p, owner.sessionId, 110, NOW + 900);
  assert.equal(second.lost, 110); assert.equal(p.injuredUntil, s.time + 7000); assert(p.breathingBlocked);
  assert.equal(p.weaponInjury.pressure(s.time), 0); assert.equal(owner.weaponDamage, 220); assert.equal(owner.gems + p.gems, 5000);
  const deadline = p.injuredUntil;
  s.time += 900; weaponDamage(s, p, owner.sessionId, 110, NOW + 1800);
  assert.equal(p.injuredUntil, deadline, 'weapon bursts never refresh active injury');
  assert.equal(p.weaponInjury.pressure(s.time), 0, 'no pressure is banked during injury');
  s.time = deadline; weaponDamage(s, p, owner.sessionId, 1, NOW + deadline);
  assert.equal(p.injuredUntil, deadline, 'one chip cannot use the old burst to reopen injury');
  assert(p.weaponInjury.pressure(s.time) > 0);
}
{
  const { s, p, owner } = scene(); weaponDamage(s, p, owner.sessionId, 110, NOW);
  s.time += 500; weaponDamage(s, p, owner.sessionId, 10000, NOW + 500);
  s.time += 1600; weaponDamage(s, p, owner.sessionId, 110, NOW + 2100);
  assert.equal(p.injuredUntil, 0, 'blocked requests cannot refresh the contribution lifetime');
}
{
  const { s, p, owner } = scene();
  weaponDamage(s, p, owner.sessionId, 1000, NOW, true);
  assert.equal(p.gems, 4750); assert.equal(owner.gems, 250); assert.equal(p.injuredUntil, 0);
  assert.equal(p.weaponInjury.pressure(s.time), 0, 'even a large graze cannot contribute or cause injury');
  s.time += 900; weaponDamage(s, p, owner.sessionId, 80, NOW + 900);
  const pressure = p.weaponInjury.pressure(s.time);
  s.time += 900; weaponDamage(s, p, owner.sessionId, 40, NOW + 1800, true);
  assert.equal(p.weaponInjury.pressure(s.time), pressure, 'grazes neither add nor refresh pressure');
}
for (const reason of ['injury', 'protection', 'death', 'respawn', 'launch', 'disconnect'] as const) {
  const { s, p, owner } = scene(); weaponDamage(s, p, owner.sessionId, 110, NOW);
  assert(p.weaponInjury.pressure(s.time) > 0);
  if (reason === 'injury') p.injure(s.time);
  if (reason === 'protection') p.protectFor(1000, NOW);
  if (reason === 'death') p.knockOut(NOW);
  if (reason === 'respawn') s.spawn(p, NOW + 3000);
  if (reason === 'launch') p.launch(NOW, 1200, 0, owner.sessionId, 1000);
  if (reason === 'disconnect') s.removePlayer(p.sessionId);
  assert.equal(p.weaponInjury.pressure(s.time), 0, reason + ' clears the previous burst');
}
{
  const { s, p, owner } = scene(); weaponDamage(s, p, owner.sessionId, 110, NOW);
  owner.setGems(30000, W, W); owner.placeAt(1000, 2100); owner.facing = 0;
  p.placeAt(owner.x + owner.width * .8, owner.y + (owner.width - p.width) / 2);
  p.recaptureAfter = 0; owner.startInhale(NOW); updateInhales(s, NOW, .033);
  assert.equal(p.capturedBy, owner.sessionId); assert.equal(p.weaponInjury.pressure(s.time), 0, 'capture clears pressure before gem transfer');
}
{
  const { s, p, owner } = scene(); weaponDamage(s, p, owner.sessionId, 1, NOW);
  p.injure(s.time); const until = p.injuredUntil; p.injure(s.time + 6900);
  assert.equal(p.injuredUntil, until, 'direct player damage retains fixed seven-second injury');
}
{
  const { s, p, owner } = scene(); weaponDamage(s, p, owner.sessionId, 110, NOW);
  exhale(s, p, NOW);
  assert(Math.abs(p.stamina - .25) < 1e-9, 'non-injuring weapon damage leaves ordinary puff available');
  s.time += 900; weaponDamage(s, p, owner.sessionId, 110, NOW + 900);
  p.stamina = 1; p.staminaAt = NOW + 900; exhale(s, p, NOW + 900);
  assert.equal(p.stamina, 1, 'the existing injured-puff restriction is unchanged');
}
{
  const { s, p, owner } = scene(); p.setGems(6, W, W);
  const hit = weaponDamage(s, p, owner.sessionId, 2, NOW);
  assert(hit.out); assert.equal(p.state, 'dead'); assert.equal(owner.weaponKnockouts, 1);
  assert.equal(p.weaponInjury.pressure(s.time), 0, 'ordinary knockout bypasses accumulation without extra reward');
}
console.log('Earned weapon injury passed: physical size scaling, single/burst thresholds, rolling expiry, rejected hits/grazes, fixed injury/no banking, exact damage/rewards, actor parity, capture/lifecycle and unchanged puff/knockout rules.');
