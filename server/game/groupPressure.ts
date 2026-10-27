import { INHALE } from '../constants/gameConstants.js';

/** A solo connection is unchanged; additional valid pressure approaches a bounded bonus. */
export function groupPressureScale(strengths: readonly number[]): number {
  const positive = strengths.filter(n => Number.isFinite(n) && n > 0);
  const sum = positive.reduce((n, value) => n + value, 0), strongest = Math.max(0, ...positive);
  if (!strongest || sum <= strongest) return 1;
  const allowed = strongest * (1 + INHALE.GROUP_EXTRA_MAX * (1 - Math.exp(-(sum / strongest - 1))));
  return allowed / sum;
}
