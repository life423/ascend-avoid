import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { BotBrain } from '../game/bots.js';
import { BotCannonAim, cannonTargetAppeal } from '../game/botAim.js';
import { creatureSize } from '../game/creatureSize.js';
import { botMouth } from '../systems/bots.js';
import { stealWeight, updateHolds, updateInhales } from '../systems/inhale.js';
import { viewShort } from '../game/camera.js';
import { BOTS, CANNON, GEMS, TURBINE, WORLD } from '../constants/gameConstants.js';
import { runTurbine } from '../systems/turbines.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { GemSchema } from '../schema/GemSchema.js';
import { spreadSettledGems, topUpField } from '../systems/gems.js';

const NOW = 100000;
assert(cannonTargetAppeal(12, creatureSize(12), creatureSize(4), 1250, 400) > cannonTargetAppeal(1000, creatureSize(1000), creatureSize(4), 1250, 200), 'tiny ammunition prefers a finishable rival over a healthy giant');
assert(cannonTargetAppeal(40, creatureSize(40), creatureSize(1000), 1250, 400) > cannonTargetAppeal(1000, creatureSize(1000), creatureSize(1000), 1250, 200), 'large ammunition can pursue a decisive small-target opportunity');
function setup() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.weaponsOn = false; s.setTurbines('off'); s.update(0, NOW);
  const a = s.addPlayer('captor', 'Captor', NOW), b = s.addPlayer('captive', 'Captive', NOW);
  a.setGems(16, s.worldWidth, s.worldHeight); b.setGems(4, s.worldWidth, s.worldHeight);
  a.placeAt(1000, 1000); b.placeAt(a.x + a.width, a.y + (a.height - b.height) / 2);
  a.spawnProtected = b.spawnProtected = false; a.facing = 0; a.startInhale(NOW);
  updateInhales(s, NOW, 1 / 30); assert.equal(b.capturedBy, a.sessionId);
  return { s, a, b };
}
{
  const { s, a, b } = setup();
  s.time = b.captureHoldMs; s.now = NOW + s.time;
  updateHolds(s, s.now);
  assert.equal(b.capturedBy, '');
  const ends = s.now + CANNON.ESCAPE_SAFE_MS;
  assert.equal(b.recaptureAfter, ends); assert.equal(b.suctionSafeUntil, ends);
  assert.equal(b.launchSafeUntil, s.time + CANNON.ESCAPE_SAFE_MS, 'the existing world-clock ring also shows escape protection');
  const third = s.addPlayer('third', 'Third', s.now); third.spawnProtected = false;
  third.setGems(16, s.worldWidth, s.worldHeight);
  for (const hunter of [a, third]) {
    hunter.placeAt(1000, 1000); hunter.facing = 0; hunter.startInhale(s.now);
    for (const at of [ends - 1000, ends - 1]) {
      s.now = at; b.placeAt(hunter.x + hunter.width, hunter.y + (hunter.height - b.height) / 2);
      const x = b.x, y = b.y, gems = b.gems;
      assert.equal(stealWeight(s, hunter, b), 0);
      updateInhales(s, at, 1 / 30);
      assert.equal(b.capturedBy, ''); assert.equal(b.x, x); assert.equal(b.y, y); assert.equal(b.gems, gems);
    }
    hunter.stopInhale(s.now);
  }
  s.now = ends; a.startInhale(ends); b.placeAt(a.x + a.width, a.y + (a.height - b.height) / 2);
  updateInhales(s, ends, 1 / 30);
  assert.equal(b.capturedBy, a.sessionId, 'normal capture resumes exactly when the escape shield expires');
}
{
  let reads = 0, valid = true, target = { id: 'target', angle: 1 };
  const aim = new BotCannonAim(() => .5), observe = () => { reads++; return target; };
  const update = (now: number, facing = 0) => aim.update('one', 0, now, facing, observe, () => valid);
  assert(!update(0).ready); update(249); assert.equal(reads,0,'first observation is delayed');
  const first=update(250); assert(first.hasTarget&&!first.ready);
  assert(Math.abs(first.angle-target.angle)>=BOTS.FIRE_ERROR_MIN&&Math.abs(first.angle-target.angle)<=BOTS.FIRE_ERROR_MAX);
  assert.equal(update(700).angle,first.angle,'same target retains one imperfect offset');
  assert(!update(1400).ready,'waiting alone does not count as aiming');
  assert(!update(1500,first.angle).ready);assert(!update(1949,first.angle).ready);
  assert(update(1950,first.angle+Math.PI*2).ready,'continuous alignment gates firing and wraps angles');
  valid=false;assert(!update(1951,first.angle).hasTarget,'a vanished target cancels firing immediately between observations');
  valid=true;target={id:'another',angle:2};const next=update(2300,2.18);assert(next.hasTarget&&!next.ready,'retargeting has its own reaction time');
  assert(update(3000,next.angle).ready);
  aim.reset();assert(!aim.update('one',0,4000,next.angle,observe).ready,'an interrupted plan cannot resume ready to fire');
  assert(!aim.update('two',0,9000,next.angle,observe).ready,'a new capture always begins a new plan');
}
{
  const aim=new BotCannonAim(()=>.5);
  for(let now=0;now<10000;now+=50)assert(!aim.update('empty',0,now,0,()=>null).ready,'no target never falls back to a blind shot');
}
{
  const aim=new BotCannonAim(()=>.5),observe=()=>({id:'target',angle:0});
  let angle=0;for(let now=0;now<=1400;now+=50)angle=aim.update('one',0,now,0,observe).angle;
  assert(!aim.update('one',0,1450,Math.PI,observe).ready,'turning away breaks settled aim');
  assert(!aim.update('one',0,1500,angle,observe).ready);
  assert(!aim.update('one',0,1949,angle,observe).ready);
  assert(aim.update('one',0,1950,angle,observe).ready);
}
{
  const {s,a,b}=setup();s.blackHoles.clear();
  const target=s.addPlayer('aim-target','Target',NOW);target.spawnProtected=false;
  a.isBot=true;s.brains.set(a.sessionId,new BotBrain());
  target.placeAt(a.x,a.y-550);const initial=a.facing;let firedAt=0,turned=false;
  for(let ms=0;ms<4000;ms+=25){
    s.time=ms;s.now=NOW+ms;updateHolds(s,s.now,.025);botMouth(s,a,s.now);
    if(b.flying){firedAt=ms;break;}
    a.updateMovement(4200,4200,s.now,.025);turned ||= Math.abs(a.facing-initial)>.2;
    if(ms<BOTS.FIRE_MIN_CAPTURE_MS)assert(!b.flying,'real bot cannot immediately fire a fresh capture');
  }
  assert(firedAt>=BOTS.FIRE_MIN_CAPTURE_MS&&firedAt<4000);assert(turned,'the body visibly turns toward the target');
  assert(Math.abs(Math.atan2(b.flightVy,b.flightVx)+Math.PI/2)<.5,'shot follows the ordinary physically turned mouth');
}
for(const loss of ['none','dead','protected','range','disconnect'] as const){
  const {s,a,b}=setup();s.blackHoles.clear();
  const target=loss==='none'?null:s.addPlayer('aim-target','Target',NOW);if(target){target.spawnProtected=false;target.placeAt(a.x+500,a.y);}
  a.isBot=true;s.brains.set(a.sessionId,new BotBrain());s.botFill=2;
  for(let ms=0;ms<=Math.ceil(b.captureHoldMs);ms+=25){
    s.time=ms;s.now=NOW+ms;
    if(ms===1200&&target){
      if(loss==='dead')target.knockOut(s.now);if(loss==='protected')target.spawnProtected=true;
      if(loss==='range')target.placeAt(4000,4000);if(loss==='disconnect')s.removePlayer(target.sessionId);
    }
    updateHolds(s,s.now,.025);botMouth(s,a,s.now);a.updateMovement(4200,4200,s.now,.025);
    assert(!b.flying,`${loss}: no blind shot after losing a valid target`);
  }
  s.time=b.captureHoldMs;s.now=NOW+s.time;updateHolds(s,s.now);
  assert(!b.capturedBy&&b.state==='alive',`${loss}: normal hold timeout ejects instead of forcing a shot`);
}
{
  const { s, a } = setup();
  a.steer(-1, 0); a.aimAt(0, -1);
  for (let i = 1; i <= 30; i++) a.updateMovement(s.worldWidth, s.worldHeight, NOW + i * 33, .033);
  assert(a.x < 980, 'a loaded captor can walk left');
  assert(Math.abs(a.facing + Math.PI / 2) < .1, 'the same loaded captor can independently aim upward');
  a.aimAt(0, 0); assert.equal(a.aimX, 0); assert.equal(a.aimY, 0);
}
{
  const s = new GameState(0); s.botFill = 0;
  const p = s.addPlayer('spawn', 'Spawn', NOW);
  const random = Math.random;
  try {
    for (const edge of [0, 0.999999]) {
      Math.random = () => edge;
      for (let i = 0; i < 12; i++) {
        s.spawn(p, NOW);
        const half = viewShort(20) * WORLD.MAX_VIEW_ASPECT / 2;
        assert(p.x + p.width / 2 > half && p.x + p.width / 2 < s.worldWidth - half);
        assert(p.y + p.height / 2 > half && p.y + p.height / 2 < s.worldHeight - half);
      }
    }
  } finally { Math.random = random; }
}
console.log('Fairness regressions passed: all-player escape shield, bot reaction/committed aim, and interior spawns.');

