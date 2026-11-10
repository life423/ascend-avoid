import assert from 'node:assert/strict';
import { BOTS, CANNON, RELIC, WEAPON_SHOTS } from '../constants/gameConstants.js';
import { arenaContains } from '../game/arenaBoundary.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
import { GameState } from '../schema/GameState.js';
import { BotBrain } from '../game/bots.js';
import { cannonTargetAppeal, leaderShotOpportunity } from '../game/botAim.js';
import { BotRelicDodge } from '../game/botRelic.js';
import { botPreyAvailable } from '../game/botTargets.js';
import { viewShort } from '../game/camera.js';
import { launchSpeed } from '../game/cannon.js';
import { botMouth } from '../systems/bots.js';
import { updateInhales } from '../systems/inhale.js';
import { enableRelic, fireRelicComet } from '../systems/relic.js';

const now = 100_000;
function opening() {
  const state = new GameState(0); state.botFill = 0; state.time = 0; state.now = now;
  state.weaponsOn = state.surgesOn = false; state.setTurbines('off'); state.blackHoles.clear();
  const rival = state.addPlayer('rival', 'Rival', now), leader = state.addPlayer('leader', 'Leader', now), ammo = state.addPlayer('ammo', 'Ammo', now);
  rival.setGems(3000, 4200, 4200); leader.setGems(30_000, 4200, 4200); ammo.setGems(40, 4200, 4200);
  rival.placeAt(1000, 1600); rival.facing = 0;
  leader.placeAt(rival.x + rival.width + 40, rival.y + (rival.width - leader.width) / 2); leader.facing = Math.PI;
  ammo.placeAt(rival.x - 80, rival.y);
  for (const p of [rival, leader, ammo]) p.dropProtection();
  leader.injure(0);
  return { state, rival, leader, ammo };
}
const oldRandom = Math.random;
try {
  Math.random = () => .5;
  const { state, rival, leader } = opening();
  const brain = new BotBrain(); state.brains.set(rival.sessionId, brain);
  const direction = brain.think(rival, state, now);
  assert.equal(brain.victim, leader, 'an actual injury can be pursued even when the leader is much wider');
  assert.equal(direction, 'right', 'injured opponents do not provoke the obsolete healthy-giant flee/flank behavior');
  Math.random = () => 0;
  botMouth(state, rival, now); assert(rival.inhaling);
  const before = leader.gems; updateInhales(state, now, .1);
  assert(leader.gems < before, 'ordinary frontal theft works while the injured leader cannot counter-inhale');
  assert(rival.gems > 3000);
  rival.injure(0); assert(!botPreyAvailable(state, rival, leader, now), 'an injured attacker obeys the same breathing lock');
} finally { Math.random = oldRandom; }
assert(cannonTargetAppeal(10_000, 600, 400, 1250, 500, 600) > cannonTargetAppeal(1, 20, 400, 1250, 200, 600), 'substantial peer opening beats another trivial knockout');
assert(cannonTargetAppeal(12, 40, 20, 1250, 400, 70) > cannonTargetAppeal(10_000, 600, 20, 1250, 200, 70), 'tiny ammunition does not pretend to threaten a giant');

function loadedRival() {
  const state = new GameState(0);
  state.botFill = 0;
  state.time = 0;
  state.now = now;
  state.blackHoles.clear();
  const rival = state.addPlayer('rival', 'Rival', now);
  const leader = state.addPlayer('leader', 'Leader', now);
  const ammo = state.addPlayer('ammo', 'Ammo', now);
  const small = state.addPlayer('small', 'Small', now);
  rival.setGems(500, state.worldWidth, state.worldHeight);
  leader.setGems(1400, state.worldWidth, state.worldHeight);
  rival.placeAt(1400, 1600);
  rival.facing = 0;
  const placeLeader = (distance: number) => leader.placeAt(rival.x + (rival.width - leader.width) / 2,
    rival.y + (rival.height - leader.height) / 2 - distance);
  placeLeader(500);
  ammo.placeAt(rival.x + rival.width, rival.y + (rival.height - ammo.height) / 2);
  small.placeAt(rival.x + rival.width / 2 + 500 - small.width / 2, rival.y + (rival.height - small.height) / 2);
  for (const p of [rival, leader, ammo, small]) p.dropProtection();
  rival.startInhale(now);
  updateInhales(state, now, 1 / 30);
  assert.equal(rival.gulping, ammo.sessionId);
  return { state, rival, leader, ammo, small, placeLeader };
}

