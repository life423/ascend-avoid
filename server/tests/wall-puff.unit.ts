import assert from 'node:assert/strict';
import { ARENA_RULES, EXHALE } from '../constants/gameConstants.js';
import { puffImpulses, wallPuffRecoil } from '../game/puffImpulse.js';
import { GameState } from '../schema/GameState.js';
import { exhale, updateInhales } from '../systems/inhale.js';

const NOW = 100000, W = 4200, margin = ARENA_RULES.EDGE_MARGIN;
const walls = [
  { name: 'left', x: margin, y: 2100, outward: { x: -1, y: 0 }, tangent: { x: 0, y: 1 }, facing: 0 },
  { name: 'right', x: W - margin - 80, y: 2100, outward: { x: 1, y: 0 }, tangent: { x: 0, y: 1 }, facing: Math.PI },
  { name: 'top', x: 2100, y: margin, outward: { x: 0, y: -1 }, tangent: { x: 1, y: 0 }, facing: Math.PI / 2 },
  { name: 'bottom', x: 2100, y: W - margin - 80, outward: { x: 0, y: 1 }, tangent: { x: 1, y: 0 }, facing: -Math.PI / 2 },
];
let matrix = 0;
for (const wall of walls) for (const side of [-1, 1]) for (const width of [20, 80, 300]) for (const speed of [1, 40, 200, 420]) {
  const box = { x: wall.x, y: wall.y, width, height: width };
  if (wall.name === 'right') box.x = W - margin - width;
  if (wall.name === 'bottom') box.y = W - margin - width;
  const input = { x: wall.tangent.x * side, y: wall.tangent.y * side };
  const recoil = { x: wall.outward.x * speed, y: wall.outward.y * speed };
  const result = wallPuffRecoil(box, recoil, input, W, W);
  assert(result.redirected, `${wall.name} redirects toward either chosen tangent`);
  assert(Math.abs(Math.hypot(result.x, result.y) - speed) < 1e-9);
  assert(result.x * input.x + result.y * input.y > 0);
  assert.equal(wallPuffRecoil(box, recoil, { x: 0, y: 0 }, W, W).redirected, false);
  assert.equal(wallPuffRecoil(box, recoil, wall.outward, W, W).redirected, false);
  const inward = { x: -recoil.x, y: -recoil.y };
  assert.deepEqual(wallPuffRecoil(box, inward, input, W, W), { ...inward, redirected: false });
  assert.deepEqual(wallPuffRecoil({ ...box, x: 2100, y: 2100 }, recoil, input, W, W), { ...recoil, redirected: false });
  matrix++;
}
for (const xSign of [-1, 1]) for (const ySign of [-1, 1]) for (const input of [{ x: -xSign, y: 0 }, { x: 0, y: -ySign }, { x: -xSign, y: -ySign }]) {
  const box = { x: xSign < 0 ? margin : W - margin - 80, y: ySign < 0 ? margin : W - margin - 80, width: 80, height: 80 };
  const recoil = { x: xSign * 200, y: ySign * 150 };
  const result = wallPuffRecoil(box, recoil, input, W, W);
  assert(result.redirected && Math.hypot(result.x, result.y) <= 250 + 1e-9);
  assert(result.x * xSign <= 0 && result.y * ySign <= 0, 'corner tangent never exits through the other boundary');
  assert(result.x === 0 || result.y === 0, 'a corner slip follows one boundary, not a diagonal free dash');
  assert.equal(wallPuffRecoil(box, recoil, { x: xSign, y: ySign }, W, W).redirected, false);
}
{
  const box = { x: margin + 5, y: 2100, width: 80, height: 80 };
  const result = wallPuffRecoil(box, { x: -400, y: 0 }, { x: 0, y: 1 }, W, W);
  assert(result.redirected && result.x === -5 * EXHALE.DRAG && result.y === 400 - 5 * EXHALE.DRAG, 'only the recoil that cannot fit before the wall is redirected');
  assert.equal(wallPuffRecoil({ ...box, x: margin + 40 }, { x: -400, y: 0 }, { x: 0, y: 1 }, W, W).redirected, false, 'no distant wall attraction');
  const opposed = wallPuffRecoil({ ...box, x: margin }, { x: -100, y: 300 }, { x: 0, y: -1 }, W, W);
  assert(opposed.redirected && opposed.y === 200 && opposed.slideY === -100, 'blocked recoil can help walking overcome an opposing tangent without adding force');
}
// Diagonal incidence cannot turn vector addition into extra energy.
for (let angle = 0; angle < Math.PI * 2; angle += .05) {
  const recoil = { x: Math.cos(angle) * 420, y: Math.sin(angle) * 420 };
  for (const y of [-1, 1]) {
    const result = wallPuffRecoil({ x: margin, y: 2100, width: 80, height: 80 }, recoil, { x: 0, y }, W, W);
    assert(Math.hypot(result.x, result.y) <= 420 + 1e-9);
  }
}
function scene(bot: boolean, wallIndex: number, targetGems: number) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear();
  const p = s.addPlayer('defender', 'Defender', NOW), hunter = s.addPlayer('hunter', 'Hunter', NOW);
  p.setGems(100, W, W); hunter.setGems(targetGems, W, W);
  for (const actor of [p, hunter]) { actor.isBot = bot; actor.dropProtection(); }
  const wall = walls[wallIndex];
  p.placeAt(wallIndex === 1 ? W - margin - p.width : wall.x, wallIndex === 3 ? W - margin - p.width : wall.y);
  p.facing = wall.facing;
  const distance = (p.width + hunter.width) / 2 + 30;
  hunter.placeAt(p.x + p.width / 2 + Math.cos(p.facing) * distance - hunter.width / 2,
    p.y + p.height / 2 + Math.sin(p.facing) * distance - hunter.height / 2);
  hunter.facing = p.facing + Math.PI; hunter.startInhale(NOW);
  return { s, p, hunter, wall };
}
for (const bot of [false, true]) for (let wallIndex = 0; wallIndex < 4; wallIndex++) for (const gems of [0, 100, 10000]) {
  const { s, p, hunter, wall } = scene(bot, wallIndex, gems);
  p.steer(wall.tangent.x, wall.tangent.y);
  const events: Record<string, unknown>[] = []; s.onEvent = (type, data) => { if (type === 'exhale') events.push(data); };
  const before = { x: p.x, y: p.y }, facing = p.facing;
  const mouthX = p.x + p.width / 2 + Math.cos(facing) * p.width * .3, mouthY = p.y + p.height / 2 + Math.sin(facing) * p.width * .3;
  const gap = Math.max(0, Math.hypot(hunter.x + hunter.width / 2 - mouthX, hunter.y + hunter.height / 2 - mouthY) - hunter.width / 2);
  const expected = puffImpulses(p.width, [{ id: hunter.sessionId, width: hunter.width, falloff: 1 - gap / (EXHALE.REACH + p.width * EXHALE.REACH_PER_SIZE) }]);
  hunter.lockOn.set(p.sessionId, .8); hunter.heldFor.set(p.sessionId, 1.5);
  exhale(s, p, NOW);
  assert(Math.abs(Math.hypot(p.puffVx, p.puffVy) - expected.recoil) < 1e-9, 'wall redirection preserves the normal mass-based recoil budget');
  const targetHit = expected.hits[0]; assert(targetHit);
  assert(Math.abs(Math.hypot(hunter.puffVx, hunter.puffVy) - targetHit.velocity) < 1e-9, 'the pursuer receives exactly the ordinary shove strength');
  assert(hunter.inhaling && hunter.lockOn.get(p.sessionId) === .8 && hunter.heldFor.get(p.sessionId) === 1.5);
  assert.equal(p.suctionSafeUntil, 0); assert(!p.stunned && !p.sliding);
  assert(events[0] && (Number(events[0].wallSlideX) || Number(events[0].wallSlideY)), 'the server reports the actual direction for the airflow cue');
  p.updateMovement(W, W, NOW + 100, .1);
  assert((p.x - before.x) * wall.tangent.x + (p.y - before.y) * wall.tangent.y > 0);
  assert(p.x >= margin && p.y >= margin && p.x + p.width <= W - margin && p.y + p.height <= W - margin);
  const impulse = { x: p.puffVx, y: p.puffVy }; exhale(s, p, NOW + 100);
  assert.deepEqual({ x: p.puffVx, y: p.puffVy }, impulse, 'breath cost prevents extra wall kicks');
}
for (const reason of ['empty', 'protected target', 'no tangent', 'injured', 'stunned', 'captured'] as const) {
  const { s, p, hunter } = scene(false, 0, 10000); p.steer(0, 1);
  if (reason === 'empty') s.removePlayer(hunter.sessionId);
  if (reason === 'protected target') hunter.protectFor(1000, NOW);
  if (reason === 'no tangent') p.steer(0, 0);
  if (reason === 'injured') p.injure(s.time);
  if (reason === 'stunned') p.stun(NOW, 500);
  if (reason === 'captured') p.capturedBy = hunter.sessionId;
  exhale(s, p, NOW);
  assert.equal(p.puffVy, 0, `${reason} cannot create a wall slip`);
}
{
  const { s, p, hunter } = scene(false, 0, 10000);
  exhale(s, p, NOW); // No sideways input: normal recoil points into the wall.
  hunter.placeAt(p.x + p.width - hunter.width * .3, p.y + p.height / 2 - hunter.height / 2);
  hunter.facing = Math.PI;
  updateInhales(s, NOW + 17, .017);
  assert(p.capturedBy === hunter.sessionId, 'a failed escape still allows a normal mouth catch');
}
console.log(`Wall puff passed: ${matrix} wall/size/direction/speed cases, four corners, diagonal energy cap, valid-hit mass budget, human/bot parity, unchanged pressure, restrictions, breath cost, boundaries and failed-escape capture.`);
