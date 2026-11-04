import assert from 'node:assert/strict';
import { CANNON } from '../constants/gameConstants.js';
import { arenaClearance, arenaContains, arenaCornerRadius, arenaExit } from '../game/arenaBoundary.js';
import { walk, hop, moveSpeed, type Box } from '../game/movement.js';
import { puffDrift, wallPuffRecoil } from '../game/puffImpulse.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { GameState } from '../schema/GameState.js';
import { updateFlights } from '../systems/flights.js';
import { chooseSpawn, hasEscapeRoutes } from '../game/spawnSafety.js';
import { findPartLayout } from '../game/arenaPlacement.js';
import { updateHolds, fireCaptive } from '../systems/inhale.js';
import { creatureSize } from '../game/creatureSize.js';
const W = 4200, NOW = 100000, R = 700, M = 8;
const near = (a: number, b: number, e = 1e-6) => assert(Math.abs(a - b) < e, `${a} != ${b}`);
const signs = [-1, 1];
function atCorner(size: number, sx: number, sy: number, angle = Math.PI / 4): Box {
  const inset = Math.max(R, M + size / 2), inner = Math.max(0, R - M - size / 2);
  return { x: (sx < 0 ? inset : W - inset) + sx * Math.cos(angle) * inner - size / 2,
    y: (sy < 0 ? inset : W - inset) + sy * Math.sin(angle) * inner - size / 2, width: size, height: size };
}
// Independent visible-outline oracle: test the body circumference, not the centre/helper's own result.
function fits(box: Box) {
  for (let i = 0; i < 48; i++) {
    const a = i * Math.PI / 24;
    const x = box.x + box.width / 2 + Math.cos(a) * (box.width / 2 + M);
    const y = box.y + box.height / 2 + Math.sin(a) * (box.width / 2 + M);
    assert(x >= -1e-5 && y >= -1e-5 && x <= W + 1e-5 && y <= W + 1e-5, 'body inside straight edges');
    if ((x < R || x > W - R) && (y < R || y > W - R)) {
      const cx = x < R ? R : W - R, cy = y < R ? R : W - R;
      assert(Math.hypot(x - cx, y - cy) <= R + 1e-5, 'entire physical body fits the visible curve');
    }
  }
}
assert.equal(arenaCornerRadius(W, W), R);
assert.equal(arenaCornerRadius(1600, 2000), 400, 'practice geometry scales without a second shape');
assert(arenaClearance(0, 0, W, W) < 0);
assert(!arenaContains({ x: M, y: M, width: 20, height: 20 }, W, W), 'old square corner is no longer playable');
let steps = 0;
for (const size of [20, 100, 600, 1260, 1470]) for (const sx of signs) for (const sy of signs) for (const side of signs) {
  const box = atCorner(size, sx, sy), velocity = { x: 0, y: 0 };
  const tx = -sy * side / Math.SQRT2, ty = sx * side / Math.SQRT2, start = { ...box };
  let previous = { ...box };
  for (let tick = 0; tick < 120; tick++) {
    walk(box, velocity, { x: tx, y: ty }, 1 / 60, W, W); fits(box);
    assert(Math.hypot(box.x - previous.x, box.y - previous.y) <= moveSpeed(size) / 60 + 1e-5, 'no collision pop or speed bonus');
    previous = { ...box }; steps++;
  }
  assert((box.x - start.x) * tx + (box.y - start.y) * ty > moveSpeed(size) * .75, 'small and giant bodies make useful progress along either tangent');
  // Let go: drag eases to rest, with no creeping or alternating correction at the curve.
  for (let tick = 0; tick < 180; tick++) walk(box, velocity, { x: 0, y: 0 }, 1 / 60, W, W);
  const stopped = { ...box };
  for (let tick = 0; tick < 60; tick++) walk(box, velocity, { x: 0, y: 0 }, 1 / 60, W, W);
  near(box.x, stopped.x); near(box.y, stopped.y);
  walk(box, velocity, { x: -sx / Math.SQRT2, y: -sy / Math.SQRT2 }, .1, W, W);
  assert(arenaClearance(box.x + size / 2, box.y + size / 2, W, W) > size / 2 + M + 1, 'moving inward peels away immediately');
}
// Slide from a straight wall through its tangent join, rather than catching on a seam.
for (const size of [20, 1260]) for (const sx of signs) for (const sy of signs) {
  const box = atCorner(size, sx, sy, .001), velocity = { x: 0, y: 0 }, before = { ...box };
  for (let i = 0; i < 600; i++) { walk(box, velocity, { x: 0, y: sy }, 1 / 60, W, W); fits(box); }
  assert(Math.abs(box.x - before.x) > Math.min(80, (R - M - size / 2) * .5), 'holding along the side carries a giant smoothly onto the arc');
}
for (const size of [20, 600, 1260, 1470]) for (const sx of signs) for (const sy of signs) {
  const box = atCorner(size, sx, sy), v = { x: sx * 600, y: sy * 100 };
  puffDrift(box, v, .1, W, W); fits(box);
  assert(Math.hypot(v.x, v.y) <= Math.hypot(600, 100));
  const recoil = wallPuffRecoil(box, { x: sx * 300, y: sy * 300 }, { x: -sy, y: sx }, W, W);
  assert(Math.hypot(recoil.x, recoil.y) <= Math.hypot(300, 300) + 1e-6);
  hop(box, 'up', W, W, 10); fits(box);
}
function scene() {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear();
  return s;
}
for (const bot of [false, true]) for (const sx of signs) for (const sy of signs) {
  const s = scene(), p = s.addPlayer('p', 'P', NOW); p.isBot = bot;
  p.setGems(100, W, W); const start = atCorner(p.width, sx, sy); p.placeAt(start.x, start.y);
  p.setGems(1e9, W, W); fits(p); assert(p.width > 1200, 'actual growth reaches giant size');
  p.nudge(sx * 10000, sy * 10000, W, W); fits(p);
  p.steer(-sy / Math.SQRT2, sx / Math.SQRT2);
  for (let i = 1; i <= 60; i++) { s.update(1 / 60, NOW + i * 1000 / 60); fits(p); }
  const before = { ...p }; p.setGems(100, W, W); fits(p);
  near(p.x + p.width / 2, before.x + before.width / 2); near(p.y + p.height / 2, before.y + before.height / 2);
}
for (const kind of ['missile', 'turbine'] as const) for (const sx of signs) for (const sy of signs) {
  const s = scene(), p = s.addPlayer('p', 'P', NOW); p.setGems(100, W, W); p.dropProtection();
  p.launch(NOW, sx * 1800, sy * 1800, 'shooter', 2600, CANNON.DRAG, kind);
  const start = atCorner(p.width, sx, sy); p.placeAt(start.x - sx * 20, start.y - sy * 20);
  const t = arenaExit(p, sx * 180, sy * 180, W, W); assert(t !== null && t > 0 && t < 1);
  const expectedX = p.x + sx * 180 * t, expectedY = p.y + sy * 180 * t;
  assert(Math.abs(arenaClearance(expectedX + p.width / 2, expectedY + p.height / 2, W, W) - p.width / 2 - M) < 1e-5);
  updateFlights(s, NOW + 100, .1);
  assert(!p.flying, 'both flight kinds stop on first rounded wall contact');
  fits(p);
}
{
  const s = scene(), p = s.addPlayer('p', 'P', NOW);
  for (let i = 0; i < 40; i++) {
    const spawn = chooseSpawn(s, p); assert(spawn); fits({ ...spawn, width: p.width, height: p.height });
    assert(hasEscapeRoutes(s, p, spawn.x, spawn.y));
  }
  assert(!s.turbineFits(50, 50), 'fans cannot occupy the removed corner');
  const layout = findPartLayout({ width: W, height: W, fans: [], holes: [], parts: [] }, 20, 20);
  assert(layout && layout.parts.every(p => arenaClearance(p.x, p.y, W, W) >= 64), 'all three parts remain reachable inside the curve');
  for (let i = 0; i < 100; i++) s.addGem();
  for (const gem of s.gems.values()) assert(arenaClearance(gem.x, gem.y, W, W) >= 39);
}
// Actual fixed holes and a giant at every corner: no idle correction/jitter, and an open retreat remains.
let legacyGems = 0;
while (creatureSize(legacyGems) < 1260) legacyGems++;
for (const sx of signs) for (const sy of signs) {
  const s = scene();
  for (const [x, y] of [[1050, 1260], [3150, 1260], [2100, 3108]]) s.blackHoles.push(new BlackHoleSchema(x, y));
  const p = s.addPlayer('giant', 'Giant', NOW); p.setGems(legacyGems, W, W);
  const at = atCorner(p.width, sx, sy); p.placeAt(at.x, at.y);
  for (let i = 1; i <= 60; i++) s.update(1 / 60, NOW + i * 1000 / 60);
  near(p.x+p.width/2, at.x+at.width/2); near(p.y+p.height/2, at.y+at.height/2); fits(p);
  // Follow the upper arc toward the roomy top edge; lower arcs have an open inward retreat.
  const input = sy < 0 ? { x: -sx, y: -1 } : { x: -sx, y: -sy };
  p.steer(input.x / Math.SQRT2, input.y / Math.SQRT2);
  const start = { x: p.x, y: p.y };
  for (let i = 61; i <= 180; i++) { s.update(1 / 60, NOW + i * 1000 / 60); fits(p); }
  assert(Math.hypot(p.x - start.x, p.y - start.y) > 60, 'giant can navigate the actual corner/hole layout');
  assert(s.blackHoles.every(h => Math.hypot(p.x + p.width / 2 - h.x, p.y + p.width / 2 - h.y) >= h.radius + p.width / 2 + 8 - .1));
}
// Growth can create a new rim overlap: at the larger trial maximum, keep steering
// useful and verify eventual clearance without a teleport, death or collision pop.
for (const sx of signs) for (const sy of signs) {
  const s = scene();
  for (const [x, y] of [[1050,1260],[3150,1260],[2100,3108]]) s.blackHoles.push(new BlackHoleSchema(x,y));
  const p = s.addPlayer('maximum','Maximum',NOW); p.setGems(1e9,W,W);
  const at = atCorner(p.width,sx,sy); p.placeAt(at.x,at.y); p.dropProtection();
  p.steer(-sx/Math.SQRT2,(sy<0?-1:-sy)/Math.SQRT2);
  let previous = {x:p.x,y:p.y};
  for(let i=1;i<=600;i++) {
    s.update(1/60,NOW+i*1000/60); fits(p);
    assert(Math.hypot(p.x-previous.x,p.y-previous.y)<6,'growth overlap does not teleport the giant');
    previous={x:p.x,y:p.y};
  }
  assert.equal(p.state,'alive');
  assert(Math.hypot(p.x-at.x,p.y-at.y)>300,'a larger giant can navigate out of every corner');
  assert(s.blackHoles.every(h=>Math.hypot(p.x+p.width/2-h.x,p.y+p.width/2-h.y)>=h.radius+p.width/2+8-.1),'the maximum-size escape eventually clears the current rims');
}
// Eject and fire near a curve: retained input/protection/accounting use the ordinary paths.
for (const fire of [false, true]) {
  const s = scene(), owner = s.addPlayer('a', 'A', NOW), kid = s.addPlayer('b', 'B', NOW);
  owner.setGems(1000, W, W); kid.setGems(10, W, W);
  const at = atCorner(owner.width, -1, -1); owner.placeAt(at.x, at.y); owner.facing = -3 * Math.PI / 4;
  owner.gulping = kid.sessionId; kid.capturedBy = owner.sessionId; owner.captureNeedsRelease = false;
  if (fire) { assert(fireCaptive(s, owner, NOW)); fits(kid); updateFlights(s, NOW + 100, .1); assert(!kid.flying); }
  else { owner.gulpEndsAt = s.time; updateHolds(s, NOW); fits(kid); assert(kid.recaptureAfter >= NOW + CANNON.ESCAPE_SAFE_MS); }
}
console.log(`Rounded arena passed: ${steps} walking steps across four corners/two directions/five sizes; whole-body outline oracle, seams, release, growth/shrink, drift, hops, bot parity, swept flight, safe spawn and reachable objects.`);
