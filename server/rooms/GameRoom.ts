import { Room, Client } from "colyseus";
import { GAME_CONSTANTS } from "../constants/serverConstants";
import logger from "../utils/logger";
import { GameState } from "../schema/GameState";
import { DIRECTIONS } from "../game/movement";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** What a client may send when joining; anything else is ignored */
interface JoinOptions {
  name?: unknown;
  /** Older clients send the name under this key */
  playerName?: unknown;
}

/** Clean up a player-supplied name: printable characters only, at most 20. Returns null if unusable. */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 20);
  return name || null;
}

/**
 * The shared online world. The server runs everything; browsers ask for hops. Players drop in
 * when they join and come back two seconds after a hit (see GameState). The room closes when
 * the last player leaves.
 */
export class GameRoom extends Room<GameState> {
  maxClients = GAME_CONSTANTS.GAME.MAX_PLAYERS;

  onCreate(options: any = {}): void {
    // The automated test can start a world with no loose gems, so its gem counts stay exact
    const fieldGems = !IS_PRODUCTION && Number.isInteger(options.testFieldGems) ? options.testFieldGems : undefined;
    this.setState(new GameState(fieldGems));

    // Runs on the room's clock, so it stops by itself when the room is disposed
    this.setSimulationInterval(
      (deltaMs) => this.state.update(deltaMs / 1000),
      GAME_CONSTANTS.GAME.STATE_UPDATE_RATE
    );

    this.onMessage("hop", (client, data: any) => {
      const direction = data?.direction;
      if (!DIRECTIONS.includes(direction)) return;
      this.state.players.get(client.sessionId)?.requestHop(direction);
    });

    // Hooks for the automated test; never available in production
    if (!IS_PRODUCTION) {
      const playerOf = (client: Client) => this.state.players.get(client.sessionId);
      const { worldWidth, worldHeight } = this.state;
      this.onMessage("test:hit", (client) => {
        const player = playerOf(client);
        if (player) this.state.hitPlayer(player);
      });
      this.onMessage("test:setGems", (client, data: any) => {
        playerOf(client)?.setGems(Number(data?.count) || 0, worldWidth, worldHeight);
      });
      this.onMessage("test:placeGem", (client, data: any) => {
        const player = playerOf(client);
        if (!player) return;
        const x = player.x + player.width / 2 + (Number(data?.dx) || 0);
        const y = player.y + player.height / 2 + (Number(data?.dy) || 0);
        this.state.addGem(x, y);
      });
      this.onMessage("test:protect", (client, data: any) => {
        playerOf(client)?.protectFor(Number(data?.ms) || 0, Date.now());
      });
    }

    this.onMessage("updateName", (client, data: any) => {
      const player = this.state.players.get(client.sessionId);
      const name = sanitizeName(data?.name);
      if (player && name) player.name = name;
    });

    logger.info(`Room ${this.roomId} created (world ${this.state.worldWidth}×${this.state.worldHeight})`);
  }

  onJoin(client: Client, options: JoinOptions = {}): void {
    const player = this.state.addPlayer(client.sessionId, sanitizeName(options.name ?? options.playerName));
    this.broadcast("playerJoined", { id: client.sessionId, name: player.name });
    logger.info(`${player.name} joined room ${this.roomId} (${this.state.players.size} players)`);
  }

  onLeave(client: Client): void {
    const name = this.state.players.get(client.sessionId)?.name ?? client.sessionId;
    this.state.removePlayer(client.sessionId);
    this.broadcast("playerLeft", { id: client.sessionId });
    logger.info(`${name} left room ${this.roomId} (${this.state.players.size} players)`);
  }

  onDispose(): void {
    logger.info(`Room ${this.roomId} closed`);
  }
}
