import { Room, Client } from "colyseus";
import { GAME_CONSTANTS } from "../constants/serverConstants";
import logger from "../utils/logger";
import { GameState } from "../schema/GameState";
import { exhale, fireCaptive, escapePress, escapeSteer } from "../systems/inhale";
import { beginSurge } from "../systems/surges";
import { spawnWeapon, deployWeapon } from "../systems/weapons";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/**
 * Each player's message budget (a token bucket). Real clients send steering and aim only when they
 * change, so at most a couple of hundred messages a second on a 120 Hz screen; anything past this
 * budget is dropped, and a client that keeps flooding is disconnected.
 */
const MESSAGE_BUDGET = { PER_SECOND: 300, BURST: 400, KICK_AFTER_DROPPED: 1500, KICK_WINDOW_MS: 5000 } as const;

/** What a client may send when joining; anything else is ignored */
interface JoinOptions {
  name?: unknown;
  /** Older clients send the name under this key */
  playerName?: unknown;
}

/** Clean up a player-supplied name: printable characters only, at most 20. Returns null if unusable. */
export function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // eslint-disable-next-line no-control-regex -- stripping control characters is the point
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

  async onCreate(options: any = {}): Promise<void> {
    // The automated test can start a world with no loose gems, so its gem counts stay exact
    const fieldGems = !IS_PRODUCTION && Number.isInteger(options.testFieldGems) ? options.testFieldGems : undefined;
    this.setState(new GameState(fieldGems));
    // ...and a world where traffic can't hit anyone (the test hits players itself)
    if (!IS_PRODUCTION && options.testCalm === true) this.state.trafficHits = false;
    // ...and one where traffic never goes calm
    if (!IS_PRODUCTION && options.testTraffic === "always") this.state.forceTraffic("always");
    // ...and one with bombs (switched off in live worlds)
    if (!IS_PRODUCTION && options.testBombs === true) this.state.enableBombs();
    // Arena shifts are off in normal play (SHIFT.ENABLED); a test world can switch them on
    if (!IS_PRODUCTION && options.testShifts === true) this.state.enableShifts();
    // ...and one with no bots
    if (!IS_PRODUCTION && Number.isInteger(options.testBots)) this.state.botFill = options.testBots;
    // Test worlds have no turbines unless they ask: testTurbines true runs them as usual, "manual" places them by hand
    if (!IS_PRODUCTION && Object.keys(options).some((key) => key.startsWith("test"))) {
      await this.setPrivate(true);
      this.state.surgesOn = options.testSurges === true;
      this.state.weaponsOn = options.testWeapons === true;
      this.state.setTurbines(options.testTurbines === true ? "auto" : options.testTurbines === "manual" ? "manual" : "off");
    }
    // Moments worth telling everyone about (who shoved whom off the edge, who took the jackpot)
    this.state.onEvent = (type, data) => this.broadcast(type, data);

    // Runs on the room's clock, so it stops by itself when the room is disposed
    this.setSimulationInterval(
      (deltaMs) => this.state.update(deltaMs / 1000),
      GAME_CONSTANTS.GAME.STATE_UPDATE_RATE
    );

    // Where the browser is steering (a direction no longer than 1), whenever it changes
    this.onMessage("steer", (client, data: any) => {
      if (!this.allowMessage(client)) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.steer(Number(data?.x) || 0, Number(data?.y) || 0);
      if (data?.escape === true || (player.capturedBy && Math.hypot(Number(data?.x) || 0, Number(data?.y) || 0) <= 0.3)) escapeSteer(this.state, player);
    });
    // Keyboard edges are explicit, so a quick tap is never lost between simulation ticks.
    this.onMessage("escape", (client, data: { key?: unknown }) => {
      if (!this.allowMessage(client)) return;
      const player = this.state.players.get(client.sessionId);
      const key = data?.key;
      if (!player || typeof key !== "string" || key.length !== 1 || !"UDLR".includes(key)) return;
      const now = Date.now();
      if (now < player.escapeTryAt) return;
      player.escapeTryAt = now + 60;
      escapePress(this.state, player, key);
    });

    // Where an inhale is aimed: the creature turns to face it (its eyes give it away)
    this.onMessage("aim", (client, data: any) => {
      if (!this.allowMessage(client)) return;
      this.state.players.get(client.sessionId)?.aimAt(Number(data?.x) || 0, Number(data?.y) || 0);
    });
    // Hold the button to inhale, release to stop; tap with something in your mouth to spit it, or with
    // someone caught inside to fire them (a full mouth can't inhale until it's empty)
    this.onMessage("inhale", (client) => {
      if (!this.allowMessage(client)) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      if (player.gulping) fireCaptive(this.state, player, Date.now());
      else player.startInhale(Date.now());
    });
    // A quick tap (the button let go within the browser's tap window, so never an inhale): fires a
    // captive, spits a bomb, or, with an empty mouth, exhales a puff, all along the creature's facing
    this.onMessage("tap", (client) => {
      if (!this.allowMessage(client)) return;
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      const now = Date.now();
      if (player.gulping) fireCaptive(this.state, player, now);
      else if (player.mouth) this.state.spit(player, Math.cos(player.facing), Math.sin(player.facing), now);
      else exhale(this.state, player, now);
    });
    this.onMessage("exhale", (client) => {
      // Releasing inhale preserves collected weapon cargo too.
      if (!this.allowMessage(client)) return;
      // The button let go: the inhale stops. Someone caught during it stays inside (the mouth is full);
      // the next press fires them (see fireCaptive).
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      player.releasedAt = Date.now();
      player.stopInhale();
    });
    this.onMessage("placeWeapon", (client) => {
      if (!this.allowMessage(client)) return;
      const player = this.state.players.get(client.sessionId);
      if (player) deployWeapon(this.state, player);
    });
    this.onMessage("cancel", (client) => {
      if (!this.allowMessage(client)) return;
      // The press cut short (slid off the button, Esc, a cancelled touch): stop, but it isn't a release
      const player = this.state.players.get(client.sessionId);
      player?.stopInhale();
      player?.steer(0, 0);
      if (player) player.fireQueued = false;
    });
    this.onMessage("spit", (client, data: any) => {
      if (!this.allowMessage(client)) return;
      const player = this.state.players.get(client.sessionId);
      if (player) this.state.spit(player, Number(data?.x) || 0, Number(data?.y) || 0, Date.now());
    });

    // Browsers time their round trip to the server with this, to draw traffic in step with it
    this.onMessage("ping", (client, data: any) => {
      if (!this.allowMessage(client)) return;
      client.send("pong", { t: Number(data?.t) || 0 });
    });

    // Hooks for the automated test; never available in production
    if (!IS_PRODUCTION) {
      this.onMessage("test:pinwheel", (_client, data: { x?: number; y?: number; kind?: string }) => {
        this.state.weaponsOn = true;
        spawnWeapon(this.state, Number(data?.x) || 2100, Number(data?.y) || 2100, data?.kind === 'drum' ? 'drum' : 'pinwheel');
      });
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
      this.onMessage("test:face", (client, data: any) => {
        const player = playerOf(client);
        if (player) {
          player.facing = Number(data?.angle) || 0;
          player.spin = 0;
        }
      });
      this.onMessage("test:placeTurbine", (_client, data: any) => {
        this.state.placeTurbine(Number(data?.x) || 0, Number(data?.y) || 0, Number(data?.intake) || 0, data?.still === true);
      });
      this.onMessage("test:endTurbines", () => this.state.endTurbinesNow());
      this.onMessage("test:placeBomb", (_client, data: any) => {
        // The first bomb, at (x, y), lit with fuseMs left if given
        this.state.bombs.forEach((bomb, index) => {
          if (index !== 0) return;
          bomb.heldBy = "";
          bomb.respawnAt = 0;
          bomb.placeAt(Number(data?.x) || 0, Number(data?.y) || 0);
          bomb.explodesAt = Number(data?.fuseMs) > 0 ? this.state.time + Number(data.fuseMs) : 0;
        });
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
      this.onMessage("test:breath", (client, data: any) => {
        const player = playerOf(client);
        if (!player) return;
        player.stamina = Math.max(0, Math.min(1, Number(data?.stamina) || 0));
        player.staminaAt = Date.now();
      });
      this.onMessage("test:stun", (client, data: any) => {
        playerOf(client)?.stun(Date.now(), Number(data?.ms) || 500);
      });
      this.onMessage("test:surge", (_client, data: { active?: unknown }) => {
        this.state.surgesOn = true;
        beginSurge(this.state);
        if (data?.active === true) this.state.surgeAt = this.state.time;
      });
    }

    this.onMessage("updateName", (client, data: any) => {
      const player = this.state.players.get(client.sessionId);
      const name = sanitizeName(data?.name);
      if (player && name) player.name = name;
    });

    logger.info(`Room ${this.roomId} created (world ${this.state.worldWidth}×${this.state.worldHeight})`);
  }

  /** Each player's message budget (see MESSAGE_BUDGET) */
  private messageBudgets = new Map<string, { tokens: number; at: number; dropped: number; since: number; kicked: boolean }>();

  /** Spend one message from this player's budget; false (and the message is ignored) once it's empty */
  private allowMessage(client: Client): boolean {
    const now = Date.now();
    let budget = this.messageBudgets.get(client.sessionId);
    if (!budget) {
      budget = { tokens: MESSAGE_BUDGET.BURST, at: now, dropped: 0, since: now, kicked: false };
      this.messageBudgets.set(client.sessionId, budget);
    }
    // Already disconnected for flooding: ignore whatever else it had queued, quietly
    if (budget.kicked) return false;
    budget.tokens = Math.min(MESSAGE_BUDGET.BURST, budget.tokens + ((now - budget.at) / 1000) * MESSAGE_BUDGET.PER_SECOND);
    budget.at = now;
    if (budget.tokens >= 1) {
      budget.tokens -= 1;
      return true;
    }
    if (now - budget.since > MESSAGE_BUDGET.KICK_WINDOW_MS) {
      budget.since = now;
      budget.dropped = 0;
    }
    budget.dropped += 1;
    if (budget.dropped >= MESSAGE_BUDGET.KICK_AFTER_DROPPED) {
      budget.kicked = true;
      logger.warn(`Disconnecting ${client.sessionId} for flooding messages`);
      client.leave(4002);
    }
    return false;
  }

  onJoin(client: Client, options: JoinOptions = {}): void {
    const player = this.state.addPlayer(client.sessionId, sanitizeName(options.name ?? options.playerName));
    this.broadcast("playerJoined", { id: client.sessionId, name: player.name });
    logger.info(`${player.name} joined room ${this.roomId} (${this.state.players.size} players)`);
  }

  onLeave(client: Client): void {
    this.messageBudgets.delete(client.sessionId);
    const name = this.state.players.get(client.sessionId)?.name ?? client.sessionId;
    this.state.removePlayer(client.sessionId);
    this.broadcast("playerLeft", { id: client.sessionId });
    logger.info(`${name} left room ${this.roomId} (${this.state.players.size} players)`);
  }

  onDispose(): void {
    logger.info(`Room ${this.roomId} closed`);
  }
}
