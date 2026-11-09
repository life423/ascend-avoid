import assert from 'node:assert/strict';
import { GEMS, RELIC, WORLD } from '../constants/gameConstants.js';
import { arenaClearance } from '../game/arenaBoundary.js';
import { gemClearOfHoles } from '../game/arenaPlacement.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { GameState } from '../schema/GameState.js';
import { GemSchema } from '../schema/GemSchema.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { enableRelic, fireRelicComet } from '../systems/relic.js';
import { sprayRelicCometGems } from '../systems/relicCometGems.js';

const NOW = 100_000;
const TICK = 1 / 30;
const centerAt = (player: PlayerSchema, x: number, y: number) => player.placeAt(x - player.width / 2, y - player.height / 2);
const value = (gems: Iterable<GemSchema>) => Array.from(gems).reduce((sum, gem) => sum + gem.value, 0);

function arena(): GameState {
  const state = new GameState(0);
  state.botFill = 0;
  state.surgesOn = state.weaponsOn = state.trafficHits = false;
  state.setTurbines('off');
  state.blackHoles.clear();
  state.update(0, NOW);
  return state;
}

function survivor(state: GameState, x: number, y: number, stock: number): PlayerSchema {
  const target = state.addPlayer('target', 'target', NOW);
  target.resetGems(stock, WORLD.WIDTH, WORLD.HEIGHT);
  target.dropProtection();
  centerAt(target, x, y);
  target.setGems(stock / 4, WORLD.WIDTH, WORLD.HEIGHT);
  return target;
}

for (const { x, y, stock } of [
  { x: 2100, y: 2100, stock: 2_000_000 },
  { x: 743, y: 2100, stock: 2_000_000 },
  { x: 640, y: 640, stock: 33_000 },
  { x: 3560, y: 3560, stock: 33_000 },
  { x: 50, y: 2100, stock: 40 },
  { x: 245, y: 245, stock: 40 },
]) {
  const state = arena(), target = survivor(state, x, y, stock);
  const hole = new BlackHoleSchema(x < 2100 ? x + 450 : x - 450, y);
  state.blackHoles.push(hole);
  const bursts: unknown[] = [];
  state.onEvent = (type, payload) => { if (type === 'burst') bursts.push(payload); };
  const spilled = stock - target.gems;
  sprayRelicCometGems(state, target, x, y, spilled, NOW);
  const gems = [...state.gems.values()];
  assert.equal(value(gems), spilled);
  assert(gems.length <= GEMS.SPRAY_PIECES);
  assert.deepEqual(bursts, [{ x, y, count: spilled }]);
  for (const gem of gems) {
    assert(arenaClearance(gem.x, gem.y, WORLD.WIDTH, WORLD.HEIGHT) >= GEMS.RADIUS + 2);
    assert(gemClearOfHoles(gem, state.blackHoles));
    assert(!gem.touches(target, NOW + GEMS.OWNER_PICKUP_DELAY_MS, target.sessionId), 'every comet gem starts outside pickup reach');
    const pickupBox = { x: gem.x - 1, y: gem.y - 1, width: 2, height: 2 };
    assert(!gem.touches(pickupBox, NOW + GEMS.SPRAY_PICKUP_DELAY_MS - 1, 'rival'));
    assert(gem.touches(pickupBox, NOW + GEMS.SPRAY_PICKUP_DELAY_MS, 'rival'));
    assert(!gem.touches(pickupBox, NOW + GEMS.OWNER_PICKUP_DELAY_MS - 1, target.sessionId));
    assert(gem.touches(pickupBox, NOW + GEMS.OWNER_PICKUP_DELAY_MS, target.sessionId));
  }
}

{
  const state = arena(), target = survivor(state, 2100, 2100, 2_000_000);
  const spilled = 1_500_000;
  sprayRelicCometGems(state, target, 2100, 2100, spilled, NOW);
  // On open floor the two sets have a clear gap measured from the square pickup area.
  const extent = (gem: GemSchema) => Math.max(Math.abs(gem.x - 2100), Math.abs(gem.y - 2100));
  const gems = [...state.gems.values()].sort((a, b) => extent(a) - extent(b));
  let split = 1;
  for (let i = 2; i < gems.length; i++) {
    if (extent(gems[i]) - extent(gems[i - 1]) > extent(gems[split]) - extent(gems[split - 1])) split = i;
  }
  assert.equal(value(gems.slice(0, split)), 900_000);
  assert.equal(value(gems.slice(split)), 600_000);
}

