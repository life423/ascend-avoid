import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CANNON } from '../constants/gameConstants.js';
import { captureLoadMs } from '../game/cannon.js';
import { escapePress, fireCaptive, updateHolds, updateInhales } from '../systems/inhale.js';

const NOW = 100_000;
function capture(gems = 100, captorGems = 250, bot = false) {
  const state = new GameState(0);
  state.botFill = 0; state.fieldGemTarget = 0; state.surgesOn = false; state.weaponsOn = false;
  state.setTurbines('off'); state.update(0, NOW);
  const captor = state.addPlayer('captor', 'Captor', NOW);
  const captive = state.addPlayer('captive', 'Captive', NOW);
  captor.isBot = bot; captive.isBot = !bot;
  captor.setGems(captorGems, state.worldWidth, state.worldHeight);
  captive.setGems(gems, state.worldWidth, state.worldHeight);
  captor.placeAt(1000, 1000);
  captive.placeAt(captor.x + captor.width, captor.y + (captor.height - captive.height) / 2);
  captor.spawnProtected = captive.spawnProtected = false;
  captor.facing = 0; captor.startInhale(NOW);
  updateInhales(state, NOW, 1 / 30);
  assert.equal(captive.capturedBy, captor.sessionId, 'use real capture eligibility and initialization');
  captor.stopInhale(NOW);
  const at = (elapsed: number) => { state.time = elapsed; state.now = NOW + elapsed; updateHolds(state, state.now); };
  return { state, captor, captive, at };
}

for (const bot of [false, true]) {
  const { captor, captive, at } = capture(100, 250, bot);
  const keys = captive.escapeKeys, readyAt = captor.fireReadyAt;
  const captorWidth = captor.width, captiveWidth = captive.width;
  assert.equal(captive.gems, 100, 'capture does not instantly strip gems');
  at(1000); assert.equal(captive.gems, 96); assert.equal(captor.gems, 254);
  at(2250); assert.equal(captive.gems, 90); assert.equal(captor.gems, 260);
  at(2250); assert.equal(captive.gems, 90, 'same timestamp cannot pay twice');
  assert.equal(captor.stolenTotal, 10); assert.equal(captive.robbedTotal, 10);
  assert(captor.width > captorWidth && captive.width < captiveWidth, 'normal growth follows actual transfer');
  assert.equal(captive.escapeKeys, keys, 'shrinking and growth do not lengthen the puzzle');
  assert.equal(captor.fireReadyAt, readyAt, 'loading is fixed at capture');
  assert.equal(captive.injuredUntil, 0, 'capture transfer is independent of injury');
  at(CANNON.HOLD_MS);
  assert.equal(captive.gems, 80); assert.equal(captor.gems, 270);
  assert.equal(captive.capturedBy, ''); assert.equal(captive.state, 'alive');
  at(10_000); assert.equal(captive.gems, 80, 'release stops transfer and never refunds losses');
  assert.equal(captor.gems + captive.gems, 350, 'every lost gem is gained exactly once');
}

for (const gems of [0, 1, 4, 5, 9, 12, 101, 1000]) {
  const { captor, captive, at } = capture(gems, 4000);
  at(CANNON.HOLD_MS + 50_000);
  const taken = Math.floor(gems * .2);
  assert.equal(captive.gems, gems - taken, 'a delayed tick pays only the original rounded-down allowance');
  assert.equal(captor.gems, 4000 + taken);
  assert.equal(captive.state, 'alive', 'even tiny or empty captives survive transfer');
}

{
  const regular = capture(), delayed = capture();
  for (let tick = 1; tick <= 135; tick++) regular.at(tick * CANNON.HOLD_MS / 135);
  delayed.at(CANNON.HOLD_MS);
  assert.equal(regular.captive.gems, delayed.captive.gems, 'tick frequency cannot change the reward');
}

{
  const { state, captor, captive, at } = capture();
  at(1000);
  const remaining = captive.gems;
  for (const key of captive.escapeKeys) escapePress(state, captive, key);
  at(1200);
  assert.equal(captive.capturedBy, ''); assert.equal(captive.gems, remaining, 'completed escape prevents further transfer');
  at(20_000); assert.equal(captive.gems, remaining); assert.equal(captor.gems, 350 - remaining);
}

for (const queued of [false, true]) {
  const { state, captor, captive, at } = capture();
  const load = captureLoadMs(captive.escapeKeys.length);
  if (queued) assert.equal(fireCaptive(state, captor, NOW), false);
  at(load - 100);
  if (queued) at(load);
  else { state.time = load; assert(fireCaptive(state, captor, NOW + load)); }
  const taken = Math.floor(20 * load / CANNON.HOLD_MS);
  assert(captive.flying); assert.equal(captive.gems, 100 - taken);
  at(20_000); assert.equal(captive.gems, 100 - taken, 'neither manual nor queued firing leaves a drain running');
}

for (const ending of ['stun', 'knockout', 'flight', 'captured', 'disconnect', 'captive-disconnect'] as const) {
  const { state, captor, captive, at } = capture();
  at(1000); const remaining = captive.gems, gained = captor.gems;
  if (ending === 'stun') captor.stunned = true;
  if (ending === 'knockout') captor.knockOut(NOW + 1000);
  if (ending === 'flight') captor.flying = true;
  if (ending === 'captured') captor.capturedBy = 'third-player';
  if (ending === 'disconnect') state.players.delete(captor.sessionId);
  if (ending === 'captive-disconnect') state.players.delete(captive.sessionId);
  at(2000); at(10_000);
  assert.equal(captive.gems, remaining, `${ending} stops transfer immediately`);
  assert.equal(captor.gems, gained);
  if (ending !== 'captive-disconnect') assert.equal(captive.capturedBy, '');
}

{
  const { state, captor, captive, at } = capture();
  captive.setGems(1, state.worldWidth, state.worldHeight);
  at(CANNON.HOLD_MS);
  assert.equal(captive.gems, 1, 'never take the final gem even if something else reduced the captive');
  assert.equal(captor.gems, 250);
}

{
  const { state, captor, captive, at } = capture();
  at(CANNON.HOLD_MS);
  state.time = 7000; state.now = NOW + 7000;
  captive.suctionSafeUntil = captive.recaptureAfter = 0;
  captive.sliding = false;
  captive.placeAt(captor.x + captor.width, captor.y + (captor.height - captive.height) / 2);
  captor.startInhale(state.now); updateInhales(state, state.now, 1 / 30);
  assert.equal(captive.capturedBy, captor.sessionId);
  assert.equal(captor.captiveGemBudget, 16, 'a new capture snapshots remaining gems, not the old allowance');
  assert.equal(captor.captiveGemsTaken, 0);
  at(7000 + CANNON.HOLD_MS);
  assert.equal(captive.gems, 64); assert.equal(captor.gems, 286);
}

{
  const { state, captor, captive } = capture();
  for (let tick = 1; tick <= 135; tick++) state.update(1 / 30, NOW + tick * 1000 / 30);
  assert.equal(captive.gems, 80, 'the actual world loop transfers the capped amount');
  assert.equal(captor.gems, 270); assert.equal(captive.capturedBy, '');
}

console.log('captive transfer: conservation, cap, timing, escape, launch, release, roles and world loop pass');
