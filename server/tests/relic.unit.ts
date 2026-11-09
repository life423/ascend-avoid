import assert from 'node:assert/strict';
import { ARENA_RULES, INHALE, RELIC, TURBINE, WORLD } from '../constants/gameConstants.js';
import { arenaClearance } from '../game/arenaBoundary.js';
import { createPracticeArena } from '../practice/arena.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { GameState } from '../schema/GameState.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { enableRelic, fireRelicComet, placeRelicForTest, relicReservesHazard, updateRelic } from '../systems/relic.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';

const NOW = 100_000;
const STEP = 1 / 30;
const RELAY = { x: 2100, y: 2100 };
const PICKUP = { x: 1150, y: 2100 };
const GIANT_GEMS = 33_000;
const MAX_GIANT_GEMS = 2_000_000;

function arena() {
  const state = new GameState(0);
  state.botFill = 0;
  state.surgesOn = state.weaponsOn = state.trafficHits = false;
  state.setTurbines('off');
  state.blackHoles.clear();
  state.update(0, NOW);
  enableRelic(state);
  return state;
}

function place(player: PlayerSchema, x: number, y: number): void {
  player.placeAt(x - player.width / 2, y - player.height / 2);
}

function add(state: GameState, id: string, gems: number, x = PICKUP.x, y = PICKUP.y): PlayerSchema {
  const player = state.addPlayer(id, id, NOW);
  player.resetGems(gems, state.worldWidth, state.worldHeight);
  player.dropProtection();
  player.facing = 0;
  place(player, x, y);
  return player;
}

function pickup(state: GameState, player: PlayerSchema): void {
  assert(placeRelicForTest(state, PICKUP.x, PICKUP.y, RELAY.x, RELAY.y));
  updateRelic(state, NOW, STEP);
  assert.equal(state.relic.carrierId, player.sessionId);
}

{
  const practice = createPracticeArena();
  assert.equal(practice.relic.phase, 'disabled');
  assert.deepEqual(fireRelicComet(practice, undefined, 1200, 1200), { ok: false, reason: 'unavailable' });

  const state = arena();
  const human = add(state, 'human', 6000, RELAY.x, RELAY.y);
  const bot = add(state, 'bot', MAX_GIANT_GEMS);
  bot.isBot = true;
  assert.equal(state.relic.availableAt, RELIC.FIRST_MS);
  state.time = RELIC.FIRST_MS - 1;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'waiting');
  state.time++;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'waiting', 'a mid-size human and even a max-size bot do not open the event');
  assert(!relicReservesHazard(state, RELAY.x, RELAY.y, TURBINE.BODY_RADIUS),
    'a dormant relic leaves ordinary hazard placement alone');
  human.resetGems(GIANT_GEMS, WORLD.WIDTH, WORLD.HEIGHT);
  assert(relicReservesHazard(state, RELAY.x, RELAY.y, TURBINE.BODY_RADIUS),
    'an eligible giant lets the relay clear as old hazards move on');
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'available');
  assert.equal(state.relic.expiresAt, RELIC.FIRST_MS + RELIC.UNCLAIMED_MS);
  assert.equal(state.relic.relayX, RELAY.x);
  assert.equal(state.relic.relayY, RELAY.y);
  assert(Math.hypot(state.relic.x - RELAY.x, state.relic.y - RELAY.y) >= 1849,
    'an open arena chooses a long diagonal haul');
  human.resetGems(6000, WORLD.WIDTH, WORLD.HEIGHT);
  assert(relicReservesHazard(state, state.relic.x, state.relic.y, 60));
  assert(relicReservesHazard(state, RELAY.x, RELAY.y, 60), 'an available route remains reserved when its qualifier shrinks');
  human.resetGems(GIANT_GEMS, WORLD.WIDTH, WORLD.HEIGHT);
  assert(!relicReservesHazard(state, 100, 100, 60));
  assert(!placeRelicForTest(state, 0, 0, RELAY.x, RELAY.y), 'corner void cannot hold a relic');
  state.time = state.relic.expiresAt - 1;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'available');
  state.time++;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'waiting');
  assert.equal(state.relic.expiresAt, 0);
  assert.equal(state.relic.availableAt, state.time + RELIC.RESPAWN_MS);
  state.time = state.relic.availableAt - 1;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'waiting');
  state.time++;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'available');
}

