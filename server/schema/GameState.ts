import * as schema from "@colyseus/schema";
const { Schema, MapSchema, ArraySchema, type } = schema;
import { PlayerSchema } from "./PlayerSchema.js";
import { ObstacleSchema } from "./ObstacleSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { STATE, PLAYER_STATE, ARENA, CANVAS, GAME } = GAME_CONSTANTS;

/** Players needed before a round can start */
export const MIN_PLAYERS = 2;
/** Seconds of countdown before each round */
export const COUNTDOWN_SECONDS = 5;
/** Seconds the results stay on screen before the next round */
export const RESULTS_SECONDS = 5;
/** Obstacles at the start of a round (plus one per 5 players, and one more each time the arena shrinks) */
const STARTING_OBSTACLES = 5;

interface Area {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The whole game as the server sees it. Rounds cycle on their own:
 * waiting (fewer than 2 players) → starting (countdown) → playing → game_over (results)
 * → starting again, or waiting if people left.
 */
class GameState extends Schema {
  gameState: string;
  /** Seconds into the current round */
  elapsedTime: number;
  /** Whole seconds left on the countdown (starting) or the results screen (game_over) */
  countdownTime: number;
  arenaWidth: number;
  arenaHeight: number;
  /** How much of the arena is still safe: 100, shrinking to ARENA.MIN_AREA_PERCENTAGE */
  areaPercentage: number;
  players: schema.MapSchema<PlayerSchema>;
  obstacles: schema.ArraySchema<ObstacleSchema>;
  aliveCount: number;
  totalPlayers: number;
  winnerName: string;

  // Server-only bookkeeping, not sent to clients
  private phaseEndsAt = 0;
  private nextShrinkAt = 0;
  private nextPlayerIndex = 0;

  constructor() {
    super();
    this.gameState = STATE.WAITING;
    this.elapsedTime = 0;
    this.countdownTime = 0;
    this.arenaWidth = CANVAS.BASE_WIDTH;
    this.arenaHeight = CANVAS.BASE_HEIGHT;
    this.areaPercentage = ARENA.INITIAL_AREA_PERCENTAGE;
    this.players = new MapSchema<PlayerSchema>();
    this.obstacles = new ArraySchema<ObstacleSchema>();
    this.aliveCount = 0;
    this.totalPlayers = 0;
    this.winnerName = "";
  }

  /** Add a player. Anyone joining mid-round watches until the next round starts. */
  addPlayer(sessionId: string, name: string | null): PlayerSchema {
    const player = new PlayerSchema(sessionId, this.nextPlayerIndex++);
    if (name) player.name = name;
    const roundInProgress = this.gameState === STATE.PLAYING || this.gameState === STATE.GAME_OVER;
    if (roundInProgress) player.state = PLAYER_STATE.SPECTATING;
    this.players.set(sessionId, player);
    if (!roundInProgress) this.placePlayers();
    this.refreshCounts();
    return player;
  }

  removePlayer(sessionId: string): void {
    this.players.delete(sessionId);
    if (this.gameState === STATE.STARTING && this.players.size < MIN_PLAYERS) {
      this.gameState = STATE.WAITING;
      this.countdownTime = 0;
    }
    if (this.gameState === STATE.WAITING || this.gameState === STATE.STARTING) this.placePlayers();
    this.refreshCounts();
  }

  /** Advance the game by deltaTime seconds. The room calls this on a fixed interval. */
  update(deltaTime: number, now: number = Date.now()): void {
    switch (this.gameState) {
      case STATE.WAITING:
        if (this.players.size >= MIN_PLAYERS) this.startCountdown(now);
        break;
      case STATE.STARTING:
        this.countdownTime = this.secondsLeft(now);
        if (now >= this.phaseEndsAt) this.startRound(now);
        break;
      case STATE.PLAYING:
        this.playTick(deltaTime, now);
        break;
      case STATE.GAME_OVER:
        this.countdownTime = this.secondsLeft(now);
        if (now >= this.phaseEndsAt) this.afterResults(now);
        break;
    }
  }

  /** The part of the arena that is still safe, centered in it */
  safeArea(): Area {
    const scale = this.areaPercentage / 100;
    const width = this.arenaWidth * scale;
    const height = this.arenaHeight * scale;
    const left = (this.arenaWidth - width) / 2;
    const top = (this.arenaHeight - height) / 2;
    return { left, top, right: left + width, bottom: top + height };
  }

  /** Everyone present gets ready; the round starts when the countdown ends */
  private startCountdown(now: number): void {
    this.gameState = STATE.STARTING;
    this.phaseEndsAt = now + COUNTDOWN_SECONDS * 1000;
    this.countdownTime = COUNTDOWN_SECONDS;
    this.winnerName = "";
    this.resetArena();
    this.players.forEach((player) => {
      player.state = PLAYER_STATE.ALIVE;
    });
    this.placePlayers();
    this.refreshCounts();
  }

