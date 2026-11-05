import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { CANNON, EXHALE, INHALE, PROJECTILE_INJURY, TURBINE } from '../constants/gameConstants.js';
import { creatureSize } from '../game/creatureSize.js';
import { impactGems } from '../game/cannon.js';
import { airflowQuality } from '../game/airflow.js';
import { projectileEarnsInjury, projectileInjuryPower, type ProjectileInjuryImpact } from '../game/projectileInjury.js';
import { exhale, fireCaptive, injuryVulnerable, syncInjuryState, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { runTurbine } from '../systems/turbines.js';

const NOW = 100000, W = 4200;
function stock(width: number): number {
  let lo = 0, hi = 100000000;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width) lo = mid + 1; else hi = mid; }
  return lo;
}
function world(): GameState {
  const s = new GameState(0);
  s.botFill = s.fieldGemTarget = 0; s.weaponsOn = s.surgesOn = s.trafficHits = false;
  s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear();
  return s;
}
function add(s: GameState, id: string, gems: number, bot = false): PlayerSchema {
  const p = s.addPlayer(id, id, NOW); p.setGems(gems, W, W); p.dropProtection(); p.isBot = bot; return p;
}
function center(p: PlayerSchema, x: number, y: number): void { p.placeAt(x - p.width / 2, y - p.height / 2); }
interface Fixture { s: GameState; owner: PlayerSchema | null; ammo: PlayerSchema; target: PlayerSchema }
function captureAndFire(s: GameState, owner: PlayerSchema, id: string, now: number): PlayerSchema {
  const naturalWidth = owner.width >= 78 ? 60 : owner.width >= 52 ? 40 : 20;
  const ammo = add(s, id, stock(naturalWidth), owner.isBot);
  center(ammo, owner.x + owner.width + ammo.width / 2 + 1, owner.y + owner.height / 2);
  owner.facing = 0; owner.startInhale(now); updateInhales(s, now, .001);
  assert.equal(owner.gulping, ammo.sessionId, 'fixture uses a legal ordinary capture');
  assert(!fireCaptive(s, owner, now), 'the capture input cannot auto-fire');
  owner.stopInhale(now); owner.captureNeedsRelease = false; // Existing release/fresh-action edge.
  assert(fireCaptive(s, owner, now)); assert.equal(ammo.width, CANNON.BULLET_SIZE);
  return ammo;
}
function cannon(shooterWidth: number, targetGems: number, bot = false): Fixture & { owner: PlayerSchema } {
  const s = world(), owner = add(s, 'owner', stock(shooterWidth), bot), target = add(s, 'target', targetGems, bot);
  center(owner, 1000, 2100); center(target, 3200, 3200);
  const ammo = captureAndFire(s, owner, 'ammo', NOW);
  center(target, ammo.x + ammo.width / 2 + (target.width + ammo.width) / 2 + 40, ammo.y + ammo.height / 2);
  return { s, owner, ammo, target };
}
function fan(targetGems: number, pilotWidth = 40, bot = false): Fixture {
  const s = world(), ammo = add(s, 'pilot', stock(pilotWidth), bot), target = add(s, 'target', targetGems, bot);
  center(target, 3200, 3200);
  const turbine = new TurbineSchema('fan', 900, 2100, Math.PI, 0); turbine.phase = 'active'; turbine.still = true;
  center(ammo, turbine.x - TURBINE.BODY_RADIUS - ammo.width / 2 - 4, turbine.y);
  runTurbine(s, turbine, NOW, .01);
  assert(ammo.flying && ammo.flightKind === 'turbine', 'fixture goes through the real fan intake');
  const speed = Math.hypot(ammo.flightVx, ammo.flightVy), ux = ammo.flightVx / speed, uy = ammo.flightVy / speed;
  center(target, ammo.x + ammo.width / 2 + ux * ((target.width + ammo.width) / 2 + 40), ammo.y + ammo.height / 2 + uy * ((target.width + ammo.width) / 2 + 40));
  return { s, owner: null, ammo, target };
}
function impact(f: Fixture, ms = 100): { lost: number; at: number; widthBefore: number; speed: number } {
  const { s, ammo, target } = f, before = target.gems, widthBefore = target.width;
  const width = ammo.width, bonus = ammo.shotMassBonus, shooter = ammo.shotShooterWidth, kind = ammo.flightKind;
  const speed = Math.hypot(ammo.flightVx, ammo.flightVy) * Math.exp(-ammo.flightDrag * ms / 1000);
  s.time += ms; s.now = NOW + s.time; updateFlights(s, s.now, ms / 1000);
  assert(ammo.flightHit, 'fixture must produce a real swept impact');
  const lost = before - target.gems;
  if (target.state === 'alive') assert.equal(lost, impactGems(before, speed, width, widthBefore, bonus, kind, kind === 'missile' ? shooter : 0), 'injury qualification does not change gem damage');
  return { lost, at: s.time, widthBefore, speed };
}