for (const { label, x, y } of [
  { label: 'center', x: 2100, y: 2100 },
  { label: 'wall', x: 743, y: 2100 },
  { label: 'corner', x: 743, y: 743 },
]) for (const offset of [0, 450]) {
  const state = arena();
  enableRelic(state);
  const owner = state.addPlayer('owner', 'owner', NOW);
  owner.dropProtection();
  centerAt(owner, 3500, 3300);
  owner.relicCometReady = true;
  const target = state.addPlayer('target', 'target', NOW);
  target.resetGems(2_000_000, WORLD.WIDTH, WORLD.HEIGHT);
  target.dropProtection();
  centerAt(target, x, y);
  assert(fireRelicComet(state, owner, x + offset, y).ok);
  const impactTick = Math.ceil(RELIC.WARNING_MS / (1000 * TICK));
  for (let tick = 1; tick <= impactTick; tick++) state.update(TICK, NOW + tick * 1000 * TICK);
  assert.equal(state.relicComet.phase, 'impact');
  assert(target.injuredUntil > state.time);
  const spill = value(state.gems.values()), width = target.width, bank = target.gems;
  assert(spill > 0);
  const waitTicks = Math.ceil((GEMS.OWNER_PICKUP_DELAY_MS + 1000) / (1000 * TICK));
  for (let tick = 1; tick <= waitTicks; tick++) state.update(TICK, NOW + (impactTick + tick) * 1000 * TICK);
  assert([...state.gems.values()].every(gem => !gem.locked), 'the owner lock expired during the replay');
  assert.equal(value(state.gems.values()), spill, `${label} offset ${offset}: a stationary victim does not reclaim the spill after unlock`);
  assert(target.gems <= bank && target.width <= width, `${label} offset ${offset}: the victim stays shrunk`);
}

{
  const state = arena(), target = survivor(state, 2100, 2100, 33_000);
  sprayRelicCometGems(state, target, 2100, 2100, 90, NOW);
  const drop = [...state.gems][0];
  assert(drop);
  const [id, gem] = drop;
  const rival = state.addPlayer('rival', 'rival', NOW);
  rival.dropProtection();
  const dx = gem.x - 2100, dy = gem.y - 2100, distance = Math.hypot(dx, dy);
  centerAt(rival, gem.x + dx / distance * 110, gem.y + dy / distance * 110);
  rival.steer(-dx / distance, -dy / distance);
  for (let tick = 1; tick <= 60 && state.gems.has(id); tick++) state.update(TICK, NOW + tick * 1000 * TICK);
  assert(!state.gems.has(id), 'a rival can walk through the spill before the owner unlock');
  assert(rival.gems >= gem.value);
  assert(target.gems <= 8250, 'the owner did not reclaim any gems while locked');
}

{
  const state = arena(), target = survivor(state, 2100, 2100, 100);
  for (let i = 0; i < GEMS.MAX_GEMS; i++) state.gems.set(`field-${i}`, new GemSchema(80, 2100));
  sprayRelicCometGems(state, target, 2100, 2100, 9, NOW);
  const dropped = [...state.gems.values()].filter(gem => gem.sprayed);
  assert(dropped.length <= 2, 'a full field has at most one overflow entity per share');
  assert.equal(value(dropped), 9);
  assert(dropped.every(gem => !gem.touches(target, NOW + GEMS.OWNER_PICKUP_DELAY_MS, target.sessionId)));
}

{
  const state = arena(), target = survivor(state, 245, 245, 40);
  sprayRelicCometGems(state, target, 245, 245, 1, NOW);
  const gems = [...state.gems.values()];
  assert.equal(value(gems), 1);
  assert(gems.every(gem => !gem.touches(target, NOW + GEMS.OWNER_PICKUP_DELAY_MS, target.sessionId)));
}

{
  const state = arena(), target = survivor(state, 2100, 2100, 33_000);
  state.isFloorAt = (x, y) => x >= target.x && x <= target.x + target.width && y >= target.y && y <= target.y + target.height;
  const events: string[] = [];
  state.onEvent = type => events.push(type);
  assert.equal(sprayRelicCometGems(state, target, 2100, 2100, 10_000, NOW), false,
    'the helper declines a spill with no legal floor outside the survivor');
  assert.equal(state.gems.size, 0);
  assert.deepEqual(events, []);
}

console.log('Relic comet gems passed: exact value, direct/graze stationary recovery, rounded walls, black holes, ordinary owner lock, rival collection and full-field budget.');
