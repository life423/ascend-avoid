import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { INHALE, EXHALE, WORLD } from '../constants/gameConstants.js';
import { steal, exhale } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';

const NOW = 100000;
function setup() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.setTurbines('off'); s.update(0, NOW);
  const add = (id: string, gems: number, x: number) => {
    const p = s.addPlayer(id, id, NOW); p.setGems(gems, s.worldWidth, s.worldHeight);
    p.placeAt(x, 1000); p.spawnProtected = false; return p;
  };
  const a = add('a', 40, 1000), b = add('b', 40, 1120);
  a.facing = 0; b.facing = Math.PI; a.startInhale(NOW); a.heldFor.set(b.sessionId, 5);
  return { s, a, b, add };
}
{
  const { s, a, b } = setup();
  for (let i = 0; i < 90; i++) { s.time += 33; steal(s, a, NOW + s.time, .033); }
  assert.equal(b.gems, 40, 'healthy creatures cannot lose gems to inhale');
  assert.equal(a.gems, 40); assert.equal(a.robbing, '');
  b.injure(s.time); const until = b.injuredUntil;
  for (let i = 0; i < 10; i++) { s.time += 33; steal(s, a, NOW + s.time, .033); }
  assert(b.gems < 40, 'the same cone can steal after a damaging hit');
  assert.equal(b.injuredUntil, until, 'theft cannot refresh the injury');
  const left = b.gems; s.time = until; steal(s, a, NOW + s.time, 1);
  assert.equal(b.gems, left, 'the seven-second deadline ends theft exactly without refunding lost gems');
  assert(!a.stealShares.has(b.sessionId), 'healing discards unfinished theft progress');
}
{
  const { s, a, b, add } = setup(); const c = add('c', 40, 1000);
  c.facing = 0; c.startInhale(NOW); c.heldFor.set(b.sessionId, 5);
  b.injure(0); const events: Record<string, unknown>[] = [];
  s.onEvent = (type, data) => { if (type === 'credit') events.push(data); };
  for (let i = 0; i < 100 && b.state === 'alive'; i++) {
    s.time += 33; steal(s, a, NOW + s.time, .033); steal(s, c, NOW + s.time, .033);
  }
  assert.equal(b.state, 'dead', 'multiple thieves can finish an injured creature without an allowance');
  assert.equal(b.gems, 0); assert.equal(a.gems + c.gems, 120, 'every stolen gem transfers once');
  assert(events.filter(e => e.how === 'drain' && e.out === true).length === 1, 'the last thief gets one knockout credit');
  assert.equal(b.injuredUntil, 0, 'knockout clears injury');
  assert.equal(b.respawnAt, NOW + s.time + WORLD.RESPAWN_DELAY_MS);
  b.spawnAt(1500, 1500, b.respawnAt);
  assert.equal(b.injuredUntil, 0); assert(b.spawnProtected);
}
{
  const { s, a, b } = setup(); b.injure(0); const until = b.injuredUntil;
  steal(s, a, NOW, .2); const before = b.gems;
  exhale(s, b, NOW);
  assert(a.stunned && !a.inhaling, 'the injured defender can gust an incoming thief');
  assert.equal(a.injuredUntil, 0, 'a defensive gust causes stun, not injury');
  a.placeAt(1000, 1000); b.placeAt(1120, 1000);
  a.updateMovement(s.worldWidth, s.worldHeight, NOW + EXHALE.STUN_MS, .001);
  a.startInhale(NOW + EXHALE.STUN_MS); s.now = NOW + EXHALE.STUN_MS; s.time = EXHALE.STUN_MS;
  steal(s, a, s.now, .2);
  assert.equal(b.gems, before, 'the gust suction shield still blocks injury theft');
  assert.equal(b.injuredUntil, until);
  b.protectFor(1000, NOW); steal(s, a, s.now, 1); assert.equal(b.gems, before, 'spawn protection wins over injury');
  b.injure(2000); assert.equal(b.injuredUntil, until, 'protected hits cannot refresh injury');
}
{
  const { s, a, b } = setup();
  b.setGems(500, s.worldWidth, s.worldHeight); b.placeAt(1220, 1000);
  a.placeAt(a.x, b.y + (b.height - a.height) / 2);
  a.launch(NOW, 1800, 0, 'launcher', 3000);
  updateFlights(s, NOW + 100, .1);
  assert(b.gems < 500 && b.state === 'alive');
  assert.equal(b.injuredUntil, s.time + INHALE.INJURY_MS, 'a surviving missile victim is injured');
}
{
  const { s, b } = setup(); b.injure(0); b.injure(1000);
  assert.equal(b.injuredUntil, 7000, 'another damaging hit cannot extend the fixed seven-second window');
  b.setGems(20, s.worldWidth, s.worldHeight); b.injure(6999);
  assert.equal(b.injuredUntil, 7000); assert.equal(b.injuryGems, 40, 'late hits cannot reset the theft basis');
  b.injure(7000); assert.equal(b.injuredUntil, 14000, 'a hit at expiry opens a new window');
  assert.equal(b.injuryGems, 20, 'a new injury snapshots remaining gems');
  s.time = 14000;
  s.hitPlayer(b, NOW); assert(b.injuredUntil > s.time, 'traffic damage also exposes gems');
}
{
  const { s, a, b } = setup(); b.injure(0);
  const healthy = a.injuredUntil; a.stun(NOW, 500);
  assert.equal(a.injuredUntil, healthy, 'stunning/bumping alone does not open a theft window');
  const speed = b.velocity(); b.steer(1, 0); b.updateMovement(s.worldWidth, s.worldHeight, NOW + 50, .05);
  assert(b.velocity().x > speed.x && !b.stunned && !b.recovering, 'injury adds no movement penalty');
}
console.log('Injury regressions passed: healthy immunity, timed unlimited theft, knockout credit, gust defense, healing and damage.');
