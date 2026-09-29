import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import type { Box } from "../game/movement.js";

const { ARENA_RULES } = GAME_CONSTANTS;


/**
 * Traffic crossing the world. Each obstacle drives straight along its lane (see TRAFFIC and
 * GameState.launchObstacle) and enters a lane again once it has left the world.
 */
class ObstacleSchema extends Schema {
  x: number;
  y: number;
  width: number;
  height: number;
  variant: number;

  /** Velocity in units per second (browsers use it to draw traffic in step with the server) */
  vx = 0;
  vy = 0;
  /** Server-only: which traffic lane it's in (-1 while waiting for a safe lane, or placed by hand) */
  lane = -1;

  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.width = ARENA_RULES.OBSTACLE_MIN_LENGTH;
    this.height = ARENA_RULES.OBSTACLE_THICKNESS;
    this.variant = 0;
  }

  /** Put the obstacle in a traffic lane: long along the lane, `start` along it and centered on `across` */
  enter(lane: number, horizontal: boolean, direction: number, speed: number, start: number, length: number, across: number): void {
    const thickness = ARENA_RULES.OBSTACLE_THICKNESS;
    this.lane = lane;
    this.width = horizontal ? length : thickness;
    this.height = horizontal ? thickness : length;
    this.vx = horizontal ? direction * speed : 0;
    this.vy = horizontal ? 0 : direction * speed;
    this.x = horizontal ? start : Math.round(across - thickness / 2);
    this.y = horizontal ? Math.round(across - thickness / 2) : start;
    this.variant = Math.floor(Math.random() * 3);
  }

  /** Out of sight, waiting for a lane where it can enter safely */
  park(): void {
    this.lane = -1;
    this.vx = 0;
    this.vy = 0;
    this.x = -1000;
    this.y = -1000;
  }

  /** Move along; returns false once the obstacle has left the world */
  update(deltaTime: number, worldWidth: number, worldHeight: number): boolean {
    this.x += this.vx * deltaTime;
    this.y += this.vy * deltaTime;
    if (this.vx > 0) return this.x < worldWidth;
    if (this.vx < 0) return this.x + this.width > 0;
    if (this.vy > 0) return this.y < worldHeight;
    return this.y + this.height > 0;
  }

  /**
   * Whether this obstacle hits a box (a player's hit box, or the ground they covered this tick).
   * The test follows the obstacle's drawn shape, stretched to its size: a block (variant 0), a
   * diamond (1) or a capsule (2), so a hit looks like a hit and a miss looks like a miss.
   */
  checkCollision(box: Box): boolean {
    const inset = ARENA_RULES.OBSTACLE_HIT_INSET;
    const halfWidth = this.width / 2 - inset;
    const halfHeight = this.height / 2 - inset;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    // How far the box is from the obstacle's center along each axis (0 where it spans it)
    const dx = Math.max(box.x - centerX, 0, centerX - (box.x + box.width));
    const dy = Math.max(box.y - centerY, 0, centerY - (box.y + box.height));
    if (this.variant === 1) return dx / halfWidth + dy / halfHeight <= 1;
    if (this.variant === 2) {
      // A capsule: a straight core along its length, with round ends
      const radius = Math.min(halfWidth, halfHeight);
      return Math.hypot(Math.max(0, dx - (halfWidth - radius)), Math.max(0, dy - (halfHeight - radius))) <= radius;
    }
    return dx <= halfWidth && dy <= halfHeight;
  }

  /** Stand the obstacle still at a spot (used by the automated test) */
  placeAt(x: number, y: number, width: number, height: number, variant: number): void {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.variant = variant;
    this.vx = 0;
    this.vy = 0;
    this.lane = -1;
  }
}

// Fields sent to clients
type("number")(ObstacleSchema.prototype, "x");
type("number")(ObstacleSchema.prototype, "y");
type("number")(ObstacleSchema.prototype, "width");
type("number")(ObstacleSchema.prototype, "height");
type("number")(ObstacleSchema.prototype, "variant");
type("number")(ObstacleSchema.prototype, "vx");
type("number")(ObstacleSchema.prototype, "vy");

export { ObstacleSchema };
