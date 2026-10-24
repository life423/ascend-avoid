import type { SyncedPinwheel } from '../types/synced';
import { SHOCKWAVE } from '../../server/constants/gameConstants';

function hexagon(ctx: CanvasRenderingContext2D, radius: number): void {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI / 6;
        if (!i) ctx.moveTo(Math.cos(a) * radius, Math.sin(a) * radius);
        else ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
    }
    ctx.closePath();
}

export function pulsarPartIcon(ctx: CanvasRenderingContext2D, kind: number): void {
    if (kind === 0) {
        ctx.fillStyle = '#342654'; ctx.strokeStyle = '#f2c1ff'; hexagon(ctx, 21); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#ef9fff'; hexagon(ctx, 11); ctx.fill();
        ctx.strokeStyle = '#fff3ff'; ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(3, 0); ctx.lineTo(-3, 8); ctx.stroke();
    } else if (kind === 1) {
        ctx.strokeStyle = '#82f0e4'; ctx.lineWidth = 4;
        for (const y of [-9, 0, 9]) { ctx.beginPath(); ctx.ellipse(0, y, 19, 6, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.strokeStyle = '#e6fffc'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-19, -9); ctx.lineTo(-19, 9); ctx.moveTo(19, -9); ctx.lineTo(19, 9); ctx.stroke();
    } else {
        ctx.fillStyle = '#c29cde'; ctx.strokeStyle = '#fff0ff';
        ctx.beginPath(); ctx.moveTo(-19, 13); ctx.lineTo(-10, -11); ctx.lineTo(10, -11); ctx.lineTo(19, 13); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#8df6ea'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, 5); ctx.lineTo(0, -22); ctx.moveTo(-9, -16); ctx.lineTo(9, -16); ctx.stroke();
    }
}

/** Angular emitter fins charge inward before an outward plasma front. */
export function drawPulsarArray(ctx: CanvasRenderingContext2D, w: SyncedPinwheel, now: number): void {
    const windup = Math.max(0, Math.min(1, w.phase === 'charging' ? 1 - (w.at - now) / SHOCKWAVE.CHARGE_MS
        : w.phase === 'active' ? 1 - (w.beatAt - now) / SHOCKWAVE.WINDUP_MS : 0));
    if (w.phase === 'active' && windup > 0) {
        ctx.strokeStyle = `rgba(225, 143, 255, ${0.12 + windup * .2})`; ctx.lineWidth = 1.5;
        ctx.setLineDash([7, 12]); ctx.beginPath(); ctx.arc(0, 0, SHOCKWAVE.START_RADIUS + SHOCKWAVE.RANGE, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
    const age = now - w.pulseAt;
    if (w.phase === 'active' && w.pulseAt > 0 && age >= 0 && age <= SHOCKWAVE.WAVE_MS) {
        const progress = age / SHOCKWAVE.WAVE_MS, radius = SHOCKWAVE.START_RADIUS + SHOCKWAVE.RANGE * progress;
        const alpha = .35 + .65 * (1 - progress);
        ctx.strokeStyle = `rgba(206, 101, 255, ${alpha * .25})`; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(241, 211, 255, ${alpha})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = `rgba(112, 255, 228, ${alpha * .65})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, Math.max(40, radius - 14), 0, Math.PI * 2); ctx.stroke();
        for (let i = 0; i < 12; i++) {
            const a = i * Math.PI / 6; ctx.save(); ctx.rotate(a); ctx.fillStyle = '#f4c7ff';
            ctx.fillRect(radius - 5, -1.5, 10, 3); ctx.restore();
        }
    }
    ctx.fillStyle = '#192137'; ctx.strokeStyle = '#9b91cb'; ctx.lineWidth = 2;
    hexagon(ctx, 38); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 3; i++) {
        ctx.save(); ctx.rotate(i * Math.PI * 2 / 3 + w.angle); ctx.translate(0, -windup * 7);
        ctx.fillStyle = '#354466'; ctx.strokeStyle = '#d1c2ee'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-11, -20); ctx.lineTo(-17, -44); ctx.lineTo(0, -57); ctx.lineTo(17, -44); ctx.lineTo(11, -20); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = `rgba(131, 255, 230, ${.5 + windup * .5})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(0, -45); ctx.lineTo(0, -24); ctx.stroke(); ctx.restore();
    }
    ctx.fillStyle = '#853baf'; ctx.strokeStyle = '#e5b3ff'; hexagon(ctx, 22 + windup * 3); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff0ff'; ctx.beginPath(); ctx.moveTo(0, -15); ctx.lineTo(5, -4); ctx.lineTo(14, 0); ctx.lineTo(5, 4); ctx.lineTo(0, 15); ctx.lineTo(-5, 4); ctx.lineTo(-14, 0); ctx.lineTo(-5, -4); ctx.closePath(); ctx.fill();
}
