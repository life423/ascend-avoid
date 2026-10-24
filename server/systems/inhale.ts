import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { airflowQuality, cleanAir, drainRamp, lethalShare, pressureBuild, pressureBuildSeconds, scaleDrain } from "../game/airflow.js";
import { moveSpeed } from "../game/movement.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

import { CANNON, EXHALE } from "../constants/gameConstants.js";
import { canCatch, launchSpeed, escapeLength, captureLoadMs } from "../game/cannon.js";

const { PLAYER_STATE, INHALE, LATCH, BOTS } = GAME_CONSTANTS;
import { sprayGems } from "./gems.js";
import { puffWeaponParts } from "./weapons.js";

/** Knocked out: any last gems burst out where the player was */
export function knockOutWithGems(state: GameState, player: PlayerSchema, now: number) : void {
  const left = player.gems;
  const centerX = player.x + player.width / 2;
  const centerY = player.y + player.height / 2;
  if (left > 0) player.setGems(0, state.worldWidth, state.worldHeight);
  player.knockOut(now);
  if (left > 0) sprayGems(state, centerX, centerY, left, now, player.sessionId);
}

/**
 * Inhaling: everything in a cone in front of the creature's mouth. Gems are pulled in and
 * swallowed; a bomb stays in the mouth (safe until it's spat). Every creature in it is robbed
 * (steal) and pulled bodily toward the mouth by mass; one 1.3 times
 * narrower or more is caught there (see CANNON: escape, launch).
 */
export function updateInhales(state: GameState, now: number, deltaTime: number) : void {
  const cone = Math.cos((INHALE.ARC * Math.PI) / 180);
  updateHolds(state, now);
  state.players.forEach((eater) => {
    if (!eater.inhaling || eater.state !== PLAYER_STATE.ALIVE) {
      if (eater.stealingFrom) endTheft(state, eater, now);
      if (eater.robbing) eater.robbing = "";
      fadeLocks(state, eater, null, deltaTime);
      return;
    }
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
      // Holding it in the cone builds the lock: a light pull at first, dangerous after a second
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
      if (now >= prey.recaptureAfter && canCatch(eater.width, prey.width) && d <= eater.width * INHALE.CAPTURE_REACH + prey.width / 2 && d < heldAt && inFrontOf(eater, px, py)) {
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
      const strength = INHALE.BODY_PULL * mass * near * near * (1 + INHALE.CLOSE_BOOST * close) * alignment * lockPull;
      // It never outpaces the creature's own top speed (react early, or slip out of the cone, and you get
      // away)... except close to a mouth big enough to catch it: there the suction rises past its top speed
      // (PREY_PULL_CLOSE at the mouth), so running straight away doesn't save it; still only for what's in
      // front, so slipping sideways out of the airflow does
      const speed = moveSpeed(prey.width);
      let pullSpeed = Math.min(strength, INHALE.PREY_PULL_CAP * speed);
      if (close > 0 && canCatch(eater.width, prey.width)) {
        const overpower = speed * (INHALE.PREY_PULL_CAP + (INHALE.PREY_PULL_CLOSE - INHALE.PREY_PULL_CAP) * Math.sqrt(close)) * alignment;
        pullSpeed = Math.max(pullSpeed, overpower);
      }
      const pull = pullSpeed * deltaTime;
      prey.nudge(((mouthX - px) / d) * pull, ((mouthY - py) / d) * pull, state.worldWidth, state.worldHeight);
    });
    fadeLocks(state, eater, locked, deltaTime);
    // Capture: a creature it could catch, held at its mouth, is caught: it goes inside (out of sight), the
    // mouth is full (the inhale ends; no more until it's empty), and it's ammunition until it gets its
    // escape sequence right or is fired (fireCaptive). The hold itself runs in updateHolds, button or not.
    const caught = held as PlayerSchema | null;
    if (caught && !eater.gulping) {
      eater.gulping = caught.sessionId;
      eater.gulpEndsAt = state.time + CANNON.HOLD_MS;
      eater.captureStartedAt = now;
      caught.capturedBy = eater.sessionId;
      caught.struggle = 0;
      // Dazed for a moment, then it has to push its stick in these directions, in order, to get out
      caught.escapeKeys = escapeSequence(escapeLength(eater.width, caught.width));
      eater.fireReadyAt = state.time + captureLoadMs(caught.escapeKeys.length);
      eater.fireQueued = false;
      caught.escapeStep = 0;
      caught.dazedUntil = state.time + CANNON.CAPTIVE_STUN_MS;
      caught.escapeMissAt = 0;
      caught.escapeNeutral = true;
      caught.escapeTryAt = caught.isBot ? now + CANNON.CAPTIVE_STUN_MS + BOTS.ESCAPE_READ_MS : 0;
      caught.stopInhale(now);
      caught.dropLatch();
      // The capture decides what happens to it now: any theft from it ends here
      eater.stealShares.delete(caught.sessionId);
      if (eater.stealingFrom === caught.sessionId) endTheft(state, eater, now);
      eater.stopInhale(now);
    }
    // A mouth holding a captive drains nobody (the capture decides what happens to it); an empty one robs
    if (eater.gulping) {
      if (eater.stealingFrom) endTheft(state, eater, now);
      if (eater.robbing) eater.robbing = "";
    } else {
      steal(state, eater, now, deltaTime);
    }
  });
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
  if (!thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || victim.state !== PLAYER_STATE.ALIVE || victim.spawnProtected) return 0;
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
 * covers more creatures without draining each one as fast. A victim's share drains at INHALE.STEAL_RATE a second,
 * whatever either one's size (mass resists being pulled, not being robbed). Two creatures inhaling
 * each other never both steal at once: only the stronger pull does (clashStrength, INHALE.CLASH_MARGIN), so a
 * clash has a winner instead of an endless exchange. Stealing never takes a creature's last gem
 * (INHALE.DRAIN_FLOOR): drained, it's weak, never gone.
 */
