import * as schema from "@colyseus/schema";
const { Schema, MapSchema, ArraySchema, type } = schema;
import { PlayerSchema } from "./PlayerSchema.js";
import { ObstacleSchema } from "./ObstacleSchema.js";
import { GemSchema } from "./GemSchema.js";
import { BallSchema } from "./BallSchema.js";
import { CometSchema } from "./CometSchema.js";
import { BombSchema } from "./BombSchema.js";
import { BotBrain } from "../game/bots.js";
import { closestFloorPoint, isFloor, jackpotSpot, layoutToString, pickLayout, randomFloorPoint } from "../game/layouts.js";
import type { Layout } from "../game/layouts.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { moveSpeed } from "../game/movement.js";
import type { Direction } from "../game/movement.js";

const { WORLD, ARENA_RULES, GEMS, PLAYER_STATE, PUSH, BOTS, SHIFT, TRAFFIC, BALLS, COMETS, INHALE, BOMBS } = GAME_CONSTANTS;
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
  bombs: schema.ArraySchema<BombSchema>;
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
    this.bombs = new ArraySchema<BombSchema>();
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
    if (BOMBS.ENABLED) this.enableBombs();
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
    this.updateInhales(now, deltaTime);
    this.updateBombs(now, deltaTime);
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
        // Clear out of a lit bomb's blast
        const escape = this.bombDanger(bot);
        if (escape) {
          if (bot.inhaling) bot.stopInhale();
          bot.steer(escape.x, escape.y);
        }
        const victim = brain.victim;
        if (move && victim && victim.state === PLAYER_STATE.ALIVE && !victim.spawnProtected) {
          const dx = victim.x + victim.width / 2 - (bot.x + bot.width / 2);
          const dy = victim.y + victim.height / 2 - (bot.y + bot.height / 2);
          if (Math.hypot(dx, dy) < (bot.width + victim.width) / 2 + BOTS.DASH_REACH) bot.requestDash(dx, dy);
        }
      }
      if (bot) this.botMouth(bot, now);
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
      player.updateMovement(this.worldWidth, this.worldHeight, now, deltaTime);
      if (player.dashing(now)) this.checkDash(player, fromX, fromY, now);
      this.nudgeApart(player, now);
      this.collectGems(player, now, fromX, fromY);
      player.decay(deltaTime, this.worldWidth, this.worldHeight);
      // A skid after a hit never carries anyone off the edge
      if (this.shiftPhase === "shift" && player.recovering && this.layout && !this.isFloorAt(player.x + player.width / 2, player.y + player.height / 2)) {
        const spot = closestFloorPoint(this.layout, player.x + player.width / 2, player.y + player.height / 2);
        player.placeAt(spot.x - player.width / 2, spot.y - player.height / 2);
      }
      // Over the edge during a shift
      if (this.shiftPhase === "shift" && !player.isSafe() && !this.isFloorAt(player.x + player.width / 2, player.y + player.height / 2)) {
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
   * Inhaling: everything in a cone in front of the creature's mouth is pulled in. Gems are
   * swallowed (they reach the mouth and are collected); a bomb stays in the mouth (safe until it's spat); a creature
   * INHALE.EAT_RATIO times smaller is dragged in (harder the closer it gets) and swallowed whole.
   */
  private updateInhales(now: number, deltaTime: number): void {
    const cone = Math.cos((INHALE.ARC * Math.PI) / 180);
    this.players.forEach((eater) => {
      if (!eater.inhaling || eater.state !== PLAYER_STATE.ALIVE) {
        if (eater.stealingFrom) this.endTheft(eater, now);
        return;
      }
      const fx = Math.cos(eater.facing);
      const fy = Math.sin(eater.facing);
      const mouthX = eater.x + eater.width / 2 + fx * eater.width * 0.3;
      const mouthY = eater.y + eater.height / 2 + fy * eater.width * 0.3;
      const reach = INHALE.REACH + eater.width * INHALE.REACH_PER_SIZE;
      /** How far (x, y) is from the mouth, if it's in the cone and within reach (else -1) */
      const inCone = (x: number, y: number, extra = 0): number => {
        const dx = x - mouthX;
        const dy = y - mouthY;
        const d = Math.hypot(dx, dy);
        if (d > reach + extra) return -1;
        if (d < 1) return d;
        return (dx * fx + dy * fy) / d >= cone ? d : -1;
      };
      this.gems.forEach((gem) => {
        const d = inCone(gem.x, gem.y);
        if (d < 1) return;
        const step = Math.min(d, INHALE.PULL_GEMS * deltaTime);
        gem.moveTo(gem.x + ((mouthX - gem.x) / d) * step, gem.y + ((mouthY - gem.y) / d) * step);
      });
      if (!eater.mouth) {
        this.bombs.forEach((bomb) => {
          if (bomb.heldBy || bomb.respawnAt || eater.mouth) return;
          const d = inCone(bomb.x, bomb.y);
          if (d < 0) return;
          if (d <= eater.width * 0.35 + bomb.radius) {
            // A lit bomb keeps ticking in your mouth
            bomb.hold(eater.sessionId);
            eater.mouth = bomb.lit() ? "lit" : "bomb";
            return;
          }
          const step = Math.min(d, INHALE.PULL_BOMBS * deltaTime);
          bomb.placeAt(bomb.x + ((mouthX - bomb.x) / d) * step, bomb.y + ((mouthY - bomb.y) / d) * step);
        });
      }
      this.players.forEach((prey) => {
        if (prey === eater || prey.state !== PLAYER_STATE.ALIVE || prey.spawnProtected) return;
        if (prey.width * INHALE.EAT_RATIO > eater.width) return;
        const px = prey.x + prey.width / 2;
        const py = prey.y + prey.height / 2;
        const d = inCone(px, py, prey.width / 2);
        if (d < 0) return;
        if (d <= eater.width * 0.35 + prey.width / 2) {
          this.swallow(eater, prey, now);
          return;
        }
        const pull = (INHALE.PULL_PREY + INHALE.PULL_PREY_CLOSE * Math.max(0, 1 - d / reach)) * deltaTime;
        prey.nudge(((mouthX - px) / d) * pull, ((mouthY - py) / d) * pull, this.worldWidth, this.worldHeight);
      });
      this.steal(eater, now, deltaTime);
    });
  }

  /** Whether `thief` is inhaling at `victim` up close: in front of its mouth, and too big to swallow */
  private canSteal(thief: PlayerSchema, victim: PlayerSchema): boolean {
    if (!thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || victim.state !== PLAYER_STATE.ALIVE || victim.spawnProtected) return false;
    if (victim.width * INHALE.EAT_RATIO <= thief.width) return false;
    const dx = victim.x + victim.width / 2 - (thief.x + thief.width / 2);
    const dy = victim.y + victim.height / 2 - (thief.y + thief.height / 2);
    const d = Math.hypot(dx, dy);
    if (d - (thief.width + victim.width) / 2 > INHALE.STEAL_REACH) return false;
    return d < 1e-6 || (dx * Math.cos(thief.facing) + dy * Math.sin(thief.facing)) / d >= Math.cos((INHALE.STEAL_ARC * Math.PI) / 180);
  }

  /**
   * Gravity theft: the nearest creature up close in front of the mouth has its gems streamed into the
   * thief. Head-on, both inhaling each other, only the stronger pull gets the stream (nearly equal
   * pulls stall).
   */
  private steal(thief: PlayerSchema, now: number, deltaTime: number): void {
    let victim: PlayerSchema | null = null;
    let nearest = Infinity;
    this.players.forEach((other) => {
      if (other === thief || other.gems <= 0 || !this.canSteal(thief, other)) return;
      const d = Math.hypot(other.x - thief.x, other.y - thief.y);
      if (d < nearest) {
        nearest = d;
        victim = other;
      }
    });
    const target = victim as PlayerSchema | null;
    const pull = Math.sqrt(thief.weight());
    const wins = !!target && (!this.canSteal(target, thief) || pull >= Math.sqrt(target.weight()) * INHALE.TUG_EDGE);
    const from = target && wins && thief.gems < GEMS.MAX_HELD ? target.sessionId : "";
    if (from !== thief.stealingFrom) this.endTheft(thief, now, from);
    if (!target || !from) return;
    thief.stealProgress += deltaTime * INHALE.STEAL_RATE * pull;
    while (thief.stealProgress >= 1 && target.gems > 0 && thief.gems < GEMS.MAX_HELD) {
      thief.stealProgress -= 1;
      target.setGems(target.gems - 1, this.worldWidth, this.worldHeight);
      thief.setGems(thief.gems + 1, this.worldWidth, this.worldHeight);
      thief.stolenRun += 1;
    }
    // Being inhaled drags you toward the thief's mouth, harder the bigger the thief: walking away
    // isn't enough, so a victim dashes free or turns and inhales back
    if (target.sliding) return;
    const tx = target.x + target.width / 2;
    const ty = target.y + target.height / 2;
    const mx = thief.x + thief.width / 2 + Math.cos(thief.facing) * thief.width * 0.5;
    const my = thief.y + thief.height / 2 + Math.sin(thief.facing) * thief.width * 0.5;
    const d = Math.hypot(mx - tx, my - ty);
    const snug = target.width / 2 + 4;
    if (d <= snug) return;
    const drag = INHALE.DRAG * Math.min(2, Math.max(0.5, Math.sqrt(thief.weight() / target.weight()))) * deltaTime;
    const step = Math.min(drag, d - snug);
    target.nudge(((mx - tx) / d) * step, ((my - ty) / d) * step, this.worldWidth, this.worldHeight);
  }

  /** A run of stealing ends (or switches to someone else): a big one gets a banner and a line in the feed */
  private endTheft(thief: PlayerSchema, now: number, next = ""): void {
    const victim = thief.stealingFrom ? this.players.get(thief.stealingFrom) : undefined;
    if (victim && thief.stolenRun >= INHALE.STOLE_NOTICE) this.credit(victim, "stole", now, thief.sessionId, { gems: thief.stolenRun });
    thief.stolenRun = 0;
    thief.stealProgress = 0;
    if (thief.stealingFrom !== next) thief.stealingFrom = next;
  }

  /** Bombs in the arena (switched off by BOMBS.ENABLED; the automated test switches them on) */
  enableBombs(): void {
    if (this.bombs.length > 0) return;
    for (let i = 0; i < BOMBS.COUNT; i++) {
      this.bombs.push(new BombSchema(80 + Math.random() * (this.worldWidth - 160), 80 + Math.random() * (this.worldHeight - 160)));
    }
  }

  /** Swallowed whole: knocked out, and all their gems go to the eater (what it can't hold bursts out) */
  private swallow(eater: PlayerSchema, prey: PlayerSchema, now: number): void {
    const gems = prey.gems;
    const kept = Math.min(gems, Math.max(0, GEMS.MAX_HELD - eater.gems));
    const centerX = prey.x + prey.width / 2;
    const centerY = prey.y + prey.height / 2;
    if (kept > 0) eater.setGems(eater.gems + kept, this.worldWidth, this.worldHeight);
    prey.setGems(0, this.worldWidth, this.worldHeight);
    prey.knockOut(now);
    if (gems > kept) this.sprayGems(centerX, centerY, gems - kept, now);
    this.credit(prey, "ate", now, eater.sessionId, { gems: kept });
  }

  /** Spit the bomb in the mouth along (x, y) (or the way the creature faces): it slides, and its fuse starts */
  spit(player: PlayerSchema, x: number, y: number, now: number): void {
    if (player.state !== PLAYER_STATE.ALIVE || !player.mouth || now < player.spitReadyAt) return;
    let held: BombSchema | null = null;
    this.bombs.forEach((bomb) => {
      if (bomb.heldBy === player.sessionId) held = bomb;
    });
    const bomb = held as BombSchema | null;
    player.mouth = "";
    if (!bomb) return;
    const length = Math.hypot(x, y);
    const dx = Number.isFinite(length) && length > 1e-6 ? x / length : Math.cos(player.facing);
    const dy = Number.isFinite(length) && length > 1e-6 ? y / length : Math.sin(player.facing);
    const out = player.width / 2 + bomb.radius + 2;
    bomb.launch(player.x + player.width / 2 + dx * out, player.y + player.height / 2 + dy * out, dx, dy, BOMBS.SPIT_SPEED, player.sessionId);
    // The fuse starts now (a bomb caught already lit keeps its fuse)
    if (!bomb.lit()) bomb.explodesAt = this.time + BOMBS.FUSE_MS;
    player.facing = Math.atan2(dy, dx);
    player.spitReadyAt = now + BOMBS.SPIT_COOLDOWN_MS;
  }

  /**
   * Bombs: back after going off; safe in a mouth unless lit (then it goes off right there); dropped
   * where a holder was if they're gone; sliding, nudged by anyone walking into it, kicked by a dash;
   * and going off when the fuse runs down
   */
  private updateBombs(now: number, deltaTime: number): void {
    this.bombs.forEach((bomb) => {
      if (bomb.respawnAt) {
        if (this.time < bomb.respawnAt) return;
        bomb.respawnAt = 0;
        const spot = this.layout ? randomFloorPoint(this.layout) : { x: 80 + Math.random() * (this.worldWidth - 160), y: 80 + Math.random() * (this.worldHeight - 160) };
        bomb.placeAt(spot.x, spot.y);
        return;
      }
      if (bomb.heldBy) {
        const holder = this.players.get(bomb.heldBy);
        if (holder && holder.state === PLAYER_STATE.ALIVE && holder.mouth) {
          const mouth = bomb.lit() ? "lit" : "bomb";
          if (holder.mouth !== mouth) holder.mouth = mouth;
          if (!bomb.lit() || this.time < bomb.explodesAt) return;
          // Went off in their mouth
          holder.mouth = "";
          bomb.heldBy = "";
          bomb.placeAt(holder.x + holder.width / 2, holder.y + holder.height / 2);
          this.explode(bomb, now);
          return;
        }
        if (holder) holder.mouth = "";
        bomb.heldBy = "";
        const x = holder ? holder.x + holder.width / 2 : this.worldWidth / 2;
        const y = holder ? holder.y + holder.height / 2 : this.worldHeight / 2;
        bomb.placeAt(Math.max(bomb.radius, Math.min(x, this.worldWidth - bomb.radius)), Math.max(bomb.radius, Math.min(y, this.worldHeight - bomb.radius)));
      }
      bomb.update(deltaTime, this.worldWidth, this.worldHeight);
      this.players.forEach((player) => {
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
        if (player.dashing(now)) {
          // Kicked
          const along = player.dashDirection();
          bomb.launch(bomb.x, bomb.y, along.x, along.y, BOMBS.KICK_SPEED, player.sessionId);
          return;
        }
        // Nudged out of the way, rolling off a little
        const moving = player.velocity();
        const push = Math.max(60, moving.x * nx + moving.y * ny) * 1.1;
        bomb.x = cx + nx * reach;
        bomb.y = cy + ny * reach;
        bomb.vx = nx * push;
        bomb.vy = ny * push;
      });
      if (bomb.lit() && this.time >= bomb.explodesAt) this.explode(bomb, now);
    });
  }

  /**
   * A bomb goes off: everyone in the blast is knocked outward (lighter creatures farther) and has
   * gems knocked loose, more near the middle; under GEMS.SURVIVE_AT gems it knocks them out. Other
   * bombs caught in it go off a moment later. Credit goes to whoever spat or kicked it last.
   */
  private explode(bomb: BombSchema, now: number): void {
    const x = bomb.x;
    const y = bomb.y;
    const by = bomb.thrownBy;
    bomb.vanish(this.time + BOMBS.RESPAWN_MS);
    this.onEvent?.("blast", { x: Math.round(x), y: Math.round(y), radius: BOMBS.BLAST_RADIUS });
    this.players.forEach((target) => {
      if (target.state !== PLAYER_STATE.ALIVE || target.spawnProtected) return;
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
        this.knockOutWithGems(target, now);
        if (credited) this.credit(target, "bomb", now, by, { gems: 0 });
        return;
      }
      const share = BOMBS.SHARE_MIN + (BOMBS.SHARE_MAX - BOMBS.SHARE_MIN) * strength;
      const loose = Math.min(target.gems, BOMBS.LOOSE_MAX, Math.max(1, Math.ceil(target.gems * share)));
      target.setGems(target.gems - loose, this.worldWidth, this.worldHeight);
      this.sprayGems(tx, ty, loose, now, target.sessionId);
      if (credited) this.credit(target, "bomb", now, by, { gems: loose });
    });
    this.bombs.forEach((other) => {
      if (other === bomb || other.respawnAt || other.heldBy) return;
      if (Math.hypot(other.x - x, other.y - y) > BOMBS.BLAST_RADIUS + other.radius) return;
      const soon = this.time + BOMBS.CHAIN_MS;
      if (!other.lit() || other.explodesAt > soon) other.explodesAt = soon;
    });
  }

  /**
   * Bots swallow smaller creatures, pick up bombs, and spit them at a good target: someone big,
   * slow, or rooted while inhaling. A lit bomb in the mouth goes straight back out.
   */
  private botMouth(bot: PlayerSchema, now: number): void {
    if (bot.state !== PLAYER_STATE.ALIVE || bot.sliding || bot.recovering) return;
    const cx = bot.x + bot.width / 2;
    const cy = bot.y + bot.height / 2;
    if (bot.mouth) {
      let target: PlayerSchema | null = null;
      let best = -Infinity;
      this.players.forEach((other) => {
        if (other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected) return;
        const d = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy);
        if (d < 140 || d > 360) return;
        const score = other.width + (other.inhaling ? 60 : 0) - d * 0.1;
        if (score > best) {
          best = score;
          target = other;
        }
      });
      const aim = target as PlayerSchema | null;
      if (bot.mouth === "lit") {
        this.spit(bot, aim ? aim.x + aim.width / 2 - cx : Math.cos(bot.facing), aim ? aim.y + aim.height / 2 - cy : Math.sin(bot.facing), now);
      } else if (aim && Math.random() < 0.03) {
        this.spit(bot, aim.x + aim.width / 2 - cx + (Math.random() - 0.5) * 60, aim.y + aim.height / 2 - cy + (Math.random() - 0.5) * 60, now);
      }
      return;
    }
    // Inhaling: keep the mouth on whoever it's robbing
    if (bot.inhaling) {
      const robbing = bot.stealingFrom ? this.players.get(bot.stealingFrom) : undefined;
      if (robbing) bot.aimAt(robbing.x + robbing.width / 2 - cx, robbing.y + robbing.height / 2 - cy);
      return;
    }
    if (Math.random() > 0.12) return;
    // Someone stealing from this bot: it turns and fights back, or dashes free
    let thief: PlayerSchema | null = null;
    this.players.forEach((other) => {
      if (other.stealingFrom === bot.sessionId) thief = other;
    });
    const robber = thief as PlayerSchema | null;
    if (robber) {
      const toX = robber.x + robber.width / 2 - cx;
      const toY = robber.y + robber.height / 2 - cy;
      if (Math.random() < 0.55) {
        bot.startInhale(now, 900 + Math.random() * 600);
        bot.aimAt(toX, toY);
      } else {
        bot.requestDash(-toX, -toY);
      }
      return;
    }
    const reach = INHALE.REACH + bot.width * INHALE.REACH_PER_SIZE;
    let want: { x: number; y: number } | null = null;
    let nearest = reach;
    this.players.forEach((other) => {
      if (other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.width * INHALE.EAT_RATIO > bot.width) return;
      const d = Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy);
      if (d < nearest) {
        nearest = d;
        want = { x: other.x + other.width / 2, y: other.y + other.height / 2 };
      }
    });
    // Nothing to swallow: steal from someone close who isn't facing this way
    this.players.forEach((other) => {
      if (want || other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.gems < 3) return;
      const ox = other.x + other.width / 2;
      const oy = other.y + other.height / 2;
      const d = Math.hypot(ox - cx, oy - cy);
      if (d - (bot.width + other.width) / 2 > INHALE.STEAL_REACH + 20) return;
      if (((cx - ox) * Math.cos(other.facing) + (cy - oy) * Math.sin(other.facing)) / Math.max(d, 1e-6) > 0.3) return;
      want = { x: ox, y: oy };
    });
    this.bombs.forEach((bomb) => {
      if (bomb.heldBy || bomb.respawnAt || bomb.lit()) return;
      const d = Math.hypot(bomb.x - cx, bomb.y - cy);
      if (d < Math.min(nearest, 170)) {
        nearest = d;
        want = { x: bomb.x, y: bomb.y };
      }
    });
    const goal = want as { x: number; y: number } | null;
    if (!goal) return;
    bot.startInhale(now, 700 + Math.random() * 600);
    bot.aimAt(goal.x - cx, goal.y - cy);
  }

  /** Which way a bot should run to get clear of a lit bomb about to go off (null when it's safe) */
  private bombDanger(bot: PlayerSchema): { x: number; y: number } | null {
    const cx = bot.x + bot.width / 2;
    const cy = bot.y + bot.height / 2;
    let escape: { x: number; y: number } | null = null;
    this.bombs.forEach((bomb) => {
      if (escape || !bomb.lit() || bomb.heldBy || bomb.respawnAt) return;
      const d = Math.hypot(cx - bomb.x, cy - bomb.y);
      if (d > BOMBS.BLAST_RADIUS + bot.width / 2 + 40 || bomb.explodesAt - this.time > 1600) return;
      escape = d > 1e-6 ? { x: (cx - bomb.x) / d, y: (cy - bomb.y) / d } : { x: 1, y: 0 };
    });
    return escape as { x: number; y: number } | null;
  }

  /**
   * A dash that runs into another creature stops at the moment of contact and shoves them along it,
   * farther if the dasher is heavier, and bounces back off them, bumper-car style (the lighter one
   * farther). No gems change hands. Players who just arrived are passed straight through.
   */
  private checkDash(dasher: PlayerSchema, fromX: number, fromY: number, now: number): void {
    // Swept along everything the dash crossed this tick (as circles), so it can't skip past anyone
    const radius = dasher.width / 2;
    const startX = fromX + radius;
    const startY = fromY + radius;
    const moveX = dasher.x - fromX;
    const moveY = dasher.y - fromY;
    const hit: { target: PlayerSchema | null; t: number } = { target: null, t: Infinity };
    this.players.forEach((other) => {
      if (other === dasher || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected) return;
      const reach = radius + other.width / 2;
      const fx = startX - (other.x + other.width / 2);
      const fy = startY - (other.y + other.height / 2);
      const a = moveX * moveX + moveY * moveY;
      const b = 2 * (fx * moveX + fy * moveY);
      const c = fx * fx + fy * fy - reach * reach;
      let t = 0;
      if (c > 0) {
        const disc = b * b - 4 * a * c;
        if (a < 1e-9 || disc < 0) return;
        t = (-b - Math.sqrt(disc)) / (2 * a);
        if (t < 0 || t > 1) return;
      }
      if (t < hit.t) {
        hit.target = other;
        hit.t = t;
      }
    });
    const target = hit.target;
    if (!target) return;
    const along = dasher.dashDirection();
    dasher.x = fromX + moveX * hit.t;
    dasher.y = fromY + moveY * hit.t;
    dasher.endDash();
    const weightRatio = dasher.weight() / target.weight();
    const distance = PUSH.DISTANCE * Math.min(PUSH.MAX_RATIO, Math.max(PUSH.MIN_RATIO, weightRatio));
    if (!target.shoveAlong(along.x, along.y, distance, dasher.sessionId, now, "dash")) return;
    this.impact(dasher, target);
    dasher.dropProtection();
    // Bumper cars: the dash bounces back off whoever it hits, the lighter one farther
    dasher.shoveAlong(-along.x, -along.y, PUSH.BOUNCE * Math.min(PUSH.MAX_RATIO, Math.max(PUSH.MIN_RATIO, 1 / weightRatio)), target.sessionId, now, "bump");
  }

  /**
   * Creatures that touch are pushed apart (as circles), the lighter one more. Running into someone
   * at speed is a bumper-car bump: both bounce apart, the lighter one farther. No gems change hands,
   * and an inhaling creature presses up against whoever it runs into instead of bouncing off.
   */
  private nudgeApart(player: PlayerSchema, now: number): void {
    if (player.state !== PLAYER_STATE.ALIVE || player.spawnProtected) return;
    this.players.forEach((other) => {
      if (other === player || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected) return;
      const dx = other.x + other.width / 2 - (player.x + player.width / 2);
      const dy = other.y + other.height / 2 - (player.y + player.height / 2);
      const distance = Math.hypot(dx, dy);
      const overlap = (player.width + other.width) / 2 - distance;
      if (overlap <= 0) return;
      const nx = distance > 1e-6 ? dx / distance : 1;
      const ny = distance > 1e-6 ? dy / distance : 0;
      const share = other.weight() / (player.weight() + other.weight());
      const moving = player.velocity();
      // (An inhaling creature presses up against whoever it runs into instead of bouncing off, so a theft isn't broken)
      if (!player.inhaling && !player.sliding && !other.sliding && moving.x * nx + moving.y * ny >= PUSH.BUMP_SPEED * moveSpeed(player.width)) {
        other.shoveAlong(nx, ny, PUSH.BUMP * 2 * (1 - share), player.sessionId, now, "bump");
        player.shoveAlong(-nx, -ny, PUSH.BUMP * 2 * share, other.sessionId, now, "bump");
        this.impact(player, other);
        return;
      }
      player.nudge(-nx * overlap * share, -ny * overlap * share, this.worldWidth, this.worldHeight);
      other.nudge(nx * overlap * (1 - share), ny * overlap * (1 - share), this.worldWidth, this.worldHeight);
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
    return !this.layout || isFloor(this.layout, x, y);
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
      const spot = jackpotSpot(this.layout);
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
    const picked = pickLayout(people, this.players.size, this.lastLayoutName);
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
      const spot = randomFloorPoint(this.layout);
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
      if (player.state !== PLAYER_STATE.ALIVE) return;
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
    // During a shift, new gems appear on the floor
    const spot = this.shiftPhase === "shift" && this.layout ? randomFloorPoint(this.layout) : null;
    const gem = new GemSchema(
      x ?? spot?.x ?? margin + Math.random() * (this.worldWidth - 2 * margin),
      y ?? spot?.y ?? margin + Math.random() * (this.worldHeight - 2 * margin)
    );
    this.gems.set(`g${this.nextGemId++}`, gem);
    this.fieldGems++;
  }

  /** Keep the field stocked: every gem picked up reappears somewhere else */
  private topUpField(): void {
    while (this.fieldGems < this.fieldGemTarget && this.gems.size < GEMS.MAX_GEMS) this.addGem();
  }

  /** Pick up every gem the player is touching */
  private collectGems(player: PlayerSchema, now: number, fromX = player.x, fromY = player.y): void {
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
type([BombSchema])(GameState.prototype, "bombs");
type({ map: GemSchema })(GameState.prototype, "gems");
type("number")(GameState.prototype, "worldWidth");
type("number")(GameState.prototype, "worldHeight");
type("number")(GameState.prototype, "time");
type("string")(GameState.prototype, "shiftPhase");
type("number")(GameState.prototype, "phaseEndsAt");
type("string")(GameState.prototype, "floor");
type("boolean")(GameState.prototype, "jackpotOn");
type("string")(GameState.prototype, "trafficWave");
type("number")(GameState.prototype, "waveAt");
type("number")(GameState.prototype, "jackpotX");
type("number")(GameState.prototype, "jackpotY");
type("number")(GameState.prototype, "jackpotLandsAt");
type("string")(GameState.prototype, "jackpotHolder");
type("number")(GameState.prototype, "jackpotProgress");

export { GameState };