{
  const { state, rival, leader, small } = loadedRival();
  assert(rival.width / leader.width > .60 && rival.width / leader.width < .65);
  const oldAppeal = (target: typeof leader) => cannonTargetAppeal(target.gems, target.width, CANNON.BULLET_SIZE,
    launchSpeed(rival.width), 500, rival.width);
  assert(oldAppeal(small) > oldAppeal(leader), 'the ordinary fallback prefers the easy knockout');
  assert.equal(leaderShotOpportunity(state, rival, now)?.id, leader.sessionId,
    'a fresh meaningful shot is possible outside the old near-peer preference');
}

{
  const { state, rival, leader, placeLeader } = loadedRival();
  rival.resetGems(23, state.worldWidth, state.worldHeight);
  leader.resetGems(305, state.worldWidth, state.worldHeight);
  placeLeader(200);
  assert.equal(leaderShotOpportunity(state, rival, now)?.id, leader.sessionId);
  placeLeader(370);
  assert(370 < viewShort(rival.width) / 2);
  assert.equal(leaderShotOpportunity(state, rival, now), null, 'flight drag can put the delivered hit below the injury threshold');
}

{
  const { state, rival, leader } = loadedRival();
  const core = new BlackHoleSchema(rival.x + rival.width / 2, rival.y + rival.height / 2 - 230);
  state.blackHoles.push(core);
  assert.equal(leaderShotOpportunity(state, rival, now), null, 'a live core blocks the direct shot');
  core.phase = 'warning';
  assert.equal(leaderShotOpportunity(state, rival, now)?.id, leader.sessionId, 'a harmless warning does not block the shot');
}

for (const invalid of ['weak', 'injured', 'protected', 'immune', 'offscreen', 'expired', 'unloaded'] as const) {
  const { state, rival, leader, placeLeader } = loadedRival();
  let at = now;
  switch (invalid) {
    case 'weak':
      rival.resetGems(10, state.worldWidth, state.worldHeight);
      assert(500 < viewShort(rival.width) / 2 + leader.width / 2, 'the weak matchup remains visible');
      break;
    case 'injured': leader.injure(state.time); break;
    case 'protected': leader.protectFor(1000, now); break;
    case 'immune': leader.impactImmuneUntil = now + 1; break;
    case 'offscreen':
      assert(950 > viewShort(rival.width) / 2 + leader.width / 2);
      assert(950 - (rival.width + leader.width) / 2 < BOTS.FIRE_RANGE);
      placeLeader(950);
      break;
    case 'expired': state.time = 3501; at += state.time; break;
    case 'unloaded': rival.gulping = ''; break;
  }
  state.now = at;
  assert.equal(leaderShotOpportunity(state, rival, at), null, invalid);
}

for (const preferLeader of [true, false]) {
  Math.random = () => .5;
  try {
    const { state, rival, leader, ammo, small } = loadedRival();
    if (!preferLeader) leader.protectFor(5000, now);
    rival.isBot = true;
    const brain = new BotBrain();
    state.brains.set(rival.sessionId, brain);
    const target = preferLeader ? leader : small;
    let firedAt = 0;
    for (let ms = 0; ms < 3500; ms += 25) {
      state.time = ms;
      state.now = now + ms;
      botMouth(state, rival, state.now);
      if (ms < BOTS.FIRE_READ_MS) assert.equal(brain.cannonAim.targetId, null);
      if (ms >= BOTS.FIRE_READ_MS) assert.equal(brain.cannonAim.targetId, target.sessionId);
      if (ammo.flying) { firedAt = ms; break; }
      rival.updateMovement(state.worldWidth, state.worldHeight, state.now, .025);
    }
    assert(firedAt >= BOTS.FIRE_MIN_CAPTURE_MS, 'opportunity selection still observes and settles normal aim');
    const angle = Math.atan2(ammo.flightVy, ammo.flightVx);
    assert(Math.abs(angle - (preferLeader ? -Math.PI / 2 : 0)) < .4, 'the shot follows the turned mouth');
  } finally { Math.random = oldRandom; }
}

