import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { BOTS } from '../constants/gameConstants.js';
import { allWeapons } from './weaponKit.js';
import type { PinwheelSchema } from '../schema/PinwheelSchema.js';

/** Decisions only: pickup, claims, carrying and deployment go through the ordinary weapon system. */
export class BotWeaponPlan {
  private placement: { x: number; y: number; ready: number; timeout: number; buildAt: number; kind: string; weapon: PinwheelSchema } | null = null;

  goal(world: GameState, bot: PlayerSchema, now: number): { x: number; y: number } | null {
    if (!world.weaponsOn) { this.placement = null; return null; }
    const cx = bot.x + bot.width / 2, cy = bot.y + bot.height / 2;
    const builds = allWeapons(world);
    const w = builds.find(w => w.owner === bot.sessionId && (w.phase === 'parts' || w.phase === 'carried'))
      ?? builds.filter(w => w.phase === 'parts' && !w.owner && volunteer(world, w, now) === bot.sessionId)
        .sort((a, b) => nearestPart(a, cx, cy) - nearestPart(b, cx, cy))[0];
    if (!w) { this.placement = null; return null; }
    if (w.phase === 'carried' && w.owner === bot.sessionId) {
      if (!this.placement || this.placement.weapon !== w || this.placement.buildAt !== w.at || this.placement.kind !== w.kind) {
        let aim = { x: Math.cos(bot.facing), y: Math.sin(bot.facing) };
        let nearest: number = BOTS.GEM_SIGHT;
        world.players.forEach(other => {
          if (other === bot || other.state !== 'alive' || other.spawnProtected || other.capturedBy || other.flying) return;
          const dx = other.x + other.width / 2 - cx, dy = other.y + other.height / 2 - cy, d = Math.hypot(dx, dy);
          if (d > 0 && d < nearest) { nearest = d; aim = { x: dx / d, y: dy / d }; }
        });
        const margin = bot.width / 2 + 16;
        this.placement = {
          x: Math.max(margin, Math.min(world.worldWidth - margin, cx + aim.x * 150)),
          y: Math.max(margin, Math.min(world.worldHeight - margin, cy + aim.y * 150)),
          ready: now + BOTS.WEAPON_PLACE_READ_MS, timeout: now + BOTS.WEAPON_PLACE_WAIT_MS,
          buildAt: w.at, kind: w.kind, weapon: w,
        };
      }
      return this.placement;
    }
    this.placement = null;
    if (w.phase !== 'parts' || (w.owner && w.owner !== bot.sessionId && world.time < w.claimUntil)) return null;
    let target: { x: number; y: number } | null = null, distance = Infinity;
    for (const part of w.parts) {
      if (part.carriedBy || (part.owner && part.owner !== bot.sessionId)) continue;
      const d = Math.hypot(part.x - cx, part.y - cy);
      if (d < distance) { distance = d; target = { x: part.x, y: part.y }; }
    }
    return target;
  }

  readyToPlace(world: GameState, bot: PlayerSchema, now: number): boolean {
    const w = this.placement?.weapon;
    if (!this.placement || !w || !allWeapons(world).includes(w) || w.phase !== 'carried' || w.owner !== bot.sessionId) return false;
    if (this.placement.buildAt !== w.at || this.placement.kind !== w.kind) return false;
    const d = Math.hypot(bot.x + bot.width / 2 - this.placement.x, bot.y + bot.height / 2 - this.placement.y);
    return now >= this.placement.ready && (d <= 65 || now >= this.placement.timeout);
  }

  placed(): void { this.placement = null; }
}

function nearestPart(w: PinwheelSchema, x: number, y: number): number {
  let distance = Infinity;
  for (const p of w.parts) if (!p.carriedBy) distance = Math.min(distance, Math.hypot(p.x - x, p.y - y));
  return distance;
}

function volunteer(world: GameState, w: PinwheelSchema, now: number): string {
  let id = '', distance: number = BOTS.GEM_SIGHT;
  world.brains.forEach((brain, candidate) => {
    const p = world.players.get(candidate);
    if (!p || p.state !== 'alive' || p.stunned || p.sliding || p.recovering || p.gulping || p.capturedBy || p.flying || brain.isDisengaging(now)) return;
    if (allWeapons(world).some(build => build.owner === candidate && (build.phase === 'parts' || build.phase === 'carried'))) return;
    const d = nearestPart(w, p.x + p.width / 2, p.y + p.height / 2);
    if (d < distance || (d === distance && candidate < id)) { id = candidate; distance = d; }
  });
  return id;
}