assert.equal(INHALE.INJURY_MS, 7000); assert.equal(PROJECTILE_INJURY.MIN_POWER_SHARE, .08);
const shot: ProjectileInjuryImpact = { speed: 1250, ammoWidth: 60, targetWidth: 300, kind: 'missile', deliberate: true, shooterWidth: 200 };
assert(projectileEarnsInjury(shot), 'a substantial player shot earns the normal opening');
assert(!projectileEarnsInjury({ ...shot, shooterWidth: 150 }), 'a weaker near-peer chip is below the injury gate');
assert(projectileEarnsInjury({ ...shot, shooterWidth: 1470, targetWidth: 1470 }), 'equal late-game peers retain a meaningful opening');
assert(!projectileEarnsInjury({ ...shot, shooterWidth: 600, targetWidth: 1470 }));
assert(!projectileEarnsInjury({ ...shot, kind: 'turbine', deliberate: false, speed: 900, ammoWidth: 36, targetWidth: 1386 }));
assert(projectileEarnsInjury({ ...shot, kind: 'turbine', deliberate: false, speed: 900, ammoWidth: 36, targetWidth: 55 }));
for (const key of ['speed', 'ammoWidth', 'targetWidth'] as const) for (const invalid of [0, -1, NaN, Infinity]) {
  assert.equal(projectileInjuryPower({ ...shot, [key]: invalid }), 0, 'invalid physical input cannot grant injury');
}
for (const width of [20, 60, 300, 1470]) for (const speed of [1, 900, 2000]) {
  const power = projectileInjuryPower({ ...shot, speed, ammoWidth: width, shooterWidth: width });
  assert(Number.isFinite(power) && power >= 0 && power <= CANNON.IMPACT_MAX_SHARE, 'power is bounded at every physical scale');
}
const unowned = { ...shot, deliberate: false, shooterWidth: 1470, shooterMassBonus: 1e9 };
assert.equal(projectileInjuryPower(unowned), projectileInjuryPower({ ...unowned, shooterWidth: 0, shooterMassBonus: 0 }), 'an unowned missile cannot borrow a deliberate shooter contribution');
assert.equal(projectileInjuryPower({ ...unowned, kind: 'turbine' }), projectileInjuryPower({ ...unowned, kind: 'turbine', shooterWidth: 0, shooterMassBonus: 0 }), 'fan transport cannot inherit a player shot snapshot');

