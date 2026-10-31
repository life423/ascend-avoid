import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { EXHALE } from '../constants/gameConstants.js';
import { exhale, stealWeight } from '../systems/inhale.js';
import { updateGustWaves } from '../systems/gustWaves.js';
import { waveArcs, waveBlocks, waveRadius } from '../game/gustWave.js';
import { BotBrain } from '../game/bots.js';
import { botMouth } from '../systems/bots.js';
const NOW = 100000;
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
for (const bot of [false, true]) {
  const { s, runner, chaser } = scene(bot);
  chaser.startInhale(NOW);
  assert(stealWeight(s, chaser, runner) > 0);
  exhale(s, runner, NOW);
  assert.equal(s.gustWaves.size, 1);
  assert.equal(runner.stamina, .65);
  const wave = s.gustWaves.get(runner.sessionId);
  assert(wave);
  assert(waveArcs(wave, 0)[0].every(p => p.x > wave.x), 'the wave first leaves the front');
  assert.equal(waveArcs(wave, EXHALE.WAVE_WRAP_MS / 2).length, 2, 'two lobes wrap around both sides');
  assert(waveArcs(wave, EXHALE.WAVE_WRAP_MS)[0].every(p => p.x < wave.x), 'the wall settles behind');
  assert(!waveBlocks(wave, 100, { x: 800, y: 1010 }, { x: 1010, y: 1010 }), 'visual wrap has not formed the wall yet');
  s.time = EXHALE.WAVE_WRAP_MS;
  s.now = NOW + s.time;
  assert.equal(stealWeight(s, chaser, runner), 0, 'the rear barrier cuts body pull/capture/theft connections');
  updateGustWaves(s, s.now);
  assert(!chaser.inhaling, 'a chaser is interrupted without the runner turning');
  assert(!chaser.stunned, 'rear pressure does not chain hard stuns');
  const left = wave.remainingImpulse;
  updateGustWaves(s, s.now + 16);
  assert.equal(wave.remainingImpulse, left, 'the same body is pushed only once');
  assert.equal(runner.facing, 0);
  runner.steer(1, 0);
  const before = runner.x;
  runner.updateMovement(4200, 4200, s.now + 100, .1);
  assert(runner.x > before, 'the caster keeps moving through its own effect');
  assert.equal(wave.x, 1010, 'the wall stays in the world instead of becoming a personal shield');
  assert(!waveBlocks(wave, s.time, { x: 1010, y: 1300 }, { x: 1010, y: 900 }), 'a side approach can go around');
  exhale(s, runner, NOW + 300);
  assert.equal(s.gustWaves.get(runner.sessionId), wave, 'normal cooldown still applies');
  s.time = EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_HOLD_MS;
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
  assert(waveBlocks(wave, EXHALE.WAVE_WRAP_MS, start, { x: 500, y: 500 }), 'barrier physics rotates with the cast');
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
    assert(s.gustWaves.has(runner.sessionId), 'the real bot controller can use rear cover without turning around');
    assert.equal(runner.facing, 0);
  }
  finally {
    Math.random = random;
  }
}
console.log('Wrap wave passed: forward origin, two-sided wrap, fixed rear cover, real suction interruption, one finite push, side counterplay, expiry, restrictions and bot/player parity.');
