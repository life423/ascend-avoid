import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CoreSchema } from '../schema/CoreSchema.js';
import { CANNON, EXHALE, GEMS, SURGE } from '../constants/gameConstants.js';
import { exhale, fireCaptive, stealWeight, updateHolds, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { beginSurge, updateSurges } from '../systems/surges.js';
import { updateJackpot } from '../systems/gems.js';
import { BotBrain } from '../game/bots.js';
import { keepApart } from '../systems/bodies.js';

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
  assert(!a.stunned && !b.stunned && !a.sliding && !b.sliding, 'ordinary contact keeps both players in control');
  a.steer(0, 1); b.steer(0, -1);
  assert.equal(a.steering().y, 1); assert.equal(b.steering().y, -1);
  const before=a.y; a.updateMovement(s.worldWidth,s.worldHeight,NOW+100,.1);keepApart(s,a);
  assert(a.y>before, 'pressed bodies can slide sideways');
}
// Exercise the complete tick: turning/peeling off a clash must not wait for a hidden timer.
for (const bot of [false, true]) for (const gems of [0, 100, 1000]) for (const ratio of [1, 1.5]) for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  const s = world(); s.weaponsOn = s.trafficOn = s.surgesOn = false; s.blackHoles.clear();
  const a = player(s, 'contact-a', gems), b = player(s, 'contact-b', Math.round(gems * ratio));
  a.isBot = bot; b.isBot = !bot;
  const nx = Math.cos(angle), ny = Math.sin(angle), tx = -ny, ty = nx;
  const gap = (a.width + b.width) / 2 * .9;
  a.placeAt(2100 - a.width / 2, 2100 - a.height / 2);
  b.placeAt(2100 + nx * gap - b.width / 2, 2100 + ny * gap - b.height / 2);
  a.facing = angle; b.facing = angle + Math.PI;
  a.steer(nx, ny); b.steer(-nx, -ny);
  for (let tick = 1; tick <= 8; tick++) {
    s.update(1 / 30, NOW + tick * 1000 / 30);
    assert(!a.stunned && !b.stunned && !a.sliding && !b.sliding && !a.recovering && !b.recovering, 'ordinary contact never starts a control lock');
    assert.equal(a.injuredUntil + b.injuredUntil, 0, 'a clash causes no damage');
  }
  const x = a.x, y = a.y;
  a.steer(tx, ty); b.steer(-tx, -ty);
  s.update(1 / 30, NOW + 300);
  assert((a.x - x) * tx + (a.y - y) * ty > .1, 'sideways movement responds on the first tick');
  const separation = Math.hypot(b.x + b.width / 2 - a.x - a.width / 2, b.y + b.height / 2 - a.y - a.height / 2);
  a.steer(-nx, -ny); b.steer(nx, ny);
  s.update(.1, NOW + 400);
  assert(Math.hypot(b.x + b.width / 2 - a.x - a.width / 2, b.y + b.height / 2 - a.y - a.height / 2) > separation + 1, 'both bodies can immediately peel away');
}
for (const targetGems of [12, 40, 100]) for (const protectedTarget of [false, true]) {
  const s = world(), flier = player(s, 'missile', 4), target = player(s, 'small-target', targetGems, 1100, 1000);
  target.spawnProtected = protectedTarget;
  flier.placeAt(1000, target.y + target.height / 2 - flier.height / 2);
  flier.launch(NOW, 1400, 0, 'shooter', CANNON.FLIGHT_MS);
  updateFlights(s, NOW + 100, 0.1);
  const out = !protectedTarget && targetGems <= 40;
  assert.equal(target.state, out ? 'dead' : 'alive', 'standard bullets finish small/weak targets while larger targets survive ordinary damage');
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
  for (let step = 1; step <= 12 && !flier.flightHit; step++) updateFlights(s, NOW + step * 50, .05);
  assert(flier.flightHit && flier.width <= width * 0.11, 'the missile loses about 90% of its width on impact');
  assert.equal(flier.state, 'dead');
  assert(target.width > width * 0.95 && target.width < width, 'a standard-size projectile chips a much wider target when no shooter-size finish applies');
  const spilled = [...s.gems.values()].reduce((sum,g) => sum+g.value,0);
  flier.placeAt(s.worldWidth - flier.width - 10, 1000); flier.flightVx = 1400; flier.flightVy = 0;
  updateFlights(s, NOW + 1000, 0.1);
  assert.equal([...s.gems.values()].reduce((sum,g) => sum+g.value,0), spilled, 'a spent bullet cannot consume or spill its growth twice');
}

