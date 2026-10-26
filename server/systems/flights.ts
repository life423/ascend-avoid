import type { GameState } from "../schema/GameState.js";
import type { PlayerSchema } from "../schema/PlayerSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { CANNON } from "../constants/gameConstants.js";
import { flightStep, impactGems, missileMassAfterImpact, sweptHit } from "../game/cannon.js";
import { sprayGems } from "./gems.js";
import { knockOutWithGems } from "./inhale.js";

const { PLAYER_STATE } = GAME_CONSTANTS;

/**
 * Player-fired missiles follow the captor's aim; turbine throws still allow steering. Impact spills
 * gems, briefly stuns the target and bounces a surviving projectile. A missile with no growth left
 * is knocked out. Also frees captives whose captor is gone.
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
    const steer = player.flightKind === 'turbine' ? player.steerInput() : { x: 0, y: 0 };
    const next = flightStep(player.flightVx, player.flightVy, steer.x, steer.y, deltaTime, player.flightDrag);
    player.flightVx = next.vx;
    player.flightVy = next.vy;
    const speed = Math.hypot(next.vx, next.vy);
    const fromX = player.x;
    const fromY = player.y;
    player.nudge(next.vx * deltaTime, next.vy * deltaTime, state.worldWidth, state.worldHeight);
    // Stopped by the edge of the world
    if (Math.hypot(player.x - fromX, player.y - fromY) < speed * deltaTime * 0.5) {
      spendMissileMass(state, player, now);
      if (player.state === PLAYER_STATE.ALIVE) land(state, player, now);
      continue;
    }
    const target = player.flightHit ? null : struck(everyone, player, now, fromX, fromY);
    if (target) impact(state, player, target, speed, now);
    else if (speed < CANNON.STOP_SPEED || now >= player.flightEndsAt) {
      if (player.flightKind === 'missile' && !player.flightHit && player.gems < CANNON.BURNUP_GEMS) burnUp(state, player, now);
      else land(state, player, now);
    }
  }
}

/** The creature a flier has just flown into (anywhere along this tick's path, from fromX/fromY), if any */
function struck(everyone: PlayerSchema[], flier: PlayerSchema, now: number, fromX: number, fromY: number): PlayerSchema | null {
  const ax = fromX + flier.width / 2;
  const ay = fromY + flier.height / 2;
  const fx = flier.x + flier.width / 2;
  const fy = flier.y + flier.height / 2;
  for (const other of everyone) {
    if (other === flier || other.state !== PLAYER_STATE.ALIVE || other.flying || other.capturedBy || now < other.impactImmuneUntil) continue;
    if (other.sessionId === flier.launchedBy && now - flier.flightStartedAt < CANNON.LAUNCHER_GRACE_MS) continue;
    const ox = other.x + other.width / 2;
    const oy = other.y + other.height / 2;
    if (sweptHit(ax, ay, fx, fy, ox, oy, (other.width + flier.width) / 2)) return other;
  }
  return null;
}

/** A flier hits a creature: gems knocked loose, the target stunned and shoved, the flier bouncing back off it */
function impact(state: GameState, flier: PlayerSchema, target: PlayerSchema, speed: number, now: number): void {
  const ux = flier.flightVx / speed;
  const uy = flier.flightVy / speed;
  let spill = target.spawnProtected ? 0 : impactGems(target.gems, speed, flier.width, target.width);
  const out = !target.spawnProtected && target.gems - spill < CANNON.IMPACT_KO_GEMS;
  const launcher = flier.launchedBy;
  if (out) {
    spill = target.gems;
    knockOutWithGems(state, target, now);
  } else if (spill > 0) {
    target.injure(state.time);
    target.setGems(target.gems - spill, state.worldWidth, state.worldHeight);
    sprayGems(state, target.x + target.width / 2, target.y + target.height / 2, spill, now, target.sessionId);
  }
  // The heavier the target than the flier, the less it's knocked back
  if (!out) target.skid(ux, uy, CANNON.TARGET_SHOVE * Math.max(0.15, Math.min(1, flier.weight() / Math.max(1, target.weight()))));
  target.impactImmuneUntil = now + CANNON.IMPACT_IMMUNE_MS;
  state.onEvent?.("impact", {
    byId: launcher, projectileId: flier.sessionId, targetId: target.sessionId,
    x: target.x + target.width / 2, y: target.y + target.height / 2,
    size: target.width, gems: spill, out,
  });
  state.credit(target, "cannon", now, launcher, { gems: spill, projectileId: flier.sessionId, out });
  spendMissileMass(state, flier, now);
  if (!out && !target.spawnProtected && now >= target.stunImmuneUntil) target.stun(now, CANNON.IMPACT_STUN_MS);
  if (flier.state !== PLAYER_STATE.ALIVE) return;
  flier.flightVx = -ux * speed * CANNON.BOUNCE;
  flier.flightVy = -uy * speed * CANNON.BOUNCE;
  flier.flightEndsAt = Math.min(flier.flightEndsAt, now + 250);
  flier.launchedBy = target.sessionId;
  flier.flightStartedAt = now;
}

/** Growth powers an impact once; a player-fired missile with none left is knocked out. */
function spendMissileMass(state: GameState, player: PlayerSchema, now: number): void {
  if (player.flightHit) return;
  player.flightHit = true;
  const kept = missileMassAfterImpact(player.gems, player.width), lost = player.gems - kept;
  const x = player.x + player.width / 2, y = player.y + player.height / 2;
  if (lost > 0) {
    player.setGems(kept, state.worldWidth, state.worldHeight);
    sprayGems(state, x, y, lost, now, player.sessionId, player.flightKind === 'missile' ? GAME_CONSTANTS.GEMS.MISSILE_OWNER_PICKUP_DELAY_MS : GAME_CONSTANTS.GEMS.OWNER_PICKUP_DELAY_MS);
  }
  if (player.flightKind === 'missile' && kept === 0) {
    state.credit(player, 'cannon', now, player.launchedBy, { out: true });
    player.land();
    knockOutWithGems(state, player, now);
  }
}

/** Very small missed player shots are spent in flight rather than landing unharmed. */
function burnUp(state: GameState, player: PlayerSchema, now: number): void {
  const byId = player.launchedBy;
  const x = player.x + player.width / 2, y = player.y + player.height / 2, size = player.width, gems = player.gems;
  player.land();
  knockOutWithGems(state, player, now);
  state.credit(player, 'burnup', now, byId, { out: true, gems, x, y, size });
}

/** A surviving flight ends with a full suction-recovery window. */
function land(state: GameState, player: PlayerSchema, now: number): void {
  player.land();
  player.recaptureAfter = Math.max(player.recaptureAfter, now + CANNON.LAND_SAFE_MS);
  player.suctionSafeUntil = Math.max(player.suctionSafeUntil, now + CANNON.LAND_SAFE_MS);
  player.launchSafeUntil = state.time + CANNON.LAND_SAFE_MS;
}
