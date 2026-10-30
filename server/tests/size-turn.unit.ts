import assert from 'node:assert/strict';
import { ARENA_RULES, GEMS, WORLD } from '../constants/gameConstants.js';
import { turnAccel, turnRate, turnStep } from '../game/movement.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';

const maxWidth = Math.min(WORLD.WIDTH, WORLD.HEIGHT) * GEMS.SIZE_MAX_SHARE;
for (let width = ARENA_RULES.PLAYER_SIZE + .5; width <= maxWidth; width += .5) {
  assert(turnAccel(width) < turnAccel(width - .5), 'larger bodies accelerate their turn more slowly');
  for (const inhaling of [false, true]) {
    assert(turnRate(width, inhaling) < turnRate(width - .5, inhaling), 'every larger legal size has a lower rotation limit');
  }
  assert(turnRate(width, true) < turnRate(width, false), 'an active inhale has a stricter rotation limit');
}

function halfTurn(width: number, inhaling: boolean): number {
  let facing = 0, spin = 0;
  for (let tick = 1; tick <= 1200; tick++) {
    ({ facing, spin } = turnStep(facing, spin, Math.PI, width, inhaling, 1 / 120));
    if (Math.abs(Math.atan2(Math.sin(Math.PI - facing), Math.cos(Math.PI - facing))) < .01 && Math.abs(spin) < .02) return tick / 120;
  }
  throw new Error('A normal half-turn did not settle');
}
for (const inhaling of [false, true]) {
  let previous = 0;
  for (const width of [20, 100, 200, 400, 600, 1200]) {
    const seconds = halfTurn(width, inhaling);
    assert(seconds > previous, 'actual half-turns, including acceleration/braking, take longer at larger sizes');
    previous = seconds;
  }
}

// A fast small-body spin must respect the new state on this very frame, in either direction.
for (const sign of [-1, 1]) for (const dt of [0, 1 / 120, 1 / 30, .1]) {
  for (const [width, inhaling, oldSpin] of [
    [1200, false, turnRate(20)],
    [600, true, turnRate(600)],
  ] as const) for (const target of [null, sign * Math.PI, -sign * Math.PI / 2]) {
    const next = turnStep(0, sign * oldSpin, target, width, inhaling, dt);
    assert(Math.abs(next.spin) <= turnRate(width, inhaling) + 1e-12,
      'growth, inhale, release and reversal cannot carry spin above the current limit');
    assert(Math.abs(next.facing) <= turnRate(width, inhaling) * dt + 1e-12,
      'the facing itself cannot turn faster than the current limit');
  }
}

// Loaded aim and an active inhale use the same predicted turn as authoritative human/bot bodies.
for (const bot of [false, true]) for (const mode of ['walk', 'loaded', 'inhale'] as const) {
  const p = new PlayerSchema('turner', 0); p.isBot = bot;
  p.setGems(4768, WORLD.WIDTH, WORLD.HEIGHT); p.placeAt(1500, 1500); p.facing = 0;
  p.spin = turnRate(20); // an already spinning player just gained size
  if (mode === 'inhale') p.startInhale(100000);
  if (mode === 'loaded') p.gulping = 'held-ammo';
  if (mode === 'walk') p.steer(0, 1); else p.aimAt(0, 1);
  let predicted = { facing: p.facing, spin: p.spin };
  for (let tick = 1; tick <= 90; tick++) {
    predicted = turnStep(predicted.facing, predicted.spin, Math.PI / 2, p.width, mode === 'inhale', 1 / 30);
    p.updateMovement(WORLD.WIDTH, WORLD.HEIGHT, 100000 + tick * 1000 / 30, 1 / 30);
    assert(Math.abs(p.facing - predicted.facing) < 1e-12 && Math.abs(p.spin - predicted.spin) < 1e-12,
      'prediction, loaded aiming, inhale and both actor types share the same bounded rotation');
  }
}
console.log('Size turning passed: slower larger bodies, measured half-turns, immediate state limits, both directions, loaded aim and prediction/bot parity.');
