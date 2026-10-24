import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { BotBrain } from '../game/bots.js';
import { BotCannonAim } from '../game/botAim.js';
import { botMouth } from '../systems/bots.js';
import { escapePress, stealWeight, updateHolds, updateInhales } from '../systems/inhale.js';
import { captureLoadMs } from '../game/cannon.js';
import { viewShort } from '../game/camera.js';
import { CANNON, WORLD } from '../constants/gameConstants.js';

const NOW = 100000;
function setup() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.weaponsOn = false; s.setTurbines('off'); s.update(0, NOW);
  const a = s.addPlayer('captor', 'Captor', NOW), b = s.addPlayer('captive', 'Captive', NOW);
  a.setGems(16, s.worldWidth, s.worldHeight); b.setGems(4, s.worldWidth, s.worldHeight);
  a.placeAt(1000, 1000); b.placeAt(a.x + a.width, a.y + (a.height - b.height) / 2);
  a.spawnProtected = b.spawnProtected = false; a.facing = 0; a.startInhale(NOW);
  updateInhales(s, NOW, 1 / 30); assert.equal(b.capturedBy, a.sessionId);
  return { s, a, b };
}
{
  const { s, a, b } = setup();
  s.time = CANNON.CAPTIVE_STUN_MS; s.now = NOW + s.time;
  for (const key of b.escapeKeys) escapePress(s, b, key);
  updateHolds(s, s.now);
  assert.equal(b.capturedBy, '');
  const ends = s.now + 2000;
  assert.equal(b.recaptureAfter, ends); assert.equal(b.suctionSafeUntil, ends);
  assert.equal(b.launchSafeUntil, s.time + 2000, 'the existing world-clock ring also shows escape protection');
  const third = s.addPlayer('third', 'Third', s.now); third.spawnProtected = false;
  third.setGems(16, s.worldWidth, s.worldHeight);
  for (const hunter of [a, third]) {
    hunter.placeAt(1000, 1000); hunter.facing = 0; hunter.startInhale(s.now);
    for (const at of [ends - 1000, ends - 1]) {
      s.now = at; b.placeAt(hunter.x + hunter.width, hunter.y + (hunter.height - b.height) / 2);
      const x = b.x, y = b.y, gems = b.gems;
      assert.equal(stealWeight(s, hunter, b), 0);
      updateInhales(s, at, 1 / 30);
      assert.equal(b.capturedBy, ''); assert.equal(b.x, x); assert.equal(b.y, y); assert.equal(b.gems, gems);
    }
    hunter.stopInhale(s.now);
  }
  s.now = ends; a.startInhale(ends); b.placeAt(a.x + a.width, a.y + (a.height - b.height) / 2);
  updateInhales(s, ends, 1 / 30);
  assert.equal(b.capturedBy, a.sessionId, 'normal capture resumes exactly when the escape shield expires');
}
{
  let reads = 0, target = 1;
  const aim = new BotCannonAim(() => 0.5), observe = () => { reads++; return target; };
  assert.equal(aim.update('one', 2800, 0, 0, observe).angle, 0);
  aim.update('one', 2800, 249, 0, observe); assert.equal(reads, 0);
  const first = aim.update('one', 2800, 250, 0, observe);
  assert(Math.abs(first.angle - target) >= 0.12 && Math.abs(first.angle - target) <= 0.24);
  target = 2; assert.equal(aim.update('one', 2800, 699, 0, observe).angle, first.angle);
  const second = aim.update('one', 2800, 700, 0, observe); assert.notEqual(second.angle, first.angle);
  target = -2;
  assert.equal(aim.update('one', 2800, 2800, 0, observe).angle, second.angle, 'aim commits at loading rather than tracking a last-moment dodge');
  assert(!aim.update('one', 2800, 3200, 0, observe).ready);
  assert(aim.update('one', 2800, 3325, 0, observe).ready);
  assert(!aim.update('two', 0, 9000, 0, observe).ready, 'a newly observed capture never fires instantly');
}
{
  const { s, a, b } = setup();
  a.isBot = true; s.brains.set(a.sessionId, new BotBrain());
  botMouth(s, a, NOW);
  const loaded = NOW + captureLoadMs(b.escapeKeys.length);
  botMouth(s, a, loaded); assert(!b.flying && b.capturedBy === a.sessionId);
  botMouth(s, a, loaded + 399); assert(!b.flying, 'actual bot firing respects the reaction delay');
  botMouth(s, a, loaded + 651); assert(b.flying, 'actual bot firing still launches after its delay');
}
{
  const { s, a } = setup();
  a.steer(-1, 0); a.aimAt(0, -1);
  for (let i = 1; i <= 30; i++) a.updateMovement(s.worldWidth, s.worldHeight, NOW + i * 33, .033);
  assert(a.x < 980, 'a loaded captor can walk left');
  assert(Math.abs(a.facing + Math.PI / 2) < .1, 'the same loaded captor can independently aim upward');
  a.aimAt(0, 0); assert.equal(a.aimX, 0); assert.equal(a.aimY, 0);
}
{
  const s = new GameState(0); s.botFill = 0;
  const p = s.addPlayer('spawn', 'Spawn', NOW);
  const random = Math.random;
  try {
    for (const edge of [0, 0.999999]) {
      Math.random = () => edge;
      for (let i = 0; i < 12; i++) {
        s.spawn(p, NOW);
        const half = viewShort(20) * WORLD.MAX_VIEW_ASPECT / 2;
        assert(p.x + p.width / 2 > half && p.x + p.width / 2 < s.worldWidth - half);
        assert(p.y + p.height / 2 > half && p.y + p.height / 2 < s.worldHeight - half);
      }
    }
  } finally { Math.random = random; }
}
console.log('Fairness regressions passed: all-player escape shield, bot reaction/committed aim, and interior spawns.');
