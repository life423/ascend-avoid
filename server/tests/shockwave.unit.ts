import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { PINWHEEL, SHOCKWAVE } from '../constants/gameConstants.js';
import { spawnWeapon, deployWeapon, updateWeapons } from '../systems/weapons.js';

const NOW = 100000;
function setup() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.setTurbines('off'); s.time = 1000;
  const owner = s.addPlayer('builder', 'Builder', NOW);
  owner.placeAt(2000, 2000); owner.spawnProtected = false;
  spawnWeapon(s, 2100, 2100, 'drum');
  return { s, w: s.pinwheel, owner };
}
function target(s: GameState, id: string, dx: number, dy = 0, gems = 0) {
  const p = s.addPlayer(id, id, NOW); p.setGems(gems, s.worldWidth, s.worldHeight);
  p.placeAt(s.pinwheel.x + dx - p.width / 2, s.pinwheel.y + dy - p.height / 2); p.spawnProtected = false;
  return p;
}
{
  const { s, w, owner } = setup();
  for (const part of w.parts) { part.owner = part.carriedBy = owner.sessionId; }
  w.owner = owner.sessionId; w.claimUntil = s.time + PINWHEEL.CLAIM_MS;
  updateWeapons(s, 0.01, NOW);
  assert.equal(w.kind, 'drum'); assert.equal(w.phase, 'carried');
  owner.placeAt(2600, 2400); updateWeapons(s, 0.01, NOW);
  assert(w.x > 2500 && w.y > 2300, 'the assembled drum travels with its builder');
  const rival = target(s, 'rival', 500);
  assert(!deployWeapon(s, rival));
  assert(deployWeapon(s, owner)); assert.equal(w.phase, 'charging');
  s.time = w.at; updateWeapons(s, 0.01, NOW);
  assert.equal(w.phase, 'active'); assert.equal(w.pulseAt, 0, 'spin-up still gives a visible windup before the first pulse');
  const near = target(s, 'near', 110), far = target(s, 'far', 600);
  const safe = target(s, 'safe', 100); safe.spawnProtected = true;
  const held = target(s, 'held', 100); held.capturedBy = 'captor';
  const flying = target(s, 'flying', 100); flying.flying = true;
  const huge = target(s, 'huge', 180, 0, 1000);
  const center = target(s, 'center', 0), edge = target(s, 'edge', 409), outside = target(s, 'outside', 425);
  const firstBeat = w.beatAt;
  s.time = firstBeat - 1; updateWeapons(s, 0.01, NOW + s.time);
  assert(!near.sliding && !huge.sliding, 'the warning does not push anyone');
  s.time = firstBeat; updateWeapons(s, 0.001, NOW + s.time);
  assert(center.sliding, 'the initial pulse also pushes someone directly under the drum');
  assert(!near.sliding, 'a distant player is not hit before the ring reaches them');
  s.time += 200; updateWeapons(s, 0.2, NOW + s.time);
  assert(near.sliding && huge.sliding, 'the expanding wave separates both small players and giants');
  assert(near.velocity().x > huge.velocity().x && huge.velocity().x > 0, 'giants resist more but still get a useful shove');
  assert(!near.stunned && near.gems === 0 && huge.gems === 1000, 'pulses do not stun or remove gems');
  assert(!owner.sliding && !far.sliding && !safe.sliding && !held.sliding && !flying.sliding, 'owner, protected, held, flying and out-of-range players are excluded');
  const velocity = near.velocity().x;
  s.time += 10; updateWeapons(s, 0.01, NOW + s.time);
  assert.equal(near.velocity().x, velocity, 'remaining on a wave cannot stack its shove');
  const crossed = target(s, 'crossing', 300);
  s.time += 10; updateWeapons(s, 0.01, NOW + s.time);
  crossed.placeAt(w.x + 45, w.y - crossed.height / 2);
  s.time += 20; updateWeapons(s, 0.02, NOW + s.time);
  assert(crossed.sliding, 'crossing the front between ticks still registers a hit');
  s.time = firstBeat + 880; updateWeapons(s, 0.64, NOW + s.time);
  s.time = firstBeat + 920; updateWeapons(s, 0.04, NOW + s.time);
  assert(edge.sliding && !outside.sliding, 'the final wave segment is swept even when a tick crosses its expiry');
  near.placeAt(near.x, near.y); s.time = firstBeat + SHOCKWAVE.BEAT_MS;
  updateWeapons(s, 0.01, NOW + s.time);
  s.time += 200; updateWeapons(s, 0.2, NOW + s.time);
  assert(near.sliding, 'a later distinct pulse can push the same player again');
  assert.equal(w.bolts.size, 0, 'the drum never fires pinwheel bolts');
  s.time = w.at; updateWeapons(s, 0.01, NOW + s.time);
  assert.equal(w.phase, 'waiting'); assert.equal(w.kind, 'pinwheel'); assert.equal(w.pulseAt, 0);
  s.time = w.at; updateWeapons(s, 0.01, NOW + s.time);
  assert.equal(w.phase, 'parts'); assert.equal(w.kind, 'pinwheel', 'the next assembly is the existing Pinwheel');
}
{
  const { s, w, owner } = setup();
  w.owner = owner.sessionId; w.phase = 'active'; w.at = s.time + SHOCKWAVE.ACTIVE_MS; w.beatAt = s.time + 700;
  let beats = 0, previous = 0;
  const end = w.at;
  while (s.time < end) {
    s.time += 20; updateWeapons(s, 0.02, NOW + s.time);
    if (w.pulseAt && w.pulseAt !== previous) { beats++; previous = w.pulseAt; }
  }
  assert.equal(beats, 4, 'the short deployment produces four readable pulses');
}
{
  const { s, w, owner } = setup();
  w.owner = owner.sessionId; w.phase = 'active'; w.pulseAt = s.time; w.beatAt = s.time + 2200;
  s.players.delete(owner.sessionId); updateWeapons(s, 0.02, NOW);
  assert.equal(w.phase, 'waiting'); assert.equal(w.pulseAt, 0, 'disconnect removes an active drum and its wave');
}
console.log('Shockwave regressions passed: carry/place, windup, swept waves, four pulses, exclusions, no stacking, rotation and cleanup.');