function cometArena(x: number, y: number, gems: number) {
  const state = new GameState(0);
  state.botFill = 0;
  state.surgesOn = state.weaponsOn = state.trafficHits = false;
  state.setTurbines('off');
  state.blackHoles.clear();
  state.update(0, now);
  enableRelic(state);
  const shooter = state.addPlayer('shooter', 'Shooter', now);
  shooter.placeAt(3480, 3280);
  shooter.dropProtection();
  shooter.relicCometReady = true;
  const bot = state.addPlayer('bot', 'Bot', now);
  bot.isBot = true;
  bot.resetGems(gems, state.worldWidth, state.worldHeight);
  bot.dropProtection();
  bot.placeAt(x - bot.width / 2, y - bot.height / 2);
  state.brains.set(bot.sessionId, new BotBrain());
  return { state, bot, shooter };
}

{
  const { state, bot, shooter } = cometArena(2400, 2100, 1000);
  const dodge = new BotRelicDodge(() => 0);
  assert.equal(dodge.move(bot, state, now), undefined, 'an idle relic is no warning');
  assert(fireRelicComet(state, shooter, 2100, 2100).ok);
  assert.equal(dodge.move(bot, state, now), undefined, 'no instant reaction to a newly inbound comet');
  state.time = WEAPON_SHOTS.BOT_REACT_MIN_MS - 1;
  assert.equal(dodge.move(bot, state, now + state.time), undefined);
  state.time++;
  assert(dodge.move(bot, state, now + state.time)?.x === 1, 'ordinary open escape heads out of the warning');
  state.blackHoles.push(new BlackHoleSchema(2700, 2100));
  const around = dodge.move(bot, state, now + state.time);
  assert(around && Math.abs(around.y) > .5, 'an active rim diverts the escape off its blocked radial route');
  bot.launchSafeUntil = state.relicComet.impactAt + 1;
  assert.equal(dodge.move(bot, state, now + state.time), undefined, 'protection through impact needs no dodge');
  bot.launchSafeUntil = 0;
  state.relicComet.ownerId = bot.sessionId;
  assert.equal(dodge.move(bot, state, now + state.time), undefined, 'the caster can ignore their own strike');
  state.relicComet.ownerId = shooter.sessionId;
  state.relicComet.phase = 'impact';
  assert.equal(dodge.move(bot, state, now + state.time), undefined, 'an expired warning does not keep steering the bot');
}

for (const { x, y, gems, shockwave } of [
  { x: 2100, y: 2100, gems: 1000, shockwave: false },
  { x: 743, y: 743, gems: 2_000_000, shockwave: true },
]) {
  Math.random = () => .5;
  try {
    const { state, bot, shooter } = cometArena(x, y, gems);
    assert(fireRelicComet(state, shooter, x, y).ok);
    const dt = 1 / 30;
    for (let tick = 1; state.relicComet.phase === 'inbound'; tick++) {
      assert(tick <= Math.ceil(RELIC.WARNING_MS / (1000 * dt)) + 1);
      state.update(dt, now + tick * 1000 * dt);
      assert(arenaContains(bot, state.worldWidth, state.worldHeight));
    }
    assert.equal(bot.injuredUntil, 0, 'ordinary bot controls avoid the damage core');
    assert(Math.hypot(bot.x + bot.width / 2 - x, bot.y + bot.width / 2 - y) > RELIC.INNER_RADIUS);
    assert.equal(Math.hypot(bot.puffVx, bot.puffVy) > 0, shockwave, 'a giant may still be reached by the harmless outer shove');
  } finally { Math.random = oldRandom; }
}

console.log('Bot rivalry passed for shot opportunity, fallback, normal aim, injured-leader theft and public comet evasion.');
