import assert from 'node:assert/strict';
import { ARENA_RULES, GEMS, WORLD } from '../constants/gameConstants.js';
import { moveSpeed, walk } from '../game/movement.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';

const maximumWidth = Math.min(WORLD.WIDTH, WORLD.HEIGHT) * GEMS.SIZE_MAX_SHARE;
assert.equal(moveSpeed(ARENA_RULES.PLAYER_SIZE), 320, 'newborn movement is preserved');
assert(moveSpeed(maximumWidth) > 110, 'even the largest legal body remains mobile');
for (let width = ARENA_RULES.PLAYER_SIZE + .5; width <= maximumWidth; width += .5) {
  assert(moveSpeed(width) < moveSpeed(width - .5), 'every larger legal half-unit body has a lower maximum speed');
}
for (const small of [20, 60, 100, 200, 400, 600]) {
  assert(moveSpeed(small) > moveSpeed(small * 2) * 1.18, 'half-width prey get a useful speed advantage at every scale');
  assert(moveSpeed(small) > moveSpeed(small * 1.3) * 1.065, 'healthy capture-sized prey can open distance before suction connects');
}

// Exercise the exact prediction helper against authoritative walking, including analog input.
for (const gems of [0, 100, 1000, 5000, 30000]) {
  const player = new PlayerSchema('walker', 0);
  player.setGems(gems, WORLD.WIDTH, WORLD.HEIGHT); player.placeAt(500, 500); player.steer(.6, .8);
  const predicted = { x: player.x, y: player.y, width: player.width, height: player.height };
  const velocity = { x: 0, y: 0 };
  for (let tick = 1; tick <= 90; tick++) {
    walk(predicted, velocity, { x: .6, y: .8 }, 1 / 30, WORLD.WIDTH, WORLD.HEIGHT);
    player.updateMovement(WORLD.WIDTH, WORLD.HEIGHT, 100000 + tick * 1000 / 30, 1 / 30);
    assert(Math.abs(player.x - predicted.x) < 1e-8 && Math.abs(player.y - predicted.y) < 1e-8,
      'client prediction and authoritative walking stay aligned across the size range');
  }
  const before = Math.hypot(player.velocity().x, player.velocity().y);
  player.setGems(100000, WORLD.WIDTH, WORLD.HEIGHT);
  player.updateMovement(WORLD.WIDTH, WORLD.HEIGHT, 103001, 0);
  assert(Math.hypot(player.velocity().x, player.velocity().y) <= moveSpeed(player.width) + 1e-9,
    'gaining size immediately removes excess walking velocity');
  assert(moveSpeed(player.width) < before);
}

// Illustrative shrink only: this does not implement or assume a new missile damage rule.
function travel(gems: number): number {
  const player = new PlayerSchema('escape', 0);
  player.setGems(4768, WORLD.WIDTH, WORLD.HEIGHT); // a 600-wide body
  player.placeAt(500, 500); player.setGems(gems, WORLD.WIDTH, WORLD.HEIGHT); player.steer(1, 0);
  const start = player.x;
  for (let tick = 1; tick <= 210; tick++) player.updateMovement(WORLD.WIDTH, WORLD.HEIGHT, 100000 + tick * 1000 / 30, 1 / 30);
  return player.x - start;
}
assert(travel(3195) - travel(4768) > 40,
  'a 600-wide peer shrinking to about 505 opens over 40 extra units in seven seconds of unobstructed walking');
console.log('Size speed passed: distinct legal sizes, useful escape margins, mobile giants, prediction parity, analog movement and growth/shrink response.');