for (const bot of [false, true]) {
  for (const gems of [20000, 50000, 100000, 2000000, 100000000]) {
    const f = cannon(80, gems, bot), hit = impact(f);
    assert(hit.lost > 0 && f.target.state === 'alive');
    assert.equal(f.target.injuredUntil, 0); assert(!f.target.breathingBlocked);
    assert(f.target.stunned && f.target.sliding, 'weak chips retain the existing brief impact response');
    assert.equal(f.target.stunEndsAt, f.s.now + CANNON.IMPACT_STUN_MS);
    assert.equal(f.target.suctionSafeUntil, f.s.now + CANNON.IMPACT_SUCTION_SAFE_MS);
  }
  for (const gems of [20000, 50000, 100000, 2000000]) {
    const f = fan(gems, 40, bot), hit = impact(f);
    assert.equal(f.ammo.shotOwner, ''); assert(hit.lost > 0 && f.target.state === 'alive');
    assert.equal(f.target.injuredUntil, 0); assert(!f.target.breathingBlocked);
    assert(f.target.stunned, 'a weak unowned fan hit keeps its existing stun');
    assert.equal(f.target.suctionSafeUntil, 0, 'this injury-only change does not add a fan recovery window');
  }
  const positive = cannon(200, stock(300), bot), hit = impact(positive);
  assert(positive.target.state === 'alive' && positive.target.breathingBlocked);
  assert.equal(positive.target.injuredUntil, hit.at + INHALE.INJURY_MS);
  const positiveFan = fan(stock(70), 50, bot), fanHit = impact(positiveFan);
  assert(positiveFan.target.state === 'alive' && positiveFan.target.breathingBlocked, 'a substantial actual fan impact still earns injury');
  assert.equal(positiveFan.target.injuredUntil, fanHit.at + INHALE.INJURY_MS);
}

// Stock changes damage accounting, not injury classification for the same physical matchup.
for (const shooterWidth of [80, 1470]) {
  const a = cannon(shooterWidth, 2000000), b = cannon(shooterWidth, 100000000);
  assert.equal(a.target.width, b.target.width); const one = impact(a), two = impact(b);
  assert(two.lost > one.lost, 'uncapped inventory remains part of unchanged gem damage');
  assert.equal(a.target.breathingBlocked, b.target.breathingBlocked);
  assert.equal(a.target.breathingBlocked, shooterWidth === 1470, 'late peers qualify; tiny shooters cannot qualify by hitting a richer identical body');
}

// Read the immutable launch, even when the current owner no longer represents that body.
for (const meaningful of [false, true]) for (const change of ['grow', 'shrink', 'death', 'disconnect'] as const) {
  const f = cannon(meaningful ? 200 : 80, meaningful ? stock(300) : 100000), owner = f.owner;
  const stored = { width: f.ammo.shotShooterWidth, bonus: f.ammo.shotMassBonus };
  if (change === 'grow') owner.setGems(2000000, W, W);
  if (change === 'shrink') owner.setGems(0, W, W);
  if (change === 'death') owner.knockOut(NOW + 1);
  if (change === 'disconnect') f.s.removePlayer(owner.sessionId);
  assert.equal(f.ammo.shotShooterWidth, stored.width); assert.equal(f.ammo.shotMassBonus, stored.bonus);
  const credits: Record<string, unknown>[] = [];
  f.s.onEvent = (type, data) => { if (type === 'credit') credits.push(data); };
  impact(f); assert.equal(f.target.breathingBlocked, meaningful);
  assert(credits.some(e => e.targetId === f.target.sessionId && e.byId === owner.sessionId && e.how === 'cannon'), 'existing launcher attribution survives owner changes');
}

