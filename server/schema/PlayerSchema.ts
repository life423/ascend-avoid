import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { turnStep, walk } from "../game/movement.js";
import { breathRate } from "../game/airflow.js";
import { CANNON } from "../constants/gameConstants.js";
import type { Box, Direction } from "../game/movement.js";

const { ARENA_RULES, BOTS, GEMS, INHALE, PLAYER_STATE, PUSH, WORLD, CORE } = GAME_CONSTANTS;


/** A creature's size: small to start, growing with the square root of its gems, with no ceiling */
function sizeFor(gems: number): number {
  const size = ARENA_RULES.PLAYER_SIZE * Math.sqrt(1 + gems / GEMS.BASE_MASS);
  return Math.round(size * 2) / 2;
}

/**
 * One player in the world. Browsers ask for hops; the server applies them (see
 * game/movement.ts), counts gems and decides hits.
 */
class PlayerSchema extends Schema {
  sessionId: string;
  playerIndex: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  /** "alive", or "dead" while knocked out and waiting to come back */
  state: string;
  /** Score and weight: more gems make a bigger player with longer hops */
  gems: number;
  /** Just (re)spawned: drawn translucent in a bubble, and traffic passes through for a moment */
  spawnProtected: boolean;
  /** Just hit and lost gems: blinking, and traffic passes through for a moment */
  recovering: boolean;
  /** Shoved: sliding to a stop, and can't hop until then */
  sliding: boolean;
  /** A bot, not a person (drawn with a robot by its name) */
  isBot: boolean;

