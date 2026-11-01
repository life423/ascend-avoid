import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { INHALE, CANNON } from '../constants/gameConstants.js';
import { updateInhales, updateHolds, exhale } from '../systems/inhale.js';

const NOW = 100_000;
function world(attackerGems = 100, targetGems = 100, reachShare = .5) {
  const state = new GameState(0); state.botFill = 0; state.fieldGemTarget = 0;
  state.surgesOn = false; state.weaponsOn = false; state.setTurbines('off'); state.update(0, NOW);
  const a = state.addPlayer('attacker', 'Attacker', NOW), b = state.addPlayer('target', 'Target', NOW);
  a.setGems(attackerGems, 4200, 4200); b.setGems(targetGems, 4200, 4200);
  a.placeAt(1200, 1600); a.facing = 0; a.spawnProtected = b.spawnProtected = false;
  const mouthX = a.x + a.width * .8;
  b.placeAt(mouthX + (INHALE.REACH + a.width * INHALE.REACH_PER_SIZE) * reachShare, a.y + (a.height - b.height) / 2);
  a.startInhale(NOW);
  const tick = (ms: number) => state.update(1 / 30, NOW + ms);
  return { state, a, b, tick };
}

{
  const { a, b, tick } = world(); const x = b.x;
  for (let i = 1; i <= 8; i++) tick(i * 1000 / 30);
  const early = x - b.x;
  for (let i = 9; i <= 30; i++) tick(i * 1000 / 30);
  const moved = x - b.x;
  assert(early > 2 && moved > 10, 'a stationary healthy peer still feels a tug while retaining substantial body resistance');
  assert.equal(a.gems, 100); assert.equal(b.gems, 100);
  assert.equal(b.injuredUntil, 0); assert.equal(b.robbedTotal, 0, 'healthy bodily pull never grants gem theft');
  assert.equal(b.capturedBy, '', 'equal-size creatures cannot capture each other');
  a.stopInhale(NOW + 1000); const stopped = b.x;
  for (let i = 31; i <= 40; i++) tick(i * 1000 / 30);
  assert(Math.abs(b.x - stopped) < .01, 'releasing inhale stops the physical pull');
  console.log(JSON.stringify({ healthyPeerFirstQuarterSecond: early, healthyPeerFirstSecond: moved }));
}

function displacement(attackerGems: number, targetGems: number) {
  const { b, tick } = world(attackerGems, targetGems); const x = b.x;
  for (let i = 1; i <= 8; i++) tick(i * 1000 / 30);
  return x - b.x;
}
const tinyPuller = displacement(4, 1000), peerPuller = displacement(1000, 1000), smallTarget = displacement(1000, 4);
assert(peerPuller > tinyPuller * 3, 'a large target strongly resists a tiny inhaler');
assert(smallTarget > peerPuller, 'small targets are drawn faster than large ones');
console.log(JSON.stringify({ tinyPuller, peerPuller, smallTarget }));

for (const [attacker, target, range] of [[100,100,.5],[100,100,.85],[1000,4,.9]] as const) {
  const {a,b,tick}=world(attacker,target,range), start=b.x;
  b.steer(1,0);
  for(let i=1;i<=60;i++)tick(i*1000/30);
  assert(b.x>start+180&&!b.capturedBy,'deliberate retreat escapes peer suction and the distant edge of a larger mouth');
  assert(!a.gulping);
}
{
  const pulling=world(), free=world();free.a.stopInhale(NOW);
  pulling.b.steer(1,0);free.b.steer(1,0);
  const start=pulling.b.x, reference=free.b.x;
  for(let i=1;i<=30;i++){pulling.tick(i*1000/30);free.tick(i*1000/30);}
  assert(pulling.b.x-start>=(free.b.x-reference)*.98,'a peer cannot slow a committed straight retreat');
}

for (const protectedBy of ['spawn', 'suction', 'flight', 'knockout'] as const) {
  const { state, b, tick } = world();
  if (protectedBy === 'spawn') b.protectFor(1000, NOW);
  if (protectedBy === 'suction') b.suctionSafeUntil = NOW + 1000;
  if (protectedBy === 'flight') b.launch(NOW, 0, 0, 'launcher', 1000);
  if (protectedBy === 'knockout') b.knockOut(NOW);
  const x = b.x; updateInhales(state, NOW, 1 / 30);
  assert.equal(b.x, x, `${protectedBy} protection prevents stronger suction`);
  if (protectedBy === 'suction') { tick(1000); assert(b.x < x, 'ordinary pull resumes after protection expires'); }
}

{
  const healthy = world(), injured = world(); injured.b.injure(0);
  updateInhales(healthy.state, NOW, 1 / 30); updateInhales(injured.state, NOW, 1 / 30);
  assert.equal(healthy.b.x + healthy.b.width / 2, injured.b.x + injured.b.width / 2, 'body pull does not depend on injury');
}

{
  const { a, b, tick } = world(); b.steer(0, 1); const y = b.y;
  for (let i = 1; i <= 60; i++) tick(i * 1000 / 30);
  console.log(JSON.stringify({ sidewaysEscapeInTwoSeconds: b.y - y }));
  assert(b.y > y + 150 && !a.gulping, 'sideways walking remains useful against strong suction');
}

// A defensive gust must preserve an existing escape/landing recovery window.
for (const recovery of [CANNON.ESCAPE_SAFE_MS, CANNON.LAND_SAFE_MS]) {
  const { state, a, b } = world(40, 40, .1);
  b.facing = Math.PI; b.suctionSafeUntil = NOW + recovery; b.recaptureAfter = NOW + recovery;
  exhale(state, b, NOW);
  assert(a.puffVx < 0 && !a.stunned && !a.sliding, 'a protected defender can still push without stunning');
  assert.equal(b.suctionSafeUntil, NOW + recovery, 'gust preserves the longer recovery');
}

// Escaping from a huge body starts outside it, including at a wall, and cannot immediately recycle.
for (const wall of [false, true]) {
  const { state, a, b } = world(10000, 4, .5);
  if (wall) { a.placeAt(8, 8); a.facing = Math.PI; }
  b.placeAt(a.x + a.width * .8 - b.width / 2, a.y + a.height / 2 - b.height / 2);
  a.facing = wall ? Math.PI : 0;
  b.capturedBy = a.sessionId; a.gulping = b.sessionId;
  a.gulpEndsAt = 600; state.time = 600;
  updateHolds(state, NOW + 600);
  assert.equal(b.capturedBy, '');
  const distance = Math.hypot(b.x + b.width / 2 - a.x - a.width / 2, b.y + b.height / 2 - a.y - a.height / 2);
  assert(distance >= (a.width + b.width) / 2 + CANNON.RELEASE_CLEARANCE - .01, 'release clears the entire body');
  assert(b.x >= 8 && b.y >= 8 && b.x + b.width <= 4192 && b.y + b.height <= 4192);
  assert.equal(b.suctionSafeUntil, NOW + 600 + 4000);
  a.startInhale(NOW + 601); const x = b.x, y = b.y;
  updateInhales(state, NOW + 601, 1 / 30);
  assert.equal(b.capturedBy, ''); assert.equal(b.x, x); assert.equal(b.y, y);
}
console.log('Body pull: healthy motion, size resistance, release, shields, sideways escape, parry recovery and clear capture exits pass');
