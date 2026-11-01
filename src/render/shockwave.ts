import type { SyncedPinwheel } from '../types/synced';
import { SHOCKWAVE } from '../../server/constants/gameConstants';
import { pulsarHeading, pulsarRadius } from '../../server/game/pulsar';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

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

/** A braced forward emitter releases a crescent, then rotates independently of the traveling front. */
export function drawPulsarArray(ctx: CanvasRenderingContext2D, w: SyncedPinwheel, now: number): void {
    const windup = w.phase === 'active' ? Math.max(0, Math.min(1, 1 - (w.beatAt - now) / SHOCKWAVE.WINDUP_MS)) : 0;
    const age = now - w.pulseAt;
    if (w.phase === 'active' && w.pulseAt > 0 && age >= 0 && age <= SHOCKWAVE.WAVE_MS + SHOCKWAVE.FADE_MS) {
        const progress = Math.min(1, age / SHOCKWAVE.WAVE_MS), radius = pulsarRadius(age);
        const alpha = age <= SHOCKWAVE.WAVE_MS ? .6 + .4 * (1 - progress) : .6 * (1 - (age - SHOCKWAVE.WAVE_MS) / SHOCKWAVE.FADE_MS);
        const start = w.pulseFacing - SHOCKWAVE.HALF_ARC, end = w.pulseFacing + SHOCKWAVE.HALF_ARC;
        ctx.save(); ctx.translate(w.pulseX - w.x, w.pulseY - w.y); ctx.lineCap = 'round';
        ctx.strokeStyle = `rgba(206, 101, 255, ${alpha * .25})`; ctx.lineWidth = 18;
        ctx.beginPath(); ctx.arc(0, 0, radius, start, end); ctx.stroke();
        ctx.strokeStyle = `rgba(241, 211, 255, ${alpha})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(0, 0, radius, start, end); ctx.stroke();
        ctx.strokeStyle = `rgba(112, 255, 228, ${alpha * .65})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, Math.max(36, radius - 12), start + .05, end - .05); ctx.stroke();
        for (let i = 0; i <= 6; i++) {
            const a = start + (end - start) * i / 6; ctx.save(); ctx.rotate(a); ctx.fillStyle = `rgba(244,199,255,${alpha})`;
            ctx.fillRect(radius - 5, -1.5, 10, 3); ctx.restore();
        }
        ctx.restore();
    }
    ctx.save(); ctx.rotate(w.phase === 'active' ? pulsarHeading(w, now) : w.angle);
    const recoil = w.pulseAt > 0 && age >= 0 && age < SHOCKWAVE.FOLLOW_THROUGH_MS && !reducedMotion.matches
        ? Math.sin(Math.PI * age / SHOCKWAVE.FOLLOW_THROUGH_MS) * 7 : 0;
    ctx.translate(-recoil, 0);
    ctx.fillStyle = '#192137'; ctx.strokeStyle = '#9b91cb'; ctx.lineWidth = 2;
    hexagon(ctx, 36); ctx.fill(); ctx.stroke();
    // Rear heat fins and two forward jaws make orientation readable without a target ray.
    ctx.strokeStyle = '#9385b1'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    for (const y of [-16, 0, 16]) { ctx.beginPath(); ctx.moveTo(-39, y); ctx.lineTo(-26, y); ctx.stroke(); }
    for (const side of [-1, 1]) {
        const y = side * (25 - windup * 5);
        ctx.fillStyle = '#354466'; ctx.strokeStyle = '#d1c2ee'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1, y - side * 9); ctx.lineTo(28, y - side * 3);
        ctx.lineTo(51, y + side * 8); ctx.lineTo(27, y + side * 12); ctx.lineTo(-5, y + side * 5); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = `rgba(131, 255, 230, ${.5 + windup * .5})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(34, y + side * 3); ctx.stroke();
    }
    ctx.fillStyle = '#853baf'; ctx.strokeStyle = '#e5b3ff'; hexagon(ctx, 20); ctx.fill(); ctx.stroke();
    ctx.fillStyle = `rgba(255,235,255,${.35 + .65 * windup})`;
    ctx.beginPath(); ctx.ellipse(22, 0, 9 + windup * 7, 8 + windup * 4, 0, 0, Math.PI * 2); ctx.fill();
    if (windup > 0) {
        ctx.strokeStyle = `rgba(153,255,233,${.4 + .6 * windup})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(27, 0, 13 + windup * 4, -SHOCKWAVE.HALF_ARC, SHOCKWAVE.HALF_ARC); ctx.stroke();
    }
    ctx.restore();
}
