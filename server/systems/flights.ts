import type { GameState } from "../schema/GameState.js";
import type { PlayerSchema } from "../schema/PlayerSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { CANNON } from "../constants/gameConstants.js";
import { flightStep, impactGems } from "../game/cannon.js";
import { sprayGems } from "./gems.js";

const { PLAYER_STATE } = GAME_CONSTANTS;

/**
 * Flying creatures (launched out of a captor's mouth, or a turbine's exhaust) fly on, slowing and
 * steering a little; one that hits another creature knocks gems loose from it (more than a normal
 * attack would: a giant spills the most), both bounce, the target is briefly stunned, and the flier
 * survives to grab what spilled. Also frees captives whose captor is gone.
 */
export function updateFlights(state: GameState, now: number, deltaTime: number): void {
  const everyone: PlayerSchema[] = [];
  state.players.forEach((player) => everyone.push(player));
  for (const player of everyone) {
    if (player.capturedBy) {
      const captor = state.players.get(player.capturedBy);
      if (!captor || captor.gulping !== player.sessionId || captor.state !== PLAYER_STATE.ALIVE || player.state !== PLAYER_STATE.ALIVE) {
        player.capturedBy = "";
        player.struggle = 0;
      }
    }
    if (!player.flying) continue;
    if (player.state !== PLAYER_STATE.ALIVE) {
      player.land();
      continue;
    }
    const steer = player.steerInput();
    const next = flightStep(player.flightVx, player.flightVy, steer.x, steer.y, deltaTime);
    player.flightVx = next.vx;
    player.flightVy = next.vy;
    const speed = Math.hypot(next.vx, next.vy);
    const fromX = player.x;
    const fromY = player.y;
    player.nudge(next.vx * deltaTime, next.vy * deltaTime, state.worldWidth, state.worldHeight);
    // Stopped by the edge of the world
    if (Math.hypot(player.x - fromX, player.y - fromY) < speed * deltaTime * 0.5) {
      land(player, now);
      continue;
    }
    const target = player.flightHit ? null : struck(everyone, player, now);
    if (target) impact(state, player, target, speed, now);
    else if (speed < CANNON.STOP_SPEED || now >= player.flightEndsAt) land(player, now);
  }
}

/** The creature a flier has just flown into, if any */
function struck(everyone: PlayerSchema[], flier: PlayerSchema, now: number): PlayerSchema | null {
  const fx = flier.x + flier.width / 2;
  const fy = flier.y + flier.height / 2;
  for (const other of everyone) {
    if (other === flier || other.state !== PLAYER_STATE.ALIVE || other.flying || other.capturedBy || now < other.impactImmuneUntil) continue;
    if (other.sessionId === flier.launchedBy && now - flier.flightStartedAt < CANNON.LAUNCHER_GRACE_MS) continue;
    const ox = other.x + other.width / 2;
    const oy = other.y + other.height / 2;
    if (Math.hypot(ox - fx, oy - fy) < (other.width + flier.width) / 2) return other;
  }
  return null;
}

/** A flier hits a creature: gems knocked loose, the target stunned and shoved, the flier bouncing back off it */
function impact(state: GameState, flier: PlayerSchema, target: PlayerSchema, speed: number, now: number): void {
  const ux = flier.flightVx / speed;
  const uy = flier.flightVy / speed;
  const spill = target.spawnProtected ? 0 : impactGems(target.gems, speed, flier.width);
  if (spill > 0) {
    target.setGems(target.gems - spill, state.worldWidth, state.worldHeight);
    sprayGems(state, target.x + target.width / 2, target.y + target.height / 2, spill, now, target.sessionId);
  }
  // The heavier the target than the flier, the less it's knocked back
  target.skid(ux, uy, CANNON.TARGET_SHOVE * Math.max(0.15, Math.min(1, flier.weight() / Math.max(1, target.weight()))));
  target.impactImmuneUntil = now + CANNON.IMPACT_IMMUNE_MS;
  flier.flightHit = true;
  if (!target.spawnProtected && now >= target.stunImmuneUntil) target.stun(now, CANNON.IMPACT_STUN_MS);
  flier.flightVx = -ux * speed * CANNON.BOUNCE;
  flier.flightVy = -uy * speed * CANNON.BOUNCE;
  flier.flightEndsAt = Math.min(flier.flightEndsAt, now + 250);
  flier.launchedBy = target.sessionId;
  flier.flightStartedAt = now;
}

/** A flight ends: no catching it again (by a mouth or a turbine) for a moment */
function land(player: PlayerSchema, now: number): void {
  player.land();
  player.recaptureAfter = now + CANNON.RECAPTURE_MS;
}
