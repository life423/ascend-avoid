import { ARENA_RULES, CAMERA } from "../constants/gameConstants.js";
import { threatHorizon } from "./airflow.js";

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
  return Math.max(width / share, 2 * threatHorizon(width, CAMERA.THREAT_RATIO, CAMERA.REACTION_S));
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
    } else {
      const sx = springStep(this.x, this.vx, targetX, CAMERA.FOLLOW_OMEGA, step);
      const sy = springStep(this.y, this.vy, targetY, CAMERA.FOLLOW_OMEGA, step);
      this.x = sx.value;
      this.vx = sx.velocity;
      this.y = sy.value;
      this.vy = sy.velocity;
    }
    const zoom = springStep(this.short, this.shortVelocity, short, CAMERA.ZOOM_OMEGA, step);
    this.short = zoom.value;
    this.shortVelocity = zoom.velocity;
  }
}
