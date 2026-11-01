import { EXHALE } from '../constants/gameConstants.js';
export interface GustWave {
  x: number;
  y: number;
  width: number;
  facing: number;
  at: number;
}
export interface WavePoint {
  x: number;
  y: number;
}
export function waveRadius(width: number): number { return Math.max(42, width / 2 + Math.min(40, 12 + width * .1)); }
export function waveActive(wave: GustWave, time: number): boolean {
  const age = time - wave.at;
  return age >= EXHALE.WAVE_WRAP_MS && age < EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_PUSH_MS;
}
function arc(wave: GustWave, heading: number): WavePoint[] {
  const radius = waveRadius(wave.width), points: WavePoint[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = heading - EXHALE.WAVE_HALF_ARC + 2 * EXHALE.WAVE_HALF_ARC * i / 12;
    points.push({ x: wave.x + Math.cos(a) * radius, y: wave.y + Math.sin(a) * radius });
  }
  return points;
}
const rearCache = new WeakMap<GustWave, {
  x: number;
  y: number;
  width: number;
  facing: number;
  points: WavePoint[];
}>();
function rear(wave: GustWave): WavePoint[] {
  const cached = rearCache.get(wave);
  if (cached && cached.x === wave.x && cached.y === wave.y && cached.width === wave.width && cached.facing === wave.facing)
    return cached.points;
  const points = arc(wave, wave.facing + Math.PI);
  rearCache.set(wave, { x: wave.x, y: wave.y, width: wave.width, facing: wave.facing, points });
  return points;
}
/** Two front lobes sweep around the flanks; the rear airflow then dissipates. */
export function waveArcs(wave: GustWave, time: number): WavePoint[][] {
  const t = Math.max(0, Math.min(1, (time - wave.at) / EXHALE.WAVE_WRAP_MS));
  if (t === 0)
    return [arc(wave, wave.facing)];
  if (t === 1)
    return [rear(wave)];
  const turn = Math.PI * t * t * (3 - 2 * t);
  return [arc(wave, wave.facing + turn), arc(wave, wave.facing - turn)];
}
export function segmentDistance(p: WavePoint, a: WavePoint, b: WavePoint): number {
  const dx = b.x - a.x, dy = b.y - a.y, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}
export function distanceToWave(wave: GustWave, p: WavePoint): number {
  const points = rear(wave);
  let nearest = Infinity;
  for (let i = 1; i < points.length; i++)
    nearest = Math.min(nearest, segmentDistance(p, points[i - 1], points[i]));
  return nearest;
}
function crosses(a: WavePoint, b: WavePoint, c: WavePoint, d: WavePoint): boolean {
  const x = b.x - a.x, y = b.y - a.y, u = d.x - c.x, v = d.y - c.y, det = x * v - y * u;
  if (Math.abs(det) < 1e-8)
    return Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b)) <= EXHALE.WAVE_THICKNESS / 2;
  const t = ((c.x - a.x) * v - (c.y - a.y) * u) / det, s = ((c.x - a.x) * y - (c.y - a.y) * x) / det;
  return t >= 0 && t <= 1 && s >= 0 && s <= 1 || Math.min(segmentDistance(a, c, d), segmentDistance(b, c, d), segmentDistance(c, a, b), segmentDistance(d, a, b)) <= EXHALE.WAVE_THICKNESS / 2;
}
/** A connection crossed by the brief rear pulse, not an obstruction to later airflow. */
export function waveIntercepts(wave: GustWave, time: number, a: WavePoint, b: WavePoint): boolean {
  if (!waveActive(wave, time))
    return false;
  const radius = waveRadius(wave.width), c = Math.cos(wave.facing), s = Math.sin(wave.facing);
  if (Math.min((a.x - wave.x) * c + (a.y - wave.y) * s, (b.x - wave.x) * c + (b.y - wave.y) * s) > -radius * Math.cos(EXHALE.WAVE_HALF_ARC) + EXHALE.WAVE_THICKNESS / 2)
    return false;
  if (segmentDistance(wave, a, b) > radius + EXHALE.WAVE_THICKNESS / 2)
    return false;
  const points = rear(wave);
  for (let i = 1; i < points.length; i++)
    if (crosses(a, b, points[i - 1], points[i]))
      return true;
  return false;
}