for (const gems of [0, 4, 12, 13, 100, 1000]) {
  const s = new GameState(0); s.botFill = 0;
  const p = s.addPlayer('fan-user', 'Fan user', NOW); p.spawnProtected = false;
  p.setGems(gems, s.worldWidth, s.worldHeight);
  const width = p.width, radius = width / 2;
  const t = new TurbineSchema('fan', 2000, 2000, 0, 0); t.phase = 'active'; t.still = true;
  p.placeAt(t.x + TURBINE.BODY_RADIUS + 4, t.y - radius);
  runTurbine(s, t, NOW, .01);
  const fits = width <= TURBINE.OPENING_WIDTH;
  assert.equal(p.flying, fits, `${gems} gems: only fitting creatures pass through the fan`);
  if (fits) assert.equal(p.flightKind, 'turbine');
  else {
    assert.equal(p.gems, gems, 'the blocked attempt does not charge through-launch mass');
    assert(Math.hypot(p.x + p.width / 2 - t.x, p.y + p.height / 2 - t.y) >= TURBINE.BODY_RADIUS + p.width / 2 - .1);
    p.placeAt(t.x - p.width / 2, t.y - p.height / 2);
    runTurbine(s, t, NOW, .01);
    assert(!p.flying, 'an oversized creature at the exact fan center is ejected, never launched');
    assert(Math.hypot(p.x + p.width / 2 - t.x, p.y + p.height / 2 - t.y) >= TURBINE.BODY_RADIUS + p.width / 2 - .1);
  }
}
{
  const s = new GameState(0); s.botFill = 0; s.fieldGemTarget = 950;
  const random = Math.random; let seed = 321;
  try {
    Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
    topUpField(s, true);
  } finally { Math.random = random; }
  const gems = [...s.gems.values()];
  assert.equal(gems.length, 950); assert.equal(s.fieldGems, 950);
  let nearest = Infinity;
  for (let i = 0; i < gems.length; i++) for (let j = 0; j < i; j++) nearest = Math.min(nearest, Math.hypot(gems[i].x - gems[j].x, gems[i].y - gems[j].y));
  assert(nearest > GEMS.FIELD_SPACING - 2, `spaced replenishment avoids random crystal piles (${nearest.toFixed(1)} minimum gap)`);
}
{
  const s = new GameState(0); s.botFill = 0;
  for (let i = 0; i < 12; i++) s.gems.set(String(i), new GemSchema(2000, 2000, 2));
  const flight = new GemSchema(1000, 1000); flight.launch(1000, 1000, 0, 1000, NOW, 1, true); s.gems.set('airborne', flight);
  const falling = new GemSchema(3000, 3000); falling.drop(NOW); s.gems.set('falling', falling);
  const sum = [...s.gems.values()].reduce((n, gem) => n + gem.value, 0);
  for (let i = 0; i < 120; i++) {
    if (i % 8 === 0) spreadSettledGems(s);
    for (const [id, gem] of s.gems) if (id !== 'airborne' && id !== 'falling') gem.update(1 / 30, s.worldWidth, s.worldHeight, NOW + i * 1000 / 30);
  }
  const spread = [...s.gems.entries()].filter(([id]) => id !== 'airborne' && id !== 'falling').map(([, gem]) => gem);
  assert(spread.every(g => Math.hypot(g.x - 2000, g.y - 2000) > 10), 'settled piles spread naturally rather than sitting on one point');
  assert.equal([...s.gems.values()].reduce((n, gem) => n + gem.value, 0), sum, 'spacing preserves all crystal value and count');
  assert(flight.inFlight() && falling.falling, 'spacing does not cancel flights or falling crystals');
}
console.log('Fan fit and crystal-spacing regressions passed.');