{
  const state = arena();
  const small = add(state, 'small', 10);
  const bot = add(state, 'bot', MAX_GIANT_GEMS);
  bot.isBot = true;
  assert(placeRelicForTest(state, PICKUP.x, PICKUP.y, RELAY.x, RELAY.y));
  updateRelic(state, NOW, STEP);
  assert.equal(state.relic.phase, 'available', 'smaller players and bots cannot take the prototype relic');
  state.removePlayer(small.sessionId);
  state.removePlayer(bot.sessionId);

  const carrier = add(state, 'carrier', GIANT_GEMS);
  pickup(state, carrier);
  assert(PICKUP.x - state.relic.x <= RELIC.TOW_SPEED * STEP + 1e-9, 'attachment does not teleport cargo');
  for (let tick = 0; tick < 45; tick++) updateRelic(state, NOW, STEP);
  assert.equal(state.relic.x, PICKUP.x - carrier.width / 2 - RELIC.RADIUS - RELIC.TOW_GAP,
    'settled cargo trails outside the carrier’s body');
  carrier.steer(1, 0);
  let deliveredAt = 0;
  for (let tick = 1; tick <= 720; tick++) {
    state.update(STEP, NOW + tick * 1000 / 30);
    if (carrier.relicCometReady) { deliveredAt = state.time; break; }
  }
  assert(deliveredAt > 0, 'ordinary steering can haul the relic to the fixed relay');
  assert(carrier.x + carrier.width / 2 > RELAY.x + carrier.width / 2 - RELIC.RELAY_RADIUS,
    'the cargo, rather than the carrier center, reaches the relay');
  assert.equal(state.relic.phase, 'waiting');
  assert.equal(state.relic.carrierId, '');
  assert.equal(state.relic.availableAt, deliveredAt + RELIC.RESPAWN_MS);
  carrier.resetGems(100, WORLD.WIDTH, WORLD.HEIGHT);
  assert(carrier.relicCometReady, 'a saved charge survives shrinking');
  carrier.knockOut(NOW + deliveredAt);
  assert(!carrier.relicCometReady, 'a saved charge ends with its run');
}

{
  const state = arena(), carrier = add(state, 'carrier', GIANT_GEMS);
  assert(placeRelicForTest(state, PICKUP.x, PICKUP.y, RELAY.x, RELAY.y));
  state.time = RELIC.UNCLAIMED_MS - 500;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'towed');
  assert.equal(state.relic.expiresAt, 0);
  state.time += RELIC.UNCLAIMED_MS;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'towed', 'the unclaimed time does not run down while towed');
  carrier.injure(state.time);
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'available');
  assert.equal(state.relic.expiresAt, state.time + 500, 'a drop resumes the same unclaimed budget');
}

for (const reason of ['injury', 'breathing-block', 'shrink', 'knockout', 'capture', 'disconnect'] as const) {
  const state = arena(), carrier = add(state, 'carrier', GIANT_GEMS);
  pickup(state, carrier);
  if (reason === 'injury') carrier.injure(state.time);
  else if (reason === 'breathing-block') carrier.breathingBlocked = true;
  else if (reason === 'shrink') carrier.resetGems(100, WORLD.WIDTH, WORLD.HEIGHT);
  else if (reason === 'knockout') carrier.knockOut(NOW);
  else if (reason === 'capture') carrier.capturedBy = 'captor';
  else state.removePlayer(carrier.sessionId);
  updateRelic(state, NOW, STEP);
  assert.equal(state.relic.carrierId, '', reason);
  assert.equal(state.relic.phase, 'available', reason);
  assert(!carrier.relicCometReady);
}

