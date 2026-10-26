import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { WeaponPartSchema, WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { EXHALE, INHALE, PINWHEEL, SHOCKWAVE, type WeaponKind } from '../constants/gameConstants.js';
import { sweptHit } from '../game/cannon.js';
import { sprayGems } from './gems.js';
import { updateShockwave } from './shockwave.js';
import { knockOutWithGems } from './inhale.js';

export function spawnWeapon(state: GameState, x = state.worldWidth / 2, y = state.worldHeight / 2, kind: WeaponKind = 'pinwheel'): void {
  const w = state.pinwheel;
  w.parts.clear(); w.bolts.clear(); w.hitAt.clear();
  w.kind = kind; w.beatAt = w.pulseAt = 0; w.pulseHits.clear(); w.pulseDistances.clear();
  w.phase = 'parts'; w.at = state.time + PINWHEEL.PARTS_MS;
  w.owner = ''; w.claimUntil = 0; w.progress = 0;
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
function claimPart(state: GameState, part: WeaponPartSchema, player: PlayerSchema): void {
  const w = state.pinwheel;
  if (!w.owner) { w.owner = player.sessionId; w.claimUntil = state.time + PINWHEEL.CLAIM_MS; }
  part.owner = player.sessionId;
  part.carriedBy = player.sessionId;
  const bit = 1 << part.kind;
  if (w.owner === player.sessionId && !(w.progress & bit)) {
    w.progress |= bit;
    w.claimUntil = state.time + PINWHEEL.CLAIM_MS;
  }
}

export function puffWeaponParts(state: GameState, player: PlayerSchema): void {
  if (state.pinwheel.phase !== 'parts') return;
  const fx = Math.cos(player.facing), fy = Math.sin(player.facing);
  const mx = player.x + player.width * 0.5 + fx * player.width * 0.3;
  const my = player.y + player.height * 0.5 + fy * player.height * 0.3;
  for (const part of state.pinwheel.parts) {
    const dx = part.x - mx, dy = part.y - my, d = Math.hypot(dx, dy);
    if (d < 1 || d > EXHALE.REACH + player.width * EXHALE.REACH_PER_SIZE || (dx * fx + dy * fy) / d < Math.cos(EXHALE.ARC * Math.PI / 180)) continue;
    part.carriedBy = '';
    part.vx = dx / d * PINWHEEL.GUST_SPEED; part.vy = dy / d * PINWHEEL.GUST_SPEED;
  }
}

export function deployWeapon(state: GameState, player: PlayerSchema): boolean {
  const w = state.pinwheel;
  if (w.phase !== 'carried' || w.owner !== player.sessionId || player.state !== 'alive' || player.stunned || player.capturedBy || player.flying) return false;
  const radius = player.width / 2 + 72;
  w.x = Math.max(56, Math.min(state.worldWidth - 56, player.x + player.width / 2 + Math.cos(player.facing) * radius));
  w.y = Math.max(56, Math.min(state.worldHeight - 56, player.y + player.height / 2 + Math.sin(player.facing) * radius));
  w.phase = 'charging'; w.at = state.time + (w.kind === 'pulsar' ? SHOCKWAVE.CHARGE_MS : PINWHEEL.CHARGE_MS); w.angle = player.facing;
  return true;
}

export function updateWeapons(state: GameState, dt: number, now: number): void {
  if (!state.weaponsOn) return;
  const w = state.pinwheel;
  if (w.phase === 'waiting') {
    if (state.time >= w.at && state.players.size > 0 && !state.shiftsOn) spawnWeapon(state, undefined, undefined, w.kind);
    return;
  }
  if (w.owner && (!state.players.has(w.owner) || (w.phase === 'parts' && state.time >= w.claimUntil))) {
    w.owner = ''; w.claimUntil = 0; w.progress = 0;
    for (const p of w.parts) p.owner = '';
    if (w.phase !== 'parts') { retireWeapon(state); return; }
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
        if (!part.owner) claimPart(state, part, puller);
        else part.carriedBy = puller.sessionId;
        continue;
      }
      const mx = puller.x + puller.width / 2 + Math.cos(puller.facing) * puller.width * 0.3;
      const my = puller.y + puller.height / 2 + Math.sin(puller.facing) * puller.height * 0.3;
      const step = Math.min(nearest, PINWHEEL.PULL_SPEED * dt);
      if (nearest > 0) { part.x += (mx - part.x) / nearest * step; part.y += (my - part.y) / nearest * step; }
      if (nearest - step < PINWHEEL.PART_RADIUS + 12) {
        if (!part.owner) claimPart(state, part, puller);
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
    if (w.phase === 'parts' && state.time >= w.at) retireWeapon(state);
    return;
  }
  if (w.phase === 'carried') {
    const carrier = state.players.get(w.owner);
    if (carrier && carrier.state === 'alive' && !carrier.capturedBy && !carrier.flying) {
      const radius = carrier.width / 2 + 58;
      w.x = Math.max(56, Math.min(state.worldWidth - 56, carrier.x + carrier.width / 2 - Math.cos(carrier.facing) * radius));
      w.y = Math.max(56, Math.min(state.worldHeight - 56, carrier.y + carrier.height / 2 - Math.sin(carrier.facing) * radius));
      w.angle = carrier.facing;
    } else { w.phase = 'charging'; w.at = state.time + (w.kind === 'pulsar' ? SHOCKWAVE.CHARGE_MS : PINWHEEL.CHARGE_MS); }
    return;
  }
  if (w.phase === 'charging' && state.time >= w.at) {
    w.phase = 'active'; w.at = state.time + (w.kind === 'pulsar' ? SHOCKWAVE.ACTIVE_MS : PINWHEEL.ACTIVE_MS);
    w.nextShotAt = state.time + PINWHEEL.SHOT_MS; w.beatAt = state.time + SHOCKWAVE.WINDUP_MS;
  }
  if (w.phase === 'active' && state.time >= w.at) { retireWeapon(state); return; }
  if (w.kind === 'pulsar') {
    if (w.phase === 'active') updateShockwave(state, dt, now);
    return;
  }
  if (w.phase === 'active') {
    w.angle = (w.angle + PINWHEEL.SPIN * dt) % (Math.PI * 2);
    if (state.time >= w.nextShotAt) {
      const bolt = new WeaponBoltSchema(); bolt.angle = w.angle; bolt.bornAt = state.time;
      bolt.x = w.x + Math.cos(w.angle) * 48; bolt.y = w.y + Math.sin(w.angle) * 48;
      w.bolts.set(String(w.nextBolt++), bolt); w.nextShotAt = state.time + PINWHEEL.SHOT_MS;
    }
  }
  for (const [id, bolt] of w.bolts.entries()) {
    const x = bolt.x, y = bolt.y;
    bolt.x += Math.cos(bolt.angle) * PINWHEEL.BOLT_SPEED * dt; bolt.y += Math.sin(bolt.angle) * PINWHEEL.BOLT_SPEED * dt;
    if ((state.time - bolt.bornAt) * PINWHEEL.BOLT_SPEED / 1000 > PINWHEEL.BOLT_RANGE || bolt.x < 0 || bolt.y < 0 || bolt.x > state.worldWidth || bolt.y > state.worldHeight) { w.bolts.delete(id); continue; }
    for (const p of state.players.values()) {
      if (p.sessionId === w.owner || p.state !== 'alive' || p.spawnProtected || p.capturedBy || p.flying || state.time < (w.hitAt.get(p.sessionId) ?? 0)) continue;
      if (!sweptHit(x, y, bolt.x, bolt.y, p.x + p.width / 2, p.y + p.height / 2, p.width / 2 + PINWHEEL.BOLT_RADIUS)) continue;
      const hitX = p.x + p.width / 2, hitY = p.y + p.height / 2, size = p.width;
      // Stronger bolts, but a giant has more staying power than a newcomer.
      let lost = Math.min(p.gems, Math.ceil(p.gems * PINWHEEL.HIT_SHARE), Math.max(PINWHEEL.HIT_MIN_GEMS, Math.ceil(Math.sqrt(p.gems) * PINWHEEL.HIT_PER_ROOT)));
      const out = p.gems - lost < PINWHEEL.KO_GEMS;
      if (out) { lost = p.gems; knockOutWithGems(state, p, now); }
      else {
        p.injure(state.time);
        p.setGems(p.gems - lost, state.worldWidth, state.worldHeight);
        sprayGems(state, hitX, hitY, lost, now, p.sessionId);
        p.skid(Math.cos(bolt.angle), Math.sin(bolt.angle), PINWHEEL.HIT_PUSH);
      }
      state.credit(p, 'pinwheel', now, w.owner, { gems: lost, out, x: hitX, y: hitY, size });
      w.hitAt.set(p.sessionId, state.time + PINWHEEL.HIT_IMMUNE_MS); w.bolts.delete(id); break;
    }
  }
}

function retireWeapon(state: GameState): void {
  const w = state.pinwheel;
  w.kind = w.kind === 'pulsar' ? 'pinwheel' : 'pulsar';
  w.phase = 'waiting'; w.at = state.time + PINWHEEL.RESPAWN_MS;
  w.owner = ''; w.claimUntil = 0; w.progress = 0;
  w.parts.clear(); w.bolts.clear(); w.pulseHits.clear(); w.pulseDistances.clear();
  w.pulseAt = w.beatAt = 0;
}
