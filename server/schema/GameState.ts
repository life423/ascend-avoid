import * as schema from "@colyseus/schema";
const { Schema, MapSchema, ArraySchema, type } = schema;
import { PlayerSchema } from "./PlayerSchema.js";
import { ObstacleSchema } from "./ObstacleSchema.js";
import { GemSchema } from "./GemSchema.js";
import { BallSchema } from "./BallSchema.js";
import { CometSchema } from "./CometSchema.js";
import { BotBrain } from "../game/bots.js";
import { closestFloorPoint, isFloor, jackpotSpot, layoutToString, pickLayout, randomFloorPoint } from "../game/layouts.js";
import type { Layout } from "../game/layouts.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { moveSpeed, pushOutOfWalls } from "../game/movement.js";
import type { Box, Direction } from "../game/movement.js";
import { ENTRANCES, isUnderground, keepTunnelsOpen, outsideTunnels, overlapsTunnel, tunnelWalls, tunnelsStayOpen } from "../game/tunnels.js";

const { WORLD, ARENA_RULES, GEMS, PLAYER_STATE, PUSH, BOTS, SHIFT, TRAFFIC, BALLS, COMETS } = GAME_CONSTANTS;
const NO_WALLS: Box[] = [];
/** Which way each of a bot's decisions steers it */
const STEER: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** How many random spots to try when looking for a safe place to (re)spawn */
const SPAWN_TRIES = 24;

/** Distance from a point to a rectangle (0 when the point is inside it) */
function distanceToRect(px: number, py: number, x: number, y: number, width: number, height: number): number {
  const dx = Math.max(x - px, 0, px - (x + width));
  const dy = Math.max(y - py, 0, py - (y + height));
  return Math.hypot(dx, dy);
}

/**
 * The online world: one big open arena that never stops. Players drop in the moment they join,
 * grab gems, shove each other and dodge traffic crossing the map in every direction. A hit
 * sprays out half your gems; with none left you're knocked out, back two seconds later somewhere
 * safe and protected for a moment. There are no rounds, nobody waits, and
 * bots fill in when it's quiet.
 */
class GameState extends Schema {
  players: schema.MapSchema<PlayerSchema>;
  obstacles: schema.ArraySchema<ObstacleSchema>;
  balls: schema.ArraySchema<BallSchema>;
  comets: schema.ArraySchema<CometSchema>;
  gems: schema.MapSchema<GemSchema>;
  worldWidth: number;
  worldHeight: number;
  /** The world's clock: ms since it started, as of the latest tick (browsers time traffic by it) */
  time: number;
  /** The arena shift: "normal", "grace" (the new shape is shown; nobody can be hurt) or "shift" (the rest has dropped away) */
  shiftPhase: string;
  /** World time (ms) when this phase ends: the next shift begins, the grace period ends, or the arena returns */
  phaseEndsAt: number;
  /** During a grace period or shift, which tiles are floor, row by row ("1" floor, "0" void); empty otherwise */
  floor: string;
  /** The jackpot: where it is, when it lands, who is claiming it and how far along they are (0-1) */
  jackpotOn: boolean;
  jackpotX: number;
  jackpotY: number;
  jackpotLandsAt: number;
  jackpotHolder: string;
  jackpotProgress: number;

  /** Server-only: whether traffic hits players (the automated test turns this off) */
  trafficHits = true;
  /** Server-only: never calm (the automated test), and when the next traffic wave is due */
  alwaysTraffic = false;
  /** Server-only: whether this world has traffic at all (TRAFFIC.ENABLED; the test can switch it on) */
  private trafficOn: boolean = TRAFFIC.ENABLED;
  /** Tunnel entrances, one letter each: o open, w closing (the ground outside is about to drop away), x closed ("" with no tunnels) */
  tunnelDoors: string;
  /** Server-only: whether this world has tunnels (the automated test's main world doesn't) */
  private tunnelsOn = true;
  private nextWaveAt = 0;
  /** Traffic comes in waves: "calm", "warning" (a chip counts down) or "wave"; waveAt is when that part ends */
  trafficWave: string;
  waveAt: number;
  /** Server-only: bots fill in until this many are playing (the automated test sets 0) */
  botFill: number = BOTS.FILL_TO;
  private brains = new Map<string, BotBrain>();
  private nextBotId = 1;
  private startedAt = 0;
  /** Server-only: each traffic lane's direction (1 or -1) and speed; across lanes first, then down */
  private lanes: { direction: number; speed: number }[] = [];
  private layout: Layout | null = null;
  private lastLayoutName = "";
  private nextShowerAt = 0;
  private jackpotDropped = false;
  /** Called with moments worth telling everyone about (who shoved whom off the edge, who took the jackpot) */
  onEvent: ((type: string, data: any) => void) | null = null;
  private nextPlayerIndex = 0;
  private nextGemId = 0;
  /** Loose gems the field keeps topped up to, and how many are out there now */
  private fieldGemTarget: number;
  private fieldGems = 0;

  constructor(fieldGemTarget: number = GEMS.FIELD_COUNT) {
    super();
    this.players = new MapSchema<PlayerSchema>();
    this.obstacles = new ArraySchema<ObstacleSchema>();
    this.balls = new ArraySchema<BallSchema>();
    this.comets = new ArraySchema<CometSchema>();
    this.gems = new MapSchema<GemSchema>();
    this.worldWidth = WORLD.WIDTH;
    this.worldHeight = WORLD.HEIGHT;
    this.time = 0;
    this.shiftPhase = "normal";
    this.phaseEndsAt = SHIFT.FIRST_AFTER_MS;
    this.floor = "";
    this.jackpotOn = false;
    this.jackpotX = 0;
    this.jackpotY = 0;
    this.jackpotLandsAt = 0;
    this.jackpotHolder = "";
    this.jackpotProgress = 0;
    this.fieldGemTarget = fieldGemTarget;
    this.reshuffleLanes();
    for (let i = 0; i < WORLD.OBSTACLE_COUNT; i++) {
      const obstacle = new ObstacleSchema();
      if (!this.launchObstacle(obstacle, true)) obstacle.park();
      this.obstacles.push(obstacle);
    }
    for (let i = 0; i < BALLS.COUNT; i++) this.balls.push(new BallSchema(this.worldWidth, this.worldHeight));
    for (let i = 0; i < COMETS.STRAIGHT + COMETS.CURVED; i++) {
      const comet = new CometSchema();
      comet.launch(this.worldWidth, this.worldHeight, i >= COMETS.STRAIGHT, true);
      this.comets.push(comet);
    }
    this.tunnelDoors = "o".repeat(ENTRANCES.length);
    if (this.trafficOn) {
      // Traffic comes in waves, and the world starts with one under way
      this.trafficWave = "wave";
      this.waveAt = TRAFFIC.WAVE_MS;
    } else {
      // No traffic: everything waits out of the world
      this.trafficWave = "calm";
      this.waveAt = 0;
      this.obstacles.forEach((obstacle) => obstacle.park());
      this.comets.forEach((comet) => comet.placeAt(-500, -500));
      this.balls.forEach((ball) => ball.park());
    }
    this.topUpField();
  }

