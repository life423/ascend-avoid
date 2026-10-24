// Measure real bot escape logic in isolated worlds, with no outside hazards or attackers.
const { GameState } = require('../server/dist/schema/GameState.js');
const { updateInhales } = require('../server/dist/systems/inhale.js');
const { botMouth } = require('../server/dist/systems/bots.js');
const { captureLoadMs } = require('../server/dist/game/cannon.js');
const { CANNON } = require('../server/dist/constants/gameConstants.js');
const trials = Number(process.argv[2] || 100);
for (const gems of [16, 60, 300]) {
  let early = 0, escaped = 0, timeout = 0, totalEscape = 0, keys = 0;
  for (let trial = 0; trial < trials; trial++) {
    const state = new GameState(0);
    state.botFill = 0; state.surgesOn = false; state.setTurbines('off');
    const start = 100000;
    state.update(0, start);
    const captor = state.addPlayer('captor', 'Captor', start);
    const kid = state.addPlayer('kid', 'Kid', start);
    captor.setGems(gems, 4200, 4200); kid.setGems(4, 4200, 4200);
    captor.placeAt(1000, 1000); kid.placeAt(1000 + captor.width, 1000 + (captor.height - kid.height) / 2);
    captor.spawnProtected = kid.spawnProtected = false;
    kid.isBot = true; captor.facing = 0;
    captor.startInhale(start); updateInhales(state, start, 1 / 30);
    if (!kid.capturedBy) throw new Error('capture fixture failed');
    keys = kid.escapeKeys.length;
    for (let tick = 1; tick <= 140; tick++) {
      const now = start + tick * 1000 / 30;
      state.update(1 / 30, now);
      botMouth(state, kid, now);
      if (!kid.capturedBy) {
        if (state.time < CANNON.HOLD_MS) {
          escaped++; totalEscape += state.time;
          if (state.time < captureLoadMs(keys)) early++;
        } else timeout++;
        break;
      }
    }
  }
  console.log(JSON.stringify({ captorGems: gems, keys, trials, escapedBeforeShotReady: early, escapedBeforeTimeout: escaped, timedOut: timeout, meanEscapeMs: escaped ? Math.round(totalEscape / escaped) : null }));
}
