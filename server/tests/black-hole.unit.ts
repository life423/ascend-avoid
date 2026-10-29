import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { circleEntry } from '../game/blackHole.js';
import { updateFlights } from '../systems/flights.js';
import { BLACK_HOLE, WORLD } from '../constants/gameConstants.js';
const NOW = 100000;
function setup(bot = false) {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = s.weaponsOn = false; s.setTurbines('off');
  s.update(0, NOW); s.time = 10000; s.blackHoles.clear(); s.blackHoles.push(new BlackHoleSchema(2100, 2100, 64, 0));
  const owner = s.addPlayer('owner', 'Shooter', NOW), p = s.addPlayer('prey', 'Prey', NOW);
  owner.placeAt(500, 500); p.setGems(100, 4200, 4200); p.placeAt(1800 - p.width / 2, 2100 - p.height / 2);
  owner.spawnProtected = p.spawnProtected = false; p.isBot = owner.isBot = bot;
  const events: any[] = []; s.onEvent = (type, data) => { if (type === 'credit') events.push(data); };
  return { s, owner, p, events };
}
assert.equal(circleEntry(0, 0, 100, 0, 50, 0, 10), .4);
assert.equal(circleEntry(0, 10, 100, 10, 50, 0, 10), null, 'a tangent misses');
assert.equal(circleEntry(50, 0, 50, 0, 50, 0, 10), 0);
for (const bot of [false, true]) {
  const { s, p, owner, events } = setup(bot);
  p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0);
  updateFlights(s, NOW + 300, .3);
  assert.equal(p.state, 'dead', 'a fast shot cannot tunnel through the core'); assert(!p.flying);
 assert.equal(p.gems, 0);
  assert.equal([...s.gems.values()].reduce((n, g) => n + g.value, 0), 0, 'credited gems never also spill');
  assert.equal(owner.gems, 100, 'shooter receives the remaining bank');
  assert.equal(events.length, 1); assert.equal(events[0].byId, owner.sessionId); assert.equal(events[0].how, 'blackhole');
  updateFlights(s, NOW + 400, .1); assert.equal(events.length, 1, 'no duplicate knockout');
  s.spawn(p, p.respawnAt); assert(p.spawnProtected); assert.equal(p.state, 'alive'); assert.equal(p.shotOwner, '');
}
for (const kind of ['walking', 'skid', 'turbine', 'protected', 'warning', 'grace'] as const) {
  const { s, p, owner } = setup();
  if (kind === 'walking' || kind === 'skid') {
    if (kind === 'walking') p.setGems(1000000, 4200, 4200);
    p.placeAt(2100 - p.width / 2, 2100 - p.height / 2);
    if (kind === 'walking') p.steer(1, 0);
    if (kind === 'skid') p.skid(1, 0, 300);
    s.update(.03, NOW + 30);
  } else {
    p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0, kind === 'turbine' ? 'turbine' : 'missile');
    if (kind === 'protected') p.spawnProtected = true;
    if (kind === 'warning') s.blackHoles.at(0)!.activeAt = s.time + 1000;
    if (kind === 'grace') s.shiftPhase = 'grace';
    updateFlights(s, NOW + 300, .3);
  }
  assert.equal(p.state, 'alive', `${kind} is safe`);
}
{
  const { s, p, owner } = setup(); p.setGems(1000000, 4200, 4200);
  p.placeAt(1800 - p.width / 2, 2165 - p.height / 2); p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0);
  updateFlights(s, NOW + 300, .3); assert.equal(p.state, 'alive', 'a giant near miss uses its center, not its huge outer body');
}
{
  const { s, p, owner, events } = setup();
  p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0); p.flightHit = true; p.launchedBy = 'bounced-victim';
  s.removePlayer(owner.sessionId); updateFlights(s, NOW + 300, .3);
  assert.equal(events[0].byId, owner.sessionId, 'original shooter credit survives bounce and disconnect');
}
{
  const { s, p, owner, events } = setup(); s.blackHoles.at(0)!.x = 2400; s.blackHoles.push(new BlackHoleSchema(2100, 2100, 64, 0));
  p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0); updateFlights(s, NOW + 300, .3);
  assert(Math.abs(events[0].x - 2036) < .001, 'nearest crossed core wins regardless of array order');
}
for (const before of [false, true]) {
  const { s, p, owner, events } = setup(); const t = s.addPlayer('target', 'Target', NOW);
  t.spawnProtected = false; t.placeAt((before ? 1940 : 2450) - t.width / 2, 2100 - t.height / 2);
  p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0); updateFlights(s, NOW + 300, .3);
  assert.equal(events.some(e => e.how === 'blackhole'), !before, 'a player before the core is struck first; one behind it is safe');
}
{
  const { s, p, owner } = setup(); s.blackHoles.at(0)!.x = 4100;
  p.placeAt(3950 - p.width / 2, 2100 - p.height / 2); p.launch(NOW, 2200, 0, owner.sessionId, 5000, 0);
  updateFlights(s, NOW + 300, .3); assert.equal(p.state, 'dead', 'crossing a core before reaching the boundary still counts');
}
{
  const s = new GameState(0); assert.equal(s.blackHoles.length, BLACK_HOLE.POSITIONS.length);
  for (const h of s.blackHoles) {
    assert(h.x > BLACK_HOLE.RING_RADIUS && h.x < WORLD.WIDTH - BLACK_HOLE.RING_RADIUS);
    assert(h.y > BLACK_HOLE.RING_RADIUS && h.y < WORLD.HEIGHT - BLACK_HOLE.RING_RADIUS);
    for (const other of s.blackHoles) if (h !== other) assert(Math.hypot(h.x - other.x, h.y - other.y) > 1500);
  }
}
console.log('Black holes passed: swept core entry, near misses/giants, shot-only parity, protection, ordering, boundaries, conservation, pending reward discard, original credit and respawn.');
