import type { MultiplayerMode } from '../core/GameModes';
import { EXHALE } from '../../server/constants/gameConstants';
import { waveArcs, waveActive } from '../../server/game/gustWave';
import type { SyncedGustWave } from '../types/synced';
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
export function drawPuffs(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, timestamp: number): void {
    const state = mode.multiplayerManager?.getState();
    const unit = mode.cssScale / Math.max(.001, Math.abs(ctx.getTransform().a));
    mode.puffs = mode.puffs.filter(p => timestamp - p.at < 380);
    // The mouth/front pulse stays readable even if the replicated wall arrives one patch later.
    for (const puff of mode.puffs) {
        const t = (timestamp - puff.at) / 220;
        if (t < 0 || t > 1)
            continue;
        ctx.save();
        ctx.strokeStyle = `rgba(220,247,255,${.7 * (1 - t)})`;
        ctx.lineWidth = (3 * (1 - t) + 1) * unit;
        ctx.beginPath();
        ctx.arc(puff.x, puff.y, puff.reach * (REDUCED_MOTION.matches ? .55 : .1 + .9 * t), puff.facing - EXHALE.ARC * Math.PI / 180, puff.facing + EXHALE.ARC * Math.PI / 180);
        ctx.stroke();
        ctx.restore();
    }
    if (!state?.gustWaves)
        return;
    const time = mode.worldNow(state, timestamp);
    state.gustWaves.forEach((wave: SyncedGustWave) => {
        const age = time - wave.at, total = EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_HOLD_MS;
        if (age < 0 || age >= total)
            return;
        const active = waveActive(wave, time), fade = Math.min(1, (total - age) / 220);
        const pose = REDUCED_MOTION.matches && !active ? wave.at : time;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const points of waveArcs(wave, pose)) {
            ctx.beginPath();
            points.forEach((p, i) => {
                if (i) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
            });
            ctx.strokeStyle = `rgba(72,201,217,${.16 * fade})`;
            ctx.lineWidth = EXHALE.WAVE_THICKNESS + 8 * unit;
            ctx.stroke();
            ctx.strokeStyle = `rgba(148,234,244,${(active ? 0.8 : 0.55) * fade})`;
            ctx.lineWidth = Math.max(EXHALE.WAVE_THICKNESS * .45, 2.2 * unit);
            ctx.stroke();
            ctx.strokeStyle = `rgba(237,255,255,${.85 * fade})`;
            ctx.lineWidth = Math.max(1 * unit, EXHALE.WAVE_THICKNESS * .12);
            ctx.stroke();
        }
        ctx.restore();
    });
}
