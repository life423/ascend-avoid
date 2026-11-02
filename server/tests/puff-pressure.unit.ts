import assert from 'node:assert/strict';
import { EXHALE, INHALE } from '../constants/gameConstants.js';
import { breathRate } from '../game/airflow.js';
import { GameState } from '../schema/GameState.js';
import { exhale, stealWeight, updateInhales } from '../systems/inhale.js';
import { updateGustWaves } from '../systems/gustWaves.js';

const NOW = 100000;
const near = (actual: number, expected: number) => assert(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
function pressure(values: ReadonlyMap<string, number>, id: string): number {
  const value = values.get(id); assert(value !== undefined, 'pressure entry remains present'); return value;
}
function scene(bot = false, rear = false) {
  const s = new GameState(0);
  s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = s.trafficHits = false;
  s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear();
  const defender = s.addPlayer('defender', 'Defender', NOW), attacker = s.addPlayer('attacker', 'Attacker', NOW);
  for (const p of [defender, attacker]) {
    p.setGems(100, 4200, 4200); p.isBot = bot; p.dropProtection();
  }
  defender.placeAt(2100, 2100); defender.facing = 0;
  attacker.placeAt(2100 + (rear ? -1 : 1) * (defender.width + 80), 2100);
  attacker.facing = rear ? 0 : Math.PI;
  return { s, defender, attacker };
}

for (const bot of [false, true]) for (const rear of [false, true]) {
  const { s, defender, attacker } = scene(bot, rear);
  attacker.startInhale(NOW);
  attacker.lockOn.set(defender.sessionId, .7);
  attacker.heldFor.set(defender.sessionId, 2);
  attacker.latchTarget = defender.sessionId;
  attacker.beamFocus = .8;
  assert(stealWeight(s, attacker, defender) > 0);
  const events: string[] = []; s.onEvent = type => events.push(type);
  exhale(s, defender, NOW);
  if (rear) { s.time = EXHALE.WAVE_WRAP_MS; updateGustWaves(s, NOW + s.time); }
  assert(attacker.inhaling, 'front/rear puff preserves the held inhale for both actor types');
  assert.equal(attacker.lockOn.get(defender.sessionId), .7);
  assert.equal(attacker.heldFor.get(defender.sessionId), 2);
  assert.equal(attacker.latchTarget, defender.sessionId);
  assert.equal(attacker.beamFocus, .8);
  assert.equal(attacker.inhaleBlockedUntil, 0, 'no forced restart delay');
  assert(!events.includes('parry'), 'no misleading pressure-break event');
  assert(rear ? attacker.gustVx < 0 : attacker.puffVx > 0, 'the existing physical shove still lands');

  // Latch retention was checked above; exercise ordinary cone-pressure decay independently.
  attacker.dropLatch();
  updateInhales(s, NOW + s.time, .01);
  const locked = pressure(attacker.lockOn, defender.sessionId), held = pressure(attacker.heldFor, defender.sessionId);
  assert(locked > .7 && held > 2, 'pressure can keep building while contact remains valid');
  attacker.placeAt(800, 800);
  updateInhales(s, NOW + s.time + 50, .05);
  const decayed = pressure(attacker.lockOn, defender.sessionId);
  assert(decayed > 0 && decayed < locked, 'lost range uses ordinary gradual pressure decay');
  assert(pressure(attacker.heldFor, defender.sessionId) < held);
  assert(attacker.inhaling, 'losing contact does not release the held input');
  attacker.placeAt(2100 + (rear ? -1 : 1) * (defender.width + 80), 2100);
  updateInhales(s, NOW + s.time + 60, .01);
  assert(pressure(attacker.lockOn, defender.sessionId) > decayed, 'reconnecting resumes from remaining pressure');
  attacker.facing += Math.PI;
  const aimed = pressure(attacker.lockOn, defender.sessionId);
  updateInhales(s, NOW + s.time + 110, .05);
  assert(pressure(attacker.lockOn, defender.sessionId) < aimed, 'lost aim still decays pressure normally');
}

for (const bot of [false, true]) {
  const { s, defender: p } = scene(bot);
  let accepted = 0; s.onEvent = type => { if (type === 'exhale') accepted++; };
  p.staminaAt = NOW;
  exhale(s, p, NOW); near(p.stamina, .25);
  assert.equal(accepted, 1);
  assert.equal(EXHALE.COOLDOWN_MS, 0, 'there is no fixed puff lockout');
  for (let ms = 1; ms < 1500; ms += 17) { s.time = ms; exhale(s, p, NOW + ms); }
  assert.equal(accepted, 1, 'rapid requests cannot bypass the full-meter breath cost');
  s.time = 1499; exhale(s, p, NOW + 1499); assert.equal(accepted, 1);
  s.time = 1500; exhale(s, p, NOW + 1500); near(p.stamina, 0); assert.equal(accepted, 2);
  s.time = 3749; exhale(s, p, NOW + 3749); assert.equal(accepted, 2);
  s.time = 3750; exhale(s, p, NOW + 3750); near(p.stamina, 0); assert.equal(accepted, 3);
  p.stamina = .74; p.staminaAt = NOW + 3750;
  exhale(s, p, NOW + 3750); near(p.stamina, .74); assert.equal(accepted, 3, 'insufficient breath is not partly spent');
}
{
  const { s, defender: p } = scene(); p.staminaAt = NOW;
  exhale(s, p, NOW); p.startInhale(NOW);
  assert(p.inhaling, 'remaining breath is still available for ordinary inhale');
  p.spendBreath(NOW + 500, 0);
  near(p.stamina, .25 + 500 * breathRate(0, .25));
  p.stopInhale(NOW + 500);
  const left = p.stamina; p.spendBreath(NOW + 1400, 0);
  near(p.stamina, left + 900 / INHALE.REFILL_MS);
}
console.log('Puff pressure/breath: front/rear human/bot pressure retention, normal range/aim decay, 75% full-meter cost, no fixed cooldown, rapid-request rejection, normal refill and ordinary inhale passed.');
