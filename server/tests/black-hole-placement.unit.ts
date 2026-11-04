import assert from 'node:assert/strict';
import { BLACK_HOLE, ARENA_RULES, GEMS } from '../constants/gameConstants.js';
import { blackHoleSpotClear, findBlackHoleSpot } from '../game/blackHolePlacement.js';
import { arenaClearance, constrainArenaPoint } from '../game/arenaBoundary.js';
import { distanceToSegment } from '../game/geometry.js';
import { GameState } from '../schema/GameState.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { WeaponPartSchema } from '../schema/PinwheelSchema.js';

function empty(): GameState {
  const s = new GameState(0);
  s.botFill = s.fieldGemTarget = 0; s.setTurbines('off');
  s.weaponsOn = s.surgesOn = s.trafficOn = false;
  return s;
}
function first(s: GameState): BlackHoleSchema {
  const h = s.blackHoles[0]; assert(h); return h;
}
function seeded<T>(seed: number, run: () => T): T {
  const previous = Math.random;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try { return run(); } finally { Math.random = previous; }
}

// Independent, finer route search verifies generated layouts. Continuous edges
// reserve the actual full physical body and rim, not just the grid endpoints.
function checkGiantRoutes(s: GameState): void {
  const size = Math.max(ARENA_RULES.PLAYER_SIZE, Math.min(s.worldWidth, s.worldHeight) * GEMS.SIZE_MAX_SHARE);
  const pad = size / 2 + ARENA_RULES.EDGE_MARGIN, n = 80, count = n + 1;
  const dx = (s.worldWidth - 2 * pad) / n, dy = (s.worldHeight - 2 * pad) / n;
  const holes = s.blackHoles.filter(h => h.phase !== 'dormant').map(h => ({ x: h.x, y: h.y, r: h.radius + size / 2 + BLACK_HOLE.RIM_CLEARANCE + 4 }));
  const point = (id: number) => ({ x: pad + id % count * dx, y: pad + Math.floor(id / count) * dy });
  const clear = (p: { x: number; y: number }) => arenaClearance(p.x, p.y, s.worldWidth, s.worldHeight) >= pad - 1e-6
    && holes.every(h => Math.hypot(p.x - h.x, p.y - h.y) >= h.r);
  const segment = (a: { x: number; y: number }, b: { x: number; y: number }) => holes.every(h => distanceToSegment(h.x, h.y, a.x, a.y, b.x, b.y) >= h.r);
  const center = n / 2 * count + n / 2, seen = new Set([center]), queue = [center];
  assert(clear(point(center)), 'central full-body region remains open');
  for (let head = 0; head < queue.length; head++) {
    const id = queue[head], x = id % count, y = Math.floor(id / count);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      if (x + ox < 0 || x + ox > n || y + oy < 0 || y + oy > n) continue;
      const next = (y + oy) * count + x + ox;
      if (seen.has(next) || !clear(point(next)) || !segment(point(id), point(next))) continue;
      seen.add(next); queue.push(next);
    }
  }
  for (const [x, y] of [[0, 0], [s.worldWidth, 0], [0, s.worldHeight], [s.worldWidth, s.worldHeight]]) {
    const corner = { x, y }; constrainArenaPoint(corner, s.worldWidth, s.worldHeight, pad);
    assert(clear(corner), 'the full legal giant corner body stays outside every new core/rim');
    assert(queue.some(id => Math.hypot(point(id).x - corner.x, point(id).y - corner.y) <= Math.hypot(dx, dy) * 2
      && segment(corner, point(id))), 'each giant corner connects to center along continuously clear edges');
  }
  for (let i = 0; i < holes.length; i++) for (let j = i + 1; j < holes.length; j++) {
    assert(Math.hypot(holes[i].x - holes[j].x, holes[i].y - holes[j].y)
      >= size + BLACK_HOLE.CORE_RADIUS * 2 + BLACK_HOLE.RIM_CLEARANCE * 2 + 64 - 1e-6, 'hole pairs leave a full body plus a useful corridor margin');
  }
}