// A weak chip cannot expose healthy gems even after its ordinary suction protection expires.
for (const kind of ['cannon', 'fan'] as const) {
  const f = kind === 'cannon' ? cannon(80, 100000) : fan(100000); impact(f);
  const hunter = add(f.s, 'hunter', stock(60)); hunter.facing = 0;
  center(hunter, f.target.x - hunter.width / 2 - 40, f.target.y + f.target.height / 2);
  f.s.time += 2000; f.s.now = NOW + f.s.time; hunter.startInhale(f.s.now);
  assert(airflowQuality(f.s.mouthed(hunter), f.s.bodyOf(f.target)) > .5, 'the test inhale is genuinely in range and aimed at the body');
  for (let tick = 0; tick < 90; tick++) { f.s.time += 1000 / 30; f.s.now = NOW + f.s.time; updateInhales(f.s, f.s.now, 1 / 30); }
  assert.equal(hunter.stolenTotal, 0); assert.equal(f.target.robbedTotal, 0);
  assert(!injuryVulnerable(f.s, f.target) && f.target.state === 'alive');
  // After the normal short impact response wears off, no seven-second lock remains.
  for (let tick = 0; tick < 90; tick++) f.target.updateMovement(W, W, f.s.now + tick * 1000 / 30, 1 / 30);
  f.target.startInhale(f.s.now + 3000); assert(f.target.inhaling);
  f.target.stopInhale(f.s.now + 3000); const breath = f.target.stamina;
  exhale(f.s, f.target, f.s.now + 3000);
  assert(Math.abs(f.target.stamina - (breath - EXHALE.BREATH_COST)) < 1e-9, 'weak-hit survivors retain normal puff availability after existing recovery');
}

{
  const f = cannon(200, stock(300)); impact(f); const deadline = f.target.injuredUntil;
  f.s.time += 2000; f.s.now = NOW + f.s.time;
  const ammo = captureAndFire(f.s, f.owner, 'second-ammo', f.s.now);
  center(f.target, ammo.x + ammo.width / 2 + (f.target.width + ammo.width) / 2 + 40, ammo.y + ammo.height / 2);
  const second = { ...f, ammo }; const hit = impact(second);
  assert(hit.lost > 0 && f.target.state === 'alive'); assert.equal(f.target.injuredUntil, deadline, 'another meaningful hit does not refresh active injury');
  f.s.time = deadline; syncInjuryState(f.s);
  assert(!f.target.breathingBlocked && !injuryVulnerable(f.s, f.target), 'the original seven-second deadline still restores breathing');
}
{
  const f = cannon(80, 100000); f.target.injure(f.s.time); const deadline = f.target.injuredUntil;
  impact(f); assert.equal(f.target.injuredUntil, deadline, 'a weak hit neither clears nor refreshes an existing injury');
  assert(f.target.breathingBlocked, 'a chip does not prematurely restore an already injured player');
}
for (const shield of ['spawn', 'impact'] as const) {
  const f = cannon(200, stock(300)), before = f.target.gems;
  if (shield === 'spawn') f.target.protectFor(1000, NOW); else f.target.impactImmuneUntil = NOW + 1000;
  f.s.time = 100; f.s.now = NOW + 100; updateFlights(f.s, f.s.now, .1);
  assert.equal(f.target.gems, before); assert.equal(f.target.injuredUntil, 0); assert(!f.target.stunned);
  assert.equal(f.ammo.flightHit, shield === 'spawn', 'existing shield contact versus impact immunity behavior remains');
}
{
  const f = cannon(300, stock(200)), owner = f.owner, value = f.target.gems, before = owner.gems;
  const rewards: Record<string, unknown>[] = [];
  f.s.onEvent = (type, data) => { if (type === 'combatReward' && data.targetId === f.target.sessionId) rewards.push(data); };
  impact(f); assert.equal(f.target.state, 'dead', 'existing size-advantage lethal handling bypasses nonlethal injury qualification');
  assert.equal(owner.gems, before + value); assert.equal(rewards.length, 1); assert.equal(rewards[0].byId, owner.sessionId);
  updateFlights(f.s, f.s.now + 100, .1); assert.equal(rewards.length, 1, 'a lethal flight still pays only once');
}
console.log('Projectile injury passed: real weak capture/fire and fan chips, physical meaningful openings, uncapped-stock independence, launch snapshots, fixed seven-second recovery, no weak-chip theft cascade, ordinary defense, protections, lethal attribution and human/bot parity.');
