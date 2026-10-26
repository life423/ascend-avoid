import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { PinwheelSchema, WeaponPartSchema, WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { EXHALE, INHALE, PINWHEEL, SHOCKWAVE, WEAPON_FLEET, type WeaponKind } from '../constants/gameConstants.js';
import { allWeapons, weaponProfile, orbitalPosition, ionFiring } from '../game/weaponKit.js';
import { sweptHit } from '../game/cannon.js';
import { sprayGems } from './gems.js';
import { updateShockwave } from './shockwave.js';
import { knockOutWithGems } from './inhale.js';

export function initializeWeaponSets(state: GameState, count: number = WEAPON_FLEET.SETS): void {
  state.weaponSets.clear();
  const kinds: WeaponKind[] = ['pulsar', 'pinwheel', 'sentinel', 'ricochet', 'ion', 'comet'];
  for (let i = 0; i < Math.max(1, Math.min(WEAPON_FLEET.SETS, count)); i++) {
    const w = i === 0 ? state.pinwheel : new PinwheelSchema();
    w.fixedRecipe = count > 1; w.kind = kinds[i % kinds.length];
    w.spawnX = count === 1 ? state.worldWidth / 2 : state.worldWidth * ((i % 4) + 1) / 5;
    w.spawnY = count === 1 ? state.worldHeight / 2 : state.worldHeight * (Math.floor(i / 4) + 1) / 4;
    w.phase = 'waiting'; w.at = PINWHEEL.FIRST_MS + i * 150;
    if (i > 0) state.weaponSets.push(w);
  }
}

export function spawnWeapon(state: GameState, x = state.worldWidth / 2, y = state.worldHeight / 2, kind: WeaponKind = 'pinwheel', w = state.pinwheel): void {
  w.parts.clear(); w.bolts.clear(); w.hitAt.clear();
  w.kind = kind; w.beatAt = w.pulseAt = 0; w.pulseHits.clear(); w.pulseDistances.clear();
  w.phase = 'parts'; w.at = state.time + PINWHEEL.PARTS_MS;
  w.owner = ''; w.claimUntil = 0; w.progress = 0;
  w.claimedAt = w.activatedAt = w.nextAimAt = 0;
  w.x = Math.max(400, Math.min(state.worldWidth - 400, x));
  w.y = Math.max(400, Math.min(state.worldHeight - 400, y));
  for (let kind = 0; kind < 3; kind++) {
    const p = new WeaponPartSchema(); p.kind = kind;
    const a = kind * Math.PI * 2 / 3;
    p.x = w.x + Math.cos(a) * 145; p.y = w.y + Math.sin(a) * 145;
    w.parts.push(p);
  }
}

/** First meaningful pickup owns the build; a final contribution cannot steal an active claim. */
function claimPart(state: GameState, w: PinwheelSchema, part: WeaponPartSchema, player: PlayerSchema): void {
  if (!w.owner) {
    w.owner = player.sessionId; w.claimUntil = state.time + PINWHEEL.CLAIM_MS; w.claimedAt = state.time;
    for (const matching of w.parts) matching.owner = player.sessionId;
  }
  part.owner = player.sessionId;
  part.carriedBy = player.sessionId;
  const bit = 1 << part.kind;
  if (w.owner === player.sessionId && !(w.progress & bit)) {
    w.progress |= bit;
    w.claimUntil = state.time + PINWHEEL.CLAIM_MS;
  }
}

export function puffWeaponParts(state: GameState, player: PlayerSchema): void {
  const fx = Math.cos(player.facing), fy = Math.sin(player.facing);
  const mx = player.x + player.width * 0.5 + fx * player.width * 0.3;
  const my = player.y + player.height * 0.5 + fy * player.height * 0.3;
  for (const w of allWeapons(state)) {
    if (w.phase !== 'parts') continue;
    for (const part of w.parts) {
      const dx = part.x - mx, dy = part.y - my, d = Math.hypot(dx, dy);
      if (d < 1 || d > EXHALE.REACH + player.width * EXHALE.REACH_PER_SIZE || (dx * fx + dy * fy) / d < Math.cos(EXHALE.ARC * Math.PI / 180)) continue;
      part.carriedBy = '';
      part.vx = dx / d * PINWHEEL.GUST_SPEED; part.vy = dy / d * PINWHEEL.GUST_SPEED;
    }
  }
}

export function deployWeapon(state: GameState, player: PlayerSchema): boolean {
  const w = allWeapons(state).find(w => w.phase === 'carried' && w.owner === player.sessionId);
  if (!w || player.state !== 'alive' || player.stunned || player.capturedBy || player.flying) return false;
  const radius = player.width / 2 + 72;
  w.x = Math.max(56, Math.min(state.worldWidth - 56, player.x + player.width / 2 + Math.cos(player.facing) * radius));
  w.y = Math.max(56, Math.min(state.worldHeight - 56, player.y + player.height / 2 + Math.sin(player.facing) * radius));
  w.phase = 'charging'; w.at = state.time + (w.kind === 'pulsar' ? SHOCKWAVE.CHARGE_MS : PINWHEEL.CHARGE_MS); w.angle = player.facing;
  w.originX = w.x; w.originY = w.y;
  return true;
}

export function updateWeapons(state: GameState, dt: number, now: number): void {
  if (!state.weaponsOn) return;
  for (const w of allWeapons(state)) updateWeapon(state, w, dt, now);
}

function updateWeapon(state: GameState, w: PinwheelSchema, dt: number, now: number): void {
  const profile = weaponProfile(w.kind);
  if (w.phase === 'waiting') {
    if (state.time >= w.at && state.players.size > 0 && !state.shiftsOn) spawnWeapon(state, w.spawnX || undefined, w.spawnY || undefined, w.kind, w);
    return;
  }
  const owner = state.players.get(w.owner);
  if (w.phase === 'parts' && owner?.state === 'alive' && w.parts.some(p => p.carriedBy === w.owner)) w.claimUntil = state.time + PINWHEEL.CLAIM_MS;
  if (w.owner && (!owner || (owner.state !== 'alive' && (w.phase === 'parts' || w.phase === 'carried')) || (w.phase === 'parts' && state.time >= w.claimUntil))) {
    w.owner = ''; w.claimUntil = 0; w.progress = 0;
    for (const p of w.parts) { p.owner = ''; p.carriedBy = ''; }
    if (w.phase !== 'parts') { retireWeapon(state, w); return; }
  }
  if (w.phase === 'parts') {
    for (const part of w.parts) {
      if (part.owner && !state.players.has(part.owner)) part.owner = '';
      const carrier = state.players.get(part.carriedBy);
      if (carrier && carrier.state === 'alive' && !carrier.capturedBy && !carrier.flying) {
        // Cargo rides behind the creature, independently of inhale, movement and turning.
        const a = carrier.facing + Math.PI + (part.kind - 1) * 0.55;
        const radius = carrier.width / 2 + 43;
        part.x = Math.max(30, Math.min(state.worldWidth - 30, carrier.x + carrier.width / 2 + Math.cos(a) * radius));
        part.y = Math.max(30, Math.min(state.worldHeight - 30, carrier.y + carrier.height / 2 + Math.sin(a) * radius));
        part.vx = part.vy = 0;
        continue;
      }
      part.carriedBy = '';
      const travel = (1 - Math.exp(-5 * dt)) / 5;
      part.x = Math.max(30, Math.min(state.worldWidth - 30, part.x + part.vx * travel));
      part.y = Math.max(30, Math.min(state.worldHeight - 30, part.y + part.vy * travel));
      part.vx *= Math.exp(-5 * dt); part.vy *= Math.exp(-5 * dt);
      // Strong gusts briefly overpower suction; only the current piece owner can pull a claimed part.
      if (Math.hypot(part.vx, part.vy) > 100) continue;
      let puller: PlayerSchema | undefined, nearest = Infinity, touching = false;
      for (const p of state.players.values()) {
        if (p.stunned || p.state !== 'alive' || p.gulping || p.flying || p.capturedBy || (part.owner && part.owner !== p.sessionId)) continue;
        if (w.owner && w.owner !== p.sessionId) continue;
        if (allWeapons(state).some(other => other !== w && other.owner === p.sessionId && (other.phase === 'parts' || other.phase === 'carried'))) continue;
        const contact = Math.hypot(part.x - p.x - p.width / 2, part.y - p.y - p.height / 2);
        if (contact <= p.width / 2 + PINWHEEL.PART_RADIUS) {
          if (!touching || contact < nearest) { puller = p; nearest = contact; touching = true; }
          continue;
        }
        if (touching || !p.inhaling) continue;
        const fx = Math.cos(p.facing), fy = Math.sin(p.facing);
        const mx = p.x + p.width / 2 + fx * p.width * 0.3, my = p.y + p.height / 2 + fy * p.height * 0.3;
        const dx = part.x - mx, dy = part.y - my, d = Math.hypot(dx, dy);
        const carried = part.owner === p.sessionId && d <= PINWHEEL.SNAP;
        if (d > INHALE.REACH + p.width * INHALE.REACH_PER_SIZE || (!carried && d > 1 && (dx * fx + dy * fy) / d < Math.cos(INHALE.ARC * Math.PI / 180))) continue;
        if (d < nearest) { nearest = d; puller = p; }
      }
      if (!puller) continue;
      if (touching) {
        if (!w.owner || !(w.progress & (1 << part.kind))) claimPart(state, w, part, puller);
        else part.carriedBy = puller.sessionId;
        continue;
      }
      const mx = puller.x + puller.width / 2 + Math.cos(puller.facing) * puller.width * 0.3;
      const my = puller.y + puller.height / 2 + Math.sin(puller.facing) * puller.height * 0.3;
      const step = Math.min(nearest, PINWHEEL.PULL_SPEED * dt);
      if (nearest > 0) { part.x += (mx - part.x) / nearest * step; part.y += (my - part.y) / nearest * step; }
      if (nearest - step < PINWHEEL.PART_RADIUS + 12) {
        if (!w.owner || !(w.progress & (1 << part.kind))) claimPart(state, w, part, puller);
        else part.carriedBy = puller.sessionId;
      }
    }
    const hub = w.parts[0];
    if (w.parts.length === 3 && w.owner && hub) {
      // Delivering a new component to the claimed hub is meaningful build progress, even if a rival
      // supplied it. Transfer that component into the existing build without changing its builder.
      if (hub.owner === w.owner) for (const p of w.parts) {
        const bit = 1 << p.kind;
        if (!(w.progress & bit) && Math.hypot(p.x - hub.x, p.y - hub.y) <= PINWHEEL.SNAP) {
          w.progress |= bit; p.owner = w.owner; w.claimUntil = state.time + PINWHEEL.CLAIM_MS;
        }
      }
      const carriedTogether = Boolean(hub.carriedBy) && w.parts.every(p => p.carriedBy === hub.carriedBy);
      if (carriedTogether || w.parts.every(p => Math.hypot(p.x - hub.x, p.y - hub.y) <= PINWHEEL.SNAP && Math.hypot(p.vx, p.vy) < 100)) {
        w.x = w.parts.reduce((sum, p) => sum + p.x, 0) / 3; w.y = w.parts.reduce((sum, p) => sum + p.y, 0) / 3;
        const builder = state.players.get(w.owner);
        if (builder) {
          const cx = builder.x + builder.width / 2, cy = builder.y + builder.height / 2;
          const gap = builder.width / 2 + 72, d = Math.hypot(w.x - cx, w.y - cy);
          if (d < gap) {
            const a = d > 1 ? Math.atan2(w.y - cy, w.x - cx) : builder.facing;
            w.x = Math.max(56, Math.min(state.worldWidth - 56, cx + Math.cos(a) * gap));
            w.y = Math.max(56, Math.min(state.worldHeight - 56, cy + Math.sin(a) * gap));
          }
        }
        w.progress = 7; w.parts.clear(); w.phase = 'carried';
        w.at = 0; w.claimUntil = state.time + PINWHEEL.CLAIM_MS;
        w.angle = state.players.get(w.owner)?.facing ?? 0;
      }
    }
    if (w.phase === 'parts' && state.time >= w.at) retireWeapon(state, w);
    return;
  }
  if (w.phase === 'carried') {
    const carrier = state.players.get(w.owner);
    if (carrier && carrier.state === 'alive' && !carrier.capturedBy && !carrier.flying) {
      const radius = carrier.width / 2 + 58;
      w.x = Math.max(56, Math.min(state.worldWidth - 56, carrier.x + carrier.width / 2 - Math.cos(carrier.facing) * radius));
      w.y = Math.max(56, Math.min(state.worldHeight - 56, carrier.y + carrier.height / 2 - Math.sin(carrier.facing) * radius));
      w.angle = carrier.facing;
    } else { w.phase = 'charging'; w.at = state.time + (w.kind === 'pulsar' ? SHOCKWAVE.CHARGE_MS : PINWHEEL.CHARGE_MS); w.originX = w.x; w.originY = w.y; }
    return;
  }
  if (w.phase === 'charging' && state.time >= w.at) {
    w.phase = 'active'; w.at = state.time + weaponProfile(w.kind).activeMs; w.activatedAt = state.time;
    w.nextShotAt = state.time + weaponProfile(w.kind).shotMs; w.beatAt = state.time + SHOCKWAVE.WINDUP_MS;
  }
  if (w.phase === 'active' && state.time >= w.at) { retireWeapon(state, w); return; }
  if (w.phase === 'active' && profile.orbit) {
    const position = orbitalPosition(w.originX, w.originY, state.time - w.activatedAt, state.worldWidth, state.worldHeight);
    w.x = position.x; w.y = position.y;
  }
  if (w.kind === 'pulsar') {
    if (w.phase === 'active') updateShockwave(state, dt, now, w);
    return;
  }
  if (w.phase === 'active') {
    if (profile.aimed && state.time >= w.nextAimAt) {
      let distance = profile.range;
      for (const p of state.players.values()) {
        if (!canHit(w, p, state.time)) continue;
        const dx = p.x + p.width / 2 - w.x, dy = p.y + p.height / 2 - w.y, d = Math.hypot(dx, dy);
        if (d < distance) { distance = d; w.angle = Math.atan2(dy, dx); }
      }
      w.nextAimAt = Infinity;
    } else if (!profile.aimed) w.angle = (w.angle + (w.kind === 'ion' ? .75 : PINWHEEL.SPIN) * dt) % (Math.PI * 2);
    if (w.kind === 'ion') {
      if (ionFiring(state.time - w.activatedAt)) for (const p of state.players.values()) {
        if (!canHit(w, p, state.time)) continue;
        if (sweptHit(w.x, w.y, w.x + Math.cos(w.angle) * WEAPON_FLEET.ION_RANGE, w.y + Math.sin(w.angle) * WEAPON_FLEET.ION_RANGE, p.x + p.width / 2, p.y + p.height / 2, p.width / 2 + 10)) damagePlayer(state, w, p, now, w.angle);
      }
      return;
    }
    if (state.time >= w.nextShotAt) {
      const bolt = new WeaponBoltSchema(); bolt.angle = w.angle; bolt.bornAt = state.time;
      bolt.x = w.x + Math.cos(w.angle) * 48; bolt.y = w.y + Math.sin(w.angle) * 48;
      w.bolts.set(String(w.nextBolt++), bolt); w.nextShotAt = state.time + profile.shotMs;
      if (profile.aimed) w.nextAimAt = state.time + 1;
    }
  }
  for (const [id, bolt] of w.bolts.entries()) {
    const x = bolt.x, y = bolt.y, travelAngle = bolt.angle;
    bolt.x += Math.cos(bolt.angle) * profile.speed * dt; bolt.y += Math.sin(bolt.angle) * profile.speed * dt;
    if ((state.time - bolt.bornAt) * profile.speed / 1000 > profile.range) { w.bolts.delete(id); continue; }
    if (bolt.x < 0 || bolt.y < 0 || bolt.x > state.worldWidth || bolt.y > state.worldHeight) {
      if (w.kind !== 'ricochet' || bolt.bounces >= 2) { w.bolts.delete(id); continue; }
      const vx = Math.cos(bolt.angle) * (bolt.x < 0 || bolt.x > state.worldWidth ? -1 : 1);
      const vy = Math.sin(bolt.angle) * (bolt.y < 0 || bolt.y > state.worldHeight ? -1 : 1);
      bolt.angle = Math.atan2(vy, vx); bolt.bounces++;
      bolt.x = Math.max(0, Math.min(state.worldWidth, bolt.x)); bolt.y = Math.max(0, Math.min(state.worldHeight, bolt.y));
    }
    for (const p of state.players.values()) {
      if (!canHit(w, p, state.time)) continue;
      if (!sweptHit(x, y, bolt.x, bolt.y, p.x + p.width / 2, p.y + p.height / 2, p.width / 2 + profile.radius)) continue;
      damagePlayer(state, w, p, now, travelAngle); w.bolts.delete(id); break;
    }
  }
}

function canHit(w: PinwheelSchema, p: PlayerSchema, time: number): boolean {
  return p.sessionId !== w.owner && p.state === 'alive' && !p.spawnProtected && !p.capturedBy && !p.flying && time >= (w.hitAt.get(p.sessionId) ?? 0);
}

function damagePlayer(state: GameState, w: PinwheelSchema, p: PlayerSchema, now: number, angle: number): void {
  const profile = weaponProfile(w.kind), x = p.x + p.width / 2, y = p.y + p.height / 2, size = p.width;
  let lost = Math.min(p.gems, Math.ceil(p.gems * profile.share), Math.max(profile.minimum, Math.ceil(Math.sqrt(p.gems) * profile.root)));
  const out = p.gems - lost < PINWHEEL.KO_GEMS;
  if (out) { lost = p.gems; knockOutWithGems(state, p, now); }
  else {
    p.injure(state.time); p.setGems(p.gems - lost, state.worldWidth, state.worldHeight);
    sprayGems(state, x, y, lost, now, p.sessionId); p.skid(Math.cos(angle), Math.sin(angle), PINWHEEL.HIT_PUSH);
  }
  state.credit(p, w.kind, now, w.owner, { gems: lost, out, x, y, size });
  w.hitAt.set(p.sessionId, state.time + (w.kind === 'ion' ? 900 : PINWHEEL.HIT_IMMUNE_MS));
}

function retireWeapon(state: GameState, w: PinwheelSchema): void {
  if (!w.fixedRecipe) w.kind = w.kind === 'pulsar' ? 'pinwheel' : 'pulsar';
  w.phase = 'waiting'; w.at = state.time + PINWHEEL.RESPAWN_MS;
  w.owner = ''; w.claimUntil = 0; w.progress = 0;
  w.parts.clear(); w.bolts.clear(); w.pulseHits.clear(); w.pulseDistances.clear();
  w.pulseAt = w.beatAt = 0;
}
