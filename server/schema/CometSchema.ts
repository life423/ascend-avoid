import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import type { Box } from "../game/movement.js";

const { ARENA_RULES, COMETS } = GAME_CONSTANTS;

/**
 * A comet: flies in from an edge at a slant (never along the traffic lanes), straight or bending
 * gently, and leaves the world on the far side before coming round again. Hits use its true circle.
 */
class CometSchema extends Schema {
  /** The comet's center */
  x: number;
  y: number;
  radius: number;
  /** Velocity in units per second, and how fast it turns (radians a second; 0 flies straight) */
  vx: number;
  vy: number;
  turn: number;

  constructor() {
    super();
    this.x = -1000;
    this.y = -1000;
    this.radius = COMETS.RADIUS;
    this.vx = 0;
    this.vy = 0;
    this.turn = 0;
  }

  /**
   * Enter from a random edge, heading into the world at a slant, bending gently if `curve`.
   * With `spread` (when the world starts) it's already partway along its path.
   */
  launch(worldWidth: number, worldHeight: number, curve: boolean, spread = false): void {
    const side = Math.floor(Math.random() * 4);
    const margin = this.radius + 4;
    const along = 0.1 + Math.random() * 0.8;
    let x: number;
    let y: number;
    let inward: number;
    if (side === 0) {
      x = along * worldWidth;
      y = -margin;
      inward = Math.PI / 2;
    } else if (side === 1) {
      x = worldWidth + margin;
      y = along * worldHeight;
      inward = Math.PI;
    } else if (side === 2) {
      x = along * worldWidth;
      y = worldHeight + margin;
      inward = -Math.PI / 2;
    } else {
      x = -margin;
      y = along * worldHeight;
      inward = 0;
    }
    // Always a slant: this many degrees off straight in, to one side or the other. A curving comet
    // bends across the diagonal (widening from a shallow slant, or narrowing from a steep one), so
    // its path never lines up with the lanes either
    const lean = Math.random() < 0.5 ? -1 : 1;
    const widening = Math.random() < 0.5;
    const slant = !curve
      ? COMETS.MIN_SLANT + Math.random() * (COMETS.MAX_SLANT - COMETS.MIN_SLANT)
      : widening
        ? COMETS.MIN_SLANT + Math.random() * 13
        : COMETS.MAX_SLANT - Math.random() * 13;
    const angle = inward + ((slant * Math.PI) / 180) * lean;
    const speed = COMETS.SPEED_MIN + Math.random() * (COMETS.SPEED_MAX - COMETS.SPEED_MIN);
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    // A gentle curve: this many degrees over a typical crossing, bending either way
    const crossing = Math.max(worldWidth, worldHeight) / speed;
    const bend = COMETS.CURVE_MIN + Math.random() * (COMETS.CURVE_MAX - COMETS.CURVE_MIN);
    this.turn = curve ? (((bend * Math.PI) / 180) / crossing) * (widening ? lean : -lean) : 0;
    if (spread) {
      const t = Math.random() * crossing * 0.8;
      x += this.vx * t;
      y += this.vy * t;
    }
    this.x = x;
    this.y = y;
  }

  /** Fly on, bending if it curves; false once it has left the world (a comet standing still stays put) */
  update(deltaTime: number, worldWidth: number, worldHeight: number): boolean {
    if (this.vx === 0 && this.vy === 0) return true;
    if (this.turn) {
      const a = this.turn * deltaTime;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const vx = this.vx * cos - this.vy * sin;
      this.vy = this.vx * sin + this.vy * cos;
      this.vx = vx;
    }
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    const margin = this.radius + 40;
    return this.x > -margin && this.x < worldWidth + margin && this.y > -margin && this.y < worldHeight + margin;
  }

  /** Whether the comet hits a box: its true circle, a few units inside the drawing like traffic */
  checkCollision(box: Box): boolean {
    const dx = Math.max(box.x - this.x, 0, this.x - (box.x + box.width));
    const dy = Math.max(box.y - this.y, 0, this.y - (box.y + box.height));
    return Math.hypot(dx, dy) <= this.radius - ARENA_RULES.OBSTACLE_HIT_INSET;
  }

  /** Stand still at a spot (used by the automated test) */
  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.turn = 0;
  }
}

// Fields sent to clients
type("number")(CometSchema.prototype, "x");
type("number")(CometSchema.prototype, "y");
type("number")(CometSchema.prototype, "radius");
type("number")(CometSchema.prototype, "vx");
type("number")(CometSchema.prototype, "vy");
type("number")(CometSchema.prototype, "turn");

export { CometSchema };
