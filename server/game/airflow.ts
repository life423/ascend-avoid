import { INHALE, LATCH } from "../constants/gameConstants.js";
import { moveSpeed } from "./movement.js";

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

/** How much of a creature's gem drain survives at this share of its reach (0 at the mouth, 1 at the tip): all of it in the lethal inner part, fading to none at the tip */
export function lethalShare(reachShare: number): number {
  const v = Math.max(0, Math.min(1, (1 - reachShare) / LATCH.DANGER_SHARE));
  return v * v * (3 - 2 * v);
}

/** How long (seconds) an inhaler this wide takes to build full pressure on a newly caught creature */
export function pressureBuildSeconds(width: number): number {
  return LATCH.PRESSURE_BUILD_S * Math.pow(Math.max(1, width / 20), LATCH.PRESSURE_SIZE_GROWTH);
}

/** How built-up an inhale's pressure on a creature is after holding it this long (0 to 1, smooth) */
export function pressureBuild(heldSeconds: number, width: number): number {
  const v = Math.max(0, Math.min(1, heldSeconds / pressureBuildSeconds(width)));
  return v * v * (3 - 2 * v);
}

/** From a creature's middle, how far out its airflow is lethal (the inner LATCH.DANGER_SHARE of its reach, past its mouth) */
export function dangerRadius(width: number): number {
  return width * 0.8 + LATCH.DANGER_SHARE * (INHALE.REACH + width * INHALE.REACH_PER_SIZE);
}

/** How far around a creature this wide must be visible to see a bigger one (CAMERA.THREAT_RATIO) coming in time (CAMERA.REACTION_S) */
export function threatHorizon(width: number, ratio: number, reactionSeconds: number): number {
  const predator = width * ratio;
  return dangerRadius(predator) + moveSpeed(predator) * reactionSeconds;
}

/** What a latch's stream looks like comes only from these airflow numbers */
export interface StreamState {
  quality: number; // the latch's airflow quality
  beamQuality: number; // the beam quality that counts for breath (0 unless owned, stable, uncontested)
  clean: number; // how clear the air between the bodies is (overlap smothers it)
  mine: number; // this side's latch score
  theirs: number; // the other side's, when they're inhaling this one back (0 otherwise)
  fraying: number; // how fast the connection is falling apart (0 when steady)
}

/**
 * The stream's look, straight from the airflow (so the picture can't lie): coherence is the airflow
 * quality; turbulence comes from poor quality, fraying and overlap; density from how efficient the
 * beam is on breath (recharging when it refills); and between two inhaling each other, the share of
 * the way across where their flows meet (1: this side's stream reaches all the way).
 */
export function streamLook(state: StreamState): { coherence: number; turbulence: number; efficiency: number; recharging: boolean; boundary: number } {
  // Coherence is the focus curve on airflow quality (the same as the server's beam focus)
  const focusing = clamp01((state.quality - LATCH.BEAM_FOCUS_FROM) / (LATCH.BEAM_FULL_AT - LATCH.BEAM_FOCUS_FROM));
  const coherence = focusing * focusing * (3 - 2 * focusing);
  const rate = breathRate(state.beamQuality, 0) * INHALE.MAX_MS;
  const total = state.mine + state.theirs;
  return {
    coherence,
    turbulence: clamp01(1 - coherence + state.fraying * 1.5 + (1 - state.clean) * 0.8),
    efficiency: clamp01(1 + rate),
    recharging: rate > 0,
    boundary: state.theirs <= 0 ? 1 : total > 1e-6 ? state.mine / total : 0.5,
  };
}

/** Scale separation: how much of its drain an attacker this wide gets on a target this wide (full unless it's tiny by comparison, then a mosquito) */
export function scaleDrain(attackerWidth: number, targetWidth: number): number {
  const ratio = attackerWidth / Math.max(1, targetWidth);
  const v = Math.max(0, Math.min(1, (ratio - LATCH.SCALE_MIN_RATIO) / (LATCH.SCALE_FULL_RATIO - LATCH.SCALE_MIN_RATIO)));
  return LATCH.SCALE_MIN + (1 - LATCH.SCALE_MIN) * v * v * (3 - 2 * v);
}
