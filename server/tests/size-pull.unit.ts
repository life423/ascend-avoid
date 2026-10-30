import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { bodyPullScale, innerBodyPullBoost } from '../game/airflow.js';
import { creatureSize } from '../game/creatureSize.js';
import { moveSpeed } from '../game/movement.js';
import { INHALE } from '../constants/gameConstants.js';

function stock(width: number): number {
  let lo = 0, hi = 1000000;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width) lo = mid + 1; else hi = mid; }
  return lo;
}
for (const targetWidth of [40, 100, 200, 400, 600]) {
  assert(bodyPullScale(targetWidth * 1.1, targetWidth) < bodyPullScale(targetWidth * 1.5, targetWidth),
    'a slight size advantage produces less body drag than a substantial advantage');
  assert(bodyPullScale(targetWidth * 1.5, targetWidth) < bodyPullScale(targetWidth * 2, targetWidth));
  assert.equal(bodyPullScale(targetWidth * 2, targetWidth), 1, 'half-width prey retain the full strong-zone pull');
  assert.equal(bodyPullScale(targetWidth, targetWidth), INHALE.PEER_BODY_PULL);
  assert.equal(innerBodyPullBoost(targetWidth * INHALE.EAT_RATIO, targetWidth), 0,
    'becoming just eligible to capture grants no sudden inner-zone boost');
  assert(innerBodyPullBoost(targetWidth * 1.5, targetWidth) < innerBodyPullBoost(targetWidth * 1.8, targetWidth));
  assert(innerBodyPullBoost(targetWidth * 1.5, targetWidth) > 0);
  assert.equal(innerBodyPullBoost(targetWidth * 2, targetWidth), 1, 'much smaller prey retain full inner-zone danger');
  assert(innerBodyPullBoost(targetWidth * (INHALE.EAT_RATIO + .001), targetWidth) < .001,
    'the old capture-threshold force jump is replaced by a continuous onset');
}
assert.equal(bodyPullScale(600, 400), bodyPullScale(300, 200), 'resistance uses physical proportions, not absolute size or score');

function chase(hunterWidth: number, preyWidth: number, gap: number, response: 'idle' | 'away') {
  const now = 100000, state = new GameState(0); state.botFill = state.fieldGemTarget = 0;
  state.trafficOn = state.surgesOn = state.weaponsOn = state.shiftsOn = false; state.setTurbines('off'); state.blackHoles.clear(); state.update(0, now);
  const a = state.addPlayer('hunter', 'Hunter', now), b = state.addPlayer('prey', 'Prey', now);
  a.setGems(stock(hunterWidth), 4200, 4200); b.setGems(stock(preyWidth), 4200, 4200);
  a.placeAt(1100 - a.width / 2, 2100 - a.height / 2);
  b.placeAt(1100 + (a.width + b.width) / 2 + gap - b.width / 2, 2100 - b.height / 2);
  a.dropProtection(); b.dropProtection(); a.facing = 0; a.startInhale(now);
  for (let tick = 1; tick <= 150; tick++) {
    const dx = b.x + b.width / 2 - a.x - a.width / 2, dy = b.y + b.height / 2 - a.y - a.height / 2, d = Math.hypot(dx, dy) || 1;
    a.steer(dx / d, dy / d); a.aimAt(dx / d, dy / d);
    if (tick * 1000 / 30 >= 250) {
      if (response === 'away') b.steer(dx / d, dy / d);
    }
    state.update(1 / 30, now + tick * 1000 / 30);
    if (b.capturedBy) return { captured: true, tick };
  }
  return { captured: false, tick: 150 };
}
for (const [hunter, prey] of [[130, 100], [260, 200], [650, 500]]) {
  assert(moveSpeed(prey) > moveSpeed(hunter));
  assert(!chase(hunter, prey, 300, 'away').captured,
    'a faster, just-capturable player can use a prompt retreat outside the strong zone');
}
const caught = chase(400, 200, 20, 'away');
assert(caught.captured && caught.tick * 1000 / 30 < 250,
  'being faster does not save much smaller prey already caught at a larger mouth');
assert(!chase(110, 100, 120, 'idle').captured, 'a slight size advantage does not bypass healthy capture eligibility');
console.log('Size pull passed: relative body resistance, actual pursuit/retreat outcomes, strong-zone danger and unchanged healthy capture eligibility.');