  /** Server-only: when a knocked-out player comes back */
  respawnAt = 0;
  private protectedUntil = 0;
  private recoverUntil = 0;
  private decayProgress = 0;
  private vx = 0;
  private vy = 0;
  private lastShoveBy = "";
  private lastShoveAt = 0;
  private bountyAt = 0;
  /** Where the browser is steering (no longer than 1), and the walking velocity it produces */
  private steerX = 0;
  private steerY = 0;
  private walkX = 0;
  private walkY = 0;
  /** Server-only: how fast the creature is turning (radians a second; see turnStep) */
  spin = 0;
  /** Server-only: where the player's middle was and how big it was when this tick began (see GameState.keepApart) */
  tickX = 0;
  tickY = 0;
  tickRadius = 0;
  /** How the last shove came (for credits): "bump", or "bomb" */
  lastShoveKind = "";
  /** Which way the creature faces (radians): its back is where it's vulnerable */
  facing: number;
  /** Inhaling (holding the button): rooted, pulling in what's in front. See GameState.updateInhales */
  inhaling: boolean;
  /** What's in your mouth to spit: "bomb" (or "lit" once its fuse is running), or "" */
  mouth: string;
  /** Whose gems are streaming into your mouth right now ("" when nobody's) */
  stealingFrom: string;
  /** Who this creature is holding at its mouth to swallow, and when (world time) they go down unless they get away; "" when nobody */
  gulping: string;
  gulpEndsAt: number;
  /** Every gem it has ever stolen (browsers draw each one flying over, even when gems go both ways at once) */
  stolenTotal: number;
  /** Everyone this creature is robbing right now, comma-separated (the one squarest in its inhale first, which is also stealingFrom) */
  robbing: string;
  /** Every gem ever stolen from this creature (browsers draw each one flying out of it to whoever took it) */
  robbedTotal: number;
  /** Server-only: how far along the next gem from each victim is (see GameState.steal) */
  stealShares = new Map<string, number>();
  /** Server-only: how long each creature has been held in this one's inhale (0-1 of INHALE.LOCK_MS); fades fast once it's out */
  lockOn = new Map<string, number>();
  /** Stunned by a gust or impact: can't steer or inhale until it wears off (synced, for drawing) */
  stunned: boolean;
  /** Server-only: when the stun wears off, and when another can land */
  stunEndsAt = 0;
  stunImmuneUntil = 0;
  /** A defensive puff briefly clears incoming suction, without granting damage immunity. */
  suctionSafeUntil = 0;
  inhaleBlockedUntil = 0;
  puffReadyAt = 0;
  /** World time when the visible post-flight suction shield ends. */
  launchSafeUntil = 0;
  fireReadyAt = 0;
  fireQueued = false;
  /** The creature this one's airflow is latched on ("" for none), how focused the stream is (0-1, for drawing), the beam's quality when it saves breath (0 unless held cleanly), and how strongly it draws your aim (all synced) */
  latchTarget: string;
  beamFocus: number;
  beamQuality: number;
  latchPull: number;
  /** The airflow quality on the latched creature (synced, owned or not, so its stream is drawn as it really is) */
  latchQuality: number;
  /** Flying: launched out of a captor's mouth or a turbine's exhaust (synced) */
  flying: boolean;
  /** Caught in this creature's mouth: its session id (synced) */
  capturedBy: string;
  /** How close a captive is to breaking free, 0 to 1 (synced) */
  struggle: number;
  /** Caught by a captor big enough to swallow it, and how far that swallow has got, 0 to 1 (synced, for the arc both players see) */
  swallowable: boolean;
  swallowing: number;
  /** Gulped: whose insides it's riding in until it pops back out (synced; "" when it's out in the world) */
  insideOf: string;
  /** Caught: the directions to push, in order, to get out (U, D, L, R), how many it has got so far, when its daze ends and when it last got one wrong (world time; all synced, for the prompt) */
  escapeKeys: string;
  escapeStep: number;
  dazedUntil: number;
  escapeMissAt: number;
  /** Server-only: whether the stick has come back to neutral since the last push that counted; and (bots) when it next tries a direction */
  escapeNeutral = true;
  escapeTryAt = 0;
  /** Server-only: smoothed airflow quality on each creature, when the latch began and when it last slipped, its score, whether it owns the focused connection, and the aim it adds */
  airQuality = new Map<string, number>();
  latchSince = 0;
  latchLostAt = 0;
  latchScore = 0;
  focused = false;
  focusNext = false;
  assistX = 0;
  assistY = 0;
  /** Server-only: how long (seconds) each creature has been held in this one's airflow without a break (see INHALE.DRAIN_RAMP) */
  heldFor = new Map<string, number>();
  /** Server-only (bots): when its inhale last had nobody in it, so it can let go and save its breath */
  inhaleIdleSince = 0;
  /** Server-only: gems part-stolen, and how many this run of stealing has taken */
  stealProgress = 0;
  stolenRun = 0;
  /** Server-only: how far along the next gem a turbine is ripping out of this player is (0-1) */
  turbineStrip = 0;
  /** In flight: its velocity, when it started and must end, and who launched it (it can't hit them straight away) */
  flightVx = 0;
  flightVy = 0;
  flightDrag: number = CANNON.DRAG;
  flightStartedAt = 0;
  flightEndsAt = 0;
  launchedBy = "";
  /** When this creature caught its current captive, and when it can next be caught itself */
  captureStartedAt = 0;
  recaptureAfter = 0;
  /** How long this captor has kept its current captive pinned (swallowing needs CANNON.SWALLOW_MS) */
  swallowHeld = 0;
  /** How far from its captor's mouth this creature was when caught (escaping means getting out past it) */
  captureDistance = 0;
  /** When the button was last let go (a deliberate release: the only one that launches a captive) */
  releasedAt = 0;
  /** Gulped: when it pops back out, and the gems it loses then (see CANNON.SWALLOW_PENALTY_SHARE) */
  expelAt = 0;
  gulpPenalty = 0;
  /** Digesting a creature it gulped: its mouth is full until then (no inhaling) */
  digestUntil = 0;
  /** This flight has already hit someone (one damaging hit per launch); hit by a flier, immune to another until then */
  flightHit = false;
  impactImmuneUntil = 0;
  /** Server-only: when the next exhale (a tap with an empty mouth) is allowed */
  exhaleReadyAt = 0;
  /** Server-only: when this breath runs out, and when you can spit again */
  inhaleStopAt = 0;
  /** Server-only: how much breath is left (0-1) as of staminaAt: it drains while inhaling and refills from wherever it is */
  stamina = 1;
  staminaAt = 0;
  spitReadyAt = 0;
  /** Server-only: where an inhale is aimed (the creature turns to face it) */
  aimX = 0;
  aimY = 0;

