import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import type { Box } from "../game/movement.js";

const { ARENA_RULES } = GAME_CONSTANTS;


/**
 * Traffic crossing the world. Each obstacle drives straight across (right, left, down or up)
 * and re-launches from a random edge once it has left.
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

  constructor() {
    super();
    this.x = 0;
    this.y = 0;
    this.width = ARENA_RULES.OBSTACLE_MIN_LENGTH;
    this.height = ARENA_RULES.OBSTACLE_THICKNESS;
    this.variant = 0;
  }

  /**
   * Send the obstacle across the world from a random edge: horizontal ones are long and flat,
   * vertical ones tall and thin. With `spread` it starts somewhere along its path instead, so a
   * new world doesn't begin with every obstacle at an edge.
   */
  launch(worldWidth: number, worldHeight: number, spread = false): void {
    const { OBSTACLE_MIN_LENGTH, OBSTACLE_MAX_LENGTH, OBSTACLE_THICKNESS, OBSTACLE_SPEED } = ARENA_RULES;
    const length = Math.round(OBSTACLE_MIN_LENGTH + Math.random() * (OBSTACLE_MAX_LENGTH - OBSTACLE_MIN_LENGTH));
    const speed = OBSTACLE_SPEED * (0.8 + Math.random() * 0.4);
    const direction = Math.floor(Math.random() * 4); // 0 right, 1 left, 2 down, 3 up
    const horizontal = direction < 2;
    this.width = horizontal ? length : OBSTACLE_THICKNESS;
    this.height = horizontal ? OBSTACLE_THICKNESS : length;
    this.vx = direction === 0 ? speed : direction === 1 ? -speed : 0;
    this.vy = direction === 2 ? speed : direction === 3 ? -speed : 0;
    if (horizontal) {
      this.y = Math.round(Math.random() * (worldHeight - this.height));
      this.x = spread ? Math.random() * (worldWidth - this.width) : direction === 0 ? -this.width : worldWidth;
    } else {
      this.x = Math.round(Math.random() * (worldWidth - this.width));
      this.y = spread ? Math.random() * (worldHeight - this.height) : direction === 2 ? -this.height : worldHeight;
    }
    this.variant = Math.floor(Math.random() * 3);
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
