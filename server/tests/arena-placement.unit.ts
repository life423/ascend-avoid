import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { spawnWeapon, initializeWeaponSets, updateWeapons, deployWeapon } from '../systems/weapons.js';
import { allWeapons, weaponKinds } from '../game/weaponKit.js';
import { findPartLayout, partClearOfFan, fanClearOfHole, PLACEMENT } from '../game/arenaPlacement.js';
import { TURBINE, WEAPON_FLEET } from '../constants/gameConstants.js';
import { BotBrain } from '../game/bots.js';

const NOW = 100000;
function required<T>(value: T | undefined): T { assert(value !== undefined); return value; }
function empty() {
  const s = new GameState(0); s.botFill = 0; s.fieldGemTarget = 0; s.weaponsOn = true;
  s.surgesOn = s.trafficOn = false; s.setTurbines('manual');
  return s;
}
function seeded<T>(seed: number, run: () => T): T {
  const previous = Math.random;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  try { return run(); } finally { Math.random = previous; }
}
function randomSequence<T>(values: number[], run: () => T): T {
  let i = 0; const previous = Math.random; Math.random = () => values[i++ % values.length];
  try { return run(); } finally { Math.random = previous; }
}
function checkParts(s: GameState): void {
  for (const w of allWeapons(s)) if (w.phase === 'parts') for (const p of w.parts) {
    assert(p.x >= 64 && p.y >= 64 && p.x <= s.worldWidth - 64 && p.y <= s.worldHeight - 64, 'the full badge stays inside the arena');
    for (const t of s.turbines) {
      assert(Math.hypot(p.x - t.x, p.y - t.y) > 140, 'parts clear the housing, flared inlet, swept outlet and badge');
      // An independent sampling of the real inner intake must not intersect the reserved pickup disc.
      const mx = t.x + Math.cos(t.intake) * 60, my = t.y + Math.sin(t.intake) * 60;
      for (const radius of [0, 50, 100, 150, 190]) for (const side of [-1, -.5, 0, .5, 1]) {
        const angle = t.intake + .7 * side;
        assert(Math.hypot(p.x - mx - Math.cos(angle) * radius, p.y - my - Math.sin(angle) * radius) >= 64 - 1e-6, 'a newly spawned part is outside the inner intake, including its side edges');
      }
    }
    for (const h of s.blackHoles) assert(Math.hypot(p.x - h.x, p.y - h.y) >= 168 - 1e-6, 'the part and its badge clear the black-hole ring');
  }
}

