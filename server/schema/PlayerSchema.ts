import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { turnRate, turnToward, walk } from "../game/movement.js";
import type { Box, Direction } from "../game/movement.js";

const { ARENA_RULES, BOTS, GEMS, INHALE, PLAYER_STATE, PUSH, WORLD } = GAME_CONSTANTS;


/** A creature's size: small to start, growing with the square root of its gems, with no ceiling */
function sizeFor(gems: number): number {
  const size = ARENA_RULES.PLAYER_SIZE + GEMS.SIZE_PER_ROOT * Math.sqrt(gems);
  return Math.round(size * 2) / 2;
}

/**
 * One player in the world. Browsers ask for hops; the server applies them (see
 * game/movement.ts), counts gems and decides hits.
 */
class PlayerSchema extends Schema {
  sessionId: string;
  playerIndex: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** "alive", or "dead" while knocked out and waiting to come back */
  state: string;
  /** Score and weight: more gems make a bigger player with longer hops */
  gems: number;
  /** Just (re)spawned: drawn translucent in a bubble, and traffic passes through for a moment */
  spawnProtected: boolean;
  /** Just hit and lost gems: blinking, and traffic passes through for a moment */
  recovering: boolean;
  /** Shoved: sliding to a stop, and can't hop until then */
  sliding: boolean;
  /** A bot, not a person (drawn with a robot by its name) */
  isBot: boolean;

  /** Server-only: when a knocked-out player comes back */
  respawnAt = 0;
  private protectedUntil = 0;
  private recoverUntil = 0;
  private decayProgress = 0;
  private vx = 0;
  private vy = 0;
  private lastShoveBy = "";
  private lastShoveAt = 0;
  private bountyAt = 0;
  /** Where the browser is steering (no longer than 1), and the walking velocity it produces */
  private steerX = 0;
  private steerY = 0;
  private walkX = 0;
  private walkY = 0;
  /** The way the player last steered (a dash goes this way if they aren't steering) */
  private facingX = 0;
  private facingY = -1;
  private queuedDash: { x: number; y: number } | null = null;
  private dashX = 0;
  private dashY = 0;
  private dashUntil = 0;
  /** Mid-dash (everyone draws the streak) */
  bursting: boolean;
  /** How the last shove came: "shove", "dash", "sling" or "crush" (for credits) */
  lastShoveKind = "";
  /** Which way the creature faces (radians): its back is where it's vulnerable */
  facing: number;
  /** Inhaling (holding the button): rooted, pulling in what's in front. See GameState.updateInhales */
  inhaling: boolean;
  /** What's in your mouth to spit: "bomb" (or "lit" once its fuse is running), or "" */
  mouth: string;
  /** Whose gems are streaming into your mouth right now ("" when nobody's) */
  stealingFrom: string;
  /** Server-only: gems part-stolen, and how many this run of stealing has taken */
  stealProgress = 0;
  stolenRun = 0;
  /** Server-only: when this breath runs out, and when you can spit again */
  inhaleStopAt = 0;
  /** Server-only: when you've caught your breath for the next inhale */
  inhaleReadyAt = 0;
  spitReadyAt = 0;
  /** Server-only: where an inhale is aimed (the creature turns to face it) */
  aimX = 0;
  aimY = 0;
  private dashReadyAt = 0;

  constructor(sessionId: string, playerIndex: number) {
    super();
    this.bursting = false;
    this.facing = -Math.PI / 2;
    this.inhaling = false;
    this.mouth = "";
    this.stealingFrom = "";
    this.sessionId = sessionId;
    this.playerIndex = playerIndex;
    this.name = `Player ${playerIndex + 1}`;
    this.x = 0;
    this.y = 0;
    this.width = ARENA_RULES.PLAYER_SIZE;
    this.height = ARENA_RULES.PLAYER_SIZE;
    this.state = PLAYER_STATE.ALIVE;
    this.gems = 0;
    this.spawnProtected = false;
    this.recovering = false;
    this.sliding = false;
    this.isBot = false;
  }

  /** Put the player at a spot, in play and protected for a moment */
  spawnAt(x: number, y: number, now: number): void {
    this.x = x;
    this.y = y;
    this.state = PLAYER_STATE.ALIVE;
    this.recovering = false;
    this.stopSliding();
    this.protectFor(WORLD.SPAWN_PROTECTION_MS, now);
    this.queuedDash = null;
    this.dashUntil = 0;
    this.inhaling = false;
  }

