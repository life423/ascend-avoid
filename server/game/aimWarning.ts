import { CANNON } from '../constants/gameConstants.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { constrainArena, arenaContains } from './arenaBoundary.js';
import { blackHoleIsLethal, circleEntry } from './blackHole.js';
import { botShotVisible } from './botAim.js';
import type { ArenaView } from './camera.js';
import { launchSpeed } from './cannon.js';
import { firstImpact, type IncomingImpact, type IncomingShot, type MovingCircle } from './incomingShot.js';

const HORIZON_S = 0.5;
const SETTLE_MS = 100;
const MAX_SAMPLE_GAP_MS = 200;

type Body = Pick<PlayerSchema, 'x' | 'y' | 'width' | 'height' | 'state' | 'capturedBy' |
  'gulping' | 'gulpEndsAt' | 'captureHoldMs' | 'stunned' | 'flying' | 'facing' | 'movementVx' | 'movementVy'>;

interface Arena {
  time: number;
  shiftPhase: string;
  worldWidth: number;
  worldHeight: number;
  players: { get(id: string): Body | undefined; keys(): Iterable<string>; values(): Iterable<Body> };
  blackHoles: Iterable<{ x: number; y: number; radius: number; phase: string; activeAt: number }>;
}

export interface Aim extends IncomingImpact { shot: IncomingShot; shooterId: string; ammoId: string }

function motion(p: Body): MovingCircle {
  return { x: p.x + p.width / 2, y: p.y + p.height / 2, vx: p.movementVx, vy: p.movementVy, radius: p.width / 2 };
}

function projectedAim(state: Arena, id: string, shooter: Body, targetId: string, target: MovingCircle, view: ArenaView): Aim | null {
  if (!shooter.gulping || id === targetId || shooter.stunned || shooter.flying || shooter.capturedBy || shooter.state !== 'alive') return null;
  const ammo = state.players.get(shooter.gulping);
  if (!ammo || ammo.state !== 'alive' || ammo.capturedBy !== id || shooter.gulpEndsAt <= state.time ||
      shooter.gulpEndsAt - ammo.captureHoldMs + CANNON.CAPTURE_FIRE_DELAY_MS > state.time) return null;
  const body = motion(shooter);
  if (botShotVisible(view, body.x, body.y, body.radius)) return null;

  const speed = launchSpeed(shooter.width), size = CANNON.BULLET_SIZE, radius = size / 2;
  const clearance = body.radius + radius + CANNON.LAUNCH_CLEARANCE;
  const dx = Math.cos(shooter.facing), dy = Math.sin(shooter.facing);
  const muzzle = { x: body.x + dx * clearance - radius, y: body.y + dy * clearance - radius, width: size, height: size };
  constrainArena(muzzle, state.worldWidth, state.worldHeight);
  const x = muzzle.x + radius, y = muzzle.y + radius;
  const reach = radius + target.radius + HORIZON_S * (speed + Math.hypot(target.vx, target.vy));
  if (Math.hypot(x - target.x, y - target.y) > reach) return null;
  const shot = { id: 'aim:' + id + ':' + shooter.gulping, x, y, vx: speed * dx, vy: speed * dy, radius, drag: CANNON.DRAG, visible: false };
  const hit = firstImpact(target, [shot], HORIZON_S);
  if (!hit) return null;

  const travel = speed * -Math.expm1(-CANNON.DRAG * hit.seconds) / CANNON.DRAG;
  const endX = x + dx * travel, endY = y + dy * travel;
  if (!arenaContains({ ...muzzle, x: endX - radius, y: endY - radius }, state.worldWidth, state.worldHeight)) return null;
  if (state.shiftPhase !== 'grace') {
    for (const hole of state.blackHoles) {
      if (blackHoleIsLethal(hole, state.time) && circleEntry(x, y, endX, endY, hole.x, hole.y, hole.radius) !== null) return null;
    }
  }
  const defender = state.players.get(targetId);
  for (const p of state.players.values()) {
    if (p === shooter || p === defender || p.capturedBy || p.flying || p.state !== 'alive') continue;
    const other = motion(p);
    const reach = travel + other.radius + radius + Math.hypot(other.vx, other.vy) * hit.seconds;
    if (Math.hypot(other.x - x, other.y - y) <= reach && firstImpact(other, [shot], hit.seconds)) return null;
  }
  return { ...hit, shot, shooterId: id, ammoId: shooter.gulping };
}

/** Confirm a firing line across world updates. Rendering one snapshot repeatedly adds no evidence. */
export class AimWarning {
  private lines = new Map<string, { since: number; last: number }>();
  private shown = '';

  clear(): void { this.lines.clear(); this.shown = ''; }

  update(state: Arena, targetId: string, target: MovingCircle, camera: ArenaView | (() => ArenaView)): Aim | null {
    let best: Aim | null = null, bestRank = Infinity;
    let view: ArenaView | undefined;
    const active = new Set<string>();
    for (const id of state.players.keys()) {
      const shooter = state.players.get(id)!;
      if (!shooter.gulping) continue;
      view ??= typeof camera === 'function' ? camera() : camera;
      const aim = projectedAim(state, id, shooter, targetId, target, view);
      if (!aim) continue;
      active.add(aim.id);
      let line = this.lines.get(aim.id);
      if (!line || state.time < line.last || state.time - line.last > MAX_SAMPLE_GAP_MS) {
        line = { since: state.time, last: state.time };
        this.lines.set(aim.id, line);
      }
      line.last = state.time;
      if (state.time - line.since < SETTLE_MS) continue;
      // Keep one stable direction when two arrival estimates differ by less than a network tick.
      const rank = aim.seconds - (aim.id === this.shown ? 0.05 : 0);
      if (rank < bestRank) { best = aim; bestRank = rank; }
    }
    for (const id of this.lines.keys()) if (!active.has(id)) this.lines.delete(id);
    this.shown = best?.id ?? '';
    return best;
  }
}
