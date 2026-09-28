import { Room, Client } from "colyseus";
import { GAME_CONSTANTS } from "../constants/serverConstants";
import logger from "../utils/logger";
import { GameState } from "../schema/GameState";

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
 * Last Player Standing. The server runs the whole game; clients only send which movement
 * keys are held. Rounds start, end and restart on their own (see GameState), and the room
 * closes when the last player leaves.
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

    this.onMessage("input", (client, data: any) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.setKeys({
        up: data?.up === true,
        down: data?.down === true,
        left: data?.left === true,
        right: data?.right === true,
      });
    });

    this.onMessage("updateName", (client, data: any) => {
      const player = this.state.players.get(client.sessionId);
      const name = sanitizeName(data?.name);
      if (player && name) player.name = name;
    });

    logger.info(`Room ${this.roomId} created (arena ${this.state.arenaWidth}×${this.state.arenaHeight})`);
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
