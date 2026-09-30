import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import type { Box } from "../game/movement.js";

const { ARENA_RULES, BALLS } = GAME_CONSTANTS;

/**
 * A ball: rolls diagonally and bounces off the arena's walls, cutting across the traffic lanes.
 * Hits are tested against its true circle, so clipping a corner is a miss.
 */
class BallSchema extends Schema {
  /** The ball's center */
  x: number;
  y: number;
  radius: number;
  /** Velocity in units per second (browsers use it to draw the ball in step with the server) */
  vx: number;
  vy: number;

  constructor(worldWidth: number, worldHeight: number) {
    super();
    this.radius = BALLS.RADIUS;
    this.x = this.radius + Math.random() * (worldWidth - 2 * this.radius);
    this.y = this.radius + Math.random() * (worldHeight - 2 * this.radius);
    // One of the four diagonals, give or take 20 degrees
    const angle = (Math.floor(Math.random() * 4) + 0.5) * (Math.PI / 2) + (Math.random() - 0.5) * (Math.PI / 4.5);
    this.vx = Math.cos(angle) * BALLS.SPEED;
    this.vy = Math.sin(angle) * BALLS.SPEED;
  }

  /**
   * Roll on, bouncing off the world's walls while a traffic wave is on (`bounce`); between waves it
   * rolls out of the world instead. False once it has left (a ball standing still stays put).
   */
  update(deltaTime: number, worldWidth: number, worldHeight: number, bounce = true): boolean {
    if (this.vx === 0 && this.vy === 0) return true;
    const r = this.radius;
    let x = this.x + this.vx * deltaTime;
    let y = this.y + this.vy * deltaTime;
    if (bounce) {
      if (x < r) {
        x = 2 * r - x;
        this.vx = Math.abs(this.vx);
      } else if (x > worldWidth - r) {
        x = 2 * (worldWidth - r) - x;
        this.vx = -Math.abs(this.vx);
      }
      if (y < r) {
        y = 2 * r - y;
        this.vy = Math.abs(this.vy);
      } else if (y > worldHeight - r) {
        y = 2 * (worldHeight - r) - y;
        this.vy = -Math.abs(this.vy);
      }
    }
    this.x = x;
    this.y = y;
    const margin = r + 40;
    return x > -margin && x < worldWidth + margin && y > -margin && y < worldHeight + margin;
  }

  /** Out of the world, waiting for the next traffic wave */
  park(): void {
    this.placeAt(-500, -500);
  }

  /** Roll in from a random edge on a diagonal (a traffic wave starting) */
  enter(worldWidth: number, worldHeight: number): void {
    const r = this.radius;
    const side = Math.floor(Math.random() * 4);
    const along = 0.15 + Math.random() * 0.7;
    this.x = side === 1 ? worldWidth - r - 1 : side === 3 ? r + 1 : along * worldWidth;
    this.y = side === 0 ? r + 1 : side === 2 ? worldHeight - r - 1 : along * worldHeight;
    const inward = side === 0 ? Math.PI / 2 : side === 1 ? Math.PI : side === 2 ? -Math.PI / 2 : 0;
    const angle = inward + (((25 + Math.random() * 40) * Math.PI) / 180) * (Math.random() < 0.5 ? -1 : 1);
    this.vx = Math.cos(angle) * BALLS.SPEED;
    this.vy = Math.sin(angle) * BALLS.SPEED;
  }

  /** Whether the ball hits a box: its true circle, a few units inside the drawing like traffic */
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
  }
}

// Fields sent to clients
type("number")(BallSchema.prototype, "x");
type("number")(BallSchema.prototype, "y");
type("number")(BallSchema.prototype, "radius");
type("number")(BallSchema.prototype, "vx");
type("number")(BallSchema.prototype, "vy");

export { BallSchema };
