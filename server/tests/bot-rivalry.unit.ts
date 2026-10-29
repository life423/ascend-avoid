import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { BotBrain } from '../game/bots.js';
import { cannonTargetAppeal } from '../game/botAim.js';
import { botPreyAvailable } from '../game/botTargets.js';
import { botMouth } from '../systems/bots.js';
import { updateInhales } from '../systems/inhale.js';

const now = 100_000;
function opening() {
  const state = new GameState(0); state.botFill = 0; state.time = 0; state.now = now;
  state.weaponsOn = state.surgesOn = false; state.setTurbines('off'); state.blackHoles.clear();
  const rival = state.addPlayer('rival', 'Rival', now), leader = state.addPlayer('leader', 'Leader', now), ammo = state.addPlayer('ammo', 'Ammo', now);
  rival.setGems(3000, 4200, 4200); leader.setGems(30_000, 4200, 4200); ammo.setGems(40, 4200, 4200);
  rival.placeAt(1000, 1600); rival.facing = 0;
  leader.placeAt(rival.x + rival.width + 40, rival.y + (rival.width - leader.width) / 2); leader.facing = Math.PI;
  ammo.placeAt(rival.x - 80, rival.y);
  for (const p of [rival, leader, ammo]) p.dropProtection();
  leader.injure(0);
  return { state, rival, leader, ammo };
}
const oldRandom = Math.random;
try {
  Math.random = () => .5;
  const { state, rival, leader } = opening();
  const brain = new BotBrain(); state.brains.set(rival.sessionId, brain);
  const direction = brain.think(rival, state, now);
  assert.equal(brain.victim, leader, 'an actual injury can be pursued even when the leader is much wider');
  assert.equal(direction, 'right', 'injured opponents do not provoke the obsolete healthy-giant flee/flank behavior');
  Math.random = () => 0;
  botMouth(state, rival, now); assert(rival.inhaling);
  const before = leader.gems; updateInhales(state, now, .1);
  assert(leader.gems < before, 'ordinary frontal theft works while the injured leader cannot counter-inhale');
  assert(rival.gems > 3000);
  rival.injure(0); assert(!botPreyAvailable(state, rival, leader, now), 'an injured attacker obeys the same breathing lock');
} finally { Math.random = oldRandom; }
assert(cannonTargetAppeal(10_000, 600, 400, 1250, 500, 600) > cannonTargetAppeal(1, 20, 400, 1250, 200, 600), 'substantial peer opening beats another trivial knockout');
assert(cannonTargetAppeal(12, 40, 20, 1250, 400, 70) > cannonTargetAppeal(10_000, 600, 20, 1250, 200, 70), 'tiny ammunition does not pretend to threaten a giant');
console.log('Bot rivalry: credible peer shots, small-ammo judgment, real injured-leader pursuit/front theft and shared breathing restrictions passed.');
