import assert from 'node:assert/strict';
import { createPracticeArena } from '../practice/arena.js';
import { PracticeController } from '../practice/PracticeController.js';
import { fireCaptive, exhale } from '../systems/inhale.js';
import { deployWeapon } from '../systems/weapons.js';
import type { PracticeLesson } from '../practice/definitions.js';

function setup(lesson: PracticeLesson) {
  const s = createPracticeArena(); let now = 100_000;
  const p = s.addPlayer('learner', 'Learner', now);
  const c = new PracticeController(s);
  const events: { type: string; data: Record<string, unknown> }[] = [];
  s.onEvent = (type, data) => { events.push({ type, data }); c.observe(type, data, now); };
  c.attach(p.sessionId, lesson, now);
  const step = (ms = 17) => { now += ms; c.beforeTick(now); s.update(ms / 1000, now); c.afterTick(now); };
  const until = (predicate: () => boolean, max = 600) => { for (let i = 0; i < max && !predicate(); i++) step(); if (!predicate()) console.log({p: {x:p.x,y:p.y,gems:p.gems,state:p.state},gems:[...s.gems.values()].map(g=>({x:g.x,y:g.y,value:g.value})),view:s.practice.toJSON()}); assert(predicate(), `Timed out: ${lesson}/${s.practice.stage}/${s.practice.phase}`); };
  return { s, p, c, events, step, until, now: () => now };
}
{
  const { s, p, c, step, until, now, events } = setup('basics');
  p.steer(1, 0); until(() => s.practice.phase === 'success'); p.steer(0, 0);
  until(() => s.practice.stage === 'capture');
  p.startInhale(now()); until(() => s.practice.phase === 'success');
  assert(p.gulping, 'healthy smaller opponent is actual ammunition');
  until(() => s.practice.stage === 'shoot');
  let target = s.players.get(s.practice.targetId); assert(target);
  assert(p.width < target.width, 'learner starts smaller than the main rival');
  assert(!fireCaptive(s, p, now()), 'capture requires release before firing');
  p.stopInhale(now()); p.captureNeedsRelease = false;
  const miss = s.practice.attempt;
  p.facing = Math.PI / 2; assert(fireCaptive(s, p, now()));
  until(() => s.practice.attempt > miss);
  assert.equal(s.practice.stage, 'shoot'); assert.equal(s.practice.passed, 2);
  assert(p.gulping, 'a missed shot restores ammunition without repeating growth or capture');
  target = s.players.get(s.practice.targetId); assert(target); p.facing = 0;
  assert(fireCaptive(s, p, now()));
  until(() => s.practice.stage === 'finish');
  assert.equal(target.state, 'alive'); assert(target.injuredUntil > s.time);
  // Ordinary walking and tracking inhale steal gems, grow the smaller learner and finish at mouth.
  p.startInhale(now());
  for (let i = 0; i < 450 && s.practice.phase !== 'success'; i++) {
    const dx = target.x + target.width / 2 - p.x - p.width / 2, dy = target.y + target.height / 2 - p.y - p.height / 2;
    const d = Math.hypot(dx, dy); if(!p.inhaling) p.startInhale(now()); p.aimAt(dx, dy); p.steer(dx / Math.max(1,d), dy / Math.max(1,d)); step();
  }
  if(s.practice.phase !== 'success') console.log({p:{x:p.x,y:p.y,gems:p.gems,inhale:p.inhaling,blocked:p.breathingBlocked,stun:p.stunned},target:{x:target.x,y:target.y,gems:target.gems,state:target.state,injured:target.injuredUntil},stage:s.practice.stage,attempt:s.practice.attempt,events:events.map(e=>[e.type,e.data.how,e.data.targetId])});
  assert.equal(s.practice.phase, 'success', 'normal damage, drain/growth and mouth eligibility suffice');
  assert(events.some(e => e.type === 'combatReward' && e.data.how === 'mouth'));
  until(() => s.practice.phase === 'complete');
  const attempt = s.practice.attempt; c.observe('capture', { byId: p.sessionId, targetId: target.sessionId }, now(), attempt - 1);
  assert.equal(s.practice.phase, 'complete');
  c.select('basics', true, now()); assert.equal(s.practice.stage, 'grow'); assert.equal(s.practice.passed, 0);
}
{
  const { s, p, c, until, now } = setup('blackhole');
  const attempt = s.practice.attempt;
  p.facing = Math.PI / 2; assert(fireCaptive(s, p, now()));
  until(() => s.practice.attempt > attempt); assert.equal(s.practice.failures, 1); assert(p.gulping);
  c.observe('combatReward', { byId: p.sessionId, targetId: 'old-ammo', how: 'blackhole' }, now(), attempt);
  assert.equal(s.practice.phase, 'waiting');
  p.facing = 0; assert(fireCaptive(s, p, now()));
  until(() => s.practice.phase === 'complete');
}
{
  const { s, p, until } = setup('weapon');
  assert.equal(s.pinwheel.parts.length, 3);
  for (const part of [...s.pinwheel.parts]) {
    if (!part) continue;
    p.placeAt(part.x - p.width / 2, part.y - p.height / 2); until(() => part.carriedBy === p.sessionId || s.pinwheel.phase === 'carried');
  }
  until(() => s.practice.stage === 'place'); assert.equal(s.pinwheel.phase, 'carried');
  assert(deployWeapon(s, p)); until(() => s.practice.phase === 'complete');
}
{
  const { s, p, c, until, now } = setup('weapon');
  for (const part of [...s.pinwheel.parts]) {
    if (!part) continue;
    p.placeAt(part.x - p.width / 2, part.y - p.height / 2);
    until(() => part.carriedBy === p.sessionId || s.pinwheel.phase === 'carried');
  }
  until(() => s.practice.stage === 'place');
  const before = s.practice.attempt;
  c.observe('weaponPlaced', { byId: p.sessionId }, now(), before - 1);
  assert.equal(s.practice.phase, 'waiting', 'old placement cannot advance the lesson');
  assert(deployWeapon(s, p)); until(() => s.practice.stage === 'effect');
  s.players.delete(s.practice.targetId); // A lost target restores only the already-reached effect step.
  until(() => s.practice.attempt > before + 1);
  assert.equal(s.practice.stage, 'effect'); assert.equal(s.practice.passed, 2);
  assert.equal(s.practice.failures, 1); assert.equal(s.pinwheel.phase, 'charging');
  until(() => s.practice.phase === 'complete');
  c.select('basics', false, now()); assert.equal(s.practice.passed, 0);
  c.select('weapon', true, now()); assert.equal(s.practice.stage, 'collect');
}
{
  const { s, p, c, step, until, now, events } = setup('defense');
  exhale(s, p, now()); until(() => s.practice.failures === 1 && s.practice.phase === 'waiting');
  until(() => s.practice.cue === 'attacking');
  p.facing = 0; exhale(s, p, now()); step();
  until(() => s.practice.phase === 'complete');
  assert(events.some(e => e.type === 'parry' && e.data.id === p.sessionId));
  c.select('weapon', false, now()); c.skip(s.practice.attempt, now());
  assert.equal(s.practice.phase, 'choosing'); assert(!s.practice.completed.includes('weapon'));
  c.observe('parry', { id: p.sessionId, targetId: s.practice.targetId }, now());
  assert.equal(s.practice.phase, 'choosing', 'duplicate completion cannot finish another lesson');
  c.select('blackhole', false, now());
  assert(!c.shouldClose(now())); assert(c.shouldClose(now() + 600_001));
}
console.log('Practice: actual capture/release/hit/theft/mouth finish, assembly/placement/effect, black-hole reward, defensive parry, retries, stale events, skip and replay passed.');

