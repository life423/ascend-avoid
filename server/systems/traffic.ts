import type { GameState } from "../schema/GameState.js";
import { ObstacleSchema } from "../schema/ObstacleSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { ARENA_RULES, TRAFFIC } = GAME_CONSTANTS;

/**
 * The traffic cycle: calm, then (every minute or three) a "Traffic incoming" warning, then a wave
 * that streams everything in for TRAFFIC.WAVE_MS before the arena clears again. A wave never
 * runs alongside an arena shift: if one is due soon, the wave waits until it's over.
 */
export function updateTraffic(state: GameState) : void {
  if (!state.trafficOn) return;
  if (state.alwaysTraffic) {
    if (state.trafficWave !== "wave") state.startWave();
    return;
  }
  const t = state.time;
  if (state.trafficWave === "wave" && t >= state.waveAt) {
    state.trafficWave = "calm";
    state.nextWaveAt = t + TRAFFIC.WAVE_GAP_MIN_MS + Math.random() * (TRAFFIC.WAVE_GAP_MAX_MS - TRAFFIC.WAVE_GAP_MIN_MS);
  } else if (state.trafficWave === "calm" && t >= state.nextWaveAt) {
    const clearOfShift =
      state.shiftPhase === "normal" &&
      state.phaseEndsAt - t > TRAFFIC.WAVE_WARNING_MS + TRAFFIC.WAVE_MS + TRAFFIC.WAVE_SHIFT_MARGIN_MS;
    if (clearOfShift) {
      state.trafficWave = "warning";
      state.waveAt = t + TRAFFIC.WAVE_WARNING_MS;
    } else {
      state.nextWaveAt = t + 5000;
    }
  } else if (state.trafficWave === "warning" && t >= state.waveAt) {
    state.startWave();
  }
}

/** Give every traffic lane a new direction and speed */
export function reshuffleLanes(state: GameState) : void {
  state.lanes = [];
  for (let i = 0; i < 2 * TRAFFIC.LANES; i++) {
    state.lanes.push({
      direction: Math.random() < 0.5 ? 1 : -1,
      speed: ARENA_RULES.OBSTACLE_SPEED * (0.8 + Math.random() * 0.4),
    });
  }
}

/**
 * Send an obstacle into a lane where it keeps a fair distance from the rest of the traffic:
 * entering at the lane's edge (or, with `spread`, anywhere along it when the world starts).
 * Returns false if no lane is safe to enter right now.
 */
export function launchObstacle(state: GameState, obstacle: ObstacleSchema, spread: boolean) : boolean {
  const { OBSTACLE_MIN_LENGTH, OBSTACLE_MAX_LENGTH } = ARENA_RULES;
  const laneWidth = state.worldWidth / TRAFFIC.LANES;
  for (let attempt = 0; attempt < 12; attempt++) {
    const lane = Math.floor(Math.random() * state.lanes.length);
    const horizontal = lane < TRAFFIC.LANES;
    const { direction, speed } = state.lanes[lane];
    const length = Math.round(OBSTACLE_MIN_LENGTH + Math.random() * (OBSTACLE_MAX_LENGTH - OBSTACLE_MIN_LENGTH));
    const span = horizontal ? state.worldWidth : state.worldHeight;
    const start = spread ? Math.random() * (span - length) : direction > 0 ? -length : span;
    if (!laneIsClear(state, obstacle, lane, start, length)) continue;
    // Anywhere across the lane's width, so traffic reaches every spot over time
    const across = ((lane % TRAFFIC.LANES) + 0.5) * laneWidth + (Math.random() - 0.5) * (laneWidth - ARENA_RULES.OBSTACLE_THICKNESS);
    obstacle.enter(lane, horizontal, direction, speed, start, length, across);
    return true;
  }
  return false;
}

/**
 * Whether an obstacle spanning `start`..`start + length` along a lane keeps its distance:
 * TRAFFIC.MIN_GAP from others in the same lane, TRAFFIC.STAGGER from those in the lanes beside it
 */
export function laneIsClear(state: GameState, self: ObstacleSchema, lane: number, start: number, length: number) : boolean {
  const horizontal = lane < TRAFFIC.LANES;
  let clear = true;
  state.obstacles.forEach((o) => {
    if (!clear || o === self || o.lane < 0 || (o.lane < TRAFFIC.LANES) !== horizontal) return;
    const apart = Math.abs(o.lane - lane);
    if (apart > 1) return;
    const oStart = horizontal ? o.x : o.y;
    const oLength = horizontal ? o.width : o.height;
    const distance = Math.max(oStart - (start + length), start - (oStart + oLength));
    if (distance < (apart === 0 ? TRAFFIC.MIN_GAP : TRAFFIC.STAGGER)) clear = false;
  });
  return clear;
}