{
  const s = empty(), h = first(s);
  assert(blackHoleSpotClear(s, h, h.x, h.y), 'a safe warned location can activate without moving again');
  const before = { x: h.x, y: h.y, radius: h.radius, phase: h.phase };
  const spot = seeded(17, () => findBlackHoleSpot(s, h)); assert(spot);
  assert(Math.hypot(spot.x - h.x, spot.y - h.y) >= 600);
  assert(spot.x >= s.worldWidth * .1 && spot.x <= s.worldWidth * .9);
  assert(spot.y >= s.worldHeight * .1 && spot.y <= s.worldHeight * .9);
  assert(blackHoleSpotClear(s, h, spot.x, spot.y));
  assert.deepEqual({ x: h.x, y: h.y, radius: h.radius, phase: h.phase }, before, 'selection is pure and preserves the 64-unit physical core');
  assert(!blackHoleSpotClear(s, h, 80, 2100), 'the full visible ring clears the wall');
  assert(!blackHoleSpotClear(s, h, 100, 100), 'rounded-wall clearance matches rendering');
  assert(!blackHoleSpotClear(s, h, NaN, 2100)); assert(!blackHoleSpotClear(s, h, 2100, Infinity));
}
for (const flying of [false, true]) for (const bot of [false, true]) {
  const s = empty(), h = first(s), p = s.addPlayer('blocker', 'Blocker', 100000);
  p.isBot = bot; p.flying = flying; p.placeAt(h.x - p.width / 2, h.y - p.height / 2);
  assert(!blackHoleSpotClear(s, h, h.x, h.y), 'protected, flying and ordinary alive players all block emergence');
  const margin = 104 + p.width / 2 + BLACK_HOLE.PLAYER_CLEARANCE;
  p.placeAt(h.x + margin - 1 - p.width / 2, h.y - p.height / 2);
  assert(!blackHoleSpotClear(s, h, h.x, h.y), 'the extra 120-unit player escape space is reserved');
  p.placeAt(h.x + margin + 1 - p.width / 2, h.y - p.height / 2);
  assert(blackHoleSpotClear(s, h, h.x, h.y), 'farther players do not unnecessarily disable the slot');
  p.placeAt(h.x, h.y); p.state = 'dead';
  assert(blackHoleSpotClear(s, h, h.x, h.y), 'dead bodies do not reserve obsolete collision space');
}
for (const phase of ['warning', 'active', 'ending']) {
  const s = empty(), h = first(s), fan = new TurbineSchema('fan', h.x + 400, h.y, Math.PI, 0);
  fan.phase = phase; s.turbines.push(fan);
  assert(!blackHoleSpotClear(s, h, h.x, h.y), 'fan housing/intake and visible hazard gap stay clear in every phase');
  fan.x = h.x + 500; assert(blackHoleSpotClear(s, h, h.x, h.y));
}
{
  const s = empty(), h = first(s), part = new WeaponPartSchema();
  s.pinwheel.phase = 'parts'; part.x = h.x + 167; part.y = h.y; s.pinwheel.parts.push(part);
  assert(!blackHoleSpotClear(s, h, h.x, h.y), 'loose part badges cannot overlap the new ring');
  part.carriedBy = 'carrier'; assert(blackHoleSpotClear(s, h, h.x, h.y));
  part.carriedBy = ''; part.x += 2; assert(blackHoleSpotClear(s, h, h.x, h.y));
  for (const phase of ['charging', 'active']) {
    s.pinwheel.phase = phase; s.pinwheel.x = h.x; s.pinwheel.y = h.y;
    assert(!blackHoleSpotClear(s, h, h.x, h.y), 'placed machines cannot be hidden by a new core');
    s.pinwheel.x = h.x + 180; assert(blackHoleSpotClear(s, h, h.x, h.y));
  }
}
{
  const s = empty(), h = first(s), other = new BlackHoleSchema(h.x + 600, h.y);
  s.blackHoles.push(other);
  for (const phase of ['active', 'closing', 'warning']) {
    other.phase = phase; assert(!blackHoleSpotClear(s, h, h.x, h.y), 'live and warned slots reserve future giant corridors');
  }
  other.phase = 'dormant'; assert(blackHoleSpotClear(s, h, h.x, h.y));
  s.blackHoles.clear(); s.blackHoles.push(h);
  assert(!blackHoleSpotClear(s, h, 2100, 2100), 'an isolated center-blocking core fails the route proof');
  assert(!blackHoleSpotClear(s, h, 840, 840), 'an isolated corner-trapping core fails even with no neighboring holes');
}
{
  const s = empty(), h = first(s); s.worldWidth = s.worldHeight = 180;
  const original = Math.random; let randomCalls = 0; Math.random = () => { randomCalls++; return .5; };
  try { assert.equal(findBlackHoleSpot(s, h), null, 'a crowded/small map has no forced fallback'); }
  finally { Math.random = original; }
  assert(randomCalls <= 288, 'all candidate generation/shuffling is bounded');
}
let generated = 0, deferred = 0;
for (let seed = 1; seed <= 24; seed++) seeded(seed, () => {
  const s = empty();
  for (let round = 0; round < 2; round++) for (const h of s.blackHoles) {
    const old = { x: h.x, y: h.y }; h.phase = 'dormant';
    const spot = findBlackHoleSpot(s, h);
    if (!spot) { deferred++; h.phase = 'active'; continue; }
    assert(Math.hypot(spot.x - old.x, spot.y - old.y) >= 600 - 1e-6);
    h.x = spot.x; h.y = spot.y; h.phase = 'warning'; generated++;
    checkGiantRoutes(s);
  }
});
assert(generated >= 72, 'relocation finds useful alternatives across many seeded layouts');
{
  const s = empty(); s.blackHoles.clear(); s.worldWidth = s.worldHeight = 1800;
  const h = new BlackHoleSchema(450, 720); s.blackHoles.push(h);
  const spot = seeded(5, () => findBlackHoleSpot(s, h)); assert(spot);
  assert(Math.hypot(spot.x - h.x, spot.y - h.y) >= 600 * 1800 / 4200 - 1e-6, 'minimum relocation scales down with a smaller arena');
  h.x = spot.x; h.y = spot.y; checkGiantRoutes(s);
}
console.log(JSON.stringify({ generatedSafeLayouts: generated, deferredNoSpace: deferred, maximumWidth: 4200 * GEMS.SIZE_MAX_SHARE }));
console.log('Black-hole placement passed: bounded relocation, authoritative activation revalidation, player/fan/part/machine spacing, reserved warning/closing slots, and independent full-body corner connectivity.');
