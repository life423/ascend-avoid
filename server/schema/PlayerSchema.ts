import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { turnStep, walk } from "../game/movement.js";
import { breathRate } from "../game/airflow.js";
import { CANNON, EXHALE } from "../constants/gameConstants.js";
import { addBodyGrowth, bodyGrowthForGems, bodyMass, bodyWidthForGrowth, maximumBodyGrowth } from '../game/creatureSize.js';
import { puffDrift } from '../game/puffImpulse.js';
import { constrainArena } from '../game/arenaBoundary.js';
import { WeaponInjuryPressure } from '../game/weaponInjury.js';
import type { Box, Direction } from "../game/movement.js";

const { ARENA_RULES, GEMS, INHALE, PLAYER_STATE, PUSH, WORLD } = GAME_CONSTANTS;


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
  /** Uncapped transferable gem wealth; ordinary physical growth is tracked separately. */
  gems: number;
  /** Server-only ordinary growth, above newborn mass. Overflow is never stored here. */
  private bodyGrowthMass = 0;
  /** Just (re)spawned: drawn translucent in a bubble, and traffic passes through for a moment */
  spawnProtected: boolean;
  /** Just hit and lost gems: blinking, and traffic passes through for a moment */
  recovering: boolean;
  /** Shoved: sliding to a stop, and can't hop until then */
  sliding: boolean;
  /** A bot, not a person (drawn with a robot by its name) */
  isBot: boolean;
  /** Session totals survive knockout; deployed weapons remain owned by their assembler. */
  weaponDamage = 0;
  weaponKnockouts = 0;
  /** Earned during the two-second respawn wait; awarded on the next safe spawn. */
  pendingWeaponGems = 0;
  pendingCombatGems = 0;
  breathingBlocked = false;
  /** Positional forces contribute to warning telemetry, never to movement integration. */
  tickNudgeX = 0;
  tickNudgeY = 0;
  movementVx = 0;
  movementVy = 0;
  /** Brief air impulse: additive to steering, never a stun or impact skid. */
  puffVx = 0;
  puffVy = 0;
  gustVx = 0;
  gustVy = 0;
  flightRemainingMs = 0;
  flightAgeMs = 0;

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
  /** Who this creature is holding as a captive, and when (world time) the hold expires; "" when nobody */
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
  /** Stunned by an impact: can't steer or inhale until it wears off (synced, for drawing) */
  stunned: boolean;
  /** A brief missile daze preserves already-held ammunition; other hard stuns still eject it. */
  holdThroughStun = false;
  /** Server-only: when the stun wears off, and when another can land */
  stunEndsAt = 0;
  stunImmuneUntil = 0;
  /** A defensive puff briefly clears incoming suction, without granting damage immunity. */
  suctionSafeUntil = 0;
  inhaleBlockedUntil = 0;
  puffReadyAt = 0;
  /** World time when the visible post-flight suction shield ends. */
  launchSafeUntil = 0;
  /** World-time guard against assembled weapons only; not suction or player cannonballs. */
  weaponSafeUntil = 0;
  /** Server-only: accepted direct weapon damage in a short rolling window. */
  readonly weaponInjury = new WeaponInjuryPressure();
  /** World-time deadline: direct damaging hits expose gems, without adding movement or input penalties. */
  injuredUntil = 0;
  /** Server-only: gem count at the start of this injury; fixes theft rate until the window ends. */
  injuryGems = 0;
  /** Set at capture; a release must precede the next firing press. */
  captureNeedsRelease = false;
  /** Retired loading wire slots, always neutral. */
  readonly fireReadyAt = 0;
  readonly fireQueued = false;
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
  /** Retired whole-swallow wire slots: neutral forever; preserve later field indices for connected clients. */
  readonly swallowable = false;
  readonly swallowing = 0;
  /** Retired whole-swallow wire slot. */
  readonly insideOf = "";
  /** Retired escape wire slots stay neutral to preserve subsequent schema indices. */
  readonly escapeKeys = "";
  readonly escapeStep = 0;
  readonly dazedUntil = 0;
  readonly escapeMissAt = 0;
  captureRatio = 0;
  captureHoldMs = 0;
  /** Server-only: smoothed airflow quality on each creature, when the latch began and when it last slipped, its score, whether it owns the focused connection, and the aim it adds */
  airQuality = new Map<string, number>();
  latchSince = 0;
  latchLostAt = 0;
  latchScore = 0;
  focused = false;
  focusNext = false;
  assistX = 0;
  assistY = 0;
  /** Server-only: how long (seconds) each creature has been held in this one's airflow without a break. */
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
  /** Server-only: turbine throws retain steering and their existing survival rules. */
  flightKind: 'missile' | 'turbine' = 'missile';
  /** Server-only firing snapshot, independent of the launcher after release. */
  shotMassBonus = 0;
  private bodyWorldWidth: number = WORLD.WIDTH;
  private bodyWorldHeight: number = WORLD.HEIGHT;
  /** Physical launcher width at firing; later growth, death or disconnect cannot strengthen a shot. */
  shotShooterWidth = 0;
  flightStartedAt = 0;
  flightEndsAt = 0;
  launchedBy = "";
  /** Original player shooter, retained through bounces for black-hole credit. */
  shotOwner = "";
  /** When this creature caught its current captive, and when it can next be caught itself */
  captureStartedAt = 0;
  recaptureAfter = 0;
  /** When the button was last let go (a deliberate release: the only one that launches a captive) */
  releasedAt = 0;
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
    this.holdThroughStun = false;
    this.latchTarget = "";
    this.beamFocus = 0;
    this.beamQuality = 0;
    this.latchPull = 0;
    this.latchQuality = 0;
    this.shotMassBonus = 0; this.shotShooterWidth = 0; this.shotOwner = "";
    this.flying = false;
    this.capturedBy = "";
    this.struggle = 0;
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
    this.land();
    this.shotMassBonus = 0; this.shotShooterWidth = 0; this.shotOwner = "";
    this.capturedBy = this.gulping = ""; this.captureNeedsRelease = false;
    this.x = x;
    this.y = y;
    this.state = PLAYER_STATE.ALIVE;
    this.recovering = false;
    this.stopSliding();
    this.protectFor(WORLD.SPAWN_PROTECTION_MS, now);
    this.stunned = false;
    this.holdThroughStun = false;
    this.stunEndsAt = this.stunImmuneUntil = 0;
    this.launchSafeUntil = this.suctionSafeUntil = this.recaptureAfter = 0;
    this.weaponSafeUntil = 0;
    this.injuredUntil = 0;
    this.breathingBlocked = false;
    this.injuryGems = 0;
    this.inhaling = false;
    this.steerX = this.steerY = this.walkX = this.walkY = 0;
  }

  /** Traffic passes through for `ms` (drawn in a bubble) */
  protectFor(ms: number, now: number): void {
    this.weaponInjury.clear();
    this.spawnProtected = true;
    this.protectedUntil = now + ms;
  }

  /** Start a fixed exposure after qualifying damage; further hits still hurt but cannot extend it. */
  injure(worldTime: number): void {
    if (this.state !== PLAYER_STATE.ALIVE || this.spawnProtected || worldTime < this.injuredUntil) return;
    this.weaponInjury.clear();
    this.injuredUntil = worldTime + INHALE.INJURY_MS;
    this.breathingBlocked = true;
    this.inhaling = false;
    this.dropLatch();
    this.injuryGems = this.gems;
  }

  /** Just lost gems to a traffic hit: brief existing recovery. */
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
    this.weaponInjury.clear();
    this.shotMassBonus = 0; this.shotShooterWidth = 0; this.shotOwner = "";
    this.capturedBy = this.gulping = ""; this.captureNeedsRelease = false;
    this.state = PLAYER_STATE.DEAD;
    this.holdThroughStun = false;
    this.weaponSafeUntil = 0;
    this.injuredUntil = 0;
    this.breathingBlocked = false;
    this.injuryGems = 0;
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

  pushWithControl(dx: number, dy: number, speed: number): void {
    this.puffVx += dx * speed;
    this.puffVy += dy * speed;
  }

  /** Rear wind remains steerable and cannot stack into an unbounded throw. */
  pushByGust(dx: number, dy: number, speed: number): void {
    const x = this.gustVx + dx * speed, y = this.gustVy + dy * speed;
    const scale = Math.min(1, EXHALE.REAR_SPEED_CAP / Math.max(1e-9, Math.hypot(x, y)));
    this.gustVx = x * scale; this.gustVy = y * scale;
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

  /** Live transaction: actual losses debit current growth; only new receipts can regrow it. */
  setGems(count: number, worldWidth: number, worldHeight: number): void {
    if (!Number.isFinite(count)) return;
    const next = Math.max(0, Math.round(count)), before = this.gems;
    if (next < before) this.bodyGrowthMass *= next / before;
    else if (next > before) this.bodyGrowthMass = addBodyGrowth(this.bodyGrowthMass, next - before, worldWidth, worldHeight);
    this.gems = next;
    this.applyGrowth(worldWidth, worldHeight);
  }

  /** Explicit fresh setup, not a live receipt or a way to heal from retained wealth. */
  resetGems(count: number, worldWidth: number, worldHeight: number): void {
    if (!Number.isFinite(count)) return;
    this.gems = Math.max(0, Math.round(count));
    this.bodyGrowthMass = bodyGrowthForGems(this.gems, worldWidth, worldHeight);
    this.decayProgress = 0;
    this.applyGrowth(worldWidth, worldHeight);
  }

  /** Capture converts excess wealth once, preserving a small body and never inflating it to ammo size. */
  captureGems(kept: number, worldWidth: number, worldHeight: number): void {
    if (!Number.isFinite(kept)) return;
    this.gems = Math.min(this.gems, Math.max(0, Math.round(kept)));
    this.bodyGrowthMass = Math.min(this.bodyGrowthMass, bodyGrowthForGems(this.gems, worldWidth, worldHeight),
      Math.max(0, bodyMass(CANNON.BULLET_SIZE) - GEMS.BASE_MASS));
    this.applyGrowth(worldWidth, worldHeight);
  }

  private applyGrowth(worldWidth: number, worldHeight: number): void {
    this.bodyWorldWidth = worldWidth; this.bodyWorldHeight = worldHeight;
    this.bodyGrowthMass = Math.min(maximumBodyGrowth(worldWidth, worldHeight), Math.max(0, this.bodyGrowthMass));
    this.resizeBody(this.flying && this.flightKind === 'missile' ? CANNON.BULLET_SIZE : this.ordinaryWidth());
  }

  private ordinaryWidth(): number {
    return bodyWidthForGrowth(this.bodyGrowthMass, this.bodyWorldWidth, this.bodyWorldHeight);
  }

  /** Flight's fixed shell changes geometry, never banked growth. Keep the same center at every transition. */
  private resizeBody(size: number): void {
    if (size === this.width) return;
    const centerX = this.x + this.width / 2;
    const centerY = this.y + this.height / 2;
    this.width = size;
    this.height = size;
    this.x = centerX - size / 2;
    this.y = centerY - size / 2;
    constrainArena(this, this.bodyWorldWidth, this.bodyWorldHeight);
  }

  /** The box traffic hits: what you see, a little inside the edges so grazing doesn't count */
  hitBox(): Box {
    const size = this.width * (1 - 2 * ARENA_RULES.PLAYER_HIT_SHRINK);
    return { x: this.x + (this.width - size) / 2, y: this.y + (this.height - size) / 2, width: size, height: size };
  }

  /**
   * Big creatures slowly shed gems, faster the bigger they are (a share of what they hold above the
   * decay start each second). The same threshold and rate apply to every creature.
   */
  decay(deltaTime: number, worldWidth: number, worldHeight: number): void {
    const start = GEMS.DECAY_START;
    const rate = GEMS.DECAY_RATE;
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
    this.tickNudgeX = this.tickNudgeY = 0;
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

  /** Launched at this velocity until it slows or `maxMs` passes. Only turbine throws opt into steering. */
  launch(now: number, vx: number, vy: number, by: string, maxMs: number, drag: number = CANNON.DRAG, kind: 'missile' | 'turbine' = 'missile'): void {
    this.weaponInjury.clear();
    this.shotMassBonus = 0; this.shotShooterWidth = 0;
    this.flying = true;
    this.flightVx = vx;
    this.flightVy = vy;
    this.flightDrag = drag;
    this.flightKind = kind;
    this.resizeBody(kind === 'missile' ? CANNON.BULLET_SIZE : this.ordinaryWidth());
    this.flightStartedAt = now;
    this.flightEndsAt = now + maxMs;
    this.launchedBy = by;
    this.shotOwner = kind === "missile" ? by : "";
    this.flightHit = false;
    this.capturedBy = "";
    this.struggle = 0;
    this.stopInhale(now);
    this.dropLatch();
    this.vx = 0;
    this.vy = 0;
    this.puffVx = this.puffVy = 0;
    this.gustVx = this.gustVy = 0;
    this.sliding = false;
  }

  /** The flight is over */
  land(): void {
    this.shotMassBonus = 0; this.shotShooterWidth = 0; this.shotOwner = "";
    this.flying = false;
    this.resizeBody(this.ordinaryWidth());
    this.flightKind = 'missile';
    this.flightVx = 0;
    this.flightVy = 0;
    this.launchedBy = "";
  }

  /** The stick's direction: turbine steering or ordinary walking; a captive cannot move its captor. */
  steerInput(): { x: number; y: number } {
    return { x: this.steerX, y: this.steerY };
  }

  /** Stunned for `ms` (no steering or inhaling), then briefly immune to another stun. */
  stun(now: number, ms: number, preserveCaptive = false): void {
    this.stunned = true;
    this.holdThroughStun = preserveCaptive;
    this.stunEndsAt = now + ms;
    this.stunImmuneUntil = now + ms + PUSH.STUN_IMMUNE_MS;
    this.stopInhale(now);
    this.dropLatch();
    this.walkX = this.walkY = this.spin = 0;
  }

  /** How fast the player is moving right now: walking and sliding together */
  velocity(): { x: number; y: number } {
    return { x: this.walkX + this.vx + this.puffVx + this.gustVx, y: this.walkY + this.vy + this.puffVy + this.gustVy };
  }

  /** Inhale or loaded-cannon aim, independent of walking. A zero vector returns to movement aiming. */
  aimAt(x: number, y: number): void {
    const length = Math.hypot(x, y);
    if ((!this.inhaling && !this.gulping) || !Number.isFinite(length)) return;
    if (length < 1e-6) { this.aimX = this.aimY = 0; return; }
    this.aimX = x / length;
    this.aimY = y / length;
  }

  /** Start inhaling (for up to `forMs`, INHALE.MAX_MS for players): you move as usual, and your mouth turns toward your aim */
  startInhale(now: number, forMs: number = Infinity): void {
    // Holding a captive blocks inhale; a fresh action after release fires it (GameRoom).
    if (this.breathingBlocked || this.state !== PLAYER_STATE.ALIVE || this.sliding || this.recovering || this.stunned || this.flying || this.capturedBy || this.gulping || now < this.inhaleBlockedUntil) return;
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
    this.aimX = this.aimY = 0;
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
    const x = this.x, y = this.y;
    this.x += dx; this.y += dy;
    constrainArena(this, worldWidth, worldHeight);
    this.tickNudgeX += this.x - x; this.tickNudgeY += this.y - y;
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
    if (!this.flying && !this.capturedBy) {
      const air = { x: this.puffVx, y: this.puffVy };
      puffDrift(this, air, deltaTime, worldWidth, worldHeight);
      this.puffVx = air.x; this.puffVy = air.y;
      const gust = { x: this.gustVx, y: this.gustVy };
      puffDrift(this, gust, deltaTime, worldWidth, worldHeight, EXHALE.REAR_DRAG);
      this.gustVx = gust.x; this.gustVy = gust.y;
    }
    if (this.sliding) {
      this.walkX = 0;
      this.walkY = 0;
      this.slide(deltaTime, worldWidth, worldHeight);
      return;
    }
    if (this.stunned) return;
    // Stunned (like recovering), steering can't move you; your facing holds where it was
    // Captive steering is interior-only; only turbine flights allow airborne steering.
    const steer = this.recovering || this.stunned || this.flying || this.capturedBy ? { x: 0, y: 0 } : { x: this.steerX, y: this.steerY };
    const box = { x: this.x, y: this.y, width: this.width, height: this.height };
    const velocity = { x: this.walkX, y: this.walkY };
    walk(box, velocity, steer, deltaTime, worldWidth, worldHeight);
    this.walkX = velocity.x;
    this.walkY = velocity.y;
    // Facing: toward the aim while inhaling, otherwise where you steer
    // A focused latch adds a little aim toward its target; your turning (rate, acceleration, size) does the rest
    const intent = this.inhaling || (this.gulping && Math.hypot(this.aimX, this.aimY) > 0) ? { x: this.aimX + this.assistX, y: this.aimY + this.assistY } : { x: this.steerX, y: this.steerY };
    const aiming = Math.hypot(intent.x, intent.y) > 0.25;
    const turn = turnStep(this.facing, this.spin, aiming ? Math.atan2(intent.y, intent.x) : null, this.width, this.inhaling, deltaTime);
    this.spin = turn.spin;
    if (turn.facing !== this.facing) this.facing = turn.facing;
    if (box.x !== this.x) this.x = box.x;
    if (box.y !== this.y) this.y = box.y;
  }

  /** Slide after a shove, slowing normally while walls remove outward motion. */
  private slide(deltaTime: number, worldWidth: number, worldHeight: number): void {
    const slow = Math.exp(-PUSH.FRICTION * deltaTime);
    const travel = (1 - slow) / PUSH.FRICTION;
    this.x += this.vx * travel;
    this.y += this.vy * travel;
    const velocity = { x: this.vx, y: this.vy };
    constrainArena(this, worldWidth, worldHeight, velocity);
    this.vx = velocity.x * slow;
    this.vy = velocity.y * slow;
    if (Math.hypot(this.vx, this.vy) < PUSH.STOP_SPEED) this.stopSliding();
  }

  private stopSliding(): void {
    this.vx = 0;
    this.vy = 0;
    this.puffVx = this.puffVy = 0;
    this.gustVx = this.gustVy = 0;
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
type("number")(PlayerSchema.prototype, "injuredUntil");
type("number")(PlayerSchema.prototype, "weaponDamage");
type("number")(PlayerSchema.prototype, "weaponKnockouts");
type("number")(PlayerSchema.prototype, "movementVx");
type("number")(PlayerSchema.prototype, "movementVy");
type("number")(PlayerSchema.prototype, "flightVx");
type("number")(PlayerSchema.prototype, "flightVy");
type("string")(PlayerSchema.prototype, "flightKind");
type("number")(PlayerSchema.prototype, "flightRemainingMs");
type("number")(PlayerSchema.prototype, "flightAgeMs");
type("boolean")(PlayerSchema.prototype, "flightHit");
type("string")(PlayerSchema.prototype, "launchedBy");

export { PlayerSchema };

// Capture interior state is separate from physical position, growth and projectile mass.
type("number")(PlayerSchema.prototype, "captureRatio");
type("number")(PlayerSchema.prototype, "captureHoldMs");

type("number")(PlayerSchema.prototype, "weaponSafeUntil");

type("boolean")(PlayerSchema.prototype, "breathingBlocked");
type("number")(PlayerSchema.prototype, "puffVx");
type("number")(PlayerSchema.prototype, "puffVy");
type("number")(PlayerSchema.prototype, "gustVx");
type("number")(PlayerSchema.prototype, "gustVy");
