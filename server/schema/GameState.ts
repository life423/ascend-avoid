import * as schema from "@colyseus/schema";
const { Schema, MapSchema, ArraySchema, type } = schema;
import { PlayerSchema } from "./PlayerSchema.js";
import { ObstacleSchema } from "./ObstacleSchema.js";
import { GemSchema } from "./GemSchema.js";
import { BallSchema } from "./BallSchema.js";
import { CometSchema } from "./CometSchema.js";
import { BombSchema } from "./BombSchema.js";
import { TurbineFlightSchema, TurbineSchema } from "./TurbineSchema.js";
import { CoreSchema } from "./CoreSchema.js";
import { airflowOnCore, bodyMass, impactStunMs, stepCore } from "../game/corePhysics.js";
import { airflowQuality, cleanAir, latchSizeFactor, lethalShare, pressureBuild, pressureBuildSeconds } from "../game/airflow.js";
import { BotBrain } from "../game/bots.js";
import { closestFloorPoint, isFloor, jackpotSpot, layoutToString, pickLayout, randomFloorPoint } from "../game/layouts.js";
import type { Layout } from "../game/layouts.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { moveSpeed } from "../game/movement.js";
import { exhaustAngle } from "../game/turbine.js";
import type { Direction } from "../game/movement.js";

const { WORLD, ARENA_RULES, GEMS, PLAYER_STATE, PUSH, BOTS, SHIFT, TRAFFIC, BALLS, COMETS, INHALE, BOMBS, TURBINE, SUCTION, CORE, LATCH } = GAME_CONSTANTS;
/** Which way each of a bot's decisions steers it */
const STEER: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** How strongly suction moves a body: the puller's width over the target's, softened and kept in bounds (see SUCTION) */
function suctionScale(pullerWidth: number, targetWidth: number): number {
  return Math.min(SUCTION.MAX, Math.max(SUCTION.MIN, Math.pow(pullerWidth / Math.max(1, targetWidth), SUCTION.SOFTEN)));
}

/** How many random spots to try when looking for a safe place to (re)spawn */
const SPAWN_TRIES = 24;

/** Distance from a point to a rectangle (0 when the point is inside it) */
function distanceToRect(px: number, py: number, x: number, y: number, width: number, height: number): number {
  const dx = Math.max(x - px, 0, px - (x + width));
  const dy = Math.max(y - py, 0, py - (y + height));
  return Math.hypot(dx, dy);
}

