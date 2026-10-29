import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { CANNON, GEMS, TURBINE } from '../constants/gameConstants.js';
import { impactGems } from '../game/cannon.js';
import { creatureSize } from '../game/creatureSize.js';
import { scaleDrain, drainRamp } from '../game/airflow.js';
import { steal } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { runTurbine } from '../systems/turbines.js';

const NOW = 100000;
const width = creatureSize;
function world() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.weaponsOn = false;
  s.setTurbines('off'); s.update(0, NOW); return s;
}
function add(s: GameState, id: string, gems: number) {
  const p = s.addPlayer(id, id, NOW); p.setGems(gems, s.worldWidth, s.worldHeight);
  p.spawnProtected = false; p.placeAt(2000 - p.width / 2, 2000 - p.height / 2); return p;
}
function total(s: GameState) {
  return [...s.players.values()].reduce((n, p) => n + p.gems, 0) + [...s.gems.values()].reduce((n, g) => n + g.value, 0);
}
/** Deliberately ideal contact with an undefended target: no missed aim, movement or spilled-gem pickup. */
function injuryWindow(s: GameState, victim: PlayerSchema, thieves: PlayerSchema[]) {
  const began = s.time, deadline = victim.injuredUntil;
  const initial = victim.gems; let firstSecond = 0;
  for (const p of thieves) { p.startInhale(s.now); }
  for (let tick = 1; tick <= 210 && victim.state === 'alive'; tick++) {
    s.time = began + tick * 1000 / 30; s.now = NOW + s.time;
    victim.placeAt(2000 - victim.width / 2, 2000 - victim.height / 2);
    thieves.forEach((p, i) => {
      p.facing = i % 2 ? Math.PI : 0;
      p.placeAt(i % 2 ? 2000 + victim.width / 2 + 4 : 2000 - victim.width / 2 - 4 - p.width, 2000 - p.height / 2);
      p.heldFor.set(victim.sessionId, (s.time - began) / 1000);
      steal(s, p, s.now, 1 / 30);
    });
    if (tick === 30) firstSecond = initial - victim.gems;
  }
  if (victim.state === 'alive') assert.equal(victim.injuredUntil, deadline, 'theft does not extend injury');
  return { firstSecond, knockoutMs: victim.state === 'dead' ? s.time - began : 0 };
}
function shot(projectileGems: number, targetGems: number, protectedTarget = false) {
  const s = world(), flier = add(s, 'flier', projectileGems), target = add(s, 'target', targetGems);
  add(s, 'shooter', 0).placeAt(500, 500);
  flier.placeAt(1400 - flier.width / 2, 2000 - flier.height / 2);
  target.spawnProtected = protectedTarget;
  const events: Record<string, unknown>[] = [];
  s.onEvent = (type, event) => { if (type === 'impact' || type === 'credit') events.push(event); };
  flier.launch(NOW, 1400, 0, 'shooter', CANNON.FLIGHT_MS);
  for (let tick = 1; tick <= 30 && !flier.flightHit; tick++) {
    s.time = tick * 50; s.now = NOW + s.time; updateFlights(s, s.now, .05);
  }
  assert(flier.flightHit, 'the fixture must produce a real swept impact');
  assert.equal(total(s), projectileGems + targetGems, 'impact and missile shrink preserve spilled value');
  return { s, flier, target, events };
}