export function steal(state: GameState, thief: PlayerSchema, now: number, deltaTime: number) : void {
  const victims: { victim: PlayerSchema; weight: number }[] = [];
  state.players.forEach((other) => {
    // (a captive isn't drained: the capture decides what happens to it)
    if (other === thief || other.gems <= INHALE.DRAIN_FLOOR || other.capturedBy || other.flying) return;
    const weight = stealWeight(state, thief, other);
    if (weight > 0) victims.push({ victim: other, weight });
  });
  victims.sort((a, b) => b.weight - a.weight);
  const primary = victims[0]?.victim.sessionId ?? "";
  if (primary !== thief.stealingFrom) endTheft(state, thief, now, primary);
  const list = victims.map((entry) => entry.victim.sessionId).join(",");
  if (list !== thief.robbing) thief.robbing = list;
  // Progress toward the next gem is kept between inhales, and while someone slips out of the cone for a moment
  for (const id of [...thief.stealShares.keys()]) {
    const known = state.players.get(id);
    if (!known || known.state !== PLAYER_STATE.ALIVE) thief.stealShares.delete(id);
  }
  const total = victims.reduce((sum, entry) => sum + entry.weight, 0);
  // Catching several at once pays more than one, though far less than one each
  const budget = Math.sqrt(victims.length);
  for (const { victim, weight } of victims) {
    // A clash: the victim's own inhale is on this thief too. Only the stronger pull siphons (ahead by
    // CLASH_MARGIN; closer than that, whoever has held the other longer): nothing flows the losing way
    const theirs = clashStrength(state, victim, thief);
    if (theirs > 0) {
      const mine = clashStrength(state, thief, victim);
      const held = thief.heldFor.get(victim.sessionId) ?? 0;
      const theirHeld = victim.heldFor.get(thief.sessionId) ?? 0;
      const lead = held > theirHeld || (held === theirHeld && thief.sessionId < victim.sessionId);
      const margin = 1 + INHALE.CLASH_MARGIN;
      if (!(mine > theirs * margin || (mine * margin >= theirs && lead))) continue;
    }
    let progress = (thief.stealShares.get(victim.sessionId) ?? 0) + deltaTime * INHALE.STEAL_RATE * budget * (weight / total) * stealStrength(state, thief, victim) * drainRamp(thief.heldFor.get(victim.sessionId) ?? 0) * pressureBuild(thief.heldFor.get(victim.sessionId) ?? 0, thief.width) * scaleDrain(thief.width, victim.width) * (LATCH.OVERLAP_DRAIN_MIN + (1 - LATCH.OVERLAP_DRAIN_MIN) * cleanAir(state.bodyOf(thief), state.bodyOf(victim)));
    while (progress >= 1 && victim.gems > INHALE.DRAIN_FLOOR) {
      progress -= 1;
      victim.setGems(victim.gems - 1, state.worldWidth, state.worldHeight);
      thief.setGems(thief.gems + 1, state.worldWidth, state.worldHeight);
      thief.stolenTotal += 1;
      victim.robbedTotal += 1;
      if (victim.sessionId === thief.stealingFrom) thief.stolenRun += 1;
    }
    thief.stealShares.set(victim.sessionId, Math.min(progress, 1));
  }
}

