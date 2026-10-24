import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState } from '../types/synced';
import type { View } from './shared';
import { SURGE } from '../../server/constants/gameConstants';
import { COMPACT, FONT, GOLD, hudPanel } from './style';

export function drawSurge(_mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
    if (state.surgePhase === 'waiting' || !state.surgePhase) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(state.surgeX, state.surgeY, SURGE.RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 209, 102, ${state.surgePhase === 'active' ? 0.09 : 0.035})`;
    ctx.fill();
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.5 + 0.2 * Math.sin(timestamp / 240)})`;
    ctx.lineWidth = 4;
    ctx.setLineDash(state.surgePhase === 'warning' ? [14, 10] : []);
    ctx.stroke();
    ctx.fillStyle = GOLD;
    ctx.font = `800 22px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(state.surgePhase === 'warning' ? 'GEM SURGE INCOMING' : 'GEM SURGE', state.surgeX, state.surgeY - SURGE.RADIUS - 20);
    ctx.restore();
}

/** Countdown plus a direction arrow; visible even when the contest is off screen. */
export function drawSurgeHud(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, view: View, timestamp: number): void {
    if (state.surgePhase === 'waiting' || !state.surgePhase) { mode.surgeNotice = null; return; }
    const key = `${state.surgePhase}:${state.surgeAt}:${state.jackpotOn}`;
    if (mode.surgeNotice?.key !== key) mode.surgeNotice = { key, at: timestamp };
    if (timestamp - mode.surgeNotice.at >= 3000) return;
    const u = COMPACT.matches ? mode.cssScale : 1;
    const width = Math.min(canvas.width - 24 * u, 290 * u);
    const x = (canvas.width - width) / 2;
    const y = COMPACT.matches ? Math.max(166 * u, mode.minimapBottom + 12 * u) : 14;
    const seconds = Math.max(0, Math.ceil((state.surgeAt - mode.worldNow(state, timestamp)) / 1000));
    ctx.save();
    hudPanel(ctx, x, y, width, 42 * u, 12 * u);
    ctx.fillStyle = GOLD;
    ctx.font = `700 ${12 * u}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const label = state.surgePhase === 'warning' ? `Gem surge in ${seconds}s` : state.jackpotOn ? `Jackpot! ${seconds}s left` : `Gem surge · ${seconds}s left`;
    ctx.fillText(label, canvas.width / 2 + 10 * u, y + 21 * u, width - 58 * u);
    const angle = Math.atan2(state.surgeY - view.y, state.surgeX - view.x);
    ctx.translate(x + 23 * u, y + 21 * u);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(9 * u, 0);
    ctx.lineTo(-6 * u, -6 * u);
    ctx.lineTo(-3 * u, 0);
    ctx.lineTo(-6 * u, 6 * u);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
}
