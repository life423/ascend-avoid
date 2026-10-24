import { BOTS } from '../constants/gameConstants.js';

/** Read periodically while loading, then commit to a fallible shot rather than track every tick. */
export class BotCannonAim {
  private capture = '';
  private observeAt = 0;
  private fireAt = 0;
  private angle: number | null = null;

  constructor(private readonly random: () => number = Math.random) {}

  update(capture: string, loadedAt: number, now: number, facing: number, observe: () => number | null): { angle: number; ready: boolean } {
    if (this.capture !== capture) {
      this.capture = capture;
      this.angle = null;
      this.observeAt = now + BOTS.FIRE_READ_MS;
      this.fireAt = Math.max(now, loadedAt) + BOTS.FIRE_REACT_MIN_MS + this.random() * (BOTS.FIRE_REACT_MAX_MS - BOTS.FIRE_REACT_MIN_MS);
    }
    if (now < loadedAt && now >= this.observeAt) {
      this.observeAt = now + BOTS.FIRE_OBSERVE_MS;
      const observed = observe();
      const error = (this.random() < 0.5 ? -1 : 1) * (BOTS.FIRE_ERROR_MIN + this.random() * (BOTS.FIRE_ERROR_MAX - BOTS.FIRE_ERROR_MIN));
      this.angle = observed === null ? facing : observed + error;
    }
    return { angle: this.angle ?? facing, ready: now >= this.fireAt };
  }
}
