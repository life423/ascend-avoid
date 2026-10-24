import type { SyncedPinwheel } from '../types/synced';
import { SHOCKWAVE } from '../../server/constants/gameConstants';
import { roundedRect } from './style';

export function drumPartIcon(ctx: CanvasRenderingContext2D, kind: number): void {
    if (kind === 0) {
        roundedRect(ctx, -19, -12, 38, 27, 5); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, -11, 19, 7, 0, 0, Math.PI * 2); ctx.fillStyle = '#fff4d7'; ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-12, -4); ctx.lineTo(-12, 12); ctx.moveTo(12, -4); ctx.lineTo(12, 12); ctx.stroke();
    } else if (kind === 1) {
        ctx.lineWidth = 4; ctx.strokeStyle = '#80e7de'; ctx.beginPath(); ctx.moveTo(-21, 0);
        for (let i = 0; i < 7; i++) ctx.lineTo(-15 + i * 5, i % 2 ? 10 : -10);
        ctx.lineTo(21, 0); ctx.stroke();
    } else {
        roundedRect(ctx, -19, -7, 24, 14, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#dae8ee'; ctx.fillRect(5, -3, 15, 6); ctx.strokeRect(15, -13, 5, 26);
    }
}

/** Draw at the drum's origin: compression previews the beat; the bright wave front matches its hit radius. */
export function drawShockwaveDrum(ctx: CanvasRenderingContext2D, w: SyncedPinwheel, now: number): void {
    const charging = w.phase === 'charging';
    const windup = charging ? 1 - Math.max(0, w.at - now) / SHOCKWAVE.CHARGE_MS
        : w.phase === 'active' ? Math.max(0, 1 - (w.beatAt - now) / SHOCKWAVE.WINDUP_MS) : 0;
    if (w.phase === 'active' && windup > 0) {
        ctx.strokeStyle = `rgba(255, 197, 116, ${0.1 + windup * 0.13})`; ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 12]); ctx.beginPath(); ctx.arc(0, 0, SHOCKWAVE.START_RADIUS + SHOCKWAVE.RANGE, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    const age = now - w.pulseAt;
    if (w.phase === 'active' && w.pulseAt > 0 && age >= 0 && age <= SHOCKWAVE.WAVE_MS) {
        const progress = age / SHOCKWAVE.WAVE_MS, radius = SHOCKWAVE.START_RADIUS + SHOCKWAVE.RANGE * progress;
        ctx.strokeStyle = `rgba(255, 204, 137, ${0.95 * (1 - progress)})`; ctx.lineWidth = 6 * (1 - progress) + 1;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(255, 237, 211, ${0.35 * (1 - progress)})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, Math.max(40, radius - 16), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.save(); ctx.scale(1 + windup * 0.1, 1 - windup * 0.22);
    ctx.fillStyle = '#d57158'; ctx.strokeStyle = '#ffe0a8'; ctx.lineWidth = 3;
    roundedRect(ctx, -33, -13, 66, 45, 9); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -12, 33, 14, 0, 0, Math.PI * 2); ctx.fillStyle = '#ffebbf'; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#713c3a'; ctx.lineWidth = 3;
    for (const x of [-23, 0, 23]) { ctx.beginPath(); ctx.moveTo(x, 3); ctx.lineTo(x, 28); ctx.stroke(); }
    ctx.strokeStyle = '#80e7de'; ctx.lineWidth = 3; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const x = -24 + i * 7, y = 40 + (i % 2 ? 4 : -4); if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    ctx.fillStyle = '#ffe8cf'; roundedRect(ctx, -6, -42 + windup * 17, 12, 20, 3); ctx.fill();
    ctx.restore();
}
