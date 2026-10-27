import { BOTS, CANNON } from '../constants/gameConstants.js';
import { impactGems, shooterMassContribution } from './cannon.js';

/** Opportunity selection changes the target, never the bot's observation delay, aim error or firing rules. */
export function cannonTargetAppeal(gems: number, width: number, ammoWidth: number, speed: number, distance: number, shooterWidth?: number): number {
  const lost = impactGems(gems, speed, ammoWidth, width, shooterWidth === undefined ? 0 : shooterMassContribution(shooterWidth, ammoWidth));
  return (gems - lost < CANNON.IMPACT_KO_GEMS ? 1000 : 0) + 100 * lost / Math.max(1, gems) + Math.sqrt(lost) - distance * .05;
}

export interface BotShotTarget { id: string; angle: number }

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
