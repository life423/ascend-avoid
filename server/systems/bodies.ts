import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { ARENA_RULES, PLAYER_STATE } = GAME_CONSTANTS;

/**
 * Creatures are solid. Fresh, forceful contacts briefly stagger and separate both bodies,
 * with immunity and a separation requirement before the pair can bump again. Soft contact
 * permits sliding sideways out of crowds. When two overlap, whoever moved into the other this
 * tick gives way. On softer contact, anyone pulled into someone by suction is the one moved back,
 * and a thief growing as it steals is the one that makes room. The one doing the moving stops
 * going that way, so at an angle it slides along. Inhaling changes nothing.
 */
export function pruneBodyContacts(state: GameState): void {
  for (const [key, pair] of state.bodyContacts) {
    const a = state.players.get(pair.a), b = state.players.get(pair.b);
    if (!a || !b || a.state !== PLAYER_STATE.ALIVE || b.state !== PLAYER_STATE.ALIVE || a.capturedBy || b.capturedBy || a.flying || b.flying || Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2) > (a.width + b.width) / 2 + ARENA_RULES.BUMP_REARM_GAP) state.bodyContacts.delete(key);
  }
}

function bump(state: GameState, a: PlayerSchema, b: PlayerSchema, nx: number, ny: number): boolean {
  const now = state.now;
  if (a.spawnProtected || b.spawnProtected || a.flying || b.flying || a.capturedBy || b.capturedBy || a.sliding || b.sliding || a.stunned || b.stunned || now < a.stunImmuneUntil || now < b.stunImmuneUntil) return false;
  const av = a.velocity(), bv = b.velocity();
  if ((av.x - bv.x) * nx + (av.y - bv.y) * ny < ARENA_RULES.BUMP_SPEED) return false;
  const ratio = Math.max(0.35, Math.min(1.7, b.width / a.width));
  a.stun(now, ARENA_RULES.BUMP_STUN_MS); b.stun(now, ARENA_RULES.BUMP_STUN_MS);
  a.nudge(-nx * 8, -ny * 8, state.worldWidth, state.worldHeight);
  b.nudge(nx * 8, ny * 8, state.worldWidth, state.worldHeight);
  a.skid(-nx, -ny, ARENA_RULES.BUMP_PUSH * ratio);
  b.skid(nx, ny, ARENA_RULES.BUMP_PUSH * Math.max(0.35, Math.min(1.7, a.width / b.width)));
  return true;
}

export function keepApart(state: GameState, player: PlayerSchema) : void {
  if (player.state !== PLAYER_STATE.ALIVE) return;
  state.players.forEach((other) => {
    if (other === player || other.state !== PLAYER_STATE.ALIVE) return;
    // A captive is held where its captor's mouth puts it (see holdCaptive), not pushed off its body
    if (other.capturedBy === player.sessionId || player.capturedBy === other.sessionId) return;
    const dx = other.x + other.width / 2 - (player.x + player.width / 2);
    const dy = other.y + other.height / 2 - (player.y + player.height / 2);
    const distance = Math.hypot(dx, dy);
    const overlap = (player.width + other.width) / 2 - distance;
    if (overlap <= -ARENA_RULES.CONTACT_TOUCH) return;
    const nx = distance > 1e-6 ? dx / distance : 1;
    const ny = distance > 1e-6 ? dy / distance : 0;
    const ids = [player.sessionId, other.sessionId].sort();
    const key = JSON.stringify(ids);
    const fresh = !state.bodyContacts.has(key);
    state.bodyContacts.set(key, { a: player.sessionId, b: other.sessionId });
    if (fresh && bump(state, player, other, nx, ny)) return;
    // Touching: most of this step's sideways movement is undone, so they stay pressed together
    // instead of orbiting; moving away peels off freely
    const stepX = player.x + player.width / 2 - player.tickX;
    const stepY = player.y + player.height / 2 - player.tickY;
    const stepToward = stepX * nx + stepY * ny;
    const step = Math.hypot(stepX, stepY);
    if (step > 1e-6 && stepToward >= -0.2 * step) {
      const grip = ARENA_RULES.CONTACT_GRIP;
      player.nudge(-(stepX - stepToward * nx) * grip, -(stepY - stepToward * ny) * grip, state.worldWidth, state.worldHeight);
    }
    // Soft bodies: a little squish before they push back hard
    const excess = overlap - ARENA_RULES.CONTACT_SQUISH * Math.min(player.width, other.width);
    if (excess <= 0) return;
    // How far each moved (or grew) toward the other this tick
    const mine = Math.max(0, (player.x + player.width / 2 - player.tickX) * nx + (player.y + player.height / 2 - player.tickY) * ny + player.width / 2 - player.tickRadius);
    const theirs = Math.max(0, -((other.x + other.width / 2 - other.tickX) * nx + (other.y + other.height / 2 - other.tickY) * ny) + other.width / 2 - other.tickRadius);
    // Whoever moved (or grew) into the other gives way; when both push, the lighter one gives way more
    // (mass only decides it when both are walking into each other: not growing, not being pulled)
    const movedIn = (player.x + player.width / 2 - player.tickX) * nx + (player.y + player.height / 2 - player.tickY) * ny;
    const theyMovedIn = -((other.x + other.width / 2 - other.tickX) * nx + (other.y + other.height / 2 - other.tickY) * ny);
    const walking = player.velocity();
    const theirWalking = other.velocity();
    const bothPush = walking.x * nx + walking.y * ny > 1 && -(theirWalking.x * nx + theirWalking.y * ny) > 1 && movedIn > 0 && theyMovedIn > 0;
    const mineHeavy = bothPush ? movedIn * other.width * other.width : mine;
    const theirsHeavy = bothPush ? theyMovedIn * player.width * player.width : theirs;
    // Scale separation: something enormous walking into something tiny pushes it aside instead of being stopped (being pulled never shoves)
    const dwarfs = player.width >= other.width * ARENA_RULES.SCALE_SHOVE_RATIO && walking.x * nx + walking.y * ny > 1;
    const dwarfed = other.width >= player.width * ARENA_RULES.SCALE_SHOVE_RATIO && -(theirWalking.x * nx + theirWalking.y * ny) > 1;
    const share = dwarfs ? 0 : dwarfed ? 1 : mineHeavy + theirsHeavy > 1e-6 ? mineHeavy / (mineHeavy + theirsHeavy) : 0.5;
    player.nudge(-nx * excess * share, -ny * excess * share, state.worldWidth, state.worldHeight);
    other.nudge(nx * excess * (1 - share), ny * excess * (1 - share), state.worldWidth, state.worldHeight);
    if (mine > 0 && !dwarfs) player.blockAlong(nx, ny);
    if (theirs > 0 && !dwarfed) other.blockAlong(-nx, -ny);
  });
}
