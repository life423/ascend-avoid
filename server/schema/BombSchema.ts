import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { BOMBS } = GAME_CONSTANTS;

/**
 * A bomb: lying around, held in someone's mouth (parked out of the world), sliding after being
 * spat or kicked, or gone for a moment after exploding. See GameState.updateBombs
 */
export class BombSchema extends Schema {
  x: number;
  y: number;
  radius: number;
  vx: number;
  vy: number;
  /** When it goes off, on the world clock (0 while it isn't lit) */
  explodesAt: number;
  /** Server-only: whose mouth it's in ("" when it isn't), who last spat or kicked it, and when it's back after going off */
  heldBy = "";
  thrownBy = "";
  respawnAt = 0;

  constructor(x: number, y: number) {
    super();
    this.x = x;
    this.y = y;
    this.radius = BOMBS.RADIUS;
    this.vx = 0;
    this.vy = 0;
    this.explodesAt = 0;
  }

  lit(): boolean {
    return this.explodesAt > 0;
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

  /** Sliding from (x, y) along (dx, dy) at `speed`: spat or kicked */
  launch(x: number, y: number, dx: number, dy: number, speed: number, by: string): void {
    this.heldBy = "";
    this.x = x;
    this.y = y;
    this.vx = dx * speed;
    this.vy = dy * speed;
    this.thrownBy = by;
  }

  /** Slide on, slowing down and bouncing off the world's walls */
  update(deltaTime: number, worldWidth: number, worldHeight: number): void {
    if (this.vx === 0 && this.vy === 0) return;
    const r = this.radius;
    let x = this.x + this.vx * deltaTime;
    let y = this.y + this.vy * deltaTime;
    if (x < r || x > worldWidth - r) {
      x = Math.max(r, Math.min(x, worldWidth - r));
      this.vx = -this.vx;
    }
    if (y < r || y > worldHeight - r) {
      y = Math.max(r, Math.min(y, worldHeight - r));
      this.vy = -this.vy;
    }
    this.x = x;
    this.y = y;
    const slow = Math.exp(-BOMBS.FRICTION * deltaTime);
    this.vx *= slow;
    this.vy *= slow;
    if (Math.hypot(this.vx, this.vy) < 15) {
      this.vx = 0;
      this.vy = 0;
    }
  }

  /** Gone off: out of the world until `until` (world clock), then back somewhere else */
  vanish(until: number): void {
    this.explodesAt = 0;
    this.heldBy = "";
    this.thrownBy = "";
    this.respawnAt = until;
    this.placeAt(-500, -500);
  }
}

type("number")(BombSchema.prototype, "x");
type("number")(BombSchema.prototype, "y");
type("number")(BombSchema.prototype, "radius");
type("number")(BombSchema.prototype, "vx");
type("number")(BombSchema.prototype, "vy");
type("number")(BombSchema.prototype, "explodesAt");