  /** Traffic passes through for `ms` (drawn in a bubble) */
  protectFor(ms: number, now: number): void {
    this.spawnProtected = true;
    this.protectedUntil = now + ms;
  }

  /** Just lost gems to a hit: blink, and let traffic pass through for a moment */
  recover(now: number): void {
    this.recovering = true;
    this.recoverUntil = now + GEMS.HIT_RECOVERY_MS;
  }

  /** Safe from traffic right now */
  isSafe(): boolean {
    return this.spawnProtected || this.recovering;
  }

  /** Hit with no gems left: out of play until respawnAt */
  knockOut(now: number): void {
    this.state = PLAYER_STATE.DEAD;
    this.spawnProtected = false;
    this.recovering = false;
    this.respawnAt = now + WORLD.RESPAWN_DELAY_MS;
    this.queuedDash = null;
    this.dashUntil = 0;
    this.inhaling = false;
    this.stopSliding();
  }

  /** How heavy the player is: grows with their size, from 1 for a new player up to 5 at full size */
  weight(): number {
    return this.width / ARENA_RULES.PLAYER_SIZE;
  }

  /** Move straight to a spot, stopping any slide */
  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.stopSliding();
  }

  /** Protection ends the moment you shove someone */
  dropProtection(): void {
    if (this.spawnProtected) this.spawnProtected = false;
  }

  /**
   * Shoved: slide about `distance` units in a direction, on top of any slide already under way,
   * so shoves from two players add up. Returns false if the same player shoved a moment ago.
   */
  shove(direction: Direction, distance: number, by: string, now: number): boolean {
    const along = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    return this.shoveAlong(along[0], along[1], distance, by, now);
  }

  /** Shoved along (dx, dy), in any direction: see shove() */
  shoveAlong(dx: number, dy: number, distance: number, by: string, now: number, kind = "shove"): boolean {
    if (by === this.lastShoveBy && now - this.lastShoveAt < PUSH.SAME_SHOVER_COOLDOWN_MS) return false;
    this.lastShoveBy = by;
    this.lastShoveAt = now;
    this.lastShoveKind = kind;
    const length = Math.hypot(dx, dy) || 1;
    const speed = distance * PUSH.FRICTION;
    this.vx += (dx / length) * speed;
    this.vy += (dy / length) * speed;
    this.sliding = true;
    this.queuedDash = null;
    this.dashUntil = 0;
    this.inhaling = false;
    return true;
  }

  /** Knocked by a hit: skid `distance` along (dx, dy), in any direction, on top of any slide under way */
  skid(dx: number, dy: number, distance: number): void {
    let length = Math.hypot(dx, dy);
    if (length < 1e-6) {
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      length = 1;
    }
    const speed = distance * PUSH.FRICTION;
    this.vx += (dx / length) * speed;
    this.vy += (dy / length) * speed;
    this.sliding = true;
    this.queuedDash = null;
    this.dashUntil = 0;
    this.inhaling = false;
  }

  /** Who shoved this player within the last `withinMs` (their session id), if anyone */
  shovedBy(now: number, withinMs: number): string | null {
    return this.lastShoveBy && now - this.lastShoveAt <= withinMs ? this.lastShoveBy : null;
  }

  /** Whether shoving this player, as leader, can knock gems loose right now (starts the cooldown if so) */
  takeBounty(now: number): boolean {
    if (now < this.bountyAt) return false;
    this.bountyAt = now + PUSH.HIT_IMMUNITY_MS;
    return true;
  }

  /** Change the gem count; the player grows or shrinks around their center, staying inside the world */
  setGems(count: number, worldWidth: number, worldHeight: number): void {
    this.gems = Math.max(0, Math.round(count));
    const size = sizeFor(this.gems);
    if (size === this.width) return;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const margin = ARENA_RULES.EDGE_MARGIN;
    this.width = size;
    this.height = size;
    this.x = Math.max(margin, Math.min(centerX - size / 2, worldWidth - size - margin));
    this.y = Math.max(margin, Math.min(centerY - size / 2, worldHeight - size - margin));
  }

  /** The box traffic hits: what you see, a little inside the edges so grazing doesn't count */
  hitBox(): Box {
    const size = this.width * (1 - 2 * ARENA_RULES.PLAYER_HIT_SHRINK);
    return { x: this.x + (this.width - size) / 2, y: this.y + (this.height - size) / 2, width: size, height: size };
  }

  /**
   * Big creatures slowly shed gems, faster the bigger they are (a share of what they hold above the
   * decay start each second), so growth slows down instead of hitting a ceiling. Bots start sooner
   * and shed faster, so people can outgrow them.
   */
  decay(deltaTime: number, worldWidth: number, worldHeight: number): void {
    const start = this.isBot ? BOTS.DECAY_START : GEMS.DECAY_START;
    const rate = this.isBot ? BOTS.DECAY_RATE : GEMS.DECAY_RATE;
    if (this.gems <= start) {
      this.decayProgress = 0;
      return;
    }
    this.decayProgress += deltaTime * (this.gems - start) * rate;
    if (this.decayProgress < 1) return;
    const lost = Math.floor(this.decayProgress);
    this.decayProgress -= lost;
    this.setGems(this.gems - lost, worldWidth, worldHeight);
  }

  /** Queue a dash the browser asked for: several hops' worth at once (see ARENA_RULES.DASH_*) */
  requestDash(x: number, y: number): void {
    if (this.state !== PLAYER_STATE.ALIVE || this.sliding || this.recovering || this.inhaling) return;
    const length = Math.hypot(x, y);
    this.queuedDash = Number.isFinite(length) && length > 1e-6 ? { x: x / length, y: y / length } : { x: this.facingX, y: this.facingY };
  }

  /** Where the browser is steering: a direction no longer than 1 (a light push walks slower) */
  steer(x: number, y: number): void {
    const length = Math.hypot(x, y);
    if (!Number.isFinite(length)) {
      this.steerX = 0;
      this.steerY = 0;
      return;
    }
    const scale = length > 1 ? 1 / length : 1;
    this.steerX = x * scale;
    this.steerY = y * scale;
  }

  /** How fast the player is moving right now: walking, dashing and sliding together */
  velocity(): { x: number; y: number } {
    return { x: this.walkX + this.vx, y: this.walkY + this.vy };
  }

  /** Where an inhale is aimed (only while inhaling): the creature turns to face it */
  aimAt(x: number, y: number): void {
    const length = Math.hypot(x, y);
    if (!this.inhaling || !Number.isFinite(length) || length < 1e-6) return;
    this.aimX = x / length;
    this.aimY = y / length;
  }

  /** Start inhaling (for up to `forMs`, INHALE.MAX_MS for players): you move as usual, and your mouth turns toward your aim */
  startInhale(now: number, forMs = 3000): void {
    if (this.state !== PLAYER_STATE.ALIVE || this.sliding || this.recovering || now < this.inhaleReadyAt) return;
    this.inhaling = true;
    this.inhaleStopAt = now + forMs;
    this.aimX = 0;
    this.aimY = 0;
  }

  /** Stop inhaling: you need a moment (INHALE.RECOVER_MS) to catch your breath before the next one */
  stopInhale(now = Date.now()): void {
    if (!this.inhaling) return;
    this.inhaling = false;
    this.inhaleReadyAt = now + INHALE.RECOVER_MS;
  }

  /** Where the player is steering */
  steering(): { x: number; y: number } {
    return { x: this.steerX, y: this.steerY };
  }

  /** Whether a dash is under way (it shoves whoever it runs into) */
  dashing(now: number): boolean {
    return now < this.dashUntil;
  }

  /** The way the dash under way is going */
  dashDirection(): { x: number; y: number } {
    return { x: this.dashX, y: this.dashY };
  }

  /** The dash ran into someone: it stops there */
  endDash(): void {
    this.dashUntil = 0;
    this.walkX = 0;
    this.walkY = 0;
  }

  /** Moved aside by someone walking into you, staying inside the world */
  nudge(dx: number, dy: number, worldWidth: number, worldHeight: number): void {
    const margin = ARENA_RULES.EDGE_MARGIN;
    this.x = Math.max(margin, Math.min(this.x + dx, worldWidth - this.width - margin));
    this.y = Math.max(margin, Math.min(this.y + dy, worldHeight - this.height - margin));
  }

  /**
   * Move for this tick: slide if shoved or skidding; otherwise walk where the player is steering
   * (eased, so starts and stops are smooth), or burst along a dash. No steering while recovering.
   * Protection and recovery wear off here too.
   */
  updateMovement(worldWidth: number, worldHeight: number, now: number, deltaTime: number): void {
    if (this.state !== PLAYER_STATE.ALIVE) return;
    if (this.spawnProtected && now >= this.protectedUntil) this.spawnProtected = false;
    if (this.recovering && now >= this.recoverUntil) this.recovering = false;
    if (this.inhaling && now >= this.inhaleStopAt) this.stopInhale(now);
    if (this.sliding) {
      this.walkX = 0;
      this.walkY = 0;
      this.queuedDash = null;
      if (this.bursting) this.bursting = false;
      this.slide(deltaTime, worldWidth, worldHeight);
      return;
    }
    if (this.queuedDash && now >= this.dashReadyAt && !this.recovering) {
      this.dashX = this.queuedDash.x;
      this.dashY = this.queuedDash.y;
      this.dashUntil = now + ARENA_RULES.DASH_MS;
      this.dashReadyAt = now + ARENA_RULES.DASH_COOLDOWN_MS;
      if (this.gems > 0) this.setGems(this.gems - ARENA_RULES.DASH_COST, worldWidth, worldHeight);
    }
    this.queuedDash = null;
    // Charging holds you still: the stick aims instead
    const steer = this.recovering ? { x: 0, y: 0 } : { x: this.steerX, y: this.steerY };
    const box = { x: this.x, y: this.y, width: this.width, height: this.height };
    const velocity = { x: this.walkX, y: this.walkY };
    walk(box, velocity, steer, deltaTime, worldWidth, worldHeight, now < this.dashUntil ? { x: this.dashX * ARENA_RULES.DASH_SPEED, y: this.dashY * ARENA_RULES.DASH_SPEED } : null);
    this.walkX = velocity.x;
    this.walkY = velocity.y;
    // Facing: toward the aim while inhaling, along a dash, otherwise where you steer
    const intent = this.inhaling ? { x: this.aimX, y: this.aimY } : now < this.dashUntil ? { x: this.dashX, y: this.dashY } : { x: this.steerX, y: this.steerY };
    if (Math.hypot(intent.x, intent.y) > 0.25) {
      const facing = turnToward(this.facing, Math.atan2(intent.y, intent.x), turnRate(this.width) * deltaTime);
      if (facing !== this.facing) this.facing = facing;
    }
    const bursting = now < this.dashUntil;
    if (this.bursting !== bursting) this.bursting = bursting;
    if (box.x !== this.x) this.x = box.x;
    if (box.y !== this.y) this.y = box.y;
    const steering = Math.hypot(steer.x, steer.y);
    if (steering > 0.2) {
      this.facingX = steer.x / steering;
      this.facingY = steer.y / steering;
    }
  }

  /** Slide after a shove, slowing to a stop; the world's walls stop you dead */
  private slide(deltaTime: number, worldWidth: number, worldHeight: number): void {
    const margin = ARENA_RULES.EDGE_MARGIN;
    // Exactly how far this tick's slowing slide goes, so a shove travels PUSH.DISTANCE
    const slow = Math.exp(-PUSH.FRICTION * deltaTime);
    const travel = (1 - slow) / PUSH.FRICTION;
    let x = this.x + this.vx * travel;
    let y = this.y + this.vy * travel;
    if (x < margin || x > worldWidth - this.width - margin) {
      x = Math.max(margin, Math.min(x, worldWidth - this.width - margin));
      this.vx = 0;
    }
    if (y < margin || y > worldHeight - this.height - margin) {
      y = Math.max(margin, Math.min(y, worldHeight - this.height - margin));
      this.vy = 0;
    }
    this.x = x;
    this.y = y;
    this.vx *= slow;
    this.vy *= slow;
    if (Math.hypot(this.vx, this.vy) < PUSH.STOP_SPEED) this.stopSliding();
  }

  private stopSliding(): void {
    this.vx = 0;
    this.vy = 0;
    if (this.sliding) this.sliding = false;
  }
}

// Fields sent to clients
type("string")(PlayerSchema.prototype, "sessionId");
type("number")(PlayerSchema.prototype, "playerIndex");
type("string")(PlayerSchema.prototype, "name");
type("number")(PlayerSchema.prototype, "x");
type("number")(PlayerSchema.prototype, "y");
type("number")(PlayerSchema.prototype, "width");
type("number")(PlayerSchema.prototype, "height");
type("string")(PlayerSchema.prototype, "state");
type("number")(PlayerSchema.prototype, "gems");
type("boolean")(PlayerSchema.prototype, "spawnProtected");
type("boolean")(PlayerSchema.prototype, "recovering");
type("boolean")(PlayerSchema.prototype, "sliding");
type("boolean")(PlayerSchema.prototype, "bursting");
type("number")(PlayerSchema.prototype, "facing");
type("boolean")(PlayerSchema.prototype, "inhaling");
type("string")(PlayerSchema.prototype, "mouth");
type("string")(PlayerSchema.prototype, "stealingFrom");
type("boolean")(PlayerSchema.prototype, "isBot");

export { PlayerSchema };
