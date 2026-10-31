import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState } from '../types/synced';
import { SURGE } from '../../server/constants/gameConstants';
import { FONT, GOLD } from './style';

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
