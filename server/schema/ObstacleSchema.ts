import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { ARENA_RULES } = GAME_CONSTANTS;

/** Hits use slightly smaller boxes than the drawings, so near misses feel fair */
const HITBOX_SHRINK = 0.2;

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

  /** Server-only: velocity, in units per second */
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

  /** Whether this obstacle hits a player */
  checkCollision(player: { x: number; y: number; width: number; height: number }): boolean {
    const px = player.width * HITBOX_SHRINK;
    const py = player.height * HITBOX_SHRINK;
    const ox = this.width * HITBOX_SHRINK;
    const oy = this.height * HITBOX_SHRINK;
    return (
      player.x + px < this.x + this.width - ox &&
      player.x + player.width - px > this.x + ox &&
      player.y + py < this.y + this.height - oy &&
      player.y + player.height - py > this.y + oy
    );
  }
}

// Fields sent to clients
type("number")(ObstacleSchema.prototype, "x");
type("number")(ObstacleSchema.prototype, "y");
type("number")(ObstacleSchema.prototype, "width");
type("number")(ObstacleSchema.prototype, "height");
type("number")(ObstacleSchema.prototype, "variant");

export { ObstacleSchema };