/**
 * How hard one creature's inhale is draining another right now: its per-victim drain rate, before an inhale's
 * budget is shared out (0 unless it's inhaling, free, with the other in its cone). Two creatures inhaling each
 * other compare these, and only the stronger pull siphons (see steal)
 */
function clashStrength(state: GameState, thief: PlayerSchema, victim: PlayerSchema) : number {
  if (!thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || thief.capturedBy || thief.flying || thief.gulping) return 0;
  const weight = stealWeight(state, thief, victim);
  if (weight <= 0) return 0;
  const held = thief.heldFor.get(victim.sessionId) ?? 0;
  return weight * stealStrength(state, thief, victim) * drainRamp(held) * pressureBuild(held, thief.width) * scaleDrain(thief.width, victim.width) * (LATCH.OVERLAP_DRAIN_MIN + (1 - LATCH.OVERLAP_DRAIN_MIN) * cleanAir(state.bodyOf(thief), state.bodyOf(victim)));
}

/**
 * Exhaling: the button tapped with nothing in your mouth. A short puff out of the mouth: loose gems in
 * front of it are blown away, and creatures in it are shoved back and briefly stunned,
 * which pushes a robber out of its own inhale's reach. Costs EXHALE.BREATH_COST from the full
 * breath meter, with a pause before the next one (EXHALE.COOLDOWN_MS).
 */
export function exhale(state: GameState, player: PlayerSchema, now: number) : void {
  if (player.state !== PLAYER_STATE.ALIVE || player.stunned || player.sliding || player.recovering || player.flying || player.capturedBy || player.inhaling || now < player.exhaleReadyAt) return;
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
  state.onEvent?.("exhale", { id: player.sessionId, x: Math.round(mouthX), y: Math.round(mouthY), facing: Math.round(player.facing * 100) / 100, reach: Math.round(reach), breathLeft: player.stamina });
  puffWeaponParts(state, player);
  state.gems.forEach((gem) => {
    const dx = gem.x - mouthX;
    const dy = gem.y - mouthY;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6 || d > reach || (dx * fx + dy * fy) / d < cone) return;
    gem.blow(Math.atan2(dy, dx), EXHALE.GEM_PUSH * (1 - d / reach));
  });
  state.players.forEach((other) => {
    if (other === player || other.state !== PLAYER_STATE.ALIVE || other.spawnProtected || other.flying || other.capturedBy) return;
    const ox = other.x + other.width / 2 - mouthX;
    const oy = other.y + other.height / 2 - mouthY;
    const d = Math.hypot(ox, oy);
    const gap = Math.max(0, d - other.width / 2);
    if (d < 1e-6 || gap > reach || (ox * fx + oy * fy) / d < cone) return;
    const parried = other.inhaling && stealWeight(state, other, player) > 0;
    if (parried) {
      player.suctionSafeUntil = now + EXHALE.BREAK_MS;
      other.stopInhale(now);
      other.dropLatch();
      other.lockOn.delete(player.sessionId);
      other.heldFor.delete(player.sessionId);
      other.inhaleBlockedUntil = now + EXHALE.PARRY_MS;
      state.onEvent?.("parry", { id: player.sessionId, targetId: other.sessionId });
    }
    const ratio = Math.min(EXHALE.PUSH_RATIO_MAX, Math.max(EXHALE.PUSH_RATIO_MIN, player.weight() / other.weight()));
    const distance = Math.min(EXHALE.PUSH_MAX, EXHALE.BODY_PUSH * ratio * (1 - gap / reach));
    if (now >= other.stunImmuneUntil) other.stun(now, EXHALE.STUN_MS);
    other.skid(ox / d, oy / d, parried ? Math.max(EXHALE.DEFENSE_PUSH, distance) : distance);
  });
}

