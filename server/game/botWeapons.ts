import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { BOTS } from '../constants/gameConstants.js';

/** Decisions only: pickup, claims, carrying and deployment go through the ordinary weapon system. */
export class BotWeaponPlan {
  private placement: { x: number; y: number; ready: number; timeout: number; buildAt: number; kind: string } | null = null;

  goal(world: GameState, bot: PlayerSchema, now: number): { x: number; y: number } | null {
    if (!world.weaponsOn) { this.placement = null; return null; }
    const w = world.pinwheel, cx = bot.x + bot.width / 2, cy = bot.y + bot.height / 2;
    if (w.phase === 'carried' && w.owner === bot.sessionId) {
      if (!this.placement || this.placement.buildAt !== w.at || this.placement.kind !== w.kind) {
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
          buildAt: w.at, kind: w.kind,
        };
      }
      return this.placement;
    }
    this.placement = null;
    if (w.phase !== 'parts' || (w.owner && w.owner !== bot.sessionId && world.time < w.claimUntil)) return null;
    // One nearby AI volunteers for an unclaimed build; ordinary contact can still claim it for anyone.
    // This is a crowd-avoidance decision, not a restriction on other players' abilities.
    if (!w.owner) {
      let volunteer = '';
      let best: number = BOTS.GEM_SIGHT;
      world.brains.forEach((brain, id) => {
        const p = world.players.get(id);
        if (!p || p.state !== 'alive' || p.stunned || p.sliding || p.recovering || p.gulping || p.capturedBy || p.flying || brain.isDisengaging(now)) return;
        let d = Infinity;
        for (const part of w.parts) if (!part.carriedBy && !part.owner) d = Math.min(d, Math.hypot(part.x - p.x - p.width / 2, part.y - p.y - p.height / 2));
        if (d < best || (d === best && id < volunteer)) { best = d; volunteer = id; }
      });
      if (volunteer !== bot.sessionId) return null;
    }
    let target: { x: number; y: number } | null = null, distance = Infinity;
    for (const part of w.parts) {
      if (part.carriedBy || (part.owner && part.owner !== bot.sessionId)) continue;
      const d = Math.hypot(part.x - cx, part.y - cy);
      if (d < distance) { distance = d; target = { x: part.x, y: part.y }; }
    }
    return target;
  }

  readyToPlace(world: GameState, bot: PlayerSchema, now: number): boolean {
    if (!this.placement || world.pinwheel.phase !== 'carried' || world.pinwheel.owner !== bot.sessionId) return false;
    if (this.placement.buildAt !== world.pinwheel.at || this.placement.kind !== world.pinwheel.kind) return false;
    const d = Math.hypot(bot.x + bot.width / 2 - this.placement.x, bot.y + bot.height / 2 - this.placement.y);
    return now >= this.placement.ready && (d <= 65 || now >= this.placement.timeout);
  }

  placed(): void { this.placement = null; }
}
