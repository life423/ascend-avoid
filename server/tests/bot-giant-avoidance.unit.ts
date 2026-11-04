import assert from 'node:assert/strict';
import { BOTS, INHALE, EXHALE, TURBINE } from '../constants/gameConstants.js';
import { botCaptureThreat, botSuctionThreat } from '../game/botTargets.js';
import { BotBrain } from '../game/bots.js';
import { creatureSize } from '../game/creatureSize.js';
import { moveSpeed } from '../game/movement.js';
import { GameState } from '../schema/GameState.js';
import { GemSchema } from '../schema/GemSchema.js';
import { TurbineSchema } from '../schema/TurbineSchema.js';
import { updateInhales } from '../systems/inhale.js';
const NOW = 100000, W = 4200;
function stock(width: number) {
  let lo = 0, hi = 1e8;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width) lo = mid + 1; else hi = mid; }
  return lo;
}
function withRandom<T>(fn: () => T): T {
  const previous = Math.random; Math.random = () => .5;
  try { return fn(); } finally { Math.random = previous; }
}
function setup(width = 600, small = 60, facing = 0) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear();
  s.obstacles.clear(); s.balls.clear(); s.comets.clear();
  const giant = s.addPlayer('giant', 'Giant', NOW), bot = s.addPlayer('bot', 'Bot', NOW);
  giant.setGems(stock(width), W, W); bot.setGems(stock(small), W, W); giant.dropProtection(); bot.dropProtection(); bot.isBot = true;
  giant.placeAt(2100 - giant.width / 2, 2100 - giant.height / 2); giant.facing = facing;
  return { s, giant, bot };
}
function place({ giant, bot }: ReturnType<typeof setup>, gap: number, angle = giant.facing) {
  // Measured from the real mouth, using the defender's body edge.
  const mx = giant.x + giant.width / 2 + Math.cos(giant.facing) * giant.width * .3;
  const my = giant.y + giant.height / 2 + Math.sin(giant.facing) * giant.width * .3;
  bot.placeAt(mx + Math.cos(angle) * (gap + bot.width / 2) - bot.width / 2, my + Math.sin(angle) * (gap + bot.width / 2) - bot.height / 2);
}
let geometryCases = 0;
for (const width of [300, 600, 1000]) for (const small of [20, 60, 150]) for (const facing of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  const a = setup(width, small, facing), reach = INHALE.REACH + a.giant.width * INHALE.REACH_PER_SIZE;
  place(a, reach * .9);
  const threat = botCaptureThreat(a.s, a.bot); assert(threat?.player === a.giant);
  assert(!a.giant.inhaling && botSuctionThreat(a.s, a.bot, NOW) === null, 'idle giant is anticipated without inventing active suction');
  if (width >= 600) assert(threat.distance > BOTS.FLEE_RANGE, 'warning covers a giant beyond the former fixed body distance');
  place(a, reach + BOTS.SAFETY_MARGIN - 1); assert(botCaptureThreat(a.s, a.bot), 'existing safety margin warns at the mouth tip, including defender radius');
  place(a, reach + BOTS.SAFETY_MARGIN + 1); assert.equal(botCaptureThreat(a.s, a.bot), null, 'no unbounded awareness beyond actual reach and margin');
  // Far behind is outside the actual cone; the old nearby-body caution still applies close up.
  place(a, reach, facing + Math.PI); assert.equal(botCaptureThreat(a.s, a.bot), null);
  geometryCases++;
}
for (const reason of ['equal size', 'not capturable', 'injured', 'dead', 'captured', 'flying', 'holding captive'] as const) {
  const a = setup(); const reach = INHALE.REACH + a.giant.width * INHALE.REACH_PER_SIZE;
  place(a, reach * .85);
  if (reason === 'equal size') a.bot.setGems(a.giant.gems, W, W);
  if (reason === 'not capturable') a.bot.setGems(stock(a.giant.width / 1.2), W, W);
  if (reason === 'injured') a.giant.injure(a.s.time);
  if (reason === 'dead') a.giant.knockOut(NOW);
  if (reason === 'captured') a.giant.capturedBy = 'other';
  if (reason === 'flying') a.giant.flying = true;
  if (reason === 'holding captive') a.giant.gulping = 'captive';
  assert.equal(botCaptureThreat(a.s, a.bot), null, reason + ' does not invent long-range capture danger');
}
{
  const a = setup(150, 60); a.bot.placeAt(a.giant.x - 350 - a.bot.width, a.giant.y);
  assert(botCaptureThreat(a.s, a.bot), 'smaller threats retain the existing all-direction close warning');
}
{
  const a = setup(); place(a, 1000);
  assert.equal(botCaptureThreat(a.s, a.bot)?.player, a.giant);
  a.giant.facing = Math.PI; assert.equal(botCaptureThreat(a.s, a.bot), null, 'turning away removes long-range cone danger');
  a.giant.facing = 0; a.giant.injure(0); assert.equal(botCaptureThreat(a.s, a.bot), null);
  const until = a.giant.injuredUntil; a.giant.injure(100); assert.equal(a.giant.injuredUntil, until);
  a.s.time = until; assert.equal(botCaptureThreat(a.s, a.bot)?.player, a.giant, 'ordinary injury expiry restores actual threat eligibility');
  a.s.removePlayer(a.giant.sessionId); assert.equal(botCaptureThreat(a.s, a.bot), null, 'disconnect removes danger immediately');
}
{
  const a = setup(); place(a, 1000);
  const nearer = a.s.addPlayer('near', 'Near', NOW); nearer.setGems(stock(150), W, W); nearer.dropProtection(); nearer.placeAt(a.bot.x - 300, a.bot.y);
  assert.equal(botCaptureThreat(a.s, a.bot)?.player, nearer, 'retain nearest-body threat ranking when several mouths qualify');
}
{
  const a = setup(); place(a, 1000); const brain = withRandom(() => new BotBrain()); a.s.brains.set(a.bot.sessionId, brain);
  a.s.gems.set('bait', new GemSchema(a.bot.x - 300, a.bot.y + a.bot.height / 2));
  assert.equal(withRandom(() => brain.think(a.bot, a.s, NOW)), 'right', 'actual AI abandons attractive gems before a healthy giant starts inhaling');
  assert(brain.nextThinkAt > NOW); assert.equal(brain.think(a.bot, a.s, NOW + 1), null, 'new awareness does not bypass reaction cadence');
  a.giant.startInhale(NOW); assert.equal(botSuctionThreat(a.s, a.bot, NOW), a.giant);
  const escape = withRandom(() => brain.think(a.bot, a.s, NOW + 1000));
  assert(escape === 'up' || escape === 'down', 'active suction still uses the existing lateral escape');
  assert.equal(a.bot.stamina, 1); assert.equal(a.bot.suctionSafeUntil, 0);
  assert.equal(EXHALE.BREATH_COST, .75);
  assert(Math.abs(moveSpeed(60) / moveSpeed(600) - Math.pow(10, .25)) < 1e-9, 'same ordinary movement formula');
}
{
  const a = setup(); place(a, 30); a.giant.startInhale(NOW);
  updateInhales(a.s, NOW, 1 / 30);
  assert.equal(a.bot.capturedBy, a.giant.sessionId, 'a bot caught at the mouth remains ordinary capturable ammunition');
}
{
  const a = setup(); place(a, 1000); a.giant.facing = Math.PI;
  for (let i = 0; i < BOTS.DISPERSE_NEIGHBORS; i++) {
    const neighbor = a.s.addPlayer('neighbor' + i, 'Neighbor', NOW);
    neighbor.setGems(a.bot.gems, W, W); neighbor.placeAt(a.bot.x, a.bot.y + (i - 1) * 70);
  }
  const brain = withRandom(() => new BotBrain());
  withRandom(() => brain.think(a.bot, a.s, NOW)); assert(brain.isDisengaging(NOW));
  a.giant.facing = 0;
  assert.equal(withRandom(() => brain.think(a.bot, a.s, NOW + 1000)), 'right');
  assert(!brain.isDisengaging(NOW + 1000), 'new danger interrupts an old crowd-dispersal goal before it walks into the cone');
}
{
  const a = setup(); place(a, 1000);
  const cx = a.bot.x + a.bot.width / 2, cy = a.bot.y + a.bot.height / 2;
  const t = new TurbineSchema('near intake', cx + 200 + TURBINE.BODY_RADIUS, cy, Math.PI, a.s.time); t.phase = 'active'; a.s.turbines.push(t);
  const brain = withRandom(() => new BotBrain());
  assert.equal(withRandom(() => brain.think(a.bot, a.s, NOW)), 'left', 'a closer turbine still wins over a distant capture threat');
}
console.log(`Bot giant avoidance passed: ${geometryCases} size/orientation cases, exact mouth/radius reach, old close caution, facing/state/injury/disconnect, nearest threat, real AI, reaction cadence and retained active-cone escape.`);