// Matchup budgets protect earned size without granting absolute immunity to small shots.
for (const [projectile, minimum, maximum] of [[4, 1, 15], [20, 5, 30], [250, 70, 150], [1000, 180, 300], [4000, 300, 650]]) {
  const damage = impactGems(1000, 1250, width(projectile));
  assert(damage >= minimum && damage <= maximum, `${projectile}-gem projectile against a giant: ${damage}`);
}
for (const target of [12, 40, 100, 1000, 10000]) {
  let previous = 0;
  for (const projectile of [0, 4, 12, 40, 100, 1000, 10000]) {
    const damage = impactGems(target, 1250, width(projectile));
    assert(damage >= previous && damage > 0 && damage <= target, 'larger ammunition never hits less hard or creates negative mass');
    previous = damage;
  }
  assert(impactGems(target, 800, width(100)) <= impactGems(target, 1600, width(100)), 'speed still matters');
}
assert.equal(impactGems(0, 1250, width(1000)), 0);
for (const [gems, maximumHits] of [[40, 1], [100, 2], [300, 3]]) {
  let left = gems, hits = 0;
  while (left >= CANNON.IMPACT_KO_GEMS && hits < 10) { left -= impactGems(left, 1250, width(gems)); hits++; }
  assert(left < CANNON.IMPACT_KO_GEMS && hits <= maximumHits, 'substantial ammunition can finish small/midgame targets within one to three clean hits');
}
for (const [gems, hits] of [[100, 2], [300, 3]]) {
  const { s, target } = shot(gems, gems);
  for (let round = 1; round < hits && target.state === 'alive'; round++) {
    s.time += 3500; s.now = NOW + s.time;
    target.suctionSafeUntil = s.now + CANNON.LAND_SAFE_MS;
    const ammo = add(s, `round-${round}`, gems), before = total(s);
    const cx = target.x + target.width / 2, cy = target.y + target.height / 2;
    ammo.placeAt(cx - 600 - ammo.width / 2, cy - ammo.height / 2);
    ammo.launch(s.now, 1400, 0, 'shooter', CANNON.FLIGHT_MS);
    for (let tick = 0; tick < 30 && !ammo.flightHit; tick++) { s.time += 50; s.now = NOW + s.time; updateFlights(s, s.now, .05); }
    assert(ammo.flightHit, 'each follow-up must be a real swept projectile hit');
    assert.equal(total(s), before, 'successive hits conserve combat value');
  }
  assert.equal(target.state, 'dead', 'two/three clean substantial hits can finish small/midgame players; suction recovery is not damage immunity');
}
assert(impactGems(10000, 2000, width(12)) < 100, 'a maximum-speed small shot takes under 1% from a very large giant');
assert(scaleDrain(width(40), width(1000)) * drainRamp(30) < .75, 'even a long-held small inhale cannot regain peer-level theft against a giant');
assert(scaleDrain(width(1000), width(1000)) > scaleDrain(width(250), width(1000)), 'substantial rivals remain stronger thieves');

