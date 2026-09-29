import * as schema from "@colyseus/schema";
const { Schema, MapSchema, ArraySchema, type } = schema;
import { PlayerSchema } from "./PlayerSchema.js";
import { ObstacleSchema } from "./ObstacleSchema.js";
import { GemSchema } from "./GemSchema.js";
import { BotBrain } from "../game/bots.js";
import { closestFloorPoint, isFloor, jackpotSpot, layoutToString, pickLayout, randomFloorPoint } from "../game/layouts.js";
import type { Layout } from "../game/layouts.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { stopAgainst } from "../game/movement.js";
import type { Direction } from "../game/movement.js";

const { WORLD, ARENA_RULES, GEMS, PLAYER_STATE, PUSH, BOTS, SHIFT, TRAFFIC } = GAME_CONSTANTS;

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
    this.obstacles.forEach((obstacle) => {
      if (!obstacle.update(deltaTime, this.worldWidth, this.worldHeight)) {
        if (!this.launchObstacle(obstacle, false)) obstacle.park();
      }
    });

    const expired: string[] = [];
    this.gems.forEach((gem, id) => {
      if (!gem.update(deltaTime, this.worldWidth, this.worldHeight, now)) expired.push(id);
    });
    expired.forEach((id) => this.gems.delete(id));

    // Bots decide on their hops, which then go through the same rules as everyone's
    this.brains.forEach((brain, id) => {
      const bot = this.players.get(id);
      const move = bot ? brain.think(bot, this, now) : null;
      if (bot && move) bot.requestHop(move);
    });

    this.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE) {
        if (now >= player.respawnAt) this.spawn(player, now);
        return;
      }
      const fromX = player.x;
      const fromY = player.y;
      const hops = player.updateMovement(this.worldWidth, this.worldHeight, now, deltaTime);
      if (hops.length > 0) this.checkShoves(player, hops[hops.length - 1], fromX, fromY, now);
      this.collectGems(player, now);
      player.decay(deltaTime, this.worldWidth, this.worldHeight);
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
      let hit = false;
      this.obstacles.forEach((obstacle) => {
        if (!hit && obstacle.checkCollision(path)) hit = true;
      });
      if (hit) {
        this.credit(player, "traffic", now);
        this.hitPlayer(player, now);
      }
    });

    this.topUpField();
  }

  /**
   * A hit. With gems, half of them burst out and the player blinks for a moment, safe from
   * traffic; with none left, they're knocked out.
   */
  hitPlayer(player: PlayerSchema, now: number = Date.now()): void {
    if (player.gems <= 0) {
      player.knockOut(now);
      return;
    }
    const lost = Math.max(1, Math.ceil(player.gems * GEMS.SPRAY_SHARE));
    const centerX = player.x + player.width / 2;
    const centerY = player.y + player.height / 2;
    player.setGems(player.gems - lost, this.worldWidth, this.worldHeight);
    player.recover(now);
    this.sprayGems(centerX, centerY, lost, now);
  }

  /**
   * A hop that runs into another player stops against them and shoves them that way, farther the heavier the shover is
   * compared with them. Shoving the leader knocks a few of their gems loose. Players who just
   * arrived can't be shoved, and shoving someone ends your own protection.
   */
  private checkShoves(shover: PlayerSchema, direction: Direction, fromX: number, fromY: number, now: number): void {
    const others: PlayerSchema[] = [];
    this.players.forEach((other) => {
      if (other !== shover && other.state === PLAYER_STATE.ALIVE) others.push(other);
    });
    // The hop stops against the first player in its way
    const box = { x: shover.x, y: shover.y, width: shover.width, height: shover.height };
    const hit = stopAgainst(box, direction, fromX, fromY, others);
    if (hit < 0) return;
    if (box.x !== shover.x) shover.x = box.x;
    if (box.y !== shover.y) shover.y = box.y;
    const target = others[hit];
    if (target.spawnProtected) return;
    const leader = this.leader();
    const ratio = Math.min(PUSH.MAX_RATIO, Math.max(PUSH.MIN_RATIO, shover.weight() / target.weight()));
    if (!target.shove(direction, PUSH.DISTANCE * ratio, shover.sessionId, now)) return;
    shover.dropProtection();
    if (target === leader && target.gems > 0 && target.takeBounty(now)) {
      const loose = Math.min(
        target.gems,
        PUSH.LEADER_BOUNTY_MAX,
        Math.max(PUSH.LEADER_BOUNTY_MIN, Math.ceil(target.gems * PUSH.LEADER_BOUNTY_SHARE))
      );
      const centerX = target.x + target.width / 2;
      const centerY = target.y + target.height / 2;
      target.setGems(target.gems - loose, this.worldWidth, this.worldHeight);
      this.sprayGems(centerX, centerY, loose, now);
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
    const spot = closestFloorPoint(this.layout, player.x + player.width / 2, player.y + player.height / 2);
    player.placeAt(spot.x - player.width / 2, spot.y - player.height / 2);
    this.hitPlayer(player, now);
  }

  /** If someone shoved this player just before they were hit or fell, tell everyone who did it */
  private credit(target: PlayerSchema, how: string, now: number): void {
    const byId = target.shovedBy(now, SHIFT.CREDIT_MS);
    const by = byId ? this.players.get(byId) : undefined;
    if (!by || !this.onEvent) return;
    this.onEvent("credit", { byId, by: by.name, targetId: target.sessionId, target: target.name, how, out: target.gems <= 0 });
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
  private collectGems(player: PlayerSchema, now: number): void {
    let collected = 0;
    const taken: string[] = [];
    this.gems.forEach((gem, id) => {
      if (!gem.touches(player, now)) return;
      collected += gem.value;
      taken.push(id);
      if (!gem.sprayed) this.fieldGems--;
    });
    if (collected === 0) return;
    taken.forEach((id) => this.gems.delete(id));
    player.setGems(player.gems + collected, this.worldWidth, this.worldHeight);
  }

  /** Burst gems outward from a point, spread around the circle; big piles make bigger gems */
  private sprayGems(centerX: number, centerY: number, total: number, now: number): void {
    const room = Math.max(1, GEMS.MAX_GEMS - this.gems.size);
    const pieces = Math.min(total, GEMS.SPRAY_PIECES, room);
    const turn = Math.random() * Math.PI * 2;
    for (let i = 0; i < pieces; i++) {
      const value = Math.floor(total / pieces) + (i < total % pieces ? 1 : 0);
      const gem = new GemSchema(centerX, centerY, value);
      const angle = turn + (i / pieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = GEMS.SPRAY_SPEED_MIN + Math.random() * (GEMS.SPRAY_SPEED_MAX - GEMS.SPRAY_SPEED_MIN);
      gem.spray(angle, speed, now);
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
type({ map: GemSchema })(GameState.prototype, "gems");
type("number")(GameState.prototype, "worldWidth");
type("number")(GameState.prototype, "worldHeight");
type("number")(GameState.prototype, "time");
type("string")(GameState.prototype, "shiftPhase");
type("number")(GameState.prototype, "phaseEndsAt");
type("string")(GameState.prototype, "floor");
type("boolean")(GameState.prototype, "jackpotOn");
type("number")(GameState.prototype, "jackpotX");
type("number")(GameState.prototype, "jackpotY");
type("number")(GameState.prototype, "jackpotLandsAt");
type("string")(GameState.prototype, "jackpotHolder");
type("number")(GameState.prototype, "jackpotProgress");

export { GameState };
