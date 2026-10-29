import * as schema from "@colyseus/schema";
const { Schema, MapSchema, ArraySchema, type } = schema;
import { BlackHoleSchema } from "./BlackHoleSchema.js";
import { PracticeSchema } from "./PracticeSchema.js";
import { BLACK_HOLE } from "../constants/gameConstants.js";
import { PlayerSchema } from "./PlayerSchema.js";
import { ObstacleSchema } from "./ObstacleSchema.js";
import { GemSchema } from "./GemSchema.js";
import { BallSchema } from "./BallSchema.js";
import { CometSchema } from "./CometSchema.js";
import { BombSchema } from "./BombSchema.js";
import { TurbineFlightSchema, TurbineSchema } from "./TurbineSchema.js";
import { CoreSchema } from "./CoreSchema.js";
import { BotBrain } from "../game/bots.js";
import { closestFloorPoint, isFloor, randomFloorPoint } from "../game/layouts.js";
import type { Layout } from "../game/layouts.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { exhaustAngle } from "../game/turbine.js";
import type { Direction } from "../game/movement.js";
import { updateLatches } from "../systems/latches.js";
import { updateTurbines, clearanceAt } from "../systems/turbines.js";
import { updateTraffic, reshuffleLanes, launchObstacle } from "../systems/traffic.js";
import { updateInhales, knockOutWithGems, clearCapture, syncContinuedTheft } from "../systems/inhale.js";
import { slideBlackHoleRims } from "../game/blackHole.js";
import { updateFlights } from "../systems/flights.js";
import { botMouth, bombDanger, balanceBots } from "../systems/bots.js";
import { updateBombs } from "../systems/bombs.js";
import { updateShift, startGrace, startShift, endShift, fall } from "../systems/shift.js";
import { collectGems, sprayGems, spreadSettledGems, topUpField } from "../systems/gems.js";
import { keepApart, pruneBodyContacts } from "../systems/bodies.js";
import { updateSurges } from "../systems/surges.js";
import { PinwheelSchema } from "./PinwheelSchema.js";
import { deployWeapon, updateWeapons } from "../systems/weapons.js";
import { PINWHEEL } from "../constants/gameConstants.js";
import { viewShort } from '../game/camera.js';

const { WORLD, ARENA_RULES, GEMS, PLAYER_STATE, PUSH, BOTS, SHIFT, TRAFFIC, BALLS, COMETS, BOMBS, TURBINE, SURGE } = GAME_CONSTANTS;
/** Which way each of a bot's decisions steers it */
const STEER: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

/** How many random spots to try when looking for a safe place to (re)spawn */
const SPAWN_TRIES = 24;

/**
 * The online world: one big open arena that never stops. Players drop in the moment they join,
 * grab gems, shove each other and dodge traffic crossing the map in every direction. A hit
 * sprays out half your gems; with none left you're knocked out, back two seconds later somewhere
 * safe and protected for a moment. There are no rounds, nobody waits, and
 * bots fill in when it's quiet.
 */
class GameState extends Schema {
  private gemSpreadAt = 0;
  players: schema.MapSchema<PlayerSchema>;
  obstacles: schema.ArraySchema<ObstacleSchema>;
  balls: schema.ArraySchema<BallSchema>;
  comets: schema.ArraySchema<CometSchema>;
  bombs: schema.ArraySchema<BombSchema>;
  gems: schema.MapSchema<GemSchema>;
  /** Turbines, and the gems on their way through them (see updateTurbines) */
  turbines: schema.ArraySchema<TurbineSchema>;
  /** Retired field kept empty to preserve network field numbering for existing clients. */
  cores: schema.ArraySchema<CoreSchema>;
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
  surgePhase = "waiting";
  surgeAt: number = SURGE.FIRST_MS;
  surgeX = 0;
  surgeY = 0;
  surgesOn = true;
  surgeShowerAt = 0;
  surgeJackpotDropped = false;
  /** Server clock of the current simulation tick. */
  now = Date.now();
  pinwheel = new PinwheelSchema();
  weaponSets = new ArraySchema<PinwheelSchema>();
  blackHoles = new ArraySchema<BlackHoleSchema>();
  practice = new PracticeSchema();
  weaponsOn: boolean = PINWHEEL.ENABLED;

