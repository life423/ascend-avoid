import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CoreSchema } from '../schema/CoreSchema.js';
import { CANNON, EXHALE, GEMS, SURGE } from '../constants/gameConstants.js';
import { moveSpeed } from '../game/movement.js';
import { escapePress, escapeSteer, exhale, fireCaptive, stealWeight, updateHolds, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { beginSurge, updateSurges } from '../systems/surges.js';
import { updateJackpot } from '../systems/gems.js';
import { captureLoadMs, escapeLength } from '../game/cannon.js';
import { BotBrain } from '../game/bots.js';
import { keepApart, pruneBodyContacts } from '../systems/bodies.js';

const NOW = 100_000;
function world() {
  const state = new GameState(0);
  state.botFill = 0;
  state.surgesOn = false;
  state.setTurbines('off');
  state.update(0, NOW);
  return state;
}
function player(state: GameState, id: string, gems = 0, x = 1000, y = 1000) {
  const p = state.addPlayer(id, id, NOW);
  p.setGems(gems, state.worldWidth, state.worldHeight);
  p.placeAt(x, y);
  p.spawnProtected = false;
  return p;
}
function capture(gems = 16) {
  const state = world();
  const captor = player(state, 'captor', gems);
  const captive = player(state, 'captive', 4);
  captive.placeAt(captor.x + captor.width, captor.y + (captor.height - captive.height) / 2);
  captor.facing = 0;
  captor.startInhale(NOW);
  updateInhales(state, NOW, 1 / 30);
  assert.equal(captive.capturedBy, captor.sessionId, 'actual inhale captures the smaller player');
  return { state, captor, captive };
}

assert.equal(moveSpeed(20), 320);
assert(moveSpeed(143) > 130, 'growth leaves mid-size creatures mobile');
assert.equal(moveSpeed(2000), 130, 'late growth has a movement floor');
assert(moveSpeed(37.5) > moveSpeed(143), 'small players keep a speed advantage');
assert.equal(escapeLength(39, 20), 3);
assert.equal(escapeLength(40, 20), 4);
assert.equal(escapeLength(80, 20), 5);
assert.equal(escapeLength(800, 20), 5);
assert.equal(captureLoadMs(3), 2800);
assert.equal(captureLoadMs(4), 3100);
assert.equal(captureLoadMs(5), 3400);

for (const gems of [0, 4, 11, 12, 80]) for (const kind of ['missile', 'turbine'] as const) {
  const s = world(), p = player(s, 'flight-end', gems, 1800, 1800);
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  s.onEvent = (type, data) => events.push({ type, data });
  p.launch(NOW, 1250, 0, 'departed-shooter', 1000, CANNON.DRAG, kind);
  updateFlights(s, NOW + 999, 0);
  assert(p.flying && p.state === 'alive', 'a small missile still has its full chance to hit before expiry');
  updateFlights(s, NOW + 1000, 0);
  const out = kind === 'missile' && gems < 12;
  assert.equal(p.state, out ? 'dead' : 'alive'); assert(!p.flying);
  if (out) {
    assert.equal(p.gems, 0); assert.equal(p.respawnAt, NOW + 3000);
    assert.equal(p.suctionSafeUntil, 0, 'a knockout does not also receive a landing shield');
    assert.equal([...s.gems.values()].reduce((sum, g) => sum + g.value, 0), gems, 'burnup spills remaining growth once');
    assert(events.some(e => e.type === 'credit' && e.data.how === 'burnup' && e.data.out === true), 'burnup feedback survives the launcher leaving');
    s.update(0, p.respawnAt); assert(p.state === 'alive' && p.spawnProtected && p.width === 20);
  } else {
    assert.equal(p.gems, gems); assert(p.suctionSafeUntil >= NOW + 4000, 'large missiles and turbine throws retain landing protection');
  }
}
{
  const s = world(), p = player(s, 'slow-missile', 4, 1800, 1800);
  p.launch(NOW, CANNON.STOP_SPEED - 1, 0, 'shooter', 1000);
  updateFlights(s, NOW + 100, 0);
  assert.equal(p.state, 'dead', 'a small shot that slows to a stop also burns up');
}

{
  const normal = new GameState(0); normal.botFill = 0;
  normal.update(1 / 30, NOW);
  assert.equal(normal.cores.length, 0, 'Core orbs no longer spawn in normal worlds');
  normal.cores.push(new CoreSchema('retired', 1000, 1000, 24));
  normal.update(1 / 30, NOW + 33);
  assert.equal(normal.cores.length, 0, 'leftover Core objects are cleared rather than kept alive');
}

{
  const s = world(), p = player(s, 'breath');
  p.stamina = 1; p.staminaAt = NOW;
  exhale(s, p, NOW);
  assert(Math.abs(p.stamina - 0.65) < 1e-9, 'a gust costs 35 percentage points');
  p.exhaleReadyAt = 0; p.stamina = 0.34; p.staminaAt = NOW;
  exhale(s, p, NOW);
  assert.equal(p.exhaleReadyAt, 0, 'not enough breath: no gust or cooldown is spent');
  assert.equal(p.stamina, 0.34);
  p.stamina = 0.35;
  exhale(s, p, NOW);
  assert.equal(p.stamina, 0, 'exactly 35% breath can produce one gust');
  p.startInhale(NOW); assert(!p.inhaling, 'a depleted meter cannot immediately inhale');
}
{
  const s = world(), a = player(s, 'bumper-a'), b = player(s, 'bumper-b', 0, 1018, 1000);
  a.steer(1, 0); b.steer(-1, 0);
  a.updateMovement(s.worldWidth, s.worldHeight, NOW, 0.05);
  b.updateMovement(s.worldWidth, s.worldHeight, NOW, 0.05);
  a.markTick(); b.markTick(); keepApart(s, a);
  assert(a.stunned && b.stunned && a.sliding && b.sliding, 'a forceful fresh bump staggers and separates both players');
  const ends = a.stunEndsAt;
  keepApart(s, b); assert.equal(a.stunEndsAt, ends, 'the other side of the same pair cannot retrigger the stun');
  a.placeAt(1000, 1000); b.placeAt(1018, 1000);
  s.now += 3000;
  a.updateMovement(s.worldWidth, s.worldHeight, s.now, 0);
  b.updateMovement(s.worldWidth, s.worldHeight, s.now, 0);
  keepApart(s, a); assert.equal(a.stunEndsAt, ends, 'continued contact cannot re-stun after immunity expires');
  b.placeAt(1300, 1000); pruneBodyContacts(s);
  assert.equal(s.bodyContacts.size, 0, 'separation rearms the pair');
}
for (const targetGems of [12, 40]) for (const protectedTarget of [false, true]) {
  const s = world(), flier = player(s, 'missile', 4), target = player(s, 'small-target', targetGems, 1100, 1000);
  target.spawnProtected = protectedTarget;
  flier.placeAt(1000, target.y + target.height / 2 - flier.height / 2);
  flier.launch(NOW, 1400, 0, 'shooter', CANNON.FLIGHT_MS);
  updateFlights(s, NOW + 100, 0.1);
  const out = !protectedTarget && targetGems === 12;
  assert.equal(target.state, out ? 'dead' : 'alive', 'a tiny shot finishes a weakened target but no longer erases a larger one');
  assert.equal(flier.state, 'dead', 'a spent missile player is knocked out rather than kept alive at minimum size');
  assert(!flier.flying);
  assert.equal(flier.respawnAt, NOW + 100 + 2000);
  if (out) {
    assert.equal(target.gems, 0);
    s.update(0, target.respawnAt);
    assert.equal(target.state, 'alive'); assert(target.spawnProtected);
    assert.equal(target.width, 20, 'a small missile victim returns at newborn size');
  } else if (protectedTarget) assert.equal(target.gems, targetGems, 'spawn protection blocks missile damage and knockout');
  else assert(target.gems < targetGems && target.injuredUntil > s.time, 'a surviving target loses gems and opens a follow-up window');
}
{
  const s = world(), flier = player(s, 'large-missile', 1000), target = player(s, 'large-target', 1000, 1800, 1000);
  const width = flier.width;
  flier.launch(NOW, 1400, 0, 'shooter', CANNON.FLIGHT_MS);
  updateFlights(s, NOW + 400, 0.4);
  assert(flier.flightHit && flier.width <= width * 0.11, 'the missile loses about 90% of its width on impact');
  assert.equal(flier.state, 'alive');
  assert(target.width > width * 0.8 && target.width < width * 0.97, 'a comparable shot hurts a giant while preserving most earned size');
  const gems = flier.gems;
  flier.placeAt(s.worldWidth - flier.width - 10, 1000); flier.flightVx = 1400; flier.flightVy = 0;
  updateFlights(s, NOW + 500, 0.1);
  assert.equal(flier.gems, gems, 'a later wall bounce does not consume missile growth twice');
  assert(flier.suctionSafeUntil > NOW + 500, 'the spent missile still gets a recovery shield');
}

for (const gems of [16, 32, 80]) {
  const { state, captor, captive } = capture(gems);
  fireCaptive(state, captor, NOW); // the captor queues the earliest possible shot
  let elapsed = CANNON.CAPTIVE_STUN_MS + 650;
  for (const key of captive.escapeKeys) {
    state.time = elapsed;
    escapePress(state, captive, key);
    updateHolds(state, NOW + elapsed);
    elapsed += 500;
  }
  assert.equal(captive.capturedBy, '', 'after a 650ms reaction, a human can type at 500ms per direction before a queued shot');
  assert.equal(captive.flying, false);
}

{
  const { state, captor, captive } = capture();
  const keys = captive.escapeKeys;
  assert.equal(keys.length, 3);
  assert.notEqual(keys[0], keys[1]);
  escapePress(state, captive, keys[0]);
  assert.equal(captive.escapeStep, 0, 'cannot escape during the short daze');
  state.time = CANNON.CAPTIVE_STUN_MS;
  escapePress(state, captive, keys[0]);
  const wrong = 'UDLR'.replace(keys[1], '')[0];
  escapePress(state, captive, wrong);
  assert.equal(captive.escapeStep, 0, 'a wrong key resets the sequence');
  for (const key of keys) escapePress(state, captive, key);
  updateHolds(state, NOW + state.time);
  assert.equal(captive.capturedBy, '');
  assert.equal(captor.gulping, '');
  assert.equal(captive.flying, false, 'escaping never fires the captive');
}
{
  const { state, captive } = capture();
  state.time = CANNON.CAPTIVE_STUN_MS;
  const directions: Record<string, [number, number]> = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };
  for (const key of captive.escapeKeys) {
    captive.steer(0, 0); escapeSteer(state, captive);
    captive.steer(...directions[key]); escapeSteer(state, captive);
    const step = captive.escapeStep;
    escapeSteer(state, captive);
    assert.equal(captive.escapeStep, step, 'holding the stick does not count repeatedly');
  }
  updateHolds(state, NOW + state.time);
  assert.equal(captive.capturedBy, '', 'quick joystick edges in one tick free a captive');
}
{
  const { state, captor, captive } = capture();
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  state.onEvent = (type, data) => events.push({ type, data });
  assert.equal(fireCaptive(state, captor, NOW + CANNON.ARM_MS - 1), false);
  captive.steer(0, 1);
  assert.equal(fireCaptive(state, captor, NOW + CANNON.ARM_MS), true);
  assert(captive.flying);
  assert.equal(captive.flightVy, 0, 'holding sideways during launch cannot spoil the captor\'s aim');
  const target = player(state, 'target', 100, 1270, 984.25);
  const had = target.gems;
  for (let step = 1; step <= 5; step++) updateFlights(state, NOW + CANNON.ARM_MS + step * 100, 0.1);
  assert(target.gems < had, 'a living cannonball spills gems');
  assert(events.some(e => e.type === 'launch'));
  assert(events.some(e => e.type === 'impact' && e.data.projectileId === captive.sessionId));
  assert(events.some(e => e.type === 'credit' && e.data.byId === captor.sessionId && e.data.how === 'cannon'));
  assert.equal(captive.state, 'dead', 'a missile impact is a knockout when no growth remains');
}
for (const facing of [0, Math.PI / 3, -Math.PI / 2]) {
  const { state, captor, captive } = capture();
  captor.facing = facing;
  captive.steer(-Math.sin(facing), Math.cos(facing));
  fireCaptive(state, captor, NOW + CANNON.ARM_MS);
  const start = { x: captive.x, y: captive.y };
  for (let step = 1; step <= 30; step++) {
    const sign = step % 2 ? 1 : -1;
    captive.steer(-Math.sin(facing) * sign, Math.cos(facing) * sign);
    updateFlights(state, NOW + CANNON.ARM_MS + step * 20, 0.02);
    const lateral = -(captive.x - start.x) * Math.sin(facing) + (captive.y - start.y) * Math.cos(facing);
    assert(Math.abs(lateral) < 1e-7, 'changing direction inputs cannot bend a player-fired missile');
  }
  assert(captive.flying);
}
{
  const state = world(), flier = player(state, 'turbine-flier');
  flier.launch(NOW, 900, 0, '', 1400, 0.35, 'turbine');
  flier.steer(0, 1);
  updateFlights(state, NOW + 100, 0.1);
  assert(flier.flightVy > 0, 'turbine throws retain their existing steering');
  flier.land();
  flier.launch(NOW + 200, 900, 0, 'captor', CANNON.FLIGHT_MS);
  updateFlights(state, NOW + 300, 0.1);
  assert.equal(flier.flightVy, 0, 'a later player-fired shot resets the turbine steering permission');
  flier.land();
  flier.updateMovement(state.worldWidth, state.worldHeight, NOW + 400, 0.1);
  assert(flier.y > 1000, 'normal movement input works after landing');
}
{
  const { state, captive } = capture();
  state.time = CANNON.HOLD_MS;
  updateHolds(state, NOW + CANNON.HOLD_MS);
  assert.equal(captive.capturedBy, '', 'an idle hold ends promptly');
  assert.equal(captive.state, 'alive');
}
{
  const state = world();
  const small = player(state, 'small', 0);
  const big = player(state, 'big', 100, 1080, 938.5);
  small.facing = 0; big.facing = Math.PI;
  big.startInhale(NOW);
  assert(stealWeight(state, big, small) > 0);
  exhale(state, small, NOW);
  assert.equal(big.inhaling, false, 'a puff into an incoming inhale breaks it');
  assert.equal(big.stunned, true, 'a gust stuns its target');
  assert.equal(small.puffReadyAt, EXHALE.COOLDOWN_MS);
  big.placeAt(1080, 938.5); // end the puff's skid before testing the inhale restart timer
  big.steer(1, 0);
  const x = big.x;
  big.updateMovement(state.worldWidth, state.worldHeight, NOW + EXHALE.STUN_MS - 1, 0.1);
  assert.equal(big.x, x, 'steering cannot move a stunned target after its skid ends');
  big.startInhale(NOW + EXHALE.STUN_MS - 1);
  assert.equal(big.inhaling, false, 'cannot inhale while stunned');
  big.updateMovement(state.worldWidth, state.worldHeight, NOW + EXHALE.STUN_MS, 0.001);
  assert.equal(big.stunned, false, 'the stun expires at its deadline');
  big.startInhale(NOW + EXHALE.STUN_MS);
  assert(big.inhaling, 'inhaling returns after the stun');
  assert.equal(stealWeight(state, big, small), 0, 'the defender has an escape window');
  state.now = NOW + EXHALE.BREAK_MS;
  assert(stealWeight(state, big, small) > 0, 'the escape window ends');
  const ready = small.exhaleReadyAt;
  exhale(state, small, NOW + 100);
  assert.equal(small.exhaleReadyAt, ready, 'puffs cannot be spammed');
}
{
  const state = world();
  const source = player(state, 'gust', 16);
  source.facing = 0;
  const target = player(state, 'hit', 16, 1100, 1000);
  const protectedPlayer = player(state, 'protected', 16, 1120, 1000);
  const behind = player(state, 'behind', 16, 800, 1000);
  protectedPlayer.protectFor(2000, NOW);
  exhale(state, source, NOW);
  assert(target.stunned && target.sliding, 'a non-inhaling target is stunned and knocked back too');
  assert(!protectedPlayer.stunned && !behind.stunned, 'protection and the gust cone still apply');
  target.steer(-1, 0);
  target.updateMovement(state.worldWidth, state.worldHeight, NOW + EXHALE.STUN_MS, 0.01);
  assert.equal(target.stunned, false, 'stun expires even while knockback is still sliding');
  const endsAt = target.stunEndsAt;
  target.placeAt(1100, 1000);
  source.exhaleReadyAt = 0;
  exhale(state, source, NOW + EXHALE.STUN_MS + 100);
  assert.equal(target.stunEndsAt, endsAt, 'brief immunity prevents repeated stun extensions');
}
for (const ending of ['impact', 'wall', 'timeout']) {
  const state = world();
  const flier = player(state, 'flier', ending === 'timeout' ? 12 : 1000);
  if (ending === 'impact') player(state, 'impact-target', 100, 1190, 950);
  if (ending === 'wall') flier.placeAt(state.worldWidth - flier.width - 10, 1000);
  flier.launch(NOW, 1400, 0, 'old-captor', ending === 'timeout' ? 50 : CANNON.FLIGHT_MS);
  let elapsed = 0;
  while (flier.flying && elapsed < 3000) {
    elapsed += 50;
    state.time = elapsed;
    state.now = NOW + elapsed;
    updateFlights(state, NOW + elapsed, 0.05);
  }
  assert(!flier.flying, `${ending}: flight ends`);
  if (ending === 'impact') assert(flier.flightHit, 'the regression actually hits another player');
  const landedAt = NOW + elapsed;
  assert.equal(flier.suctionSafeUntil, landedAt + CANNON.LAND_SAFE_MS);
  assert.equal(flier.recaptureAfter, landedAt + CANNON.LAND_SAFE_MS);
  assert.equal(flier.launchSafeUntil, state.time + CANNON.LAND_SAFE_MS);
  if (state.players.has('impact-target')) state.players.delete('impact-target');
  const hunter = player(state, 'new-captor', 100);
  hunter.facing = 0;
  flier.placeAt(hunter.x + hunter.width, hunter.y + (hunter.height - flier.height) / 2);
  hunter.startInhale(landedAt);
  const x = flier.x, gems = flier.gems;
  state.now = landedAt + CANNON.LAND_SAFE_MS - 1;
  updateInhales(state, state.now, 0.1);
  assert.equal(flier.capturedBy, '', `${ending}: nobody can immediately recycle the flier`);
  assert.equal(flier.x, x, `${ending}: immunity also prevents suction movement`);
  assert.equal(flier.gems, gems, `${ending}: immunity prevents inhale drain`);
  assert.equal(stealWeight(state, hunter, flier), 0);
  flier.steer(0, 1);
  const y = flier.y;
  flier.updateMovement(state.worldWidth, state.worldHeight, state.now, 0.05);
  assert(flier.y > y, 'a protected flier can move clear');
  flier.placeAt(hunter.x + hunter.width, hunter.y + (hunter.height - flier.height) / 2);
  state.now += 1;
  updateInhales(state, state.now, 0.01);
  assert.equal(flier.capturedBy, hunter.sessionId, 'normal capture returns when recovery ends');
}
for (const gems of [0, 297, 298, 1000]) {
  const state = world(), flier = player(state, 'wall-missile', gems);
  flier.placeAt(state.worldWidth - flier.width - 1, 1000);
  flier.launch(NOW, 1400, 0, 'captor', CANNON.FLIGHT_MS);
  updateFlights(state, NOW + 100, 0.1);
  assert.equal(flier.state, gems < 298 ? 'dead' : 'alive', 'wall impacts knock out only missiles with no growth left');
  assert(!flier.flying);
  if (flier.state === 'dead') {
    state.update(0, flier.respawnAt);
    assert.equal(flier.state, 'alive');
    assert(flier.spawnProtected && flier.width === 20, 'a spent missile respawns normally at newborn size');
  } else assert(flier.launchSafeUntil > state.time, 'a surviving missile gets its landing shield');
}
{
  const state = world(), flier = player(state, 'turbine-landing');
  flier.placeAt(state.worldWidth - flier.width - 1, 1000);
  flier.launch(NOW, 900, 0, '', 1400, 0.35, 'turbine');
  updateFlights(state, NOW + 100, 0.1);
  assert.equal(flier.state, 'alive', 'turbine throws do not inherit the new player-missile knockout rule');
}
{
  const state = world();
  const p = player(state, 'protected');
  p.protectFor(1500, NOW); p.startInhale(NOW);
  assert.equal(p.spawnProtected, false, 'inhaling ends spawn protection');
  p.stopInhale(NOW); p.protectFor(1500, NOW); exhale(state, p, NOW);
  assert.equal(p.spawnProtected, false, 'puffing ends spawn protection');
}
{
  const state = world();
  state.surgesOn = true;
  player(state, 'visitor', 0, 2000, 2000);
  beginSurge(state);
  assert.equal(state.surgePhase, 'warning');
  assert(state.surgeX >= 300 && state.surgeX <= state.worldWidth - 300);
  state.time = state.surgeAt;
  updateSurges(state, 1 / 30, NOW + state.time);
  assert.equal(state.surgePhase, 'active');
  assert.equal(state.gems.size, SURGE.PIECES);
  assert.equal(state.fieldGems, 0, 'event drops do not disturb field accounting');
  state.time = state.surgeAt - SURGE.JACKPOT_WITH_MS_LEFT;
  updateSurges(state, 1 / 30, NOW + state.time);
  assert(state.jackpotOn);
  const claimant = state.players.get('visitor');
  assert(claimant);
  claimant.placeAt(state.surgeX - claimant.width / 2, state.surgeY - claimant.height / 2);
  claimant.flying = true;
  updateJackpot(state, 1);
  assert.equal(claimant.gems, 0, 'a flying creature cannot claim the prize');
  claimant.flying = false;
  updateJackpot(state, 1);
  assert.equal(claimant.gems, 40, 'a grounded uncontested creature wins the jackpot');
  assert.equal(state.jackpotOn, false);
  updateSurges(state, 1 / 30, NOW + state.time);
  assert.equal(state.jackpotOn, false, 'a claimed jackpot does not respawn during the event');
  state.time = state.surgeAt;
  updateSurges(state, 1 / 30, NOW + state.time);
  assert.equal(state.surgePhase, 'waiting');
  assert(state.surgeAt >= state.time + SURGE.GAP_MIN_MS);
  assert(state.gems.size <= GEMS.MAX_GEMS);
}
console.log('Gameplay regressions passed: growth, keyboard/stick escapes, firing, impact credit, defense, protection and gem surges.');

{
  const state = world();
  const crowd = Array.from({ length: 8 }, (_, i) => player(state, `crowd-${i}`, 100, 1100 + (i % 4) * 100, 1100 + Math.floor(i / 4) * 100));
  for (const p of crowd) { p.isBot = true; state.brains.set(p.sessionId, new BotBrain()); }
  for (const p of crowd) state.brains.get(p.sessionId)?.think(p, state, NOW);
  assert(crowd.every(p => state.brains.get(p.sessionId)?.isDisengaging(NOW)), 'a dense crowd disengages instead of adding more inhales');
  for (let i = 1; i <= 150; i++) state.update(1 / 30, NOW + i * 1000 / 30);
  const nearest = crowd.map(a => Math.min(...crowd.filter(b => a !== b).map(b => Math.hypot(a.x - b.x, a.y - b.y))));
  assert(nearest.reduce((sum, d) => sum + d, 0) / nearest.length > 140, 'a packed group spreads out within five seconds');
}
console.log('Crowd regression passed.');
