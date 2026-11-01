import { ARENA_RULES, SHOCKWAVE, WEAPON_SHOTS } from '../constants/gameConstants.js';
import { allWeapons } from './weaponKit.js';
import { pulsarContact, pulsarHeading, pulsarRadius, type PulsarWave } from './pulsar.js';
import { weaponCoreRadius } from './weaponFairness.js';
import { viewShort } from './camera.js';
import { moveSpeed, type Direction } from './movement.js';
import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';

/** React to a visible locked charge or released crescent, using normal steering and reaction time. */
export class BotPulsarDodge {
  private noticed = new Map<string, number>();
  private escape: { move: Direction; until: number } | null = null;
  private readonly reaction: number;
  constructor(random: () => number = Math.random) {
    this.reaction = WEAPON_SHOTS.BOT_REACT_MIN_MS + random() * (WEAPON_SHOTS.BOT_REACT_MAX_MS - WEAPON_SHOTS.BOT_REACT_MIN_MS);
  }

  move(bot: PlayerSchema, state: GameState, now: number): Direction | undefined {
    if (!state.weaponsOn || bot.state !== 'alive' || bot.spawnProtected || bot.capturedBy || bot.flying || bot.stunned || bot.sliding) {
      this.noticed.clear(); this.escape = null; return;
    }
    if (this.escape && now < this.escape.until) return this.escape.move;
    const point = { x: bot.x + bot.width / 2, y: bot.y + bot.height / 2 }, sight = viewShort(bot.width) / 2;
    const hazards: { id: string; wave: PulsarWave }[] = [];
    allWeapons(state).forEach((w, index) => {
      if (w.kind !== 'pulsar' || w.phase !== 'active' || w.owner === bot.sessionId) return;
      const visible = Math.abs(w.x - point.x) <= sight + 60 && Math.abs(w.y - point.y) <= sight + 60;
      if (visible && state.time >= w.beatAt - SHOCKWAVE.WINDUP_MS && state.time < w.beatAt) hazards.push({
        id: `${index}:charge:${w.beatAt}`, wave: { x: w.x, y: w.y, facing: pulsarHeading(w, state.time), at: w.beatAt },
      });
      const age = state.time - w.pulseAt;
      if (w.pulseAt && age >= 0 && age <= SHOCKWAVE.WAVE_MS && (visible || Math.hypot(point.x - w.pulseX, point.y - w.pulseY) <= sight + pulsarRadius(age))) hazards.push({
        id: `${index}:wave:${w.pulseAt}`, wave: { x: w.pulseX, y: w.pulseY, facing: w.pulseFacing, at: w.pulseAt },
      });
    });
    const ids = new Set(hazards.map(h => h.id));
    for (const id of this.noticed.keys()) if (!ids.has(id)) this.noticed.delete(id);
    for (const h of hazards) if (!this.noticed.has(h.id)) this.noticed.set(h.id, now);
    const read = hazards.filter(h => now - (this.noticed.get(h.id) ?? now) >= this.reaction);
    const core = weaponCoreRadius(bot.width), horizon = 1.5, velocity = bot.velocity();
    const risk = (vx: number, vy: number) => read.filter(h => pulsarContact(h.wave, point,
      { x: point.x + vx * horizon, y: point.y + vy * horizon }, state.time - h.wave.at, state.time - h.wave.at + horizon * 1000, core)).length;
    if (!risk(velocity.x, velocity.y)) return;
    const speed = moveSpeed(bot.width), margin = ARENA_RULES.EDGE_MARGIN + bot.width / 2;
    const moves: [Direction, number, number][] = [['up', 0, -1], ['down', 0, 1], ['left', -1, 0], ['right', 1, 0]];
    let best: Direction | undefined, score = Infinity;
    for (const [move, dx, dy] of moves) {
      const x = point.x + dx * speed * .6, y = point.y + dy * speed * .6;
      if (x < margin || x > state.worldWidth - margin || y < margin || y > state.worldHeight - margin) continue;
      if (state.shiftsOn && state.shiftPhase !== 'normal' && !state.isFloorAt(x, y)) continue;
      const value = risk(dx * speed, dy * speed);
      if (value < score) { best = move; score = value; }
    }
    if (best) this.escape = { move: best, until: now + 550 };
    return best;
  }
}
