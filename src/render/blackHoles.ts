import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState } from '../types/synced';
import { SHIFT } from '../../server/constants/gameConstants';
import { inView } from './shared';
import { blackHoleLook, blackHoleRingRadius, drawBlackHoleWorld } from './blackHoleStyle';

const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;

/** Bounded paths, no per-frame glow/gradient. A broken outer ring distinguishes the aim target. */
export function drawBlackHoles(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
  const now = mode.worldNow(state, timestamp), pixel = mode.cssScale / (mode.renderView?.scale ?? 1);
  state.blackHoles?.forEach(hole => {
    const look = blackHoleLook(hole, now);
    if (look.phase === 'dormant' || !inView(mode.renderView, hole.x, hole.y, blackHoleRingRadius(hole.radius) + 12) || (state.floor && state.floor[Math.floor(hole.y / state.worldHeight * SHIFT.GRID) * SHIFT.GRID + Math.floor(hole.x / state.worldWidth * SHIFT.GRID)] !== '1')) return;
    ctx.save(); ctx.translate(hole.x, hole.y);
    drawBlackHoleWorld(ctx, hole, look, timestamp, pixel, reducedMotion?.matches ?? false);
    ctx.restore();
  });
}