/** A run of stealing ends (or switches to someone else): a big one gets a banner and a line in the feed */
export function endTheft(state: GameState, thief: PlayerSchema, now: number, next = "") : void {
  const victim = thief.stealingFrom ? state.players.get(thief.stealingFrom) : undefined;
  if (victim && thief.stolenRun >= INHALE.STOLE_NOTICE) state.credit(victim, "stole", now, thief.sessionId, { gems: thief.stolenRun });
  thief.stolenRun = 0;
  thief.stealProgress = 0;
  if (thief.stealingFrom !== next) thief.stealingFrom = next;
}

/**
 * Holds a captive: pinned at its captor's mouth (inside it, as far as anyone can see), working its way out.
 * Dazed for CAPTIVE_STUN_MS after the catch; then every push of its stick past ESCAPE_PRESS (after a return
 * to neutral) counts as one direction: the right next one advances its sequence, a wrong one starts it over.
 * struggle is how far along it is, 0 to 1.
 */
function holdCaptive(_state: GameState, captive: PlayerSchema, mouthX: number, mouthY: number, facing: number): void {
  captive.placeAt(mouthX + Math.cos(facing) * captive.width * 0.45 - captive.width / 2, mouthY + Math.sin(facing) * captive.width * 0.45 - captive.height / 2);
  captive.struggle = captive.escapeKeys.length > 0 ? captive.escapeStep / captive.escapeKeys.length : 0;
}

/** Process joystick edges as messages arrive; a fast neutral/press pair must survive one server tick. */
export function escapeSteer(state: GameState, captive: PlayerSchema): void {
  if (!captive.capturedBy) return;
  if (state.time < captive.dazedUntil) return;
  const steer = captive.steerInput();
  const push = Math.hypot(steer.x, steer.y);
  if (push <= CANNON.ESCAPE_NEUTRAL) {
    captive.escapeNeutral = true;
    return;
  }
  if (!captive.escapeNeutral || push < CANNON.ESCAPE_PRESS) return;
  captive.escapeNeutral = false;
  escapePress(state, captive, Math.abs(steer.x) >= Math.abs(steer.y) ? (steer.x > 0 ? "R" : "L") : (steer.y > 0 ? "D" : "U"));
}

/** The directions a fresh captive has to push, in order: CANNON.ESCAPE_KEYS of U, D, L and R */
export function escapeSequence(count: number = CANNON.ESCAPE_KEYS): string {
  let keys = "";
  for (let i = 0; i < count; i++) {
    const choices = "UDLR".replace(keys.slice(-1) || "-", "");
    keys += choices[Math.floor(Math.random() * choices.length)];
  }
  return keys;
}

/** A captive pushes one direction: the right next one advances its sequence; a wrong one starts it over (and shows) */
export function escapePress(state: GameState, captive: PlayerSchema, key: string): void {
  if (!captive.capturedBy || state.time < captive.dazedUntil || captive.escapeStep >= captive.escapeKeys.length || !"UDLR".includes(key) || key.length !== 1) return;
  if (captive.escapeKeys[captive.escapeStep] === key) {
    captive.escapeStep++;
  } else {
    captive.escapeStep = 0;
    captive.escapeMissAt = state.time;
  }
}

/** No longer caught: the escape sequence is over, whichever way it ended */
function clearEscape(captive: PlayerSchema): void {
  captive.escapeKeys = "";
  captive.escapeStep = 0;
  captive.dazedUntil = 0;
  captive.escapeMissAt = 0;
}

/** A captive goes free: pushed clear along (ax, ay), and safe from being caught again for a moment */
function free(state: GameState, captive: PlayerSchema, ax: number, ay: number, now: number, push: number = CANNON.BREAK_PUSH): void {
  captive.capturedBy = "";
  captive.struggle = 0;
  clearEscape(captive);
  const until = now + CANNON.ESCAPE_SAFE_MS;
  captive.recaptureAfter = Math.max(captive.recaptureAfter, until);
  captive.suctionSafeUntil = Math.max(captive.suctionSafeUntil, until);
  captive.launchSafeUntil = Math.max(captive.launchSafeUntil, state.time + CANNON.ESCAPE_SAFE_MS);
  captive.skid(ax, ay, push);
}

/**
 * Firing: the captor's button pressed while it holds someone (GameRoom), or a bot deciding to. Nothing happens
 * until the gun has loaded (ARM_MS after the catch: the captive stays put, working its way out); then, with the
 * captor alive, not stunned and not caught itself, the captive is launched out of the mouth along the captor's
 * facing; captive input cannot change the shot. Otherwise it's just let go, harmlessly. True if the hold ended.
 */
