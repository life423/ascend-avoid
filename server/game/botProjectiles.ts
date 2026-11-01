import { WEAPON_SHOTS, ARENA_RULES } from '../constants/gameConstants.js';
import { weaponShots } from './weaponShots.js';
import { allWeapons } from './weaponKit.js';
import { firstImpact } from './incomingShot.js';
import { viewShort } from './camera.js';
import { moveSpeed, type Direction } from './movement.js';
import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';

/** Read actual visible shots or the same offscreen warning, then steer after a human-scale delay. */
export class BotProjectileDodge {
  private noticed = new Map<string, number>();
  private readonly reaction: number;
  private escape: { move: Direction; until: number } | null = null;
  constructor(random: () => number = Math.random) {
    this.reaction = WEAPON_SHOTS.BOT_REACT_MIN_MS + random() * (WEAPON_SHOTS.BOT_REACT_MAX_MS - WEAPON_SHOTS.BOT_REACT_MIN_MS);
  }

  move(bot: PlayerSchema, state: GameState, now: number): Direction | undefined {
    if (!state.weaponsOn || bot.spawnProtected || bot.capturedBy || bot.flying || bot.stunned || bot.sliding) { this.noticed.clear(); this.escape = null; return; }
    if (this.escape && now < this.escape.until) return this.escape.move;
    const x = bot.x + bot.width / 2, y = bot.y + bot.height / 2, sight = viewShort(bot.width) / 2;
    const velocity = bot.velocity();
    const target = { x, y, vx: velocity.x, vy: velocity.y, radius: bot.width / 2 };
    const shots = weaponShots(allWeapons(state), state.time, bot.sessionId).filter(shot => {
      const seen = Math.abs(shot.x - x) <= sight && Math.abs(shot.y - y) <= sight;
      return seen || firstImpact(target, [shot], WEAPON_SHOTS.WARNING_S) !== null;
    });
    const current = new Set(shots.map(shot => shot.id));
    for (const id of this.noticed.keys()) if (!current.has(id)) this.noticed.delete(id);
    for (const shot of shots) if (!this.noticed.has(shot.id)) this.noticed.set(shot.id, now);
    const read = shots.filter(shot => now - this.noticed.get(shot.id)! >= this.reaction);
    const hit = firstImpact(target, read, WEAPON_SHOTS.WARNING_S);
    if (!hit) return;
    const speed = moveSpeed(bot.width), margin = ARENA_RULES.EDGE_MARGIN + bot.width / 2;
    const moves: [Direction, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    let best: Direction | undefined, score = -Infinity;
    for (const [move, dx, dy] of moves) {
      if (x + dx * speed * .5 < margin || x + dx * speed * .5 > state.worldWidth - margin || y + dy * speed * .5 < margin || y + dy * speed * .5 > state.worldHeight - margin) continue;
      const danger = firstImpact({ x, y, vx: dx * speed, vy: dy * speed, radius: target.radius }, read, WEAPON_SHOTS.WARNING_S);
      const value = danger ? danger.seconds : WEAPON_SHOTS.WARNING_S + 1;
      if (value > score) { score = value; best = move; }
    }
    if (best) this.escape = { move: best, until: now + 650 };
    return best;
  }
}
