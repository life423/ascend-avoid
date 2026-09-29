import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import type { Box } from "../game/movement.js";

const { GEMS } = GAME_CONSTANTS;

/** Sprayed gems blink for this long before they vanish */
const EXPIRY_WARNING_MS = 3000;
/** A sliding gem stops once it's this slow (units per second) */
const STOP_SPEED = 8;

/**
 * A gem: lying in the field, or burst out of a player who was hit and sliding to a stop.
 * Worth `value` gems (a hit on a big pile sprays bigger gems).
 */
class GemSchema extends Schema {
  x: number;
  y: number;
  value: number;
  /** About to vanish: drawn blinking */
  expiring: boolean;

  /** Server-only */
  sprayed = false;
  private pickupAt = 0;
  private expiresAt = 0;
  private px = 0;
  private py = 0;
  private vx = 0;
  private vy = 0;

  constructor(x: number, y: number, value = 1) {
    super();
    this.px = x;
    this.py = y;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.value = value;
    this.expiring = false;
  }

  /** Burst outward from a hit: it slides out, can't be grabbed for a moment, and vanishes if nobody does */
  spray(angle: number, speed: number, now: number): void {
    this.sprayed = true;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.pickupAt = now + GEMS.SPRAY_PICKUP_DELAY_MS;
    this.expiresAt = now + GEMS.SPRAY_LIFETIME_MS;
  }

  /** Slide, bouncing off the world's walls; returns false once a sprayed gem has expired */
  update(deltaTime: number, worldWidth: number, worldHeight: number, now: number): boolean {
    if (!this.sprayed) return true;
    if (now >= this.expiresAt) return false;
    if (this.vx !== 0 || this.vy !== 0) {
      const r = GEMS.RADIUS;
      this.px += this.vx * deltaTime;
      this.py += this.vy * deltaTime;
      if (this.px < r) {
        this.px = r;
        this.vx = Math.abs(this.vx);
      } else if (this.px > worldWidth - r) {
        this.px = worldWidth - r;
        this.vx = -Math.abs(this.vx);
      }
      if (this.py < r) {
        this.py = r;
        this.vy = Math.abs(this.vy);
      } else if (this.py > worldHeight - r) {
        this.py = worldHeight - r;
        this.vy = -Math.abs(this.vy);
      }
      const slow = Math.exp(-GEMS.SPRAY_FRICTION * deltaTime);
      this.vx *= slow;
      this.vy *= slow;
      if (Math.hypot(this.vx, this.vy) < STOP_SPEED) {
        this.vx = 0;
        this.vy = 0;
      }
      const x = Math.round(this.px);
      const y = Math.round(this.py);
      if (x !== this.x) this.x = x;
      if (y !== this.y) this.y = y;
    }
    const expiring = this.expiresAt - now < EXPIRY_WARNING_MS;
    if (expiring !== this.expiring) this.expiring = expiring;
    return true;
  }

  /** Whether a player's box touches this gem, once it can be picked up */
  touches(box: Box, now: number): boolean {
    if (now < this.pickupAt) return false;
    const r = GEMS.RADIUS;
    return this.x > box.x - r && this.x < box.x + box.width + r && this.y > box.y - r && this.y < box.y + box.height + r;
  }
}

// Fields sent to clients
type("number")(GemSchema.prototype, "x");
type("number")(GemSchema.prototype, "y");
type("number")(GemSchema.prototype, "value");
type("boolean")(GemSchema.prototype, "expiring");

export { GemSchema };
