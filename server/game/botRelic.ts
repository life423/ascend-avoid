import { BLACK_HOLE, BOTS, RELIC, TURBINE, WEAPON_SHOTS } from '../constants/gameConstants.js';
import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { arenaExit, type Vector } from './arenaBoundary.js';
import { blackHoleReservesSpace, circleEntry } from './blackHole.js';
import { moveSpeed } from './movement.js';

const HEADINGS: Vector[] = Array.from({ length: 8 }, (_, i) => ({ x: Math.cos(i * Math.PI / 4), y: Math.sin(i * Math.PI / 4) }));

function clearTravel(at: Vector, way: Vector, distance: number, x: number, y: number, radius: number): number {
  // If the body is already overlapping, let ordinary steering move it away from the obstacle.
  if (Math.hypot(at.x - x, at.y - y) <= radius && (at.x - x) * way.x + (at.y - y) * way.y >= 0) return distance;
  const entry = circleEntry(at.x, at.y, at.x + way.x * distance, at.y + way.y * distance, x, y, radius);
  return entry === null ? distance : distance * entry;
}

/** Respond to the same public countdown and target area the player sees on the minimap. */
export class BotRelicDodge {
  private strike: number | null = null;
  private reactAt = 0;

  constructor(private readonly random: () => number = Math.random) {}

  move(bot: PlayerSchema, state: GameState, now: number): Vector | undefined {
    const comet = state.relicComet;
    if (comet.phase !== 'inbound' || comet.ownerId === bot.sessionId || state.shiftPhase === 'grace') {
      this.strike = null;
      return;
    }
    if (this.strike !== comet.id) {
      this.strike = comet.id;
      this.reactAt = now + WEAPON_SHOTS.BOT_REACT_MIN_MS + this.random() * (WEAPON_SHOTS.BOT_REACT_MAX_MS - WEAPON_SHOTS.BOT_REACT_MIN_MS);
    }
    if (now < this.reactAt || bot.isSafe() || bot.stunned || bot.sliding || bot.launchSafeUntil > comet.impactAt) return;

    const at = { x: bot.x + bot.width / 2, y: bot.y + bot.height / 2 };
    const dx = at.x - comet.x, dy = at.y - comet.y, gap = Math.hypot(dx, dy);
    const seconds = (comet.impactAt - state.time) / 1000;
    const speed = moveSpeed(bot.width);
    const outer = RELIC.OUTER_RADIUS + BOTS.SAFETY_MARGIN;
    const course = bot.steering(), lookahead = Math.min(seconds, 1.2) * speed;
    if (seconds <= 0 || (gap > outer && circleEntry(at.x, at.y, at.x + course.x * lookahead,
      at.y + course.y * lookahead, comet.x, comet.y, outer) === null)) return;

    const outward = gap > 1e-6 ? { x: dx / gap, y: dy / gap } : { x: Math.cos(bot.facing), y: Math.sin(bot.facing) };
    const travel = speed * Math.max(0, seconds - .1), body = bot.width / 2;
    let best: Vector | undefined;
    let farthest = gap + 1e-6;
    for (const way of [outward, ...HEADINGS]) {
      let distance = travel * (arenaExit(bot, way.x * travel, way.y * travel, state.worldWidth, state.worldHeight) ?? 1);
      for (const hole of state.blackHoles) if (blackHoleReservesSpace(hole) && state.isFloorAt(hole.x, hole.y)) {
        distance = clearTravel(at, way, distance, hole.x, hole.y, hole.radius + body + BLACK_HOLE.RIM_CLEARANCE);
      }
      for (const fan of state.turbines) if (fan.phase === 'active' || (fan.phase === 'warning' && fan.phaseEndsAt < comet.impactAt)) {
        distance = clearTravel(at, way, distance, fan.x, fan.y, TURBINE.BODY_RADIUS + body);
      }
      if (state.layout) for (let step = Math.min(60, distance); step <= distance; step = Math.min(distance, step + 60)) {
        if (!state.isFloorAt(at.x + way.x * step, at.y + way.y * step)) { distance = Math.max(0, step - 60); break; }
        if (step === distance) break;
      }
      if (gap >= RELIC.INNER_RADIUS && dx * way.x + dy * way.y < 0 && circleEntry(at.x, at.y,
        at.x + way.x * distance, at.y + way.y * distance, comet.x, comet.y, RELIC.INNER_RADIUS) !== null) continue;
      const clearance = Math.hypot(dx + way.x * distance, dy + way.y * distance);
      if (clearance > farthest) { best = way; farthest = clearance; }
    }
    return best ?? (gap >= RELIC.INNER_RADIUS ? { x: 0, y: 0 } : undefined);
  }
}
