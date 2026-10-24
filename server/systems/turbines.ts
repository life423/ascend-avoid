import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { GemSchema } from "../schema/GemSchema.js";
import { TurbineSchema } from "../schema/TurbineSchema.js";
import { distanceToRect } from "../game/geometry.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { drain } from "./inhale.js";

import { CANNON } from "../constants/gameConstants.js";
import { intakePull } from "../game/turbine.js";

const { GEMS, PLAYER_STATE, TURBINE } = GAME_CONSTANTS;

/**
 * Turbines appear (after a warning) in open spots, run for a minute or so, power down and come
 * back somewhere else. While on, each pulls in loose gems and nearby players, rips gems out of
 * anyone in its inner zone, fires every gem it takes in out of its exhaust, and blows players
 * around with the exhaust's wind.
 */
export function updateTurbines(state: GameState, now: number, deltaTime: number) : void {
  const t = state.time;
  for (let i = state.turbines.length - 1; i >= 0; i--) {
    const turbine = state.turbines[i];
    if (!turbine) continue;
    if (t < turbine.phaseEndsAt) continue;
    if (turbine.phase === "warning") {
      turbine.phase = "active";
      turbine.phaseEndsAt = t + TURBINE.LIFE_MIN_MS + Math.random() * (TURBINE.LIFE_MAX_MS - TURBINE.LIFE_MIN_MS);
    } else if (turbine.phase === "active") {
      turbine.phase = "ending";
      turbine.phaseEndsAt = t + TURBINE.POWER_DOWN_MS;
    } else if (!turbineBusy(state, turbine.id)) {
      // Every gem inside has been fired: it's gone, and another comes somewhere else
      state.turbines.splice(i, 1);
      if (state.turbinesAuto) state.turbineDue.push(t + TURBINE.RESPAWN_MIN_MS + Math.random() * (TURBINE.RESPAWN_MAX_MS - TURBINE.RESPAWN_MIN_MS));
    }
  }
  if (state.turbinesAuto) {
    // The first ones arrive one at a time over the first few seconds
    while (state.turbines.length + state.turbineDue.length < TURBINE.COUNT) state.turbineDue.push(t + Math.random() * 4000);
    for (let i = state.turbineDue.length - 1; i >= 0; i--) {
      if (t < state.turbineDue[i]) continue;
      const spot = state.turbineSpot();
      if (!spot) {
        state.turbineDue[i] = t + 1000;
        continue;
      }
      state.turbineDue.splice(i, 1);
      state.turbines.push(new TurbineSchema(`t${state.nextTurbineId++}`, spot.x, spot.y, spot.intake, t));
    }
  }
  state.turbines.forEach((turbine) => {
    if (turbine.phase === "active") runTurbine(state, turbine, now, deltaTime);
  });
  fireFlights(state, now);
}

