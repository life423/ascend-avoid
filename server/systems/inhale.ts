import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { airflowQuality, bodyPullScale, cleanAir, drainRamp, innerBodyPullBoost, lethalShare, pressureBuildSeconds, retreatPull, scaleDrain } from "../game/airflow.js";
import { moveSpeed } from "../game/movement.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

import { CANNON, EXHALE } from "../constants/gameConstants.js";
import { canCatch, launchSpeed, captureHoldMs, shooterMassContribution, captureGrowthTransfer } from "../game/cannon.js";
import { GustWaveSchema } from '../schema/GustWaveSchema.js';
import { bodyMass } from '../game/creatureSize.js';

const { PLAYER_STATE, INHALE, LATCH } = GAME_CONSTANTS;
import { sprayGems } from "./gems.js";
import { puffWeaponParts } from "./weapons.js";
import { stealCapturedPart } from './weaponTheft.js';
import { theftWindowAllows } from '../game/injuryTheft.js';
import { groupPressureScale } from '../game/groupPressure.js';
import { puffImpulses } from '../game/puffImpulse.js';

/** Finish once: transfer remaining value, then emit visual-only reward/shatter data. */
export function finishWithReward(state: GameState, target: PlayerSchema, byId: string, now: number, how: 'mouth' | 'cannon' | 'blackhole', core?: { x: number; y: number }): number {
  if (target.state !== PLAYER_STATE.ALIVE) return 0;
  const gems = target.gems, x = target.x + target.width / 2, y = target.y + target.height / 2;
  const size = target.width, facing = target.facing;
  clearCapture(state, target.sessionId, now);
  target.setGems(0, state.worldWidth, state.worldHeight);
  target.land(); target.knockOut(now);
  state.clearTheftFor(target.sessionId);
  const recipient = state.players.get(byId);
  const earned = recipient && recipient !== target ? gems : 0;
  if (recipient && recipient !== target) {
    if (recipient.state === PLAYER_STATE.ALIVE) recipient.setGems(recipient.gems + earned, state.worldWidth, state.worldHeight);
    else recipient.pendingCombatGems += earned;
    if (how === 'mouth') { recipient.stolenTotal += earned; target.robbedTotal += earned; }
  } else if (gems > 0) sprayGems(state, x, y, gems, now, target.sessionId);
  state.onEvent?.('combatReward', { eventId: `${target.sessionId}:${state.nextCombatRewardId++}`, byId, targetId: target.sessionId,
    how, gems, earned, x, y, size, facing, playerIndex: target.playerIndex, ...(core ? { holeX: core.x, holeY: core.y } : {}) });
  return earned;
}

/** Knocked out: any last gems burst out where the player was */
export function knockOutWithGems(state: GameState, player: PlayerSchema, now: number) : void {
  const left = player.gems;
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  if (left > 0) player.setGems(0, state.worldWidth, state.worldHeight);
  player.knockOut(now);
  state.clearTheftFor(player.sessionId);
  if (left > 0) sprayGems(state, centerX, centerY, left, now, player.sessionId);
}

/**
 * Inhaling: everything in a cone in front of the creature's mouth. Gems are pulled in and
 * swallowed; a bomb stays in the mouth (safe until it's spat). Injured creatures can be robbed;
 * healthy creatures can still be pulled bodily toward the mouth by mass. One 1.3 times
 * narrower or more is caught there (see CANNON: escape, launch).
 */
