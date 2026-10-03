import { INHALE, LATCH } from "../constants/gameConstants.js";

/**
 * Player-vs-player airflow, shared by the server and browsers: one airflow quality from geometry,
 * and what follows from it (latch size factor, breath while a beam holds).
 */

/** A body: its middle and width */
export interface Body {
  x: number;
  y: number;
  width: number;
}

/** A body with a mouth: which way it faces */
export interface Mouthed extends Body {
  facing: number;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** How clear the air between two bodies is: 1 apart, falling to 0 as they overlap deeply (LATCH.OVERLAP_SMOTHER) */
export function cleanAir(a: Body, b: Body): number {
  const overlap = (a.width + b.width) / 2 - Math.hypot(b.x - a.x, b.y - a.y);
  if (overlap <= 0) return 1;
  return clamp01(1 - overlap / (LATCH.OVERLAP_SMOTHER * Math.min(a.width, b.width)));
}

/**
 * How clean `attacker`'s airflow onto `target` is (0 to 1): how much of the target is inside the
 * inhale's arc (its own width counts), how close it is within reach, how squarely in front of the
 * body, and how clear the air between them (deep overlap smothers it). Centered, in front, close
 * with clean separation approaches 1.
 */
export function airflowQuality(attacker: Mouthed, target: Body): number {
  const fx = Math.cos(attacker.facing);
  const fy = Math.sin(attacker.facing);
  const mouthX = attacker.x + fx * attacker.width * 0.3;
  const mouthY = attacker.y + fy * attacker.width * 0.3;
  const mx = target.x - mouthX;
  const my = target.y - mouthY;
  const md = Math.hypot(mx, my);
  const radius = target.width / 2;
  const reach = INHALE.REACH + attacker.width * INHALE.REACH_PER_SIZE;
  const gap = Math.max(0, md - radius);
  if (gap > reach) return 0;
  const halfWidth = Math.asin(Math.min(1, radius / Math.max(md, radius)));
  const arc = (INHALE.ARC * Math.PI) / 180;
  const off = md > 1e-6 ? Math.acos(Math.max(-1, Math.min(1, (mx * fx + my * fy) / md))) : 0;
  const alignment = clamp01((arc + halfWidth - off) / (arc + halfWidth));
  const cx = target.x - attacker.x;
  const cy = target.y - attacker.y;
  const cd = Math.hypot(cx, cy);
  const frontness = cd > 1e-6 ? Math.max(0, (cx * fx + cy * fy) / cd) : 0;
  return alignment * Math.sqrt(1 - gap / reach) * Math.sqrt(frontness) * cleanAir(attacker, target);
}

/** Size's mild say in a latch: sqrt(attacker width / target width), kept within LATCH.SIZE_MIN..SIZE_MAX */
export function latchSizeFactor(attackerWidth: number, targetWidth: number): number {
  return Math.min(LATCH.SIZE_MAX, Math.max(LATCH.SIZE_MIN, Math.sqrt(attackerWidth / Math.max(1, targetWidth))));
}

/**
 * How fast breath changes while inhaling (share of a full breath per ms), by the quality of the
 * focused beam you hold (0 for a wide cone): normal use, then less, then none, then a slow refill,
 * never past LATCH.BEAM_RECHARGE_CAP
 */
export function breathRate(beamQuality: number, stamina: number): number {
  const use = 1 / INHALE.MAX_MS;
  if (beamQuality <= LATCH.BEAM_EFFICIENT_FROM) return -use;
  if (beamQuality < LATCH.BEAM_NEUTRAL_AT) {
    return -use * (1 - (beamQuality - LATCH.BEAM_EFFICIENT_FROM) / (LATCH.BEAM_NEUTRAL_AT - LATCH.BEAM_EFFICIENT_FROM));
  }
  if (stamina >= LATCH.BEAM_RECHARGE_CAP) return 0;
  return (beamQuality - LATCH.BEAM_NEUTRAL_AT) / (1 - LATCH.BEAM_NEUTRAL_AT) / LATCH.BEAM_RECHARGE_MS;
}
