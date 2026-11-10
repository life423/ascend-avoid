import assert from 'node:assert/strict';
import { chooseSpawn, hasEscapeRoutes, SPAWN_RETRY_MS } from '../game/spawnSafety.js';
import { GameState } from '../schema/GameState.js';
import { GemSchema } from '../schema/GemSchema.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { balanceBots } from '../systems/bots.js';
import { clearanceAt } from '../systems/turbines.js';
import { WORLD } from '../constants/gameConstants.js';
const NOW=100000;
const s=new GameState(0);s.botFill=0;s.weaponsOn=true;s.surgesOn=false;s.setTurbines('off');s.obstacles.clear();s.comets.clear();s.balls.clear();
const self=s.addPlayer('newborn','Newborn',NOW),enemy=s.addPlayer('enemy','Enemy',NOW);enemy.placeAt(100,100);
const w=s.pinwheel;w.owner=enemy.sessionId;w.kind='pulsar';w.phase='active';w.x=w.y=2100;w.at=20000;
assert(clearanceAt(s,2100,2100,self,enemy)<0,'wave radius is an unsafe respawn area');
assert(clearanceAt(s,850,850,self,enemy)>WORLD.SPAWN_CLEARANCE,'an open corner remains available');
w.phase='charging';assert(clearanceAt(s,2200,2100,self,enemy)<0,'charging weapons count too');
w.kind='sentinel';w.phase='active';w.originX=w.x;w.originY=w.y;w.activatedAt=s.time;
assert(clearanceAt(s,2100,2100,self,enemy)<0,'moving satellites and their next positions are considered');
w.kind='pinwheel';w.x=w.y=3500;const bolt=new WeaponBoltSchema();bolt.x=1000;bolt.y=1800;bolt.angle=0;w.bolts.set('incoming',bolt);
assert(clearanceAt(s,1300,1800,self,enemy)<0,'incoming projectile paths count, even far from the weapon');
w.bolts.clear();w.kind='pulsar';w.x=w.y=2100;
const random=Math.random;Math.random=()=>.15;
try{s.spawn(self,NOW);}finally{Math.random=random;}
assert(clearanceAt(s,self.x+self.width/2,self.y+self.height/2,self,enemy)>WORLD.SPAWN_CLEARANCE,'spawn selects a genuinely clear candidate');
self.updateMovement(4200,4200,NOW+3000,0);assert(self.spawnProtected,'a new run has four seconds to move clear');
self.updateMovement(4200,4200,NOW+4001,0);assert(!self.spawnProtected);

const ESTABLISHED = 5 * 60 * 1000;
const OPENING = { x: 2100, y: 2100 };

function fixedRandom<T>(run: () => T, value = .5): T {
  const original = Math.random;
  Math.random = () => value;
  try { return run(); }
  finally { Math.random = original; }
}

function newcomerArena(age: number): GameState {
  const state = new GameState(0);
  state.botFill = 0;
  state.weaponsOn = state.surgesOn = false;
  state.setTurbines('off');
  state.blackHoles.clear();
  state.obstacles.clear();
  state.comets.clear();
  state.balls.clear();
  state.update(0, NOW);
  const peer = fixedRandom(() => state.addPlayer('peer', 'Peer', NOW));
  peer.placeAt(1400 - peer.width / 2, 2100 - peer.height / 2);
  peer.dropProtection();
  const leader = fixedRandom(() => state.addPlayer('leader', 'Leader', NOW));
  leader.resetGems(2000, state.worldWidth, state.worldHeight);
  leader.placeAt(3300 - leader.width / 2, 3300 - leader.height / 2);
  leader.facing = Math.PI / 4;
  leader.dropProtection();
  state.update(0, NOW + age);
  for (const [index, [dx, dy]] of [[-40, -30], [15, -10], [-20, 40], [50, 30]].entries()) {
    state.gems.set(`opening-${index}`, new GemSchema(OPENING.x + dx, OPENING.y + dy));
  }
  return state;
}

const location = (player: PlayerSchema) => ({ x: player.x, y: player.y });
const centre = (spot: { x: number; y: number }, player: PlayerSchema) => ({
  x: spot.x + player.width / 2,
  y: spot.y + player.height / 2,
});
function assertSafeSpawn(state: GameState, player: PlayerSchema, spot: { x: number; y: number }): void {
  const point = centre(spot, player);
  assert(clearanceAt(state, point.x, point.y, player, state.leader()) >= WORLD.SPAWN_CLEARANCE);
  assert(hasEscapeRoutes(state, player, spot.x, spot.y));
}

