import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { creatureSize } from '../game/creatureSize.js';
import { impactGems, missileMassAfterImpact } from '../game/cannon.js';
import { collectGems, sprayGems, topUpField } from '../systems/gems.js';
import { CameraRig } from '../game/camera.js';

const NOW = 100000;
function empty() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.weaponsOn = false; s.setTurbines('off'); s.update(0, NOW); return s;
}
for (const gems of [0, 1, 4, 12, 40]) {
  assert.equal(creatureSize(gems), Math.round(20 * Math.sqrt(1 + gems * .75 / 2) * 2) / 2, 'opening pickups use 25% less physical mass while keeping gem value');
}
let previous = 0;
for (const gems of [0, 100, 1000, 1980, 1983, 2000, 5000, 10000, 30000, 100000, 1000000, 1e12]) {
  const width = creatureSize(gems);
  assert(width >= previous && width <= 1260 && Number.isFinite(width), 'late growth stays monotonic and fits a finite arena'); previous = width;
}
assert(creatureSize(10000) > creatureSize(2000) + 150, 'the late climb still produces a visibly larger creature');
assert(creatureSize(1000) > creatureSize(100) * 2 && creatureSize(10000) < creatureSize(1000) * Math.sqrt(10), 'later visible gains require progressively more crystals');
assert(creatureSize(5000) >= creatureSize(2000) * 1.3, 'a substantial established lead still earns a useful capture advantage, not nearly equal bodies');
assert(creatureSize(1e12, 2100, 4200) <= 630, 'physical bounds follow the shorter map side');
{
  const rig = new CameraRig();
  const subject = { x: 2100, y: 2100, vx: 0, vy: 0, width: 20, facing: 0, inhaling: false };
  rig.update(subject, 1 / 60);
  rig.update({ ...subject, width: creatureSize(1e9) }, 1 / 60);
  assert(creatureSize(1e9) / rig.short <= .7 + 1e-9, 'a sudden valuable pickup cannot fill the screen before zoom easing responds');
}
for (const role of [false, true]) for (const gems of [1000, 5000, 1000000, 1e12]) {
  const p = new PlayerSchema('giant', 0); p.isBot = role; p.placeAt(4100, 4100); p.setGems(gems, 4200, 4200);
  assert.equal(p.gems, gems, 'score and carried gem totals are not capped');
  assert(p.x >= 0 && p.y >= 0 && p.x + p.width <= 4200 && p.y + p.height <= 4200, 'even extreme growth remains fully inside the map');
  const kept = missileMassAfterImpact(gems, p.width), landedWidth = creatureSize(kept);
  assert(landedWidth >= 20 && landedWidth <= Math.max(20, p.width * .11), 'a late missile still spends about 90% of its visible width');
}
const moderateBody = creatureSize(10000), enormousBody = creatureSize(1000000);
assert(impactGems(1000000, 1250, moderateBody, enormousBody) > impactGems(1000000, 1250, creatureSize(4), enormousBody) * 10, 'visible ammunition size keeps determining impact threat after the taper');

for (const role of [false, true]) {
  const s = empty(), p = s.addPlayer('giant', 'Giant', NOW); p.isBot = role; p.spawnProtected = false;
  p.setGems(1e9, s.worldWidth, s.worldHeight); p.placeAt(2100 - p.width / 2, 2100 - p.height / 2); s.fieldGemTarget = 950;
  topUpField(s); assert(s.fieldGems > 0 && s.fieldGems <= 950);
  for (const gem of s.gems.values()) assert(!gem.touches(p, NOW, p.sessionId), 'fresh field gems never appear inside a live pickup box');
  const before = p.gems;
  for (let tick = 0; tick < 100; tick++) { collectGems(s, p, NOW + tick * 33); topUpField(s); }
  assert.equal(p.gems, before, 'a stationary giant cannot farm continuous field replenishment');
  const gem = s.gems.values().next().value; assert(gem);
  p.placeAt(gem.x - p.width / 2, gem.y - p.height / 2); collectGems(s, p, NOW + 4000);
  assert(p.gems > before, 'moving into existing crystals still collects and grows');
}
{
  const s = empty(); s.fieldGemTarget = 950;
  for (const x of [2, 1000, 2000, 2938]) for (const y of [2, 1000, 2000, 2938]) {
    const p = new PlayerSchema(`${x}:${y}`, 0); p.setGems(1e300, 4200, 4200); p.placeAt(x, y); s.players.set(p.sessionId, p);
  }
  topUpField(s);
  assert.equal(s.gems.size, 0, 'a fully occupied map waits for room instead of using an unsafe fallback spawn');
  assert.equal(s.fieldGemTarget, 950, 'waiting for free space does not silently lower the field target');
}
{
  const s = empty(); s.fieldGemTarget = 950; topUpField(s);
  assert.equal(s.fieldGems, 30, 'ordinary replenishment has at most one second of shared spawn credit');
  s.gems.clear(); s.fieldGems = 0;
  for (let i = 0; i < 100; i++) topUpField(s);
  assert.equal(s.fieldGems, 0, 'collecting faster cannot manufacture additional refill credit');
  s.time = 1000; topUpField(s); assert.equal(s.fieldGems, 30, 'the shared world refills 30 ordinary gems per second');
  s.gems.clear(); s.fieldGems = 0; s.time = 3600000; topUpField(s);
  assert.equal(s.fieldGems, 30, 'an idle full field cannot bank an enormous later burst');
  assert.equal(new GameState().fieldGems, 950, 'a fresh arena still starts fully stocked');
}
{
  const s = empty(); s.fieldGemTarget = 950; s.fieldReplenishCredit = 0;
  for (let tick = 1; tick <= 300; tick++) s.update(1 / 30, NOW + tick * 1000 / 30);
  assert(s.fieldGems >= 299 && s.fieldGems <= 300, 'the real world loop replenishes at the shared rate over ten seconds');
  const credit = s.fieldReplenishCredit, before = s.gems.size, field = s.fieldGems;
  const value = [...s.gems.values()].reduce((n, g) => n + g.value, 0);
  sprayGems(s, 2100, 2100, 120, NOW + 10000);
  assert.equal(s.fieldReplenishCredit, credit, 'combat spills do not spend background refill credit');
  assert.equal(s.fieldGems, field, 'combat crystals are separate from the background field');
  assert(s.gems.size > before && [...s.gems.values()].reduce((n, g) => n + g.value, 0) === value + 120, 'a full-value combat spill remains available during limited field replenishment');
}
console.log('Growth-bound regressions passed: measured opening, uncapped score, bounded bodies, physical missile cost, safe shared replenishment and conserved combat spills.');
