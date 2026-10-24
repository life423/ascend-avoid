import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { airflowQuality, cleanAir, drainRamp, lethalShare, pressureBuild, pressureBuildSeconds, scaleDrain } from "../game/airflow.js";
import { moveSpeed } from "../game/movement.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

import { CANNON } from "../constants/gameConstants.js";
import { canSwallowWhole, holdFirmness, launchAngle, launchSpeed } from "../game/cannon.js";

const { PLAYER_STATE, INHALE, LATCH } = GAME_CONSTANTS;
import { sprayGems } from "./gems.js";

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
 * narrower or more goes down once held at the mouth for INHALE.GULP_MS.
 */
export function updateInhales(state: GameState, now: number, deltaTime: number) : void {
  const cone = Math.cos((INHALE.ARC * Math.PI) / 180);
  state.players.forEach((eater) => {
    if (!eater.inhaling || eater.state !== PLAYER_STATE.ALIVE) {
      if (eater.stealingFrom) endTheft(state, eater, now);
      if (eater.robbing) eater.robbing = "";
      // Stopped inhaling with a captive: launched (held long enough) or just let go
      if (eater.gulping) letGo(state, eater, now);
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
    // to swallow goes down once it's held right at the mouth for GULP_MS.
    let held: PlayerSchema | null = null;
    let heldAt = Infinity;
    const locked = new Set<string>();
    state.players.forEach((prey) => {
      if (prey === eater || prey.state !== PLAYER_STATE.ALIVE || prey.spawnProtected) return;
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
      // A swallow needs the size, the prey at the mouth, and clean airflow (sitting on top of it isn't enough)
      if (now >= prey.recaptureAfter && canSwallow(state, eater, prey) && d <= eater.width * INHALE.GULP_REACH + prey.width / 2 && d < heldAt && airflowQuality(state.mouthed(eater), state.bodyOf(prey)) >= LATCH.SWALLOW_MIN_QUALITY) {
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
      const pull = Math.min(strength, INHALE.PREY_PULL_CAP * moveSpeed(prey.width)) * deltaTime;
      prey.nudge(((mouthX - px) / d) * pull, ((mouthY - py) / d) * pull, state.worldWidth, state.worldHeight);
    });
    fadeLocks(state, eater, locked, deltaTime);
    // Capture: a creature it could swallow, held at its mouth, is caught for up to CANNON.HOLD_MS. Still
    // inhaling when that ends, it swallows it; letting go first launches it (letGo)
    const captive = eater.gulping ? state.players.get(eater.gulping) : undefined;
    if (captive && captive.capturedBy === eater.sessionId && captive.state === PLAYER_STATE.ALIVE) {
      if (holdCaptive(state, eater, captive, mouthX, mouthY, now, deltaTime)) {
        if (eater.swallowHeld >= CANNON.SWALLOW_MS && canSwallowWhole(eater.width, captive.width, captive.gems)) {
          eater.gulping = "";
          captive.capturedBy = "";
          captive.struggle = 0;
          captive.swallowable = false;
          captive.swallowing = 0;
          swallow(state, eater, captive, now);
        } else if (state.time >= eater.gulpEndsAt) {
          // The hold is over without a swallow: the captive goes free
          eater.gulping = "";
          free(captive, Math.cos(eater.facing), Math.sin(eater.facing), now);
        }
      }
    } else {
      if (eater.gulping) eater.gulping = "";
      const caught = held as PlayerSchema | null;
      if (caught) {
        eater.gulping = caught.sessionId;
        eater.gulpEndsAt = state.time + CANNON.HOLD_MS;
        eater.captureStartedAt = now;
        eater.swallowHeld = 0;
        caught.capturedBy = eater.sessionId;
        caught.captureDistance = heldAt;
        caught.struggle = 0;
        caught.swallowable = canSwallowWhole(eater.width, caught.width, caught.gems);
        caught.swallowing = 0;
        caught.stopInhale(now);
        caught.dropLatch();
      }
    }
    steal(state, eater, now, deltaTime);
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

/** Whether `eater` is big enough to swallow `prey` whole: INHALE.EAT_RATIO times as wide */
export function canSwallow(_state: GameState, eater: PlayerSchema, prey: PlayerSchema) : boolean {
  // ...or it has no gems left to hold it together: then anyone can suck it up
  return (prey.gems <= 0 && eater.width > prey.width) || prey.width * INHALE.EAT_RATIO <= eater.width;
}

/**
 * How squarely `victim` sits in `thief`'s inhale: 0 when no part of it is in the cone, up to 1
 * dead center (or right against the mouth). The drain is shared out by state.
 */
export function stealWeight(state: GameState, thief: PlayerSchema, victim: PlayerSchema) : number {
  if (!thief.inhaling || thief.state !== PLAYER_STATE.ALIVE || victim.state !== PLAYER_STATE.ALIVE || victim.spawnProtected) return 0;
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
 * to swallow is pulled in bodily too). An inhale's drain is shared out by how squarely each victim
 * sits in the cone, and grows only with the square root of how many it catches, so a big cone
 * covers more creatures without draining each one as fast. A victim's share drains at INHALE.STEAL_RATE a second,
 * whatever either one's size (mass resists being pulled, not being robbed). Two creatures inhaling
 * each other both steal at once. Take someone's last gem and they're drained: gone until they respawn.
 */
export function steal(state: GameState, thief: PlayerSchema, now: number, deltaTime: number) : void {
  const victims: { victim: PlayerSchema; weight: number }[] = [];
  state.players.forEach((other) => {
    if (other === thief || other.gems <= 0) return;
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
    let progress = (thief.stealShares.get(victim.sessionId) ?? 0) + deltaTime * INHALE.STEAL_RATE * budget * (weight / total) * stealStrength(state, thief, victim) * drainRamp(thief.heldFor.get(victim.sessionId) ?? 0) * pressureBuild(thief.heldFor.get(victim.sessionId) ?? 0, thief.width) * scaleDrain(thief.width, victim.width) * (LATCH.OVERLAP_DRAIN_MIN + (1 - LATCH.OVERLAP_DRAIN_MIN) * cleanAir(state.bodyOf(thief), state.bodyOf(victim)));
    while (progress >= 1 && victim.gems > 0) {
      progress -= 1;
      victim.setGems(victim.gems - 1, state.worldWidth, state.worldHeight);
      thief.setGems(thief.gems + 1, state.worldWidth, state.worldHeight);
      thief.stolenTotal += 1;
      victim.robbedTotal += 1;
      if (victim.sessionId === thief.stealingFrom) thief.stolenRun += 1;
    }
    thief.stealShares.set(victim.sessionId, progress);
    if (victim.gems <= 0 && victim.state === PLAYER_STATE.ALIVE) drain(state, victim, now, thief);
  }
}

/** Lost their last gem (robbed, or fed to a turbine): they shrink away to nothing and are out until they respawn */
export function drain(state: GameState, victim: PlayerSchema, now: number, thief?: PlayerSchema) : void {
  state.onEvent?.("vanish", {
    id: victim.sessionId,
    x: Math.round(victim.x + victim.width / 2),
    y: Math.round(victim.y + victim.height / 2),
    size: Math.round(victim.width),
    index: victim.playerIndex,
    facing: Math.round(victim.facing * 100) / 100,
  });
  victim.knockOut(now);
  if (!thief) {
    // Whoever shoved them in gets the credit
    state.credit(victim, "turbine", now);
    return;
  }
  const primary = thief.stealingFrom === victim.sessionId;
  const gems = primary ? thief.stolenRun : 0;
  if (primary) {
    thief.stolenRun = 0;
    endTheft(state, thief, now);
  }
  state.credit(victim, "drained", now, thief.sessionId, { gems });
}

/** A run of stealing ends (or switches to someone else): a big one gets a banner and a line in the feed */
export function endTheft(state: GameState, thief: PlayerSchema, now: number, next = "") : void {
  const victim = thief.stealingFrom ? state.players.get(thief.stealingFrom) : undefined;
  if (victim && thief.stolenRun >= INHALE.STOLE_NOTICE) state.credit(victim, "stole", now, thief.sessionId, { gems: thief.stolenRun });
  thief.stolenRun = 0;
  thief.stealProgress = 0;
  if (thief.stealingFrom !== next) thief.stealingFrom = next;
}

/** Swallowed whole: knocked out; the eater keeps a share of their gems (CANNON.SWALLOW_KEEP) and the rest spray out for anyone */
export function swallow(state: GameState, eater: PlayerSchema, prey: PlayerSchema, now: number) : void {
  const gems = prey.gems;
  const kept = Math.round(gems * CANNON.SWALLOW_KEEP);
  if (kept > 0) eater.setGems(eater.gems + kept, state.worldWidth, state.worldHeight);
  if (gems - kept > 0) sprayGems(state, prey.x + prey.width / 2, prey.y + prey.height / 2, gems - kept, now, eater.sessionId);
  prey.setGems(0, state.worldWidth, state.worldHeight);
  prey.knockOut(now);
  state.credit(prey, "ate", now, eater.sessionId, { gems });
}

/**
 * Holds a captive at its captor's mouth: the captor pulls it back to the hold point (at the captive's
 * own speed times its firmness times how squarely it faces it) while the captive's stick moves it, and
 * pushing sideways twists the captor's aim. False once it slips free (BREAK_GAP); while it's pinned
 * (SUBDUED), the captor's swallow builds.
 */
function holdCaptive(state: GameState, eater: PlayerSchema, captive: PlayerSchema, mouthX: number, mouthY: number, now: number, deltaTime: number): boolean {
  const fx = Math.cos(eater.facing);
  const fy = Math.sin(eater.facing);
  const hx = mouthX + fx * captive.width * 0.45;
  const hy = mouthY + fy * captive.width * 0.45;
  const cx = captive.x + captive.width / 2;
  const cy = captive.y + captive.height / 2;
  const tx = cx - (eater.x + eater.width / 2);
  const ty = cy - (eater.y + eater.height / 2);
  const squarely = Math.max(0, (tx * fx + ty * fy) / (Math.hypot(tx, ty) || 1));
  const steer = captive.steerInput();
  const speed = moveSpeed(captive.width);
  const side = steer.x * -fy + steer.y * fx;
  // (twisting it away from the side the captive pushes to, so the captive slips round to where the hold is weak)
  eater.facing -= deltaTime * CANNON.AIM_TWIST * side * Math.min(1, (captive.width / eater.width) * 2);
  let dx = steer.x * speed * deltaTime;
  let dy = steer.y * speed * deltaTime;
  const ox = hx - (cx + dx);
  const oy = hy - (cy + dy);
  const od = Math.hypot(ox, oy);
  // The grip pulls it back along the captor's facing at full strength, but only HOLD_SIDEWAYS as hard
  // across it (suction holds you in the stream, not beside it): slipping sideways is how you get out
  const grip = speed * CANNON.HOLD_RATIO * holdFirmness(eater.width, captive.width) * squarely * deltaTime;
  if (od > 1e-6) {
    const along = ox * fx + oy * fy;
    const across = ox * -fy + oy * fx;
    const alongPull = Math.sign(along) * Math.min(Math.abs(along), grip);
    const acrossPull = Math.sign(across) * Math.min(Math.abs(across), grip * CANNON.HOLD_SIDEWAYS);
    dx += fx * alongPull - fy * acrossPull;
    dy += fy * alongPull + fx * acrossPull;
  }
  captive.nudge(dx, dy, state.worldWidth, state.worldHeight);
  // Free once it's pushed out far enough (BREAK_GAP, BREAK_MARGIN); pinned within SUBDUED of the hold point
  const nx = captive.x + captive.width / 2;
  const ny = captive.y + captive.height / 2;
  const holdAt = captive.width * 0.45;
  const breakAt = Math.max(holdAt + captive.width * CANNON.BREAK_GAP, captive.captureDistance) + CANNON.BREAK_MARGIN;
  const fromMouth = Math.hypot(nx - mouthX, ny - mouthY);
  captive.struggle = Math.max(0, Math.min(1, (fromMouth - holdAt) / Math.max(1, breakAt - holdAt)));
  if (fromMouth >= breakAt) {
    eater.gulping = "";
    const ad = Math.hypot(tx, ty) || 1;
    free(captive, tx / ad, ty / ad, now);
    return false;
  }
  if (Math.hypot(nx - hx, ny - hy) <= Math.max(8, captive.width * CANNON.SUBDUED)) eater.swallowHeld += deltaTime * 1000;
  captive.swallowable = canSwallowWhole(eater.width, captive.width, captive.gems);
  captive.swallowing = captive.swallowable ? Math.min(1, eater.swallowHeld / CANNON.SWALLOW_MS) : 0;
  return true;
}

/** A captive goes free: pushed clear along (ax, ay), and safe from being caught again for a moment */
function free(captive: PlayerSchema, ax: number, ay: number, now: number): void {
  captive.capturedBy = "";
  captive.struggle = 0;
  captive.swallowable = false;
  captive.swallowing = 0;
  captive.recaptureAfter = now + CANNON.RECAPTURE_MS;
  captive.skid(ax, ay, CANNON.BREAK_PUSH);
}

/**
 * Its captor stopped inhaling. Only a deliberate release (the button let go after the capture began,
 * held at least LAUNCH_MIN_MS, the captor still alive and not stunned) launches the captive, along its
 * facing shifted by the captive's own push; breath running out, a stun, being caught or knocked out
 * itself, all just let it go, harmlessly.
 */
export function letGo(state: GameState, eater: PlayerSchema, now: number): void {
  const captive = state.players.get(eater.gulping);
  eater.gulping = "";
  if (!captive || captive.capturedBy !== eater.sessionId) return;
  const deliberate = eater.releasedAt >= eater.captureStartedAt;
  if (deliberate && eater.state === PLAYER_STATE.ALIVE && !eater.stunned && !eater.capturedBy && captive.state === PLAYER_STATE.ALIVE && now - eater.captureStartedAt >= CANNON.LAUNCH_MIN_MS) {
    const steer = captive.steerInput();
    const angle = launchAngle(eater.facing, steer.x, steer.y);
    const speed = launchSpeed(eater.width);
    captive.launch(now, Math.cos(angle) * speed, Math.sin(angle) * speed, eater.sessionId, CANNON.MAX_MS);
  } else {
    free(captive, Math.cos(eater.facing), Math.sin(eater.facing), now);
  }
}