export function updateInhales(state: GameState, now: number, deltaTime: number) : void {
  // Resolve continuation validity before outgoing effects: player iteration order must
  // not let an expired-but-continuously-drained giant counter-capture for one tick.
  pruneTheftContinuations(state, now);
  const cone = Math.cos((INHALE.ARC * Math.PI) / 180);
  updateHolds(state, now);
  const pulls = new Map<PlayerSchema, { eater: PlayerSchema; x: number; y: number; speed: number }[]>();
  state.players.forEach((eater) => {
    if (!eater.inhaling || eater.state !== PLAYER_STATE.ALIVE) {
      eater.theftContinuations.clear();
      if (eater.stealingFrom) endTheft(state, eater, now);
      if (eater.robbing) eater.robbing = "";
      fadeLocks(state, eater, null, deltaTime);
      return;
    }
    if (injuryVulnerable(state, eater, now)) { eater.stopInhale(now); eater.dropLatch(); return; }
    const fx = Math.cos(eater.facing);
    const fy = Math.sin(eater.facing);
    const mouthX = eater.x + eater.width / 2 + fx * eater.width * 0.3;
    const mouthY = eater.y + eater.height / 2 + fy * eater.width * 0.3;
    const reach = INHALE.REACH + eater.width * INHALE.REACH_PER_SIZE;
    /** How far (x, y) is from the mouth, if it's in the cone and within reach (else -1) */
    const inCone = (x: number, y: number, extra = 0): number => {
      const dx = x - mouthX;
      const dy = y - mouthY;
      const d = Math.hypot(dx, dy);
      if (d > reach + extra) return -1;
      if (d < 1) return d;
      return (dx * fx + dy * fy) / d >= cone ? d : -1;
    };
    state.gems.forEach((gem) => {
      const d = inCone(gem.x, gem.y);
      if (d < 1) return;
      const step = Math.min(d, INHALE.PULL_GEMS * deltaTime);
      gem.moveTo(gem.x + ((mouthX - gem.x) / d) * step, gem.y + ((mouthY - gem.y) / d) * step);
    });
    if (!eater.mouth) {
      state.bombs.forEach((bomb) => {
        if (bomb.heldBy || bomb.respawnAt || eater.mouth) return;
        const d = inCone(bomb.x, bomb.y);
        if (d < 0) return;
        if (d <= eater.width * 0.35 + bomb.radius) {
          // A lit bomb keeps ticking in your mouth
          bomb.hold(eater.sessionId);
          eater.mouth = bomb.lit() ? "lit" : "bomb";
          return;
        }
        const step = Math.min(d, INHALE.PULL_BOMBS * deltaTime);
        bomb.placeAt(bomb.x + ((mouthX - bomb.x) / d) * step, bomb.y + ((mouthY - bomb.y) / d) * step);
      });
    }
    // Every creature in the cone is pulled bodily toward the mouth, by mass: harder the heavier the
    // inhaler is next to it (a giant drags a newborn; a newborn barely moves a giant), the closer it
    // is and the more squarely in front, but never past what it can get away from. One small enough
    // to capture is caught once it's held right at the mouth (see CANNON).
    let held: PlayerSchema | null = null;
    let heldAt = Infinity;
    const locked = new Set<string>();
    state.players.forEach((prey) => {
      if (prey === eater || prey.state !== PLAYER_STATE.ALIVE || prey.spawnProtected || now < prey.suctionSafeUntil) return;
      const alignment = stealWeight(state, eater, prey);
      if (alignment <= 0) return;
      // A clear tug starts immediately; sustained aim builds toward the strongest pull
      // (a bigger inhaler's airflow takes longer to establish)
      const lock = Math.min(1, (eater.lockOn.get(prey.sessionId) ?? 0) + deltaTime / ((INHALE.LOCK_MS / 1000) * (pressureBuildSeconds(eater.width) / LATCH.PRESSURE_BUILD_S)));
      eater.lockOn.set(prey.sessionId, lock);
      // The drain ramp builds only on clean airflow; smothered (deep overlap) or poorly aimed, it fades
      const heldTime = eater.heldFor.get(prey.sessionId) ?? 0;
      // A flier, or another creature's captive, is out of reach
      // (a captive is held by holdCaptive, not pulled)
      if (prey.flying || prey.capturedBy) return;
      const clean = airflowQuality(state.mouthed(eater), state.bodyOf(prey), eater.latchTarget === prey.sessionId ? LATCH.CURVE_ARC * eater.beamFocus : 0) >= LATCH.RAMP_MIN_QUALITY;
      eater.heldFor.set(prey.sessionId, clean ? heldTime + deltaTime : Math.max(0, heldTime - deltaTime * LATCH.RAMP_FADE));
      locked.add(prey.sessionId);
      const px = prey.x + prey.width / 2;
      const py = prey.y + prey.height / 2;
      const d = Math.hypot(px - mouthX, py - mouthY);
      // A capture needs the size and the prey at the mouth, in front of it: pressed against the mouth counts
      // (body contact smothers the airflow, but it mustn't stop a catch)
      if (!injuryVulnerable(state, eater, now) && now >= prey.recaptureAfter && canCatch(eater.width, prey.width) && d <= eater.width * (injuryVulnerable(state, prey, now) ? INHALE.FINISH_MOUTH_REACH : INHALE.CAPTURE_REACH) + prey.width / 2 && d < heldAt && inFrontOf(eater, px, py)) {
        held = prey;
        heldAt = d;
      }
      if (d < 1) return;
      const gap = Math.max(0, d - prey.width / 2);
      const mass = Math.min(INHALE.BODY_PULL_MAX, eater.width / prey.width);
      const near = Math.max(0, 1 - gap / reach);
      // Much stronger in the last stretch before the mouth
      const close = Math.max(0, 1 - gap / (reach * INHALE.CLOSE_RANGE));
      const lockPull = INHALE.LOCK_START + (1 - INHALE.LOCK_START) * lock * lock;
      const strength = INHALE.BODY_PULL * mass * near * (1 + INHALE.CLOSE_BOOST * close) * alignment * lockPull;
      // Early retreat can beat outer suction. The inner-zone boost grows smoothly with size advantage;
      // crossing healthy capture eligibility alone grants no abrupt extra force.
      const speed = moveSpeed(prey.width);
      let pullSpeed = Math.min(strength, INHALE.PREY_PULL_CAP * near * speed);
      if (close > 0) {
        const farCap = INHALE.PREY_PULL_CAP * near;
        const overpower = speed * (farCap + (INHALE.PREY_PULL_CLOSE - farCap) * Math.sqrt(close)) * alignment;
        pullSpeed += Math.max(0, overpower - pullSpeed) * innerBodyPullBoost(eater.width, prey.width);
      }
      // Apply after both caps: the inner zone must not erase a near-sized creature's resistance.
      // Much smaller prey retain the full inner pull, even though they walk faster.
      pullSpeed *= bodyPullScale(eater.width, prey.width);
      const velocity = prey.velocity();
      const intent = prey.stunned ? { x: 0, y: 0 } : prey.steerInput();
      const away = Math.min(1, Math.max(0, (velocity.x * (px - mouthX) + velocity.y * (py - mouthY)) / (d * speed), (intent.x * (px - mouthX) + intent.y * (py - mouthY)) / d));
      // An intentional retreat can overcome a peer's tractor pull. A larger mouth
      // retains its size advantage, especially in the close capture zone.
      pullSpeed *= 1 - Math.min(1, prey.width / eater.width) * away;
      const across = Math.min(1, Math.abs(velocity.x * (mouthY - py) - velocity.y * (mouthX - px)) / (d * speed));
      pullSpeed *= 1 - INHALE.BODY_STRAFE_ESCAPE * across;
      const intentAway = (intent.x * (px - mouthX) + intent.y * (py - mouthY)) / d;
      pullSpeed = retreatPull(pullSpeed, eater.width, prey.width, gap, reach, intentAway);
      const pull = Math.min(d, pullSpeed * deltaTime);
      const forces = pulls.get(prey) ?? [];
      forces.push({ eater, x: ((mouthX - px) / d) * pull, y: ((mouthY - py) / d) * pull, speed: pull });
      pulls.set(prey, forces);
    });
    fadeLocks(state, eater, locked, deltaTime);
    // Snapshot before growth changes: capture remains valid until firing or release.
    const caught = held as PlayerSchema | null;
    if (caught && !eater.gulping && !injuryVulnerable(state, eater, now)) {
      if (injuryVulnerable(state, caught, now)) {
        const gems = caught.gems;
        finishWithReward(state, caught, eater.sessionId, now, 'mouth');
        state.credit(caught, 'mouth', now, eater.sessionId, { out: true, gems });
        return;
      }
      eater.gulping = caught.sessionId;
      eater.captureStartedAt = now;
      caught.captureRatio = eater.width / caught.width;
      caught.captureHoldMs = captureHoldMs(eater.width, caught.width);
      eater.gulpEndsAt = state.time + caught.captureHoldMs;
      eater.captureNeedsRelease = true;
      caught.capturedBy = eater.sessionId;
      state.clearTheftFor(caught.sessionId); state.clearTheftFor(eater.sessionId);
      const amount = captureGrowthTransfer(caught.gems, state.worldWidth, state.worldHeight);
      caught.setGems(caught.gems - amount, state.worldWidth, state.worldHeight);
      eater.setGems(eater.gems + amount, state.worldWidth, state.worldHeight);
      eater.stolenTotal += amount; caught.robbedTotal += amount;
      stealCapturedPart(state, eater, caught);
      caught.stopInhale(now);
      caught.dropLatch();
      // The capture decides what happens to it now: any theft from it ends here
      eater.stealShares.delete(caught.sessionId);
      if (eater.stealingFrom === caught.sessionId) endTheft(state, eater, now);
      eater.stopInhale(now);
      state.onEvent?.("capture", { byId: eater.sessionId, targetId: caught.sessionId });
    }
    // A mouth holding a captive drains nobody (the capture decides what happens to it); an empty one robs
    if (eater.gulping) {
      if (eater.stealingFrom) endTheft(state, eater, now);
      if (eater.robbing) eater.robbing = "";
    }
  });
  // Resolve body pressure together, so several mouths cannot add unbounded displacement.
  for (const [prey, forces] of pulls) {
    if (prey.state !== PLAYER_STATE.ALIVE || prey.capturedBy || prey.flying || prey.spawnProtected || now < prey.suctionSafeUntil) continue;
    const valid = forces.filter(f => f.eater.state === PLAYER_STATE.ALIVE && f.eater.inhaling && !f.eater.gulping && !f.eater.capturedBy && !f.eater.flying);
    const scale = groupPressureScale(valid.map(f => f.speed));
    prey.nudge(valid.reduce((n,f) => n+f.x,0)*scale, valid.reduce((n,f) => n+f.y,0)*scale, state.worldWidth, state.worldHeight);
  }
  // Freeze valid rates before transfers change body sizes; every actor shares the same snapshot.
  const plan = planTheft(state, now);
  state.players.forEach(eater => steal(state, eater, now, deltaTime, plan));
  syncContinuedTheft(state, now);
}