{
  const state = arena(), carrier = add(state, 'carrier', MAX_GIANT_GEMS, RELAY.x, RELAY.y);
  state.time = RELIC.FIRST_MS;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'available');
  const pickup = { x: state.relic.x, y: state.relic.y };
  const pickupAt = state.time + 5000;
  const unclaimed = state.relic.expiresAt - pickupAt;
  place(carrier, pickup.x, pickup.y);
  carrier.facing = Math.atan2(RELAY.y - pickup.y, RELAY.x - pickup.x);
  for (let tick = 0; tick <= 60; tick++) {
    state.time = pickupAt + Math.round(tick * 1000 * STEP);
    updateRelic(state, NOW + state.time, STEP);
  }
  assert.equal(state.relic.carrierId, carrier.sessionId);
  const cargo = { x: state.relic.x, y: state.relic.y };
  assert(arenaClearance(cargo.x, cargo.y, WORLD.WIDTH, WORLD.HEIGHT) < carrier.width / 2,
    'the naturally spawned haul takes the cargo beyond the giant center inset');
  carrier.injure(state.time);
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'available');
  assert.equal(state.relic.carrierId, '');
  assert.equal(state.relic.expiresAt, state.time + unclaimed);
  assert(arenaClearance(state.relic.x, state.relic.y, WORLD.WIDTH, WORLD.HEIGHT) >= carrier.width / 2 + ARENA_RULES.EDGE_MARGIN);
  assert(Math.hypot(state.relic.x - cargo.x, state.relic.y - cargo.y) < Math.hypot(pickup.x - cargo.x, pickup.y - cargo.y),
    'a legal nearby drop is preferred to the original pickup');

  const rival = add(state, 'rival', MAX_GIANT_GEMS, state.relic.x, state.relic.y);
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'towed');
  assert.equal(state.relic.carrierId, rival.sessionId, 'another eligible giant can take the wall-side drop');
}

{
  const state = arena(), origin = { x: 950, y: RELAY.y };
  const carrier = add(state, 'carrier', MAX_GIANT_GEMS, origin.x, origin.y);
  assert(placeRelicForTest(state, origin.x, origin.y, RELAY.x, RELAY.y));
  for (let tick = 0; tick <= 60; tick++) updateRelic(state, NOW, STEP);
  const fan = new TurbineSchema('fan', 330, RELAY.y + 580, 0, 0);
  assert(!relicReservesHazard(state, fan.x, fan.y, TURBINE.BODY_RADIUS));
  state.turbines.push(fan);
  carrier.injure(state.time);
  updateRelic(state, NOW, STEP);
  assert.equal(state.relic.phase, 'available');
  assert.deepEqual({ x: state.relic.x, y: state.relic.y }, origin,
    'a fan blocking the nearby route sends the drop back to the protected origin');
}

{
  const state = arena();
  add(state, 'carrier', GIANT_GEMS, RELAY.x, RELAY.y);
  state.turbines.push(new TurbineSchema('fan', RELAY.x + 450, RELAY.y, 0, 0));
  state.time = RELIC.FIRST_MS;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relic.phase, 'waiting', 'an existing fan blocking the relay prevents an unreachable haul');
  assert.equal(state.relic.availableAt, RELIC.FIRST_MS + RELIC.RETRY_MS);
}

