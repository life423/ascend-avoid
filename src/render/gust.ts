import type { MultiplayerMode } from '../core/GameModes';
import { EXHALE } from '../../server/constants/gameConstants';
import { waveArcs } from '../../server/game/gustWave';
import type { SyncedGustWave } from '../types/synced';
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');
export function drawPuffs(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, timestamp: number): void {
    const state = mode.multiplayerManager?.getState();
    const unit = mode.cssScale / Math.max(.001, Math.abs(ctx.getTransform().a));
    mode.puffs = mode.puffs.filter(p => timestamp - p.at < 380);
    // The mouth/front pulse stays readable even if replicated side airflow arrives a patch later.
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
        const age = time - wave.at, total = EXHALE.WAVE_WRAP_MS + EXHALE.WAVE_FADE_MS;
        if (age < 0 || age >= total)
            return;
        const dissipating = Math.max(0, (age - EXHALE.WAVE_WRAP_MS) / EXHALE.WAVE_FADE_MS);
        const fade = Math.pow(1 - dissipating, 1.4);
        const pose = REDUCED_MOTION.matches && age < EXHALE.WAVE_WRAP_MS ? wave.at : time;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        for (const arc of waveArcs(wave, pose)) {
            // The rear sweep opens, thins and drifts outward instead of settling into a shield.
            const spread = REDUCED_MOTION.matches ? 1 : 1 + dissipating * .38;
            const trim = Math.floor(dissipating * 3);
            const points = arc.slice(trim, arc.length - trim).map(p => ({ x: wave.x + (p.x - wave.x) * spread, y: wave.y + (p.y - wave.y) * spread }));
            ctx.beginPath();
            points.forEach((p, i) => {
                if (i) ctx.lineTo(p.x, p.y);
                else ctx.moveTo(p.x, p.y);
            });
            ctx.strokeStyle = `rgba(72,201,217,${.16 * fade})`;
            ctx.lineWidth = EXHALE.WAVE_THICKNESS * (1 - dissipating * .6) + 8 * unit;
            ctx.stroke();
            ctx.strokeStyle = `rgba(148,234,244,${.8 * fade})`;
            ctx.lineWidth = Math.max(EXHALE.WAVE_THICKNESS * .45 * (1 - dissipating), 2.2 * unit);
            ctx.stroke();
            ctx.strokeStyle = `rgba(237,255,255,${.85 * fade})`;
            ctx.lineWidth = Math.max(1 * unit, EXHALE.WAVE_THICKNESS * .12);
            ctx.stroke();
            // A pair of separated streamlines reads as air, with clear openings between them.
            if (dissipating > 0) for (const side of [-1, 1]) {
                const wisp = side < 0 ? points.slice(0, 3) : points.slice(-3);
                ctx.beginPath();
                wisp.forEach((p, i) => {
                    const x = wave.x + (p.x - wave.x) * 1.12, y = wave.y + (p.y - wave.y) * 1.12;
                    if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y);
                });
                ctx.strokeStyle = `rgba(178,241,248,${.45 * fade})`;
                ctx.lineWidth = 1.2 * unit;
                ctx.stroke();
            }
        }
        ctx.restore();
    });
}
