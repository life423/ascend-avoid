import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { BotBrain } from '../game/bots.js';
import { BotGustDefense } from '../game/botDefense.js';
import { botPreyAvailable } from '../game/botTargets.js';
import { botMouth } from '../systems/bots.js';

const NOW = 100000;
function setup(gems = 40, rivalGems = 40) {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.weaponsOn = false; s.setTurbines('off'); s.update(0, NOW);
  const a = s.addPlayer('bot', 'Bot', NOW), b = s.addPlayer('rival', 'Rival', NOW);
  for (const [p, count, x] of [[a, gems, 1000], [b, rivalGems, 1120]] as const) {
    p.setGems(count, s.worldWidth, s.worldHeight); p.placeAt(x, 1000); p.spawnProtected = false;
  }
  a.isBot = true; a.facing = 0; b.facing = 0;
  return { s, a, b };
}
function withRandom<T>(value: number, work: () => T): T {
  const previous = Math.random; Math.random = () => value;
  try { return work(); } finally { Math.random = previous; }
}
{
  const { s, a, b } = setup();
  assert(!botPreyAvailable(s, a, b, NOW));
  withRandom(0, () => botMouth(s, a, NOW)); assert(!a.inhaling, 'the mouth does not try to rob a healthy uncapturable rival');
  b.injure(s.time);
  withRandom(0, () => botMouth(s, a, NOW)); assert(a.inhaling, 'an injured rival is a valid theft opportunity');
  a.stealingFrom = b.sessionId; s.time = b.injuredUntil;
  botMouth(s, a, NOW + s.time); assert(!a.inhaling, 'the mouth stops wasting breath when its noncapturable victim heals');
}
{
  const { s, a, b } = setup(100, 0);
  assert(botPreyAvailable(s, a, b, NOW), 'healthy smaller creatures remain capturable');
  withRandom(0, () => botMouth(s, a, NOW)); assert(a.inhaling);
  b.spawnProtected = true; assert(!botPreyAvailable(s, a, b, NOW)); b.spawnProtected = false;
  b.flying = true; assert(!botPreyAvailable(s, a, b, NOW)); b.flying = false;
  b.suctionSafeUntil = NOW + 2000; assert(!botPreyAvailable(s, a, b, NOW));
}
{
  const { s, a, b } = setup(); b.injure(0);
  const brain = withRandom(.5, () => new BotBrain()); s.brains.set(a.sessionId, brain);
  withRandom(.5, () => brain.think(a, s, NOW)); assert.equal(brain.victim, b, 'movement and mouth select the same injured rival');
  s.time = b.injuredUntil; withRandom(.5, () => brain.think(a, s, NOW + s.time));
  assert.equal(brain.victim, null, 'movement drops a healed uncapturable target');
  b.injure(s.time); b.injuredUntil = s.time + 100; b.placeAt(1500, 1000);
  withRandom(.5, () => brain.think(a, s, NOW + s.time + 1000));
  assert.equal(brain.victim, null, 'it does not begin a chase that cannot reach the remaining injury window');
}
{
  const { s, a, b } = setup(100, 40); a.injure(0); b.facing = Math.PI; b.startInhale(NOW); b.robbing = a.sessionId;
  const brain = withRandom(.5, () => new BotBrain()); s.brains.set(a.sessionId, brain);
  const move = withRandom(.5, () => brain.think(a, s, NOW));
  assert.equal(brain.victim, null, 'an injured bot does not chase a smaller healthy robber to trade breath');
  assert(move === 'up' || move === 'down', 'it slips sideways out of the incoming cone while preparing defense');
}
{
  const defense = new BotGustDefense(() => .5);
  assert(!defense.ready('attacker', NOW)); assert(!defense.ready('attacker', NOW + 474));
  assert(defense.ready('attacker', NOW + 475), 'reaction is delayed, not instant');
  defense.attempted(NOW + 475); assert(!defense.ready('attacker', NOW + 476));
  defense.ready('', NOW + 500); assert(!defense.ready('new attacker', NOW + 600), 'switching targets requires a new read');
  const misses = new BotGustDefense(() => 1);
  misses.ready('attacker', NOW); assert(!misses.ready('attacker', NOW + 1000), 'bots can miss a defensive opportunity');
}
{
  const { s, a, b } = setup(); a.injure(0); b.facing = Math.PI; b.startInhale(NOW); b.robbing = a.sessionId;
  const brain = withRandom(0, () => new BotBrain()); s.brains.set(a.sessionId, brain);
  const events: string[] = []; s.onEvent = type => events.push(type);
  botMouth(s, a, NOW); assert(!events.includes('exhale'));
  botMouth(s, a, NOW + 299); assert(!events.includes('exhale'));
  botMouth(s, a, NOW + 300);
  assert.equal(events.filter(e => e === 'exhale').length, 0, 'injured bots cannot puff');
  assert(!b.stunned && b.inhaling); assert.equal(a.stamina, 1);
  botMouth(s, a, NOW + 301); assert.equal(events.filter(e => e === 'exhale').length, 0, 'repeated requests stay blocked');
}
{
  const { s, a, b } = setup(); a.injure(0); b.startInhale(NOW); b.robbing = a.sessionId;
  a.facing = Math.PI;
  const brain = withRandom(0, () => new BotBrain()); s.brains.set(a.sessionId, brain);
  botMouth(s, a, NOW); botMouth(s, a, NOW + 300);
  assert.equal(a.facing, Math.PI, 'defense never snaps facing toward a robber'); assert.equal(a.puffReadyAt, 0);
  assert(!a.inhaling, 'injured bots keep movement but cannot start breathing');
  a.stamina = 0; botMouth(s, a, NOW + 301);
  assert.equal(a.puffReadyAt, 0); assert(!a.inhaling, 'insufficient breath cancels the defensive windup');
  a.stamina = 1; a.facing = 0; a.stunned = true; botMouth(s, a, NOW + 4000);
  assert.equal(a.puffReadyAt, 0, 'stunned bots cannot defend');
}
{
  const { s, a, b } = setup(); a.injure(0); b.facing = Math.PI; b.startInhale(NOW);
  const brain = withRandom(0, () => new BotBrain()); s.brains.set(a.sessionId, brain);
  const puffs: Record<string, unknown>[] = []; s.onEvent = (type, data) => { if (type === 'exhale') puffs.push(data); };
  for (let tick = 1; tick <= 25; tick++) withRandom(0, () => s.update(.033, NOW + tick * 33));
  assert(!puffs.some(p => p.id === a.sessionId), 'the world loop enforces injured breathing limits');
  assert.equal(a.exhaleReadyAt, 0, 'blocked puffs spend no cooldown');
}
console.log('Bot injury regressions passed: eligible targets, healing, reachable windows, fallible gust defense and normal action limits.');