{
  const state = arena(), carrier = add(state, 'carrier', MAX_GIANT_GEMS, RELAY.x, RELAY.y);
  const fan = new TurbineSchema('fan', RELAY.x, 950, 0, 0);
  fan.phase = 'active';
  fan.phaseEndsAt = 100_000;
  state.turbines.push(fan);
  state.blackHoles.push(new BlackHoleSchema(RELAY.x, 3250));
  state.time = RELIC.FIRST_MS;
  const random = Math.random;
  try {
    Math.random = () => 0.5; // Exercise the route affected by the active fan's airflow.
    updateRelic(state, NOW + state.time, STEP);
  } finally {
    Math.random = random;
  }
  assert.equal(state.relic.phase, 'available', 'a fan and hole can coexist with a max-width haul route');
  const { x, y } = state.relic;
  const length = Math.hypot(RELAY.x - x, RELAY.y - y);
  assert(length >= 1449, 'an active fan and hole still allow a longer haul');
  const dx = (RELAY.x - x) / length, dy = (RELAY.y - y) / length;
  carrier.facing = Math.atan2(dy, dx);
  place(carrier, x, y);
  for (let tick = 1; tick <= 900 && !carrier.relicCometReady; tick++) {
    // Correct for the fan with ordinary steering while continuing toward the relay.
    const offsetX = carrier.x + carrier.width / 2 - x;
    const offsetY = carrier.y + carrier.height / 2 - y;
    const crossTrack = offsetY * dx - offsetX * dy;
    const correction = Math.max(-0.4, Math.min(0.4, -crossTrack / 425));
    carrier.steer(dx - dy * correction, dy + dx * correction);
    state.update(STEP, NOW + RELIC.FIRST_MS + tick * 1000 / 30);
  }
  assert(carrier.relicCometReady, 'the max-width carrier can follow the ordinary verified route with steering');
}

{
  const state = arena();
  const owner = add(state, 'owner', 1000, RELAY.x, RELAY.y);
  const inner = add(state, 'inner', 1000, RELAY.x + RELIC.DIRECT_RADIUS, RELAY.y);
  const halfway = add(state, 'halfway', 1000, RELAY.x, RELAY.y + RELIC.GRAZE_RADIUS);
  const graze = add(state, 'graze', 1000, RELAY.x - (RELIC.INNER_RADIUS - 7.5), RELAY.y);
  const edge = add(state, 'edge', 1000, RELAY.x - RELIC.INNER_RADIUS, RELAY.y);
  const tinyGraze = add(state, 'tiny-graze', 2, RELAY.x, RELAY.y - (RELIC.INNER_RADIUS - 1));
  const outer = add(state, 'outer', 1000, RELAY.x + RELIC.INNER_RADIUS + 5, RELAY.y);
  const giant = add(state, 'giant', MAX_GIANT_GEMS, RELAY.x + RELIC.OUTER_RADIUS + 5, RELAY.y);
  const protectedTarget = add(state, 'protected', 1000, RELAY.x, RELAY.y);
  protectedTarget.protectFor(10_000, NOW);
  const launched = add(state, 'launch-safe', 1000, RELAY.x, RELAY.y);
  launched.launchSafeUntil = RELIC.WARNING_MS + 1;
  const recovering = add(state, 'recovering', 1000, RELAY.x, RELAY.y);
  const newborn = add(state, 'newborn', 1, RELAY.x, RELAY.y);
  const challenger = add(state, 'challenger', 6000, 3500, 3300);
  owner.relicCometReady = challenger.relicCometReady = true;

  assert.deepEqual(fireRelicComet(state, owner, 5, 5), { ok: false, reason: 'invalid-target' });
  assert.deepEqual(fireRelicComet(state, owner, Infinity, RELAY.y), { ok: false, reason: 'invalid-target' });
  owner.stun(NOW, 1000);
  assert.deepEqual(fireRelicComet(state, owner, RELAY.x, RELAY.y), { ok: false, reason: 'blocked' });
  owner.stunned = false;
  assert(owner.relicCometReady, 'invalid or blocked targeting keeps the charge');
  assert.deepEqual(fireRelicComet(state, owner, RELAY.x, RELAY.y), { ok: true });
  assert(!owner.relicCometReady);
  assert.deepEqual(fireRelicComet(state, owner, RELAY.x, RELAY.y), { ok: false, reason: 'not-ready' });
  assert.deepEqual(fireRelicComet(state, challenger, RELAY.x, RELAY.y), { ok: false, reason: 'busy' });
  assert(challenger.relicCometReady);
  const strike = { ...state.relicComet.toJSON() };
  assert.deepEqual(strike, { phase: 'inbound', id: 1, x: RELAY.x, y: RELAY.y, impactAt: RELIC.WARNING_MS, ownerId: owner.sessionId });

  state.time = strike.impactAt - 1;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(inner.gems, 1000);
  assert.equal(outer.puffVx, 0);
  state.time++;
  recovering.recover(NOW + state.time);
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relicComet.phase, 'impact');
  assert.equal(inner.gems, 250);
  assert.equal(halfway.gems, 500);
  assert.equal(graze.gems, 950);
  assert.equal(inner.injuredUntil, state.time + INHALE.INJURY_MS);
  assert.equal(graze.injuredUntil, inner.injuredUntil);
  assert.equal([...state.gems.values()].reduce((sum, gem) => sum + gem.value, 0), 1300);
  assert.equal(edge.gems, 1000);
  assert.equal(edge.injuredUntil, 0);
  assert.equal(edge.puffVx, -RELIC.SHOVE_SPEED);
  assert.equal(tinyGraze.gems, 2, 'a tiny graze may round down to zero gems');
  assert.equal(tinyGraze.injuredUntil, 0);
  assert.equal(outer.gems, 1000);
  assert.equal(outer.injuredUntil, 0);
  assert.equal(outer.puffVx, RELIC.SHOVE_SPEED);
  for (const player of [owner, protectedTarget, launched, recovering, giant]) {
    assert.equal(player.gems, player === giant ? MAX_GIANT_GEMS : 1000);
    assert.equal(player.puffVx, 0);
    assert.equal(player.injuredUntil, 0);
  }
  assert.equal(newborn.gems, 1);
  assert.equal(newborn.state, 'alive');
  state.time += RELIC.IMPACT_VISIBLE_MS;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relicComet.phase, 'idle');
  assert.equal(inner.gems, 250, 'impact damage applies exactly once');
}

