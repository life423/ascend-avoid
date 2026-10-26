import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { escapeSteer } from '../systems/inhale.js';

function captive(keys = 'URDL') {
  const state = new GameState(0), player = state.addPlayer('captive', 'Captive', 100000);
  player.capturedBy = 'captor'; player.escapeKeys = keys; player.dazedUntil = 600;
  state.time = 600;
  const push = (degrees: number, strength = .7) => {
    player.steer(Math.cos(degrees * Math.PI / 180) * strength, Math.sin(degrees * Math.PI / 180) * strength);
    escapeSteer(state, player);
  };
  return { state, player, push };
}

for (const [key, angle] of [['U', -90], ['R', 0], ['D', 90], ['L', 180]] as const) {
  for (const error of [-60, -55, -30, 0, 30, 55, 60]) {
    const { player, push } = captive(key); push(angle + error, .4);
    assert.equal(player.escapeStep, 1, `${key} accepts a moderate push with ${error} degrees of error`);
  }
  for (const error of [-180, -90, -65, 65, 90, 180]) {
    const { player, push } = captive(key); push(angle + error);
    assert.equal(player.escapeStep, 0, 'unrelated directions cannot solve the current arrow');
    assert.equal(player.escapeMissAt, 0, 'correcting a thumb angle does not punish or reset the player');
    push(angle + 55); assert.equal(player.escapeStep, 1, 'correcting without centering still works');
  }
}
{
  const { state, player, push } = captive('URDL');
  state.time = 599; push(-90); assert.equal(player.escapeStep, 0, 'the daze still applies');
  state.time = 600; push(-35); assert.equal(player.escapeStep, 1);
  for (let i = 0; i < 20; i++) push(-35);
  assert.equal(player.escapeStep, 1, 'holding a diagonal cannot also solve the next arrow');
  push(-30); assert.equal(player.escapeStep, 1, 'small jitter cannot count as a second gesture');
  push(0); assert.equal(player.escapeStep, 2, 'a deliberate turn counts without exact centering');
  push(145); assert.equal(player.escapeStep, 3, 'a diagonal down gesture is accepted');
  push(235); assert.equal(player.escapeStep, 4, 'the sequence can be completed with one continuous thumb');
}
{
  const { player, push } = captive('URU');
  push(-90, .39); assert.equal(player.escapeStep, 0, 'tiny movement is not input');
  push(-90, .4); assert.equal(player.escapeStep, 1);
  push(180); assert.equal(player.escapeStep, 1, 'a wrong joystick direction preserves existing progress');
  // Explicitly return to neutral on the same clock before the next press.
  const state = new GameState(0); state.time = 600;
  player.steer(0, 0); escapeSteer(state, player);
  push(0); assert.equal(player.escapeStep, 2, 'the original neutral/flick method remains supported');
}
console.log('Joystick escape: broad angles, moderate pushes, correction, continuous turns, neutral flicks and no hold/jitter repeats pass');
