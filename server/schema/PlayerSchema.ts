import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { hop } from "../game/movement.js";
import type { Direction } from "../game/movement.js";

const { ARENA_RULES, PLAYER_STATE, WORLD } = GAME_CONSTANTS;

/** At most this many hops wait to be applied; more are dropped, so flooding can't speed anyone up */
const MAX_QUEUED_HOPS = 4;

/**
 * One player in the world. Browsers ask for hops; the server applies them (see
 * game/movement.ts) and decides hits.
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
  score: number;
  /** Just (re)spawned: drawn translucent, and obstacles pass through for a moment */
  spawnProtected: boolean;

  /** Server-only: when a knocked-out player comes back */
  respawnAt = 0;
  private protectedUntil = 0;
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
    this.score = 0;
    this.spawnProtected = false;
  }

  /** Put the player at a spot, in play and protected for a moment */
  spawnAt(x: number, y: number, now: number): void {
    this.x = x;
    this.y = y;
    this.state = PLAYER_STATE.ALIVE;
    this.spawnProtected = true;
    this.protectedUntil = now + WORLD.SPAWN_PROTECTION_MS;
    this.queuedHops = [];
  }

  /** Out of play until respawnAt */
  knockOut(now: number): void {
    this.state = PLAYER_STATE.DEAD;
    this.spawnProtected = false;
    this.respawnAt = now + WORLD.RESPAWN_DELAY_MS;
    this.queuedHops = [];
  }

  /** Queue a hop the browser asked for */
  requestHop(direction: Direction): void {
    if (this.state !== PLAYER_STATE.ALIVE || this.queuedHops.length >= MAX_QUEUED_HOPS) return;
    this.queuedHops.push(direction);
  }

  /**
   * Apply queued hops in order, at most one per direction every HOP_COOLDOWN_MS (far faster
   * than anyone taps), and let spawn protection wear off
   */
  updateMovement(worldWidth: number, worldHeight: number, now: number): void {
    if (this.state !== PLAYER_STATE.ALIVE) return;
    if (this.spawnProtected && now >= this.protectedUntil) this.spawnProtected = false;
    if (this.queuedHops.length === 0) return;
    const box = { x: this.x, y: this.y, width: this.width, height: this.height };
    while (this.queuedHops.length > 0) {
      const direction = this.queuedHops[0];
      if (now - this.lastHopAt[direction] < ARENA_RULES.HOP_COOLDOWN_MS) break;
      this.queuedHops.shift();
      this.lastHopAt[direction] = now;
      hop(box, direction, worldWidth, worldHeight);
    }
    if (box.x !== this.x) this.x = box.x;
    if (box.y !== this.y) this.y = box.y;
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
type("number")(PlayerSchema.prototype, "score");
type("boolean")(PlayerSchema.prototype, "spawnProtected");

export { PlayerSchema };