for (const position of ['center', 'wall'] as const) {
  const state = arena();
  const owner = add(state, 'owner', 6000, 3500, 3300);
  const strikeX = position === 'wall' ? 743 : RELAY.x;
  const giant = add(state, 'giant', MAX_GIANT_GEMS, strikeX, RELAY.y);
  assert.equal(giant.width, 1470);
  owner.relicCometReady = true;
  assert.deepEqual(fireRelicComet(state, owner, strikeX, RELAY.y), { ok: true });
  for (let tick = 1; state.relicComet.phase === 'inbound'; tick++) {
    assert(tick < 220, 'strike resolves near the intended warning time');
    if (tick === 31) giant.steer(0, 1);
    state.update(STEP, NOW + tick * 1000 / 30);
  }
  const clearance = giant.y + giant.height / 2 - RELAY.y;
  assert(clearance > RELIC.INNER_RADIUS, `ordinary max-size movement clears the damaging core after a one-second response at ${position}`);
  assert(clearance < RELIC.OUTER_RADIUS, 'the outer shockwave is wider than the damaging core');
  assert.equal(giant.injuredUntil, 0);
  assert(giant.puffVy > 0);
}

{
  const state = arena();
  const owner = add(state, 'owner', 6000), victim = add(state, 'victim', MAX_GIANT_GEMS, RELAY.x, RELAY.y);
  owner.relicCometReady = true;
  assert.deepEqual(fireRelicComet(state, owner, RELAY.x, RELAY.y), { ok: true });
  owner.knockOut(NOW);
  state.removePlayer(owner.sessionId);
  state.time = RELIC.WARNING_MS;
  updateRelic(state, NOW + state.time, STEP);
  assert.equal(state.relicComet.ownerId, owner.sessionId);
  assert.equal(victim.gems, 500_000, 'a committed strike survives the owner’s knockout and departure');
  assert.equal(victim.state, 'alive', 'even a direct hit does not immediately end a run');
  assert.equal(victim.width, 735, 'the lost gems immediately debit the visible giant body');
}

console.log('Relic passed for safe placement, real haul, drops, saved charges, fixed warning, blast bands and lifecycle.');
