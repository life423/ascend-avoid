import assert from 'node:assert/strict';
import { EXHALE } from '../constants/gameConstants.js';
import { bodyMass } from '../game/creatureSize.js';
import { puffDrift, rearGustImpulses } from '../game/puffImpulse.js';
import { GameState } from '../schema/GameState.js';
import { exhale } from '../systems/inhale.js';
import { updateGustWaves } from '../systems/gustWaves.js';

const NOW = 100000;
function scene(bot: boolean) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off');
  s.update(0, NOW); s.blackHoles.clear();
  const p = s.addPlayer('runner', 'Runner', NOW); p.setGems(100, 4200, 4200);
  p.placeAt(2100, 2100); p.facing = 0; p.isBot = bot; p.dropProtection();
  return { s, p };
}

for (const count of [1, 2, 10, 20]) for (const width of [20, 100, 400]) {
  const targets = Array.from({ length: count }, (_, i) => ({ id: String(i), width, falloff: .7 }));
  const hits = rearGustImpulses(100, targets);
  assert(hits.every(hit => hit.velocity <= EXHALE.REAR_SPEED_CAP + 1e-9));
  assert(hits.reduce((sum, hit) => sum + hit.impulse, 0) <= bodyMass(100) * EXHALE.IMPULSE_RECOIL_CAP * EXHALE.REAR_IMPULSE_SCALE + 1e-6,
    'several targets share a finite cast budget');
  if (width === 400) assert(hits[0].velocity < EXHALE.REAR_SPEED_CAP, 'a small caster cannot throw a giant at the cap');
}
assert.deepEqual(rearGustImpulses(100, []), []);

for (const bot of [false, true]) {
  const { s, p } = scene(bot);
  const targets = ['a', 'b', 'later'].map(id => {
    const t = s.addPlayer(id, id, NOW); t.setGems(100, 4200, 4200); t.isBot = bot;
    t.placeAt(2100 - t.width - 80, 2100); t.facing = 0; t.dropProtection();
    return t;
  });
  targets[2].spawnProtected = true;
  for (const t of targets.slice(0, 2)) t.startInhale(NOW);
  exhale(s, p, NOW); const wave = s.gustWaves.get(p.sessionId); assert(wave);
  const budget = wave.remainingImpulse;
  s.time = EXHALE.WAVE_WRAP_MS; s.now = NOW + s.time; updateGustWaves(s, s.now);
  const spent = targets.reduce((sum, t) => sum + Math.abs(t.gustVx) * bodyMass(t.width), 0);
  assert(spent <= budget + 1e-6 && Math.abs(budget - wave.remainingImpulse - spent) < 1e-6);
  for (const t of targets.slice(0, 2)) {
    assert(t.gustVx < 0 && t.puffVx === 0 && !t.stunned && !t.sliding);
    const x = t.x, y = t.y, speed = t.gustVx;
    t.pushWithControl(0, 1, 120); // an independent ordinary weapon-style push
    t.steer(0, 1); t.updateMovement(4200, 4200, s.now + 100, .1);
    assert(t.x < x - 15 && t.y > y, 'rear wind is perceptible while steering stays available');
    assert(Math.abs(t.gustVx - speed * Math.exp(-EXHALE.REAR_DRAG * .1)) < 1e-9);
    assert(Math.abs(t.puffVy - 120 * Math.exp(-EXHALE.DRAG * .1)) < 1e-9, 'weapon drift retains the original decay');
    const push = t.gustVx; updateGustWaves(s, s.now + 100);
    assert.equal(t.gustVx, push, 'the same cast cannot add a second hit');
    for (let i = 0; i < 30; i++) t.pushByGust(-1, -1, EXHALE.REAR_SPEED_CAP);
    assert(Math.hypot(t.gustVx, t.gustVy) <= EXHALE.REAR_SPEED_CAP + 1e-9, 'overlapping casters cannot multiply wind speed');
    for (let i = 0; i < 90; i++) t.updateMovement(4200, 4200, s.now + 120 + i * 17, .017);
    assert.equal(t.gustVx, 0); assert.equal(t.gustVy, 0);
    t.pushByGust(-1, 0, 200); t.placeAt(1500, 1500); assert.equal(t.gustVx, 0);
    t.pushByGust(-1, 0, 200); t.launch(s.now, 600, 0, p.sessionId, 1000); assert.equal(t.gustVx, 0);
    t.land(); t.pushByGust(-1, 0, 200); t.knockOut(s.now); assert.equal(t.gustVx, 0);
  }
  targets[2].spawnProtected = false; targets[2].startInhale(s.now);
  const left = wave.remainingImpulse; updateGustWaves(s, s.now);
  assert(wave.remainingImpulse >= 0 && wave.remainingImpulse <= left);
  assert(Math.abs(targets[2].gustVx) * bodyMass(targets[2].width) <= left + 1e-6, 'later arrivals cannot reuse the spent budget');
  const count = s.gustWaves.size, breath = p.stamina;
  exhale(s, p, NOW + 100); assert.equal(s.gustWaves.size, count);
  assert(p.stamina >= breath && p.stamina < EXHALE.BREATH_COST, 'rejected attempts preserve normal refill without spending breath');
}
// The prediction helper and server use the same short exponential displacement.
for (const dt of [1 / 120, 1 / 60, 1 / 30, .1]) {
  const { p } = scene(false); p.pushByGust(-1, 0, 250);
  const predicted = { x: p.x, y: p.y, width: p.width, height: p.height };
  puffDrift(predicted, { x: p.gustVx, y: p.gustVy }, dt, 4200, 4200, EXHALE.REAR_DRAG);
  p.updateMovement(4200, 4200, NOW + dt * 1000, dt);
  assert(Math.abs(predicted.x - p.x) < 1e-9 && Math.abs(predicted.y - p.y) < 1e-9);
  p.placeAt(8, 8); p.pushByGust(-1, -1, 320); p.updateMovement(4200, 4200, NOW + 100, .1);
  assert(p.x >= 8 && p.y >= 8 && p.gustVx === 0 && p.gustVy === 0, 'wind cannot move a body outside the map');
}
console.log('Rear gust passed: finite shared budget, mass resistance, multi-caster cap, independent weapon decay, real separation with steering, cooldown, expiry, lifecycle, boundaries, prediction and actor parity.');
