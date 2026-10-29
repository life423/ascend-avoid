import { GameState } from '../schema/GameState.js';
import { PRACTICE_ARENA } from './definitions.js';

/** Production-safe internal configuration; never populated from client-supplied world data. */
export function createPracticeArena(): GameState {
  const state = new GameState(0);
  state.worldWidth = PRACTICE_ARENA.width; state.worldHeight = PRACTICE_ARENA.height;
  state.botFill = 0; state.brains.clear();
  state.obstacles.clear(); state.balls.clear(); state.comets.clear(); state.bombs.clear();
  state.trafficOn = false; state.trafficWave = 'calm'; state.alwaysTraffic = false;
  state.shiftsOn = false; state.surgesOn = false; state.weaponsOn = false;
  state.setTurbines('off'); state.blackHoles.clear(); state.gems.clear(); state.fieldGems = 0;
  state.weaponSets.clear(); state.pinwheel.phase = 'waiting'; state.pinwheel.at = 2_147_483_647;
  state.practice.enabled = true;
  return state;
}