  /** A new visitor: straight into the world, somewhere safe */
  addPlayer(sessionId: string, name: string | null, now: number = Date.now()): PlayerSchema {
    const player = new PlayerSchema(sessionId, this.nextPlayerIndex++);
    if (name) player.name = name;
    this.players.set(sessionId, player);
    this.spawn(player, now);
    this.balanceBots(now);
    return player;
  }

  removePlayer(sessionId: string): void {
    this.players.delete(sessionId);
    this.balanceBots(Date.now());
  }

  /** One server tick: move traffic, gems and players, collect gems, decide hits, bring players back */
  update(deltaTime: number, now: number = Date.now()): void {
    if (!this.startedAt) this.startedAt = now;
    this.time = Math.round(now - this.startedAt);
    this.updateShift(deltaTime, now);
    this.updateTraffic();
    this.updateDoors();
    this.obstacles.forEach((obstacle) => {
      if (!obstacle.update(deltaTime, this.worldWidth, this.worldHeight)) {
        // Between waves, traffic that leaves stays out of the world
        if (this.trafficWave !== "wave" || !this.launchObstacle(obstacle, false)) obstacle.park();
      }
    });
    this.balls.forEach((ball) => {
      if (!ball.update(deltaTime, this.worldWidth, this.worldHeight, this.trafficWave === "wave")) ball.park();
    });
    this.comets.forEach((comet, index) => {
      if (comet.update(deltaTime, this.worldWidth, this.worldHeight)) return;
      if (this.trafficWave === "wave") comet.launch(this.worldWidth, this.worldHeight, index >= COMETS.STRAIGHT);
      else comet.placeAt(-500, -500);
    });

    const expired: string[] = [];
    const layout = this.shiftPhase === "shift" ? this.layout : null;
    this.gems.forEach((gem, id) => {
      if (!gem.update(deltaTime, this.worldWidth, this.worldHeight, now)) {
        expired.push(id);
        return;
      }
      gem.unlock(now);
      // Gems never lie in tunnels (nobody can collect them underground)
      if (this.underground(gem.x, gem.y)) {
        const out = outsideTunnels({ x: gem.x, y: gem.y });
        gem.moveTo(out.x, out.y);
      }
      // During a shift, gems stop at the floor's edge instead of sliding out over the void
      if (layout && !isFloor(layout, gem.x, gem.y)) {
        const spot = closestFloorPoint(layout, gem.x, gem.y, 12);
        gem.moveTo(spot.x, spot.y);
      }
    });
    expired.forEach((id) => this.gems.delete(id));

    // Bots decide on their hops, which then go through the same rules as everyone's
    this.brains.forEach((brain, id) => {
      const bot = this.players.get(id);
      const deciding = bot ? now >= brain.nextThinkAt : false;
      const move = bot ? brain.think(bot, this, now) : null;
      if (bot && deciding) {
        // Bots steer the way they decided (or stop), and dash into whoever they're hunting once close
        const way = move ? STEER[move] : { x: 0, y: 0 };
        bot.steer(way.x, way.y);
        const victim = brain.victim;
        if (move && victim && victim.state === PLAYER_STATE.ALIVE && !victim.spawnProtected) {
          const dx = victim.x + victim.width / 2 - (bot.x + bot.width / 2);
          const dy = victim.y + victim.height / 2 - (bot.y + bot.height / 2);
          if (Math.hypot(dx, dy) < (bot.width + victim.width) / 2 + BOTS.DASH_REACH) bot.requestDash(dx, dy);
        }
      }
      // Now and then a bot charges a slingshot at whoever it's hunting (everyone can see it coming)
      if (bot && brain.slingAt && now >= brain.slingAt) {
        const target = brain.victim;
        if (target && bot.charging) {
          bot.requestSling(target.x + target.width / 2 - (bot.x + bot.width / 2), target.y + target.height / 2 - (bot.y + bot.height / 2));
        } else {
          bot.cancelCharge();
        }
        brain.slingAt = 0;
      } else if (bot && deciding && !bot.charging && brain.victim && Math.random() < BOTS.SLING_CHANCE) {
        const target = brain.victim;
        const gap = Math.hypot(target.x - bot.x, target.y - bot.y);
        if (gap > 150 && gap < 400) {
          bot.startCharge(now);
          if (bot.charging) brain.slingAt = now + 500 + Math.random() * 700;
        }
      }
      // Between decisions, a bot stops rather than walk off the edge
      if (bot && this.shiftPhase === "shift") {
        const way = bot.steering();
        const reach = bot.width / 2 + 24;
        if ((way.x || way.y) && !this.isFloorAt(bot.x + bot.width / 2 + way.x * reach, bot.y + bot.height / 2 + way.y * reach)) bot.steer(0, 0);
      }
    });

    this.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE) {
        if (now >= player.respawnAt) this.spawn(player, now);
        return;
      }
      const fromX = player.x;
      const fromY = player.y;
      const walls = this.walls();
      player.updateMovement(this.worldWidth, this.worldHeight, now, deltaTime, walls);
      if (player.dashing(now)) this.checkDash(player, fromX, fromY, now);
      this.nudgeApart(player, now);
      // Nobody ends up inside rock (after growing, or being nudged)
      const inRock = { x: player.x, y: player.y, width: player.width, height: player.height };
      if (pushOutOfWalls(inRock, walls)) {
        player.x = inRock.x;
        player.y = inRock.y;
      }
      this.collectGems(player, now, fromX, fromY);
      player.decay(deltaTime, this.worldWidth, this.worldHeight);
      // A skid after a hit never carries anyone off the edge
      if (this.shiftPhase === "shift" && player.recovering && this.layout && !this.isFloorAt(player.x + player.width / 2, player.y + player.height / 2)) {
        const spot = closestFloorPoint(this.layout, player.x + player.width / 2, player.y + player.height / 2);
        player.placeAt(spot.x - player.width / 2, spot.y - player.height / 2);
      }
      // Over the edge during a shift
      if (this.shiftPhase === "shift" && !player.isSafe() && !player.inAir(now) && !this.isFloorAt(player.x + player.width / 2, player.y + player.height / 2)) {
        this.fall(player, now);
        return;
      }
      // Nobody can be hurt during a grace period
      if (!this.trafficHits || player.isSafe() || this.shiftPhase === "grace") return;
      // Everything the player crossed this tick counts, not just where they ended up, so hopping
      // (or being shoved) through traffic is a hit
      const box = player.hitBox();
      const dx = fromX - player.x;
      const dy = fromY - player.y;
      const path = {
        x: Math.min(box.x, box.x + dx),
        y: Math.min(box.y, box.y + dy),
        width: box.width + Math.abs(dx),
        height: box.height + Math.abs(dy),
      };
      // What hit them decides the skid: along a car's path, or away from a ball
      const hit: { push: { x: number; y: number } | null } = { push: null };
      this.obstacles.forEach((obstacle) => {
        if (!hit.push && obstacle.checkCollision(path)) hit.push = { x: obstacle.vx, y: obstacle.vy };
      });
      this.balls.forEach((ball) => {
        if (!hit.push && ball.checkCollision(path)) {
          hit.push = { x: player.x + player.width / 2 - ball.x, y: player.y + player.height / 2 - ball.y };
        }
      });
      this.comets.forEach((comet) => {
        if (!hit.push && comet.checkCollision(path)) hit.push = { x: comet.vx, y: comet.vy };
      });
      if (hit.push) {
        this.credit(player, "traffic", now);
        this.hitPlayer(player, now, hit.push);
      }
    });

    this.topUpField();
  }

  /**
   * A hit. With gems, half of them burst out and the player blinks for a moment, safe from
   * traffic; with none left, they're knocked out.
   */
  hitPlayer(player: PlayerSchema, now: number = Date.now(), push?: { x: number; y: number }): void {
    if (player.gems < GEMS.SURVIVE_AT) {
      this.knockOutWithGems(player, now);
      return;
    }
    const lost = Math.max(1, Math.ceil(player.gems * GEMS.SPRAY_SHARE));
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    player.setGems(player.gems - lost, this.worldWidth, this.worldHeight);
    player.recover(now);
    this.sprayGems(centerX, centerY, lost, now, player.sessionId);
    // Knocked into a skid, so whoever caused it has the first go at the spilled gems
    if (push) player.skid(push.x, push.y, Math.max(PUSH.SKID_MIN, player.width * PUSH.SKID_BODY_LENGTHS));
  }

  /** Knocked out: any last gems burst out where the player was */
  private knockOutWithGems(player: PlayerSchema, now: number): void {
    const left = player.gems;
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    if (left > 0) player.setGems(0, this.worldWidth, this.worldHeight);
    player.knockOut(now);
    if (left > 0) this.sprayGems(centerX, centerY, left, now, player.sessionId);
  }

  /**
   * A clearly bigger player moving into a smaller one: a hard shove that spills their gems, by how
   * much bigger (PUSH.BODY_CHECK_TIERS); at BODY_CHECK_KO_AT and up, a victim under GEMS.SURVIVE_AT
   * gems is knocked out. A dash has already shoved and is plainly fast, so `dashed` skips both.
   * Returns whether it happened.
   */
  private bodyCheck(attacker: PlayerSchema, victim: PlayerSchema, now: number, dashed = false): boolean {
    const ratio = attacker.width / victim.width;
    const tier = PUSH.BODY_CHECK_TIERS.find((t) => ratio >= t.at);
    if (!tier) return false;
    const dx = victim.x + victim.width / 2 - (attacker.x + attacker.width / 2);
    const dy = victim.y + victim.height / 2 - (attacker.y + attacker.height / 2);
    const distance = Math.hypot(dx, dy) || 1;
    if (!dashed) {
      // Only when the big player is really moving into them: never for drifting or standing still
      const moving = attacker.velocity();
      if ((moving.x * dx + moving.y * dy) / distance < PUSH.BODY_CHECK_SPEED * moveSpeed(attacker.width)) return false;
    }
    // The lowest tier only shoves harder; the bigger tiers strip gems, once per immunity window
    if (tier.spill > 0 && !victim.takeBounty(now)) return false;
    this.impact(attacker, victim);
    if (ratio >= PUSH.BODY_CHECK_KO_AT && victim.gems < GEMS.SURVIVE_AT) {
      this.knockOutWithGems(victim, now);
      this.credit(victim, "crush", now, attacker.sessionId);
      return true;
    }
    if (!dashed) victim.shoveAlong(dx, dy, tier.shove, attacker.sessionId, now, "crush");
    const loose = tier.spill > 0 ? Math.min(victim.gems, PUSH.BODY_CHECK_MAX_SPILL, Math.max(1, Math.ceil(victim.gems * tier.spill))) : 0;
    if (loose > 0) {
      const centerX = victim.x + victim.width / 2;
      const centerY = victim.y + victim.height / 2;
      victim.setGems(victim.gems - loose, this.worldWidth, this.worldHeight);
      this.sprayGems(centerX, centerY, loose, now, victim.sessionId);
    }
    return true;
  }

  /**
   * A dash that runs into another player stops there and shoves them along it, farther if the
   * dasher is heavier; shoving the leader knocks some of their gems loose. Players who just
   * arrived are passed straight through.
   */
  private checkDash(dasher: PlayerSchema, fromX: number, fromY: number, now: number): void {
    // Everything the dash passed over this tick counts, so it can't skip over a small player
    const path = {
      x: Math.min(fromX, dasher.x),
      y: Math.min(fromY, dasher.y),
      width: dasher.width + Math.abs(dasher.x - fromX),
      height: dasher.height + Math.abs(dasher.y - fromY),
    };
    const along = dasher.dashDirection();
    const hit: { target: PlayerSchema | null; distance: number } = { target: null, distance: Infinity };
    this.players.forEach((other) => {
      if (other === dasher || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected) return;
      if (!(path.x < other.x + other.width && path.x + path.width > other.x && path.y < other.y + other.height && path.y + path.height > other.y)) return;
      const distance = (other.x - fromX) * along.x + (other.y - fromY) * along.y;
      if (distance < hit.distance) {
        hit.target = other;
        hit.distance = distance;
      }
    });
    const target = hit.target;
    if (!target) return;
    dasher.endDash();
    const leader = this.leader();
    const power = dasher.hitPower();
    const weightRatio = dasher.weight() / target.weight();
    const distance =
      power < 0
        ? PUSH.DISTANCE * Math.min(PUSH.MAX_RATIO, Math.max(PUSH.MIN_RATIO, weightRatio))
        : // A slingshot mostly ignores weight: the small player's equalizer
          (PUSH.SLING_PUSH_MIN + (PUSH.SLING_PUSH_MAX - PUSH.SLING_PUSH_MIN) * power) *
          Math.min(PUSH.SLING_WEIGHT_MAX, Math.max(PUSH.SLING_WEIGHT_MIN, Math.pow(weightRatio, PUSH.SLING_WEIGHT_POWER)));
    if (!target.shoveAlong(along.x, along.y, distance, dasher.sessionId, now, power < 0 ? "dash" : "sling")) return;
    this.impact(dasher, target);
    dasher.dropProtection();
    // A plain dash from a clearly bigger player spills gems like any body-check
    if (power < 0) this.bodyCheck(dasher, target, now, true);
    // A dash only shoves. A slingshot hit also knocks gems loose: more for a harder charge, scaled
    // a little by size, and at least a couple from the leader; at most once every
    // PUSH.LEADER_BOUNTY_COOLDOWN_MS per player so nobody can be farmed
    if (power >= 0 && target.takeBounty(now)) {
      // A slingshot hit steals gems straight into the attacker: a share, more for a harder charge.
      // A full-power hit, or one that leaves them under GEMS.SURVIVE_AT, eats them whole
      const size = Math.min(PUSH.KNOCK_SIZE_MAX, Math.max(PUSH.KNOCK_SIZE_MIN, Math.sqrt(weightRatio)));
      const share = (PUSH.KNOCK_SHARE_SLING_MIN + (PUSH.KNOCK_SHARE_SLING_MAX - PUSH.KNOCK_SHARE_SLING_MIN) * power) * size;
      let taken = target.gems > 0 ? Math.min(Math.max(1, Math.ceil(target.gems * share)), PUSH.KNOCK_MAX_SLING) : 0;
      if (target === leader) taken = Math.max(taken, PUSH.LEADER_BOUNTY_MIN);
      taken = Math.min(taken, target.gems);
      const eaten = power >= 0.97 || target.gems - taken < GEMS.SURVIVE_AT;
      if (eaten) taken = target.gems;
      const centerX = target.x + target.width / 2;
      const centerY = target.y + target.height / 2;
      const kept = Math.min(taken, Math.max(0, GEMS.MAX_HELD - dasher.gems));
      if (kept > 0) dasher.setGems(dasher.gems + kept, this.worldWidth, this.worldHeight);
      if (eaten) {
        target.setGems(0, this.worldWidth, this.worldHeight);
        target.knockOut(now);
      } else {
        target.setGems(target.gems - taken, this.worldWidth, this.worldHeight);
      }
      // A full-size attacker can't hold more: the rest bursts out where the target was
      if (taken > kept) this.sprayGems(centerX, centerY, taken - kept, now);
      this.credit(target, "sling", now, dasher.sessionId, { gems: kept, eaten });
    }
  }

  /** Players walking into each other are gently pushed apart, the lighter one more (dashing is what shoves) */
  private nudgeApart(player: PlayerSchema, now: number): void {
    if (player.state !== PLAYER_STATE.ALIVE || player.spawnProtected) return;
    this.players.forEach((other) => {
      if (other === player || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected) return;
      const overlapX = Math.min(player.x + player.width, other.x + other.width) - Math.max(player.x, other.x);
      const overlapY = Math.min(player.y + player.height, other.y + other.height) - Math.max(player.y, other.y);
      if (overlapX <= 0 || overlapY <= 0) return;
      // A clearly bigger player barging in hits hard instead
      if (this.bodyCheck(player, other, now)) return;
      const share = other.weight() / (player.weight() + other.weight());
      if (overlapX < overlapY) {
        const sign = player.x + player.width / 2 < other.x + other.width / 2 ? -1 : 1;
        player.nudge(sign * overlapX * share, 0, this.worldWidth, this.worldHeight);
        other.nudge(-sign * overlapX * (1 - share), 0, this.worldWidth, this.worldHeight);
      } else {
        const sign = player.y + player.height / 2 < other.y + other.height / 2 ? -1 : 1;
        player.nudge(0, sign * overlapY * share, this.worldWidth, this.worldHeight);
        other.nudge(0, -sign * overlapY * (1 - share), this.worldWidth, this.worldHeight);
      }
    });
  }

  /**
   * The traffic cycle: calm, then (every minute or three) a "Traffic incoming" warning, then a wave
   * that streams everything in for TRAFFIC.WAVE_MS before the arena clears again. A wave never
   * runs alongside an arena shift: if one is due soon, the wave waits until it's over.
   */
  private updateTraffic(): void {
    if (!this.trafficOn) return;
    if (this.alwaysTraffic) {
      if (this.trafficWave !== "wave") this.startWave();
      return;
    }
    const t = this.time;
    if (this.trafficWave === "wave" && t >= this.waveAt) {
      this.trafficWave = "calm";
      this.nextWaveAt = t + TRAFFIC.WAVE_GAP_MIN_MS + Math.random() * (TRAFFIC.WAVE_GAP_MAX_MS - TRAFFIC.WAVE_GAP_MIN_MS);
    } else if (this.trafficWave === "calm" && t >= this.nextWaveAt) {
      const clearOfShift =
        this.shiftPhase === "normal" &&
        this.phaseEndsAt - t > TRAFFIC.WAVE_WARNING_MS + TRAFFIC.WAVE_MS + TRAFFIC.WAVE_SHIFT_MARGIN_MS;
      if (clearOfShift) {
        this.trafficWave = "warning";
        this.waveAt = t + TRAFFIC.WAVE_WARNING_MS;
      } else {
        this.nextWaveAt = t + 5000;
      }
    } else if (this.trafficWave === "warning" && t >= this.waveAt) {
      this.startWave();
    }
  }

  /** A traffic wave begins: comets and balls stream in (lane traffic enters as its lanes allow) */
  private startWave(): void {
    this.trafficWave = "wave";
    this.waveAt = this.time + TRAFFIC.WAVE_MS;
    this.comets.forEach((comet, index) => comet.launch(this.worldWidth, this.worldHeight, index >= COMETS.STRAIGHT));
    this.balls.forEach((ball) => ball.enter(this.worldWidth, this.worldHeight));
  }

  /** Force the traffic cycle: "calm" (clears it now), "warning", "wave", or "always" (never calm). For the automated test */
  forceTraffic(phase: string): void {
    this.trafficOn = true;
    this.alwaysTraffic = phase === "always";
    if (phase === "calm") {
      this.trafficWave = "calm";
      this.nextWaveAt = this.time + 600000;
      this.obstacles.forEach((obstacle) => obstacle.park());
      this.comets.forEach((comet) => comet.placeAt(-500, -500));
      this.balls.forEach((ball) => ball.park());
    } else if (phase === "warning") {
      this.trafficWave = "warning";
      this.waveAt = this.time + TRAFFIC.WAVE_WARNING_MS;
    } else if (phase === "wave" || phase === "always") {
      this.startWave();
    }
  }

  /** Give every traffic lane a new direction and speed */
  private reshuffleLanes(): void {
    this.lanes = [];
    for (let i = 0; i < 2 * TRAFFIC.LANES; i++) {
      this.lanes.push({
        direction: Math.random() < 0.5 ? 1 : -1,
        speed: ARENA_RULES.OBSTACLE_SPEED * (0.8 + Math.random() * 0.4),
      });
    }
  }

  /**
   * Send an obstacle into a lane where it keeps a fair distance from the rest of the traffic:
   * entering at the lane's edge (or, with `spread`, anywhere along it when the world starts).
   * Returns false if no lane is safe to enter right now.
   */
  private launchObstacle(obstacle: ObstacleSchema, spread: boolean): boolean {
    const { OBSTACLE_MIN_LENGTH, OBSTACLE_MAX_LENGTH } = ARENA_RULES;
    const laneWidth = this.worldWidth / TRAFFIC.LANES;
    for (let attempt = 0; attempt < 12; attempt++) {
      const lane = Math.floor(Math.random() * this.lanes.length);
      const horizontal = lane < TRAFFIC.LANES;
      const { direction, speed } = this.lanes[lane];
      const length = Math.round(OBSTACLE_MIN_LENGTH + Math.random() * (OBSTACLE_MAX_LENGTH - OBSTACLE_MIN_LENGTH));
      const span = horizontal ? this.worldWidth : this.worldHeight;
      const start = spread ? Math.random() * (span - length) : direction > 0 ? -length : span;
      if (!this.laneIsClear(obstacle, lane, start, length)) continue;
      // Anywhere across the lane's width, so traffic reaches every spot over time
      const across = ((lane % TRAFFIC.LANES) + 0.5) * laneWidth + (Math.random() - 0.5) * (laneWidth - ARENA_RULES.OBSTACLE_THICKNESS);
      obstacle.enter(lane, horizontal, direction, speed, start, length, across);
      return true;
    }
    return false;
  }

  /**
   * Whether an obstacle spanning `start`..`start + length` along a lane keeps its distance:
   * TRAFFIC.MIN_GAP from others in the same lane, TRAFFIC.STAGGER from those in the lanes beside it
   */
  private laneIsClear(self: ObstacleSchema, lane: number, start: number, length: number): boolean {
    const horizontal = lane < TRAFFIC.LANES;
    let clear = true;
    this.obstacles.forEach((o) => {
      if (!clear || o === self || o.lane < 0 || (o.lane < TRAFFIC.LANES) !== horizontal) return;
      const apart = Math.abs(o.lane - lane);
      if (apart > 1) return;
      const oStart = horizontal ? o.x : o.y;
      const oLength = horizontal ? o.width : o.height;
      const distance = Math.max(oStart - (start + length), start - (oStart + oLength));
      if (distance < (apart === 0 ? TRAFFIC.MIN_GAP : TRAFFIC.STAGGER)) clear = false;
    });
    return clear;
  }

  /** Whether a point is on the floor: always outside a shift; during one (or its grace period), the new floor */
  isFloorAt(x: number, y: number): boolean {
    return !this.layout || isFloor(this.layout, x, y) || this.underground(x, y);
  }

  /** The walls nobody can pass: tunnel rock, and seals across closed entrances */
  walls(): Box[] {
    return this.tunnelsOn ? tunnelWalls(this.tunnelDoors) : NO_WALLS;
  }

  /** Whether a point is underground (in a tunnel) */
  underground(x: number, y: number): boolean {
    return this.tunnelsOn && isUnderground(x, y);
  }

  /** Whether a box overlaps a tunnel (bots keep out of them, and nobody spawns in one) */
  inTunnel(box: Box): boolean {
    return this.tunnelsOn && overlapsTunnel(box);
  }

  /** A world without tunnels (the automated test's main world) */
  disableTunnels(): void {
    this.tunnelsOn = false;
    this.tunnelDoors = "";
  }

  /** A random point on the floor that isn't in a tunnel */
  private floorPointOutsideTunnels(margin = 40): { x: number; y: number } {
    let spot = randomFloorPoint(this.layout!, margin);
    for (let tries = 0; tries < 12 && this.underground(spot.x, spot.y); tries++) spot = randomFloorPoint(this.layout!, margin);
    return spot;
  }

  /**
   * Tunnel entrances: open; closing (flashing) while a new floor is shown, if the ground outside is
   * about to drop away; closed while it's gone. They all reopen when the arena returns.
   */
  private updateDoors(): void {
    if (!this.tunnelsOn) return;
    let doors = "";
    for (const entrance of ENTRANCES) {
      const ground = !this.layout || isFloor(this.layout, entrance.outX, entrance.outY);
      doors += ground ? "o" : this.shiftPhase === "shift" ? "x" : "w";
    }
    if (doors !== this.tunnelDoors) this.tunnelDoors = doors;
  }

  /** The nearest point on the (new) floor */
  nearestFloorPoint(x: number, y: number): { x: number; y: number } {
    return this.layout ? closestFloorPoint(this.layout, x, y) : { x, y };
  }

  /** Run the arena shift: start it when it's due, move through its phases, and bring the arena back */
  private updateShift(deltaTime: number, now: number): void {
    if (this.time >= this.phaseEndsAt) {
      if (this.shiftPhase === "normal") this.startGrace(now);
      else if (this.shiftPhase === "grace") this.startShift();
      else this.endShift();
      return;
    }
    if (this.shiftPhase !== "shift" || !this.layout) return;
    const left = this.phaseEndsAt - this.time;
    if (this.time >= this.nextShowerAt) {
      this.nextShowerAt = this.time + SHIFT.SHOWER_EVERY_MS;
      // Richer as the shift goes on: 1-gem drops, then 2, then 3
      const progress = 1 - left / SHIFT.SHIFT_MS;
      this.dropGems(SHIFT.SHOWER_GEMS, progress < 1 / 3 ? 1 : progress < 2 / 3 ? 2 : 3, now);
    }
    if (!this.jackpotDropped && left <= SHIFT.JACKPOT_DROPS_WITH_MS_LEFT) {
      const spot = this.tunnelsOn ? outsideTunnels(jackpotSpot(this.layout)) : jackpotSpot(this.layout);
      this.dropJackpot(spot.x, spot.y, SHIFT.DROP_MS * 1.5);
    }
    this.updateJackpot(deltaTime);
  }

  /** Show the new shape. Nobody can be hurt while everyone gets onto it, and gems drop there to lead the way */
  private startGrace(now: number): void {
    // New traffic patterns too, so nobody memorizes them
    this.reshuffleLanes();
    const people: { x: number; y: number }[] = [];
    this.players.forEach((player) => {
      if (player.state === PLAYER_STATE.ALIVE) people.push({ x: player.x + player.width / 2, y: player.y + player.height / 2 });
    });
    let picked = pickLayout(people, this.players.size, this.lastLayoutName);
    // Every tunnel keeps at least two open entrances, so nobody underground is ever shut in
    for (let tries = 0; this.tunnelsOn && tries < 40 && !tunnelsStayOpen(picked.layout); tries++) {
      picked = pickLayout(people, this.players.size, this.lastLayoutName);
    }
    // ...and if no shape managed that on its own, open up the ground outside enough entrances
    if (this.tunnelsOn && !tunnelsStayOpen(picked.layout)) picked = { ...picked, layout: keepTunnelsOpen(picked.layout) };
    this.layout = picked.layout;
    this.lastLayoutName = picked.name;
    this.floor = layoutToString(picked.layout);
    this.shiftPhase = "grace";
    this.phaseEndsAt = this.time + SHIFT.GRACE_MS;
    this.dropGems(SHIFT.GRACE_GEMS, 1, now);
  }

  /** The rest of the arena drops away; gems lying out there move onto the floor */
  private startShift(): void {
    this.shiftPhase = "shift";
    this.phaseEndsAt = this.time + SHIFT.SHIFT_MS;
    this.nextShowerAt = this.time + SHIFT.SHOWER_EVERY_MS;
    this.jackpotDropped = false;
    const layout = this.layout;
    if (!layout) return;
    this.gems.forEach((gem) => {
      if (isFloor(layout, gem.x, gem.y)) return;
      const spot = closestFloorPoint(layout, gem.x, gem.y);
      gem.moveTo(spot.x, spot.y);
    });
  }

  /** The whole arena comes back, until the next shift */
  private endShift(): void {
    this.shiftPhase = "normal";
    this.phaseEndsAt = this.time + SHIFT.EVERY_MS;
    this.layout = null;
    this.floor = "";
    this.jackpotOn = false;
    this.jackpotHolder = "";
    this.jackpotProgress = 0;
  }

  /** Jump straight to a phase of the shift, ending after `msLeft` (used by the automated test) */
  forcePhase(phase: string, msLeft: number, now: number): void {
    if (phase === "normal") {
      this.endShift();
    } else {
      if (phase === "grace" || !this.layout) this.startGrace(now);
      if (phase === "shift") this.startShift();
    }
    this.phaseEndsAt = this.time + msLeft;
  }

  /** Gems dropping onto the floor (they can be grabbed once they land) */
  private dropGems(count: number, value: number, now: number): void {
    if (!this.layout) return;
    for (let i = 0; i < count && this.gems.size < GEMS.MAX_GEMS; i++) {
      const spot = this.floorPointOutsideTunnels();
      const gem = new GemSchema(spot.x, spot.y, value);
      gem.drop(now);
      this.gems.set(`g${this.nextGemId++}`, gem);
    }
  }

  /** The jackpot crystal drops at a spot, landing after `fallMs` */
  dropJackpot(x: number, y: number, fallMs: number): void {
    this.jackpotDropped = true;
    this.jackpotOn = true;
    this.jackpotX = Math.round(x);
    this.jackpotY = Math.round(y);
    this.jackpotLandsAt = this.time + fallMs;
    this.jackpotHolder = "";
    this.jackpotProgress = 0;
  }

  /**
   * The jackpot goes to whoever stands on it alone for JACKPOT_CLAIM_MS. A shove starts their
   * claim over, and while two or more are on it, nobody's claim moves.
   */
  private updateJackpot(deltaTime: number): void {
    if (!this.jackpotOn || this.time < this.jackpotLandsAt) return;
    const on: PlayerSchema[] = [];
    this.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE || this.underground(player.x + player.width / 2, player.y + player.height / 2)) return;
      const box = player.hitBox();
      const dx = Math.max(box.x - this.jackpotX, 0, this.jackpotX - (box.x + box.width));
      const dy = Math.max(box.y - this.jackpotY, 0, this.jackpotY - (box.y + box.height));
      if (Math.hypot(dx, dy) <= SHIFT.JACKPOT_RADIUS) on.push(player);
    });
    if (on.length === 0) {
      if (this.jackpotHolder) this.jackpotHolder = "";
      if (this.jackpotProgress) this.jackpotProgress = 0;
      return;
    }
    if (on.length > 1) return;
    const claimant = on[0];
    if (claimant.sessionId !== this.jackpotHolder || claimant.sliding) {
      this.jackpotHolder = claimant.sessionId;
      this.jackpotProgress = 0;
      if (claimant.sliding) return;
    }
    this.jackpotProgress = Math.min(1, this.jackpotProgress + (deltaTime * 1000) / SHIFT.JACKPOT_CLAIM_MS);
    if (this.jackpotProgress < 1) return;
    claimant.setGems(claimant.gems + SHIFT.JACKPOT_VALUE, this.worldWidth, this.worldHeight);
    this.jackpotOn = false;
    this.onEvent?.("jackpot", { byId: claimant.sessionId, by: claimant.name, value: SHIFT.JACKPOT_VALUE });
  }

  /**
   * Over the edge during a shift: it counts as a hit. With gems, half of them burst out and the
   * player lands back on the nearest floor, blinking; with none, they're knocked out.
   */
  private fall(player: PlayerSchema, now: number): void {
    this.credit(player, "edge", now);
    if (player.gems <= 0 || !this.layout) {
      player.knockOut(now);
      return;
    }
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    const spot = closestFloorPoint(this.layout, centerX, centerY);
    player.placeAt(spot.x - player.width / 2, spot.y - player.height / 2);
    // Skidding onward, away from the edge
    this.hitPlayer(player, now, { x: spot.x - centerX, y: spot.y - centerY });
  }

  /** If someone shoved this player just before they were hit or fell, tell everyone who did it */
  private credit(target: PlayerSchema, how: string, now: number, byId?: string, extra: Record<string, unknown> = {}): void {
    const who = byId ?? target.shovedBy(now, SHIFT.CREDIT_MS);
    const by = who ? this.players.get(who) : undefined;
    if (!by || !this.onEvent) return;
    this.onEvent("credit", {
      byId: who,
      by: by.name,
      targetId: target.sessionId,
      target: target.name,
      how,
      kind: target.lastShoveKind,
      out: target.gems <= 0,
      ...extra,
    });
  }

  /** A dash or body-check connected: browsers draw a shockwave (and jolt the two players involved) */
  private impact(attacker: PlayerSchema, victim: PlayerSchema): void {
    this.onEvent?.("impact", {
      x: Math.round((attacker.x + attacker.width / 2 + victim.x + victim.width / 2) / 2),
      y: Math.round((attacker.y + attacker.height / 2 + victim.y + victim.height / 2) / 2),
      size: attacker.width,
      byId: attacker.sessionId,
      targetId: victim.sessionId,
    });
  }

  /** Keep the world lively: bots fill in until `botFill` are playing, and make room as people arrive */
  private balanceBots(now: number): void {
    let people = 0;
    this.players.forEach((player) => {
      if (!player.isBot) people++;
    });
    const wanted = people === 0 ? 0 : Math.max(0, this.botFill - people);
    while (this.brains.size < wanted) this.addBot(now);
    while (this.brains.size > wanted) this.removeBot();
  }

  private addBot(now: number): void {
    const id = `bot-${this.nextBotId++}`;
    const taken = new Set<string>();
    this.players.forEach((player) => taken.add(player.name));
    const free = BOTS.NAMES.filter((name) => !taken.has(name));
    const bot = new PlayerSchema(id, this.nextPlayerIndex++);
    bot.name = free.length > 0 ? free[Math.floor(Math.random() * free.length)] : `Bot ${this.nextBotId}`;
    bot.isBot = true;
    this.players.set(id, bot);
    this.brains.set(id, new BotBrain());
    this.spawn(bot, now);
  }

  /** The bot with the fewest gems leaves */
  private removeBot(): void {
    const pick = { id: "", gems: Infinity };
    this.brains.forEach((_, id) => {
      const gems = this.players.get(id)?.gems ?? 0;
      if (gems < pick.gems) {
        pick.id = id;
        pick.gems = gems;
      }
    });
    this.brains.delete(pick.id);
    this.players.delete(pick.id);
  }

  /** A loose gem somewhere in the world, or at a given spot */
  addGem(x?: number, y?: number): void {
    const margin = 40;
    // Somewhere open: on the floor during a shift, and never inside a tunnel
    let spot = { x: x ?? 0, y: y ?? 0 };
    if (x === undefined || y === undefined) {
      for (let tries = 0; tries < 12; tries++) {
        spot =
          this.shiftPhase === "shift" && this.layout
            ? randomFloorPoint(this.layout)
            : { x: margin + Math.random() * (this.worldWidth - 2 * margin), y: margin + Math.random() * (this.worldHeight - 2 * margin) };
        if (!this.underground(spot.x, spot.y)) break;
      }
    }
    const gem = new GemSchema(spot.x, spot.y);
    this.gems.set(`g${this.nextGemId++}`, gem);
    this.fieldGems++;
  }

  /** Keep the field stocked: every gem picked up reappears somewhere else */
  private topUpField(): void {
    while (this.fieldGems < this.fieldGemTarget && this.gems.size < GEMS.MAX_GEMS) this.addGem();
  }

  /** Pick up every gem the player is touching */
  private collectGems(player: PlayerSchema, now: number, fromX = player.x, fromY = player.y): void {
    // Nothing can be collected underground
    if (this.underground(player.x + player.width / 2, player.y + player.height / 2)) return;
    // Everything the player passed over this tick counts, so a dash or a skid can't skip a gem
    // (unless they were moved somewhere else entirely, like a respawn)
    const moved = Math.hypot(player.x - fromX, player.y - fromY);
    const path = moved > 300
      ? player
      : {
          x: Math.min(fromX, player.x),
          y: Math.min(fromY, player.y),
          width: player.width + Math.abs(player.x - fromX),
          height: player.height + Math.abs(player.y - fromY),
        };
    let collected = 0;
    const taken: string[] = [];
    this.gems.forEach((gem, id) => {
      // Full size is the cap, like Agar.io: no more pickups (the gems stay for everyone else)
      if (player.gems + collected >= GEMS.MAX_HELD) return;
      if (!gem.touches(path, now, player.sessionId)) return;
      collected += gem.value;
      taken.push(id);
      if (!gem.sprayed) this.fieldGems--;
    });
    if (collected === 0) return;
    taken.forEach((id) => this.gems.delete(id));
    player.setGems(player.gems + collected, this.worldWidth, this.worldHeight);
  }

  /** Burst gems outward from a point, spread around the circle; big piles make bigger gems */
  private sprayGems(centerX: number, centerY: number, total: number, now: number, owner = ""): void {
    // Browsers draw a burst for anything more than a gem or two
    if (total >= 3) this.onEvent?.("burst", { x: Math.round(centerX), y: Math.round(centerY), count: total });
    const room = Math.max(1, GEMS.MAX_GEMS - this.gems.size);
    const pieces = Math.min(total, GEMS.SPRAY_PIECES, room);
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < pieces; i++) {
      const value = Math.floor(total / pieces) + (i < total % pieces ? 1 : 0);
      const gem = new GemSchema(centerX, centerY, value);
      const angle = turn + (i / pieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = GEMS.SPRAY_SPEED_MIN + Math.random() * (GEMS.SPRAY_SPEED_MAX - GEMS.SPRAY_SPEED_MIN);
      gem.spray(angle, speed, now, owner);
      this.gems.set(`g${this.nextGemId++}`, gem);
    }
  }

  /** The player with the most gems, once anyone has one */
  leader(): PlayerSchema | null {
    let leader: PlayerSchema | null = null;
    let most = 0;
    this.players.forEach((player) => {
      if (player.state === PLAYER_STATE.ALIVE && player.gems > most) {
        most = player.gems;
        leader = player;
      }
    });
    return leader;
  }

  /**
   * Put a player somewhere safe: the best of several random spots, judged by distance from
   * traffic (where it is and where it's headed), from other players and, most of all, from
   * the leader.
   */
  private spawn(player: PlayerSchema, now: number): void {
    const margin = ARENA_RULES.EDGE_MARGIN + 40;
    const size = player.width;
    const leader = this.leader();
    let best = { x: (this.worldWidth - size) / 2, y: (this.worldHeight - size) / 2 };
    let bestClearance = -Infinity;
    for (let attempt = 0; attempt < SPAWN_TRIES; attempt++) {
      // During a grace period or shift, only the (new) floor will do
      const onFloor = this.layout ? randomFloorPoint(this.layout, size / 2 + 10) : null;
      const x = onFloor ? onFloor.x - size / 2 : margin + Math.random() * (this.worldWidth - size - 2 * margin);
      const y = onFloor ? onFloor.y - size / 2 : margin + Math.random() * (this.worldHeight - size - 2 * margin);
      if (this.inTunnel({ x, y, width: size, height: size })) continue;
      const clearance = this.clearanceAt(x + size / 2, y + size / 2, player, leader);
      if (clearance > bestClearance) {
        best = { x, y };
        bestClearance = clearance;
      }
      if (clearance >= WORLD.SPAWN_CLEARANCE) break;
    }
    player.spawnAt(Math.round(best.x), Math.round(best.y), now);
  }

  /** How far a point is from the nearest danger: traffic over the next second, other players, the leader */
  private clearanceAt(cx: number, cy: number, self: PlayerSchema, leader: PlayerSchema | null): number {
    let nearest = Infinity;
    this.obstacles.forEach((o) => {
      for (const t of [0, 0.5, 1]) {
        nearest = Math.min(nearest, distanceToRect(cx, cy, o.x + o.vx * t, o.y + o.vy * t, o.width, o.height));
      }
    });
    this.comets.forEach((comet) => {
      for (const t of [0, 0.5, 1]) {
        nearest = Math.min(nearest, Math.hypot(comet.x + comet.vx * t - cx, comet.y + comet.vy * t - cy) - comet.radius);
      }
    });
    this.balls.forEach((ball) => {
      for (const t of [0, 0.5, 1]) {
        nearest = Math.min(nearest, Math.hypot(ball.x + ball.vx * t - cx, ball.y + ball.vy * t - cy) - ball.radius);
      }
    });
    this.players.forEach((other) => {
      if (other === self || other.state !== PLAYER_STATE.ALIVE) return;
      const distance = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy);
      // Another player 300 units away counts like traffic 150 away; the leader, like traffic 75 away
      nearest = Math.min(nearest, other === leader ? distance / 4 : distance / 2);
    });
    return nearest;
  }
}

// Fields sent to clients
type({ map: PlayerSchema })(GameState.prototype, "players");
type([ObstacleSchema])(GameState.prototype, "obstacles");
type([BallSchema])(GameState.prototype, "balls");
type([CometSchema])(GameState.prototype, "comets");
type({ map: GemSchema })(GameState.prototype, "gems");
type("number")(GameState.prototype, "worldWidth");
type("number")(GameState.prototype, "worldHeight");
type("number")(GameState.prototype, "time");
type("string")(GameState.prototype, "shiftPhase");
type("number")(GameState.prototype, "phaseEndsAt");
type("string")(GameState.prototype, "floor");
type("boolean")(GameState.prototype, "jackpotOn");
type("string")(GameState.prototype, "trafficWave");
type("string")(GameState.prototype, "tunnelDoors");
type("number")(GameState.prototype, "waveAt");
type("number")(GameState.prototype, "jackpotX");
type("number")(GameState.prototype, "jackpotY");
type("number")(GameState.prototype, "jackpotLandsAt");
type("string")(GameState.prototype, "jackpotHolder");
type("number")(GameState.prototype, "jackpotProgress");

export { GameState };
