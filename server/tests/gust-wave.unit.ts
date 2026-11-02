import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { EXHALE } from '../constants/gameConstants.js';
import { exhale, stealWeight, updateHolds } from '../systems/inhale.js';
import { updateGustWaves } from '../systems/gustWaves.js';
import { distanceToWave, waveArcs, waveIntercepts, waveRadius } from '../game/gustWave.js';
import { BotBrain } from '../game/bots.js';
import { botMouth } from '../systems/bots.js';
const NOW = 100000;
// The same shared geometry drives the drawing, player hit band and airflow crossing.
assert(Math.abs(EXHALE.WAVE_HALF_ARC * 2 * 180 / Math.PI - 140) < 1e-9);
for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  const wave = { x: 2100, y: 2100, width: 600, facing, at: 0 }, radius = waveRadius(wave.width);
  const point = (degrees: number, distance = radius) => ({
    x: wave.x + Math.cos(facing + Math.PI + degrees * Math.PI / 180) * distance,
    y: wave.y + Math.sin(facing + Math.PI + degrees * Math.PI / 180) * distance,
  });
  const visible = waveArcs(wave, EXHALE.WAVE_WRAP_MS)[0];
  const angle = (p: { x: number; y: number }) => Math.atan2(p.y - wave.y, p.x - wave.x);
  const span = Math.abs(Math.atan2(Math.sin(angle(visible[visible.length - 1]) - angle(visible[0])), Math.cos(angle(visible[visible.length - 1]) - angle(visible[0]))));
  assert(Math.abs(span * 180 / Math.PI - 140) < 1e-9, 'visible rear arc is exactly 140 degrees');
  for (const side of [-1, 1]) {
    assert(waveIntercepts(wave, EXHALE.WAVE_WRAP_MS, point(side * 65, radius + 200), wave), 'new off-axis coverage works on both sides');
    assert(distanceToWave(wave, point(side * 65)) < EXHALE.WAVE_THICKNESS / 2, 'hit band matches the widened artwork');
    assert(!waveIntercepts(wave, EXHALE.WAVE_WRAP_MS, point(side * 80, radius + 200), wave), 'outside the arc stays outside');
    assert(distanceToWave(wave, point(side * 80)) > EXHALE.WAVE_THICKNESS / 2);
    assert(!waveIntercepts(wave, EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_PUSH_MS, point(side * 65, radius + 200), wave), 'coverage ends with the existing hit window');
  }
}
function scene(bot = false) {
  const s = new GameState(0);
  s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = false;
  s.setTurbines('off');
  s.blackHoles.clear();
  s.update(0, NOW);
  const runner = s.addPlayer('runner', 'Runner', NOW), chaser = s.addPlayer('chaser', 'Chaser', NOW);
  runner.setGems(0, 4200, 4200);
  chaser.setGems(100, 4200, 4200);
  runner.placeAt(1000, 1000);
  chaser.placeAt(870, 960);
  runner.facing = chaser.facing = 0;
  for (const p of [runner, chaser]) {
    p.isBot = bot;
    p.dropProtection();
  }
  return { s, runner, chaser };
}
for (const bot of [false, true]) for (const side of [-1, 1]) {
  const { s, runner, chaser } = scene(bot);
  runner.setGems(100000, 4200, 4200); runner.placeAt(2100 - runner.width / 2, 2100 - runner.width / 2);
  chaser.setGems(0, 4200, 4200);
  const r = waveRadius(runner.width), angle = Math.PI + side * 65 * Math.PI / 180;
  const center = { x: 2100 + Math.cos(angle) * r, y: 2100 + Math.sin(angle) * r };
  chaser.placeAt(center.x - chaser.width / 2, center.y - chaser.width / 2);
  chaser.facing = angle + Math.PI; chaser.startInhale(NOW);
  chaser.lockOn.set(runner.sessionId, .6);
  const oldEdge = Math.PI + side * 1.05;
  assert(Math.hypot(center.x - 2100 - Math.cos(oldEdge) * r, center.y - 2100 - Math.sin(oldEdge) * r) > chaser.width / 2 + EXHALE.WAVE_THICKNESS / 2, 'this body was outside the former rear band');
  exhale(s, runner, NOW); s.time = EXHALE.WAVE_WRAP_MS; updateGustWaves(s, NOW + s.time);
  assert(chaser.gustVx < 0 && !chaser.stunned && !chaser.sliding, 'new off-axis body receives the normal steerable rear shove');
  assert(chaser.inhaling && chaser.lockOn.get(runner.sessionId) === .6, 'wider coverage still preserves pressure');
  assert(Math.hypot(chaser.gustVx, chaser.gustVy) <= EXHALE.REAR_SPEED_CAP);
}
// Landing a front push cannot become another push when the same body crosses the rear sweep.
{
  const { s, runner, chaser } = scene();
  chaser.placeAt(1100, 960); exhale(s, runner, NOW);
  const wave = s.gustWaves.get(runner.sessionId)!;
  assert(wave.pushed.has(chaser.sessionId));
  chaser.placeAt(870, 960); const budget = wave.remainingImpulse;
  s.time = EXHALE.WAVE_WRAP_MS; updateGustWaves(s, NOW + s.time);
  assert.equal(chaser.puffVx, 0, 'no second hit on the same body');
  assert.equal(wave.remainingImpulse, budget);
}
// A gust cannot release someone else's prepared ammunition by disguising a stun as knockback.
{
  const { s, runner, chaser } = scene();
  const held = s.addPlayer('held', 'Held', NOW);
  held.capturedBy = chaser.sessionId; chaser.gulping = held.sessionId;
  chaser.gulpEndsAt = 5000;
  runner.facing = Math.PI; exhale(s, runner, NOW); updateHolds(s, NOW);
  assert(chaser.puffVx < 0 && !chaser.stunned && !chaser.sliding);
  assert.equal(chaser.gulping, held.sessionId); assert.equal(held.capturedBy, chaser.sessionId);
}
for (const bot of [false, true]) {
  const { s, runner, chaser } = scene(bot);
  chaser.startInhale(NOW);
  assert(stealWeight(s, chaser, runner) > 0);
  exhale(s, runner, NOW);
  assert.equal(s.gustWaves.size, 1);
  assert(Math.abs(runner.stamina - .25) < 1e-9);
  const wave = s.gustWaves.get(runner.sessionId);
  assert(wave);
  assert(waveArcs(wave, 0)[0].every(p => p.x > wave.x), 'the wave first leaves the front');
  assert.equal(waveArcs(wave, EXHALE.WAVE_WRAP_MS / 2).length, 2, 'two lobes wrap around both sides');
  assert(waveArcs(wave, EXHALE.WAVE_WRAP_MS)[0].every(p => p.x < wave.x), 'air reaches the rear');
  assert(!waveIntercepts(wave, 100, { x: 800, y: 1010 }, { x: 1010, y: 1010 }), 'the rear pulse has not arrived yet');
  s.time = EXHALE.WAVE_WRAP_MS;
  s.now = NOW + s.time;
  assert(stealWeight(s, chaser, runner) > 0, 'the artwork is never a suction barrier');
  updateGustWaves(s, s.now);
  assert(chaser.inhaling, 'rear wind keeps the pursuer inhaling');
  assert(!chaser.stunned && !chaser.sliding, 'rear pressure never locks movement');
  assert(chaser.gustVx < 0 && chaser.puffVx === 0, 'the pursuer receives separate rear wind, not a stronger weapon push');
  const y = chaser.y, facing = chaser.facing;
  chaser.steer(0, 1); chaser.aimAt(0, 1); chaser.updateMovement(4200, 4200, s.now + 17, .017);
  assert(chaser.y > y && chaser.facing !== facing, 'the pursuer moves and turns during the shove');
  const left = wave.remainingImpulse;
  updateGustWaves(s, s.now + 16);
  assert.equal(wave.remainingImpulse, left, 'the same body is pushed only once');
  assert.equal(runner.facing, 0);
  runner.steer(1, 0);
  const before = runner.x;
  runner.updateMovement(4200, 4200, s.now + 100, .1);
  assert(runner.x > before, 'the caster keeps moving through its own effect');
  assert.equal(wave.x, 1010, 'the visual remains at the cast, not a following shield');
  assert(!waveIntercepts(wave, s.time, { x: 1010, y: 1300 }, { x: 1010, y: 900 }), 'a side approach is outside the pulse');
  chaser.placeAt(870, 960); chaser.facing = 0;
  s.now += EXHALE.WAVE_PUSH_MS; s.time += EXHALE.WAVE_PUSH_MS;
  chaser.startInhale(s.now);
  assert(chaser.inhaling && stealWeight(s, chaser, runner) > 0, 'inhale can cross still-visible fading air');
  updateGustWaves(s, s.now);
  assert(chaser.inhaling, 'the fading arc cannot repeatedly interrupt or push');
  assert.equal(wave.remainingImpulse, left);
  exhale(s, runner, NOW + 300);
  assert.equal(s.gustWaves.get(runner.sessionId), wave, 'breath cost prevents another immediate cast');
  s.time = EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_FADE_MS;
  updateGustWaves(s, NOW + s.time);
  assert.equal(s.gustWaves.size, 0);
}
for (const reason of ['injury', 'empty breath', 'death', 'disconnect'] as const) {
  const { s, runner } = scene();
  if (reason === 'injury')
    runner.injure(s.time);
  if (reason === 'empty breath') {
    runner.stamina = .2;
    runner.staminaAt = NOW;
  }
  exhale(s, runner, NOW);
  if (reason === 'injury' || reason === 'empty breath')
    assert.equal(s.gustWaves.size, 0);
  else {
    if (reason === 'death')
      runner.knockOut(NOW + 1);
    else
      s.removePlayer(runner.sessionId);
    updateGustWaves(s, NOW + 1);
    assert.equal(s.gustWaves.size, 0);
  }
}
for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  const wave = { x: 500, y: 500, width: 200, facing: angle, at: 0 }, r = waveRadius(wave.width);
  const start = { x: 500 - Math.cos(angle) * (r + 100), y: 500 - Math.sin(angle) * (r + 100) };
  assert(waveIntercepts(wave, EXHALE.WAVE_WRAP_MS, start, { x: 500, y: 500 }), 'the passing pulse rotates with the cast');
  assert(!waveIntercepts(wave, EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_PUSH_MS, start, { x: 500, y: 500 }), 'the later visual is inactive');
}
for (const gems of [0, 100, 1000]) {
  const { runner } = scene(); runner.setGems(gems, 4200, 4200);
  runner.pushWithControl(-1, 0, 400); runner.steer(0, 1);
  const y = runner.y;
  for (let i = 1; i <= 36; i++) runner.updateMovement(4200, 4200, NOW + i * 17, .017);
  assert(runner.y > y + 30, 'small, medium and large bodies retain steering during air drift');
  assert.equal(runner.puffVx, 0, 'the shove dies away without a long slide');
  assert(!runner.stunned && !runner.sliding);
  runner.pushWithControl(1, 0, 400); runner.placeAt(1800, 1800);
  assert.equal(runner.puffVx, 0, 'a respawn/teleport clears air drift');
  runner.pushWithControl(1, 0, 400); runner.launch(NOW, 600, 0, 'shooter', 1000);
  assert.equal(runner.puffVx, 0, 'a launch cannot carry stale air drift into landing');
}
{
  const { s, runner, chaser } = scene(true), random = Math.random;
  Math.random = () => 0;
  try {
    s.brains.set(runner.sessionId, new BotBrain());
    chaser.startInhale(NOW);
    botMouth(s, runner, NOW);
    s.now = NOW + 1200;
    s.time = 1200;
    botMouth(s, runner, s.now);
    assert(s.gustWaves.has(runner.sessionId), 'the real bot controller can use the rear shove without turning around');
    assert.equal(runner.facing, 0);
  }
  finally {
    Math.random = random;
  }
}
console.log('Wrap gust passed: forward origin, two-sided wrap, one finite steerable push, preserved inhale, no barrier/stun, expiry, restrictions and bot/player parity.');
