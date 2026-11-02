export interface MovingCircle { x: number; y: number; vx: number; vy: number; radius: number }
import { CANNON } from '../constants/gameConstants.js';
export const PLAYER_SHOT_WARNING_S = 1.2;
export interface IncomingShot extends MovingCircle { id: string; visible: boolean; remaining?: number; arming?: number; drag?: number }
export interface IncomingImpact { id: string; seconds: number; x: number; y: number }

/** Predict contact against current target motion, retaining normal missile deceleration. No balance effects. */
export function firstImpact(target: MovingCircle, shots: readonly IncomingShot[], horizon = .5, includeVisible = false): IncomingImpact | null {
  let nearest: IncomingImpact | null = null;
  for (const shot of shots) {
    if (shot.visible && !includeVisible || shot.remaining !== undefined && shot.remaining <= 0) continue;
    if (shot.drag && shot.drag > 0) {
      // Match decelerating player flights rather than projecting their launch speed forever.
      let x = shot.x, y = shot.y, vx = shot.vx, vy = shot.vy;
      const limit = Math.min(horizon, shot.remaining ?? horizon);
      for (let t = 0; t < limit - 1e-9;) {
        const dt = Math.min(1 / 60, limit - t), keep = Math.exp(-shot.drag * dt);
        vx *= keep; vy *= keep;
        const segment = firstImpact({ ...target, x: target.x + target.vx * t, y: target.y + target.vy * t },
          [{ ...shot, x, y, vx, vy, drag: 0, visible: false, remaining: dt, arming: Math.max(0, (shot.arming ?? 0) - t) }], dt);
        if (segment) {
          const seconds = t + segment.seconds;
          if (!nearest || seconds < nearest.seconds - 1e-7 || Math.abs(seconds - nearest.seconds) < 1e-7 && shot.id < nearest.id)
            nearest = { id: shot.id, seconds, x: shot.x, y: shot.y };
          break;
        }
        x += vx * dt; y += vy * dt; t += dt;
      }
      continue;
    }
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
    if (seconds < Math.max(0, shot.arming ?? 0) || seconds > Math.min(horizon, shot.remaining ?? horizon)) continue;
    if (!nearest || seconds < nearest.seconds - 1e-7 || Math.abs(seconds - nearest.seconds) < 1e-7 && shot.id < nearest.id)
      nearest = { id: shot.id, seconds, x: shot.x, y: shot.y };
  }
  return nearest;
}

interface PlayerMissile {
  x: number; y: number; width: number; height: number; state: string;
  flying: boolean; flightKind: string; flightHit: boolean; flightAgeMs: number;
  flightVx: number; flightVy: number; flightRemainingMs: number; launchedBy: string;
}
/** Public flight telemetry, shared by human warnings and delayed bot decisions. */
export function playerMissileShot(p: PlayerMissile, id: string, targetId: string, lead = 0, visible = false): IncomingShot | null {
  if (id === targetId || p.state !== 'alive' || !p.flying || p.flightKind !== 'missile' || p.flightHit
    || p.launchedBy === targetId && p.flightAgeMs + lead * 1000 < CANNON.LAUNCHER_GRACE_MS) return null;
  const keep = Math.exp(-CANNON.DRAG * lead), travel = (1 - keep) / CANNON.DRAG;
  const vx = p.flightVx * keep, vy = p.flightVy * keep;
  const speed = Math.hypot(vx, vy);
  const remaining = Math.min(p.flightRemainingMs / 1000 - lead, Math.log(speed / CANNON.STOP_SPEED) / CANNON.DRAG);
  if (!(remaining > 0)) return null;
  return { id: `player:${id}`, x: p.x + p.width / 2 + p.flightVx * travel, y: p.y + p.height / 2 + p.flightVy * travel,
    vx, vy, radius: p.width / 2, visible, remaining, drag: CANNON.DRAG };
}