  constructor(sessionId: string, playerIndex: number) {
    super();
    this.facing = -Math.PI / 2;
    this.inhaling = false;
    this.mouth = "";
    this.stealingFrom = "";
    this.gulping = "";
    this.gulpEndsAt = 0;
    this.stolenTotal = 0;
    this.stunned = false;
    this.latchTarget = "";
    this.beamFocus = 0;
    this.beamQuality = 0;
    this.latchPull = 0;
    this.latchQuality = 0;
    this.flying = false;
    this.capturedBy = "";
    this.insideOf = "";
    this.struggle = 0;
    this.escapeKeys = "";
    this.escapeStep = 0;
    this.dazedUntil = 0;
    this.escapeMissAt = 0;
    this.swallowable = false;
    this.swallowing = 0;
    this.robbing = "";
    this.robbedTotal = 0;
    this.sessionId = sessionId;
    this.playerIndex = playerIndex;
    this.name = `Player ${playerIndex + 1}`;
    this.x = 0;
    this.y = 0;
    this.width = ARENA_RULES.PLAYER_SIZE;
    this.height = ARENA_RULES.PLAYER_SIZE;
    this.state = PLAYER_STATE.ALIVE;
    this.gems = 0;
    this.spawnProtected = false;
    this.recovering = false;
    this.sliding = false;
    this.isBot = false;
  }

  /** Put the player at a spot, in play and protected for a moment */
  spawnAt(x: number, y: number, now: number): void {
    this.x = x;
    this.y = y;
    this.state = PLAYER_STATE.ALIVE;
    this.recovering = false;
    this.stopSliding();
    this.protectFor(WORLD.SPAWN_PROTECTION_MS, now);
    this.stunned = false;
    this.stunEndsAt = this.stunImmuneUntil = 0;
    this.launchSafeUntil = this.suctionSafeUntil = this.recaptureAfter = 0;
    this.inhaling = false;
    this.steerX = this.steerY = this.walkX = this.walkY = 0;
  }

  /** Traffic passes through for `ms` (drawn in a bubble) */
  protectFor(ms: number, now: number): void {
    this.spawnProtected = true;
    this.protectedUntil = now + ms;
  }

  /** Just lost gems to a hit: blink, and let traffic pass through for a moment */
  recover(now: number): void {
    this.recovering = true;
    this.recoverUntil = now + GEMS.HIT_RECOVERY_MS;
  }

  /** Safe from traffic right now */
  isSafe(): boolean {
    return this.spawnProtected || this.recovering;
  }

  /** Hit with no gems left: out of play until respawnAt */
  knockOut(now: number): void {
    this.state = PLAYER_STATE.DEAD;
    this.spawnProtected = false;
    this.recovering = false;
    this.respawnAt = now + WORLD.RESPAWN_DELAY_MS;
    this.inhaling = false;
    this.stopSliding();
  }

  /** How heavy the player is: grows with their size, from 1 for a new player up to 5 at full size */
  weight(): number {
    return this.width / ARENA_RULES.PLAYER_SIZE;
  }

  /** Move straight to a spot, stopping any slide */
  placeAt(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.stopSliding();
  }

  /** Protection ends the moment you shove someone */
  dropProtection(): void {
    if (this.spawnProtected) this.spawnProtected = false;
  }

  /**
   * Shoved: slide about `distance` units in a direction, on top of any slide already under way,
   * so shoves from two players add up. Returns false if the same player shoved a moment ago.
   */
  shove(direction: Direction, distance: number, by: string, now: number): boolean {
    const along = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[direction];
    return this.shoveAlong(along[0], along[1], distance, by, now);
  }

  /** Shoved along (dx, dy), in any direction: see shove() */
  shoveAlong(dx: number, dy: number, distance: number, by: string, now: number, kind = "shove"): boolean {
    if (by === this.lastShoveBy && now - this.lastShoveAt < PUSH.SAME_SHOVER_COOLDOWN_MS) return false;
    this.lastShoveBy = by;
    this.lastShoveAt = now;
    this.lastShoveKind = kind;
    const length = Math.hypot(dx, dy) || 1;
    const speed = distance * PUSH.FRICTION;
    this.vx += (dx / length) * speed;
    this.vy += (dy / length) * speed;
    this.sliding = true;
    this.inhaling = false;
    return true;
  }

