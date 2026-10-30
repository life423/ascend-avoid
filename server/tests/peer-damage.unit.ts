import assert from 'node:assert/strict';
import { CANNON } from '../constants/gameConstants.js';
import { impactGems, captureGrowthTransfer } from '../game/cannon.js';
import { cannonTargetAppeal } from '../game/botAim.js';
import { creatureSize } from '../game/creatureSize.js';
import { GameState } from '../schema/GameState.js';
import { fireCaptive, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';

const previous = CANNON.PEER_HIT_SHARE;
const old = impactGems(1000, 1250, 60, 300, 0, 'missile', 300);
assert.equal(previous, 0, 'the candidate is disabled in normal games');
try {
  Object.assign(CANNON, { PEER_HIT_SHARE: .33 });
  for (const width of [60, 100, 200, 400, 650, 900, 1200]) {
    assert.equal(impactGems(1000, 1250, 60, width, 0, 'missile', width), 330);
    assert.equal(impactGems(1000, 1250, 60, width, 0, 'missile', width / 2), 83, 'relative physical size scales the candidate');
    assert.equal(impactGems(1000, 100, 60, width, 0, 'missile', width), 330, 'the equal-peer candidate has no hidden speed gate');
  }
  assert.equal(impactGems(1000, 1250, 100, 100, 0, 'turbine', 100), 290, 'transport damage is unchanged');
  assert(cannonTargetAppeal(10000, 600, 60, 2000, 500, 600) > cannonTargetAppeal(1, 20, 60, 2000, 200, 600),
    'bot opportunity selection sees the same credible peer damage as actual collisions');

  function stock(width: number): number {
    let lo = 0, hi = 1000000;
    while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width) lo = mid + 1; else hi = mid; }
    return lo;
  }
  for (const change of ['unchanged', 'grow', 'shrink', 'dead', 'disconnect'] as const) {
    const now = 100000, s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = s.surgesOn = false; s.setTurbines('off'); s.blackHoles.clear(); s.update(0, now);
    const owner = s.addPlayer('owner', 'Owner', now), ammo = s.addPlayer('ammo', 'Ammo', now), target = s.addPlayer('target', 'Target', now);
    owner.setGems(stock(300), 4200, 4200); ammo.setGems(32, 4200, 4200); target.setGems(stock(300), 4200, 4200);
    assert.equal(captureGrowthTransfer(32), 0);
    owner.placeAt(1000, 1600); owner.facing = 0; target.placeAt(3000, 3000);
    for (const p of [owner, ammo, target]) p.dropProtection();
    ammo.placeAt(owner.x + owner.width * .8 + 1 - ammo.width / 2, owner.y + (owner.height - ammo.height) / 2);
    owner.startInhale(now); updateInhales(s, now, .001); assert.equal(owner.gulping, ammo.sessionId);
    owner.stopInhale(now); owner.captureNeedsRelease = false; assert(fireCaptive(s, owner, now));
    const launchWidth = ammo.shotShooterWidth, before = target.gems;
    target.placeAt(ammo.x + ammo.width + 80, ammo.y + (ammo.height - target.height) / 2);
    if (change === 'grow') owner.setGems(stock(900), 4200, 4200);
    if (change === 'shrink') owner.setGems(0, 4200, 4200);
    if (change === 'dead') owner.knockOut(now + 1);
    if (change === 'disconnect') s.removePlayer(owner.sessionId);
    assert.equal(ammo.shotShooterWidth, launchWidth);
    updateFlights(s, now + 100, .1);
    assert(ammo.flightHit && target.state === 'alive');
    assert.equal(target.gems, before - Math.round(before * .33), 'real hit uses the immutable launch size');
    assert(target.breathingBlocked, 'a nonlethal hit keeps ordinary injury');
    updateFlights(s, now + 110, .01); assert.equal(target.gems, before - Math.round(before * .33), 'one damaging hit per launch');
  }
} finally { Object.assign(CANNON, { PEER_HIT_SHARE: previous }); }
assert.equal(impactGems(1000, 1250, 60, 300, 0, 'missile', 300), old, 'default behavior is restored');
console.log('Peer-damage trial: default off, physical-width scaling, shared bot prediction, real immutable launch hits, injury, single-hit accounting and unchanged transport passed.');
