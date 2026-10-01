import { BOTS, PLAYER_STATE } from "../constants/gameConstants.js";
import { hop, hopLength } from "./movement.js";
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
  world.comets.forEach((comet) => {
    for (let t = 0; t <= BOTS.LOOK_AHEAD && t < soonest; t += 0.1) {
      const cx = comet.x + comet.vx * t;
      const cy = comet.y + comet.vy * t;
      const dx = Math.max(box.x - cx, 0, cx - (box.x + box.width));
      const dy = Math.max(box.y - cy, 0, cy - (box.y + box.height));
      if (Math.hypot(dx, dy) <= comet.radius + margin) {
        soonest = t;
        break;
      }
    }
  });
  world.balls.forEach((ball) => {
    for (let t = 0; t <= BOTS.LOOK_AHEAD && t < soonest; t += 0.1) {
      const bx = ball.x + ball.vx * t;
      const by = ball.y + ball.vy * t;
      const dx = Math.max(box.x - bx, 0, bx - (box.x + box.width));
      const dy = Math.max(box.y - by, 0, by - (box.y + box.height));
      if (Math.hypot(dx, dy) <= ball.radius + margin) {
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
  /** When the bot next decides (it keeps steering the same way until then) */
  nextThinkAt = 0;
  /** Who the bot is hunting, if anyone (it runs into them to shove them) */
  victim: PlayerSchema | null = null;
  private goal: Goal | null = null;
  private readonly thinkMs: number;
  private readonly mistakeChance: number;
  private readonly aggression: number;
  /** Some bots go for the jackpot however many gems they have */
  private readonly reckless = Math.random() < 0.3;

  constructor() {
    this.thinkMs = BOTS.THINK_MS_MIN + Math.random() * (BOTS.THINK_MS_MAX - BOTS.THINK_MS_MIN);
    this.mistakeChance = BOTS.MISTAKE_CHANCE * (0.5 + Math.random());
    this.aggression = Math.random() * BOTS.MAX_AGGRESSION;
  }

  /** The hop to make now, if any */
  think(bot: PlayerSchema, world: GameState, now: number): Direction | null {
    if (now < this.nextThinkAt) return null;
    this.nextThinkAt = now + this.thinkMs * (0.8 + Math.random() * 0.4);
    if (bot.state !== PLAYER_STATE.ALIVE || bot.sliding || bot.recovering) return null;
    if (Math.random() < this.mistakeChance) {
      // A careless hop (misjudging traffic), though never straight over the edge
      const careless = MOVES[Math.floor(Math.random() * MOVES.length)];
      if (!careless || world.shiftPhase === "normal") return careless;
      const box = { x: bot.x, y: bot.y, width: bot.width, height: bot.height };
      hop(box, careless, world.worldWidth, world.worldHeight);
      if (world.isFloorAt(box.x + box.width / 2, box.y + box.height / 2)) return careless;
    }

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
      let score = (impact === Infinity ? 10000 : impact * 1000) + (here - distanceFrom(box)) + Math.random() * 5;
      // Never hop over the edge during a shift, and keep to the new floor during its grace period
      if (world.shiftPhase !== "normal") {
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        if (!world.isFloorAt(x, y)) score -= world.shiftPhase === "shift" ? 20000 : 500;
        // Standing right at the edge invites a shove over it
        else if (!world.isFloorAt(x + 35, y) || !world.isFloorAt(x - 35, y) || !world.isFloorAt(x, y + 35) || !world.isFloorAt(x, y - 35)) score -= 40;
      }
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
    }
    return best;
  }

  /** Where the bot is heading: someone to shove, the best gem in sight, or somewhere to wander */
  private target(bot: PlayerSchema, world: GameState, now: number): { x: number; y: number } {
    this.victim = null;
    const cx = bot.x + bot.width / 2;
    const cy = bot.y + bot.height / 2;
    // A new floor is coming: get onto it
    if (world.shiftPhase !== "normal" && !world.isFloorAt(cx, cy)) return world.nearestFloorPoint(cx, cy);
    // Something much bigger close by, or a robber its size or bigger: get away (smaller, it's faster)
    const threat = { x: 0, y: 0, distance: BOTS.FLEE_RANGE };
    world.players.forEach((other) => {
      const robbing = other.stealingFrom === bot.sessionId && other.width >= bot.width;
      if (other === bot || other.state !== PLAYER_STATE.ALIVE || (other.width < bot.width * BOTS.FLEE_RATIO && !robbing)) return;
      const ox = other.x + other.width / 2;
      const oy = other.y + other.height / 2;
      const distance = Math.hypot(ox - cx, oy - cy) - other.width / 2;
      if (distance < threat.distance) Object.assign(threat, { x: ox, y: oy, distance });
    });
    if (threat.distance < BOTS.FLEE_RANGE) return { x: cx + (cx - threat.x) * 3, y: cy + (cy - threat.y) * 3 };
    // Low on gems (or just reckless): go for the jackpot
    if (world.jackpotOn && (bot.gems < 20 || this.reckless)) return { x: world.jackpotX, y: world.jackpotY };
    const victim = this.shoveTarget(bot, world);
    this.victim = victim;
    if (victim) return { x: victim.x + victim.width / 2, y: victim.y + victim.height / 2 };

    // A bot with plenty of gems stops hunting them, so people can outgrow it (except during a shift)
    const hungry = bot.gems < BOTS.CONTENT_AT || world.shiftPhase === "shift";
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
    const reach = hopLength(bot.width);
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
      // Bots get pushier during a shift
      if (Math.random() < keenness * (world.shiftPhase === "shift" ? 1.5 : 1)) pick.target = other;
    });
    return pick.target;
  }
}
