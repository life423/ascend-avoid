export interface MovingCircle { x: number; y: number; vx: number; vy: number; radius: number }
export interface IncomingShot extends MovingCircle { id: string; visible: boolean; remaining?: number }
export interface IncomingImpact { id: string; seconds: number; x: number; y: number }

/** Constant-current-velocity circle intersection, in relative coordinates. No balance effects. */
export function firstImpact(target: MovingCircle, shots: readonly IncomingShot[], horizon = .5): IncomingImpact | null {
  let nearest: IncomingImpact | null = null;
  for (const shot of shots) {
    if (shot.visible || shot.remaining !== undefined && shot.remaining <= 0) continue;
    const x = shot.x - target.x, y = shot.y - target.y, vx = shot.vx - target.vx, vy = shot.vy - target.vy;
    const r = target.radius + shot.radius, c = x * x + y * y - r * r;
    const a = vx * vx + vy * vy, b = 2 * (x * vx + y * vy);
    let seconds = 0;
    if (c > 0) {
      if (a < 1e-9 || b >= 0) continue;
      const disc = b * b - 4 * a * c;
      if (disc < 0) continue;
      seconds = (-b - Math.sqrt(disc)) / (2 * a);
    }
    if (seconds < 0 || seconds > Math.min(horizon, shot.remaining ?? horizon)) continue;
    if (!nearest || seconds < nearest.seconds - 1e-7 || Math.abs(seconds - nearest.seconds) < 1e-7 && shot.id < nearest.id)
      nearest = { id: shot.id, seconds, x: shot.x, y: shot.y };
  }
  return nearest;
}
