import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { INHALE } from '../constants/gameConstants.js';
import { steal } from '../systems/inhale.js';

const NOW = 100_000;
function setup(victimGems: number, thiefGems: number, count = 1) {
  const state = new GameState(0); state.botFill = 0; state.fieldGemTarget = 0;
  state.surgesOn = false; state.weaponsOn = false; state.setTurbines('off'); state.update(0, NOW);
  const add = (id: string, gems: number) => {
    const p = state.addPlayer(id, id, NOW); p.setGems(gems, 4200, 4200); p.spawnProtected = false; return p;
  };
  const victim = add('victim', victimGems);
  const thieves = Array.from({ length: count }, (_, i) => add(`thief-${i}`, thiefGems));
  for (const p of thieves) p.startInhale(NOW);
  victim.injure(0);
  return { state, victim, thieves };
}

/** Ideal tracked contact isolates theft from capture, pickup, movement and upkeep. */
function measure(victimGems: number, thiefGems: number, count = 1) {
  const { state, victim, thieves } = setup(victimGems, thiefGems, count);
  let firstSecond = 0, knockoutMs = 0;
  for (let tick = 1; tick <= 210 && victim.state === 'alive'; tick++) {
    state.time = tick * 1000 / 30; state.now = NOW + state.time;
    victim.placeAt(2100 - victim.width / 2, 2100 - victim.height / 2);
    for (let i = 0; i < thieves.length; i++) {
      const p = thieves[i], angle = i * Math.PI * 2 / thieves.length;
      const distance = (victim.width + p.width) / 2 + 4;
      p.placeAt(2100 + Math.cos(angle) * distance - p.width / 2, 2100 + Math.sin(angle) * distance - p.height / 2);
      p.facing = angle + Math.PI; p.heldFor.set(victim.sessionId, state.time / 1000);
      steal(state, p, state.now, 1 / 30);
    }
    if (tick === 30) firstSecond = victimGems - victim.gems;
    if (victim.gems === 0) knockoutMs = state.time;
  }
  assert.equal(victim.gems + thieves.reduce((sum, p) => sum + p.gems, 0), victimGems + thiefGems * count);
  return { victimGems, thiefGems, count, firstSecond, taken: victimGems - victim.gems, knockoutMs };
}

const peers = [40, 100, 1000, 10000].map(gems => measure(gems, gems));
const giant = [4, 40, 250, 1000].map(gems => measure(1000, gems));
const groups = [1, 2, 3].map(count => measure(1000, 1000, count));
console.log(JSON.stringify({ peers, giant, groups }));
for (const result of peers) {
  assert(result.firstSecond >= result.victimGems * .15, 'accurate suction immediately takes a visible share');
  assert(result.knockoutMs > 2000 && result.knockoutMs < INHALE.INJURY_MS, 'a comparable attacker can finish within the fixed window');
}
assert(groups[1].knockoutMs < groups[0].knockoutMs && groups[2].knockoutMs < groups[1].knockoutMs);
assert(groups[2].knockoutMs >= 1000, 'three ideal attackers are dangerous without instant deletion');
assert(giant[0].firstSecond < giant[2].firstSecond && giant[0].knockoutMs > giant[2].knockoutMs,
  'a tiny attacker needs substantially longer sustained contact than a substantial rival');

// The timer and rate basis are fixed even when direct damage changes remaining gems.
{
  const { state, victim } = setup(1000, 1000);
  victim.setGems(900, 4200, 4200); victim.injure(6000);
  assert.equal(victim.injuredUntil, 7000); assert.equal(victim.injuryGems, 1000);
  state.time = 6000; state.now = NOW + 6000;
  state.hitPlayer(victim, NOW + 6000);
  assert.equal(victim.injuredUntil, 7000); assert.equal(victim.injuryGems, 1000);
  assert(victim.gems < 900, 'follow-up hits still deal damage without refreshing exposure');
}

// Percentage theft must handle uncapped scores without a loop for every individual gem.
{
  const { state, victim, thieves: [thief] } = setup(1e12, 1e12);
  victim.placeAt(2000 - victim.width, 1000); thief.placeAt(2000, 1000); thief.facing = Math.PI;
  state.time = 33; state.now = NOW + 33;
  steal(state, thief, state.now, 1 / 30);
  assert(victim.gems < 1e12 && thief.gems > 1e12);
  assert.equal(victim.gems + thief.gems, 2e12, 'large batched transfers conserve value');
}

// Roles use exactly the same hit eligibility, duration and drain.
function roleFlip(bot: boolean) {
  const { state, victim, thieves: [thief] } = setup(100, 100);
  victim.isBot = bot; thief.isBot = !bot;
  victim.placeAt(1100, 1000); thief.placeAt(1000, 1000); thief.facing = 0;
  state.time = 50; state.now = NOW + 50; steal(state, thief, state.now, .05);
  return [victim.gems, thief.gems, victim.injuredUntil];
}
assert.deepEqual(roleFlip(false), roleFlip(true));

function defensiveMovement(sideways: boolean) {
  const { state, victim, thieves: [thief] } = setup(1000, 1000);
  thief.placeAt(1000, 1000); thief.facing = 0; victim.placeAt(1000 + thief.width + 100, 1000);
  const at = { x: victim.x, y: victim.y };
  if (sideways) {
    victim.steer(0, 1); victim.updateMovement(4200, 4200, NOW + 50, .05);
    victim.placeAt(at.x, at.y); // retain actual walking velocity while comparing identical geometry
  }
  state.time = 1000; state.now = NOW + 1000; steal(state, thief, state.now, 1);
  return 1000 - victim.gems;
}
assert(defensiveMovement(true) < defensiveMovement(false) * .7, 'sideways escape still materially reduces theft');
console.log('Rapid theft: immediate consequences, peer knockouts, group danger, fixed injury basis, uncapped scores and role parity pass');
