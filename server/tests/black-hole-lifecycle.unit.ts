import assert from 'node:assert/strict';
import { BLACK_HOLE, BOTS } from '../constants/gameConstants.js';
import { blackHoleHasRim, blackHoleIsLethal, blackHoleReservesSpace, slideBlackHoleRims } from '../game/blackHole.js';
import { gemClearOfHoles, fanClearOfHole } from '../game/arenaPlacement.js';
import { GameState } from '../schema/GameState.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { updateBlackHoles } from '../systems/blackHoles.js';
import { updateFlights } from '../systems/flights.js';
import { botMouth } from '../systems/bots.js';
import { BotBrain } from '../game/bots.js';

const NOW = 100000;
function setup() {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.surgesOn = s.weaponsOn = s.trafficOn = false; s.setTurbines('off');
  s.update(0, NOW); s.time = 0; s.blackHoles.clear();
  const h = new BlackHoleSchema(1050, 1680, 64, 0); h.cycling = true; h.at = 100;
  s.blackHoles.push(h);
  return { s, h, step: (time: number) => { s.time = time; updateBlackHoles(s); } };
}

{
  const { s, h, step } = setup(), original = { x: h.x, y: h.y };
  step(99); assert.equal(h.phase, 'active');
  step(100); assert.equal(h.phase, 'closing'); assert.equal(h.at, 100 + BLACK_HOLE.CLOSING_MS);
  assert(blackHoleHasRim(h) && blackHoleIsLethal(h, s.time), 'closing visibly retains the entire lethal core and safe walking rim');
  step(h.at - 1); assert.deepEqual({ x: h.x, y: h.y }, original, 'an active or closing core never moves');
  step(h.at); assert.equal(h.phase, 'dormant');
  assert(!blackHoleHasRim(h) && !blackHoleIsLethal(h, s.time) && !blackHoleReservesSpace(h));
  assert(gemClearOfHoles(original, [h]) && fanClearOfHole(original, h), 'invisible old coordinates reserve neither loot nor fan space');
  step(h.at); assert.equal(h.phase, 'warning'); assert.equal(h.generation, 1);
  assert(Math.hypot(h.x - original.x, h.y - original.y) >= BLACK_HOLE.RELOCATE_MIN);
  assert.equal(h.activeAt, s.time + BLACK_HOLE.WARNING_MS);
  assert(!blackHoleHasRim(h) && !blackHoleIsLethal(h, h.activeAt), 'the warned location is harmless until the authoritative opening transition');
  assert(!gemClearOfHoles(h, [h]) && !fanClearOfHole(h, h), 'new warnings reserve visible landmark space before opening');
  const destination = { x: h.x, y: h.y };
  step(h.at - 1); assert.equal(h.phase, 'warning');
  step(h.at); assert.equal(h.phase, 'active'); assert.equal(h.at, s.time + BLACK_HOLE.ACTIVE_MS);
  assert.deepEqual({ x: h.x, y: h.y }, destination); assert(blackHoleIsLethal(h, s.time));
}
for (const flying of [false, true]) {
  const { s, h, step } = setup();
  step(100); step(h.at); step(h.at); assert.equal(h.phase, 'warning');
  const p = s.addPlayer('late', 'Late entrant', NOW); p.placeAt(h.x - p.width / 2, h.y - p.height / 2);
  if (flying) p.launch(NOW, 100, 0, 'shooter', 1000, 0);
  const position = { x: p.x, y: p.y }, gems = p.gems;
  step(h.at);
  assert.equal(h.phase, 'dormant', 'a late walking or flying entrant cancels opening instead of being trapped or killed');
  assert.deepEqual({ x: p.x, y: p.y }, position); assert.equal(p.gems, gems); assert.equal(p.state, 'alive');
  assert.equal(h.at, s.time + BLACK_HOLE.RETRY_MS);
  s.removePlayer(p.sessionId); step(h.at); assert.equal(h.phase, 'warning', 'the next attempt gives a complete fresh warning');
  assert.equal(h.at - s.time, BLACK_HOLE.WARNING_MS);
}
{
  const { s, h, step } = setup();
  h.phase = 'warning'; h.activeAt = h.at = BLACK_HOLE.WARNING_MS;
  const original = { x: h.x, y: h.y };
  step(h.at);
  assert.equal(h.phase, 'active'); assert.deepEqual({ x: h.x, y: h.y }, original);
  assert.equal(h.at - s.time, BLACK_HOLE.ACTIVE_MS);

  step(h.at); step(h.at); step(h.at);
  assert.equal(h.phase, 'warning');
  const cancelled = { x: h.x, y: h.y };
  assert(Math.hypot(cancelled.x - original.x, cancelled.y - original.y) >= BLACK_HOLE.RELOCATE_MIN);
  const blocker = s.addPlayer('late', 'Late entrant', NOW);
  blocker.placeAt(h.x - blocker.width / 2, h.y - blocker.width / 2);
  step(h.at);
  assert.equal(h.phase, 'dormant');
  s.removePlayer(blocker.sessionId);

  // Leave only the former live grid point eligible by floor geometry.
  const isFloorAt = s.isFloorAt;
  s.isFloorAt = (x, y) => Math.hypot(x - original.x, y - original.y) < 160;
  step(h.at);
  assert.equal(h.phase, 'dormant', 'a cancelled warning must not make the old active core eligible again');
  assert.equal(h.at - s.time, BLACK_HOLE.RETRY_MS);
  s.isFloorAt = isFloorAt;
  step(h.at);
  assert.equal(h.phase, 'warning');
  assert.equal(h.at - s.time, BLACK_HOLE.WARNING_MS);
  for (const point of [original, cancelled]) {
    assert(Math.hypot(h.x - point.x, h.y - point.y) >= BLACK_HOLE.RELOCATE_MIN, 'the retry clears both prior sites');
  }
  const next = { x: h.x, y: h.y };
  step(h.at);
  assert.equal(h.phase, 'active'); assert.deepEqual({ x: h.x, y: h.y }, next);
  assert.equal(h.at - s.time, BLACK_HOLE.ACTIVE_MS);
}
{
  const { s, h, step } = setup();
  step(1e6); assert.equal(h.phase, 'closing'); assert.equal(h.at, 1e6 + BLACK_HOLE.CLOSING_MS);
  step(2e6); assert.equal(h.phase, 'dormant'); assert.equal(h.at, 2e6 + BLACK_HOLE.DORMANT_MS);
  step(3e6); assert.equal(h.phase, 'warning'); assert.equal(h.at, 3e6 + BLACK_HOLE.WARNING_MS, 'server pauses cannot fast-forward a new-location warning');
  s.worldWidth = s.worldHeight = 100;
  step(h.at); assert.equal(h.phase, 'dormant'); const old = { x: h.x, y: h.y };
  step(h.at); assert.equal(h.phase, 'dormant'); assert.deepEqual({ x: h.x, y: h.y }, old, 'no unsafe fallback when every location is blocked');
}
{
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.setTurbines('off');
  s.time = BLACK_HOLE.WARNING_MS; updateBlackHoles(s);
  assert(s.blackHoles.every(h => h.phase === 'active'));
  const deadlines = s.blackHoles.map(h => h.at);
  assert.equal(deadlines[1] - deadlines[0], BLACK_HOLE.STAGGER_MS);
  assert.equal(deadlines[2] - deadlines[1], BLACK_HOLE.STAGGER_MS);
  s.time = deadlines[0]; updateBlackHoles(s);
  assert.deepEqual(s.blackHoles.map(h => h.phase), ['closing', 'active', 'active']);
  const fixed = new BlackHoleSchema(2100, 2100, 64, 50); s.blackHoles.clear(); s.blackHoles.push(fixed);
  s.time = 49; updateBlackHoles(s); assert.equal(fixed.phase, 'warning');
  s.time = 1e7; updateBlackHoles(s); assert.equal(fixed.phase, 'active');
  s.time += 1e7; updateBlackHoles(s); assert.equal(fixed.phase, 'active', 'tutorial/static landmarks retain their authored lifetime');
}
for (const phase of ['warning', 'active', 'closing', 'dormant']) {
  const { s, h } = setup(); h.phase = phase; h.activeAt = 0; h.x = h.y = 2100;
  const body = { x: 1960, y: 2080, width: 40, height: 40 };
  const routed = slideBlackHoleRims(body, 1920, 2080, [h], 4200, 4200, 1 / 30);
  if (phase === 'warning' || phase === 'dormant') assert.deepEqual(routed, { x: body.x, y: body.y }, 'harmless phases have no invisible collision');
  const owner = s.addPlayer('owner', 'Shooter', NOW), p = s.addPlayer('shot', 'Shot', NOW);
  owner.placeAt(500, 500); p.setGems(100, 4200, 4200); p.placeAt(1800 - p.width / 2, 2100 - p.width / 2);
  p.dropProtection(); p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0);
  updateFlights(s, NOW + 300, .3);
  assert.equal(p.state === 'dead', phase === 'active' || phase === 'closing', 'flight collision matches the visible core lifetime');
  assert.equal(owner.gems, phase === 'active' || phase === 'closing' ? 100 : 0, 'a shot after closure receives no black-hole reward');
}
for (const phase of ['warning', 'active', 'closing', 'dormant']) {
  const { s, h } = setup(); h.phase = phase; h.at = s.time + 1;
  const bot = s.addPlayer('bot', 'Bot', NOW), ammo = s.addPlayer('ammo', 'Ammo', NOW);
  bot.isBot = true; bot.setGems(3000, 4200, 4200); bot.placeAt(h.x - 700 - bot.width / 2, h.y - bot.height / 2);
  bot.dropProtection(); ammo.dropProtection(); bot.gulping = ammo.sessionId; ammo.capturedBy = bot.sessionId; bot.captureStartedAt = NOW;
  const brain = new BotBrain(); s.brains.set(bot.sessionId, brain);
  botMouth(s, bot, NOW); botMouth(s, bot, NOW + BOTS.FIRE_READ_MS + 1);
  assert.equal(brain.cannonAim.targetId, phase === 'active' ? 'hole:0:0' : null, 'bots reject harmless phases and a closing core that will disappear before the shot arrives');
  if (phase === 'active') {
    h.generation++; h.y += 600;
    botMouth(s, bot, NOW + BOTS.FIRE_READ_MS + 2);
    assert.equal(brain.cannonAim.targetId, null, 'relocation invalidates old aim immediately instead of silently tracking the moved slot');
  }
  assert(!ammo.flying, 'hole selection never skips normal observation/aiming delay');
}
console.log('Black-hole lifecycle passed: stationary closing, harmless full warnings/dormancy, safe late-entry cancellation and retry spacing, staggered retirement, bounded retries, pause safety, static tutorials, phase-matched rims/flights, exact rewards and stale bot target rejection.');