export function fireCaptive(state: GameState, eater: PlayerSchema, now: number): boolean {
  const captive = state.players.get(eater.gulping);
  if (!captive || captive.capturedBy !== eater.sessionId) {
    eater.gulping = "";
    return false;
  }
  if (now - eater.captureStartedAt < captureLoadMs(captive.escapeKeys.length)) { eater.fireQueued = true; return false; }
  eater.fireQueued = false;
  eater.dropProtection();
  eater.gulping = "";
  clearEscape(captive);
  if (eater.state === PLAYER_STATE.ALIVE && !eater.stunned && !eater.capturedBy && captive.state === PLAYER_STATE.ALIVE) {
    const angle = eater.facing;
    const speed = launchSpeed(eater.width, captive.width);
    // Set clear of the captor's body first, along the shot, so the flight never starts with the two overlapping
    const clearance = eater.width / 2 + captive.width / 2 + CANNON.LAUNCH_CLEARANCE;
    captive.placeAt(eater.x + eater.width / 2 + Math.cos(angle) * clearance - captive.width / 2, eater.y + eater.height / 2 + Math.sin(angle) * clearance - captive.height / 2);
    captive.launch(now, Math.cos(angle) * speed, Math.sin(angle) * speed, eater.sessionId, CANNON.FLIGHT_MS);
    state.onEvent?.("launch", { byId: eater.sessionId, id: captive.sessionId, x: captive.x, y: captive.y });
  } else {
    free(state, captive, Math.cos(eater.facing), Math.sin(eater.facing), now);
  }
  return true;
}

/**
 * Every hold, every tick, whether or not the captor is still inhaling (the button can be let go; the mouth
 * stays full): the captive is pinned inside and works its escape sequence. Out when it gets it right, when
 * the safety net (CANNON.HOLD_MS) runs out, or at once if its captor is knocked out, stunned, caught or sent
 * flying itself. A captive whose captor has left the game goes free too.
 */
export function updateHolds(state: GameState, now: number): void {
  state.players.forEach((captor) => {
    if (!captor.gulping) { captor.fireQueued = false; return; }
    const captive = state.players.get(captor.gulping);
    if (!captive || captive.capturedBy !== captor.sessionId || captive.state !== PLAYER_STATE.ALIVE) {
      captor.gulping = "";
      return;
    }
    const fx = Math.cos(captor.facing);
    const fy = Math.sin(captor.facing);
    if (captor.state !== PLAYER_STATE.ALIVE || captor.stunned || captor.capturedBy || captor.flying) {
      captor.gulping = "";
      free(state, captive, fx, fy, now);
      return;
    }
    holdCaptive(state, captive, captor.x + captor.width / 2 + fx * captor.width * 0.3, captor.y + captor.height / 2 + fy * captor.width * 0.3, captor.facing);
    if (captive.escapeKeys.length > 0 && captive.escapeStep >= captive.escapeKeys.length) {
      // It got the sequence right: out it pops
      captor.gulping = "";
      free(state, captive, fx, fy, now, CANNON.ESCAPE_PUSH);
    } else if (captor.fireQueued && now - captor.captureStartedAt >= captureLoadMs(captive.escapeKeys.length)) {
      fireCaptive(state, captor, now);
    } else if (state.time >= captor.gulpEndsAt) {
      // The safety net: the hold is over, the captive goes free
      captor.gulping = "";
      free(state, captive, fx, fy, now);
    }
  });
  state.players.forEach((captive) => {
    if (!captive.capturedBy) return;
    const captor = state.players.get(captive.capturedBy);
    if (!captor || captor.gulping !== captive.sessionId) free(state, captive, Math.cos(captive.facing), Math.sin(captive.facing), now);
  });
}

/** Whether a point is in front of a creature (within about 70 degrees of its facing), as a catch needs */
function inFrontOf(eater: PlayerSchema, px: number, py: number): boolean {
  const dx = px - (eater.x + eater.width / 2);
  const dy = py - (eater.y + eater.height / 2);
  const d = Math.hypot(dx, dy);
  return d < 1e-6 || (dx * Math.cos(eater.facing) + dy * Math.sin(eater.facing)) / d >= 0.35;
}