/** Locks on creatures no longer held (or every lock, when `keep` is null) fade fast: out of the cone, out of danger */
export function fadeLocks(_state: GameState, eater: PlayerSchema, keep: Set<string> | null, deltaTime: number) : void {
  for (const [id, lock] of eater.lockOn) {
    if (keep?.has(id)) continue;
    const left = lock - (deltaTime * 1000) / INHALE.LOCK_DECAY_MS;
    if (left <= 0) eater.lockOn.delete(id);
    else eater.lockOn.set(id, left);
  }
  for (const [id, held] of eater.heldFor) {
    if (keep?.has(id)) continue;
    const left = held - deltaTime * INHALE.HOLD_DECAY;
    if (left <= 0) eater.heldFor.delete(id);
    else eater.heldFor.set(id, left);
  }
}

/**
 * How squarely `victim` sits in `thief`'s inhale: 0 when no part of it is in the cone, up to 1
 * dead center (or right against the mouth). The drain is shared out by state.
 */
export function stealWeight(state: GameState, thief: PlayerSchema, victim: PlayerSchema) : number {
  if (thief.breathingBlocked || !thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || victim.state !== PLAYER_STATE.ALIVE || victim.spawnProtected) return 0;
  if (state.now < victim.suctionSafeUntil) return 0;
  const fx = Math.cos(thief.facing);
  const fy = Math.sin(thief.facing);
  const dx = victim.x + victim.width / 2 - (thief.x + thief.width / 2 + fx * thief.width * 0.3);
  const dy = victim.y + victim.height / 2 - (thief.y + thief.height / 2 + fy * thief.width * 0.3);
  const d = Math.hypot(dx, dy);
  const radius = victim.width / 2;
  // Touching it across your front: the inhale grabs it, no aiming needed
  // ...and a focused beam holds its latched creature even round a curve
  const grabbed = Math.max(touchingFront(state, thief, victim) ? INHALE.CONTACT_WEIGHT : 0, thief.latchTarget === victim.sessionId ? LATCH.CURVE_WEIGHT * thief.beamFocus : 0);
  if (d - radius > INHALE.REACH + thief.width * INHALE.REACH_PER_SIZE) return grabbed;
  if (d <= radius) return 1;
  // In the cone if any of it is: its center's angle off the facing, against how wide it looks from here
  const off = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy) / d)));
  const allowed = (INHALE.ARC * Math.PI) / 180 + Math.asin(Math.min(1, radius / d));
  if (off > allowed) return grabbed;
  return Math.max(grabbed, INHALE.STEAL_EDGE_SHARE + (1 - INHALE.STEAL_EDGE_SHARE) * (1 - off / allowed));
}