  /** Knocked by a hit: skid `distance` along (dx, dy), in any direction, on top of any slide under way */
  skid(dx: number, dy: number, distance: number): void {
    let length = Math.hypot(dx, dy);
    if (length < 1e-6) {
      const angle = Math.random() * Math.PI * 2;
      dx = Math.cos(angle);
      dy = Math.sin(angle);
      length = 1;
    }
    const speed = distance * PUSH.FRICTION;
    this.vx += (dx / length) * speed;
    this.vy += (dy / length) * speed;
    this.sliding = true;
    this.inhaling = false;
  }

  /** Who shoved this player within the last `withinMs` (their session id), if anyone */
  shovedBy(now: number, withinMs: number): string | null {
    return this.lastShoveBy && now - this.lastShoveAt <= withinMs ? this.lastShoveBy : null;
  }

  /** Whether shoving this player, as leader, can knock gems loose right now (starts the cooldown if so) */
  takeBounty(now: number): boolean {
    if (now < this.bountyAt) return false;
    this.bountyAt = now + PUSH.HIT_IMMUNITY_MS;
    return true;
  }

  /** Change the gem count; the player grows or shrinks around their center, staying inside the world */
  setGems(count: number, worldWidth: number, worldHeight: number): void {
    this.gems = Math.max(0, Math.round(count));
    const size = sizeFor(this.gems);
    if (size === this.width) return;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    const margin = ARENA_RULES.EDGE_MARGIN;
    this.width = size;
    this.height = size;
    this.x = Math.max(margin, Math.min(centerX - size / 2, worldWidth - size - margin));
    this.y = Math.max(margin, Math.min(centerY - size / 2, worldHeight - size - margin));
  }

  /** The box traffic hits: what you see, a little inside the edges so grazing doesn't count */
  hitBox(): Box {
    const size = this.width * (1 - 2 * ARENA_RULES.PLAYER_HIT_SHRINK);
    return { x: this.x + (this.width - size) / 2, y: this.y + (this.height - size) / 2, width: size, height: size };
  }

  /**
   * Big creatures slowly shed gems, faster the bigger they are (a share of what they hold above the
   * decay start each second), so growth slows down instead of hitting a ceiling. Bots start sooner
   * and shed faster, so people can outgrow them.
   */
  decay(deltaTime: number, worldWidth: number, worldHeight: number): void {
    const start = this.isBot ? BOTS.DECAY_START : GEMS.DECAY_START;
    const rate = this.isBot ? BOTS.DECAY_RATE : GEMS.DECAY_RATE;
    if (this.gems <= start) {
      this.decayProgress = 0;
      return;
    }
    this.decayProgress += deltaTime * (this.gems - start) * rate;
    if (this.decayProgress < 1) return;
    const lost = Math.floor(this.decayProgress);
    this.decayProgress -= lost;
    this.setGems(this.gems - lost, worldWidth, worldHeight);
  }

  /** Where the browser is steering: a direction no longer than 1 (a light push walks slower) */
  steer(x: number, y: number): void {
    const length = Math.hypot(x, y);
    if (!Number.isFinite(length)) {
      this.steerX = 0;
      this.steerY = 0;
      return;
    }
    const scale = length > 1 ? 1 / length : 1;
    this.steerX = x * scale;
    this.steerY = y * scale;
  }

  /** A new tick begins: remember where the player's middle is, and how big it is */
  markTick(): void {
    this.tickX = this.x + this.width / 2;
    this.tickY = this.y + this.height / 2;
    this.tickRadius = this.width / 2;
  }

  /** Ran into something solid along (nx, ny): stop moving that way (moving along it carries on, so it slides) */
  blockAlong(nx: number, ny: number): void {
    const walk = this.walkX * nx + this.walkY * ny;
    if (walk > 0) {
      this.walkX -= walk * nx;
      this.walkY -= walk * ny;
    }
    const slide = this.vx * nx + this.vy * ny;
    if (slide > 0) {
      this.vx -= slide * nx;
      this.vy -= slide * ny;
    }
  }

