import type { GameState } from "../schema/GameState.js";
import { BombSchema } from "../schema/BombSchema.js";
import { randomFloorPoint } from "../game/layouts.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { GEMS, PLAYER_STATE, BOMBS } = GAME_CONSTANTS;
import { knockOutWithGems } from "./inhale.js";
import { sprayGems } from "./gems.js";

/**
 * Bombs: back after going off; safe in a mouth unless lit (then it goes off right there); dropped
 * where a holder was if they're gone; sliding, nudged by anyone walking into it;
 * and going off when the fuse runs down
 */
export function updateBombs(state: GameState, now: number, deltaTime: number) : void {
  state.bombs.forEach((bomb) => {
    if (bomb.respawnAt) {
      if (state.time < bomb.respawnAt) return;
      bomb.respawnAt = 0;
      const spot = state.layout ? randomFloorPoint(state.layout) : { x: 80 + Math.random() * (state.worldWidth - 160), y: 80 + Math.random() * (state.worldHeight - 160) };
      bomb.placeAt(spot.x, spot.y);
      return;
    }
    if (bomb.heldBy) {
      const holder = state.players.get(bomb.heldBy);
      if (holder && holder.state === PLAYER_STATE.ALIVE && holder.mouth) {
        const mouth = bomb.lit() ? "lit" : "bomb";
        if (holder.mouth !== mouth) holder.mouth = mouth;
        if (!bomb.lit() || state.time < bomb.explodesAt) return;
        // Went off in their mouth
        holder.mouth = "";
        bomb.heldBy = "";
        bomb.placeAt(holder.x + holder.width / 2, holder.y + holder.height / 2);
        explode(state, bomb, now);
        return;
      }
      if (holder) holder.mouth = "";
      bomb.heldBy = "";
      const x = holder ? holder.x + holder.width / 2 : state.worldWidth / 2;
      const y = holder ? holder.y + holder.height / 2 : state.worldHeight / 2;
      bomb.placeAt(Math.max(bomb.radius, Math.min(x, state.worldWidth - bomb.radius)), Math.max(bomb.radius, Math.min(y, state.worldHeight - bomb.radius)));
    }
    bomb.update(deltaTime, state.worldWidth, state.worldHeight);
    state.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE) return;
      const cx = player.x + player.width / 2;
      const cy = player.y + player.height / 2;
      const dx = bomb.x - cx;
      const dy = bomb.y - cy;
      const d = Math.hypot(dx, dy);
      const reach = player.width / 2 + bomb.radius;
      if (d >= reach || d < 1e-6) return;
      const nx = dx / d;
      const ny = dy / d;
      // Nudged out of the way, rolling off a little
      const moving = player.velocity();
      const push = Math.max(60, moving.x * nx + moving.y * ny) * 1.1;
      bomb.x = cx + nx * reach;
      bomb.y = cy + ny * reach;
      bomb.vx = nx * push;
      bomb.vy = ny * push;
    });
    if (bomb.lit() && state.time >= bomb.explodesAt) explode(state, bomb, now);
  });
}

/**
 * A bomb goes off: everyone in the blast is knocked outward (lighter creatures farther) and has
 * gems knocked loose, more near the middle; under GEMS.SURVIVE_AT gems it knocks them out. Other
 * bombs caught in it go off a moment later. Credit goes to whoever spat or kicked it last.
 */
export function explode(state: GameState, bomb: BombSchema, now: number) : void {
  const x = bomb.x;
  const y = bomb.y;
  const by = bomb.thrownBy;
  bomb.vanish(state.time + BOMBS.RESPAWN_MS);
  state.onEvent?.("blast", { x: Math.round(x), y: Math.round(y), radius: BOMBS.BLAST_RADIUS });
  state.players.forEach((target) => {
    if (target.state !== PLAYER_STATE.ALIVE || target.spawnProtected || target.capturedBy) return; // (caught: inside a mouth, where nothing reaches it)
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const d = Math.hypot(tx - x, ty - y);
    const reach = BOMBS.BLAST_RADIUS + target.width / 2;
    if (d >= reach) return;
    const strength = 1 - d / reach;
    const awayX = d > 1e-6 ? (tx - x) / d : -Math.cos(target.facing);
    const awayY = d > 1e-6 ? (ty - y) / d : -Math.sin(target.facing);
    const lightness = Math.min(1, Math.max(0.5, 1 / Math.sqrt(target.weight())));
    target.shoveAlong(awayX, awayY, (BOMBS.PUSH_MIN + (BOMBS.PUSH_MAX - BOMBS.PUSH_MIN) * strength) * lightness, by, now, "bomb");
    if (!target.takeBounty(now)) return;
    const credited = by !== "" && by !== target.sessionId;
    if (target.gems < GEMS.SURVIVE_AT) {
      knockOutWithGems(state, target, now);
      if (credited) state.credit(target, "bomb", now, by, { gems: 0 });
      return;
    }
    const share = BOMBS.SHARE_MIN + (BOMBS.SHARE_MAX - BOMBS.SHARE_MIN) * strength;
    const loose = Math.min(target.gems, BOMBS.LOOSE_MAX, Math.max(1, Math.ceil(target.gems * share)));
    target.setGems(target.gems - loose, state.worldWidth, state.worldHeight);
    sprayGems(state, tx, ty, loose, now, target.sessionId);
    if (credited) state.credit(target, "bomb", now, by, { gems: loose });
  });
  state.bombs.forEach((other) => {
    if (other === bomb || other.respawnAt || other.heldBy) return;
    if (Math.hypot(other.x - x, other.y - y) > BOMBS.BLAST_RADIUS + other.radius) return;
    const soon = state.time + BOMBS.CHAIN_MS;
    if (!other.lit() || other.explodesAt > soon) other.explodesAt = soon;
  });
}
