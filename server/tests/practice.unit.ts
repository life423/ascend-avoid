import assert from 'node:assert/strict';
import { createPracticeArena } from '../practice/arena.js';
import { PracticeController } from '../practice/PracticeController.js';
import { fireCaptive, exhale } from '../systems/inhale.js';
import { fireRelicComet } from '../systems/relic.js';
import { deployWeapon } from '../systems/weapons.js';
import { ASTEROID_LESSON, PRACTICE_LESSONS, type PracticeLesson } from '../practice/definitions.js';
import { GEMS, RELIC } from '../constants/gameConstants.js';
import { arenaClearance } from '../game/arenaBoundary.js';

function setup(lesson: PracticeLesson) {
  const s = createPracticeArena(); let now = 100_000;
  s.update(0, now);
  const p = s.addPlayer('learner', 'Learner', now), c = new PracticeController(s);
  const events: { type: string; data: Record<string, unknown> }[] = [];
  s.onEvent = (type, data) => { events.push({ type, data }); c.observe(type, data, now); };
  c.attach(p.sessionId, lesson, now);
  const step = (ms = 17) => { now += ms; c.beforeTick(now); s.update(ms / 1000, now); c.afterTick(now); };
  const until = (condition: () => boolean, max = 900) => {
    for (let i = 0; i < max && !condition(); i++) step();
    assert(condition(), `Timed out: ${s.practice.lesson}/${s.practice.stage}/${s.practice.phase}: ${s.practice.feedback}`);
  };
  let towGoal: { attempt: number; x: number; y: number } | undefined;
  const drive = () => {
    const v = s.practice, t = s.players.get(v.targetId);
    p.steer(0, 0);
    if (v.phase === 'ready') { c.ready(v.attempt, now); return; }
    if (!['waiting', 'resolving'].includes(v.phase)) return;
    const dx = t ? t.x + t.width / 2 - p.x - p.width / 2 : 0;
    const dy = t ? t.y + t.height / 2 - p.y - p.height / 2 : 0;
    const d = Math.hypot(dx, dy);
    if (v.lesson === 'basics') {
      if (v.stage === 'grow') p.steer(1, 0); else if (!p.inhaling) p.startInhale(now);
    } else if (v.lesson === 'combat') {
      p.aimAt(dx, dy);
      if (['shatter', 'wound'].includes(v.stage) && p.gulping) {
        const error = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - p.facing), Math.cos(Math.atan2(dy, dx) - p.facing)));
        if (error < .04) { p.stopInhale(now); p.captureNeedsRelease = false; fireCaptive(s, p, now); }
      } else if (['approach', 'steal', 'finish'].includes(v.stage)) {
        if (v.stage !== 'approach' && !p.inhaling) p.startInhale(now);
        if (v.stage !== 'steal' && d > 1) p.steer(dx / Math.max(1, d), dy / Math.max(1, d));
      }
    } else if (v.lesson === 'defense') {
      p.steer(1, 0);
      if (v.stage === 'rear-cover' && v.cue === 'attacking' && !s.gustWaves.size) exhale(s, p, now);
    } else if (v.lesson === 'blackhole') {
      if (v.stage === 'capture') { if (!p.inhaling) p.startInhale(now); }
      else if (p.gulping) { p.stopInhale(now); p.captureNeedsRelease = false; p.aimAt(1, 0); fireCaptive(s, p, now); }
    } else if (v.lesson === 'asteroid') {
      if (v.stage === 'strike' && p.relicCometReady && t) fireRelicComet(s, p, t.x + t.width / 2, t.y + t.height / 2);
      else if (v.stage === 'hook' || v.stage === 'tow') {
        const r = s.relic;
        if (v.stage === 'tow' && towGoal?.attempt !== v.attempt) {
          const routeX = r.relayX - p.x - p.width / 2, routeY = r.relayY - p.y - p.height / 2, length = Math.max(1, Math.hypot(routeX, routeY));
          const past = p.width / 2 + RELIC.RADIUS + RELIC.TOW_GAP + 50;
          towGoal = { attempt: v.attempt, x: r.relayX + routeX / length * past, y: r.relayY + routeY / length * past };
        }
        const x = v.stage === 'hook' ? r.x : towGoal?.x ?? r.relayX;
        const y = v.stage === 'hook' ? r.y : towGoal?.y ?? r.relayY;
        const dx = x - p.x - p.width / 2, dy = y - p.y - p.height / 2, distance = Math.max(1, Math.hypot(dx, dy));
        if (distance > 10) p.steer(dx / distance * Math.min(1, distance / 30), dy / distance * Math.min(1, distance / 30));
      }
    } else if (v.lesson === 'weapon') {
      if (v.stage === 'collect') {
        const part = s.pinwheel.parts.find(part => part.carriedBy !== p.sessionId);
        if (part) {
          const x = part.x - p.x - p.width / 2, y = part.y - p.y - p.height / 2, length = Math.max(1, Math.hypot(x, y));
          p.steer(x / length, y / length);
        }
      } else if (v.stage === 'place') deployWeapon(s, p);
    }
  };
  const play = (condition: () => boolean, max = 7000) => {
    for (let i = 0; i < max && !condition(); i++) { drive(); step(); }
    assert(condition(), `Play stalled: ${s.practice.lesson}/${s.practice.stage}/${s.practice.phase} ${s.practice.feedback} ${JSON.stringify({player:{x:p.x,y:p.y,gems:p.gems,held:p.gulping},weapon:{enabled:s.weaponsOn,length:s.pinwheel.parts.length,hub:s.pinwheel.parts[0]?.carriedBy,every:s.pinwheel.parts.every(part=>part.carriedBy===p.sessionId),events:events.slice(-3),phase:s.pinwheel.phase,owner:s.pinwheel.owner,progress:s.pinwheel.progress,parts:s.pinwheel.parts.map(part=>({x:part.x,y:part.y,carriedBy:part.carriedBy}))}})}`);
  };
  return { s, p, c, events, step, until, drive, play, now: () => now };
}