/** Whether `victim` is touching `thief` anywhere across its front (contact range: an inhale grabs it with no aiming) */
export function touchingFront(_state: GameState, thief: PlayerSchema, victim: PlayerSchema) : boolean {
  const dx = victim.x + victim.width / 2 - (thief.x + thief.width / 2);
  const dy = victim.y + victim.height / 2 - (thief.y + thief.height / 2);
  const d = Math.hypot(dx, dy);
  if (d - (thief.width + victim.width) / 2 > INHALE.CONTACT_GAP) return false;
  if (d < 1e-6) return true;
  return (dx * Math.cos(thief.facing) + dy * Math.sin(thief.facing)) / d >= Math.cos((INHALE.CONTACT_ARC * Math.PI) / 180);
}

/**
 * How hard `thief`'s inhale pulls gems out of `victim` (0 to 1): sharply weaker with distance (the
 * cone reaches far but bites near the mouth), and weaker while the victim gets away, strafing
 * across the cone most of all. Right at the mouth there's no getting away.
 */
export function stealStrength(_state: GameState, thief: PlayerSchema, victim: PlayerSchema) : number {
  const fx = Math.cos(thief.facing);
  const fy = Math.sin(thief.facing);
  const dx = victim.x + victim.width / 2 - (thief.x + thief.width / 2 + fx * thief.width * 0.3);
  const dy = victim.y + victim.height / 2 - (thief.y + thief.height / 2 + fy * thief.width * 0.3);
  const d = Math.hypot(dx, dy);
  const reach = INHALE.REACH + thief.width * INHALE.REACH_PER_SIZE;
  const gap = Math.max(0, d - victim.width / 2);
  const near = Math.pow(Math.max(0, 1 - gap / reach), INHALE.STEAL_FALLOFF);
  // The outer part of the reach catches but doesn't kill: drain fades to nothing toward the tip
  const lethal = lethalShare(gap / reach);
  if (d < 1e-6) return near * lethal;
  const nx = dx / d;
  const ny = dy / d;
  const velocity = victim.velocity();
  const away = Math.max(0, velocity.x * nx + velocity.y * ny);
  const across = Math.abs(velocity.y * nx - velocity.x * ny);
  const escape = Math.min(1, (INHALE.STEAL_ESCAPE_AWAY * away + across) / moveSpeed(victim.width));
  const reachable = Math.min(1, gap / (reach * INHALE.STEAL_POINT_BLANK));
  return near * lethal * (1 - INHALE.STEAL_ESCAPE * escape * reachable);
}

/**
 * Gravity theft: everyone in the inhale cone has gems pulled out into the thief (one small enough
 * to capture is pulled in bodily too). An inhale's drain is shared out by how squarely each victim
 * sits in the cone, and grows only with the square root of how many it catches, so a big cone
 * covers more creatures without draining each one as fast. The rate uses a fixed share of the victim's
 * gems when injured (with a small floor), before geometry, relative size and pressure. Two creatures inhaling
 * each other never both steal at once: only the stronger pull does (clashStrength, INHALE.CLASH_MARGIN), so a
 * clash has a winner instead of an endless exchange. Relative size resists theft independently of
 * the sustained-contact ramp. Only a damaging hit exposes gems; no shared
 * allowance limits an injury window. Taking the last gem knocks out the injured victim.
 */
