import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { ROCKS } = GAME_CONSTANTS;

/**
 * A rock: lying around, held in someone's mouth (parked out of the world), or flying after being
 * spat. See GameState.updateInhales and GameState.updateRocks
 */
export class RockSchema extends Schema {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  /** Server-only: whose mouth it's in ("" when it isn't), who spat it and when, and how far it has flown */
  heldBy = "";
  thrownBy = "";
  thrownAt = 0;
  private travelled = 0;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.radius = ROCKS.RADIUS;
    this.vx = 0;
    this.vy = 0;
  }

  flying(): boolean {
    return this.vx !== 0 || this.vy !== 0;
  }

  /** Lying still at a spot */
  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
  }

  /** Into someone's mouth: parked out of the world until it's spat */
  hold(sessionId: string): void {
    this.heldBy = sessionId;
    this.placeAt(-500, -500);
  }

  /** Spat from (x, y) along (dx, dy) */
  launch(x: number, y: number, dx: number, dy: number, by: string, now: number): void {
    this.heldBy = "";
    this.x = x;
    this.y = y;
    this.vx = dx * ROCKS.SPEED;
    this.vy = dy * ROCKS.SPEED;
    this.thrownBy = by;
    this.thrownAt = now;
    this.travelled = 0;
  }

  /** Fly on until it has gone its range (or reaches the world's edge), then lie there */
  update(deltaTime: number, worldWidth: number, worldHeight: number): void {
    if (!this.flying()) return;
    const x = this.x + this.vx * deltaTime;
    const y = this.y + this.vy * deltaTime;
    this.travelled += Math.hypot(this.vx, this.vy) * deltaTime;
    const r = this.radius;
    const inside = x > r && x < worldWidth - r && y > r && y < worldHeight - r;
    if (this.travelled >= ROCKS.RANGE || !inside) {
      this.placeAt(Math.max(r, Math.min(x, worldWidth - r)), Math.max(r, Math.min(y, worldHeight - r)));
      return;
    }
    this.x = x;
    this.y = y;
  }
}

type("number")(RockSchema.prototype, "x");
type("number")(RockSchema.prototype, "y");
type("number")(RockSchema.prototype, "radius");
type("number")(RockSchema.prototype, "vx");
type("number")(RockSchema.prototype, "vy");
