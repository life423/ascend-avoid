import { Room, Client } from "colyseus";
import { GAME_CONSTANTS } from "../constants/serverConstants";
import logger from "../utils/logger";
import { GameState } from "../schema/GameState";
import { DIRECTIONS } from "../game/movement";

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

  onCreate(): void {
    this.setState(new GameState());

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

    // Lets the automated test knock a player out on demand; never available in production
    if (process.env.NODE_ENV !== "production") {
      this.onMessage("test:knockout", (client) => {
        this.state.players.get(client.sessionId)?.knockOut(Date.now());
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
