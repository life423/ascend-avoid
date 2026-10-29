import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState } from '../types/synced';
import { FONT } from './style';
import { formatGems } from '../utils/score';

export interface CannonHitEffect { x: number; y: number; size: number; angle: number; lost: number; out: boolean; targetId: string; local: boolean; at: number }

/** Authoritative contact feedback. No damage, rewards, input delay or simulation hit-stop. */
export function drawCannonHits(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, now: number): void {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const unit = mode.cssScale / Math.max(.001, Math.abs(ctx.getTransform().a));
  mode.cannonHits = mode.cannonHits.filter(hit => now - hit.at < 900);
  for (const hit of mode.cannonHits) {
    const age = now - hit.at, t = Math.min(1, age / 520), r = Math.max(18 * unit, hit.size / 2);
    ctx.save(); ctx.translate(hit.x, hit.y);
    // A short directional shock fan and shell rim read at phone scale, even when text banners are hidden.
    if (!reduced && age < 520) {
      ctx.globalAlpha = (1 - t) * .85;
      ctx.strokeStyle = hit.out ? '#ffe3b0' : '#ffd27f'; ctx.lineWidth = (2 + (1 - t) * 3) * unit;
      ctx.beginPath(); ctx.arc(0, 0, r * (1 + .65 * t), hit.angle - 1.2, hit.angle + 1.2); ctx.stroke();
      for (let i = 0; i < 9; i++) {
        const angle = hit.angle + (i - 4) * .24, inner = r * (1 + t * .85), outer = inner + (10 + (1 - t) * 18) * unit;
        ctx.lineWidth = (i % 2 ? 1.3 : 2) * unit; ctx.beginPath();
        ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner); ctx.lineTo(Math.cos(angle) * outer, Math.sin(angle) * outer); ctx.stroke();
      }
    }
    if (age < 260) {
      ctx.globalAlpha = (1 - age / 260) * (reduced ? .55 : .85);
      ctx.strokeStyle = '#fff4df'; ctx.lineWidth = 3 * unit;
      ctx.beginPath(); ctx.arc(0, 0, r * .97, 0, Math.PI * 2); ctx.stroke();
    }
    if (hit.local) {
      const target = state.players.get(hit.targetId), lift = reduced ? 0 : Math.min(18, age / 40);
      const dx = target?.state === 'alive' ? target.x + target.width / 2 - hit.x : 0;
      const dy = target?.state === 'alive' ? target.y + target.height / 2 - hit.y : 0;
      ctx.globalAlpha = Math.min(1, (900 - age) / 220);
      ctx.font = `800 ${13 * unit}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
      const label = hit.out ? 'SHATTERED' : hit.lost > 0 ? `−${formatGems(hit.lost)} gems` : 'SHIELDED';
      ctx.lineWidth = 4 * unit; ctx.strokeStyle = '#07111e'; ctx.strokeText(label, dx, dy - r - (16 + lift) * unit);
      ctx.fillStyle = hit.out ? '#ffe3b0' : '#fff4df'; ctx.fillText(label, dx, dy - r - (16 + lift) * unit);
    }
    ctx.restore();
  }
}
