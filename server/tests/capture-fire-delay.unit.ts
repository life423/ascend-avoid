import assert from 'node:assert/strict';
import { CANNON } from '../constants/gameConstants.js';
import { turnRate } from '../game/movement.js';
import { GameState } from '../schema/GameState.js';
import { clearCapture, fireCaptive, updateHolds, updateInhales } from '../systems/inhale.js';

const NOW = 100000;
const original = { delay: CANNON.CAPTURE_FIRE_DELAY_MS, share: CANNON.PEER_HIT_SHARE };
assert.equal(original.delay, 0, 'the delay experiment is disabled in normal games');

function setup(bot: boolean) {
  const state = new GameState(0);
  state.botFill = state.fieldGemTarget = 0;
  state.weaponsOn = state.surgesOn = false;
  state.setTurbines('off'); state.blackHoles.clear(); state.update(0, NOW);
  const owner = state.addPlayer('owner', 'Owner', NOW);
  const ammo = state.addPlayer('ammo', 'Ammo', NOW);
  const replacement = state.addPlayer('replacement', 'Replacement', NOW);
  owner.setGems(4000, 4200, 4200); ammo.setGems(1000, 4200, 4200);
  replacement.setGems(32, 4200, 4200); replacement.placeAt(300, 300);
  owner.placeAt(1400, 1500); owner.facing = 0;
  for (const p of [owner, ammo, replacement]) { p.isBot = bot; p.dropProtection(); }
  function capture(prey: typeof ammo, now: number) {
    prey.placeAt(owner.x + owner.width * .8 + 1 - prey.width / 2, owner.y + (owner.height - prey.height) / 2);
    owner.startInhale(now); updateInhales(state, now, .001);
    assert.equal(owner.gulping, prey.sessionId);
    owner.stopInhale(now);
  }
  capture(ammo, NOW);
  return { state, owner, ammo, replacement, capture };
}

try {
  Object.assign(CANNON, { PEER_HIT_SHARE: .33 });
  for (const delay of [0, 250, 500, 750, 1000, 1500, 2000]) {
    Object.assign(CANNON, { CAPTURE_FIRE_DELAY_MS: delay });
    for (const bot of [false, true]) {
      const { state, owner, ammo, replacement, capture } = setup(bot);
      const gems = owner.gems, captiveGems = ammo.gems, deadline = owner.gulpEndsAt;
      assert.equal(owner.captureStartedAt, NOW);
      assert.equal(fireCaptive(state, owner, NOW + delay), false, 'waiting alone never substitutes for release/new action');
      owner.captureNeedsRelease = false;
      owner.steer(1, 0); owner.aimAt(0, 1);
      if (delay > 0) for (const age of [0, Math.floor(delay / 2), delay - 1]) {
        assert.equal(fireCaptive(state, owner, NOW + age), false);
        assert.equal(owner.gulping, ammo.sessionId);
        assert.equal(ammo.capturedBy, owner.sessionId);
        assert.equal(ammo.flying, false);
        assert.equal(owner.gems, gems, 'rejected attempts never duplicate capture growth');
        assert.equal(ammo.gems, captiveGems);
        assert.equal(owner.gulpEndsAt, deadline, 'rejected attempts do not extend captivity');
        assert.equal(owner.aimY, 1, 'early fire preserves chosen aim');
        assert.equal(owner.steering().x, 1, 'waiting does not lock movement');
      }
      assert.equal(fireCaptive(state, owner, NOW + delay), true, 'both actor types can fire at the exact shared deadline');
      assert.equal(ammo.flying, true);
      assert.equal(owner.gulping, '');
      assert.equal(fireCaptive(state, owner, NOW + delay + 1), false, 'one captive produces one launch');

      const secondCaptureAt = NOW + delay + 1000;
      owner.aimAt(0, 0); owner.facing = 0;
      capture(replacement, secondCaptureAt); owner.captureNeedsRelease = false;
      assert.equal(owner.captureStartedAt, secondCaptureAt, 'a new captive has its own fresh clock');
      if (delay > 0) assert.equal(fireCaptive(state, owner, secondCaptureAt + delay - 1), false);
      assert.equal(fireCaptive(state, owner, secondCaptureAt + delay), true);
    }
  }

  Object.assign(CANNON, { CAPTURE_FIRE_DELAY_MS: 750 });
  for (const bot of [false, true]) {
    const { state, owner, ammo } = setup(bot);
    owner.captureNeedsRelease = false;
    assert.equal(fireCaptive(state, owner, NOW + 100), false);
    updateHolds(state, NOW + 800);
    assert.equal(owner.gulping, ammo.sessionId, 'early taps do not queue a surprise automatic shot');
    owner.injure(state.time);
    assert(owner.breathingBlocked);
    assert.equal(fireCaptive(state, owner, NOW + 800), true, 'already-held firing remains allowed while injured');
  }
  Object.assign(CANNON, { CAPTURE_FIRE_DELAY_MS: 2000 });
  for (const reason of ['timeout', 'disconnect', 'death', 'clear'] as const) {
    const { state, owner, ammo } = setup(false);
    const initial = owner.gems + ammo.gems;
    if (reason === 'timeout') { state.time = owner.gulpEndsAt; updateHolds(state, NOW + state.time); }
    else if (reason === 'disconnect') state.removePlayer(owner.sessionId);
    else if (reason === 'death') { owner.knockOut(NOW + 100); updateHolds(state, NOW + 100); }
    else clearCapture(state, owner.sessionId, NOW + 100);
    assert.equal(ammo.capturedBy, '', 'delay does not prevent ordinary release/cleanup');
    assert.equal(ammo.flying, false);
    assert.equal(owner.gems + ammo.gems, initial);
  }
} finally {
  Object.assign(CANNON, { CAPTURE_FIRE_DELAY_MS: original.delay, PEER_HIT_SHARE: original.share });
}

