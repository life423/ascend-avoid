import type { GameState } from "../schema/GameState.js";
import { CoreSchema } from "../schema/CoreSchema.js";
import { airflowOnCore, bodyMass, impactStunMs, stepCore } from "../game/corePhysics.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { PLAYER_STATE, CORE } = GAME_CONSTANTS;

/**
 * Cores: every inhaling creature's airflow adds its force (no owner: two pulling at once is a
 * tug-of-war), then each moves, bounces off the others, and runs into players: a soft push, or a
 * stun if it hits hard enough (no gems lost). Kept stocked, away from players, turbines and each other.
 */
export function updateCores(state: GameState, now: number, deltaTime: number) : void {
  if (state.cores.length < state.coreCount) {
    const spot = coreSpot(state);
    if (spot) state.cores.push(new CoreSchema(`c${state.nextCoreId++}`, spot.x, spot.y, CORE.RADIUS));
  }
  state.cores.forEach((core) => {
    let ax = 0;
    let ay = 0;
    state.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE || player.stunned) return;
      const moving = player.velocity();
      const pull = airflowOnCore({ x: player.x + player.width / 2, y: player.y + player.height / 2, width: player.width, facing: player.facing, inhaling: player.inhaling, vx: moving.x, vy: moving.y }, core);
      ax += pull.ax;
      ay += pull.ay;
    });
    stepCore(core, ax, ay, deltaTime, state.worldWidth, state.worldHeight);
  });
  // Cores bounce off each other
  for (let i = 0; i < state.cores.length; i++) {
    for (let j = i + 1; j < state.cores.length; j++) {
      const a = state.cores[i];
      const b = state.cores[j];
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const overlap = a.radius + b.radius - d;
      if (overlap <= 0 || d < 1e-6) continue;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= (nx * overlap) / 2;
      a.y -= (ny * overlap) / 2;
      b.x += (nx * overlap) / 2;
      b.y += (ny * overlap) / 2;
      const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
      if (closing <= 0) continue;
      const change = (closing * (1 + CORE.CORE_RESTITUTION)) / 2;
      a.vx -= nx * change;
      a.vy -= ny * change;
      b.vx += nx * change;
      b.vy += ny * change;
    }
  }
  state.cores.forEach((core) => coreMeetsPlayers(state, core, now));
}

/** A Core running into players: they're pushed apart by mass, it loses some speed, and a hard enough hit stuns */
export function coreMeetsPlayers(state: GameState, core: CoreSchema, now: number) : void {
  state.players.forEach((player) => {
    const id = player.sessionId;
    if (player.state !== PLAYER_STATE.ALIVE) {
      core.touching.delete(id);
      return;
    }
    const dx = core.x - (player.x + player.width / 2);
    const dy = core.y - (player.y + player.height / 2);
    const d = Math.hypot(dx, dy);
    const overlap = player.width / 2 + core.radius - d;
    if (overlap <= -CORE.SEPARATE) {
      core.touching.delete(id);
      return;
    }
    if (overlap <= 0) return;
    const nx = d > 1e-6 ? dx / d : 1;
    const ny = d > 1e-6 ? dy / d : 0;
    // Pushed apart by mass: the lighter one moves more
    const heft = bodyMass(player.width);
    const coreShare = heft / (heft + CORE.MASS);
    core.x += nx * overlap * coreShare;
    core.y += ny * overlap * coreShare;
    player.nudge(-nx * overlap * (1 - coreShare), -ny * overlap * (1 - coreShare), state.worldWidth, state.worldHeight);
    const walking = player.velocity();
    const closing = -((core.vx - walking.x) * nx + (core.vy - walking.y) * ny);
    if (closing > 0) {
      // It bounces off, losing speed, so a single Core can't ricochet through everyone at full strength
      const change = closing * (1 + CORE.IMPACT_BOUNCE) * coreShare;
      core.vx += nx * change;
      core.vy += ny * change;
      // A hard hit stuns; resting against someone never does (it has to come away first), and there's no stun-lock
      const stunMs = impactStunMs(CORE.MASS * closing);
      if (stunMs > 0 && !core.touching.has(id) && now >= player.stunImmuneUntil) player.stun(now, stunMs);
    }
    core.touching.add(id);
  });
}

/** Somewhere for a new Core: away from players, other Cores and turbines (null if nowhere fits) */
export function coreSpot(state: GameState) : { x: number; y: number } | null {
  const margin = 300;
  for (let tries = 0; tries < 40; tries++) {
    const x = margin + Math.random() * (state.worldWidth - margin * 2);
    const y = margin + Math.random() * (state.worldHeight - margin * 2);
    let clear = true;
    state.players.forEach((player) => {
      if (Math.hypot(player.x + player.width / 2 - x, player.y + player.height / 2 - y) < CORE.SPAWN_CLEAR) clear = false;
    });
    state.cores.forEach((core) => {
      if (Math.hypot(core.x - x, core.y - y) < CORE.SPAWN_GAP) clear = false;
    });
    state.turbines.forEach((turbine) => {
      if (Math.hypot(turbine.x - x, turbine.y - y) < CORE.SPAWN_TURBINE_GAP) clear = false;
    });
    if (clear) return { x, y };
  }
  return null;
}