{
  const state = newcomerArena(ESTABLISHED);
  const player = new PlayerSchema('probe', 2);
  const safest = fixedRandom(() => chooseSpawn(state, player));
  const opening = fixedRandom(() => chooseSpawn(state, player, true));
  assert(safest && opening);
  assert.notDeepEqual(opening, safest, 'a useful safe opening can outrank maximum distance');
  assert.deepEqual(centre(opening, player), OPENING, 'prefer ordinary gems and a nearby peer');
  assertSafeSpawn(state, player, opening);

  const floor = state.isFloorAt.bind(state);
  state.isFloorAt = (x, y) => {
    const distance = Math.hypot(x - OPENING.x, y - OPENING.y);
    return floor(x, y) && (distance < 40 || distance > 300);
  };
  const alternative = fixedRandom(() => chooseSpawn(state, player, true));
  assert(alternative);
  assert.notDeepEqual(alternative, opening, 'opening gems cannot override blocked exits');
  assertSafeSpawn(state, player, alternative);
  state.isFloorAt = floor;

  state.gems.forEach(gem => gem.drop(NOW));
  state.removePlayer('peer');
  assert.deepEqual(fixedRandom(() => chooseSpawn(state, player, true)), fixedRandom(() => chooseSpawn(state, player)),
    'without a reachable peer, falling gems provide no reason to change the safest fallback');
  state.isFloorAt = () => false;
  assert.equal(fixedRandom(() => chooseSpawn(state, player, true)), null,
    'without a safe spawn, leave the player waiting');
}

{
  const state = newcomerArena(ESTABLISHED);
  const player = new PlayerSchema('probe', 2);
  const giant = state.players.get('leader');
  assert(giant);
  giant.resetGems(5000, state.worldWidth, state.worldHeight);
  giant.placeAt(800 - giant.width / 2, 2100 - giant.height / 2);
  giant.facing = Math.PI;
  const opening = fixedRandom(() => chooseSpawn(state, player, true));
  assert(opening);
  assert.deepEqual(centre(opening, player), OPENING);

  giant.facing = 0;
  assertSafeSpawn(state, player, opening);
  const alternative = fixedRandom(() => chooseSpawn(state, player, true));
  assert(alternative);
  assert.notDeepEqual(alternative, opening, 'an idle giant facing the useful spot makes it a poor opening');
  assertSafeSpawn(state, player, alternative);
}

for (const age of [ESTABLISHED - 1, ESTABLISHED]) {
  const state = newcomerArena(age);
  const now = NOW + age;
  const newcomer = fixedRandom(() => state.addPlayer('newcomer', 'Newcomer', now));
  const safest = fixedRandom(() => chooseSpawn(state, newcomer));
  assert(safest);
  assertSafeSpawn(state, newcomer, location(newcomer));
  assert(newcomer.spawnProtected);
  if (age < ESTABLISHED) {
    assert.deepEqual(location(newcomer), safest, 'young rooms keep ordinary first spawns');
    continue;
  }

  assert.deepEqual(centre(newcomer, newcomer), OPENING, 'an established room offers a newcomer the useful safe spot');
  newcomer.knockOut(now);
  fixedRandom(() => state.update(0, newcomer.respawnAt));
  assert.deepEqual(location(newcomer), safest, 'a later respawn returns to safest placement');
  assert(newcomer.spawnProtected);

  state.botFill = 4;
  fixedRandom(() => balanceBots(state, state.now));
  const bot = [...state.players.values()].find(player => player.isBot);
  assert(bot);
  assert.deepEqual(location(bot), fixedRandom(() => chooseSpawn(state, bot)),
    'automatic bot additions use the ordinary safest placement');
  assert(bot.spawnProtected);
}

{
  const state = newcomerArena(ESTABLISHED);
  const now = NOW + ESTABLISHED;
  state.players.forEach(player => player.knockOut(now));
  const probe = new PlayerSchema('probe', 2);
  const safest = fixedRandom(() => chooseSpawn(state, probe), .15);
  const opening = fixedRandom(() => chooseSpawn(state, probe, true), .15);
  assert(safest && opening);
  assert.notDeepEqual(opening, safest, 'the gem cluster would otherwise change the spawn');
  const newcomer = fixedRandom(() => state.addPlayer('alone', 'Alone', now), .15);
  assert.deepEqual(location(newcomer), safest, 'an established room with no live rival keeps the ordinary spawn');
}

{
  const state = newcomerArena(ESTABLISHED);
  const now = NOW + ESTABLISHED;
  const floor = state.isFloorAt.bind(state);
  state.isFloorAt = () => false;
  const newcomer = fixedRandom(() => state.addPlayer('waiting', 'Waiting', now));
  assert.equal(newcomer.state, 'spawning');
  state.isFloorAt = floor;
  fixedRandom(() => state.update(0, now + SPAWN_RETRY_MS - 1));
  assert.equal(newcomer.state, 'spawning');
  fixedRandom(() => state.update(0, now + SPAWN_RETRY_MS));
  assert.equal(newcomer.state, 'alive');
  assert.deepEqual(centre(newcomer, newcomer), OPENING, 'a delayed first spawn keeps its opening preference');
  assert(newcomer.spawnProtected);
}

console.log('Spawn safety passed for weapon danger, two exits, established-room openings, fallback, retry and protection.');