interface TheftFlow { victim: PlayerSchema; weight: number; rate: number }
type TheftPlan = Map<PlayerSchema, TheftFlow[]>;

/** Only authoritative, positive, eligible connections participate in a victim's shared pressure. */
export function planTheft(state: GameState, _now: number): TheftPlan {
  const plan: TheftPlan = new Map(), incoming = new Map<PlayerSchema, TheftFlow[]>();
  for (const thief of state.players.values()) {
    if (thief.breathingBlocked || !thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || thief.stunned || thief.flying || thief.capturedBy || thief.gulping) continue;
    if (injuryVulnerable(state, thief)) continue;
    const candidates: { victim: PlayerSchema; weight: number }[] = [];
    for (const victim of state.players.values()) {
      if (victim === thief || victim.gems <= INHALE.DRAIN_FLOOR || !theftWindowAllows(thief, victim, state.time) || victim.capturedBy || victim.flying) continue;
      const weight = stealWeight(state, thief, victim);
      if (weight > 0) candidates.push({ victim, weight });
    }
    const total = candidates.reduce((n, entry) => n + entry.weight, 0), budget = Math.sqrt(candidates.length);
    const flows: TheftFlow[] = [];
    for (const entry of candidates) {
      if (!winsTheftClash(state, thief, entry.victim)) continue;
      const rate = Math.max(INHALE.STEAL_RATE, entry.victim.injuryGems * INHALE.STEAL_SHARE_PER_S)
        * budget * entry.weight / total * connectionPower(state, thief, entry.victim);
      if (!(rate > 0)) continue;
      const flow = { ...entry, rate }; flows.push(flow);
      const group = incoming.get(entry.victim) ?? []; group.push(flow); incoming.set(entry.victim, group);
    }
    plan.set(thief, flows.sort((a,b) => b.weight-a.weight));
  }
  for (const group of incoming.values()) {
    const scale = groupPressureScale(group.map(f => f.rate));
    for (const flow of group) flow.rate *= scale;
  }
  return plan;
}

export function steal(state: GameState, thief: PlayerSchema, now: number, deltaTime: number, prepared?: TheftPlan) : void {
  if (thief.breathingBlocked || !thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || thief.stunned || thief.flying || thief.capturedBy || thief.gulping) {
    thief.theftContinuations.clear(); thief.robbing = ''; return;
  }
  const connected = new Set<string>();
  const victims = (prepared ?? planTheft(state, now)).get(thief) ?? [];
  victims.sort((a, b) => b.weight - a.weight);
  const primary = victims[0]?.victim.sessionId ?? "";
  if (primary !== thief.stealingFrom) endTheft(state, thief, now, primary);
  const list = victims.map((entry) => entry.victim.sessionId).join(",");
  if (list !== thief.robbing) thief.robbing = list;
  // Progress toward the next gem is kept between inhales, and while someone slips out of the cone for a moment
  for (const id of [...thief.stealShares.keys()]) {
    const known = state.players.get(id);
    if (!known || known.state !== PLAYER_STATE.ALIVE || !theftWindowAllows(thief, known, state.time)) thief.stealShares.delete(id);
  }
  for (const { victim, rate } of victims) {
    if (victim.state !== PLAYER_STATE.ALIVE || victim.capturedBy || victim.flying || victim.gems <= INHALE.DRAIN_FLOOR || deltaTime <= 0) continue;
    connected.add(victim.sessionId);
    if (state.time < victim.injuredUntil) thief.theftContinuations.set(victim.sessionId, victim.injuredUntil);
    if (state.time >= victim.injuredUntil) victim.continuedTheft = true;
    let progress = (thief.stealShares.get(victim.sessionId) ?? 0) + deltaTime * rate;
    // Transfer the tick's whole gems together: uncapped scores must not mean one loop per gem.
    const amount = Math.min(Math.floor(progress), victim.gems - INHALE.DRAIN_FLOOR);
    if (amount > 0) {
      progress -= amount;
      victim.setGems(victim.gems - amount, state.worldWidth, state.worldHeight);
      thief.setGems(thief.gems + amount, state.worldWidth, state.worldHeight);
      thief.stolenTotal += amount;
      victim.robbedTotal += amount;
      if (victim.sessionId === thief.stealingFrom) thief.stolenRun += amount;
    }
    if (victim.gems === 0 && victim.state === PLAYER_STATE.ALIVE) {
      knockOutWithGems(state, victim, now);
      state.credit(victim, 'drain', now, thief.sessionId, { out: true });
      if (victim.sessionId === thief.stealingFrom) thief.stolenRun = 0;
      thief.stealShares.delete(victim.sessionId);
    } else thief.stealShares.set(victim.sessionId, Math.min(progress, 1));
  }
  for (const id of [...thief.theftContinuations.keys()]) if (!connected.has(id)) {
    thief.theftContinuations.delete(id);
    const victim = state.players.get(id);
    if (!victim || state.time >= victim.injuredUntil) thief.stealShares.delete(id);
  }
}

