import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedPlayer } from '../types/synced';
import { SHOT_FOLLOW } from '../../server/constants/gameConstants';

/** A small offered ring becomes a moving airflow wake only after a fresh held inhale. */
export function drawShotFollow(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, me: SyncedPlayer | undefined, timestamp: number): void {
  const id = mode.multiplayerManager?.localSessionId;
  if (!me || !id || me.state !== 'alive' || me.capturedBy || me.flying || me.followUntil <= mode.worldNow(state, timestamp)) return;
  const at = mode.centerOf(id, me), dx = me.followX - at.x, dy = me.followY - at.y, angle = Math.atan2(dy, dx);
  const u = 1 / Math.max(.001, mode.renderView?.scale ?? 1), r = me.width / 2 + 14 * u;
  ctx.save(); ctx.strokeStyle = me.followActive ? '#80fff1' : '#ffd47d'; ctx.lineWidth = 2 * u;
  if (!me.followActive) ctx.setLineDash([4 * u, 5 * u]);
  ctx.beginPath(); ctx.arc(at.x, at.y, r, angle - .45, angle + .45); ctx.stroke(); ctx.setLineDash([]);
  const reach = Math.min(Math.hypot(dx, dy), SHOT_FOLLOW.MAX_TRAVEL);
  if (me.followActive) {
    ctx.globalAlpha = .45;
    for (let i = 0; i < 7; i++) {
      const f = (i / 7 + timestamp / 700) % 1, d = r + Math.max(0, reach - r) * f;
      const x = at.x + Math.cos(angle) * d, y = at.y + Math.sin(angle) * d;
      ctx.beginPath(); ctx.moveTo(x - Math.cos(angle - .6) * 7 * u, y - Math.sin(angle - .6) * 7 * u); ctx.lineTo(x, y); ctx.lineTo(x - Math.cos(angle + .6) * 7 * u, y - Math.sin(angle + .6) * 7 * u); ctx.stroke();
    }
  } else {
    const x = at.x + Math.cos(angle) * r, y = at.y + Math.sin(angle) * r;
    ctx.beginPath(); ctx.moveTo(x - Math.cos(angle - .6) * 7 * u, y - Math.sin(angle - .6) * 7 * u); ctx.lineTo(x, y); ctx.lineTo(x - Math.cos(angle + .6) * 7 * u, y - Math.sin(angle + .6) * 7 * u); ctx.stroke();
  }
  ctx.restore();
}