/** One tick of a running turbine: its solid body, the intake's pull and grip, and the exhaust's wind */
export function runTurbine(state: GameState, turbine: TurbineSchema, now: number, deltaTime: number) : void {
  const r = TURBINE.BODY_RADIUS;
  const ix = Math.cos(turbine.intake);
  const iy = Math.sin(turbine.intake);
  const mouthX = turbine.x + ix * r;
  const mouthY = turbine.y + iy * r;
  const intakeCos = Math.cos(TURBINE.INTAKE_ARC);
  const out = state.exhaustOf(turbine, state.time);
  const ex = Math.cos(out);
  const ey = Math.sin(out);
  const nozzleX = turbine.x + ex * r;
  const nozzleY = turbine.y + ey * r;
  const windCos = Math.cos(TURBINE.EXHAUST_ARC);
  state.players.forEach((player) => {
    if (player.state !== PLAYER_STATE.ALIVE) return;
    const radius = player.width / 2;
    const px = player.x + radius;
    const py = player.y + radius;
    // The turbine is solid
    const bx = px - turbine.x;
    const by = py - turbine.y;
    const bd = Math.hypot(bx, by);
    if (bd < r + radius && bd > 1e-6) player.nudge((bx / bd) * (r + radius - bd), (by / bd) * (r + radius - bd), state.worldWidth, state.worldHeight);
    if (player.spawnProtected) return;
    // Already flying, or caught in a mouth: the turbine leaves it be
    if (player.flying || player.capturedBy) return;
    // In front of the intake: pulled in, and close up, gems ripped out of you one by one
    const dx = px - mouthX;
    const dy = py - mouthY;
    const d = Math.hypot(dx, dy);
    const gap = Math.max(0, d - radius);
    if (d > 1e-6 && gap < TURBINE.INTAKE_REACH && (dx * ix + dy * iy) / d >= intakeCos) {
      // Pulled in at a share of its own top speed: past the point of no return, nobody outwalks it
      const pull = Math.min(gap, intakePull(player.width, gap) * deltaTime);
      player.nudge((-dx / d) * pull, (-dy / d) * pull, state.worldWidth, state.worldHeight);
      // Reaching the intake: pulled through, losing a share of its gems, and fired out of the exhaust
      if (gap <= TURBINE.THROUGH_GAP) {
        pullThrough(state, turbine, player, mouthX, mouthY, nozzleX, nozzleY, ex, ey, radius, now);
        return;
      }
      if (gap < TURBINE.DANGER_REACH && player.gems > 0) {
        player.turbineStrip += deltaTime * (TURBINE.STRIP_RATE + TURBINE.STRIP_PER_ROOT * Math.sqrt(player.weight()));
        while (player.turbineStrip >= 1 && player.gems > 0) {
          player.turbineStrip -= 1;
          player.setGems(player.gems - 1, state.worldWidth, state.worldHeight);
          // Out of their body, on the side facing the intake
          state.addFlight(turbine, player.sessionId, px - (dx / d) * radius, py - (dy / d) * radius, 1, false, mouthX, mouthY);
        }
        if (player.gems <= 0) {
          // Its last gem: gone
          player.turbineStrip = 0;
          drain(state, player, now);
          return;
        }
      } else {
        player.turbineStrip = 0;
      }
    }
    // In the exhaust's wind: pushed along it, small creatures most
    const wx = px - nozzleX;
    const wy = py - nozzleY;
    const wd = Math.hypot(wx, wy);
    const wgap = Math.max(0, wd - radius);
    if (wd > 1e-6 && wgap < TURBINE.EXHAUST_REACH && (wx * ex + wy * ey) / wd >= windCos) {
      const push = (TURBINE.WIND * (1 - wgap / TURBINE.EXHAUST_REACH) * deltaTime) / Math.pow(player.weight(), TURBINE.WIND_WEIGHT_POWER);
      player.nudge(ex * push, ey * push, state.worldWidth, state.worldHeight);
    }
  });
  // Loose gems in front of the intake are pulled in; any that reach it (or lie under it) go inside
  const taken: string[] = [];
  state.gems.forEach((gem, id) => {
    if (gem.falling || gem.inFlight()) return;
    const dx = gem.x - mouthX;
    const dy = gem.y - mouthY;
    const d = Math.hypot(dx, dy);
    if (d < 20 || Math.hypot(gem.x - turbine.x, gem.y - turbine.y) < r) {
      taken.push(id);
      return;
    }
    if (d > TURBINE.INTAKE_REACH || (dx * ix + dy * iy) / d < intakeCos) return;
    const step = Math.min(d, TURBINE.GEM_PULL * (0.25 + 0.75 * (1 - d / TURBINE.INTAKE_REACH)) * deltaTime);
    gem.moveTo(gem.x - (dx / d) * step, gem.y - (dy / d) * step);
  });
  for (const id of taken) {
    const gem = state.gems.get(id);
    if (!gem) continue;
    state.gems.delete(id);
    state.addFlight(turbine, "", gem.x, gem.y, gem.value, !gem.sprayed, mouthX, mouthY);
  }
}

/** Gems whose time has come fire out of their turbine's exhaust and fly 400-700 units, landing as ordinary gems */
export function fireFlights(state: GameState, now: number) : void {
  const t = state.time;
  const due: string[] = [];
  state.flights.forEach((flight, id) => {
    if (t >= flight.fireAt) due.push(id);
  });
  for (const id of due) {
    const flight = state.flights.get(id);
    if (!flight) continue;
    state.flights.delete(id);
    const turbine = state.turbineById(flight.turbine);
    const gem = new GemSchema(flight.fromX, flight.fromY, flight.value);
    if (turbine) {
      const angle = state.exhaustOf(turbine, flight.fireAt) + (Math.random() * 2 - 1) * TURBINE.EXHAUST_SPREAD;
      const speed = TURBINE.EXHAUST_SPEED_MIN + Math.random() * (TURBINE.EXHAUST_SPEED_MAX - TURBINE.EXHAUST_SPEED_MIN);
      const nozzle = TURBINE.BODY_RADIUS + GEMS.RADIUS;
      gem.launch(turbine.x + Math.cos(angle) * nozzle, turbine.y + Math.sin(angle) * nozzle, angle, speed, now, t, flight.counted);
    } else {
      gem.launch(flight.fromX, flight.fromY, 0, 0, now, t, flight.counted);
    }
    state.gems.set(`g${state.nextGemId++}`, gem);
  }
}