{
  const s = empty(); s.blackHoles.clear();
  assert(spawnWeapon(s, 2100, 2100));
  assert.equal(s.pinwheel.x, 2100); assert.equal(s.pinwheel.y, 2100);
  assert.equal(required(s.pinwheel.parts[0]).x, 2245, 'an unobstructed layout keeps its original coordinates');
}
for (const phase of ['warning', 'active', 'ending']) for (let direction = 0; direction < 8; direction++) for (const kind of weaponKinds) {
  const s = empty(); s.blackHoles.clear();
  const fan = new TurbineSchema('blocked', 2245, 2100, direction * Math.PI / 4, 0); fan.phase = phase; s.turbines.push(fan);
  assert(spawnWeapon(s, 2100, 2100, kind));
  assert.equal(s.pinwheel.parts.length, 3); assert.equal(new Set(s.pinwheel.parts.map(p => p.kind)).size, 3);
  checkParts(s);
  for (const a of s.pinwheel.parts) for (const b of s.pinwheel.parts) if (a !== b) assert(Math.abs(Math.hypot(a.x - b.x, a.y - b.y) - Math.sqrt(3) * 145) < 1e-6, 'relocation keeps the three-part set together');
}
{
  const fan = { x: 1000, y: 1000, intake: 0 };
  assert(!partClearOfFan({ x: 1240, y: 1000 }, fan), 'a clear-looking point in the inner inlet is still unsuitable');
  assert(partClearOfFan({ x: 1400, y: 1000 }, fan), 'the outer wind is not banned from the whole arena');
  assert(!fanClearOfHole(fan, { x: 1200, y: 1000, radius: 64 }), 'merely separated cores still look crowded');
  assert(fanClearOfHole(fan, { x: 1500, y: 1000, radius: 64 }), 'well-separated landmarks remain eligible');
}
for (const edge of [[0, 0], [4200, 4200], [0, 4200], [4200, 0]]) {
  const s = empty(); assert(spawnWeapon(s, edge[0], edge[1])); checkParts(s);
}
{
  const s = empty(); s.blackHoles.clear(); assert(spawnWeapon(s));
  const part = required(s.pinwheel.parts[0]);
  const nx = (part.x - 600) / 3000, ny = (part.y - 600) / 3000;
  const spot = randomSequence([nx, ny, 0, .05, .05, 0], () => s.turbineSpot());
  assert(spot && spot.x === 750 && spot.y === 750, 'a later fan skips a candidate underneath an existing part');
  const blocked = randomSequence([nx, ny, 0], () => s.turbineSpot());
  assert.equal(blocked, null, 'forty failed fan candidates have no unsafe fallback');
}
{
  const s = empty();
  const h = required(s.blackHoles[0]);
  const spot = randomSequence([(h.x - 600) / 3000, (h.y - 600) / 3000, 0, .05, .9, 0], () => s.turbineSpot());
  assert(spot && spot.x === 750 && spot.y === 3300, 'fans reject the pre-existing black-hole landmarks');
  assert.equal(randomSequence([(h.x - 600) / 3000, (h.y - 600) / 3000, 0], () => s.turbineSpot()), null);
}
{
  const s = empty(); s.blackHoles.clear(); s.worldWidth = s.worldHeight = 300;
  const actor = s.addPlayer('actor', 'Actor', NOW); actor.placeAt(20, 20);
  s.pinwheel.phase = 'waiting'; s.pinwheel.at = s.time; const due = s.pinwheel.at;
  updateWeapons(s, 0, NOW);
  assert.equal(s.pinwheel.phase, 'waiting'); assert.equal(s.pinwheel.parts.length, 0);
  assert.equal(s.pinwheel.at, due, 'a failed layout keeps its queue priority');
  assert.equal(s.nextWeaponPartsAt, s.time + PLACEMENT.RETRY_MS, 'blocked layouts retry without consuming the 12-second release budget');
  s.worldWidth = s.worldHeight = 4200; s.time += PLACEMENT.RETRY_MS;
  updateWeapons(s, 0, NOW + s.time);
  assert.equal(s.pinwheel.parts.length, 3); assert.equal(s.nextWeaponPartsAt, s.time + WEAPON_FLEET.PARTS_INTERVAL_MS);
}
{
  const s = empty(); s.blackHoles.clear(); assert(spawnWeapon(s));
  const before = s.pinwheel.parts.toJSON(); s.worldWidth = s.worldHeight = 300;
  assert(!spawnWeapon(s)); assert.deepEqual(s.pinwheel.parts.toJSON(), before, 'failed placement never clears existing parts or ownership');
  assert.equal(findPartLayout({ width: 200, height: 200, fans: [], holes: [], parts: [] }, 100, 100), null);
}
for (const bot of [false, true]) for (const contact of [false, true]) {
  const s = empty(); s.blackHoles.clear(); s.placeTurbine(2245, 2100, 0, true);
  assert(spawnWeapon(s));
  const p = s.addPlayer('collector', 'Collector', NOW); p.isBot = bot; p.dropProtection();
  const part = required(s.pinwheel.parts[0]);
  p.placeAt(part.x - p.width / 2 - (contact ? 0 : 110), part.y - p.height / 2); p.facing = 0;
  if (bot) {
    const brain = new BotBrain(); s.brains.set(p.sessionId, brain);
    const goal = brain.weaponPlan.goal(s, p, NOW);
    assert(goal && s.pinwheel.parts.some(piece => piece.x === goal.x && piece.y === goal.y), 'AI assembly targets the relocated physical component');
  }
  if (!contact) p.startInhale(NOW);
  for (let i = 0; i < 30 && !part.carriedBy; i++) updateWeapons(s, .033, NOW + i * 33);
  assert.equal(part.carriedBy, p.sessionId, 'relocated parts remain collectible by contact or inhale for either role');
  for (const other of s.pinwheel.parts.filter(() => true)) { p.placeAt(other.x - p.width / 2, other.y - p.height / 2); updateWeapons(s, .01, NOW); }
  assert.equal(s.pinwheel.phase, 'carried'); assert(deployWeapon(s, p), 'the real three-part assembly and Place action still work');
}

const layouts: { order: string; seed: number; fans: number; retries: number }[] = [];
for (const order of ['fans-first', 'parts-first']) for (let seed = 1; seed <= 64; seed++) seeded(seed, () => {
  const s = empty(); initializeWeaponSets(s);
  const parts = () => { for (const w of allWeapons(s)) assert(spawnWeapon(s, w.spawnX, w.spawnY, w.kind, w)); };
  if (order === 'parts-first') parts();
  let retries = 0;
  for (let i = 0; i < TURBINE.COUNT_MAX; i++) {
    let spot = null;
    for (let attempt = 0; attempt < 10 && !spot; attempt++) { spot = s.turbineSpot(); if (!spot) retries++; }
    if (spot) s.turbines.push(new TurbineSchema(String(i), spot.x, spot.y, spot.intake, 0));
  }
  if (order === 'fans-first') parts();
  checkParts(s);
  for (const fan of s.turbines) for (const hole of s.blackHoles) assert(Math.hypot(fan.x - hole.x, fan.y - hole.y) > 440, 'large landmarks retain visible separation');
  assert.equal(allWeapons(s).reduce((n, w) => n + w.parts.length, 0), 27, 'all nine builds still appear');
  layouts.push({ order, seed, fans: s.turbines.length, retries });
});
console.log(JSON.stringify({ layouts: layouts.length, minimumFans: Math.min(...layouts.map(s => s.fans)), maximumFans: Math.max(...layouts.map(s => s.fans)), delayedFanSearches: layouts.reduce((n, s) => n + s.retries, 0) }));
console.log('Arena placement passed: fan phases/headings, six recipes, complete sets, inner intake and black-hole clearance, later fan rejection, bounded retries, collection/assembly, bot/player parity and 128 crowded layouts.');
