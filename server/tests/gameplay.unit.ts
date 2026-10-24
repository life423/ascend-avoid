import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CANNON, EXHALE, GEMS, SURGE } from '../constants/gameConstants.js';
import { moveSpeed } from '../game/movement.js';
import { escapePress, escapeSteer, exhale, fireCaptive, stealWeight, updateHolds, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { beginSurge, updateSurges } from '../systems/surges.js';
import { updateJackpot } from '../systems/gems.js';
import { captureLoadMs, escapeLength } from '../game/cannon.js';
import { BotBrain } from '../game/bots.js';

const NOW = 100_000;
function world() {
  const state = new GameState(0);
  state.botFill = 0;
  state.surgesOn = false;
  state.setCoreCount(0);
  state.setTurbines('off');
  state.update(0, NOW);
  return state;
}
function player(state: GameState, id: string, gems = 0, x = 1000, y = 1000) {
  const p = state.addPlayer(id, id, NOW);
  p.setGems(gems, state.worldWidth, state.worldHeight);
  p.placeAt(x, y);
  p.spawnProtected = false;
  return p;
}
function capture(gems = 16) {
  const state = world();
  const captor = player(state, 'captor', gems);
  const captive = player(state, 'captive', 4);
  captive.placeAt(captor.x + captor.width, captor.y + (captor.height - captive.height) / 2);
  captor.facing = 0;
  captor.startInhale(NOW);
  updateInhales(state, NOW, 1 / 30);
  assert.equal(captive.capturedBy, captor.sessionId, 'actual inhale captures the smaller player');
  return { state, captor, captive };
}

assert.equal(moveSpeed(20), 320);
assert(moveSpeed(143) > 130, 'growth leaves mid-size creatures mobile');
assert.equal(moveSpeed(2000), 130, 'late growth has a movement floor');
assert(moveSpeed(37.5) > moveSpeed(143), 'small players keep a speed advantage');
assert.equal(escapeLength(39, 20), 3);
assert.equal(escapeLength(40, 20), 4);
assert.equal(escapeLength(80, 20), 5);
assert.equal(escapeLength(800, 20), 5);
assert.equal(captureLoadMs(3), 1200);
assert.equal(captureLoadMs(5), 1600);

{
  const { state, captor, captive } = capture();
  const keys = captive.escapeKeys;
  assert.equal(keys.length, 3);
  assert.notEqual(keys[0], keys[1]);
  escapePress(state, captive, keys[0]);
  assert.equal(captive.escapeStep, 0, 'cannot escape during the short daze');
  state.time = CANNON.CAPTIVE_STUN_MS;
  escapePress(state, captive, keys[0]);
  const wrong = 'UDLR'.replace(keys[1], '')[0];
  escapePress(state, captive, wrong);
  assert.equal(captive.escapeStep, 0, 'a wrong key resets the sequence');
  for (const key of keys) escapePress(state, captive, key);
  updateHolds(state, NOW + state.time);
  assert.equal(captive.capturedBy, '');
  assert.equal(captor.gulping, '');
  assert.equal(captive.flying, false, 'escaping never fires the captive');
}
{
  const { state, captive } = capture();
  state.time = CANNON.CAPTIVE_STUN_MS;
  const directions: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  for (const key of captive.escapeKeys) {
    captive.steer(0, 0); escapeSteer(state, captive);
    captive.steer(...directions[key]); escapeSteer(state, captive);
    const step = captive.escapeStep;
    escapeSteer(state, captive);
    assert.equal(captive.escapeStep, step, 'holding the stick does not count repeatedly');
  }
  updateHolds(state, NOW + state.time);
  assert.equal(captive.capturedBy, '', 'quick joystick edges in one tick free a captive');
}
{
  const { state, captor, captive } = capture();
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  state.onEvent = (type, data) => events.push({ type, data });
  assert.equal(fireCaptive(state, captor, NOW + CANNON.ARM_MS - 1), false);
  assert.equal(fireCaptive(state, captor, NOW + CANNON.ARM_MS), true);
  assert(captive.flying);
  const target = player(state, 'target', 100, 1270, 984.25);
  const had = target.gems;
  for (let step = 1; step <= 5; step++) updateFlights(state, NOW + CANNON.ARM_MS + step * 100, 0.1);
  assert(target.gems < had, 'a living cannonball spills gems');
  assert(events.some(e => e.type === 'launch'));
  assert(events.some(e => e.type === 'impact' && e.data.projectileId === captive.sessionId));
  assert(events.some(e => e.type === 'credit' && e.data.byId === captor.sessionId && e.data.how === 'cannon'));
  assert.equal(captive.state, 'alive');
}
{
  const { state, captive } = capture();
  state.time = CANNON.HOLD_MS;
  updateHolds(state, NOW + CANNON.HOLD_MS);
  assert.equal(captive.capturedBy, '', 'an idle hold ends promptly');
  assert.equal(captive.state, 'alive');
}
{
  const state = world();
  const small = player(state, 'small', 0);
  const big = player(state, 'big', 100, 1080, 938.5);
  small.facing = 0; big.facing = Math.PI;
  big.startInhale(NOW);
  assert(stealWeight(state, big, small) > 0);
  exhale(state, small, NOW);
  assert.equal(big.inhaling, false, 'a puff into an incoming inhale breaks it');
  assert.equal(small.puffReadyAt, EXHALE.COOLDOWN_MS);
  big.placeAt(1080, 938.5); // end the puff's skid before testing the inhale restart timer
  big.startInhale(NOW + EXHALE.PARRY_MS - 1);
  assert.equal(big.inhaling, false, 'the broken inhale has a brief restart lock');
  big.startInhale(NOW + EXHALE.PARRY_MS);
  assert.equal(stealWeight(state, big, small), 0, 'the defender has an escape window');
  state.now = NOW + EXHALE.BREAK_MS;
  assert(stealWeight(state, big, small) > 0, 'the escape window ends');
  const ready = small.exhaleReadyAt;
  exhale(state, small, NOW + 100);
  assert.equal(small.exhaleReadyAt, ready, 'puffs cannot be spammed');
}
{
  const state = world();
  const p = player(state, 'protected');
  p.protectFor(1500, NOW); p.startInhale(NOW);
  assert.equal(p.spawnProtected, false, 'inhaling ends spawn protection');
  p.stopInhale(NOW); p.protectFor(1500, NOW); exhale(state, p, NOW);
  assert.equal(p.spawnProtected, false, 'puffing ends spawn protection');
}
{
  const state = world();
  state.surgesOn = true;
  player(state, 'visitor', 0, 2000, 2000);
  beginSurge(state);
  assert.equal(state.surgePhase, 'warning');
  assert(state.surgeX >= 300 && state.surgeX <= state.worldWidth - 300);
  state.time = state.surgeAt;
  updateSurges(state, 1 / 30, NOW + state.time);
  assert.equal(state.surgePhase, 'active');
  assert.equal(state.gems.size, SURGE.PIECES);
  assert.equal(state.fieldGems, 0, 'event drops do not disturb field accounting');
  state.time = state.surgeAt - SURGE.JACKPOT_WITH_MS_LEFT;
  updateSurges(state, 1 / 30, NOW + state.time);
  assert(state.jackpotOn);
  const claimant = state.players.get('visitor');
  assert(claimant);
  claimant.placeAt(state.surgeX - claimant.width / 2, state.surgeY - claimant.height / 2);
  claimant.flying = true;
  updateJackpot(state, 1);
  assert.equal(claimant.gems, 0, 'a flying creature cannot claim the prize');
  claimant.flying = false;
  updateJackpot(state, 1);
  assert.equal(claimant.gems, 40, 'a grounded uncontested creature wins the jackpot');
  assert.equal(state.jackpotOn, false);
  updateSurges(state, 1 / 30, NOW + state.time);
  assert.equal(state.jackpotOn, false, 'a claimed jackpot does not respawn during the event');
  state.time = state.surgeAt;
  updateSurges(state, 1 / 30, NOW + state.time);
  assert.equal(state.surgePhase, 'waiting');
  assert(state.surgeAt >= state.time + SURGE.GAP_MIN_MS);
  assert(state.gems.size <= GEMS.MAX_GEMS);
}
console.log('Gameplay regressions passed: growth, keyboard/stick escapes, firing, impact credit, defense, protection and gem surges.');

{
  const state = world();
  const crowd = Array.from({ length: 8 }, (_, i) => player(state, `crowd-${i}`, 100, 1100 + (i % 4) * 100, 1100 + Math.floor(i / 4) * 100));
  for (const p of crowd) { p.isBot = true; state.brains.set(p.sessionId, new BotBrain()); }
  for (const p of crowd) state.brains.get(p.sessionId)?.think(p, state, NOW);
  assert(crowd.every(p => state.brains.get(p.sessionId)?.isDisengaging(NOW)), 'a dense crowd disengages instead of adding more inhales');
  for (let i = 1; i <= 150; i++) state.update(1 / 30, NOW + i * 1000 / 30);
  const nearest = crowd.map(a => Math.min(...crowd.filter(b => a !== b).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
  assert(nearest.reduce((sum, d) => sum + d, 0) / nearest.length > 140, 'a packed group spreads out within five seconds');
}
console.log('Crowd regression passed.');
