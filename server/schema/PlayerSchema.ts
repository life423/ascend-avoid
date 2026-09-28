import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { movePlayer, newPresses, NO_KEYS } from "../game/movement.js";
import type { Keys } from "../game/movement.js";

const { ARENA_RULES, PLAYER_STATE } = GAME_CONSTANTS;

/** Players per row when spreading them along the bottom of the arena */
const PLAYERS_PER_ROW = 10;
const DIRECTIONS = ["up", "down", "left", "right"] as const;

/**
 * One player in the room. The server moves players; clients only report which keys are held.
 */
class PlayerSchema extends Schema {
  sessionId: string;
  playerIndex: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  state: string;
  score: number;

  /** Server-only: the keys this player's client says are held */
  private heldKeys: Keys = { ...NO_KEYS };
  /** Server-only: presses not applied yet, so a tap released between ticks still hops */
  private pendingPresses: Keys = { ...NO_KEYS };
  private lastHopAt: Record<keyof Keys, number> = { up: 0, down: 0, left: 0, right: 0 };

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
  }

  /** Put this player in its starting spot: spread evenly along the bottom, in rows of 10 */
  placeAt(slot: number, playerCount: number, arenaWidth: number, arenaHeight: number): void {
    const perRow = Math.max(1, Math.min(playerCount, PLAYERS_PER_ROW));
    const row = Math.floor(slot / PLAYERS_PER_ROW);
    const column = slot % PLAYERS_PER_ROW;
    const spacing = arenaWidth / (perRow + 1);
    this.x = Math.round(spacing * (column + 1) - this.width / 2);
    this.y = arenaHeight - this.height - ARENA_RULES.BOTTOM_MARGIN - row * (this.height + 10);
    this.pendingPresses = { ...NO_KEYS };
  }

  /** Record which keys the client says are held; each new press becomes a hop */
  setKeys(keys: Keys): void {
    const pressed = newPresses(this.heldKeys, keys);
    for (const direction of DIRECTIONS) {
      if (pressed[direction]) this.pendingPresses[direction] = true;
    }
    this.heldKeys = { ...keys };
  }

  /** Move the way solo play does (see game/movement.ts) */
  updateMovement(deltaTime: number, arenaWidth: number, arenaHeight: number, now: number = Date.now()): void {
    if (this.state !== PLAYER_STATE.ALIVE) {
      this.pendingPresses = { ...NO_KEYS };
      return;
    }
    // At most one hop per direction every HOP_COOLDOWN_MS (far faster than anyone taps);
    // a press that comes sooner waits for the next tick instead of being lost
    const hops: Keys = { ...NO_KEYS };
    for (const direction of DIRECTIONS) {
      if (this.pendingPresses[direction] && now - this.lastHopAt[direction] >= ARENA_RULES.HOP_COOLDOWN_MS) {
        hops[direction] = true;
        this.pendingPresses[direction] = false;
        this.lastHopAt[direction] = now;
      }
    }
    const box = { x: this.x, y: this.y, width: this.width, height: this.height };
    movePlayer(box, hops, this.heldKeys.up, deltaTime, arenaWidth, arenaHeight);
    if (box.x !== this.x) this.x = box.x;
    if (box.y !== this.y) this.y = box.y;
  }

  markAsDead(): void {
    this.state = PLAYER_STATE.DEAD;
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

export { PlayerSchema };