/** Only existing injury/continuation state confers vulnerability; no second timer. */
export function injuryVulnerable(state: GameState, player: PlayerSchema, now = state.now): boolean {
  if (player.state !== PLAYER_STATE.ALIVE) return false;
  if (player.injuredUntil > state.time) return true;
  if (!player.injuredUntil) return false;
  return [...state.players.values()].some(thief =>
    thief.theftContinuations.get(player.sessionId) === player.injuredUntil && validTheftConnection(state, thief, player, now));
}

function connectionPower(state: GameState, thief: PlayerSchema, victim: PlayerSchema): number {
  return stealStrength(state, thief, victim) * drainRamp(thief.heldFor.get(victim.sessionId) ?? 0, thief.width)
    * scaleDrain(thief.width, victim.width) * (LATCH.OVERLAP_DRAIN_MIN + (1 - LATCH.OVERLAP_DRAIN_MIN) * cleanAir(state.bodyOf(thief), state.bodyOf(victim)));
}
function winsTheftClash(state: GameState, thief: PlayerSchema, victim: PlayerSchema): boolean {
  const theirs = clashStrength(state, victim, thief);
  if (theirs <= 0) return true;
  const mine = clashStrength(state, thief, victim), held = thief.heldFor.get(victim.sessionId) ?? 0, theirHeld = victim.heldFor.get(thief.sessionId) ?? 0;
  const lead = held > theirHeld || (held === theirHeld && thief.sessionId < victim.sessionId), margin = 1 + INHALE.CLASH_MARGIN;
  return mine > theirs * margin || (mine * margin >= theirs && lead);
}
function validTheftConnection(state: GameState, thief: PlayerSchema, victim: PlayerSchema, now: number): boolean {
  return thief.inhaling && thief.state === PLAYER_STATE.ALIVE && !thief.stunned && !thief.flying && !thief.capturedBy && !thief.gulping
    && victim.state === PLAYER_STATE.ALIVE && !victim.spawnProtected && now >= victim.suctionSafeUntil && !victim.flying && !victim.capturedBy
    && victim.gems > INHALE.DRAIN_FLOOR && theftWindowAllows(thief, victim, state.time)
    && stealWeight(state, thief, victim) > 0 && winsTheftClash(state, thief, victim) && connectionPower(state, thief, victim) > 0;
}
export function syncContinuedTheft(state: GameState, now = state.now): void {
  const active = [...state.players.values()].map(p => [p, injuryVulnerable(state, p, now)] as const);
  for (const [p, vulnerable] of active) {
    p.continuedTheft = vulnerable && state.time >= p.injuredUntil;
    p.breathingBlocked = vulnerable;
    if (vulnerable && p.inhaling) { p.stopInhale(now); p.dropLatch(); }
  }
}
function pruneTheftContinuations(state: GameState, now: number): void {
  for (const thief of state.players.values()) for (const id of [...thief.theftContinuations.keys()]) {
    const victim = state.players.get(id);
    if (!victim || thief.theftContinuations.get(id) !== victim.injuredUntil || !validTheftConnection(state, thief, victim, now)) {
      thief.theftContinuations.delete(id);
      if (!victim || state.time >= victim.injuredUntil) thief.stealShares.delete(id);
    }
  }
  syncContinuedTheft(state, now);
}

/**
 * How hard one creature's inhale is draining another right now: its per-victim drain rate, before an inhale's
 * budget is shared out (0 unless it's inhaling, free, with the other in its cone). Two creatures inhaling each
 * other compare these, and only the stronger pull siphons (see steal)
 */
function clashStrength(state: GameState, thief: PlayerSchema, victim: PlayerSchema) : number {
  if (thief.breathingBlocked || !thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || thief.capturedBy || thief.flying || thief.gulping) return 0;
  const weight = stealWeight(state, thief, victim);
  if (weight <= 0) return 0;
  const held = thief.heldFor.get(victim.sessionId) ?? 0;
  return weight * stealStrength(state, thief, victim) * drainRamp(held, thief.width) * scaleDrain(thief.width, victim.width) * (LATCH.OVERLAP_DRAIN_MIN + (1 - LATCH.OVERLAP_DRAIN_MIN) * cleanAir(state.bodyOf(thief), state.bodyOf(victim)));
}

/**
 * Exhaling: the button tapped with nothing in your mouth. A short puff out of the mouth: loose gems in
 * front of it are blown away, and creatures in it receive a brief steerable push,
 * which pushes a robber out of its own inhale's reach. Costs EXHALE.BREATH_COST from the full
 * breath meter, with a pause before the next one (EXHALE.COOLDOWN_MS).
 */
