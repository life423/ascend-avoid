import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState } from '../types/synced';
import { BLACK_HOLE, SHIFT } from '../../server/constants/gameConstants';
import { inView } from './shared';

/** Bounded paths, no per-frame glow/gradient. A broken outer ring distinguishes the aim target. */
export function drawBlackHoles(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
  const now = mode.worldNow(state, timestamp), reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  state.blackHoles?.forEach(hole => {
    if (!inView(mode.renderView, hole.x, hole.y, BLACK_HOLE.RING_RADIUS + 12) || (state.floor && state.floor[Math.floor(hole.y / state.worldHeight * SHIFT.GRID) * SHIFT.GRID + Math.floor(hole.x / state.worldWidth * SHIFT.GRID)] !== '1')) return;
    const ready = now >= hole.activeAt, turn = reduced ? 0 : timestamp / 9000;
    ctx.save(); ctx.translate(hole.x, hole.y);
    ctx.fillStyle = '#02030c'; ctx.strokeStyle = ready ? '#d6a0ff' : '#ffd47d';
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, hole.radius, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(184, 133, 255, .3)'; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.ellipse(0, 0, hole.radius + 19, (hole.radius + 19) * .45, -.35, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = ready ? '#aa7ce1' : '#ffd47d';
    for (let i = 0; i < 3; i++) {
      const a = turn + i * Math.PI * 2 / 3;
      ctx.beginPath(); ctx.arc(0, 0, BLACK_HOLE.RING_RADIUS, a, a + 1.25); ctx.stroke();
      const r = BLACK_HOLE.RING_RADIUS - 5, x = Math.cos(a) * r, y = Math.sin(a) * r;
      ctx.beginPath(); ctx.moveTo(x + Math.cos(a - .65) * 8, y + Math.sin(a - .65) * 8);
      ctx.lineTo(x, y); ctx.lineTo(x + Math.cos(a + .65) * 8, y + Math.sin(a + .65) * 8); ctx.stroke();
    }
    // A tiny cannonball trail is a wordless reminder that this is a shot destination.
    ctx.strokeStyle = '#dfc6ff'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-18, 3); ctx.lineTo(-6, 3); ctx.moveTo(-14, -3); ctx.lineTo(-6, -3); ctx.stroke();
    ctx.beginPath(); ctx.arc(5, 0, 7, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  });
}