  /** Let go of any latch: no focused stream, no aim drawn, no beam breath */
  dropLatch(): void {
    if (this.latchTarget) this.latchTarget = "";
    if (this.beamFocus) this.beamFocus = 0;
    if (this.beamQuality) this.beamQuality = 0;
    if (this.latchPull) this.latchPull = 0;
    if (this.latchQuality) this.latchQuality = 0;
    this.focused = false;
    this.focusNext = false;
    this.latchScore = 0;
    this.latchLostAt = 0;
    this.assistX = 0;
    this.assistY = 0;
  }

  /** Launched (out of a captor's mouth, or a turbine's exhaust): flying at this velocity until it slows down or `maxMs` passes, steering a little on the way */
  launch(now: number, vx: number, vy: number, by: string, maxMs: number, drag: number = CANNON.DRAG): void {
    this.flying = true;
    this.flightVx = vx;
    this.flightVy = vy;
    this.flightDrag = drag;
    this.flightStartedAt = now;
    this.flightEndsAt = now + maxMs;
    this.launchedBy = by;
    this.flightHit = false;
    this.capturedBy = "";
    this.struggle = 0;
    this.swallowable = false;
    this.swallowing = 0;
    this.stopInhale(now);
    this.dropLatch();
    this.vx = 0;
    this.vy = 0;
    this.sliding = false;
  }

  /** Swallowed whole: gulped into `by` (riding along inside it, out of the world) until `expelAt`; it loses `penalty` gems when it pops back out */
  gulp(by: string, now: number, forMs: number, penalty: number): void {
    this.state = PLAYER_STATE.GULPED;
    this.insideOf = by;
    this.expelAt = now + forMs;
    this.gulpPenalty = penalty;
    this.capturedBy = "";
    this.struggle = 0;
    this.swallowable = false;
    this.swallowing = 0;
    this.recovering = false;
    this.stopInhale(now);
    this.dropLatch();
    this.stopSliding();
  }

  /** Popped back out, alive, centred at (cx, cy), and safe from being caught again for `protectMs` */
  expel(cx: number, cy: number, now: number, protectMs: number, worldWidth: number, worldHeight: number): void {
    this.state = PLAYER_STATE.ALIVE;
    this.insideOf = "";
    this.expelAt = 0;
    this.gulpPenalty = 0;
    this.x = Math.max(0, Math.min(worldWidth - this.width, cx - this.width / 2));
    this.y = Math.max(0, Math.min(worldHeight - this.height, cy - this.height / 2));
    this.recaptureAfter = now + protectMs;
  }

  /** The flight is over */
  land(): void {
    this.flying = false;
    this.flightVx = 0;
    this.flightVy = 0;
    this.launchedBy = "";
  }

  /** The stick's direction (kept while caught or flying, when it struggles or steers instead of walking) */
  steerInput(): { x: number; y: number } {
    return { x: this.steerX, y: this.steerY };
  }

  /** Stunned for `ms` (no steering or inhaling), then briefly immune to another stun. */
  stun(now: number, ms: number): void {
    this.stunned = true;
    this.stunEndsAt = now + ms;
    this.stunImmuneUntil = now + ms + CORE.STUN_IMMUNE_MS;
    this.stopInhale(now);
    this.dropLatch();
    this.walkX = this.walkY = this.spin = 0;
  }

  /** How fast the player is moving right now: walking and sliding together */
  velocity(): { x: number; y: number } {
    return { x: this.walkX + this.vx, y: this.walkY + this.vy };
  }

  /** Where an inhale is aimed (only while inhaling): the creature turns to face it */
  aimAt(x: number, y: number): void {
    const length = Math.hypot(x, y);
    if (!this.inhaling || !Number.isFinite(length) || length < 1e-6) return;
    this.aimX = x / length;
    this.aimY = y / length;
  }

