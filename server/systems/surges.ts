import type { GameState } from "../schema/GameState.js";
import { GemSchema } from "../schema/GemSchema.js";
import { GEMS, SURGE } from "../constants/gameConstants.js";
import { updateJackpot } from "./gems.js";
import type { TurbineSchema } from "../schema/TurbineSchema.js";

/** Announce a fixed contest location, preferably beside a turbine's exhaust. */
export function beginSurge(state: GameState): void {
  const people = [...state.players.values()].filter(p => p.state === "alive");
  const center = people.length ? {
    x: people.reduce((sum, p) => sum + p.x + p.width / 2, 0) / people.length,
    y: people.reduce((sum, p) => sum + p.y + p.height / 2, 0) / people.length,
  } : { x: state.worldWidth / 2, y: state.worldHeight / 2 };
  const turbines = [...state.turbines].filter((t): t is TurbineSchema => !!t && t.phase === "active");
  turbines.sort((a, b) => Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y));
  const turbine = turbines[0];
  const angle = turbine ? state.exhaustOf(turbine, state.time) : 0;
  const clamp = (v: number, max: number) => Math.max(300, Math.min(max - 300, v));
  state.surgeX = Math.round(clamp(turbine ? turbine.x + Math.cos(angle) * 500 : center.x, state.worldWidth));
  state.surgeY = Math.round(clamp(turbine ? turbine.y + Math.sin(angle) * 500 : center.y, state.worldHeight));
  state.surgePhase = "warning";
  state.surgeAt = state.time + SURGE.WARNING_MS;
  state.surgeJackpotDropped = false;
  state.onEvent?.("surge", { phase: "warning", x: state.surgeX, y: state.surgeY });
}

export function updateSurges(state: GameState, dt: number, now: number): void {
  if (!state.surgesOn) return;
  // Experimental shifts own the jackpot while enabled; never run two contests over each other.
  if (state.shiftsOn) {
    state.surgePhase = "waiting";
    state.surgeAt = state.time + SURGE.GAP_MIN_MS;
    return;
  }
  if (state.surgePhase === "waiting") {
    if (state.time >= state.surgeAt) beginSurge(state);
    return;
  }
  if (state.surgePhase === "warning" && state.time >= state.surgeAt) {
    state.surgePhase = "active";
    state.surgeAt = state.time + SURGE.ACTIVE_MS;
    state.surgeShowerAt = state.time;
    state.onEvent?.("surge", { phase: "active", x: state.surgeX, y: state.surgeY });
  }
  if (state.surgePhase !== "active") return;
  if (state.time >= state.surgeAt) {
    state.surgePhase = "waiting";
    state.surgeAt = state.time + SURGE.GAP_MIN_MS + Math.floor(Math.random() * (SURGE.GAP_MAX_MS - SURGE.GAP_MIN_MS));
    state.jackpotOn = false;
    state.jackpotHolder = "";
    state.jackpotProgress = 0;
    return;
  }
  if (state.time >= state.surgeShowerAt) {
    state.surgeShowerAt = state.time + SURGE.SHOWER_MS;
    for (let i = 0; i < SURGE.PIECES && state.gems.size < GEMS.MAX_GEMS; i++) {
      const angle = Math.random() * Math.PI * 2;
      const reach = Math.sqrt(Math.random()) * SURGE.RADIUS;
      const gem = new GemSchema(state.surgeX + Math.cos(angle) * reach, state.surgeY + Math.sin(angle) * reach, SURGE.VALUE);
      gem.drop(now);
      state.gems.set(`g${state.nextGemId++}`, gem);
    }
  }
  if (!state.surgeJackpotDropped && state.surgeAt - state.time <= SURGE.JACKPOT_WITH_MS_LEFT) {
    state.dropJackpot(state.surgeX, state.surgeY, 0);
    state.surgeJackpotDropped = true;
  }
  updateJackpot(state, dt);
}
