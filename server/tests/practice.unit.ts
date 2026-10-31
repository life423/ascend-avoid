import assert from 'node:assert/strict';
import { createPracticeArena } from '../practice/arena.js';
import { PracticeController } from '../practice/PracticeController.js';
import { fireCaptive, exhale } from '../systems/inhale.js';
import { deployWeapon } from '../systems/weapons.js';
import { PRACTICE_LESSONS, type PracticeLesson } from '../practice/definitions.js';

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
    assert(condition(), `Play stalled: ${s.practice.lesson}/${s.practice.stage}/${s.practice.phase} ${s.practice.feedback}`);
  };
  return { s, p, c, events, step, until, drive, play, now: () => now };
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
    assert(events.some(e => e.type === 'parry' && e.data.id === p.sessionId));
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
  assert(p.gulping); assert(Math.abs(p.facing + Math.PI / 4) < .01, 'retry restores the already-proven aim as well as ammunition');
}
{
  const { s, p, c, step, until, now } = setup('defense');
  for (let i = 0; i < 180; i++) step();
  assert.equal(s.practice.phase, 'ready'); assert(!s.players.get(s.practice.targetId)?.inhaling, 'reading time does not trigger a threat');
  c.ready(s.practice.attempt, now()); until(() => s.practice.cue === 'attacking');
  p.steer(1, 0); exhale(s, p, now()); step(100);
  assert.equal(s.practice.phase, 'resolving', 'a valid rear cast is not rejected before the 220ms wrap');
  until(() => s.practice.cue === 'move-clear');
  assert.equal(s.practice.completed, '', 'parry alone does not prove escaping');
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
    if (v.phase === 'waiting') { if (v.stage === 'grow') p.steer(1, 0); else p.startInhale(now()); }
    else p.steer(v.phase === 'complete' ? 1 : 0, 0);
    step();
  }
  assert.equal(s.practice.lesson, 'combat'); assert(actualCaptive && p.gulping === actualCaptive, 'the full sequence carries the real captured opponent into aiming');
  assert.deepEqual(p.steering(), { x: 0, y: 0 }, 'reading clears the walking intent inherited from a moving capture');
  play(() => s.practice.lesson === 'weapon' && s.practice.phase === 'complete');
  assert.deepEqual(s.practice.completed.split(','), [...PRACTICE_LESSONS]);
  c.startSequence(now()); c.skip(s.practice.attempt, now());
  assert.equal(s.practice.lesson, 'combat'); assert.equal(s.practice.completed, '', 'skip remains unfinished');
  c.select('defense', false, now()); assert(!s.practice.sequence);
  c.skip(s.practice.attempt, now()); assert.equal(s.practice.phase, 'choosing');
  assert(c.shouldClose(now() + 60001));
}
console.log('Five practice lessons pass through real movement, capture, aiming, shatter, wound/theft/finish, rear cover, injury recovery, black-hole rewards and weapon damage; retries, readiness, stale events, sequence handoff, skip and replay pass.');