  /** Start inhaling (for up to `forMs`, INHALE.MAX_MS for players): you move as usual, and your mouth turns toward your aim */
  startInhale(now: number, forMs: number = Infinity): void {
    // (a full mouth can't inhale: holding someone caught, a press fires them instead (GameRoom); someone gulped has to pop back out first)
    if (this.state !== PLAYER_STATE.ALIVE || this.sliding || this.recovering || this.stunned || this.flying || this.capturedBy || this.gulping || now < this.digestUntil || now < this.inhaleBlockedUntil) return;
    this.breathe(now);
    if (this.stamina < INHALE.MIN_BREATH) return;
    this.dropProtection();
    this.inhaling = true;
    // Until you let go, or the breath you have left runs out
    // Until you let go, the time asked for, or the breath runs out (a good beam can stretch it)
    this.inhaleStopAt = now + forMs;
    this.aimX = 0;
    this.aimY = 0;
  }

  /** Stop inhaling: your breath starts refilling from what's left */
  stopInhale(now = Date.now()): void {
    if (!this.inhaling) return;
    this.breathe(now);
    this.inhaling = false;
  }

  /** Spend a fixed share of the full meter, after applying any elapsed recharge. */
  spendBreath(now: number, amount: number): boolean {
    this.breathe(now);
    if (this.stamina + 1e-9 < amount) return false;
    this.stamina = Math.max(0, this.stamina - amount);
    return true;
  }

  /** Bring breath up to date: drain while inhaling, otherwise refill. */
  private breathe(now: number): void {
    const elapsed = Math.max(0, now - this.staminaAt);
    this.staminaAt = now;
    const change = this.inhaling ? elapsed * breathRate(this.beamQuality, this.stamina) : elapsed / INHALE.REFILL_MS;
    this.stamina = Math.min(1, Math.max(0, this.stamina + change));
  }

  /** Where the player is steering */
  steering(): { x: number; y: number } {
    return { x: this.steerX, y: this.steerY };
  }

  /** Moved aside by someone walking into you, staying inside the world */
  nudge(dx: number, dy: number, worldWidth: number, worldHeight: number): void {
    const margin = ARENA_RULES.EDGE_MARGIN;
    this.x = Math.max(margin, Math.min(this.x + dx, worldWidth - this.width - margin));
    this.y = Math.max(margin, Math.min(this.y + dy, worldHeight - this.height - margin));
  }

  /**
   * Move for this tick: slide if shoved or skidding; otherwise walk where the player is steering
   * (eased, so starts and stops are smooth). No steering while recovering.
   * Protection and recovery wear off here too.
   */
  updateMovement(worldWidth: number, worldHeight: number, now: number, deltaTime: number): void {
    if (this.state !== PLAYER_STATE.ALIVE) return;
    if (this.spawnProtected && now >= this.protectedUntil) this.spawnProtected = false;
    if (this.recovering && now >= this.recoverUntil) this.recovering = false;
    // Breath runs out (a clean beam uses less, or even refills it)
    if (this.inhaling) {
      this.breathe(now);
      if (this.stamina <= 0) this.stopInhale(now);
    }
    if (this.inhaling && now >= this.inhaleStopAt) this.stopInhale(now);
    if (this.stunned && now >= this.stunEndsAt) this.stunned = false;
    if (this.sliding) {
      this.walkX = 0;
      this.walkY = 0;
      this.slide(deltaTime, worldWidth, worldHeight);
      return;
    }
    if (this.stunned) return;
    // Stunned (like recovering), steering can't move you; your facing holds where it was
    // (caught in a mouth or flying, the stick struggles or steers the flight instead: see game/cannon)
    const steer = this.recovering || this.stunned || this.flying || this.capturedBy ? { x: 0, y: 0 } : { x: this.steerX, y: this.steerY };
    const box = { x: this.x, y: this.y, width: this.width, height: this.height };
    const velocity = { x: this.walkX, y: this.walkY };
    walk(box, velocity, steer, deltaTime, worldWidth, worldHeight);
    this.walkX = velocity.x;
    this.walkY = velocity.y;
    // Facing: toward the aim while inhaling, otherwise where you steer
    // A focused latch adds a little aim toward its target; your turning (rate, acceleration, size) does the rest
    const intent = this.inhaling ? { x: this.aimX + this.assistX, y: this.aimY + this.assistY } : { x: this.steerX, y: this.steerY };
    const aiming = Math.hypot(intent.x, intent.y) > 0.25;
    const turn = turnStep(this.facing, this.spin, aiming ? Math.atan2(intent.y, intent.x) : null, this.width, this.inhaling, deltaTime);
    this.spin = turn.spin;
    if (turn.facing !== this.facing) this.facing = turn.facing;
    if (box.x !== this.x) this.x = box.x;
    if (box.y !== this.y) this.y = box.y;
  }