  /** Server-only: whether traffic hits players (the automated test turns this off) */
  trafficHits = true;
  /** Server-only: never calm (the automated test), and when the next traffic wave is due */
  alwaysTraffic = false;
  /** Server-only: whether this world has traffic at all (TRAFFIC.ENABLED; the test can switch it on) */
  trafficOn: boolean = TRAFFIC.ENABLED;
  nextWaveAt = 0;
  /** Traffic comes in waves: "calm", "warning" (a chip counts down) or "wave"; waveAt is when that part ends */
  trafficWave: string;
  waveAt: number;
  /** Server-only: bots fill in until this many are playing (the automated test sets 0) */
  botFill: number = BOTS.FILL_TO;
  brains = new Map<string, BotBrain>();
  bodyContacts = new Map<string, { a: string; b: string }>();
  nextBotId = 1;
  private startedAt = 0;
  /** Server-only: each traffic lane's direction (1 or -1) and speed; across lanes first, then down */
  lanes: { direction: number; speed: number }[] = [];
  layout: Layout | null = null;
  lastLayoutName = "";
  nextShowerAt = 0;
  jackpotDropped = false;
  /** Called with moments worth telling everyone about (who shoved whom off the edge, who took the jackpot) */
  onEvent: ((type: string, data: any) => void) | null = null;
  nextPlayerIndex = 0;
  nextGemId = 0;
  /** Loose gems the field keeps topped up to, and how many are out there now */
  fieldGemTarget: number;
  fieldGems = 0;
  fieldReplenishCredit: number = GEMS.FIELD_REPLENISH_PER_S;
  fieldReplenishAt = 0;
  /** Server-only: whether turbines come and go on their own (test worlds ask), when the next ones are due, and ids */
  turbinesAuto: boolean = TURBINE.ENABLED;
  turbineDue: number[] = [];
  /** How many turbines there should be right now (TURBINE.COUNT_MIN to COUNT_MAX, rolled again each time one goes) */
  turbineTarget: number = TURBINE.COUNT_MIN + Math.floor(Math.random() * (TURBINE.COUNT_MAX - TURBINE.COUNT_MIN + 1));
  nextTurbineId = 1;
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
    reshuffleLanes(this);
    for (let i = 0; i < WORLD.OBSTACLE_COUNT; i++) {
      const obstacle = new ObstacleSchema();
      if (!launchObstacle(this, obstacle, true)) obstacle.park();
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
    for (const [x, y] of BLACK_HOLE.POSITIONS) this.blackHoles.push(new BlackHoleSchema(x * this.worldWidth, y * this.worldHeight, BLACK_HOLE.CORE_RADIUS, BLACK_HOLE.WARNING_MS));
    topUpField(this, true);
  }

  /** A new visitor: straight into the world, somewhere safe */
  addPlayer(sessionId: string, name: string | null, now: number = Date.now()): PlayerSchema {
    const player = new PlayerSchema(sessionId, this.nextPlayerIndex++);
    if (name) player.name = name;
    this.players.set(sessionId, player);
    this.spawn(player, now);
    balanceBots(this, now);
    return player;
  }

  removePlayer(sessionId: string): void {
    clearCapture(this, sessionId, this.now);
    this.clearTheftFor(sessionId);
    this.players.delete(sessionId);
    balanceBots(this, Date.now());
  }

  clearTheftFor(id: string): void {
    this.players.get(id)?.theftContinuations.clear();
    this.players.forEach(p => {
      p.theftContinuations.delete(id); p.stealShares.delete(id);
      if (p.stealingFrom === id) { p.stealingFrom = ''; p.stolenRun = 0; }
      p.robbing = p.robbing.split(',').filter(key => key !== id).join(',');
    });
    syncContinuedTheft(this);
  }

