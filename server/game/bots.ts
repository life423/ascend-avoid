import { ARENA_RULES, BOTS, PLAYER_STATE } from "../constants/gameConstants.js";
import { hop } from "./movement.js";
import type { Box, Direction } from "./movement.js";
import type { GameState } from "../schema/GameState.js";
import type { PlayerSchema } from "../schema/PlayerSchema.js";

/** Where a bot is heading, until when, and which gem it's after (if any) */
interface Goal {
  x: number;
  y: number;
  until: number;
  gemId?: string;
}

const MOVES: (Direction | null)[] = [null, "up", "down", "left", "right"];

/** Seconds until traffic would hit a box that stays put (Infinity if nothing does within LOOK_AHEAD) */
function timeToImpact(box: Box, world: GameState): number {
  const margin = BOTS.SAFETY_MARGIN;
  let soonest = Infinity;
  world.obstacles.forEach((o) => {
    for (let t = 0; t <= BOTS.LOOK_AHEAD && t < soonest; t += 0.1) {
      const ox = o.x + o.vx * t;
      const oy = o.y + o.vy * t;
      if (
        ox - margin < box.x + box.width &&
        ox + o.width + margin > box.x &&
        oy - margin < box.y + box.height &&
        oy + o.height + margin > box.y
      ) {
        soonest = t;
        break;
      }
    }
  });
  return soonest;
}

/**
 * The mind of one bot. A few times a second it picks a hop (or none): it dodges the traffic it
 * can see coming, heads for the best gem nearby, and shoves a neighbor now and then (always the
 * leader), losing interest in gems once it has plenty. Its hops go through the same rules as everyone's (PlayerSchema.requestHop), so a bot
 * is never faster than a person could be. Each bot differs a little in reaction speed,
 * carelessness and appetite for shoving.
 */
export class BotBrain {
  private nextThinkAt = 0;
  private goal: Goal | null = null;
  private readonly thinkMs: number;
  private readonly mistakeChance: number;
  private readonly aggression: number;

  constructor() {
    this.thinkMs = BOTS.THINK_MS_MIN + Math.random() * (BOTS.THINK_MS_MAX - BOTS.THINK_MS_MIN);
    this.mistakeChance = BOTS.MISTAKE_CHANCE * (0.5 + Math.random());
    this.aggression = Math.random() * BOTS.MAX_AGGRESSION;
  }

  /** The hop to make now, if any */
  think(bot: PlayerSchema, world: GameState, now: number): Direction | null {
    if (now < this.nextThinkAt) return null;
    this.nextThinkAt = now + this.thinkMs * (0.8 + Math.random() * 0.4);
    if (bot.state !== PLAYER_STATE.ALIVE || bot.sliding) return null;
    if (Math.random() < this.mistakeChance) return MOVES[Math.floor(Math.random() * MOVES.length)];

    const target = this.target(bot, world, now);
    const distanceFrom = (box: Box) =>
      Math.hypot(target.x - (box.x + box.width / 2), target.y - (box.y + box.height / 2));
    const here = distanceFrom(bot);
    let best: Direction | null = null;
    let bestScore = -Infinity;
    for (const move of MOVES) {
      const box = { x: bot.x, y: bot.y, width: bot.width, height: bot.height };
      if (move) hop(box, move, world.worldWidth, world.worldHeight);
      const impact = bot.isSafe() ? Infinity : timeToImpact(box, world);
      // Staying clear of traffic comes first (the later a hit would come, the better); then
      // getting closer to the goal
      const score = (impact === Infinity ? 10000 : impact * 1000) + (here - distanceFrom(box)) + Math.random() * 5;
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  /** Where the bot is heading: someone to shove, the best gem in sight, or somewhere to wander */
  private target(bot: PlayerSchema, world: GameState, now: number): { x: number; y: number } {
    const victim = this.shoveTarget(bot, world);
    if (victim) return { x: victim.x + victim.width / 2, y: victim.y + victim.height / 2 };

    const cx = bot.x + bot.width / 2;
    const cy = bot.y + bot.height / 2;
    // A bot with plenty of gems stops hunting them, so people can outgrow it
    const hungry = bot.gems < BOTS.CONTENT_AT;
    if (hungry && this.goal?.gemId && now < this.goal.until && world.gems.has(this.goal.gemId)) return this.goal;

    // The most attractive gem in sight: bigger and closer is better
    const pick: { goal: Goal | null; worth: number } = { goal: null, worth: 0 };
    if (hungry) world.gems.forEach((gem, id) => {
      const distance = Math.hypot(gem.x - cx, gem.y - cy);
      if (distance > BOTS.GEM_SIGHT) return;
      const worth = gem.value / (distance + 60);
      if (worth > pick.worth) {
        pick.goal = { x: gem.x, y: gem.y, until: now + 6000, gemId: id };
        pick.worth = worth;
      }
    });
    if (pick.goal) return (this.goal = pick.goal);

    // Nothing in sight: wander somewhere new now and then
    if (!this.goal || this.goal.gemId || now > this.goal.until || Math.hypot(this.goal.x - cx, this.goal.y - cy) < 40) {
      this.goal = {
        x: 100 + Math.random() * (world.worldWidth - 200),
        y: 100 + Math.random() * (world.worldHeight - 200),
        until: now + 8000,
      };
    }
    return this.goal;
  }

  /** Someone lined up within a hop that the bot fancies shoving: always the leader, lighter players more often */
  private shoveTarget(bot: PlayerSchema, world: GameState): PlayerSchema | null {
    const reach = ARENA_RULES.HOP * (bot.width / ARENA_RULES.PLAYER_SIZE);
    const cx = bot.x + bot.width / 2;
    const cy = bot.y + bot.height / 2;
    const leader = world.leader();
    const pick: { target: PlayerSchema | null } = { target: null };
    world.players.forEach((other) => {
      if (pick.target || other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.sliding) return;
      const dx = Math.abs(other.x + other.width / 2 - cx);
      const dy = Math.abs(other.y + other.height / 2 - cy);
      const halfWidths = (bot.width + other.width) / 2;
      const halfHeights = (bot.height + other.height) / 2;
      const linedUp = (dy < halfHeights && dx < halfWidths + reach) || (dx < halfWidths && dy < halfHeights + reach);
      if (!linedUp) return;
      const keenness = other === leader ? 1 : other.weight() < bot.weight() ? this.aggression * 2 : this.aggression;
      if (Math.random() < keenness) pick.target = other;
    });
    return pick.target;
  }
}