/** How much harder gems come off someone held in an airflow this long without a break (INHALE.DRAIN_RAMP) */
function drainRamp(held: number): number {
  let times = 1;
  for (const [at, multiplier] of INHALE.DRAIN_RAMP) if (held >= at) times = multiplier;
  return times;
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
  /** Turbines, and the gems on their way through them (see updateTurbines) */
  turbines: schema.ArraySchema<TurbineSchema>;
  /** Cores: heavy objects inhales push around (see game/corePhysics) */
  cores: schema.ArraySchema<CoreSchema>;
  /** Server-only: how many Cores this world keeps (test worlds ask for their own), and ids */
  private coreCount: number = CORE.COUNT;
  private nextCoreId = 1;
  flights: schema.MapSchema<TurbineFlightSchema>;
  worldWidth: number;
  worldHeight: number;
  /** The world's clock: ms since it started, as of the latest tick (browsers time traffic by it) */
  time: number;
  /** The arena shift: "normal", "grace" (the new shape is shown; nobody can be hurt) or "shift" (the rest has dropped away) */
  /** Whether arena shifts run in this world (SHIFT.ENABLED; tests can switch them on). Off, the arena stays whole and nothing about shifts shows */
  shiftsOn: boolean;
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
  /** Server-only: whether turbines come and go on their own (test worlds ask), when the next ones are due, and ids */
  private turbinesAuto: boolean = TURBINE.ENABLED;
  private turbineDue: number[] = [];
  private nextTurbineId = 1;
  private nextFlightId = 1;

  constructor(fieldGemTarget: number = GEMS.FIELD_COUNT) {
    super();
    this.players = new MapSchema<PlayerSchema>();
    this.obstacles = new ArraySchema<ObstacleSchema>();
    this.balls = new ArraySchema<BallSchema>();
    this.comets = new ArraySchema<CometSchema>();
    this.bombs = new ArraySchema<BombSchema>();
    this.gems = new MapSchema<GemSchema>();
    this.turbines = new ArraySchema<TurbineSchema>();
    this.cores = new ArraySchema<CoreSchema>();
    this.flights = new MapSchema<TurbineFlightSchema>();
    this.worldWidth = WORLD.WIDTH;
    this.worldHeight = WORLD.HEIGHT;
    this.time = 0;
    this.shiftPhase = "normal";
    this.phaseEndsAt = SHIFT.FIRST_AFTER_MS;
    this.shiftsOn = SHIFT.ENABLED;
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
    this.players.forEach((player) => player.markTick());
    this.updateShift(deltaTime, now);
    this.updateTraffic();
    this.updateInhales(now, deltaTime);
    this.updateLatches(now, deltaTime);
    this.updateBombs(now, deltaTime);
    this.updateTurbines(now, deltaTime);
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
        // Bots steer the way they decided (or stop)
        const way = move ? STEER[move] : { x: 0, y: 0 };
        bot.steer(way.x, way.y);
        // Clear out of a lit bomb's blast
        const escape = this.bombDanger(bot);
        if (escape) {
          if (bot.inhaling) bot.stopInhale();
          bot.steer(escape.x, escape.y);
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

    this.updateCores(now, deltaTime);

    this.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE) {
        if (now >= player.respawnAt) this.spawn(player, now);
        return;
      }
      const fromX = player.x;
      const fromY = player.y;
      player.updateMovement(this.worldWidth, this.worldHeight, now, deltaTime);
      this.keepApart(player);
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
   * Inhaling: everything in a cone in front of the creature's mouth. Gems are pulled in and
   * swallowed; a bomb stays in the mouth (safe until it's spat). Every creature in it is robbed
   * (steal) and pulled bodily toward the mouth by mass; one 1.3 times
   * narrower or more goes down once held at the mouth for INHALE.GULP_MS.
   */
  private updateInhales(now: number, deltaTime: number): void {
    const cone = Math.cos((INHALE.ARC * Math.PI) / 180);
    this.players.forEach((eater) => {
      if (!eater.inhaling || eater.state !== PLAYER_STATE.ALIVE) {
        if (eater.stealingFrom) this.endTheft(eater, now);
        if (eater.robbing) eater.robbing = "";
        if (eater.gulping) eater.gulping = "";
        this.fadeLocks(eater, null, deltaTime);
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
      // Every creature in the cone is pulled bodily toward the mouth, by mass: harder the heavier the
      // inhaler is next to it (a giant drags a newborn; a newborn barely moves a giant), the closer it
      // is and the more squarely in front, but never past what it can get away from. One small enough
      // to swallow goes down once it's held right at the mouth for GULP_MS.
      let held: PlayerSchema | null = null;
      let heldAt = Infinity;
      const locked = new Set<string>();
      this.players.forEach((prey) => {
        if (prey === eater || prey.state !== PLAYER_STATE.ALIVE || prey.spawnProtected) return;
        const alignment = this.stealWeight(eater, prey);
        if (alignment <= 0) return;
        // Holding it in the cone builds the lock: a light pull at first, dangerous after a second
        // (a bigger inhaler's airflow takes longer to establish)
        const lock = Math.min(1, (eater.lockOn.get(prey.sessionId) ?? 0) + deltaTime / ((INHALE.LOCK_MS / 1000) * (pressureBuildSeconds(eater.width) / LATCH.PRESSURE_BUILD_S)));
        eater.lockOn.set(prey.sessionId, lock);
        // The drain ramp builds only on clean airflow; smothered (deep overlap) or poorly aimed, it fades
        const heldTime = eater.heldFor.get(prey.sessionId) ?? 0;
        const clean = airflowQuality(this.mouthed(eater), this.bodyOf(prey)) >= LATCH.RAMP_MIN_QUALITY;
        eater.heldFor.set(prey.sessionId, clean ? heldTime + deltaTime : Math.max(0, heldTime - deltaTime * LATCH.RAMP_FADE));
        locked.add(prey.sessionId);
        const px = prey.x + prey.width / 2;
        const py = prey.y + prey.height / 2;
        const d = Math.hypot(px - mouthX, py - mouthY);
        // A swallow needs the size, the prey at the mouth, and clean airflow (sitting on top of it isn't enough)
        if (this.canSwallow(eater, prey) && d <= eater.width * INHALE.GULP_REACH + prey.width / 2 && d < heldAt && airflowQuality(this.mouthed(eater), this.bodyOf(prey)) >= LATCH.SWALLOW_MIN_QUALITY) {
          held = prey;
          heldAt = d;
        }
        if (d < 1) return;
        const gap = Math.max(0, d - prey.width / 2);
        const mass = Math.min(INHALE.BODY_PULL_MAX, eater.width / prey.width);
        const near = Math.max(0, 1 - gap / reach);
        // Much stronger in the last stretch before the mouth
        const close = Math.max(0, 1 - gap / (reach * INHALE.CLOSE_RANGE));
        const lockPull = INHALE.LOCK_START + (1 - INHALE.LOCK_START) * lock * lock;
        const strength = INHALE.BODY_PULL * mass * near * near * (1 + INHALE.CLOSE_BOOST * close) * alignment * lockPull;
        const pull = Math.min(strength, INHALE.PREY_PULL_CAP * moveSpeed(prey.width)) * deltaTime;
        prey.nudge(((mouthX - px) / d) * pull, ((mouthY - py) / d) * pull, this.worldWidth, this.worldHeight);
      });
      this.fadeLocks(eater, locked, deltaTime);
      const caught = held as PlayerSchema | null;
      if (!caught) {
        if (eater.gulping) eater.gulping = "";
      } else if (eater.gulping !== caught.sessionId) {
        eater.gulping = caught.sessionId;
        eater.gulpEndsAt = this.time + INHALE.GULP_MS;
      } else if (this.time >= eater.gulpEndsAt) {
        eater.gulping = "";
        this.swallow(eater, caught, now);
      }
      this.steal(eater, now, deltaTime);
    });
  }

  /** Locks on creatures no longer held (or every lock, when `keep` is null) fade fast: out of the cone, out of danger */
  private fadeLocks(eater: PlayerSchema, keep: Set<string> | null, deltaTime: number): void {
    for (const [id, lock] of eater.lockOn) {
      if (keep?.has(id)) continue;
      const left = lock - (deltaTime * 1000) / INHALE.LOCK_DECAY_MS;
      if (left <= 0) eater.lockOn.delete(id);
      else eater.lockOn.set(id, left);
    }
    for (const [id, held] of eater.heldFor) {
      if (keep?.has(id)) continue;
      const left = held - deltaTime * INHALE.HOLD_DECAY;
      if (left <= 0) eater.heldFor.delete(id);
      else eater.heldFor.set(id, left);
    }
  }

  /** Whether `eater` is big enough to swallow `prey` whole: INHALE.EAT_RATIO times as wide */
  private canSwallow(eater: PlayerSchema, prey: PlayerSchema): boolean {
    // ...or it has no gems left to hold it together: then anyone can suck it up
    return prey.gems <= 0 || prey.width * INHALE.EAT_RATIO <= eater.width;
  }

  /**
   * How squarely `victim` sits in `thief`'s inhale: 0 when no part of it is in the cone, up to 1
   * dead center (or right against the mouth). The drain is shared out by this.
   */
  private stealWeight(thief: PlayerSchema, victim: PlayerSchema): number {
    if (!thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || victim.state !== PLAYER_STATE.ALIVE || victim.spawnProtected) return 0;
    const fx = Math.cos(thief.facing);
    const fy = Math.sin(thief.facing);
    const dx = victim.x + victim.width / 2 - (thief.x + thief.width / 2 + fx * thief.width * 0.3);
    const dy = victim.y + victim.height / 2 - (thief.y + thief.height / 2 + fy * thief.width * 0.3);
    const d = Math.hypot(dx, dy);
    const radius = victim.width / 2;
    // Touching it across your front: the inhale grabs it, no aiming needed
    const grabbed = this.touchingFront(thief, victim) ? INHALE.CONTACT_WEIGHT : 0;
    if (d - radius > INHALE.REACH + thief.width * INHALE.REACH_PER_SIZE) return grabbed;
    if (d <= radius) return 1;
    // In the cone if any of it is: its center's angle off the facing, against how wide it looks from here
    const off = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy) / d)));
    const allowed = (INHALE.ARC * Math.PI) / 180 + Math.asin(Math.min(1, radius / d));
    if (off > allowed) return grabbed;
    return Math.max(grabbed, INHALE.STEAL_EDGE_SHARE + (1 - INHALE.STEAL_EDGE_SHARE) * (1 - off / allowed));
  }

  /** Whether `victim` is touching `thief` anywhere across its front (contact range: an inhale grabs it with no aiming) */
  private touchingFront(thief: PlayerSchema, victim: PlayerSchema): boolean {
    const dx = victim.x + victim.width / 2 - (thief.x + thief.width / 2);
    const dy = victim.y + victim.height / 2 - (thief.y + thief.height / 2);
    const d = Math.hypot(dx, dy);
    if (d - (thief.width + victim.width) / 2 > INHALE.CONTACT_GAP) return false;
    if (d < 1e-6) return true;
    return (dx * Math.cos(thief.facing) + dy * Math.sin(thief.facing)) / d >= Math.cos((INHALE.CONTACT_ARC * Math.PI) / 180);
  }

  /**
   * How hard `thief`'s inhale pulls gems out of `victim` (0 to 1): sharply weaker with distance (the
   * cone reaches far but bites near the mouth), and weaker while the victim gets away, strafing
   * across the cone most of all. Right at the mouth there's no getting away.
   */
  private stealStrength(thief: PlayerSchema, victim: PlayerSchema): number {
    const fx = Math.cos(thief.facing);
    const fy = Math.sin(thief.facing);
    const dx = victim.x + victim.width / 2 - (thief.x + thief.width / 2 + fx * thief.width * 0.3);
    const dy = victim.y + victim.height / 2 - (thief.y + thief.height / 2 + fy * thief.width * 0.3);
    const d = Math.hypot(dx, dy);
    const reach = INHALE.REACH + thief.width * INHALE.REACH_PER_SIZE;
    const gap = Math.max(0, d - victim.width / 2);
    const near = Math.pow(Math.max(0, 1 - gap / reach), INHALE.STEAL_FALLOFF);
    // The outer part of the reach catches but doesn't kill: drain fades to nothing toward the tip
    const lethal = lethalShare(gap / reach);
    if (d < 1e-6) return near * lethal;
    const nx = dx / d;
    const ny = dy / d;
    const velocity = victim.velocity();
    const away = Math.max(0, velocity.x * nx + velocity.y * ny);
    const across = Math.abs(velocity.y * nx - velocity.x * ny);
    const escape = Math.min(1, (INHALE.STEAL_ESCAPE_AWAY * away + across) / moveSpeed(victim.width));
    const reachable = Math.min(1, gap / (reach * INHALE.STEAL_POINT_BLANK));
    return near * lethal * (1 - INHALE.STEAL_ESCAPE * escape * reachable);
  }

  /**
   * Gravity theft: everyone in the inhale cone has gems pulled out into the thief (one small enough
   * to swallow is pulled in bodily too). An inhale's drain is shared out by how squarely each victim
   * sits in the cone, and grows only with the square root of how many it catches, so a big cone
   * covers more creatures without draining each one as fast. A victim's share drains at INHALE.STEAL_RATE a second,
   * whatever either one's size (mass resists being pulled, not being robbed). Two creatures inhaling
   * each other both steal at once. Take someone's last gem and they're drained: gone until they respawn.
   */
  private steal(thief: PlayerSchema, now: number, deltaTime: number): void {
    const victims: { victim: PlayerSchema; weight: number }[] = [];
    this.players.forEach((other) => {
      if (other === thief || other.gems <= 0) return;
      const weight = this.stealWeight(thief, other);
      if (weight > 0) victims.push({ victim: other, weight });
    });
    victims.sort((a, b) => b.weight - a.weight);
    const primary = victims[0]?.victim.sessionId ?? "";
    if (primary !== thief.stealingFrom) this.endTheft(thief, now, primary);
    const list = victims.map((entry) => entry.victim.sessionId).join(",");
    if (list !== thief.robbing) thief.robbing = list;
    // Progress toward the next gem is kept between inhales, and while someone slips out of the cone for a moment
    for (const id of [...thief.stealShares.keys()]) {
      const known = this.players.get(id);
      if (!known || known.state !== PLAYER_STATE.ALIVE) thief.stealShares.delete(id);
    }
    const total = victims.reduce((sum, entry) => sum + entry.weight, 0);
    // Catching several at once pays more than one, though far less than one each
    const budget = Math.sqrt(victims.length);
    for (const { victim, weight } of victims) {
      let progress = (thief.stealShares.get(victim.sessionId) ?? 0) + deltaTime * INHALE.STEAL_RATE * budget * (weight / total) * this.stealStrength(thief, victim) * drainRamp(thief.heldFor.get(victim.sessionId) ?? 0) * pressureBuild(thief.heldFor.get(victim.sessionId) ?? 0, thief.width) * (LATCH.OVERLAP_DRAIN_MIN + (1 - LATCH.OVERLAP_DRAIN_MIN) * cleanAir(this.bodyOf(thief), this.bodyOf(victim)));
      while (progress >= 1 && victim.gems > 0) {
        progress -= 1;
        victim.setGems(victim.gems - 1, this.worldWidth, this.worldHeight);
        thief.setGems(thief.gems + 1, this.worldWidth, this.worldHeight);
        thief.stolenTotal += 1;
        victim.robbedTotal += 1;
        if (victim.sessionId === thief.stealingFrom) thief.stolenRun += 1;
      }
      thief.stealShares.set(victim.sessionId, progress);
      if (victim.gems <= 0 && victim.state === PLAYER_STATE.ALIVE) this.drain(victim, now, thief);
    }
  }

  /** Lost their last gem (robbed, or fed to a turbine): they shrink away to nothing and are out until they respawn */
  private drain(victim: PlayerSchema, now: number, thief?: PlayerSchema): void {
    this.onEvent?.("vanish", {
      id: victim.sessionId,
      x: Math.round(victim.x + victim.width / 2),
      y: Math.round(victim.y + victim.height / 2),
      size: Math.round(victim.width),
      index: victim.playerIndex,
      facing: Math.round(victim.facing * 100) / 100,
    });
    victim.knockOut(now);
    if (!thief) {
      // Whoever shoved them in gets the credit
      this.credit(victim, "turbine", now);
      return;
    }
    const primary = thief.stealingFrom === victim.sessionId;
    const gems = primary ? thief.stolenRun : 0;
    if (primary) {
      thief.stolenRun = 0;
      this.endTheft(thief, now);
    }
    this.credit(victim, "drained", now, thief.sessionId, { gems });
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

  /** Swallowed whole: knocked out, and all their gems go to the eater */
  private swallow(eater: PlayerSchema, prey: PlayerSchema, now: number): void {
    const gems = prey.gems;
    if (gems > 0) eater.setGems(eater.gems + gems, this.worldWidth, this.worldHeight);
    prey.setGems(0, this.worldWidth, this.worldHeight);
    prey.knockOut(now);
    this.credit(prey, "ate", now, eater.sessionId, { gems });
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
   * where a holder was if they're gone; sliding, nudged by anyone walking into it;
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
    // Inhaling: keep the mouth on whoever it's robbing or swallowing for as long as its breath lasts,
    // and let go once nobody has been in its inhale for a moment (saving its breath)
    if (bot.inhaling) {
      const held = bot.stealingFrom ? this.players.get(bot.stealingFrom) : bot.gulping ? this.players.get(bot.gulping) : undefined;
      if (held) {
        bot.aimAt(held.x + held.width / 2 - cx, held.y + held.height / 2 - cy);
        bot.inhaleIdleSince = 0;
      } else if (!bot.inhaleIdleSince) {
        bot.inhaleIdleSince = now;
      } else if (now - bot.inhaleIdleSince > 700) {
        bot.stopInhale(now);
        bot.inhaleIdleSince = 0;
      }
      return;
    }
    if (Math.random() > 0.12) return;
    // Someone stealing from this bot: it runs from a robber its size or bigger (its brain sees to that)
    // and often inhales back as it goes; a smaller robber is faster, so it turns and fights
    let thief: PlayerSchema | null = null;
    this.players.forEach((other) => {
      if (other.robbing.split(",").includes(bot.sessionId)) thief = other;
    });
    const robber = thief as PlayerSchema | null;
    if (robber) {
      if (Math.random() < 0.8) {
        bot.startInhale(now, INHALE.MAX_MS);
        bot.aimAt(robber.x + robber.width / 2 - cx, robber.y + robber.height / 2 - cy);
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
    // Nothing to swallow: rob anyone in reach (they can rob back)
    this.players.forEach((other) => {
      if (want || other === bot || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.gems < 1) return;
      const ox = other.x + other.width / 2;
      const oy = other.y + other.height / 2;
      const d = Math.hypot(ox - cx, oy - cy);
      if (d - other.width / 2 > reach + bot.width * 0.3) return;
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
    // As long as its breath lasts (it lets go once nobody is in its inhale)
    bot.inhaleIdleSince = 0;
    bot.startInhale(now, INHALE.MAX_MS);
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
   * Creatures are solid: nobody overlaps or passes through anyone, and touching never shoves,
   * bounces or knocks anyone back. When two overlap, whoever moved (or grew) into the other this
   * tick gives way: walking into someone standing still stops you and never moves them, two
   * walking into each other both stop, anyone pulled into someone by suction is the one moved back,
   * and a thief growing as it steals is the one that makes room. The one doing the moving stops
   * going that way, so at an angle it slides along. Inhaling changes nothing.
   */
  private keepApart(player: PlayerSchema): void {
    if (player.state !== PLAYER_STATE.ALIVE) return;
    this.players.forEach((other) => {
      if (other === player || other.state !== PLAYER_STATE.ALIVE) return;
      const dx = other.x + other.width / 2 - (player.x + player.width / 2);
      const dy = other.y + other.height / 2 - (player.y + player.height / 2);
      const distance = Math.hypot(dx, dy);
      const overlap = (player.width + other.width) / 2 - distance;
      if (overlap <= -ARENA_RULES.CONTACT_TOUCH) return;
      const nx = distance > 1e-6 ? dx / distance : 1;
      const ny = distance > 1e-6 ? dy / distance : 0;
      // Touching: most of this step's sideways movement is undone, so they stay pressed together
      // instead of orbiting; moving away peels off freely
      const stepX = player.x + player.width / 2 - player.tickX;
      const stepY = player.y + player.height / 2 - player.tickY;
      const stepToward = stepX * nx + stepY * ny;
      const step = Math.hypot(stepX, stepY);
      if (step > 1e-6 && stepToward >= -0.2 * step) {
        const grip = ARENA_RULES.CONTACT_GRIP;
        player.nudge(-(stepX - stepToward * nx) * grip, -(stepY - stepToward * ny) * grip, this.worldWidth, this.worldHeight);
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
      const share = mineHeavy + theirsHeavy > 1e-6 ? mineHeavy / (mineHeavy + theirsHeavy) : 0.5;
      player.nudge(-nx * excess * share, -ny * excess * share, this.worldWidth, this.worldHeight);
      other.nudge(nx * excess * (1 - share), ny * excess * (1 - share), this.worldWidth, this.worldHeight);
      if (mine > 0) player.blockAlong(nx, ny);
      if (theirs > 0) other.blockAlong(-nx, -ny);
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
    // Switched off: the arena stays whole, so no warnings, grace, drop, showers or jackpot
    if (!this.shiftsOn) return;
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
    this.moveTurbinesOntoFloor();
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
  /** Switch arena shifts on in this world (tests), the first coming SHIFT.FIRST_AFTER_MS from now */
  enableShifts(): void {
    this.shiftsOn = true;
    this.shiftPhase = "normal";
    this.phaseEndsAt = this.time + SHIFT.FIRST_AFTER_MS;
  }

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
    // Everything the player passed over this tick counts, so a skid can't skip a gem
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

  /** A creature's middle and width, for the airflow (see game/airflow) */
  private bodyOf(player: PlayerSchema): { x: number; y: number; width: number } {
    return { x: player.x + player.width / 2, y: player.y + player.height / 2, width: player.width };
  }

  /** ...and which way its mouth faces */
  private mouthed(player: PlayerSchema): { x: number; y: number; width: number; facing: number } {
    return { ...this.bodyOf(player), facing: player.facing };
  }

  /**
   * Player airflow connections: each inhaler's airflow quality on every creature, smoothed for
   * stability. A clean enough one catches a latch, held through brief slips (a little sideways step
   * doesn't lose it), broken by turning well away, distance or a stun. Between two inhaling each
   * other only one side owns the focused connection (hysteresis; from a near tie, neither). The owner
   * gets a gentle aim toward its target (through its own turning), its cone focuses into a stream,
   * and once that holds cleanly, its breath is used less, then refilled (game/airflow breathRate).
   */
  private updateLatches(now: number, deltaTime: number): void {
    const smoothing = Math.min(1, deltaTime * LATCH.SMOOTHING);
    this.players.forEach((attacker) => {
      if (!attacker.inhaling || attacker.state !== PLAYER_STATE.ALIVE || attacker.stunned) {
        attacker.dropLatch();
        attacker.airQuality.clear();
        return;
      }
      const from = this.mouthed(attacker);
      let best: PlayerSchema | null = null;
      let bestQuality = 0;
      this.players.forEach((target) => {
        const id = target.sessionId;
        if (target === attacker || target.state !== PLAYER_STATE.ALIVE || target.spawnProtected) {
          attacker.airQuality.delete(id);
          return;
        }
        const raw = airflowQuality(from, this.bodyOf(target));
        const was = attacker.airQuality.get(id) ?? 0;
        const quality = was + (raw - was) * smoothing;
        if (quality < 0.005 && raw === 0) attacker.airQuality.delete(id);
        else attacker.airQuality.set(id, quality);
        if (quality > bestQuality) {
          bestQuality = quality;
          best = target;
        }
      });
      const current = attacker.latchTarget ? this.players.get(attacker.latchTarget) : undefined;
      if (attacker.latchTarget && (!current || current.state !== PLAYER_STATE.ALIVE)) attacker.dropLatch();
      else if (current) {
        const holds = (attacker.airQuality.get(current.sessionId) ?? 0) >= LATCH.KEEP_QUALITY && this.latchInRange(attacker, current);
        if (holds) attacker.latchLostAt = 0;
        else if (!attacker.latchLostAt) attacker.latchLostAt = now;
        else if (now - attacker.latchLostAt > LATCH.MEMORY_MS) attacker.dropLatch();
      }
      const chosen = best as PlayerSchema | null;
      if (chosen && bestQuality >= LATCH.ACQUIRE_QUALITY && chosen.sessionId !== attacker.latchTarget) {
        // A new latch, or a clearly better one
        const held = attacker.latchTarget ? attacker.airQuality.get(attacker.latchTarget) ?? 0 : 0;
        if (!attacker.latchTarget || bestQuality > held * (1 + LATCH.HYSTERESIS)) {
          attacker.dropLatch();
          attacker.latchTarget = chosen.sessionId;
          attacker.latchSince = now;
        }
      }
      const target = attacker.latchTarget ? this.players.get(attacker.latchTarget) : undefined;
      attacker.latchScore = target ? (attacker.airQuality.get(target.sessionId) ?? 0) * latchSizeFactor(attacker.width, target.width) : 0;
    });
    // Who owns the focused connection (decided on last tick's owners, so the order doesn't matter)
    this.players.forEach((attacker) => {
      const target = attacker.latchTarget ? this.players.get(attacker.latchTarget) : undefined;
      let owns = !!target;
      if (target && target.latchTarget === attacker.sessionId) {
        const mine = attacker.latchScore;
        const theirs = target.latchScore;
        if (attacker.focused) owns = theirs <= mine * (1 + LATCH.HYSTERESIS);
        else if (target.focused) owns = mine > theirs * (1 + LATCH.HYSTERESIS);
        else owns = mine > theirs * (1 + LATCH.TIE);
      }
      attacker.focusNext = owns;
    });
    this.players.forEach((attacker) => {
      const target = attacker.latchTarget ? this.players.get(attacker.latchTarget) : undefined;
      attacker.focused = !!target && attacker.focusNext;
      const quality = target && attacker.focused ? attacker.airQuality.get(target.sessionId) ?? 0 : 0;
      const focus = target && attacker.focused ? Math.min(1, Math.max(0, (quality - LATCH.BEAM_FOCUS_FROM) / (LATCH.BEAM_FULL_AT - LATCH.BEAM_FOCUS_FROM))) : 0;
      const beam = target && attacker.focused && now - attacker.latchSince >= LATCH.BEAM_STABLE_MS ? quality : 0;
      const pull = target && attacker.focused ? attacker.latchScore : 0;
      const round = (v: number) => Math.round(v * 100) / 100;
      if (attacker.beamFocus !== round(focus)) attacker.beamFocus = round(focus);
      if (attacker.beamQuality !== round(beam)) attacker.beamQuality = round(beam);
      if (attacker.latchPull !== round(pull)) attacker.latchPull = round(pull);
      if (target && pull > 0) {
        const dx = target.x + target.width / 2 - (attacker.x + attacker.width / 2);
        const dy = target.y + target.height / 2 - (attacker.y + attacker.height / 2);
        const d = Math.max(1e-6, Math.hypot(dx, dy));
        attacker.assistX = (dx / d) * LATCH.ASSIST * pull;
        attacker.assistY = (dy / d) * LATCH.ASSIST * pull;
      } else {
        attacker.assistX = 0;
        attacker.assistY = 0;
      }
    });
  }

  /** Whether a latch can still hold: the target within LATCH.BREAK_ANGLE of the attacker's facing and LATCH.RANGE of its reach */
  private latchInRange(attacker: PlayerSchema, target: PlayerSchema): boolean {
    const dx = target.x + target.width / 2 - (attacker.x + attacker.width / 2);
    const dy = target.y + target.height / 2 - (attacker.y + attacker.height / 2);
    const d = Math.hypot(dx, dy);
    const reach = INHALE.REACH + attacker.width * INHALE.REACH_PER_SIZE;
    if (d - (attacker.width + target.width) / 2 > reach * LATCH.RANGE) return false;
    if (d < 1e-6) return true;
    return (dx * Math.cos(attacker.facing) + dy * Math.sin(attacker.facing)) / d >= Math.cos((LATCH.BREAK_ANGLE * Math.PI) / 180);
  }

  /** How many Cores this world keeps (test worlds: their own number, 0 unless they ask) */
  setCoreCount(count: number): void {
    this.coreCount = Math.max(0, Math.floor(count));
    while (this.cores.length > this.coreCount) this.cores.pop();
  }

  /** Test worlds: put a Core (adding it if need be) at a spot, moving at a velocity */
  placeCore(index: number, x: number, y: number, vx: number, vy: number): void {
    while (this.cores.length <= index) this.cores.push(new CoreSchema(`c${this.nextCoreId++}`, x, y, CORE.RADIUS));
    const core = this.cores[index];
    if (!core) return;
    core.x = x;
    core.y = y;
    core.vx = vx;
    core.vy = vy;
    core.touching.clear();
  }

  /**
   * Cores: every inhaling creature's airflow adds its force (no owner: two pulling at once is a
   * tug-of-war), then each moves, bounces off the others, and runs into players: a soft push, or a
   * stun if it hits hard enough (no gems lost). Kept stocked, away from players, turbines and each other.
   */
  private updateCores(now: number, deltaTime: number): void {
    if (this.cores.length < this.coreCount) {
      const spot = this.coreSpot();
      if (spot) this.cores.push(new CoreSchema(`c${this.nextCoreId++}`, spot.x, spot.y, CORE.RADIUS));
    }
    this.cores.forEach((core) => {
      let ax = 0;
      let ay = 0;
      this.players.forEach((player) => {
        if (player.state !== PLAYER_STATE.ALIVE || player.stunned) return;
        const moving = player.velocity();
        const pull = airflowOnCore({ x: player.x + player.width / 2, y: player.y + player.height / 2, width: player.width, facing: player.facing, inhaling: player.inhaling, vx: moving.x, vy: moving.y }, core);
        ax += pull.ax;
        ay += pull.ay;
      });
      stepCore(core, ax, ay, deltaTime, this.worldWidth, this.worldHeight);
    });
    // Cores bounce off each other
    for (let i = 0; i < this.cores.length; i++) {
      for (let j = i + 1; j < this.cores.length; j++) {
        const a = this.cores[i];
        const b = this.cores[j];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const overlap = a.radius + b.radius - d;
        if (overlap <= 0 || d < 1e-6) continue;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= (nx * overlap) / 2;
        a.y -= (ny * overlap) / 2;
        b.x += (nx * overlap) / 2;
        b.y += (ny * overlap) / 2;
        const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
        if (closing <= 0) continue;
        const change = (closing * (1 + CORE.CORE_RESTITUTION)) / 2;
        a.vx -= nx * change;
        a.vy -= ny * change;
        b.vx += nx * change;
        b.vy += ny * change;
      }
    }
    this.cores.forEach((core) => this.coreMeetsPlayers(core, now));
  }

  /** A Core running into players: they're pushed apart by mass, it loses some speed, and a hard enough hit stuns */
  private coreMeetsPlayers(core: CoreSchema, now: number): void {
    this.players.forEach((player) => {
      const id = player.sessionId;
      if (player.state !== PLAYER_STATE.ALIVE) {
        core.touching.delete(id);
        return;
      }
      const dx = core.x - (player.x + player.width / 2);
      const dy = core.y - (player.y + player.height / 2);
      const d = Math.hypot(dx, dy);
      const overlap = player.width / 2 + core.radius - d;
      if (overlap <= -CORE.SEPARATE) {
        core.touching.delete(id);
        return;
      }
      if (overlap <= 0) return;
      const nx = d > 1e-6 ? dx / d : 1;
      const ny = d > 1e-6 ? dy / d : 0;
      // Pushed apart by mass: the lighter one moves more
      const heft = bodyMass(player.width);
      const coreShare = heft / (heft + CORE.MASS);
      core.x += nx * overlap * coreShare;
      core.y += ny * overlap * coreShare;
      player.nudge(-nx * overlap * (1 - coreShare), -ny * overlap * (1 - coreShare), this.worldWidth, this.worldHeight);
      const walking = player.velocity();
      const closing = -((core.vx - walking.x) * nx + (core.vy - walking.y) * ny);
      if (closing > 0) {
        // It bounces off, losing speed, so a single Core can't ricochet through everyone at full strength
        const change = closing * (1 + CORE.IMPACT_BOUNCE) * coreShare;
        core.vx += nx * change;
        core.vy += ny * change;
        // A hard hit stuns; resting against someone never does (it has to come away first), and there's no stun-lock
        const stunMs = impactStunMs(CORE.MASS * closing);
        if (stunMs > 0 && !core.touching.has(id) && now >= player.stunImmuneUntil) player.stun(now, stunMs);
      }
      core.touching.add(id);
    });
  }

  /** Somewhere for a new Core: away from players, other Cores and turbines (null if nowhere fits) */
  private coreSpot(): { x: number; y: number } | null {
    const margin = 300;
    for (let tries = 0; tries < 40; tries++) {
      const x = margin + Math.random() * (this.worldWidth - margin * 2);
      const y = margin + Math.random() * (this.worldHeight - margin * 2);
      let clear = true;
      this.players.forEach((player) => {
        if (Math.hypot(player.x + player.width / 2 - x, player.y + player.height / 2 - y) < CORE.SPAWN_CLEAR) clear = false;
      });
      this.cores.forEach((core) => {
        if (Math.hypot(core.x - x, core.y - y) < CORE.SPAWN_GAP) clear = false;
      });
      this.turbines.forEach((turbine) => {
        if (Math.hypot(turbine.x - x, turbine.y - y) < CORE.SPAWN_TURBINE_GAP) clear = false;
      });
      if (clear) return { x, y };
    }
    return null;
  }

  /** Test worlds: "auto" runs turbines as usual, "manual" only has the ones placed by hand, "off" has none */
  setTurbines(mode: string): void {
    this.turbinesAuto = mode === "auto";
    this.turbineDue = [];
    if (mode === "off") {
      this.turbines.clear();
      this.flights.clear();
    }
  }

  /** Test worlds: a turbine switched on right away at (x, y), its intake along `intake` (and its exhaust held straight back if `still`) */
  placeTurbine(x: number, y: number, intake: number, still: boolean): void {
    const turbine = new TurbineSchema(`t${this.nextTurbineId++}`, x, y, intake, this.time);
    turbine.phase = "active";
    turbine.phaseEndsAt = this.time + TURBINE.LIFE_MAX_MS;
    turbine.sweepFrom = this.time;
    turbine.still = still;
    this.turbines.push(turbine);
  }

  /** Test worlds: every turbine moves on to its next stage now */
  endTurbinesNow(): void {
    this.turbines.forEach((turbine) => {
      turbine.phaseEndsAt = this.time;
    });
  }

  /**
   * Turbines appear (after a warning) in open spots, run for a minute or so, power down and come
   * back somewhere else. While on, each pulls in loose gems and nearby players, rips gems out of
   * anyone in its inner zone, fires every gem it takes in out of its exhaust, and blows players
   * around with the exhaust's wind.
   */
  private updateTurbines(now: number, deltaTime: number): void {
    const t = this.time;
    for (let i = this.turbines.length - 1; i >= 0; i--) {
      const turbine = this.turbines[i];
      if (!turbine) continue;
      if (t < turbine.phaseEndsAt) continue;
      if (turbine.phase === "warning") {
        turbine.phase = "active";
        turbine.phaseEndsAt = t + TURBINE.LIFE_MIN_MS + Math.random() * (TURBINE.LIFE_MAX_MS - TURBINE.LIFE_MIN_MS);
      } else if (turbine.phase === "active") {
        turbine.phase = "ending";
        turbine.phaseEndsAt = t + TURBINE.POWER_DOWN_MS;
      } else if (!this.turbineBusy(turbine.id)) {
        // Every gem inside has been fired: it's gone, and another comes somewhere else
        this.turbines.splice(i, 1);
        if (this.turbinesAuto) this.turbineDue.push(t + TURBINE.RESPAWN_MIN_MS + Math.random() * (TURBINE.RESPAWN_MAX_MS - TURBINE.RESPAWN_MIN_MS));
      }
    }
    if (this.turbinesAuto) {
      // The first ones arrive one at a time over the first few seconds
      while (this.turbines.length + this.turbineDue.length < TURBINE.COUNT) this.turbineDue.push(t + Math.random() * 4000);
      for (let i = this.turbineDue.length - 1; i >= 0; i--) {
        if (t < this.turbineDue[i]) continue;
        const spot = this.turbineSpot();
        if (!spot) {
          this.turbineDue[i] = t + 1000;
          continue;
        }
        this.turbineDue.splice(i, 1);
        this.turbines.push(new TurbineSchema(`t${this.nextTurbineId++}`, spot.x, spot.y, spot.intake, t));
      }
    }
    this.turbines.forEach((turbine) => {
      if (turbine.phase === "active") this.runTurbine(turbine, now, deltaTime);
    });
    this.fireFlights(now);
  }

  /** Where a turbine's exhaust points at world time `time` */
  private exhaustOf(turbine: TurbineSchema, time: number): number {
    return turbine.still ? turbine.intake + Math.PI : exhaustAngle(turbine.intake, turbine.sweepFrom, time);
  }

  /** One tick of a running turbine: its solid body, the intake's pull and grip, and the exhaust's wind */
  private runTurbine(turbine: TurbineSchema, now: number, deltaTime: number): void {
    const r = TURBINE.BODY_RADIUS;
    const ix = Math.cos(turbine.intake);
    const iy = Math.sin(turbine.intake);
    const mouthX = turbine.x + ix * r;
    const mouthY = turbine.y + iy * r;
    const intakeCos = Math.cos(TURBINE.INTAKE_ARC);
    const out = this.exhaustOf(turbine, this.time);
    const ex = Math.cos(out);
    const ey = Math.sin(out);
    const nozzleX = turbine.x + ex * r;
    const nozzleY = turbine.y + ey * r;
    const windCos = Math.cos(TURBINE.EXHAUST_ARC);
    this.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE) return;
      const radius = player.width / 2;
      const px = player.x + radius;
      const py = player.y + radius;
      // The turbine is solid
      const bx = px - turbine.x;
      const by = py - turbine.y;
      const bd = Math.hypot(bx, by);
      if (bd < r + radius && bd > 1e-6) player.nudge((bx / bd) * (r + radius - bd), (by / bd) * (r + radius - bd), this.worldWidth, this.worldHeight);
      if (player.spawnProtected) return;
      // In front of the intake: pulled in, and close up, gems ripped out of you one by one
      const dx = px - mouthX;
      const dy = py - mouthY;
      const d = Math.hypot(dx, dy);
      const gap = Math.max(0, d - radius);
      if (d > 1e-6 && gap < TURBINE.INTAKE_REACH && (dx * ix + dy * iy) / d >= intakeCos) {
        const closeness = 1 - gap / TURBINE.INTAKE_REACH;
        const pull = Math.min(gap, TURBINE.PLAYER_PULL * suctionScale(TURBINE.SUCTION_SIZE, player.width) * closeness * closeness * deltaTime);
        player.nudge((-dx / d) * pull, (-dy / d) * pull, this.worldWidth, this.worldHeight);
        if (gap < TURBINE.DANGER_REACH && player.gems > 0) {
          player.turbineStrip += deltaTime * (TURBINE.STRIP_RATE + TURBINE.STRIP_PER_ROOT * Math.sqrt(player.weight()));
          while (player.turbineStrip >= 1 && player.gems > 0) {
            player.turbineStrip -= 1;
            player.setGems(player.gems - 1, this.worldWidth, this.worldHeight);
            // Out of their body, on the side facing the intake
            this.addFlight(turbine, player.sessionId, px - (dx / d) * radius, py - (dy / d) * radius, 1, false, mouthX, mouthY);
          }
          if (player.gems <= 0) {
            // Its last gem: gone
            player.turbineStrip = 0;
            this.drain(player, now);
            return;
          }
        } else {
          player.turbineStrip = 0;
        }
      }
      // In the exhaust's wind: pushed along it, small creatures most
      const wx = px - nozzleX;
      const wy = py - nozzleY;
      const wd = Math.hypot(wx, wy);
      const wgap = Math.max(0, wd - radius);
      if (wd > 1e-6 && wgap < TURBINE.EXHAUST_REACH && (wx * ex + wy * ey) / wd >= windCos) {
        const push = (TURBINE.WIND * (1 - wgap / TURBINE.EXHAUST_REACH) * deltaTime) / Math.sqrt(player.weight());
        player.nudge(ex * push, ey * push, this.worldWidth, this.worldHeight);
      }
    });
    // Loose gems in front of the intake are pulled in; any that reach it (or lie under it) go inside
    const taken: string[] = [];
    this.gems.forEach((gem, id) => {
      if (gem.falling || gem.inFlight()) return;
      const dx = gem.x - mouthX;
      const dy = gem.y - mouthY;
      const d = Math.hypot(dx, dy);
      if (d < 20 || Math.hypot(gem.x - turbine.x, gem.y - turbine.y) < r) {
        taken.push(id);
        return;
      }
      if (d > TURBINE.INTAKE_REACH || (dx * ix + dy * iy) / d < intakeCos) return;
      const step = Math.min(d, TURBINE.GEM_PULL * (0.25 + 0.75 * (1 - d / TURBINE.INTAKE_REACH)) * deltaTime);
      gem.moveTo(gem.x - (dx / d) * step, gem.y - (dy / d) * step);
    });
    for (const id of taken) {
      const gem = this.gems.get(id);
      if (!gem) continue;
      this.gems.delete(id);
      this.addFlight(turbine, "", gem.x, gem.y, gem.value, !gem.sprayed, mouthX, mouthY);
    }
  }

  /** A gem on its way through a turbine: into the intake (from a player, or off the ground), across, and out of the exhaust */
  private addFlight(turbine: TurbineSchema, victim: string, fromX: number, fromY: number, value: number, counted: boolean, mouthX: number, mouthY: number): void {
    const t = this.time;
    const travel = victim ? Math.max(TURBINE.MIN_TRAVEL_MS, (Math.hypot(mouthX - fromX, mouthY - fromY) / TURBINE.TRAVEL_SPEED) * 1000) : 0;
    const flight = new TurbineFlightSchema(turbine.id, victim, fromX, fromY, value, t, t + travel, t + travel + TURBINE.INSIDE_MS);
    flight.counted = counted;
    this.flights.set(`f${this.nextFlightId++}`, flight);
  }

  /** Gems whose time has come fire out of their turbine's exhaust and fly 400-700 units, landing as ordinary gems */
  private fireFlights(now: number): void {
    const t = this.time;
    const due: string[] = [];
    this.flights.forEach((flight, id) => {
      if (t >= flight.fireAt) due.push(id);
    });
    for (const id of due) {
      const flight = this.flights.get(id);
      if (!flight) continue;
      this.flights.delete(id);
      const turbine = this.turbineById(flight.turbine);
      const gem = new GemSchema(flight.fromX, flight.fromY, flight.value);
      if (turbine) {
        const angle = this.exhaustOf(turbine, flight.fireAt) + (Math.random() * 2 - 1) * TURBINE.EXHAUST_SPREAD;
        const speed = TURBINE.EXHAUST_SPEED_MIN + Math.random() * (TURBINE.EXHAUST_SPEED_MAX - TURBINE.EXHAUST_SPEED_MIN);
        const nozzle = TURBINE.BODY_RADIUS + GEMS.RADIUS;
        gem.launch(turbine.x + Math.cos(angle) * nozzle, turbine.y + Math.sin(angle) * nozzle, angle, speed, now, t, flight.counted);
      } else {
        gem.launch(flight.fromX, flight.fromY, 0, 0, now, t, flight.counted);
      }
      this.gems.set(`g${this.nextGemId++}`, gem);
    }
  }

  private turbineById(id: string): TurbineSchema | null {
    let found: TurbineSchema | null = null;
    this.turbines.forEach((turbine) => {
      if (turbine.id === id) found = turbine;
    });
    return found;
  }

  /** Whether gems are still on their way through a turbine */
  private turbineBusy(id: string): boolean {
    let busy = false;
    this.flights.forEach((flight) => {
      if (flight.turbine === id) busy = true;
    });
    return busy;
  }

  /** A spot for a new turbine: away from the edge, other turbines and players, and on the floor during a shift */
  private turbineSpot(): { x: number; y: number; intake: number } | null {
    const margin = TURBINE.EDGE_MARGIN;
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = margin + Math.random() * (this.worldWidth - 2 * margin);
      const y = margin + Math.random() * (this.worldHeight - 2 * margin);
      let open = true;
      this.turbines.forEach((other) => {
        if (Math.hypot(other.x - x, other.y - y) < TURBINE.SPACING) open = false;
      });
      this.players.forEach((player) => {
        const near = Math.hypot(player.x + player.width / 2 - x, player.y + player.height / 2 - y);
        if (player.state === PLAYER_STATE.ALIVE && near < TURBINE.PLAYER_CLEARANCE + player.width / 2) open = false;
      });
      if (open && this.turbineFits(x, y)) return { x, y, intake: Math.random() * Math.PI * 2 };
    }
    return null;
  }

  /** Whether a turbine at (x, y) stands on floor (it always does, unless the arena is shifting) */
  private turbineFits(x: number, y: number): boolean {
    if (this.shiftPhase === "normal" || !this.layout) return true;
    const reach = TURBINE.BODY_RADIUS + 60;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (!this.isFloorAt(x + Math.cos(a) * reach, y + Math.sin(a) * reach)) return false;
    }
    return this.isFloorAt(x, y);
  }

  /** A new floor is coming: turbines that won't stand on it power down now, and come back on it */
  private moveTurbinesOntoFloor(): void {
    for (let i = this.turbines.length - 1; i >= 0; i--) {
      const turbine = this.turbines[i];
      if (!turbine) continue;
      if (this.turbineFits(turbine.x, turbine.y)) continue;
      if (turbine.phase === "warning") {
        this.turbines.splice(i, 1);
        if (this.turbinesAuto) this.turbineDue.push(this.time + 500);
      } else if (turbine.phase === "active") {
        turbine.phase = "ending";
        turbine.phaseEndsAt = this.time + TURBINE.POWER_DOWN_MS;
      }
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
type([TurbineSchema])(GameState.prototype, "turbines");
type([CoreSchema])(GameState.prototype, "cores");
type({ map: TurbineFlightSchema })(GameState.prototype, "flights");
type("number")(GameState.prototype, "worldWidth");
type("number")(GameState.prototype, "worldHeight");
type("number")(GameState.prototype, "time");
type("boolean")(GameState.prototype, "shiftsOn");
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