{
  const { state, captor, captive } = capture();
  const events: Array<{ type: string; data: Record<string, unknown> }> = [];
  state.onEvent = (type, data) => events.push({ type, data });
  assert.equal(fireCaptive(state, captor, NOW), false);
  captor.captureNeedsRelease = false;
  captive.steer(0, 1);
  assert.equal(fireCaptive(state, captor, NOW), true);
  assert(captive.flying);
  assert.equal(captive.flightVy, 0, 'holding sideways during launch cannot spoil the captor\'s aim');
  const target = player(state, 'target', 100, 1270, 984.25);
  const had = target.gems;
  for (let step = 1; step <= 5; step++) updateFlights(state, NOW + step * 100, 0.1);
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
  captor.captureNeedsRelease = false; fireCaptive(state, captor, NOW);
  const start = { x: captive.x, y: captive.y };
  for (let step = 1; step <= 30; step++) {
    const sign = step % 2 ? 1 : -1;
    captive.steer(-Math.sin(facing) * sign, Math.cos(facing) * sign);
    updateFlights(state, NOW + step * 20, 0.02);
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
  state.time = captive.captureHoldMs;
  updateHolds(state, NOW + captive.captureHoldMs);
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
  assert.equal(big.stunned, false, 'a gust never stuns its target');
  assert.equal(big.sliding, false, 'a gust does not hide a control lock in an impact skid');
  assert.equal(small.suctionSafeUntil, 0, 'a puff grants no lasting suction immunity');
  assert.equal(small.puffReadyAt, EXHALE.COOLDOWN_MS);
  big.steer(0, 1);
  const y = big.y;
  big.updateMovement(state.worldWidth, state.worldHeight, NOW + 17, .017);
  assert(big.y > y, 'steering works during the shove itself');
  big.startInhale(NOW + EXHALE.PARRY_MS - 1);
  assert.equal(big.inhaling, false, 'only the broken inhale has a brief restart delay');
  big.placeAt(1080, 938.5);
  big.startInhale(NOW + EXHALE.PARRY_MS);
  assert(big.inhaling, 'inhaling resumes without waiting on a stun or fading artwork');
  assert(stealWeight(state, big, small) > 0, 'airflow is not blocked by a lasting shield');
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
  assert(!target.stunned && !target.sliding && target.puffVx > 0, 'a non-inhaling target gets only a steerable push');
  assert.equal(protectedPlayer.puffVx, 0, 'spawn protection still applies');
  assert.equal(behind.puffVx, 0, 'the immediate front puff does not hit behind');
  target.steer(0, 1);
  const y = target.y;
  target.updateMovement(state.worldWidth, state.worldHeight, NOW + 17, .017);
  assert(target.y > y && target.facing !== 0, 'the target can walk and turn during the push');
  target.startInhale(NOW + 17);
  assert(target.inhaling, 'an unrelated inhale is not locked by knockback');
}
for (const ending of ['impact', 'wall', 'timeout']) {
  const state = world();
  const flier = player(state, 'flier', ending === 'timeout' ? 12 : 1000);
  if (ending === 'impact') player(state, 'impact-target', 100, 1190, 950);
  if (ending === 'wall') flier.placeAt(state.worldWidth - flier.width - 10, 1000);
  flier.launch(NOW, 1400, 0, 'old-captor', ending === 'timeout' ? 50 : CANNON.FLIGHT_MS);
  if (ending === 'wall') flier.placeAt(state.worldWidth - CANNON.BULLET_SIZE - 1, 1000);
  if (ending === 'impact') {
    const target = state.players.get('impact-target')!;
    flier.placeAt(target.x + target.width / 2 - 300 - CANNON.BULLET_SIZE / 2, target.y + (target.height - CANNON.BULLET_SIZE) / 2);
  }
  let elapsed = 0;
  while (flier.flying && elapsed < 3000) {
    elapsed += 50;
    state.time = elapsed;
    state.now = NOW + elapsed;
    updateFlights(state, NOW + elapsed, 0.05);
  }
  assert(!flier.flying, `${ending}: flight ends`);
  if (ending === 'impact') assert(flier.flightHit, 'the regression actually hits another player');
  if (ending !== 'timeout') {
    assert.equal(flier.state, 'dead', 'a standard bullet spends its remaining body on impact or a wall');
    state.update(0, flier.respawnAt); assert(flier.spawnProtected); assert.equal(flier.state, 'alive');
    continue;
  }
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
for (const gems of [0, 300, 500, 1000]) {
  const state = world(), flier = player(state, 'wall-missile', gems);
  flier.placeAt(state.worldWidth - flier.width - 1, 1000);
  flier.launch(NOW, 1400, 0, 'captor', CANNON.FLIGHT_MS);
  flier.placeAt(state.worldWidth - CANNON.BULLET_SIZE - 1, 1000);
  updateFlights(state, NOW + 100, 0.1);
  assert.equal(flier.state, 'dead', 'a standard bullet spends its remaining body on a wall regardless of source growth');
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
