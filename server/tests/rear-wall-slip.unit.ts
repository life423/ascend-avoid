import assert from 'node:assert/strict';
import { ARENA_RULES, EXHALE } from '../constants/gameConstants.js';
import { arenaContains, arenaCornerRadius } from '../game/arenaBoundary.js';
import { bodyMass } from '../game/creatureSize.js';
import { rearGustImpulses, rearWallSlip } from '../game/puffImpulse.js';
import { GameState } from '../schema/GameState.js';
import { exhale } from '../systems/inhale.js';
import { updateGustWaves } from '../systems/gustWaves.js';
const NOW = 100000, W = 4200, margin = ARENA_RULES.EDGE_MARGIN;
let geometries = 0;
for (const width of [20, 150, 600, 1000]) for (const speed of [1, 100, 420]) for (const angle of [0, Math.PI / 4, Math.PI / 2, Math.PI, 5 * Math.PI / 4, 3 * Math.PI / 2, 7 * Math.PI / 4]) for (const side of [-1, 1]) {
  const nx = Math.cos(angle), ny = Math.sin(angle), r = arenaCornerRadius(W, W);
  const at = { x: nx < -.01 ? r : nx > .01 ? W - r : W / 2, y: ny < -.01 ? r : ny > .01 ? W - r : W / 2 };
  const box = { x: at.x + nx * (r - margin - width / 2) - width / 2, y: at.y + ny * (r - margin - width / 2) - width / 2, width, height: width };
  const input = { x: -ny * side, y: nx * side };
  const slip = rearWallSlip(box, speed, input, W, W);
  assert(slip.redirected && slip.x * input.x + slip.y * input.y > 0);
  assert(Math.hypot(slip.x, slip.y) <= speed + 1e-7);
  assert(arenaContains({ ...box, x: box.x + slip.x / EXHALE.DRAG, y: box.y + slip.y / EXHALE.DRAG }, W, W), 'slip stays inside every wall and curve');
  assert.equal(rearWallSlip(box, speed, { x: 0, y: 0 }, W, W).redirected, false);
  assert.equal(rearWallSlip(box, speed, { x: nx, y: ny }, W, W).redirected, false);
  geometries++;
}
const flat = { x: margin, y: 2100, width: 100, height: 100 };
assert.equal(rearWallSlip(flat, 0, { x: 0, y: 1 }, W, W).redirected, false);
assert.equal(rearWallSlip({ ...flat, x: 2100 }, 420, { x: 0, y: 1 }, W, W).redirected, false);
const partial = rearWallSlip({ ...flat, x: margin + 10 }, 240, { x: 0, y: 1 }, W, W);
assert(Math.abs(partial.x) < 1e-7 && Math.abs(partial.y - 120) < 1e-7, 'near-wall slip fades with clearance and never pulls into the wall');
assert.equal(rearWallSlip({ ...flat, x: margin + 20 }, 240, { x: 0, y: 1 }, W, W).redirected, false);
function scene(bot = false, count = 1, front = false) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear();
  const p = s.addPlayer('runner', 'Runner', NOW); p.setGems(221, W, W); p.placeAt(margin, 2100); p.facing = Math.PI / 2; p.steer(0, 1); p.dropProtection(); p.isBot = bot;
  const hunters = Array.from({ length: count }, (_, i) => {
    const h = s.addPlayer('hunter' + i, 'Hunter', NOW); h.setGems(1000, W, W); h.dropProtection(); h.isBot = bot;
    h.placeAt(p.x + p.width / 2 - h.width / 2, p.y + p.width / 2 - (p.width + h.width) / 2 - 10 - h.width / 2);
    h.facing = Math.PI / 2; h.startInhale(NOW); h.lockOn.set(p.sessionId, .8); h.heldFor.set(p.sessionId, 1.5); return h;
  });
  if (front) {
    const h = s.addPlayer('front', 'Front', NOW); h.setGems(100, W, W); h.dropProtection();
    h.placeAt(p.x + p.width / 2 - h.width / 2, p.y + p.width + 10);
  }
  const events: { type: string; data: Record<string, unknown> }[] = [];
  s.onEvent = (type, data) => events.push({ type, data });
  return { s, p, hunters, events };
}
for (const bot of [false, true]) for (const count of [1, 2, 10]) for (const front of [false, true]) {
  const { s, p, hunters, events } = scene(bot, count, front); exhale(s, p, NOW);
  assert(Math.abs(p.stamina - .25) < 1e-9);
  const wave = s.gustWaves.get(p.sessionId); assert(wave); const budget = wave.remainingImpulse;
  const frontRecoil = Number(events.find(e => e.type === 'exhale')?.data.recoil);
  assert.equal(events.filter(e => e.type === 'wallSlip').length, 0, 'no speculative rear movement on casting');
  s.time = EXHALE.WAVE_WRAP_MS; s.now = NOW + s.time;
  const before = { x: p.puffVx, y: p.puffVy };
  updateGustWaves(s, s.now);
  const rear = Math.hypot(p.puffVx - before.x, p.puffVy - before.y);
  assert(rear > 0 && frontRecoil + rear <= EXHALE.IMPULSE_RECOIL_CAP + 1e-7, 'front and all rear hits share the original caster budget');
  const raw = rearGustImpulses(wave.width, hunters.map(h => ({ id: h.sessionId, width: h.width, falloff: .7 })));
  const scale = Math.min(1, budget / raw.reduce((sum, h) => sum + h.impulse, 0));
  hunters.forEach((h, i) => {
    assert(Math.abs(h.gustVy + raw[i].velocity * scale) < 1e-7, 'recipient shove remains exactly unchanged');
    assert(h.inhaling && h.lockOn.get(p.sessionId) === .8 && h.heldFor.get(p.sessionId) === 1.5, 'no automatic inhale or pressure reset');
    assert(!h.stunned && !h.sliding);
  });
  assert(Math.abs(budget - wave.remainingImpulse - raw.reduce((sum, h) => sum + h.impulse, 0) * scale) < 1e-6);
  assert(rear <= (budget - wave.remainingImpulse) / (bodyMass(wave.width) * EXHALE.REAR_IMPULSE_SCALE) + 1e-7);
  assert.equal(events.filter(e => e.type === 'wallSlip').length, 1);
  const stored = { x: p.puffVx, y: p.puffVy, budget: wave.remainingImpulse };
  updateGustWaves(s, s.now);
  assert.deepEqual({ x: p.puffVx, y: p.puffVy, budget: wave.remainingImpulse }, stored, 'a cast cannot reuse the same hits');
  p.updateMovement(W, W, s.now + 100, .1); assert(arenaContains(p, W, W));
  assert(!p.stunned && !p.sliding && p.suctionSafeUntil === 0);
}
for (const reason of ['empty', 'protected', 'target dead', 'target captured', 'target flying', 'out of arc', 'no input', 'open space', 'dead', 'captured', 'flying', 'disconnected', 'stunned', 'recovering', 'expired'] as const) {
  const { s, p, hunters, events } = scene();
  if (reason === 'empty') s.removePlayer(hunters[0].sessionId);
  if (reason === 'protected') hunters[0].protectFor(1000, NOW);
  if (reason === 'target dead') hunters[0].knockOut(NOW);
  if (reason === 'target captured') hunters[0].capturedBy = 'other';
  if (reason === 'target flying') hunters[0].launch(NOW, 600, 0, 'other', 1000);
  if (reason === 'out of arc') hunters[0].placeAt(p.x + 800, p.y);
  if (reason === 'no input') p.steer(0, 0);
  if (reason === 'open space') { p.placeAt(2100, 2100); hunters[0].placeAt(2100 + p.width / 2 - hunters[0].width / 2, 2100 - hunters[0].width - 10); }
  exhale(s, p, NOW);
  if (reason === 'dead') p.knockOut(NOW);
  if (reason === 'captured') p.capturedBy = hunters[0].sessionId;
  if (reason === 'flying') p.launch(NOW, 600, 0, hunters[0].sessionId, 1000);
  if (reason === 'disconnected') s.removePlayer(p.sessionId);
  if (reason === 'stunned') p.stun(NOW, 1000);
  if (reason === 'recovering') p.recovering = true;
  s.time = reason === 'expired' ? EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_PUSH_MS : EXHALE.WAVE_WRAP_MS;
  updateGustWaves(s, NOW + s.time);
  assert.equal(events.filter(e => e.type === 'wallSlip').length, 0, reason + ' cannot activate wall slip');
}
{
  const { s, p, events } = scene(); exhale(s, p, NOW); p.knockOut(NOW);
  s.update(.033, NOW + 33); assert.equal(s.gustWaves.size, 0);
  assert(s.spawn(p, NOW + 3000));
  s.time = 3000; updateGustWaves(s, NOW + 3000);
  assert.equal(events.filter(e => e.type === 'wallSlip').length, 0);
  assert.equal(p.puffVx, 0); assert.equal(p.puffVy, 0);
}
// Later bodies use only what the same cast has left, including across growth.
{
  const { s, p, hunters, events } = scene(false, 2, true);
  for (const h of hunters) {
    h.setGems(0, W, W);
    h.placeAt(p.x + p.width / 2 - h.width / 2, p.y - h.width - 10);
  }
  hunters[1].protectFor(1000, NOW); exhale(s, p, NOW);
  const wave = s.gustWaves.get(p.sessionId); assert(wave);
  const front = Number(events.find(e => e.type === 'exhale')?.data.recoil);
  const castMass = bodyMass(wave.width);
  p.setGems(1000, W, W); p.placeAt(margin, 2100); p.steer(0, 1);
  s.time = EXHALE.WAVE_WRAP_MS; updateGustWaves(s, NOW + s.time);
  const firstLeft = wave.remainingImpulse;
  hunters[1].dropProtection(); s.time += 33; updateGustWaves(s, NOW + s.time);
  const slips = events.filter(e => e.type === 'wallSlip').map(e => Math.hypot(Number(e.data.wallSlideX), Number(e.data.wallSlideY)));
  assert.equal(slips.length, 2, 'separate confirmed hits can spend separate shares');
  assert(front + slips.reduce((sum, v) => sum + v, 0) <= EXHALE.IMPULSE_RECOIL_CAP + 1e-7);
  assert(wave.remainingImpulse < firstLeft);
  assert(slips.reduce((sum, v) => sum + v, 0) <= (castMass * (EXHALE.IMPULSE_RECOIL_CAP - front) * EXHALE.REAR_IMPULSE_SCALE - wave.remainingImpulse) / (castMass * EXHALE.REAR_IMPULSE_SCALE) + 1e-7, 'growth cannot refill or change the cast budget');
}
console.log(`Rear wall slip passed: ${geometries} geometry cases, hit-only delayed activation, exact unchanged shove/breath, front/rear multi-target budget, pressure, humans/bots, boundaries and invalid-state cleanup.`);
