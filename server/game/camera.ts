import { ARENA_RULES, CAMERA } from "../constants/gameConstants.js";
import { threatHorizon } from "./airflow.js";
import { arenaClearance, arenaCornerRadius, constrainArenaPoint } from "./arenaBoundary.js";

/**
 * The camera rig (browsers): pure, so it can be tested. A soft follow: position on a critically
 * damped spring toward a target a little ahead of your movement (and your facing, more while
 * inhaling), and zoom on a softer spring toward a view sized by how big you should look, never
 * closer than the threat horizon allows.
 */

/** One step of a critically damped spring (no overshoot) toward `target` */
export function springStep(value: number, velocity: number, target: number, omega: number, dt: number): { value: number; velocity: number } {
  const offset = value - target;
  const decay = Math.exp(-omega * dt);
  const carry = velocity + omega * offset;
  return { value: target + (offset + carry * dt) * decay, velocity: (velocity - omega * carry * dt) * decay };
}

/** The short side of the view (world units) for a creature this wide: big enough to keep it the right size on screen, and to show a bigger creature coming in time */
export function viewShort(width: number): number {
  const share = Math.min(CAMERA.SIZE_SHARE_MAX, CAMERA.SIZE_SHARE * Math.pow(Math.max(1, width / ARENA_RULES.PLAYER_SIZE), CAMERA.SIZE_SHARE_GROWTH));
  return Math.max(width / share, 2 * threatHorizon(Math.min(width, CAMERA.THREAT_MAX_WIDTH), CAMERA.THREAT_RATIO, CAMERA.REACTION_S));
}

export interface ArenaView { x: number; y: number; width: number; height: number; scale: number }
export interface CameraFocus { x: number; y: number; width: number }

/** Fit the entire rectangular viewport inside the curved arena, keeping the followed body visible.
 * Position is projected onto the intersection of the four corner constraints. Zoom changes only
 * when that rectangle cannot otherwise fit while retaining the subject. Physics never changes.
 */
export function constrainArenaView(view: ArenaView, worldWidth: number, worldHeight: number, focus?: CameraFocus): ArenaView {
  const radius = arenaCornerRadius(worldWidth, worldHeight);
  const coreX = worldWidth / 2 - radius, coreY = worldHeight / 2 - radius;
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const subject = focus ? { x: focus.x, y: focus.y } : null;
  if (subject) constrainArenaPoint(subject, worldWidth, worldHeight, 1);
  // A same-aspect rectangle inscribed in the body's wall-clearance circle is always feasible.
  // Preserve the entire body in open space; at a tight curved wall retain its visible core.
  const clearance = subject ? arenaClearance(subject.x, subject.y, worldWidth, worldHeight) * .95 : 0;
  const diagonal = Math.hypot(view.width, view.height);
  const padX = focus ? Math.min(focus.width / 2, clearance * view.width / diagonal) : 0;
  const padY = focus ? Math.min(focus.width / 2, clearance * view.height / diagonal) : 0;
  const baseZoom = Math.max(1, view.width / worldWidth, view.height / worldHeight);
  const bounds = (zoom: number) => {
    const hx = view.width / zoom / 2, hy = view.height / zoom / 2;
    const minX = subject ? Math.max(hx, subject.x - hx + padX) : hx;
    const maxX = subject ? Math.min(worldWidth - hx, subject.x + hx - padX) : worldWidth - hx;
    const minY = subject ? Math.max(hy, subject.y - hy + padY) : hy;
    const maxY = subject ? Math.min(worldHeight - hy, subject.y + hy - padY) : worldHeight - hy;
    const nearX = clamp(worldWidth / 2, minX, maxX), nearY = clamp(worldHeight / 2, minY, maxY);
    return { hx, hy, minX, maxX, minY, maxY, nearX, nearY };
  };
  const fits = (zoom: number) => {
    const b = bounds(zoom);
    return b.minX <= b.maxX + 1e-7 && b.minY <= b.maxY + 1e-7 &&
      Math.hypot(Math.max(0, Math.abs(b.nearX - worldWidth / 2) + b.hx - coreX),
        Math.max(0, Math.abs(b.nearY - worldHeight / 2) + b.hy - coreY)) <= radius + 1e-7;
  };
  let maxZoom = baseZoom * 2;
  if (subject && focus) maxZoom = Math.max(baseZoom,
    Math.min(view.width / (2 * padX), view.height / (2 * padY)));
  let zoom = baseZoom;
  if (!fits(zoom)) {
    let lo = zoom, hi = maxZoom;
    for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (fits(mid)) hi = mid; else lo = mid; }
    zoom = hi;
  }
  const b = bounds(zoom);
  let x = clamp(view.x, b.minX, b.maxX), y = clamp(view.y, b.minY, b.maxY);
  const qx = Math.max(0, Math.abs(x - worldWidth / 2) + b.hx - coreX);
  const qy = Math.max(0, Math.abs(y - worldHeight / 2) + b.hy - coreY);
  const distance = Math.hypot(qx, qy);
  if (distance > radius) {
    const minQx = Math.max(0, Math.abs(b.nearX - worldWidth / 2) + b.hx - coreX);
    const minQy = Math.max(0, Math.abs(b.nearY - worldHeight / 2) + b.hy - coreY);
    let px = qx * radius / distance, py = qy * radius / distance;
    if (px < minQx) { px = minQx; py = Math.sqrt(Math.max(0, radius * radius - px * px)); }
    if (py < minQy) { py = minQy; px = Math.sqrt(Math.max(0, radius * radius - py * py)); }
    x -= Math.sign(x - worldWidth / 2) * (qx - px);
    y -= Math.sign(y - worldHeight / 2) * (qy - py);
  }
  return { x, y, width: b.hx * 2, height: b.hy * 2, scale: view.scale * zoom };
}

