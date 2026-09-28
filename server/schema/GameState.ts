import * as schema from "@colyseus/schema";
const { Schema, MapSchema, ArraySchema, type } = schema;
import { PlayerSchema } from "./PlayerSchema.js";
import { ObstacleSchema } from "./ObstacleSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { WORLD, ARENA_RULES, PLAYER_STATE } = GAME_CONSTANTS;

/** How many random spots to try when looking for a safe place to (re)spawn */
const SPAWN_TRIES = 24;

/** Distance from a point to a rectangle (0 when the point is inside it) */
function distanceToRect(px: number, py: number, x: number, y: number, width: number, height: number): number {
  const dx = Math.max(x - px, 0, px - (x + width));
  const dy = Math.max(y - py, 0, py - (y + height));
  return Math.hypot(dx, dy);
}

/**
 * The online world: one big open arena that never stops. Players drop in the moment they
 * join, dodge traffic crossing the map in every direction, and come back two seconds after a
 * hit, somewhere safe and protected for a moment. There are no rounds and nobody waits.
 */
class GameState extends Schema {
  players: schema.MapSchema<PlayerSchema>;
  obstacles: schema.ArraySchema<ObstacleSchema>;
  worldWidth: number;
  worldHeight: number;

  /** Server-only: gives each new player the next color */
  private nextPlayerIndex = 0;

  constructor() {
    super();
    this.players = new MapSchema<PlayerSchema>();
    this.obstacles = new ArraySchema<ObstacleSchema>();
    this.worldWidth = WORLD.WIDTH;
    this.worldHeight = WORLD.HEIGHT;
    for (let i = 0; i < WORLD.OBSTACLE_COUNT; i++) {
      const obstacle = new ObstacleSchema();
      obstacle.launch(this.worldWidth, this.worldHeight, true);
      this.obstacles.push(obstacle);
    }
  }

  /** A new visitor: straight into the world, somewhere safe */
  addPlayer(sessionId: string, name: string | null, now: number = Date.now()): PlayerSchema {
    const player = new PlayerSchema(sessionId, this.nextPlayerIndex++);
    if (name) player.name = name;
    this.players.set(sessionId, player);
    this.spawn(player, now);
    return player;
  }

  removePlayer(sessionId: string): void {
    this.players.delete(sessionId);
  }

  /** One server tick: move traffic and players, check hits, bring knocked-out players back */
  update(deltaTime: number, now: number = Date.now()): void {
    this.obstacles.forEach((obstacle) => {
      if (!obstacle.update(deltaTime, this.worldWidth, this.worldHeight)) {
        obstacle.launch(this.worldWidth, this.worldHeight);
      }
    });

    this.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE) {
        if (now >= player.respawnAt) this.spawn(player, now);
        return;
      }
      player.updateMovement(this.worldWidth, this.worldHeight, now);
      if (player.spawnProtected) return;
      let hit = false;
      this.obstacles.forEach((obstacle) => {
        if (!hit && obstacle.checkCollision(player)) hit = true;
      });
      if (hit) player.knockOut(now);
    });
  }

  /**
   * Put a player somewhere safe: the best of several random spots, judged by distance from
   * traffic (where it is and where it's headed) and from other players. Once gems exist, the
   * leader counts as a danger too.
   */
  private spawn(player: PlayerSchema, now: number): void {
    const margin = ARENA_RULES.EDGE_MARGIN + 40;
    const size = player.width;
    let best = { x: (this.worldWidth - size) / 2, y: (this.worldHeight - size) / 2 };
    let bestClearance = -Infinity;
    for (let attempt = 0; attempt < SPAWN_TRIES; attempt++) {
      const x = margin + Math.random() * (this.worldWidth - size - 2 * margin);
      const y = margin + Math.random() * (this.worldHeight - size - 2 * margin);
      const clearance = this.clearanceAt(x + size / 2, y + size / 2, player);
      if (clearance > bestClearance) {
        best = { x, y };
        bestClearance = clearance;
      }
      if (clearance >= WORLD.SPAWN_CLEARANCE) break;
    }
    player.spawnAt(Math.round(best.x), Math.round(best.y), now);
  }

  /** How far a point is from the nearest danger: traffic over the next second, or another player */
  private clearanceAt(cx: number, cy: number, self: PlayerSchema): number {
    let nearest = Infinity;
    this.obstacles.forEach((o) => {
      for (const t of [0, 0.5, 1]) {
        nearest = Math.min(nearest, distanceToRect(cx, cy, o.x + o.vx * t, o.y + o.vy * t, o.width, o.height));
      }
    });
    this.players.forEach((other) => {
      if (other === self || other.state !== PLAYER_STATE.ALIVE) return;
      // Other players matter less than traffic: spawning 300 units away counts as 150
      nearest = Math.min(nearest, Math.hypot(other.x + other.width / 2 - cx, other.y + other.height / 2 - cy) / 2);
    });
    return nearest;
  }
}

// Fields sent to clients
type({ map: PlayerSchema })(GameState.prototype, "players");
type([ObstacleSchema])(GameState.prototype, "obstacles");
type("number")(GameState.prototype, "worldWidth");
type("number")(GameState.prototype, "worldHeight");

export { GameState };
