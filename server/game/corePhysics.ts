import { ARENA_RULES, CORE, INHALE } from "../constants/gameConstants.js";

/**
 * Core physics, shared by the server and browsers (so a browser can predict it the same way).
 * Every tick: forces -> acceleration -> velocity -> position. Inhale only ever applies force: there
 * is no hold, orbit, swing or throw state, and no owner. Those all come out of the same forces.
 */

/** A Core's body: its middle, velocity and radius */
export interface CoreBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
}

/** A creature as the airflow sees it: its middle, width, facing, whether it's inhaling, and how it's moving */
export interface Inhaler {
  x: number;
  y: number;
  width: number;
  facing: number;
  inhaling: boolean;
  vx?: number;
  vy?: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/** How hard a creature this wide pulls on a Core, next to a newborn (bigger pulls harder, up to CORE.PULL_MAX) */
export function corePull(width: number): number {
  return Math.min(CORE.PULL_MAX, Math.pow(Math.max(1, width / ARENA_RULES.PLAYER_SIZE), CORE.PULL_GROWTH));
}

/**
 * Where an inhaler's airflow balances on a Core along the direction (ux, uy) from its middle:
 * (body radius + Core radius) times a multiple, larger in front of the mouth than beside the body
 */
export function equilibriumDistance(inhaler: Inhaler, core: CoreBody, ux: number, uy: number): number {
  const frontness = Math.max(0, ux * Math.cos(inhaler.facing) + uy * Math.sin(inhaler.facing));
  const multiple = CORE.SIDE_MULTIPLIER + (CORE.FRONT_MULTIPLIER - CORE.SIDE_MULTIPLIER) * frontness;
  return (inhaler.width / 2 + core.radius) * multiple;
}

/**
 * The acceleration one inhaler's airflow puts on a Core, and how compressed the air between them is
 * (0 to 1, for drawing). Suction toward the mouth over the Core's own reach (measured to its near
 * edge), times how much of the Core is in the airflow (its whole width counts, not just its middle).
 * Near the body, the part of that air the body blocks (the inward part) fades smoothly to nothing at
 * the equilibrium distance and is turned to flow round the body the way it was already going
 * (toward the mouth): no target angle, nothing dead ahead. Inside that distance, compressed air pushes
 * the Core back out along the line from the body, damped on that line only, so sideways momentum is
 * kept and no energy is added. Turning or moving shifts where the mouth is, and so the airflow.
 */
export function airflowOnCore(inhaler: Inhaler, core: CoreBody): { ax: number; ay: number; pressure: number } {
  const none = { ax: 0, ay: 0, pressure: 0 };
  if (!inhaler.inhaling) return none;
  const dx = core.x - inhaler.x;
  const dy = core.y - inhaler.y;
  const d = Math.hypot(dx, dy);
  if (d < 1e-6) return none;
  const ux = dx / d;
  const uy = dy / d;
  const fx = Math.cos(inhaler.facing);
  const fy = Math.sin(inhaler.facing);
  const equilibrium = equilibriumDistance(inhaler, core, ux, uy);
  const zone = equilibrium * CORE.FALLOFF;
  const strength = corePull(inhaler.width) / CORE.MASS;
  let ax = 0;
  let ay = 0;
  let pressure = 0;
  const mouthX = inhaler.x + fx * inhaler.width * 0.3;
  const mouthY = inhaler.y + fy * inhaler.width * 0.3;
  const mx = mouthX - core.x;
  const my = mouthY - core.y;
  const md = Math.hypot(mx, my);
  const reach = CORE.REACH + inhaler.width * CORE.REACH_PER_SIZE;
  const gap = Math.max(0, md - core.radius);
  if (md > 1e-6 && gap < reach) {
    // The arc widens near the body, where the air wraps round it
    const near = clamp01(1 - (d - equilibrium) / (zone * CORE.NEAR_SPAN));
    const arc = ((INHALE.ARC + (CORE.NEAR_ARC - INHALE.ARC) * near) * Math.PI) / 180;
    // How much of the Core (its whole width, seen from the mouth) is inside that arc
    const halfWidth = Math.asin(Math.min(1, core.radius / Math.max(md, core.radius)));
    const off = Math.acos(Math.max(-1, Math.min(1, (-mx * fx - my * fy) / md)));
    const exposure = clamp01((arc + halfWidth - off) / (2 * halfWidth));
    const pull = CORE.SUCTION * strength * exposure * Math.pow(1 - gap / reach, CORE.FALLOFF_POWER);
    let px = (mx / md) * pull;
    let py = (my / md) * pull;
    const inward = px * ux + py * uy;
    if (pull > 1e-9 && inward < 0) {
      // Near the body, the inward part (the air the body is in the way of) fades out...
      const divert = smooth(clamp01((d - equilibrium) / zone));
      const blocked = -inward * (1 - divert);
      px += ux * blocked;
      py += uy * blocked;
      // ...and flows round the body instead, the way that air was already going
      const sideX = px - (px * ux + py * uy) * ux;
      const sideY = py - (px * ux + py * uy) * uy;
      const side = Math.hypot(sideX, sideY);
      if (side > 1e-9) {
        const turned = blocked * Math.min(1, (CORE.DEFLECT * side) / pull);
        px += (sideX / side) * turned;
        py += (sideY / side) * turned;
      }
      pressure = Math.max(pressure, exposure * (1 - divert) * 0.6);
    }
    ax += px;
    ay += py;
  }
  // The cushion of air near the body is only where the airflow is: full across your front half, fading to nothing behind you
  const inFlow = clamp01(ux * fx + uy * fy + 0.5);
  if (d < equilibrium + zone && inFlow > 0) {
    // In the pressure zone: motion toward or away from the body (only that, and relative to it, so a Core can follow you) is damped
    const radial = (core.vx - (inhaler.vx ?? 0)) * ux + (core.vy - (inhaler.vy ?? 0)) * uy;
    const damping = CORE.RADIAL_DAMPING * clamp01(1 - (d - equilibrium) / zone) * inFlow;
    ax -= ux * radial * damping;
    ay -= uy * radial * damping;
  }
  if (d < equilibrium && inFlow > 0) {
    // Inside the equilibrium distance: compressed air pushes it back out
    const squeeze = (equilibrium - d) / equilibrium;
    const push = CORE.NEAR_FIELD * strength * squeeze * inFlow;
    ax += ux * push;
    ay += uy * push;
    pressure = Math.max(pressure, Math.min(1, 0.6 + squeeze * 2));
  }
  return { ax, ay, pressure };
}

/** One tick for a Core: acceleration, drag, its own top speed, then movement, bouncing off the arena's edges */
export function stepCore(core: CoreBody, ax: number, ay: number, deltaTime: number, worldWidth: number, worldHeight: number): void {
  core.vx += ax * deltaTime;
  core.vy += ay * deltaTime;
  const keep = Math.exp(-CORE.DRAG * deltaTime);
  core.vx *= keep;
  core.vy *= keep;
  const speed = Math.hypot(core.vx, core.vy);
  if (speed > CORE.MAX_SPEED) {
    core.vx *= CORE.MAX_SPEED / speed;
    core.vy *= CORE.MAX_SPEED / speed;
  }
  core.x += core.vx * deltaTime;
  core.y += core.vy * deltaTime;
  if (core.x < core.radius) {
    core.x = core.radius;
    core.vx = Math.abs(core.vx) * CORE.WALL_RESTITUTION;
  } else if (core.x > worldWidth - core.radius) {
    core.x = worldWidth - core.radius;
    core.vx = -Math.abs(core.vx) * CORE.WALL_RESTITUTION;
  }
  if (core.y < core.radius) {
    core.y = core.radius;
    core.vy = Math.abs(core.vy) * CORE.WALL_RESTITUTION;
  } else if (core.y > worldHeight - core.radius) {
    core.y = worldHeight - core.radius;
    core.vy = -Math.abs(core.vy) * CORE.WALL_RESTITUTION;
  }
}

/** How long a Core hit with this momentum (MASS x the speed it comes at you) stuns for: 0 below the threshold */
export function impactStunMs(momentum: number): number {
  if (momentum < CORE.STUN_MOMENTUM) return 0;
  const k = Math.min(1, (momentum - CORE.STUN_MOMENTUM) / (CORE.STUN_FULL_MOMENTUM - CORE.STUN_MOMENTUM));
  return CORE.STUN_MIN_MS + (CORE.STUN_MAX_MS - CORE.STUN_MIN_MS) * k;
}

/** A creature's mass next to a newborn's: (its width / a newborn's) squared */
export function bodyMass(width: number): number {
  const scale = width / ARENA_RULES.PLAYER_SIZE;
  return scale * scale;
}