export function exhale(state: GameState, player: PlayerSchema, now: number) : void {
  if (injuryVulnerable(state, player, now) || player.state !== PLAYER_STATE.ALIVE || player.stunned || player.sliding || player.recovering || player.flying || player.capturedBy || player.inhaling || now < player.exhaleReadyAt) return;
  if (!player.spendBreath(now, EXHALE.BREATH_COST)) return;
  player.exhaleReadyAt = now + EXHALE.COOLDOWN_MS;
  player.puffReadyAt = state.time + EXHALE.COOLDOWN_MS;
  player.dropProtection();
  const fx = Math.cos(player.facing);
  const fy = Math.sin(player.facing);
  const mouthX = player.x + player.width / 2 + fx * player.width * 0.3;
  const mouthY = player.y + player.height / 2 + fy * player.width * 0.3;
  const reach = EXHALE.REACH + player.width * EXHALE.REACH_PER_SIZE;
  const cone = Math.cos((EXHALE.ARC * Math.PI) / 180);
  puffWeaponParts(state, player);
  state.gems.forEach((gem) => {
    const dx = gem.x - mouthX;
    const dy = gem.y - mouthY;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6 || d > reach || (dx * fx + dy * fy) / d < cone) return;
    gem.blow(Math.atan2(dy, dx), EXHALE.GEM_PUSH * (1 - d / reach));
  });
  const hits: { target: PlayerSchema; falloff: number }[] = [];
  state.players.forEach((other) => {
    if (other === player || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.flying || other.capturedBy) return;
    const ox = other.x + other.width / 2 - mouthX;
    const oy = other.y + other.height / 2 - mouthY;
    const d = Math.hypot(ox, oy);
    const gap = Math.max(0, d - other.width / 2);
    if (d < 1e-6 || gap > reach || (ox * fx + oy * fy) / d < cone) return;
    const parried = other.inhaling && stealWeight(state, other, player) > 0;
    if (parried) {
      other.stopInhale(now);
      other.dropLatch();
      other.lockOn.delete(player.sessionId);
      other.heldFor.delete(player.sessionId);
      other.inhaleBlockedUntil = Math.max(other.inhaleBlockedUntil, now + EXHALE.PARRY_MS);
      state.onEvent?.("parry", { id: player.sessionId, targetId: other.sessionId });
    }
    hits.push({ target: other, falloff: 1 - gap / reach });
  });
  const impulses = puffImpulses(player.width, hits.map(hit => ({ id: hit.target.sessionId, width: hit.target.width, falloff: hit.falloff })));
  for (const hit of impulses.hits) state.players.get(hit.id)?.pushWithControl(fx, fy, hit.velocity);
  if (impulses.recoil > 0) player.pushWithControl(-fx, -fy, impulses.recoil);
  const wave=new GustWaveSchema();
  wave.owner=player.sessionId;wave.x=player.x+player.width/2;wave.y=player.y+player.height/2;
  wave.width=player.width;wave.facing=player.facing;wave.at=state.time;
  wave.remainingImpulse=bodyMass(player.width)*Math.max(0,EXHALE.IMPULSE_RECOIL_CAP-impulses.recoil);
  for (const hit of hits) { wave.pushed.add(hit.target.sessionId); wave.parried.add(hit.target.sessionId); }
  state.gustWaves.set(player.sessionId,wave);
  state.onEvent?.('exhale', { id: player.sessionId, x: Math.round(mouthX), y: Math.round(mouthY), facing: Math.round(player.facing * 100) / 100,
    reach: Math.round(reach), breathLeft: player.stamina, recoil: impulses.recoil });
}

/** A run of stealing ends (or switches to someone else): a big one gets a banner and a line in the feed */
export function endTheft(state: GameState, thief: PlayerSchema, now: number, next = "") : void {
  const victim = thief.stealingFrom ? state.players.get(thief.stealingFrom) : undefined;
  if (victim && thief.stolenRun >= INHALE.STOLE_NOTICE) state.credit(victim, "stole", now, thief.sessionId, { gems: thief.stolenRun, out: false });
  thief.stolenRun = 0;
  thief.stealProgress = 0;
  if (thief.stealingFrom !== next) thief.stealingFrom = next;
}

/** A captive goes free: pushed clear along (ax, ay), and safe from being caught again for a moment */
function free(state: GameState, captive: PlayerSchema, ax: number, ay: number, now: number, push: number = CANNON.BREAK_PUSH): void {
  const captor = state.players.get(captive.capturedBy);
  if (captor) {
    // Mouth positions are inside large bodies. Start clear, choosing an open side at arena edges.
    const cx = captor.x + captor.width / 2, cy = captor.y + captor.height / 2;
    const clearance = (captor.width + captive.width) / 2 + CANNON.RELEASE_CLEARANCE;
    const angle = Math.atan2(ay, ax), margin = GAME_CONSTANTS.ARENA_RULES.EDGE_MARGIN;
    for (const turn of [0, Math.PI / 2, -Math.PI / 2, Math.PI]) {
      const dx = Math.cos(angle + turn), dy = Math.sin(angle + turn);
      const x = cx + dx * clearance - captive.width / 2, y = cy + dy * clearance - captive.height / 2;
      if (x < margin || y < margin || x + captive.width > state.worldWidth - margin || y + captive.height > state.worldHeight - margin) continue;
      captive.placeAt(x, y); ax = dx; ay = dy;
      break;
    }
  }
  captive.capturedBy = "";
  captive.struggle = 0;
  const until = now + CANNON.ESCAPE_SAFE_MS;
  captive.recaptureAfter = Math.max(captive.recaptureAfter, until);
  captive.suctionSafeUntil = Math.max(captive.suctionSafeUntil, until);
  captive.launchSafeUntil = Math.max(captive.launchSafeUntil, state.time + CANNON.ESCAPE_SAFE_MS);
  captive.skid(ax, ay, push);
}

