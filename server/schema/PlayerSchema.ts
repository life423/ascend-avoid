import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { PLAYER, PLAYER_STATE } = GAME_CONSTANTS;

/** Which movement keys a player is holding, as last reported by their client */
export interface MovementKeys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
}

/** Players per row when spreading them along the bottom of the arena */
const PLAYERS_PER_ROW = 10;

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
  movementKeys: MovementKeys = { up: false, down: false, left: false, right: false };

  /** Movement speed in pixels per second (BASE_SPEED was tuned per tick, at 30 ticks a second) */
  static readonly SPEED = PLAYER.BASE_SPEED * 30;

  constructor(sessionId: string, playerIndex: number) {
    super();
    this.sessionId = sessionId;
    this.playerIndex = playerIndex;
    this.name = `Player ${playerIndex + 1}`;
    this.x = 0;
    this.y = 0;
    this.width = PLAYER.BASE_WIDTH;
    this.height = PLAYER.BASE_HEIGHT;
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
    this.y = arenaHeight - this.height - 10 - row * (this.height + 10);
    this.movementKeys = { up: false, down: false, left: false, right: false };
  }

  /** Move according to the held keys, staying inside the arena */
  updateMovement(deltaTime: number, arenaWidth: number, arenaHeight: number): void {
    if (this.state !== PLAYER_STATE.ALIVE) return;
    const step = PlayerSchema.SPEED * deltaTime;
    const keys = this.movementKeys;
    const dx = (keys.right ? step : 0) - (keys.left ? step : 0);
    const dy = (keys.down ? step : 0) - (keys.up ? step : 0);
    if (dx === 0 && dy === 0) return;
    this.x = Math.max(0, Math.min(arenaWidth - this.width, this.x + dx));
    this.y = Math.max(0, Math.min(arenaHeight - this.height, this.y + dy));
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
