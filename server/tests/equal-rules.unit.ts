import assert from 'node:assert/strict';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { GameState } from '../schema/GameState.js';
import { BotBrain } from '../game/bots.js';
import { GemSchema } from '../schema/GemSchema.js';
import { escapePress, updateInhales, updateHolds, exhale } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { spawnWeapon, updateWeapons, deployWeapon } from '../systems/weapons.js';
import { weaponKinds } from '../game/weaponKit.js';
import { CANNON, PINWHEEL } from '../constants/gameConstants.js';

const NOW = 100000;
function empty() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.weaponsOn = false; s.setTurbines('off'); s.update(0, NOW); return s;
}
function add(s: GameState, id: string, bot: boolean, gems: number, x = 1800, y = 2000) {
  const p = s.addPlayer(id, id, NOW); p.isBot = bot; p.setGems(gems, s.worldWidth, s.worldHeight); p.spawnProtected = false; p.placeAt(x, y); return p;
}
function seeded<T>(run: (clock: (elapsed: number) => number) => T): T {
  const random = Math.random, dateNow = Date.now; let seed = 321, now = NOW;
  Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  Date.now = () => now;
  try { return run(elapsed => (now = NOW + elapsed)); }
  finally { Math.random = random; Date.now = dateNow; }
}

for (const gems of [0, 4, 30, 300, 1000, 5000]) {
  const human = new PlayerSchema('human', 0), bot = new PlayerSchema('bot', 1); bot.isBot = true;
  for (const p of [human, bot]) { p.setGems(gems, 4200, 4200); p.placeAt(1800, 1800); }
  assert.equal(bot.width, human.width); assert.equal(bot.weight(), human.weight());
  for (let tick = 1; tick <= 18000; tick++) {
    human.decay(1 / 30, 4200, 4200); bot.decay(1 / 30, 4200, 4200);
    if (tick % 1800 === 0) assert.equal(bot.gems, human.gems, 'ten minutes of decay has no bot-only tax');
  }
  for (const p of [human, bot]) { p.steer(.6, .8); p.startInhale(NOW); p.aimAt(1, 0); }
  for (let tick = 1; tick <= 30; tick++) for (const p of [human, bot]) p.updateMovement(4200, 4200, NOW + tick * 33, .033);
  assert.equal(bot.x, human.x); assert.equal(bot.y, human.y); assert.equal(bot.facing, human.facing);
  assert.equal(bot.stamina, human.stamina, 'movement, turn and breath use are identical under equal input');
}

const captures = [];
for (const role of [false, true]) {
  const s = empty(), captor = add(s, 'captor', role, 60, 1000, 1000), captive = add(s, 'captive', role, 4);
  captive.placeAt(captor.x + captor.width, captor.y + (captor.height - captive.height) / 2);
  captor.facing = 0; captor.startInhale(NOW); seeded(() => updateInhales(s, NOW, 1 / 30));
  assert(captive.capturedBy); captures.push({ length: captive.escapeKeys.length, daze: captive.dazedUntil, ready: captor.fireReadyAt });
  assert.equal(captive.escapeTryAt, 0, 'the capture rule does not schedule different input eligibility for bots');
  const first = captive.escapeKeys[0]; escapePress(s, captive, first); assert.equal(captive.escapeStep, 0, 'both roles wait for the same daze');
  s.time = CANNON.CAPTIVE_STUN_MS; s.now = NOW + s.time;
  for (const key of captive.escapeKeys) escapePress(s, captive, key);
  updateHolds(s, s.now);
  assert(!captive.capturedBy && captive.suctionSafeUntil === s.now + CANNON.ESCAPE_SAFE_MS);
}
assert.deepEqual(captures[0], captures[1], 'puzzle length, daze, loading and escape protection are role invariant');