/** A new action after release fires once the shared capture-to-fire minimum has elapsed. */
export function fireCaptive(state: GameState, eater: PlayerSchema, now: number): boolean {
  const captive = state.players.get(eater.gulping);
  if (!captive || captive.capturedBy !== eater.sessionId) {
    eater.gulping = "";
    return false;
  }
  if (eater.captureNeedsRelease) return false;
  if (eater.stunned && eater.holdThroughStun) return false;
  const canFire = eater.state === PLAYER_STATE.ALIVE && !eater.stunned && !eater.capturedBy && !eater.flying && captive.state === PLAYER_STATE.ALIVE;
  if (canFire && now < eater.captureStartedAt + CANNON.CAPTURE_FIRE_DELAY_MS) return false;
  eater.dropProtection();
  eater.gulping = "";
  if (canFire) {
    const angle = eater.facing;
    const power = shooterMassContribution(eater.width, CANNON.BULLET_SIZE);
    const speed = launchSpeed(eater.width);
    // Set clear of the captor's body first, along the shot, so the flight never starts with the two overlapping
    captive.launch(now, Math.cos(angle) * speed, Math.sin(angle) * speed, eater.sessionId, CANNON.FLIGHT_MS);
    const clearance = eater.width / 2 + CANNON.BULLET_SIZE / 2 + CANNON.LAUNCH_CLEARANCE;
    const margin = GAME_CONSTANTS.ARENA_RULES.EDGE_MARGIN;
    const x = eater.x + eater.width / 2 + Math.cos(angle) * clearance - CANNON.BULLET_SIZE / 2;
    const y = eater.y + eater.height / 2 + Math.sin(angle) * clearance - CANNON.BULLET_SIZE / 2;
    captive.placeAt(Math.max(margin, Math.min(state.worldWidth - CANNON.BULLET_SIZE - margin, x)),
      Math.max(margin, Math.min(state.worldHeight - CANNON.BULLET_SIZE - margin, y)));
    captive.shotMassBonus = power; captive.shotShooterWidth = eater.width;
    state.onEvent?.("launch", { byId: eater.sessionId, id: captive.sessionId, x: captive.x, y: captive.y });
  } else {
    free(state, captive, Math.cos(eater.facing), Math.sin(eater.facing), now);
  }
  return true;
}

/** Fixed hold deadlines never depend on transferred growth or interior activity. */
export function updateHolds(state: GameState, now: number, _deltaTime = 0): void {
  state.players.forEach((captor) => {
    if (!captor.gulping) return;
    const captive = state.players.get(captor.gulping);
    if (!captive || captive.capturedBy !== captor.sessionId || captive.state !== PLAYER_STATE.ALIVE) {
      captor.gulping = ""; captor.captureNeedsRelease = false; return;
    }
    const fx = Math.cos(captor.facing), fy = Math.sin(captor.facing);
    if (captor.state !== PLAYER_STATE.ALIVE || (captor.stunned && !captor.holdThroughStun) || captor.capturedBy || captor.flying || state.time >= captor.gulpEndsAt) {
      captor.gulping = ""; captor.captureNeedsRelease = false;
      free(state, captive, fx, fy, now); return;
    }
    captive.placeAt(captor.x + captor.width / 2 - captive.width / 2, captor.y + captor.height / 2 - captive.height / 2);
  });
  state.players.forEach((captive) => {
    if (!captive.capturedBy) return;
    const captor = state.players.get(captive.capturedBy);
    if (!captor || captor.gulping !== captive.sessionId) free(state, captive, Math.cos(captive.facing), Math.sin(captive.facing), now);
  });
}

/** Release relationships synchronously on respawn/disconnect; disconnected rewards are discarded. */
export function clearCapture(state: GameState, id: string, now: number): void {
  const player = state.players.get(id);
  if (!player) return;
  player.shotMassBonus = 0; player.shotShooterWidth = 0;
  const captive = state.players.get(player.gulping);
  if (captive) free(state, captive, Math.cos(player.facing), Math.sin(player.facing), now);
  const captor = state.players.get(player.capturedBy);
  if (captor) { captor.gulping = ""; captor.captureNeedsRelease = false; }
  player.capturedBy = player.gulping = "";
}

/** Whether a point is in front of a creature (within about 70 degrees of its facing), as a catch needs */
function inFrontOf(eater: PlayerSchema, px: number, py: number): boolean {
  const dx = px - (eater.x + eater.width / 2);
  const dy = py - (eater.y + eater.height / 2);
  const d = Math.hypot(dx, dy);
  return d < 1e-6 || (dx * Math.cos(eater.facing) + dy * Math.sin(eater.facing)) / d >= 0.35;
}