const windows: { thief: number; stolen: number; firstSecond: number; knockoutMs: number }[] = [];
for (const gems of [4, 40, 250, 1000]) {
  const s = world(), victim = add(s, 'victim', 1000), thief = add(s, 'thief', gems);
  victim.injure(s.time); const timing = injuryWindow(s, victim, [thief]);
  const stolen = 1000 - victim.gems; windows.push({ thief: gems, stolen, ...timing });
  assert.equal(thief.gems - gems, stolen, 'theft transfers each gem exactly once');
  assert.equal(total(s), 1000 + gems);
  assert(stolen > 0, 'even small players can profit from a damaging hit and sustained contact');
  if (gems >= 250) assert.equal(victim.state, 'dead', 'a substantial attacker can finish an undefended giant');
  s.time = Math.max(s.time, 7000); s.now = NOW + s.time;
  const left = victim.gems; steal(s, thief, s.now, 1); assert.equal(victim.gems, left, 'expiry or knockout ends theft');
}
assert(windows[2].firstSecond > windows[1].firstSecond * 2 && windows[3].firstSecond > windows[2].firstSecond,
  'near-peer pressure is substantially more immediate than small-attacker pressure');
{
  const { s, target, flier } = shot(20, 1000);
  assert(target.gems >= 970 && target.injuredUntil > s.time && target.stunned, 'small shots still spill, stun and expose a giant');
  assert.equal(flier.state, 'dead', 'the separately approved spent-missile consequence remains');
  const thieves = [add(s, 'left-thief', 4), add(s, 'right-thief', 4)];
  injuryWindow(s, target, thieves);
  assert(target.gems < 500, 'a small hit followed by two sustained thieves now has serious consequences');
  assert(thieves.every(p => p.gems > 4), 'both small attackers can take exposed gems without a shared allowance');
  assert.equal(total(s), 1028);
}
{
  const { s, target, events } = shot(1000, 40);
  assert.equal(target.state, 'dead', 'large ammunition can still eliminate a smaller player');
  assert(events.some(e => e.how === 'cannon' && e.targetId === target.sessionId && e.byId === 'shooter' && e.out === true), 'lethal hits retain launcher credit');
  s.update(0, target.respawnAt);
  assert.equal(target.state, 'alive');
  assert(target.spawnProtected && target.width === 20, 'a victim still respawns normally');
}
{
  const { target } = shot(1000, 40, true);
  assert(target.gems === 40 && target.injuredUntil === 0, 'spawn protection blocks even a powerful shot');
}
{
  const { s, target, flier } = shot(1000, 1000);
  const spill = [...s.gems.values()].find(g => g.owner === flier.sessionId);
  const targetSpill = [...s.gems.values()].find(g => g.owner === target.sessionId);
  assert(spill && targetSpill && flier.state === 'alive');
  const box = { x: spill.x - 10, y: spill.y - 10, width: 20, height: 20 };
  assert(!spill.touches(box, s.now + CANNON.LAND_SAFE_MS + 500, flier.sessionId), 'spent ammunition cannot regrow from its own spill while or immediately after landing protection');
  assert(spill.touches(box, s.now + GEMS.SPRAY_PICKUP_DELAY_MS + 1, 'rival'), 'rivals can contest the spent mass without the owner wait');
  assert(spill.touches(box, s.now + GEMS.MISSILE_OWNER_PICKUP_DELAY_MS, flier.sessionId), 'the spent owner can recover surviving spill after the finite delay');
  const targetBox = { x: targetSpill.x - 10, y: targetSpill.y - 10, width: 20, height: 20 };
  assert(!targetSpill.touches(targetBox, s.now + GEMS.OWNER_PICKUP_DELAY_MS - 1, target.sessionId));
  assert(targetSpill.touches(targetBox, s.now + GEMS.OWNER_PICKUP_DELAY_MS, target.sessionId), 'normal damage has a shorter, three-second recovery contest');
}
{
  const s = world(), flier = add(s, 'fan-pilot', 12);
  const fan = new TurbineSchema('fan', 1400, 2000, 0, 0); fan.phase = 'active'; fan.still = true;
  flier.placeAt(fan.x + TURBINE.BODY_RADIUS + 4, fan.y - flier.height / 2);
  runTurbine(s, fan, NOW, .01);
  assert(flier.flying && flier.flightKind === 'turbine', 'a fitting small player actually launches through a fan');
  const speed = Math.hypot(flier.flightVx, flier.flightVy), ux = flier.flightVx / speed, uy = flier.flightVy / speed;
  const target = add(s, 'fan-target', 1000);
  target.placeAt(flier.x + flier.width / 2 + ux * 600 - target.width / 2, flier.y + flier.height / 2 + uy * 600 - target.height / 2);
  for (let tick = 1; tick <= 40 && !flier.flightHit; tick++) { s.time = tick * 50; s.now = NOW + s.time; updateFlights(s, s.now, .05); }
  assert(flier.flightHit && flier.state === 'alive', 'the fan comeback shot hits without player-cannon burnup');
  assert(target.gems < 1000 && target.gems >= 970 && target.injuredUntil > s.time, 'fan hits yield a real but modest giant opening');
}
console.log('Size combat regressions passed: durable giants, useful small hits, near-peer threats, damage plus multiple thieves, lethal large ammunition, fan counterplay and conserved value.');
console.log(JSON.stringify({ isolatedSevenSecondTheft: windows }));