for (const role of [false, true]) {
  const s = empty(), p = add(s, 'defender', role, 40, 1000, 1000), other = add(s, 'target', !role, 40, 1100, 1000);
  p.facing = 0; exhale(s, p, NOW);
  assert.equal(p.stamina, .65); assert(other.stunned && other.injuredUntil === 0, 'both roles use the same gust cost and stun');
  p.injure(0); assert.equal(p.injuredUntil, 7000);
  const missile = add(s, 'missile', !role, 20, 1300, 1000); p.placeAt(1600, 1000);
  missile.launch(NOW, 1400, 0, other.sessionId, CANNON.FLIGHT_MS);
  for (let tick = 1; tick <= 15 && !missile.flightHit; tick++) updateFlights(s, NOW + tick * 50, .05);
  assert(missile.flightHit && missile.state === 'dead', 'both roles pay the same spent-missile consequence');
}

for (const role of [false, true]) for (const method of ['contact', 'inhale']) {
  const s = empty(); s.weaponsOn = true;
  const p = add(s, 'builder', role, 40); spawnWeapon(s, 2100, 2100, 'pinwheel');
  const part = s.pinwheel.parts[0]; assert(part, `${role}/${method}: spawn creates three weapon components`);
  p.placeAt(part.x - p.width / 2 - (method === 'inhale' ? 100 : 0), part.y - p.height / 2); p.facing = 0;
  if (method === 'inhale') p.startInhale(NOW);
  for (let i = 0; i < 30 && !part.carriedBy; i++) updateWeapons(s, .033, NOW + i * 33);
  assert.equal(part.carriedBy, p.sessionId, `${method}: bots and humans can collect the same physical part`);
  assert.equal(s.pinwheel.claimUntil, s.time + PINWHEEL.CLAIM_MS);
  const rival = add(s, 'rival', !role, 40);
  part.carriedBy = ''; rival.placeAt(part.x - rival.width / 2, part.y - rival.height / 2); p.placeAt(1000, 1000);
  updateWeapons(s, .033, NOW);
  assert.equal(part.carriedBy, '', 'neither role can take a rival-owned part during its claim');
  s.pinwheel.phase = 'carried';
  assert(!deployWeapon(s, rival)); assert(deployWeapon(s, p), 'both roles use the same explicit placement action');
}

for (const gems of [40, 1000, 5000]) {
  const s = empty(), bot = add(s, 'collector', true, gems), brain = new BotBrain();
  s.brains.set(bot.sessionId, brain); s.gems.set('reward', new GemSchema(bot.x + bot.width / 2 + 200, bot.y + bot.height / 2));
  const random = Math.random; Math.random = () => .5;
  try { brain.think(bot, s, NOW); } finally { Math.random = random; }
  assert(brain.heading(), 'large bots keep seeking crystals instead of stopping at 30 gems');
}

for (const kind of weaponKinds) seeded(clock => {
  const s = empty(); s.weaponsOn = true;
  const bot = add(s, 'assembler', true, 40, 1800, 2100); s.brains.set(bot.sessionId, new BotBrain());
  spawnWeapon(s, 2100, 2100, kind);
  let carriedAt = 0, deployedAt = 0;
  for (let tick = 1; tick <= 900 && !deployedAt; tick++) {
    const elapsed = tick * 1000 / 30; s.update(1 / 30, clock(elapsed));
    if (s.pinwheel.phase === 'carried' && !carriedAt) carriedAt = elapsed;
    if (s.pinwheel.phase === 'charging') deployedAt = elapsed;
  }
  assert(carriedAt > 0 && deployedAt > carriedAt + 800, `${kind}: AI gathers all three real parts, carries and then places after reading`);
  assert.equal(s.pinwheel.owner, bot.sessionId);
  s.time = s.pinwheel.at; updateWeapons(s, .033, clock(s.time));
  assert.equal(s.pinwheel.phase, 'active', 'AI-built weapons use ordinary spin-up and activation');
});
console.log('Equal-rule regressions passed: growth/decay, movement/turn/breath, capture/escape, damage, gust, claims, contact/inhale pickup and full AI assembly/placement.');