/** What the camera follows: a creature's middle, velocity, width and facing, and whether it's inhaling */
export interface CameraSubject {
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  facing: number;
  inhaling: boolean;
}

/** Where the camera wants to lead a creature: its velocity a little ahead, plus a little of its facing (more inhaling), capped to CAMERA.MAX_OFFSET of the view */
export function lookAhead(subject: CameraSubject, short: number): { x: number; y: number } {
  if (CAMERA.LOCKED) return { x: 0, y: 0 };
  const facing = (subject.inhaling ? CAMERA.INHALE_FACING : CAMERA.FACING) * short;
  let x = subject.vx * CAMERA.LOOK_AHEAD_S + Math.cos(subject.facing) * facing;
  let y = subject.vy * CAMERA.LOOK_AHEAD_S + Math.sin(subject.facing) * facing;
  const cap = CAMERA.MAX_OFFSET * short;
  const length = Math.hypot(x, y);
  if (length > cap) {
    x *= cap / length;
    y *= cap / length;
  }
  return { x, y };
}

/** The rig itself: where it is, how fast it's moving, and its zoom (the view's short side) */
export class CameraRig {
  x = 0;
  y = 0;
  short = 0;
  private vx = 0;
  private vy = 0;
  private shortVelocity = 0;
  private leadX = 0;
  private leadY = 0;
  private ready = false;

  /** Follow `subject` for `dt` seconds (null: hold still); jumps there on the first frame or a long way off (a respawn) */
  update(subject: CameraSubject | null, dt: number): void {
    const step = Math.min(0.1, Math.max(0, dt));
    if (!subject) return;
    const short = viewShort(subject.width);
    const lead = lookAhead(subject, short);
    const smoothing = 1 - Math.exp(-CAMERA.LOOK_SMOOTH * step);
    this.leadX += (lead.x - this.leadX) * smoothing;
    this.leadY += (lead.y - this.leadY) * smoothing;
    const targetX = subject.x + this.leadX;
    const targetY = subject.y + this.leadY;
    if (!this.ready || Math.hypot(targetX - this.x, targetY - this.y) > short * 2) {
      this.x = targetX;
      this.y = targetY;
      this.vx = 0;
      this.vy = 0;
      if (!this.ready) this.short = short;
      this.ready = true;
    } else if (CAMERA.LOCKED) {
      // Pinned to the creature: it stays in the middle of the screen (the zoom still eases below)
      this.x = targetX;
      this.y = targetY;
      this.vx = 0;
      this.vy = 0;
    } else {
      const sx = springStep(this.x, this.vx, targetX, CAMERA.FOLLOW_OMEGA, step);
      const sy = springStep(this.y, this.vy, targetY, CAMERA.FOLLOW_OMEGA, step);
      this.x = sx.value;
      this.vx = sx.velocity;
      this.y = sy.value;
      this.vy = sy.velocity;
    }
    const zoom = springStep(this.short, this.shortVelocity, short, CAMERA.ZOOM_OMEGA, step);
    this.short = Math.max(zoom.value, subject.width / CAMERA.GROWTH_FRAME_SHARE_MAX);
    this.shortVelocity = zoom.velocity;
  }
}
