import { BOTS, INHALE, PLAYER_STATE, TURBINE } from "../constants/gameConstants.js";
import { hop, moveSpeed } from "./movement.js";
import { BotCannonAim } from './botAim.js';
import { BotGustDefense } from './botDefense.js';
import { BotWeaponPlan } from './botWeapons.js';
import { botPreyAvailable, botRobber } from './botTargets.js';
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
 * can see coming, gathers crystals, assembles weapons and hunts reachable rivals. Its hops
 * go through the same rules as everyone's (PlayerSchema.requestHop), so a bot
 * is never faster than a person could be. Each bot differs a little in reaction speed,
 * carelessness and appetite for shoving.
 */
export class BotBrain {
  readonly cannonAim = new BotCannonAim();
  readonly gustDefense = new BotGustDefense();
  readonly weaponPlan = new BotWeaponPlan();
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
  /** A taste of its own, so bots don't all rank the same creature first */
  private readonly taste = Math.random();
  /** The chase it's on (who, since when), and creatures it has given up on for a while (until when) */
  private hunt: { id: string; since: number } | null = null;
  private readonly shunned = new Map<string, number>();
  private disperseUntil = 0;
  private disperseGoal = { x: 0, y: 0 };
  isDisengaging(now: number): boolean { return now < this.disperseUntil; }

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
    this.spreadOut(bot, world, now);
    if (!this.isDisengaging(now) && Math.random() < this.mistakeChance) {
      // A careless hop (misjudging traffic), though never straight over the edge
      const careless = MOVES[Math.floor(Math.random() * MOVES.length)];
      if (!careless || !world.shiftsOn || world.shiftPhase === "normal") return careless;
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
      // Crowds: a hop that lands it among other creatures (not the one it's after) counts against it, so bots spread out
      score -= BOTS.CROWD_PENALTY * this.crowding(bot, box, world);
      // Never hop over the edge during a shift, and keep to the new floor during its grace period
      if (world.shiftsOn && world.shiftPhase !== "normal") {
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
    if (this.isDisengaging(now)) return this.disperseGoal;
    // A new floor is coming: get onto it
    if (world.shiftsOn && world.shiftPhase !== "normal" && !world.isFloorAt(cx, cy)) return world.nearestFloorPoint(cx, cy);
    // Something big enough to capture it close by: get away (smaller, it's faster).
    const threat = { x: 0, y: 0, distance: BOTS.FLEE_RANGE };
    world.players.forEach((other) => {
      if (other === bot || other.state !== PLAYER_STATE.ALIVE || other.width < bot.width * BOTS.FLEE_RATIO) return;
      const ox = other.x + other.width / 2;
      const oy = other.y + other.height / 2;
      const distance = Math.hypot(ox - cx, oy - cy) - other.width / 2;
      if (distance < threat.distance) Object.assign(threat, { x: ox, y: oy, distance });
    });
    // ...or a turbine's intake: keep out of its inner zone
    world.turbines.forEach((turbine) => {
      if (turbine.phase !== "active") return;
      const mx = turbine.x + Math.cos(turbine.intake) * TURBINE.BODY_RADIUS;
      const my = turbine.y + Math.sin(turbine.intake) * TURBINE.BODY_RADIUS;
      const distance = Math.hypot(mx - cx, my - cy) - bot.width / 2;
      if (distance < TURBINE.DANGER_REACH + 160 && distance < threat.distance) Object.assign(threat, { x: mx, y: my, distance });
    });
    if (threat.distance < BOTS.FLEE_RANGE) return { x: cx + (cx - threat.x) * 3, y: cy + (cy - threat.y) * 3 };
    // Injury makes even a smaller healthy attacker dangerous. Leave the cone rather than trade breath.
    const robber = botRobber(world, bot, now);
    if (robber) {
      const rx = robber.x + robber.width / 2;
      const ry = robber.y + robber.height / 2;
      const fx = Math.cos(robber.facing);
      const fy = Math.sin(robber.facing);
      const side = Math.sign((cx - rx) * -fy + (cy - ry) * fx) || 1;
      return { x: cx - fy * side * 220 - fx * 60, y: cy + fx * side * 220 - fy * 60 };
    }
    // Low on gems (or just reckless): go for the jackpot
    if (world.jackpotOn && (bot.gems < 20 || this.reckless)) return { x: world.jackpotX, y: world.jackpotY };
    const weapon = this.weaponPlan.goal(world, bot, now);
    if (weapon) return weapon;
    // Someone to rob or catch: go after them (the bot inhales once they are in reach). One it can't catch that
    // is facing it could inhale back, so it goes round to its side and back first
    const victim = this.huntTarget(bot, world, now);
    this.victim = victim;
    if (victim) {
      const vx = victim.x + victim.width / 2;
      const vy = victim.y + victim.height / 2;
      const catchable = victim.width * INHALE.EAT_RATIO <= bot.width;
      const fx = Math.cos(victim.facing);
      const fy = Math.sin(victim.facing);
      const d = Math.hypot(cx - vx, cy - vy) || 1;
      const facingMe = ((cx - vx) * fx + (cy - vy) * fy) / d > 0.5;
      if (facingMe && !catchable) {
        const side = Math.sign((cx - vx) * -fy + (cy - vy) * fx) || 1;
        return { x: vx - fy * side * (victim.width + 90) - fx * victim.width * 0.6, y: vy + fx * side * (victim.width + 90) - fy * victim.width * 0.6 };
      }
      return { x: vx, y: vy };
    }

    // Growth remains a goal at every size, under the same crystal and decay rules as human players.
    if (this.goal?.gemId && now < this.goal.until && world.gems.has(this.goal.gemId)) return this.goal;

    // The most attractive gem in sight: bigger and closer is better, and less so for every other bot already
    // heading for that spot (a spill draws a crowd for a moment, then the latecomers pick other gems)
    const headings: { x: number; y: number }[] = [];
    world.brains.forEach((brain, id) => {
      const heading = id === bot.sessionId ? null : brain.heading();
      if (heading) headings.push(heading);
    });
    const pick: { goal: Goal | null; worth: number } = { goal: null, worth: 0 };
    world.gems.forEach((gem, id) => {
      const distance = Math.hypot(gem.x - cx, gem.y - cy);
      if (distance > BOTS.GEM_SIGHT) return;
      let crowd = 0;
      for (const heading of headings) if (Math.hypot(heading.x - gem.x, heading.y - gem.y) < BOTS.SPILL_CROWD_RANGE) crowd++;
      const worth = gem.value / ((distance + 60) * (1 + BOTS.SPILL_CROWD_PENALTY * crowd));
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

  /** The gem this bot is heading for right now, if any (so other bots can see where the crowd is going) */
  heading(): { x: number; y: number } | null {
    return this.goal?.gemId ? { x: this.goal.x, y: this.goal.y } : null;
  }

  /**
   * Someone worth going after: a creature in sight with gems to rob, better still one small enough
   * to catch, and (for the bolder bots) the leader; richer and closer is better, less so for every
   * other bot already after them, and every bot has tastes of its own, so they don't all pick the same
   * one. Never one big enough to capture the bot. Bolder bots hunt farther. A chase that hasn't closed
   * in HUNT_GIVE_UP_MS is dropped and that creature left alone for SHUN_MS (it was faster).
   */
  private huntTarget(bot: PlayerSchema, world: GameState, now: number): PlayerSchema | null {
    const cx = bot.x + bot.width / 2;
    const cy = bot.y + bot.height / 2;
    const leader = world.leader();
    const range = BOTS.HUNT_RANGE * (0.6 + this.aggression);
    if (this.hunt && now - this.hunt.since > BOTS.HUNT_GIVE_UP_MS) {
      this.shunned.set(this.hunt.id, now + BOTS.SHUN_MS);
      this.hunt = null;
    }
    let best: PlayerSchema | null = null;
    let bestAppeal = 0;
    world.players.forEach((other) => {
      if (!botPreyAvailable(world, bot, other, now)) return;
      if (other.width >= bot.width * INHALE.EAT_RATIO) return;
      if ((this.shunned.get(other.sessionId) ?? 0) > now) return;
      const distance = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy) - other.width / 2;
      if (distance > range) return;
      const edible = other.width * INHALE.EAT_RATIO <= bot.width;
      const reach = INHALE.REACH + bot.width * INHALE.REACH_PER_SIZE;
      const arrivalMs = Math.max(0, distance - reach) / moveSpeed(bot.width) * 1000;
      if (!edible && !bot.theftContinuations.has(other.sessionId) && other.injuredUntil - world.time <= arrivalMs + BOTS.THINK_MS_MAX) return;
      if (!edible && other.gems < 3) return;
      let pursuers = 0;
      world.brains.forEach((brain, id) => {
        if (id !== bot.sessionId && brain.victim === other) pursuers++;
      });
      if (pursuers >= BOTS.MAX_PURSUERS) return;
      const appeal = ((edible ? 2 : 1) * (other === leader && this.aggression > 0.15 ? 1.2 : 1) * (other.gems + 5) * (0.8 + 0.4 * this.liking(other))) / ((distance + 100) * (1 + BOTS.PURSUIT_PENALTY * pursuers));
      if (appeal > bestAppeal) {
        bestAppeal = appeal;
        best = other;
      }
    });
    const pick = best as PlayerSchema | null;
    if (!pick) {
      this.hunt = null;
    } else if (!this.hunt || this.hunt.id !== pick.sessionId) {
      this.hunt = { id: pick.sessionId, since: now };
    }
    return pick;
  }

  /** How much this bot fancies that creature, 0 to 1: fixed for the pair, different for every bot */
  private liking(other: PlayerSchema): number {
    const v = Math.sin((other.playerIndex + 1) * 12.9898 + this.taste * 78.233) * 43758.5453;
    return v - Math.floor(v);
  }

  /** Crowded fights have an end: withdraw toward a less occupied part of the arena. */
  private spreadOut(bot: PlayerSchema, world: GameState, now: number): void {
    if (this.isDisengaging(now) || bot.capturedBy || bot.gulping || bot.flying) return;
    const cx = bot.x + bot.width / 2;
    const cy = bot.y + bot.height / 2;
    const neighbors = [...world.players.values()].filter(other => other !== bot && other.state === PLAYER_STATE.ALIVE && !other.capturedBy && Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy) < (bot.width + other.width) / 2 + BOTS.CROWD_SPACE);
    if (neighbors.length < BOTS.DISPERSE_NEIGHBORS) return;
    let best = { x: cx, y: cy };
    let bestScore = -Infinity;
    for (let attempt = 0; attempt < 16; attempt++) {
      const angle = Math.random() * Math.PI * 2;
      const x = Math.max(180, Math.min(world.worldWidth - 180, cx + Math.cos(angle) * 800));
      const y = Math.max(180, Math.min(world.worldHeight - 180, cy + Math.sin(angle) * 800));
      if (!world.isFloorAt(x, y)) continue;
      let score = 0;
      world.players.forEach(other => { if (other !== bot && other.state === PLAYER_STATE.ALIVE) score -= 1 / Math.max(40, Math.hypot(other.x + other.width / 2 - x, other.y + other.height / 2 - y)); });
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
    this.disperseGoal = best;
    this.disperseUntil = now + BOTS.DISPERSE_MS + Math.random() * 2000;
    this.hunt = null;
    this.victim = null;
    this.goal = null;
    bot.stopInhale(now);
    bot.dropLatch();
  }

  /**
   * How much a box would be crowding other creatures (not its quarry): 1 for each one it's touching, fading to
   * nothing at CROWD_SPACE beyond touching, so every hop away from a crowd scores a little better than staying
   */
  private crowding(bot: PlayerSchema, box: Box, world: GameState): number {
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    let crowd = 0;
    world.players.forEach((other) => {
      if (other === bot || other === this.victim || other.state !== PLAYER_STATE.ALIVE) return;
      const touching = (box.width + other.width) / 2;
      const d = Math.hypot(other.x + other.width / 2 - x, other.y + other.height / 2 - y);
      crowd += Math.max(0, 1 - Math.max(0, d - touching) / BOTS.CROWD_SPACE);
    });
    return crowd;
  }
}
