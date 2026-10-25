import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { CANNON, TURBINE } from '../constants/gameConstants.js';
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
  for (const p of thieves) { p.startInhale(s.now); }
  for (let tick = 1; tick <= 150 && victim.state === 'alive'; tick++) {
    s.time = began + tick * 1000 / 30; s.now = NOW + s.time;
    victim.placeAt(2000 - victim.width / 2, 2000 - victim.height / 2);
    thieves.forEach((p, i) => {
      p.facing = i % 2 ? Math.PI : 0;
      p.placeAt(i % 2 ? 2000 + victim.width / 2 + 4 : 2000 - victim.width / 2 - 4 - p.width, 2000 - p.height / 2);
      p.heldFor.set(victim.sessionId, (s.time - began) / 1000);
      steal(s, p, s.now, 1 / 30);
    });
  }
  if (victim.state === 'alive') assert.equal(victim.injuredUntil, deadline, 'theft does not extend injury');
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
assert(impactGems(10000, 2000, width(12)) < 100, 'a maximum-speed small shot takes under 1% from a very large giant');
assert(scaleDrain(width(40), width(1000)) * drainRamp(30) < .75, 'even a long-held small inhale cannot regain peer-level theft against a giant');
assert(scaleDrain(width(1000), width(1000)) > scaleDrain(width(250), width(1000)), 'substantial rivals remain stronger thieves');

const windows: { thief: number; stolen: number }[] = [];
for (const gems of [4, 40, 250, 1000]) {
  const s = world(), victim = add(s, 'victim', 1000), thief = add(s, 'thief', gems);
  victim.injure(s.time); injuryWindow(s, victim, [thief]);
  const stolen = 1000 - victim.gems; windows.push({ thief: gems, stolen });
  assert.equal(thief.gems - gems, stolen, 'theft transfers each gem exactly once');
  assert.equal(total(s), 1000 + gems);
  assert(stolen > 0 && victim.state === 'alive', 'small players can profit and the giant can survive an undefended window');
  if (gems <= 40) assert(stolen <= 25, 'a small thief alone cannot drain a large lead in five seconds');
  const left = victim.gems; steal(s, thief, s.now, 1); assert.equal(victim.gems, left, 'healing ends all theft at the deadline');
}
assert(windows[2].stolen > windows[1].stolen * 2 && windows[3].stolen > windows[2].stolen, 'near-peer pressure is substantially more dangerous than harassment');
{
  const { s, target, flier } = shot(20, 1000);
  assert(target.gems >= 970 && target.injuredUntil > s.time && target.stunned, 'small shots still spill, stun and expose a giant');
  assert.equal(flier.state, 'dead', 'the separately approved spent-missile consequence remains');
  const thieves = [add(s, 'left-thief', 4), add(s, 'right-thief', 4)];
  injuryWindow(s, target, thieves);
  assert(target.gems >= 950, 'a small impact plus two perfectly persistent tiny thieves leaves at least 95% of giant progress');
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
console.log(JSON.stringify({ isolatedFiveSecondTheft: windows }));
