import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { hop } from "../game/movement.js";
import type { Box, Direction } from "../game/movement.js";

const { ARENA_RULES, GEMS, PLAYER_STATE, PUSH, WORLD } = GAME_CONSTANTS;

/** At most this many hops wait to be applied; more are dropped, so flooding can't speed anyone up */
const MAX_QUEUED_HOPS = 4;

/** A player's size: grows with the square root of their gems, up to GEMS.MAX_SCALE */
function sizeFor(gems: number): number {
  const scale = Math.min(GEMS.MAX_SCALE, 1 + GEMS.GROWTH * Math.sqrt(gems));
  return Math.round(ARENA_RULES.PLAYER_SIZE * scale * 2) / 2;
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
  private queuedHops: Direction[] = [];
  private lastHopAt: Record<Direction, number> = { up: 0, down: 0, left: 0, right: 0 };

  constructor(sessionId: string, playerIndex: number) {
    super();
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
  }

  /** Put the player at a spot, in play and protected for a moment */
  spawnAt(x: number, y: number, now: number): void {
    this.x = x;
    this.y = y;
    this.state = PLAYER_STATE.ALIVE;
    this.recovering = false;
    this.stopSliding();
    this.protectFor(WORLD.SPAWN_PROTECTION_MS, now);
    this.queuedHops = [];
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
    this.queuedHops = [];
    this.stopSliding();
  }

  /** How heavy the player is: grows with their area, from 1 up to 2.25 at full size */
  weight(): number {
    const scale = this.width / ARENA_RULES.PLAYER_SIZE;
    return scale * scale;
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
    if (by === this.lastShoveBy && now - this.lastShoveAt < PUSH.SAME_SHOVER_COOLDOWN_MS) return false;
    this.lastShoveBy = by;
    this.lastShoveAt = now;
    const speed = distance * PUSH.FRICTION;
    if (direction === "up") this.vy -= speed;
    else if (direction === "down") this.vy += speed;
    else if (direction === "left") this.vx -= speed;
    else this.vx += speed;
    this.sliding = true;
    this.queuedHops = [];
    return true;
  }

  /** Whether shoving this player, as leader, can knock gems loose right now (starts the cooldown if so) */
  takeBounty(now: number): boolean {
    if (now < this.bountyAt) return false;
    this.bountyAt = now + PUSH.LEADER_BOUNTY_COOLDOWN_MS;
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

  /** The box traffic hits: it grows only part as much as the player, so being big isn't punished twice */
  hitBox(): Box {
    const scale = this.width / ARENA_RULES.PLAYER_SIZE;
    const size = ARENA_RULES.PLAYER_SIZE * (1 + (scale - 1) * GEMS.HITBOX_GROWTH);
    return { x: this.x + (this.width - size) / 2, y: this.y + (this.height - size) / 2, width: size, height: size };
  }

  /** Very big players slowly shed gems: none at DECAY_START, one a second at twice that */
  decay(deltaTime: number, worldWidth: number, worldHeight: number): void {
    if (this.gems <= GEMS.DECAY_START) {
      this.decayProgress = 0;
      return;
    }
    this.decayProgress += (deltaTime * (this.gems - GEMS.DECAY_START)) / GEMS.DECAY_START;
    if (this.decayProgress < 1) return;
    const lost = Math.floor(this.decayProgress);
    this.decayProgress -= lost;
    this.setGems(this.gems - lost, worldWidth, worldHeight);
  }

  /** Queue a hop the browser asked for */
  requestHop(direction: Direction): void {
    if (this.state !== PLAYER_STATE.ALIVE || this.sliding || this.queuedHops.length >= MAX_QUEUED_HOPS) return;
    this.queuedHops.push(direction);
  }

  /**
   * Slide if shoved; otherwise apply queued hops in order, at most one per direction every
   * HOP_COOLDOWN_MS (far faster than anyone taps). Protection and recovery wear off here too.
   * Returns the hops applied, so the world can check whether they landed on anyone.
   */
  updateMovement(worldWidth: number, worldHeight: number, now: number, deltaTime: number): Direction[] {
    if (this.state !== PLAYER_STATE.ALIVE) return [];
    if (this.spawnProtected && now >= this.protectedUntil) this.spawnProtected = false;
    if (this.recovering && now >= this.recoverUntil) this.recovering = false;
    if (this.sliding) {
      this.slide(deltaTime, worldWidth, worldHeight);
      return [];
    }
    if (this.queuedHops.length === 0) return [];
    const applied: Direction[] = [];
    const box = { x: this.x, y: this.y, width: this.width, height: this.height };
    while (this.queuedHops.length > 0) {
      const direction = this.queuedHops[0];
      if (now - this.lastHopAt[direction] < ARENA_RULES.HOP_COOLDOWN_MS) break;
      this.queuedHops.shift();
      this.lastHopAt[direction] = now;
      hop(box, direction, worldWidth, worldHeight);
      applied.push(direction);
    }
    if (box.x !== this.x) this.x = box.x;
    if (box.y !== this.y) this.y = box.y;
    return applied;
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

export { PlayerSchema };
