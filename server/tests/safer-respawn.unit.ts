import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { clearanceAt } from '../systems/turbines.js';
import { chooseSpawn, hasEscapeRoutes, SPAWN_RETRY_MS } from '../game/spawnSafety.js';
const NOW = 100000;
function world() {
  const s = new GameState(0);
  s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = false;
  s.blackHoles.clear();
  s.setTurbines('off');
  s.update(0, NOW);
  return s;
}
for (const bot of [false, true]) {
  const s = world(), p = s.addPlayer('spawn', 'Spawn', NOW), enemy = s.addPlayer('enemy', 'Enemy', NOW);
  p.isBot = bot;
  enemy.placeAt(400, 400);
  const random = Math.random;
  Math.random = () => .5;
  try {
    const first = clearanceAt(s, 2100, 2100, p, s.leader());
    assert(s.spawn(p, NOW));
    assert(clearanceAt(s, p.x + p.width / 2, p.y + p.width / 2, p, s.leader()) > first + 100, 'score all candidates rather than stopping at the first adequate spot');
    assert(hasEscapeRoutes(s, p, p.x, p.y));
    assert(p.spawnProtected);
  }
  finally {
    Math.random = random;
  }
}
{
  const s = world(), p = s.addPlayer('waiting', 'Waiting', NOW), isFloor = s.isFloorAt.bind(s);
  p.knockOut(NOW);
  s.isFloorAt = () => false;
  assert.equal(s.spawn(p, NOW + 2000), false);
  assert.equal(p.state, 'dead', 'an unsafe arena never forces a bad respawn');
  const start = s.addPlayer('joining', 'Joining', NOW + 2000);
  assert.equal(start.state, 'spawning', 'an initial join waits without faking a knockout');
  s.isFloorAt = isFloor;
  s.update(.25, NOW + 2000 + SPAWN_RETRY_MS);
  assert.equal(p.state, 'alive');
  assert.equal(start.state, 'alive');
  assert(p.spawnProtected && start.spawnProtected);
}
{
  const s = world(), p = s.addPlayer('routes', 'Routes', NOW), isFloor = s.isFloorAt.bind(s);
  s.isFloorAt = (x, y) => Math.abs(x - 2010) < 55 && Math.abs(y - 2010) < 55;
  assert(!hasEscapeRoutes(s, p, 2000, 2000), 'a clear point boxed into a tiny pocket has no exit');
  assert.equal(chooseSpawn(s, p), null);
  s.isFloorAt = isFloor;
  assert(hasEscapeRoutes(s, p, 2000, 2000));
}
console.log('Safer respawn passed: safest-candidate scoring, separated escape routes, no unsafe fallback, retried initial joins/respawns, protection and bot/player parity.');