{
  const { s, p, c, step, now } = setup('basics');
  c.startSequence(now());
  for (let i = 0; i < 3000; i++) {
    const v = s.practice;
    if (v.lesson === 'defense' && v.phase === 'complete') break;
    p.steer(0, 0);
    if (v.phase === 'waiting') {
      if (v.lesson === 'basics') {
        if (v.stage === 'grow') p.steer(1, 0);
        else if (v.stage === 'capture') { if (!p.inhaling) p.startInhale(now()); }
        else if (v.stage === 'shoot') { p.stopInhale(now()); p.captureNeedsRelease = false; p.facing = 0; if (p.gulping) fireCaptive(s, p, now()); }
        else {
          const target = s.players.get(v.targetId); assert(target);
          const dx = target.x + target.width / 2 - p.x - p.width / 2, dy = target.y + target.height / 2 - p.y - p.height / 2, d = Math.hypot(dx, dy);
          if (!p.inhaling) p.startInhale(now()); p.aimAt(dx, dy);
          if (d > 210) p.steer(dx / d, dy / d);
        }
      } else if (v.lesson === 'weapon') {
        if (v.stage === 'collect') { const part = s.pinwheel.parts.find(part => part.carriedBy !== p.sessionId); if (part) p.placeAt(part.x - p.width / 2, part.y - p.height / 2); }
        else if (v.stage === 'place') deployWeapon(s, p);
      } else if (v.lesson === 'blackhole' && p.gulping) fireCaptive(s, p, now());
      else if (v.lesson === 'defense' && v.cue === 'attacking') exhale(s, p, now());
    }
    step();
  }
  assert.equal(s.practice.lesson, 'defense'); assert.equal(s.practice.phase, 'complete'); assert(s.practice.sequence);
  assert.equal(s.practice.completed.split(',').length, 4, 'only actual success automatically advances the whole tutorial');
  c.startSequence(now()); c.skip(s.practice.attempt, now());
  assert.equal(s.practice.lesson, 'weapon'); assert.equal(s.practice.completed, '', 'a sequence skip advances without certifying the skipped lesson');
  c.select('blackhole', false, now()); assert(!s.practice.sequence, 'individual lessons remain available outside the automatic sequence');
}
console.log('Full tutorial: all four actual successes automatically advance in order; skip stays unfinished and individual selection stays unlocked.');