/** Whether gems are still on their way through a turbine */
export function turbineBusy(state: GameState, id: string) : boolean {
  let busy = false;
  state.flights.forEach((flight) => {
    if (flight.turbine === id) busy = true;
  });
  return busy;
}

/** A new floor is coming: turbines that won't stand on it power down now, and come back on it */
export function moveTurbinesOntoFloor(state: GameState) : void {
  for (let i = state.turbines.length - 1; i >= 0; i--) {
    const turbine = state.turbines[i];
    if (!turbine) continue;
    if (state.turbineFits(turbine.x, turbine.y)) continue;
    if (turbine.phase === "warning") {
      state.turbines.splice(i, 1);
      if (state.turbinesAuto) state.turbineDue.push(state.time + 500);
    } else if (turbine.phase === "active") {
      turbine.phase = "ending";
      turbine.phaseEndsAt = state.time + TURBINE.POWER_DOWN_MS;
    }
  }
}

/** How far a point is from the nearest danger: traffic over the next second, other players, the leader */
export function clearanceAt(state: GameState, cx: number, cy: number, self: PlayerSchema, leader: PlayerSchema | null) : number {
  let nearest = Infinity;
  state.obstacles.forEach((o) => {
    for (const t of [0, 0.5, 1]) {
      nearest = Math.min(nearest, distanceToRect(cx, cy, o.x + o.vx * t, o.y + o.vy * t, o.width, o.height));
    }
  });
  state.comets.forEach((comet) => {
    for (const t of [0, 0.5, 1]) {
      nearest = Math.min(nearest, Math.hypot(comet.x + comet.vx * t - cx, comet.y + comet.vy * t - cy) - comet.radius);
    }
  });
  state.balls.forEach((ball) => {
    for (const t of [0, 0.5, 1]) {
      nearest = Math.min(nearest, Math.hypot(ball.x + ball.vx * t - cx, ball.y + ball.vy * t - cy) - ball.radius);
    }
  });
  state.players.forEach((other) => {
    if (other === self || other.state !== PLAYER_STATE.ALIVE) return;
    const distance = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy);
    // Another player 300 units away counts like traffic 150 away; the leader, like traffic 75 away
    nearest = Math.min(nearest, other === leader ? distance / 4 : distance / 2);
  });
  return nearest;
}

/** A creature reached a turbine's intake: a share of its gems fly through on their own, and it's fired out of the exhaust, flying */
function pullThrough(state: GameState, turbine: TurbineSchema, player: PlayerSchema, mouthX: number, mouthY: number, nozzleX: number, nozzleY: number, ex: number, ey: number, radius: number, now: number): void {
  const lost = Math.min(player.gems, Math.max(TURBINE.THROUGH_MIN, Math.round(player.gems * TURBINE.THROUGH_SHARE)));
  if (lost > 0) {
    player.setGems(player.gems - lost, state.worldWidth, state.worldHeight);
    const flights = Math.min(lost, 12);
    for (let i = 0; i < flights; i++) {
      const value = Math.floor(lost / flights) + (i < lost % flights ? 1 : 0);
      state.addFlight(turbine, player.sessionId, mouthX, mouthY, value, false, mouthX, mouthY);
    }
  }
  player.turbineStrip = 0;
  const px = player.x + player.width / 2;
  const py = player.y + player.height / 2;
  player.nudge(nozzleX + ex * (radius + 6) - px, nozzleY + ey * (radius + 6) - py, state.worldWidth, state.worldHeight);
  player.launch(now, ex * TURBINE.EXHAUST_LAUNCH, ey * TURBINE.EXHAUST_LAUNCH, "", CANNON.MAX_MS);
}
