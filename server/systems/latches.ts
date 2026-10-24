import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { airflowQuality, latchSizeFactor } from "../game/airflow.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { PLAYER_STATE, INHALE, LATCH } = GAME_CONSTANTS;

/**
 * Player airflow connections: each inhaler's airflow quality on every creature, smoothed for
 * stability. A clean enough one catches a latch, held through brief slips (a little sideways step
 * doesn't lose it), broken by turning well away, distance or a stun. Between two inhaling each
 * other only one side owns the focused connection (hysteresis; from a near tie, neither). The owner
 * gets a gentle aim toward its target (through its own turning), its cone focuses into a stream,
 * and once that holds cleanly, its breath is used less, then refilled (game/airflow breathRate).
 */
export function updateLatches(state: GameState, now: number, deltaTime: number) : void {
  const smoothing = Math.min(1, deltaTime * LATCH.SMOOTHING);
  state.players.forEach((attacker) => {
    if (!attacker.inhaling || attacker.state !== PLAYER_STATE.ALIVE || attacker.stunned) {
      attacker.dropLatch();
      attacker.airQuality.clear();
      return;
    }
    const from = state.mouthed(attacker);
    let best: PlayerSchema | null = null;
    let bestQuality = 0;
    state.players.forEach((target) => {
      const id = target.sessionId;
      if (target === attacker || target.state !== PLAYER_STATE.ALIVE || target.spawnProtected || target.capturedBy || target.flying || now < target.suctionSafeUntil) {
        attacker.airQuality.delete(id);
        return;
      }
      // (the latched creature is judged along the beam, which can bend the more focused it is)
      const raw = airflowQuality(from, state.bodyOf(target), id === attacker.latchTarget ? LATCH.CURVE_ARC * attacker.beamFocus : 0);
      const was = attacker.airQuality.get(id) ?? 0;
      const quality = was + (raw - was) * smoothing;
      if (quality < 0.005 && raw === 0) attacker.airQuality.delete(id);
      else attacker.airQuality.set(id, quality);
      if (quality > bestQuality) {
        bestQuality = quality;
        best = target;
      }
    });
    const current = attacker.latchTarget ? state.players.get(attacker.latchTarget) : undefined;
    if (attacker.latchTarget && (!current || current.state !== PLAYER_STATE.ALIVE)) attacker.dropLatch();
    else if (current) {
      const holds = (attacker.airQuality.get(current.sessionId) ?? 0) >= LATCH.KEEP_QUALITY && latchInRange(state, attacker, current);
      if (holds) attacker.latchLostAt = 0;
      else if (!attacker.latchLostAt) attacker.latchLostAt = now;
      else if (now - attacker.latchLostAt > LATCH.MEMORY_MS) attacker.dropLatch();
    }
    const chosen = best as PlayerSchema | null;
    if (chosen && bestQuality >= LATCH.ACQUIRE_QUALITY && chosen.sessionId !== attacker.latchTarget) {
      // A new latch, or a clearly better one
      const held = attacker.latchTarget ? attacker.airQuality.get(attacker.latchTarget) ?? 0 : 0;
      if (!attacker.latchTarget || bestQuality > held * (1 + LATCH.HYSTERESIS)) {
        attacker.dropLatch();
        attacker.latchTarget = chosen.sessionId;
        attacker.latchSince = now;
      }
    }
    const target = attacker.latchTarget ? state.players.get(attacker.latchTarget) : undefined;
    attacker.latchScore = target ? (attacker.airQuality.get(target.sessionId) ?? 0) * latchSizeFactor(attacker.width, target.width) : 0;
  });
  // Who owns the focused connection (decided on last tick's owners, so the order doesn't matter)
  state.players.forEach((attacker) => {
    const target = attacker.latchTarget ? state.players.get(attacker.latchTarget) : undefined;
    let owns = !!target;
    if (target && target.latchTarget === attacker.sessionId) {
      const mine = attacker.latchScore;
      const theirs = target.latchScore;
      if (attacker.focused) owns = theirs <= mine * (1 + LATCH.HYSTERESIS);
      else if (target.focused) owns = mine > theirs * (1 + LATCH.HYSTERESIS);
      else owns = mine > theirs * (1 + LATCH.TIE);
    }
    attacker.focusNext = owns;
  });
  state.players.forEach((attacker) => {
    const target = attacker.latchTarget ? state.players.get(attacker.latchTarget) : undefined;
    attacker.focused = !!target && attacker.focusNext;
    const latchQuality = target ? attacker.airQuality.get(target.sessionId) ?? 0 : 0;
    const quality = target && attacker.focused ? latchQuality : 0;
    // A contested connection (inhaling each other) only saves breath as this side wins the counterflow
    let contest = 1;
    if (target && target.inhaling && target.latchTarget === attacker.sessionId) {
      const total = attacker.latchScore + target.latchScore;
      contest = total > 1e-6 ? Math.max(0, Math.min(1, (attacker.latchScore / total - 0.5) * 2)) : 0;
    }
    const focus = target && attacker.focused ? Math.min(1, Math.max(0, (quality - LATCH.BEAM_FOCUS_FROM) / (LATCH.BEAM_FULL_AT - LATCH.BEAM_FOCUS_FROM))) : 0;
    const beam = target && attacker.focused && now - attacker.latchSince >= LATCH.BEAM_STABLE_MS ? quality * contest : 0;
    const pull = target && attacker.focused ? attacker.latchScore : 0;
    const round = (v: number) => Math.round(v * 100) / 100;
    if (attacker.beamFocus !== round(focus)) attacker.beamFocus = round(focus);
    if (attacker.beamQuality !== round(beam)) attacker.beamQuality = round(beam);
    if (attacker.latchPull !== round(pull)) attacker.latchPull = round(pull);
    if (attacker.latchQuality !== round(latchQuality)) attacker.latchQuality = round(latchQuality);
    if (target && pull > 0) {
      const dx = target.x + target.width / 2 - (attacker.x + attacker.width / 2);
      const dy = target.y + target.height / 2 - (attacker.y + attacker.height / 2);
      const d = Math.max(1e-6, Math.hypot(dx, dy));
      attacker.assistX = (dx / d) * LATCH.ASSIST * pull;
      attacker.assistY = (dy / d) * LATCH.ASSIST * pull;
    } else {
      attacker.assistX = 0;
      attacker.assistY = 0;
    }
  });
}

/** Whether a latch can still hold: the target within LATCH.BREAK_ANGLE of the attacker's facing and LATCH.RANGE of its reach */
export function latchInRange(_state: GameState, attacker: PlayerSchema, target: PlayerSchema) : boolean {
  const dx = target.x + target.width / 2 - (attacker.x + attacker.width / 2);
  const dy = target.y + target.height / 2 - (attacker.y + attacker.height / 2);
  const d = Math.hypot(dx, dy);
  const reach = INHALE.REACH + attacker.width * INHALE.REACH_PER_SIZE;
  if (d - (attacker.width + target.width) / 2 > reach * LATCH.RANGE) return false;
  if (d < 1e-6) return true;
  const angle = Math.min(170, LATCH.BREAK_ANGLE + LATCH.CURVE_ARC * attacker.beamFocus);
  return (dx * Math.cos(attacker.facing) + dy * Math.sin(attacker.facing)) / d >= Math.cos((angle * Math.PI) / 180);
}