for (const direction of [-1, 1] as const) {
  const { state, owner, ammo, replacement } = setup(false);
  const step = (now: number) => owner.updateMovement(state.worldWidth, state.worldHeight, now, 1 / 30);
  const startX = owner.x;
  owner.steer(1, 0);
  assert(!owner.turnLoaded(replacement.sessionId, direction), 'a different captive cannot steer the loaded mouth');
  assert(owner.turnLoaded(ammo.sessionId, direction));
  let turned = 0;
  for (let tick = 1; tick <= 45; tick++) {
    const before = owner.facing;
    step(NOW + tick * 1000 / 30);
    turned += Math.atan2(Math.sin(owner.facing - before), Math.cos(owner.facing - before));
    assert(Math.abs(owner.spin) <= turnRate(owner.width) + 1e-12);
  }
  assert(turned * direction > Math.PI / 2, 'holding the key turns continuously past a cardinal heading');
  assert(owner.x > startX, 'steering remains independent of keyboard turn');

  const heldAngle = owner.facing;
  owner.stun(NOW + 1500, 200, true);
  assert(!owner.turnLoaded(ammo.sessionId, direction), 'stun blocks new turning input');
  assert(owner.turnLoaded(ammo.sessionId, 0), 'releasing the key can stop a turn during stun');
  for (let time = NOW + 1500; time <= NOW + 1900; time += 100) step(time);
  assert.equal(owner.facing, heldAngle, 'release holds the exact facing through recovery and continued movement');
  assert.equal(owner.spin, 0);

  assert(!fireCaptive(state, owner, NOW + 1900), 'keyboard turning does not release the capture-causing action');
  owner.captureNeedsRelease = false;
  assert(fireCaptive(state, owner, NOW + 1900));
  const shotAngle = Math.atan2(ammo.flightVy, ammo.flightVx);
  assert(Math.abs(Math.atan2(Math.sin(shotAngle - heldAngle), Math.cos(shotAngle - heldAngle))) < 1e-12);
  assert(!owner.turnLoaded(ammo.sessionId, direction), 'fired ammunition cannot receive stale turn input');
}

{
  const { state, owner, ammo, replacement, capture } = setup(false);
  const step = (now: number) => owner.updateMovement(state.worldWidth, state.worldHeight, now, 1 / 30);
  assert(owner.turnLoaded(ammo.sessionId, -1));
  owner.aimAt(0, 1);
  step(NOW + 33);
  assert(owner.facing > 0, 'ordinary mouse, touch or bot aim overrides keyboard turn');

  assert(owner.turnLoaded(ammo.sessionId, -1));
  assert(owner.turnLoaded(ammo.sessionId, null));
  owner.steer(0, 1);
  const before = owner.facing;
  step(NOW + 66);
  assert(owner.facing > before, 'null returns to normal movement aim');

  assert(owner.turnLoaded(ammo.sessionId, -1));
  clearCapture(state, owner.sessionId, NOW + 100);
  owner.facing = 0;
  owner.steer(0, 0);
  capture(replacement, NOW + 133);
  step(NOW + 166);
  assert.equal(owner.facing, 0, 'a replacement captive never inherits the previous turn');
  assert.equal(owner.spin, 0);
}
console.log('Capture-fire delay passed: shared exact deadlines, preserved ammo/growth/hold/aim/movement, separate actions, fresh captures, no queued shots, injured firing and lifecycle cleanup.');