  private startRound(now: number): void {
    this.gameState = STATE.PLAYING;
    this.countdownTime = 0;
    this.elapsedTime = 0;
    this.nextShrinkAt = now + ARENA.SHRINK_INTERVAL;
    this.placePlayers();
    const count = Math.min(GAME.MAX_OBSTACLES, STARTING_OBSTACLES + Math.floor(this.players.size / 5));
    for (let i = 0; i < count; i++) this.spawnObstacle();
  }

  private playTick(deltaTime: number, now: number): void {
    this.elapsedTime += deltaTime;

    if (now >= this.nextShrinkAt && this.areaPercentage > ARENA.MIN_AREA_PERCENTAGE) {
      this.areaPercentage = Math.max(ARENA.MIN_AREA_PERCENTAGE, this.areaPercentage - ARENA.SHRINK_PERCENTAGE);
      this.nextShrinkAt = now + ARENA.SHRINK_INTERVAL;
      if (this.obstacles.length < GAME.MAX_OBSTACLES) this.spawnObstacle();
    }

    const safe = this.safeArea();
    this.players.forEach((player) => {
      if (player.state !== PLAYER_STATE.ALIVE) return;
      player.updateMovement(deltaTime, this.arenaWidth, this.arenaHeight);
      if (!isInside(player, safe)) player.markAsDead();
    });

    this.obstacles.forEach((obstacle) => {
      if (obstacle.update(deltaTime, this.arenaWidth, this.elapsedTime)) {
        obstacle.reset(this.arenaWidth, this.arenaHeight, this.alivePositions());
      }
      this.players.forEach((player) => {
        if (player.state === PLAYER_STATE.ALIVE && obstacle.checkCollision(player)) player.markAsDead();
      });
    });

    this.refreshCounts();
    if (this.aliveCount <= 1) this.endRound(now);
  }

  /** Last one standing wins; if everyone went out on the same tick, nobody does */
  private endRound(now: number): void {
    let winner = "";
    this.players.forEach((player) => {
      if (player.state === PLAYER_STATE.ALIVE) winner = player.name;
    });
    this.winnerName = winner || "No one";
    this.gameState = STATE.GAME_OVER;
    this.phaseEndsAt = now + RESULTS_SECONDS * 1000;
    this.countdownTime = RESULTS_SECONDS;
  }

  /** After the results: straight into the next countdown, or back to waiting if people left */
  private afterResults(now: number): void {
    if (this.players.size >= MIN_PLAYERS) {
      this.startCountdown(now);
      return;
    }
    this.gameState = STATE.WAITING;
    this.countdownTime = 0;
    this.winnerName = "";
    this.resetArena();
    this.players.forEach((player) => {
      player.state = PLAYER_STATE.ALIVE;
    });
    this.placePlayers();
    this.refreshCounts();
  }

  private secondsLeft(now: number): number {
    return Math.max(0, Math.ceil((this.phaseEndsAt - now) / 1000));
  }

  private resetArena(): void {
    this.areaPercentage = ARENA.INITIAL_AREA_PERCENTAGE;
    this.elapsedTime = 0;
    if (this.obstacles.length > 0) this.obstacles = new ArraySchema<ObstacleSchema>();
  }

  private spawnObstacle(): void {
    const obstacle = new ObstacleSchema(this.obstacles.length);
    obstacle.reset(this.arenaWidth, this.arenaHeight, this.alivePositions());
    // Stagger entry so the obstacles don't all arrive in one wave
    obstacle.x = -obstacle.width - Math.random() * this.arenaWidth;
    this.obstacles.push(obstacle);
  }

  private alivePositions(): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    this.players.forEach((player) => {
      if (player.state === PLAYER_STATE.ALIVE) positions.push({ x: player.x, y: player.y });
    });
    return positions;
  }

  private placePlayers(): void {
    let slot = 0;
    const count = this.players.size;
    this.players.forEach((player) => player.placeAt(slot++, count, this.arenaWidth, this.arenaHeight));
  }

  private refreshCounts(): void {
    let alive = 0;
    this.players.forEach((player) => {
      if (player.state === PLAYER_STATE.ALIVE) alive++;
    });
    if (this.aliveCount !== alive) this.aliveCount = alive;
    if (this.totalPlayers !== this.players.size) this.totalPlayers = this.players.size;
  }
}

function isInside(box: { x: number; y: number; width: number; height: number }, area: Area): boolean {
  return box.x >= area.left && box.y >= area.top && box.x + box.width <= area.right && box.y + box.height <= area.bottom;
}

// Fields sent to clients
type("string")(GameState.prototype, "gameState");
type("number")(GameState.prototype, "elapsedTime");
type("number")(GameState.prototype, "countdownTime");
type("number")(GameState.prototype, "arenaWidth");
type("number")(GameState.prototype, "arenaHeight");
type("number")(GameState.prototype, "areaPercentage");
type({ map: PlayerSchema })(GameState.prototype, "players");
type([ObstacleSchema])(GameState.prototype, "obstacles");
type("number")(GameState.prototype, "aliveCount");
type("number")(GameState.prototype, "totalPlayers");
type("string")(GameState.prototype, "winnerName");

export { GameState };