  /** One server tick: move traffic, gems and players, collect gems, decide hits, bring players back */
  update(deltaTime: number, now: number = Date.now()): void {
    this.now = now;
    if (!this.startedAt) this.startedAt = now;
    this.time = Math.round(now - this.startedAt);
    if (this.cores.length) this.cores.clear();
    this.players.forEach((player) => player.markTick());
    pruneBodyContacts(this);
    updateShift(this, deltaTime, now);
    updateSurges(this, deltaTime, now);
    updateTraffic(this);
    updateInhales(this, now, deltaTime);
    updateWeapons(this, deltaTime, now);
    updateFlights(this, now, deltaTime);
    updateLatches(this, now, deltaTime);
    updateBombs(this, now, deltaTime);
    updateTurbines(this, now, deltaTime);
    this.obstacles.forEach((obstacle) => {
      if (!obstacle.update(deltaTime, this.worldWidth, this.worldHeight)) {
        // Between waves, traffic that leaves stays out of the world
        if (this.trafficWave !== "wave" || !launchObstacle(this, obstacle, false)) obstacle.park();
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
    if (!layout && this.time >= this.gemSpreadAt) {
      spreadSettledGems(this);
      this.gemSpreadAt = this.time + 250;
    }

    syncContinuedTheft(this, now);

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
        const escape = bombDanger(this, bot);
        if (escape) {
          if (bot.inhaling) bot.stopInhale();
          bot.steer(escape.x, escape.y);
        }
      }
      if (bot) botMouth(this, bot, now);
      if (bot && brain.weaponPlan.readyToPlace(this, bot, now) && deployWeapon(this, bot)) brain.weaponPlan.placed();
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
      keepApart(this, player);
      if (!player.flying && !player.capturedBy) {
        const routed = slideBlackHoleRims(player, player.tickX - player.width / 2, player.tickY - player.height / 2,
          this.blackHoles.filter(h => this.isFloorAt(h.x, h.y)), this.worldWidth, this.worldHeight, deltaTime);
        player.nudge(routed.x - player.x, routed.y - player.y, this.worldWidth, this.worldHeight);
      }
      collectGems(this, player, now, fromX, fromY);
      player.decay(deltaTime, this.worldWidth, this.worldHeight);
      // A skid after a hit never carries anyone off the edge
      if (this.shiftPhase === "shift" && player.recovering && this.layout && !this.isFloorAt(player.x + player.width / 2, player.y + player.height / 2)) {
        const spot = closestFloorPoint(this.layout, player.x + player.width / 2, player.y + player.height / 2);
        player.placeAt(spot.x - player.width / 2, spot.y - player.height / 2);
      }
      // Over the edge during a shift
      if (this.shiftPhase === "shift" && !player.isSafe() && !this.isFloorAt(player.x + player.width / 2, player.y + player.height / 2)) {
        fall(this, player, now);
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

    this.players.forEach(p => {
      const v = p.velocity();
      p.movementVx = v.x + (deltaTime > 0 ? p.tickNudgeX / deltaTime : 0);
      p.movementVy = v.y + (deltaTime > 0 ? p.tickNudgeY / deltaTime : 0);
      p.flightRemainingMs = p.flying ? Math.max(0, p.flightEndsAt - now) : 0;
    });
    topUpField(this);
  }

  /**
   * A hit. With gems, half of them burst out and the player blinks for a moment, safe from
   * traffic; with none left, they're knocked out.
   */
  hitPlayer(player: PlayerSchema, now: number = Date.now(), push?: { x: number; y: number }): void {
    if (player.gems < GEMS.SURVIVE_AT) {
      knockOutWithGems(this, player, now);
      return;
    }
    const lost = Math.max(1, Math.ceil(player.gems * GEMS.SPRAY_SHARE));
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    player.injure(this.time);
    player.setGems(player.gems - lost, this.worldWidth, this.worldHeight);
    player.recover(now);
    sprayGems(this, centerX, centerY, lost, now, player.sessionId);
    // Knocked into a skid, so whoever caused it has the first go at the spilled gems
    if (push) player.skid(push.x, push.y, Math.max(PUSH.SKID_MIN, player.width * PUSH.SKID_BODY_LENGTHS));
  }

  /** Bombs in the arena (switched off by BOMBS.ENABLED; the automated test switches them on) */
  enableBombs(): void {
    if (this.bombs.length > 0) return;
    for (let i = 0; i < BOMBS.COUNT; i++) {
      this.bombs.push(new BombSchema(80 + Math.random() * (this.worldWidth - 160), 80 + Math.random() * (this.worldHeight - 160)));
    }
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

  /** A traffic wave begins: comets and balls stream in (lane traffic enters as its lanes allow) */
  startWave(): void {
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

  /** Whether a point is on the floor: always outside a shift; during one (or its grace period), the new floor */
  isFloorAt(x: number, y: number): boolean {
    return !this.layout || isFloor(this.layout, x, y);
  }

  /** The nearest point on the (new) floor */
  nearestFloorPoint(x: number, y: number): { x: number; y: number } {
    return this.layout ? closestFloorPoint(this.layout, x, y) : { x, y };
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
      endShift(this);
    } else {
      if (phase === "grace" || !this.layout) startGrace(this, now);
      if (phase === "shift") startShift(this);
    }
    this.phaseEndsAt = this.time + msLeft;
  }

  /** Gems dropping onto the floor (they can be grabbed once they land) */
  dropGems(count: number, value: number, now: number): void {
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

  /** If someone shoved this player just before they were hit or fell, tell everyone who did it */
  nextCombatRewardId = 0;

  credit(target: PlayerSchema, how: string, now: number, byId?: string, extra: Record<string, unknown> = {}): void {
    const who = byId ?? target.shovedBy(now, SHIFT.CREDIT_MS);
    const by = who ? this.players.get(who) : undefined;
    if (!this.onEvent || (!by && how !== 'burnup' && !(byId && (how === 'cannon' || how === 'blackhole')))) return;
    this.onEvent("credit", {
      byId: who,
      by: by?.name ?? 'Someone',
      targetId: target.sessionId,
      target: target.name,
      how,
      kind: target.lastShoveKind,
      out: target.gems <= 0,
      ...extra,
    });
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

  /** A creature's middle and width, for the airflow (see game/airflow) */
  bodyOf(player: PlayerSchema): { x: number; y: number; width: number } {
    return { x: player.x + player.width / 2, y: player.y + player.height / 2, width: player.width };
  }

  /** ...and which way its mouth faces */
  mouthed(player: PlayerSchema): { x: number; y: number; width: number; facing: number } {
    return { ...this.bodyOf(player), facing: player.facing };
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

  /** Where a turbine's exhaust points at world time `time` */
  exhaustOf(turbine: TurbineSchema, time: number): number {
    return turbine.still ? turbine.intake + Math.PI : exhaustAngle(turbine.intake, turbine.sweepFrom, time);
  }

  /** A gem on its way through a turbine: into the intake (from a player, or off the ground), across, and out of the exhaust */
  addFlight(turbine: TurbineSchema, victim: string, fromX: number, fromY: number, value: number, counted: boolean, mouthX: number, mouthY: number): void {
    const t = this.time;
    const travel = victim ? Math.max(TURBINE.MIN_TRAVEL_MS, (Math.hypot(mouthX - fromX, mouthY - fromY) / TURBINE.TRAVEL_SPEED) * 1000) : 0;
    const flight = new TurbineFlightSchema(turbine.id, victim, fromX, fromY, value, t, t + travel, t + travel + TURBINE.INSIDE_MS);
    flight.counted = counted;
    this.flights.set(`f${this.nextFlightId++}`, flight);
  }

  turbineById(id: string): TurbineSchema | null {
    let found: TurbineSchema | null = null;
    this.turbines.forEach((turbine) => {
      if (turbine.id === id) found = turbine;
    });
    return found;
  }

  /** A spot for a new turbine: away from the edge, other turbines and players, and on the floor during a shift */
  turbineSpot(): { x: number; y: number; intake: number } | null {
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
  turbineFits(x: number, y: number): boolean {
    if (this.shiftPhase === "normal" || !this.layout) return true;
    const reach = TURBINE.BODY_RADIUS + 60;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      if (!this.isFloorAt(x + Math.cos(a) * reach, y + Math.sin(a) * reach)) return false;
    }
    return this.isFloorAt(x, y);
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
  spawn(player: PlayerSchema, now: number): void {
    clearCapture(this, player.sessionId, now);
    player.land();
    player.setGems(player.gems, this.worldWidth, this.worldHeight);
    this.clearTheftFor(player.sessionId);
    const pending = player.pendingWeaponGems + player.pendingCombatGems;
    player.pendingWeaponGems = player.pendingCombatGems = 0;
    if (pending > 0) player.setGems(player.gems + pending, this.worldWidth, this.worldHeight);
    const size = player.width;
    // Keep a centered newborn view wholly on the map, including wide desktops.
    const halfView = viewShort(ARENA_RULES.PLAYER_SIZE) * WORLD.MAX_VIEW_ASPECT / 2 + 120;
    const marginX = Math.min(halfView, (this.worldWidth - size) / 3);
    const marginY = Math.min(halfView, (this.worldHeight - size) / 3);
    const leader = this.leader();
    let best = { x: (this.worldWidth - size) / 2, y: (this.worldHeight - size) / 2 };
    let bestClearance = -Infinity;
    for (let attempt = 0; attempt < SPAWN_TRIES; attempt++) {
      // During a grace period or shift, only the (new) floor will do
      const onFloor = this.layout ? randomFloorPoint(this.layout, size / 2 + 10) : null;
      const x = onFloor ? onFloor.x - size / 2 : marginX + Math.random() * (this.worldWidth - size - 2 * marginX);
      const y = onFloor ? onFloor.y - size / 2 : marginY + Math.random() * (this.worldHeight - size - 2 * marginY);
      const clearance = clearanceAt(this, x + size / 2, y + size / 2, player, leader);
      if (clearance > bestClearance) {
        best = { x, y };
        bestClearance = clearance;
      }
      if (clearance >= WORLD.SPAWN_CLEARANCE) break;
    }
    // Crowding or an unlucky random stream should not hide an available safe spawn.
    if (bestClearance < WORLD.SPAWN_CLEARANCE) for (let row = 0; row < 5; row++) for (let col = 0; col < 5; col++) {
      const x = marginX + col / 4 * (this.worldWidth - size - 2 * marginX);
      const y = marginY + row / 4 * (this.worldHeight - size - 2 * marginY);
      if (!this.isFloorAt(x + size / 2, y + size / 2)) continue;
      const clearance = clearanceAt(this, x + size / 2, y + size / 2, player, leader);
      if (clearance > bestClearance) { best = { x, y }; bestClearance = clearance; }
    }
    player.spawnAt(Math.round(best.x), Math.round(best.y), now);
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
type("string")(GameState.prototype, "surgePhase");
type("number")(GameState.prototype, "surgeAt");
type("number")(GameState.prototype, "surgeX");
type("number")(GameState.prototype, "surgeY");
type(PinwheelSchema)(GameState.prototype, "pinwheel");
type([PinwheelSchema])(GameState.prototype, "weaponSets");

type([BlackHoleSchema])(GameState.prototype, "blackHoles");
type(PracticeSchema)(GameState.prototype, "practice");

export { GameState };
