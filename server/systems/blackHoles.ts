import type { GameState } from '../schema/GameState.js';
import { BLACK_HOLE } from '../constants/gameConstants.js';
import { blackHoleSpotClear, findBlackHoleSpot } from '../game/blackHolePlacement.js';

/** One transition per tick: even a long pause cannot skip a visible warning. */
export function updateBlackHoles(state: GameState): void {
  for (const hole of state.blackHoles) {
    if (!hole.cycling) {
      if (hole.phase === 'warning' && state.time >= hole.activeAt) hole.phase = 'active';
      continue; // tutorial and explicitly placed test landmarks stay fixed
    }
    if (state.time < hole.at) continue;
    if (hole.phase === 'active') {
      hole.lastCorePosition = { x: hole.x, y: hole.y };
      hole.phase = 'closing'; hole.at = state.time + BLACK_HOLE.CLOSING_MS;
    } else if (hole.phase === 'closing') {
      hole.phase = 'dormant'; hole.at = state.time + BLACK_HOLE.DORMANT_MS;
    } else if (hole.phase === 'warning') {
      if (!blackHoleSpotClear(state, hole, hole.x, hole.y) || !state.isFloorAt(hole.x, hole.y)) {
        // The warning was harmless. Do not emerge underneath a late entrant.
        hole.phase = 'dormant'; hole.at = state.time + BLACK_HOLE.RETRY_MS;
      } else {
        hole.phase = 'active'; hole.activeAt = state.time;
        hole.at = state.time + BLACK_HOLE.ACTIVE_MS + hole.firstStagger;
        hole.firstStagger = 0;
      }
    } else {
      const spot = findBlackHoleSpot(state, hole);
      if (!spot) { hole.at = state.time + BLACK_HOLE.RETRY_MS; continue; }
      // Coordinates change only after the old core and rim have disappeared.
      hole.x = spot.x; hole.y = spot.y; hole.generation++;
      hole.phase = 'warning'; hole.activeAt = hole.at = state.time + BLACK_HOLE.WARNING_MS;
    }
  }
}
