import { BOTS, CANNON } from '../constants/gameConstants.js';
import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { impactGems, shooterMassContribution, lethalPlayerImpact } from './cannon.js';
import { blackHoleIsLethal, circleEntry } from './blackHole.js';
import { viewShort } from './camera.js';
import { cannonInjuryOpportunity } from './projectileInjury.js';

const LEADER_SHOT_WINDOW_MS = 3500;

/** Opportunity selection changes the target, never the bot's observation delay, aim error or firing rules. */
export function cannonTargetAppeal(gems: number, width: number, ammoWidth: number, speed: number, distance: number, shooterWidth?: number): number {
  const bonus = shooterWidth === undefined ? 0 : shooterMassContribution(shooterWidth, ammoWidth);
  const lost = impactGems(gems, speed, ammoWidth, width, bonus, 'missile', shooterWidth ?? 0);
  const lethal = gems - lost < CANNON.IMPACT_KO_GEMS || lethalPlayerImpact(speed, ammoWidth, width, bonus, shooterWidth);
  // A substantial opening against a peer is worth choosing over another tiny easy knockout.
  // Tiny ammunition still seeks vulnerable small targets; this changes decisions, never damage.
  const rivalry = shooterWidth !== undefined && width >= shooterWidth * .85 && width <= shooterWidth * 1.4 && lost >= gems * .06;
  return (lethal ? 1000 : 0) + (rivalry ? 1200 : 0) + 100 * lost / Math.max(1, gems) + Math.sqrt(lethal ? gems : lost) - distance * .05;
}

export interface BotShotTarget { id: string; angle: number }

/** Briefly favor a visible leader if a straight shot at their current position could open an injury. */
export function leaderShotOpportunity(state: GameState, shooter: PlayerSchema, now: number): BotShotTarget | null {
  if (!shooter.gulping || now >= shooter.captureStartedAt + LEADER_SHOT_WINDOW_MS) return null;
  const leader = state.leader();
  if (!leader || leader === shooter || leader.sessionId === shooter.gulping || leader.spawnProtected ||
    leader.capturedBy || leader.flying || now < leader.impactImmuneUntil || state.time < leader.injuredUntil) return null;

  const x = shooter.x + shooter.width / 2, y = shooter.y + shooter.height / 2;
  const radius = leader.width / 2;
  const dx = leader.x + radius - x, dy = leader.y + radius - y;
  const sight = viewShort(shooter.width) / 2;
  if (Math.hypot(Math.max(0, Math.abs(dx) - sight), Math.max(0, Math.abs(dy) - sight)) > radius) return null;
  const distance = Math.hypot(dx, dy);
  if (distance - shooter.width / 2 - radius > BOTS.FIRE_RANGE) return null;
  const opportunity = cannonInjuryOpportunity(shooter.width, leader.width, leader.gems, distance);
  if (!opportunity) return null;
  const { muzzle, travel } = opportunity;

  const startX = x + dx * muzzle / distance, startY = y + dy * muzzle / distance;
  const endX = startX + dx * travel / distance, endY = startY + dy * travel / distance;
  if (state.shiftPhase !== 'grace' && state.blackHoles.some(hole => blackHoleIsLethal(hole, state.time) &&
    state.isFloorAt(hole.x, hole.y) && circleEntry(startX, startY, endX, endY, hole.x, hole.y, hole.radius) !== null)) return null;
  return { id: leader.sessionId, angle: Math.atan2(dy, dx) };
}

/** A fallible firing decision: observe, turn normally, settle, then shoot a real target. */
export class BotCannonAim {
  private capture = '';
  private observeAt = 0;
  private firstSeenAt = 0;
  private fireAt = Infinity;
  private target: BotShotTarget | null = null;
  private error = 0;
  private alignedSince: number | null = null;

  constructor(private readonly random: () => number = Math.random) {}
  get targetId(): string | null { return this.target?.id ?? null; }

  reset(): void { this.capture = ''; this.target = null; this.alignedSince = null; this.fireAt = Infinity; }

  update(capture: string, capturedAt: number, now: number, facing: number,
    observe: () => BotShotTarget | null, valid: (id: string) => boolean = () => true): { angle: number; ready: boolean; hasTarget: boolean } {
    if (this.capture !== capture) {
      this.capture = capture;
      this.firstSeenAt = Math.max(capturedAt, now);
      this.observeAt = now + BOTS.FIRE_READ_MS;
      this.target = null; this.alignedSince = null; this.fireAt = Infinity;
    }
    if (this.target && !valid(this.target.id)) {
      this.target = null; this.alignedSince = null; this.fireAt = Infinity;
      this.observeAt = now + BOTS.FIRE_READ_MS;
    }
    if (now >= this.observeAt) {
      this.observeAt = now + BOTS.FIRE_OBSERVE_MS;
      const observed = observe();
      if (!observed || !Number.isFinite(observed.angle) || !valid(observed.id)) {
        this.target = null; this.alignedSince = null; this.fireAt = Infinity;
      } else {
        if (observed.id !== this.target?.id) {
          this.error = (this.random() < .5 ? -1 : 1) * (BOTS.FIRE_ERROR_MIN + this.random() * (BOTS.FIRE_ERROR_MAX - BOTS.FIRE_ERROR_MIN));
          this.fireAt = now + BOTS.FIRE_REACT_MIN_MS + this.random() * (BOTS.FIRE_REACT_MAX_MS - BOTS.FIRE_REACT_MIN_MS);
          this.alignedSince = null;
        }
        // Keep the same imperfect offset while observing this target, rather than jitter every read.
        this.target = { id: observed.id, angle: observed.angle + this.error };
      }
    }
    const angle = this.target?.angle ?? facing;
    const aligned = this.target && Math.abs(Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing))) <= BOTS.FIRE_AIM;
    if (aligned) this.alignedSince ??= now;
    else this.alignedSince = null;
    return { angle, hasTarget: this.target !== null, ready: this.target !== null
      && now >= this.firstSeenAt + BOTS.FIRE_MIN_CAPTURE_MS && now >= this.fireAt
      && this.alignedSince !== null && now - this.alignedSince >= BOTS.FIRE_SETTLE_MS };
  }
}
