import assert from 'node:assert/strict';
import { BLACK_HOLE, GEMS, SHIFT, SURGE } from '../constants/gameConstants.js';
import { clearGemPoint, gemClearOfHoles } from '../game/arenaPlacement.js';
import { arenaClearance } from '../game/arenaBoundary.js';
import { GameState } from '../schema/GameState.js';
import { GemSchema } from '../schema/GemSchema.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { topUpField, spreadSettledGems } from '../systems/gems.js';
import { updateSurges } from '../systems/surges.js';
const NOW = 100000, W = 4200;
function seeded<T>(seed: number, run: () => T): T {
  const original = Math.random;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try { return run(); } finally { Math.random = original; }
}
for (let seed = 1; seed <= 12; seed++) seeded(seed, () => {
  const s = new GameState();
  assert.equal(s.gems.size, GEMS.FIELD_COUNT); assert.equal(s.fieldGems, GEMS.FIELD_COUNT);
  assert([...s.gems.values()].every(gem => gemClearOfHoles(gem, s.blackHoles)), 'fresh field includes no gem or halo over a black-hole ring');
});
{
  const s = new GameState(0); s.fieldGemTarget = GEMS.FIELD_COUNT; s.time = 1000;
  seeded(42, () => topUpField(s));
  assert.equal(s.gems.size, GEMS.FIELD_REPLENISH_PER_S);
  assert.equal(s.fieldGems, GEMS.FIELD_REPLENISH_PER_S);
  assert([...s.gems.values()].every(gem => gemClearOfHoles(gem, s.blackHoles)), 'ordinary refill has the same clearance');
  const h = [...s.blackHoles][0]; assert(h); s.addGem(h.x, h.y);
  assert.equal(s.gems.size, GEMS.FIELD_REPLENISH_PER_S + 1);
  assert([...s.gems.values()].every(gem => gemClearOfHoles(gem, s.blackHoles)), 'explicit field placement also clears a hole');
  s.dropJackpot(h.x, h.y, 600);
  assert(s.jackpotOn && gemClearOfHoles({ x: s.jackpotX, y: s.jackpotY }, s.blackHoles));
  assert.equal(s.jackpotLandsAt, s.time + 600, 'jackpot placement preserves its landing time');
}
{
  const s = new GameState(0); s.layout = Array.from({ length: SHIFT.GRID ** 2 }, () => true);
  seeded(321, () => s.dropGems(300, 3, NOW));
  assert.equal(s.gems.size, 300); assert.equal(s.fieldGems, 0);
  assert.equal([...s.gems.values()].reduce((sum, g) => sum + g.value, 0), 900);
  assert([...s.gems.values()].every(g => g.falling && gemClearOfHoles(g, s.blackHoles)), 'showers retain count, value and falling timing');
}
{
  const s = new GameState(0), h = [...s.blackHoles][0]; assert(h); s.surgesOn = true; s.surgePhase = 'active'; s.surgeAt = SURGE.ACTIVE_MS;
  s.surgeX = h.x; s.surgeY = h.y; s.surgeShowerAt = 0; s.surgeJackpotDropped = true;
  const original = Math.random; Math.random = () => 0;
  try { updateSurges(s, 1 / 30, NOW); } finally { Math.random = original; }
  assert.equal(s.gems.size, SURGE.PIECES);
  assert([...s.gems.values()].every(g => g.value === SURGE.VALUE && g.falling && gemClearOfHoles(g, s.blackHoles)), 'even a shower aimed at the exact core keeps every gem outside the ring');
}
{
  const s = new GameState(0), h = [...s.blackHoles][0]; assert(h);
  const settled = new GemSchema(h.x, h.y, 7); s.gems.set('settled', settled);
  const flight = new GemSchema(h.x, h.y, 5); flight.launch(h.x, h.y, 0, 1000, NOW, 1, false); s.gems.set('flight', flight);
  const falling = new GemSchema(h.x, h.y, 4); falling.drop(NOW); s.gems.set('falling', falling);
  const spray = new GemSchema(h.x, h.y, 3); spray.spray(0, 300, NOW, 'owner'); s.gems.set('spray', spray);
  spreadSettledGems(s);
  assert(gemClearOfHoles(settled, s.blackHoles), 'legacy or drifted resting gems are moved clear');
  assert.equal(s.gems.size, 4); assert.equal([...s.gems.values()].reduce((sum, g) => sum + g.value, 0), 19);
  for (const g of [flight, falling, spray]) assert.deepEqual({x:g.x,y:g.y},{x:h.x,y:h.y}, 'active combat/falling/flight paths are not relocated');
  assert(flight.inFlight() && falling.falling && !spray.settled() && spray.owner === 'owner' && spray.locked);
  const before = { x: settled.x, y: settled.y }; spreadSettledGems(s); assert.deepEqual({ x: settled.x, y: settled.y }, before, 'clear resting gems do not drift from repeated placement');
}
{
  const holes = [new BlackHoleSchema(30, 30), new BlackHoleSchema(180, 30)];
  const point = clearGemPoint({ x: 30, y: 30 }, holes, W, W);
  assert(point && gemClearOfHoles(point, holes) && arenaClearance(point.x, point.y, W, W) >= GEMS.RADIUS + 2, 'rounded corners and nearby holes both constrain placement');
  const near = clearGemPoint({ x: 1050, y: 1260 }, [new BlackHoleSchema(1050, 1260)], W, W, p => p.x < 1050);
  assert(near && near.x < 1050, 'relocation respects an allowed-floor predicate');
  assert.equal(clearGemPoint({ x: 1050, y: 1260 }, [new BlackHoleSchema(1050, 1260)], W, W, () => false), null, 'blocked placement terminates without an unsafe fallback');
  const boundary = BLACK_HOLE.RING_RADIUS + 8 + GEMS.RADIUS * 2;
  assert(!gemClearOfHoles({ x: 1050 + boundary - .6, y: 1260 }, [new BlackHoleSchema(1050, 1260)]), 'integer replication cannot round a nominally safe point into the ring');
}
console.log('Gem/black-hole clearance passed: 12 full fields, refill, explicit placement, showers/surges, value/count preservation, settled cleanup, unaffected active paths, rounding, corners, overlapping holes and bounded floor fallback.');
