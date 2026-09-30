import { Room, Client } from "colyseus";
import { GAME_CONSTANTS } from "../constants/serverConstants";
import logger from "../utils/logger";
import { GameState } from "../schema/GameState";

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
    // ...and a world where traffic can't hit anyone (the test hits players itself)
    if (!IS_PRODUCTION && options.testCalm === true) this.state.trafficHits = false;
    // ...and one where traffic never goes calm
    if (!IS_PRODUCTION && options.testTraffic === "always") this.state.forceTraffic("always");
    // ...and one with no bots
    if (!IS_PRODUCTION && Number.isInteger(options.testBots)) this.state.botFill = options.testBots;
    // Moments worth telling everyone about (who shoved whom off the edge, who took the jackpot)
    this.state.onEvent = (type, data) => this.broadcast(type, data);

    // Runs on the room's clock, so it stops by itself when the room is disposed
    this.setSimulationInterval(
      (deltaMs) => this.state.update(deltaMs / 1000),
      GAME_CONSTANTS.GAME.STATE_UPDATE_RATE
    );

    // Where the browser is steering (a direction no longer than 1), whenever it changes
    this.onMessage("steer", (client, data: any) => {
      this.state.players.get(client.sessionId)?.steer(Number(data?.x) || 0, Number(data?.y) || 0);
    });

    // Holding DASH past a tap charges a slingshot; letting go launches it (or sliding off cancels)
    this.onMessage("charge", (client) => {
      this.state.players.get(client.sessionId)?.startCharge(Date.now());
    });
    this.onMessage("sling", (client, data: any) => {
      this.state.players.get(client.sessionId)?.requestSling(Number(data?.x) || 0, Number(data?.y) || 0);
    });
    this.onMessage("cancel", (client) => {
      this.state.players.get(client.sessionId)?.cancelCharge();
    });

    this.onMessage("dash", (client, data: any) => {
      this.state.players.get(client.sessionId)?.requestDash(Number(data?.x) || 0, Number(data?.y) || 0);
    });

    // Browsers time their round trip to the server with this, to draw traffic in step with it
    this.onMessage("ping", (client, data: any) => {
      client.send("pong", { t: Number(data?.t) || 0 });
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
      this.onMessage("test:moveTo", (client, data: any) => {
        playerOf(client)?.placeAt(Number(data?.x) || 0, Number(data?.y) || 0);
      });
      this.onMessage("test:trafficHits", (_client, data: any) => {
        this.state.trafficHits = data?.on === true;
      });
      this.onMessage("test:parkTraffic", () => {
        // Every obstacle but the first stands still in the far corner
        const { worldWidth, worldHeight } = this.state;
        this.state.obstacles.forEach((obstacle, index) => {
          if (index > 0) obstacle.placeAt(worldWidth - 60, worldHeight - 60, 50, 34, 0);
        });
        this.state.balls.forEach((ball) => ball.placeAt(worldWidth - 60, worldHeight - 60));
        this.state.comets.forEach((comet) => comet.placeAt(-500, -500));
      });
      this.onMessage("test:placeObstacle", (client, data: any) => {
        // Stands the first obstacle still, relative to the player's center
        const player = playerOf(client);
        const obstacle = this.state.obstacles.at(0);
        if (!player || !obstacle) return;
        const x = player.x + player.width / 2 + (Number(data?.dx) || 0);
        const y = player.y + player.height / 2 + (Number(data?.dy) || 0);
        obstacle.placeAt(x, y, Number(data?.width) || 30, Number(data?.height) || 30, Number(data?.variant) || 0);
      });
      this.onMessage("test:shift", (_client, data: any) => {
        this.state.forcePhase(String(data?.phase || "grace"), Number(data?.msLeft) || 5000, Date.now());
      });
      this.onMessage("test:jackpot", (client) => {
        const player = playerOf(client);
        if (player) this.state.dropJackpot(player.x + player.width / 2, player.y + player.height / 2, 0);
      });
      this.onMessage("test:traffic", (_client, data: any) => {
        // Forces the traffic cycle: "calm", "warning", "wave" or "always"
        this.state.forceTraffic(String(data?.phase ?? ""));
      });
      this.onMessage("test:placeComet", (client, data: any) => {
        // Stands the first comet still, centered relative to the player's center
        const player = playerOf(client);
        const comet = this.state.comets.at(0);
        if (!player || !comet) return;
        comet.placeAt(player.x + player.width / 2 + (Number(data?.dx) || 0), player.y + player.height / 2 + (Number(data?.dy) || 0));
      });
      this.onMessage("test:placeBall", (client, data: any) => {
        // Stands the first ball still, centered relative to the player's center
        const player = playerOf(client);
        const ball = this.state.balls.at(0);
        if (!player || !ball) return;
        ball.placeAt(player.x + player.width / 2 + (Number(data?.dx) || 0), player.y + player.height / 2 + (Number(data?.dy) || 0));
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
