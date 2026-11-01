import { SHOCKWAVE } from '../constants/gameConstants.js';

export interface PulsarPose { angle: number; pulseAt: number; pulseFacing: number; beatAt: number }
export interface PulsarWave { x: number; y: number; facing: number; at: number }
export interface PulsarPoint { x: number; y: number }

/** A small clockwise recovery turn holds through the entire charge and release. */
export function pulsarHeading(w: PulsarPose, time: number): number {
  if (!w.pulseAt) return w.angle;
  const rotating = SHOCKWAVE.BEAT_MS - SHOCKWAVE.WINDUP_MS - SHOCKWAVE.FOLLOW_THROUGH_MS;
  const t = Math.max(0, Math.min(1, (time - w.pulseAt - SHOCKWAVE.FOLLOW_THROUGH_MS) / rotating));
  const eased = t * t * (3 - 2 * t);
  return w.pulseFacing + SHOCKWAVE.TURN_STEP * eased;
}

export function pulsarRadius(age: number): number {
  return SHOCKWAVE.START_RADIUS + SHOCKWAVE.RANGE * Math.max(0, Math.min(1, age / SHOCKWAVE.WAVE_MS));
}

/** Distance to the visible crescent, with the rear half-plane excluded from damage. */
function arcDistance(x: number, y: number, facing: number, radius: number): number {
  const forward = x * Math.cos(facing) + y * Math.sin(facing);
  if (forward < -1e-7) return Infinity;
  const off = Math.abs(Math.atan2(Math.sin(Math.atan2(y, x) - facing), Math.cos(Math.atan2(y, x) - facing)));
  if (off <= SHOCKWAVE.HALF_ARC) return Math.abs(Math.hypot(x, y) - radius);
  return Math.min(...[-1, 1].map(side => {
    const a = facing + side * SHOCKWAVE.HALF_ARC;
    return Math.hypot(x - radius * Math.cos(a), y - radius * Math.sin(a));
  }));
}

/** Continuous moving-circle/expanding-arc contact, clipped to the wave's actual lifetime. */
export function pulsarContact(wave: PulsarWave, from: PulsarPoint, to: PulsarPoint, fromAge: number, toAge: number, bodyRadius: number): boolean {
  if (toAge < 0 || fromAge > SHOCKWAVE.WAVE_MS) return false;
  const duration = toAge - fromAge;
  const lo = duration > 0 ? Math.max(0, -fromAge / duration) : 0;
  const hi = duration > 0 ? Math.min(1, (SHOCKWAVE.WAVE_MS - fromAge) / duration) : 1;
  if (lo > hi) return false;
  const x = from.x + (to.x - from.x) * lo - wave.x, y = from.y + (to.y - from.y) * lo - wave.y;
  const dx = (to.x - from.x) * (hi - lo), dy = (to.y - from.y) * (hi - lo);
  const r = pulsarRadius(fromAge + duration * lo), dr = pulsarRadius(fromAge + duration * hi) - r;
  const size = bodyRadius + SHOCKWAVE.FRONT_HALF_WIDTH, times = [0, 1];
  const add = (t: number) => { if (t >= 0 && t <= 1) times.push(t); };
  const roots = (a: number, b: number, c: number) => {
    if (Math.abs(a) < 1e-10) { if (Math.abs(b) > 1e-10) add(-c / b); return; }
    const disc = b * b - 4 * a * c;
    if (disc < -1e-7) return;
    const root = Math.sqrt(Math.max(0, disc));
    add((-b - root) / (2 * a)); add((-b + root) / (2 * a));
  };
  // Radial boundaries, moving endpoint discs and angular boundaries contain every contact transition.
  for (const side of [-1, 1]) {
    const radial = r + side * size;
    roots(dx * dx + dy * dy - dr * dr, 2 * (x * dx + y * dy - radial * dr), x * x + y * y - radial * radial);
    const a = wave.facing + side * SHOCKWAVE.HALF_ARC, c = Math.cos(a), s = Math.sin(a);
    const ex = x - r * c, ey = y - r * s, vx = dx - dr * c, vy = dy - dr * s;
    roots(vx * vx + vy * vy, 2 * (ex * vx + ey * vy), ex * ex + ey * ey - size * size);
    const turn = dx * s - dy * c;
    if (Math.abs(turn) > 1e-10) add(-(x * s - y * c) / turn);
  }
  const forwardStep = dx * Math.cos(wave.facing) + dy * Math.sin(wave.facing);
  if (Math.abs(forwardStep) > 1e-10) add(-(x * Math.cos(wave.facing) + y * Math.sin(wave.facing)) / forwardStep);
  times.sort((a, b) => a - b);
  const touching = (t: number) => arcDistance(x + dx * t, y + dy * t, wave.facing, r + dr * t) <= size + 1e-6;
  return times.some((t, i) => touching(t) || i > 0 && touching((t + times[i - 1]) / 2));
}
