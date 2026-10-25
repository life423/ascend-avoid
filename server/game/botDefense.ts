import { BOTS, EXHALE } from '../constants/gameConstants.js';

/** Human-scale reaction and missed opportunities; cooldown/breath/turning still belong to the player. */
export class BotGustDefense {
  private threat = '';
  private reactAt = 0;
  private willing = false;
  constructor(private readonly random: () => number = Math.random) {}

  ready(threat: string, now: number): boolean {
    if (!threat) { this.threat = ''; return false; }
    if (threat !== this.threat) {
      this.threat = threat;
      this.reactAt = now + BOTS.GUST_REACT_MIN_MS + this.random() * (BOTS.GUST_REACT_MAX_MS - BOTS.GUST_REACT_MIN_MS);
      this.willing = this.random() < BOTS.GUST_SKILL;
      return false;
    }
    if (now < this.reactAt) return false;
    if (!this.willing) {
      this.reactAt = now + BOTS.GUST_REACT_MAX_MS;
      this.willing = this.random() < BOTS.GUST_SKILL;
      return false;
    }
    return true;
  }

  attempted(now: number): void { this.reactAt = now + EXHALE.COOLDOWN_MS; this.willing = this.random() < BOTS.GUST_SKILL; }
}