{
  const { s, p, c, step, until, play, now } = setup('asteroid');
  const gems = p.gems, width = p.width, attempt = s.practice.attempt;
  assert(width >= RELIC.MIN_WIDTH && !p.relicCometReady, 'private asteroid practice starts large but requires earning the charge');
  assert.equal(s.practice.stage, 'hook'); assert.equal(s.practice.total, 3); assert.equal(s.players.size, 1, 'the strike rival is not present during the haul');
  assert.deepEqual(fireRelicComet(s, p, ASTEROID_LESSON.targetX, ASTEROID_LESSON.targetY), { ok: false, reason: 'not-ready' });
  const relicStart = { x: s.relic.x, y: s.relic.y }, unclaimed = s.relic.expiresAt - s.time;
  for (let i = 0; i < 700; i++) step();
  assert.equal(s.practice.phase, 'ready'); assert.equal(p.gems, gems); assert.equal(p.width, width); assert(!p.relicCometReady);
  assert.deepEqual({ x: s.relic.x, y: s.relic.y }, relicStart);
  assert(Math.abs(s.relic.expiresAt - s.time - unclaimed) <= 1, 'reading preserves the real unclaimed deadline');
  c.ready(attempt, now());
  const relicIdentity = s.relic;
  play(() => s.practice.stage === 'tow');
  assert.equal(s.practice.phase, 'ready'); assert.equal(s.practice.passed, 1); assert.equal(s.relic.phase, 'towed'); assert.equal(s.relic.carrierId, p.sessionId);
  assert.equal(s.relic, relicIdentity, 'the actual relic survives the pickup-to-tow transition'); assert(!p.relicCometReady);
  const hookPose = { x: p.x, y: p.y, width: p.width, gems: p.gems, relicX: s.relic.x, relicY: s.relic.y }, towBudget = s.relic.towEndsAt - s.time;
  for (let i = 0; i < 700; i++) step();
  assert.deepEqual({ x: p.x, y: p.y, width: p.width, gems: p.gems, relicX: s.relic.x, relicY: s.relic.y }, hookPose, 'reading preserves actual body and cargo, with no setup replay or passive delivery');
  assert(Math.abs(s.relic.towEndsAt - s.time - towBudget) <= 1, 'reading pauses the actual carrier budget');
  c.ready(s.practice.attempt, now());
  for (let i = 0; i < 8; i++) { p.startInhale(now()); p.aimAt(Math.cos(i * Math.PI / 4), Math.sin(i * Math.PI / 4)); for (let j = 0; j < 15; j++) step(); }
  p.stopInhale(now());
  assert.deepEqual({ charged: p.relicCometReady, phase: s.relic.phase, stage: s.practice.stage }, { charged: false, phase: 'towed', stage: 'tow' }, 'standing and turning at pickup cannot substitute for crossing the map');
  assert.deepEqual(fireRelicComet(s, p, ASTEROID_LESSON.targetX, ASTEROID_LESSON.targetY), { ok: false, reason: 'not-ready' });
  play(() => s.practice.stage === 'strike');
  assert.equal(s.practice.phase, 'ready'); assert.equal(s.practice.passed, 2); assert(p.relicCometReady, 'only actual shared delivery earns the strike');
  assert(Math.hypot(s.relic.x - relicStart.x, s.relic.y - relicStart.y) > 1500, 'normal steering physically hauled the relic across the map');
  assert(Math.hypot(p.x - hookPose.x, p.y - hookPose.y) > 1500, 'the learner crossed the map rather than just rotating at pickup');
  assert(p.width >= RELIC.MIN_WIDTH, 'ordinary upkeep does not force a growth grind during the haul');
  const strikeGems = p.gems, strikeWidth = p.width, strikePose = { x: p.x, y: p.y }, strikeAttempt = s.practice.attempt;
  for (let i = 0; i < 700; i++) step();
  assert.equal(p.gems, strikeGems); assert.equal(p.width, strikeWidth); assert(p.relicCometReady);
  c.ready(strikeAttempt, now());
  assert.equal(fireRelicComet(s, p, 900, 900).ok, true);
  until(() => s.practice.attempt > strikeAttempt);
  assert.equal(s.practice.stage, 'strike'); assert.equal(s.practice.phase, 'waiting'); assert.equal(s.practice.passed, 2);
  assert.equal(p.gems, strikeGems); assert.deepEqual({ x: p.x, y: p.y }, strikePose); assert(p.relicCometReady);
  assert(s.practice.feedback.includes('missed'), 'a miss restores only the already earned launch checkpoint');
  c.select('basics', false, now());
  assert.deepEqual({ charged: p.relicCometReady, phase: s.relic.phase, strike: s.relicComet.phase, carrier: s.relic.carrierId }, { charged: false, phase: 'disabled', strike: 'idle', carrier: '' }, 'switching lessons clears charge, cargo and strike');
  c.select('asteroid', true, now()); assert.equal(s.practice.stage, 'hook'); assert(!p.relicCometReady); assert.equal(s.practice.passed, 0);
  const r = ASTEROID_LESSON, radius = r.width * GEMS.SIZE_MAX_SHARE / 2, dx = r.relayX - r.relicX, dy = r.relayY - r.relicY, distance = Math.hypot(dx, dy);
  const towOffset = radius + RELIC.RADIUS + RELIC.TOW_GAP;
  assert(distance >= 1500 && arenaClearance(r.relicX, r.relicY, r.width, r.height) >= radius + 20);
  assert(arenaClearance(r.relayX + dx / distance * towOffset, r.relayY + dy / distance * towOffset, r.width, r.height) >= radius + 20, 'the shared largest-body haul corridor has legal walk-past room');
}
{
  const { s, p, c, play, step, until, now } = setup('asteroid');
  play(() => s.practice.stage === 'tow'); c.ready(s.practice.attempt, now());
  const checkpoint = { x: p.x, y: p.y }, attempt = s.practice.attempt;
  p.steer(1, 0); for (let i = 0; i < 30; i++) step();
  s.relic.towEndsAt = s.time;
  until(() => s.practice.attempt > attempt);
  assert.equal(s.practice.stage, 'tow'); assert.equal(s.practice.passed, 1); assert.equal(s.relic.phase, 'towed'); assert.equal(s.relic.carrierId, p.sessionId);
  assert.deepEqual({ x: p.x, y: p.y }, checkpoint, 'tow expiry restores the earned hook checkpoint, not the beginning or a launch charge');
  assert(!p.relicCometReady); assert.equal(s.practice.failures, 1); assert(s.relic.towEndsAt > s.time);
  c.select('weapon', false, now()); assert.equal(s.relic.phase, 'disabled'); assert.equal(s.relic.carrierId, ''); assert.equal(s.relic.towEndsAt, 0);
}
{
  const { s, p, c, play, step, until, now } = setup('asteroid');
  play(() => s.practice.stage === 'tow'); c.ready(s.practice.attempt, now());
  const attempt = s.practice.attempt;
  p.steer(1, 1); for (let i = 0; i < 30; i++) step();
  p.injure(s.time); step();
  assert.equal(s.relic.phase, 'available', 'ordinary injury drops the actual relic through shared rules');
  until(() => s.practice.attempt > attempt);
  assert.equal(s.practice.stage, 'tow'); assert.equal(s.practice.passed, 1); assert.equal(s.relic.phase, 'towed');
  assert(!p.relicCometReady && !p.breathingBlocked, 'a dropped tow restores only its earned hook checkpoint and healthy learner');
}
for (const lesson of PRACTICE_LESSONS) {
  const { s, p, c, play, events, now } = setup(lesson);
  if (lesson === 'defense') {
    const attempt = s.practice.attempt;
    c.ready(attempt - 1, now()); assert.equal(s.practice.phase, 'ready', 'stale readiness cannot start a threat');
  }
  play(() => s.practice.phase === 'complete');
  assert.equal(s.practice.completed, lesson);
  assert.equal(s.practice.failures, 0, `ordinary successful controls need no special rules or retries: ${lesson}/${s.practice.stage} ${s.practice.feedback}`);
  if (lesson === 'combat') {
    assert(events.some(e => e.type === 'combatReward' && e.data.how === 'cannon'));
    assert(events.some(e => e.type === 'combatReward' && e.data.how === 'mouth'));
  }
  if (lesson === 'defense') {
    assert(events.some(e => e.type === 'gustHit' && e.data.id === p.sessionId && e.data.rear === true));
    assert(!p.breathingBlocked && p.injuredUntil <= s.time, 'actual injury expired before completion');
  }
  const attempt = s.practice.attempt;
  c.observe('combatReward', { byId: p.sessionId, how: 'mouth', targetId: s.practice.targetId }, now(), attempt - 1);
  assert.equal(s.practice.phase, 'complete');
  c.select(lesson, true, now()); assert.equal(s.practice.passed, 0, 'replay starts cleanly');
}
{
  const { s, p, c, step, until, now } = setup('combat');
  const ammo = p.gulping, budget = p.gulpEndsAt - s.time, gems = p.gems, attempt = s.practice.attempt;
  assert.equal(s.practice.phase, 'ready');
  for (let i = 0; i < 700; i++) step();
  assert.equal(s.practice.phase, 'ready'); assert.equal(p.gulping, ammo);
  assert.equal(s.players.get(ammo)?.capturedBy, p.sessionId);
  assert.equal(p.gems, gems); assert.equal(s.practice.failures, 0);
  assert(Math.abs(p.gulpEndsAt - s.time - budget) <= 1, 'reading preserves the actual captive and its remaining budget');
  c.ready(attempt - 1, now()); assert.equal(s.practice.phase, 'ready');
  c.ready(attempt, now()); assert.equal(s.practice.phase, 'waiting');
  until(() => s.practice.attempt > attempt);
  assert.equal(s.practice.stage, 'aim'); assert.equal(s.practice.passed, 0);
  assert.equal(s.practice.failures, 1, 'the ordinary hold deadline resumes after Ready');
  assert.equal(s.practice.phase, 'waiting', 'an immediate retry does not require rereading');
}
{
  const { s, p, play, events } = setup('weapon');
  const observe = s.onEvent;
  s.onEvent = (type, data) => {
    observe?.(type, data);
    if (type === 'weaponAssembled' && data.byId === p.sessionId) {
      assert.equal(s.practice.phase, 'success');
      deployWeapon(s, p);
      assert.equal(s.pinwheel.phase, 'charging', 'place the real weapon in the original transition window');
    }
  };
  play(() => s.practice.phase === 'complete');
  assert.equal(s.practice.failures, 0);
  assert.equal(events.filter(event => event.type === 'weaponPlaced').length, 1);
  assert.equal(s.practice.completed, 'weapon', 'early real placement is credited without another press');
}
{
  const { s, p, c, step, until, now } = setup('defense');
  c.ready(s.practice.attempt, now()); until(() => s.practice.cue === 'attacking');
  const attempt = s.practice.attempt;
  p.startInhale(now()); step();
  assert(s.practice.feedback.includes('Release, then tap briefly'));
  assert.equal(s.practice.failures, 0); assert.equal(s.practice.passed, 0);
  p.stopInhale(now()); p.steer(1, 0); exhale(s, p, now()); step();
  assert.equal(s.practice.feedback, '', 'a real puff clears the hold coaching');
  until(() => s.practice.phase === 'success');
  assert.equal(s.practice.attempt, attempt, 'correcting a hold can succeed in the same attempt');
}
{
  const { s, p, play, until, now } = setup('combat');
  play(() => s.practice.stage === 'shatter' && s.practice.phase === 'waiting');
  const attempt = s.practice.attempt;
  p.stopInhale(now()); p.captureNeedsRelease = false; p.facing = Math.PI / 2;
  assert(fireCaptive(s, p, now())); until(() => s.practice.attempt > attempt);
  assert.equal(s.practice.stage, 'shatter'); assert.equal(s.practice.passed, 1);
  const rival = s.players.get(s.practice.targetId); assert(rival);
  const targetAngle = Math.atan2(rival.y + rival.height / 2 - p.y - p.height / 2, rival.x + rival.width / 2 - p.x - p.width / 2);
  assert(p.gulping); assert(Math.abs(p.facing - targetAngle) < .01, 'retry restores the already-proven aim as well as ammunition');
}
{
  const { s, p, c, step, until, now } = setup('defense');
  for (let i = 0; i < 180; i++) step();
  assert.equal(s.practice.phase, 'ready'); assert(!s.players.get(s.practice.targetId)?.inhaling, 'reading time does not trigger a threat');
  c.ready(s.practice.attempt, now()); until(() => s.practice.cue === 'attacking');
  p.steer(1, 0); exhale(s, p, now()); step(100);
  assert.equal(s.practice.phase, 'resolving', 'a valid rear cast is not rejected before the 220ms wrap');
  until(() => s.practice.cue === 'move-clear');
  assert.equal(s.practice.completed, '', 'a rear shove alone does not prove escaping');
  until(() => s.practice.phase === 'success');
  p.steer(0, 0); until(() => s.practice.stage === 'injured-escape');
  assert.equal(s.practice.phase, 'ready'); c.ready(s.practice.attempt, now());
  const injury = p.injuredUntil, breath = p.stamina;
  exhale(s, p, now()); p.startInhale(now()); step();
  assert(!p.inhaling && !s.gustWaves.size && p.stamina === breath, 'injured practice uses the same breathing restrictions');
  assert.equal(s.practice.phase, 'waiting', 'expected injury does not fail the stage');
  for (let i = 0; i < 30; i++) step(); // A real half-second reaction delay before moving.
  p.steer(1, 0); until(() => s.practice.phase === 'complete');
  assert(s.time >= injury);
}
{
  const { s, p, c, step, now } = setup('defense');
  c.ready(s.practice.attempt, now());
  exhale(s, p, now()); step(100);
  assert.equal(s.practice.phase, 'resolving', 'an early wave gets its real wrap/hold interval rather than an instant failure');
  assert.equal(s.practice.passed, 0, 'casting alone cannot certify rear cover');
}
for (const holding of [false, true]) {
  const { s, p, c, until, now } = setup('defense');
  c.ready(s.practice.attempt, now());
  const attempt = s.practice.attempt;
  if (holding) p.startInhale(now());
  until(() => s.practice.attempt > attempt);
  assert.equal(s.practice.stage, 'rear-cover'); assert.equal(s.practice.passed, 0);
  assert.equal(s.practice.failures, 1); assert.equal(s.practice.completed, '');
  assert(!p.inhaling, 'missing the window or holding instead of tapping restores only the attempt and breath');
  assert(s.practice.feedback.includes('quick tap'));
}
{
  const { s, p, c, step, until, now } = setup('blackhole');
  p.startInhale(now()); until(() => s.practice.stage === 'shoot');
  p.stopInhale(now()); p.captureNeedsRelease = false;
  const attempt = s.practice.attempt;
  p.facing = Math.PI / 2; assert(fireCaptive(s, p, now()));
  until(() => s.practice.attempt > attempt);
  assert.equal(s.practice.passed, 1); assert.equal(s.practice.stage, 'shoot'); assert(p.gulping);
  assert.equal(p.gems, 318, 'retry does not farm capture growth'); assert(s.practice.feedback.includes('missed'));
  c.observe('combatReward', { byId: p.sessionId, targetId: 'stale-ammo', how: 'blackhole' }, now(), attempt);
  assert.equal(s.practice.phase, 'waiting');
  p.facing = 0; p.aimAt(1, 0); assert(fireCaptive(s, p, now())); until(() => s.practice.phase === 'success');
  assert.equal(p.gems, 350); step(1000); assert.equal(s.practice.phase, 'success', 'visible return is not cut off');
  until(() => s.practice.phase === 'complete');
}
{
  const { s, p, c, play, step, now } = setup('basics');
  c.startSequence(now());
  let actualCaptive = '';
  for (let i = 0; i < 2500 && s.practice.lesson === 'basics'; i++) {
    if (s.practice.stage === 'capture' && p.gulping) actualCaptive = p.gulping;
    const v = s.practice;
    if (v.phase === 'ready') c.ready(v.attempt, now());
    if (v.phase === 'waiting') { if (v.stage === 'grow') p.steer(1, 0); else p.startInhale(now()); }
    else p.steer(v.phase === 'complete' ? 1 : 0, 0);
    step();
  }
  assert.equal(s.practice.lesson, 'combat'); assert(actualCaptive && p.gulping === actualCaptive, 'the full sequence carries the real captured opponent into aiming');
  assert.deepEqual(p.steering(), { x: 0, y: 0 }, 'reading clears the walking intent inherited from a moving capture');
  play(() => s.practice.lesson === 'asteroid' && s.practice.phase === 'complete');
  assert.deepEqual(s.practice.completed.split(','), [...PRACTICE_LESSONS]);
  c.startSequence(now()); c.skip(s.practice.attempt, now());
  assert.equal(s.practice.lesson, 'combat'); assert.equal(s.practice.completed, '', 'skip remains unfinished');
  c.select('defense', false, now()); assert(!s.practice.sequence);
  c.skip(s.practice.attempt, now()); assert.equal(s.practice.phase, 'choosing');
  assert(c.shouldClose(now() + 60001));
}
{
  const { s, p, c, step, now } = setup('combat');
  c.select('combat', true, now(), true);
  const attempt = s.practice.attempt, ammo = p.gulping, budget = p.gulpEndsAt - s.time;
  assert.equal(s.practice.phase, 'ready');
  c.ready(attempt - 1, now());
  step(7000); assert.equal(s.practice.phase, 'ready', 'no countdown or automatic start advances a prepared lesson');
  assert.equal(p.gulping, ammo); assert(Math.abs(p.gulpEndsAt - s.time - budget) <= 1);
  c.ready(attempt, now()); assert.equal(s.practice.phase, 'waiting', 'Ready starts this attempt');
  assert.equal(s.practice.attempt, attempt);
  c.select('defense', true, now(), true); step(5000);
  assert.equal(s.practice.phase, 'ready');
  assert(!s.players.get(s.practice.targetId)?.inhaling, 'threats remain inactive until Ready');
  c.ready(s.practice.attempt, now()); assert.equal(s.practice.phase, 'waiting');
  c.select('basics', true, now(), true); c.skip(s.practice.attempt, now());
  assert.equal(s.practice.lesson, 'combat'); assert.equal(s.practice.phase, 'ready');
  assert.equal(s.practice.completed, '', 'skipped lessons remain unfinished');
  c.select('defense', true, now()); assert.equal(s.practice.phase, 'ready', 'individual lessons retain manual preparation');
}
console.log('Six practice lessons, honest progress/retries, manual readiness without countdowns, preserved ammunition, stale commands and selectable readiness pass.');
