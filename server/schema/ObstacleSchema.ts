import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { OBSTACLE, ARENA_RULES } = GAME_CONSTANTS;

interface PlayerPosition {
  x: number;
  y: number;
}

/** Keep new obstacles at least this far from any living player */
const SAFE_ZONE = 100;
/** Hitboxes are 80% of the drawn size, which feels fairer */
const HITBOX_SHRINK = 0.2;

/**
 * An obstacle that crosses the arena from left to right, then re-enters at a new height.
 */
class ObstacleSchema extends Schema {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  speed: number;
  variant: number;
  active: boolean;

  constructor(id: number) {
    super();
    this.id = id;
    this.x = 0;
    this.y = 0;
    this.width = OBSTACLE.MIN_WIDTH;
    this.height = ARENA_RULES.OBSTACLE_HEIGHT;
    this.speed = OBSTACLE.BASE_SPEED;
    this.variant = Math.floor(Math.random() * 3);
    this.active = true;
  }

  /** Send the obstacle back to the left edge at a random height, not on top of a player */
  reset(arenaWidth: number, arenaHeight: number, playerPositions: PlayerPosition[] = []): boolean {
    const { OBSTACLE_MIN_WIDTH_RATIO: min, OBSTACLE_MAX_WIDTH_RATIO: max } = ARENA_RULES;
    this.width = Math.round(arenaWidth * (min + Math.random() * (max - min)));
    this.x = -this.width;

    let validPosition = false;
    for (let attempt = 0; attempt < 10 && !validPosition; attempt++) {
      // Between the top line and the starting row, which stays clear like solo's spawn zone
      const lowest = arenaHeight - ARENA_RULES.PLAYER_SIZE - ARENA_RULES.BOTTOM_MARGIN - this.height - 10;
      this.y = ARENA_RULES.TOP_LINE + Math.random() * (lowest - ARENA_RULES.TOP_LINE);
      // Not on top of anyone: the obstacle's entry point must miss every player's safe zone
      validPosition = playerPositions.every((player) => {
        const overlaps =
          this.x < player.x + SAFE_ZONE / 2 && this.x + this.width > player.x - SAFE_ZONE / 2 &&
          this.y < player.y + SAFE_ZONE / 2 && this.y + this.height > player.y - SAFE_ZONE / 2;
        return !overlaps;
      });
    }

    this.variant = Math.floor(Math.random() * 3);
    this.active = true;
    return validPosition;
  }

  /**
   * Move right. BASE_SPEED was tuned per frame at 60 frames a second, so it becomes pixels per
   * second here; obstacles speed up as the round goes on (up to 1.6x, reached after about two minutes).
   * @returns true when the obstacle has left the arena and needs a reset
   */
  update(deltaTime: number, arenaWidth: number, elapsedSeconds: number = 0): boolean {
    if (this.x >= arenaWidth) return true;
    const speed = ARENA_RULES.OBSTACLE_SPEED * Math.min(1.6, 1 + elapsedSeconds / 180);
    this.x += speed * deltaTime;
    const rounded = Math.round(speed);
    if (this.speed !== rounded) this.speed = rounded;
    return false;
  }

  checkCollision(player: { x: number; y: number; width: number; height: number }): boolean {
    const pLeft = player.x + player.width * HITBOX_SHRINK;
    const pRight = player.x + player.width * (1 - HITBOX_SHRINK);
    const pTop = player.y + player.height * HITBOX_SHRINK;
    const pBottom = player.y + player.height * (1 - HITBOX_SHRINK);
    const oLeft = this.x + this.width * HITBOX_SHRINK;
    const oRight = this.x + this.width * (1 - HITBOX_SHRINK);
    const oTop = this.y + this.height * HITBOX_SHRINK;
    const oBottom = this.y + this.height * (1 - HITBOX_SHRINK);
    return pLeft < oRight && pRight > oLeft && pTop < oBottom && pBottom > oTop;
  }
}

// Fields sent to clients
type("number")(ObstacleSchema.prototype, "id");
type("number")(ObstacleSchema.prototype, "x");
type("number")(ObstacleSchema.prototype, "y");
type("number")(ObstacleSchema.prototype, "width");
type("number")(ObstacleSchema.prototype, "height");
type("number")(ObstacleSchema.prototype, "speed");
type("number")(ObstacleSchema.prototype, "variant");
type("boolean")(ObstacleSchema.prototype, "active");

export { ObstacleSchema };