  /** Slide after a shove, slowing to a stop; the world's walls stop you dead */
  private slide(deltaTime: number, worldWidth: number, worldHeight: number): void {
    const margin = ARENA_RULES.EDGE_MARGIN;
    // Exactly how far this tick's slowing slide goes, so a shove travels PUSH.DISTANCE
    const slow = Math.exp(-PUSH.FRICTION * deltaTime);
    const travel = (1 - slow) / PUSH.FRICTION;
    let x = this.x + this.vx * travel;
    let y = this.y + this.vy * travel;
    if (x < margin || x > worldWidth - this.width - margin) {
      x = Math.max(margin, Math.min(x, worldWidth - this.width - margin));
      this.vx = 0;
    }
    if (y < margin || y > worldHeight - this.height - margin) {
      y = Math.max(margin, Math.min(y, worldHeight - this.height - margin));
      this.vy = 0;
    }
    this.x = x;
    this.y = y;
    this.vx *= slow;
    this.vy *= slow;
    if (Math.hypot(this.vx, this.vy) < PUSH.STOP_SPEED) this.stopSliding();
  }

  private stopSliding(): void {
    this.vx = 0;
    this.vy = 0;
    if (this.sliding) this.sliding = false;
  }
}

// Fields sent to clients
type("string")(PlayerSchema.prototype, "sessionId");
type("number")(PlayerSchema.prototype, "playerIndex");
type("string")(PlayerSchema.prototype, "name");
type("number")(PlayerSchema.prototype, "x");
type("number")(PlayerSchema.prototype, "y");
type("number")(PlayerSchema.prototype, "width");
type("number")(PlayerSchema.prototype, "height");
type("string")(PlayerSchema.prototype, "state");
type("number")(PlayerSchema.prototype, "gems");
type("boolean")(PlayerSchema.prototype, "spawnProtected");
type("boolean")(PlayerSchema.prototype, "recovering");
type("boolean")(PlayerSchema.prototype, "sliding");
type("number")(PlayerSchema.prototype, "facing");
type("boolean")(PlayerSchema.prototype, "inhaling");
type("string")(PlayerSchema.prototype, "mouth");
type("string")(PlayerSchema.prototype, "stealingFrom");
type("string")(PlayerSchema.prototype, "gulping");
type("number")(PlayerSchema.prototype, "gulpEndsAt");
type("number")(PlayerSchema.prototype, "stolenTotal");
type("boolean")(PlayerSchema.prototype, "stunned");
type("string")(PlayerSchema.prototype, "latchTarget");
type("number")(PlayerSchema.prototype, "beamFocus");
type("number")(PlayerSchema.prototype, "beamQuality");
type("number")(PlayerSchema.prototype, "latchPull");
type("number")(PlayerSchema.prototype, "latchQuality");
type("boolean")(PlayerSchema.prototype, "flying");
type("string")(PlayerSchema.prototype, "capturedBy");
type("number")(PlayerSchema.prototype, "struggle");
type("boolean")(PlayerSchema.prototype, "swallowable");
type("number")(PlayerSchema.prototype, "swallowing");
type("string")(PlayerSchema.prototype, "insideOf");
type("string")(PlayerSchema.prototype, "escapeKeys");
type("number")(PlayerSchema.prototype, "escapeStep");
type("number")(PlayerSchema.prototype, "dazedUntil");
type("number")(PlayerSchema.prototype, "escapeMissAt");
type("string")(PlayerSchema.prototype, "robbing");
type("number")(PlayerSchema.prototype, "robbedTotal");
type("boolean")(PlayerSchema.prototype, "isBot");
type("number")(PlayerSchema.prototype, "puffReadyAt");
type("number")(PlayerSchema.prototype, "fireReadyAt");
type("boolean")(PlayerSchema.prototype, "fireQueued");
type("number")(PlayerSchema.prototype, "launchSafeUntil");

export { PlayerSchema };
