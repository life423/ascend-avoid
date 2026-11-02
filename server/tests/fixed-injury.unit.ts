import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { INHALE } from '../constants/gameConstants.js';
import { exhale, injuryVulnerable, planTheft, steal, syncInjuryState, updateInhales } from '../systems/inhale.js';
import { botPreyAvailable } from '../game/botTargets.js';

const NOW = 100000;
for (const bot of [false, true]) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = false; s.setTurbines('off'); s.update(0, NOW);
  const thief = s.addPlayer('thief', 'Thief', NOW), victim = s.addPlayer('victim', 'Victim', NOW);
  thief.isBot = victim.isBot = bot;
  thief.setGems(40, 4200, 4200); victim.setGems(1000, 4200, 4200);
  thief.placeAt(1200, 1600); thief.facing = 0;
  victim.placeAt(thief.x + thief.width * .8 + 200 - victim.width / 2, thief.y + (thief.height - victim.height) / 2);
  thief.dropProtection(); victim.dropProtection(); victim.injure(0); thief.startInhale(NOW);
  const deadline = victim.injuredUntil;
  s.time = deadline - 100;
  const before = victim.gems;
  steal(s, thief, NOW, .1);
  assert(victim.gems < before, 'a connected inhale can steal during injury');
  const stalePlan = planTheft(s, NOW), left = victim.gems;
  assert(stalePlan.get(thief)?.length);
  s.time = deadline - 1; syncInjuryState(s);
  assert(victim.breathingBlocked && injuryVulnerable(s, victim));
  s.time = deadline; syncInjuryState(s);
  assert(!victim.breathingBlocked && !injuryVulnerable(s, victim), 'recovery occurs at the exact deadline under uninterrupted inhale');
  assert(!thief.stealShares.has(victim.sessionId), 'expiry discards fractional theft progress');
  steal(s, thief, NOW + deadline, .5, stalePlan);
  assert.equal(victim.gems, left, 'even a prepared pre-expiry plan cannot steal after recovery');
  assert(!botPreyAvailable(s, thief, victim, NOW + deadline), 'a recovered larger rival stops being a bot theft target');
  victim.startInhale(NOW + deadline);
  assert(victim.inhaling, 'the defender can inhale again without the attacker releasing');
  victim.stopInhale(NOW + deadline);
  exhale(s, victim, NOW + deadline);
  assert(s.gustWaves.has(victim.sessionId), 'the recovered defender can gust');
  s.time += 2000; syncInjuryState(s); steal(s, thief, NOW + s.time, 1);
  assert.equal(victim.gems, left, 'continued pressure cannot reopen injury');
  victim.injure(s.time);
  assert.equal(victim.injuredUntil, s.time + INHALE.INJURY_MS, 'a genuinely new damaging hit can cause another injury');
  s.spawn(victim, NOW + s.time); syncInjuryState(s);
  assert(!victim.breathingBlocked && !injuryVulnerable(s, victim));
}
// At the boundary a sufficiently smaller, now-healthy creature is ordinary ammo,
// rather than being finished by the expired injury during a close-mouth pull.
for (const bot of [false, true]) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = false; s.setTurbines('off'); s.update(0, NOW);
  const a = s.addPlayer('a', 'Attacker', NOW), b = s.addPlayer('b', 'Prey', NOW);
  a.isBot = b.isBot = bot; a.setGems(4000, 4200, 4200); b.setGems(100, 4200, 4200);
  a.placeAt(1100, 1100); a.facing = 0;
  b.placeAt(a.x + a.width * .8 - b.width / 2 + 1, a.y + (a.height - b.height) / 2);
  a.dropProtection(); b.dropProtection(); b.injure(0); a.startInhale(NOW);
  s.time = b.injuredUntil; updateInhales(s, NOW + s.time, .001);
  assert.equal(b.state, 'alive', 'expired injury cannot finish a prey at the mouth');
  assert.equal(b.capturedBy, a.sessionId, 'ordinary size-based capture still applies');
}
console.log('Fixed injury passed: exact expiry under continuous pressure, stale-plan rejection, breathing/gust recovery, bot targeting, healthy capture, new injury and respawn for both actor roles.');
