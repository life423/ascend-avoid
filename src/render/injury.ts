/** Three broad shell seams, shared with the finishing shatter. */
type ShellPoint = readonly [number, number];
export const INJURY_CRACKS: ReadonlyArray<ReadonlyArray<ShellPoint>> = [
    [[0, -1], [.03, -.5], [-.24, -.2], [-.08, 0]],
    [[-.08, 0], [-.18, .28], [.05, .55], [0, 1]],
    [[-.08, 0], [.3, .05], [.55, -.06], [1, 0]],
];
export interface InjuryVisual {
    age: number;
    remaining: number;
    reduced: boolean;
    pixelRatio: number;
}
let core: HTMLCanvasElement | null = null;
function warmCore(): HTMLCanvasElement {
    if (core)
        return core;
    core = document.createElement('canvas');
    core.width = core.height = 128;
    const ctx = core.getContext('2d');
    if (!ctx) return core;
    const light = ctx.createRadialGradient(61, 64, 0, 64, 64, 64);
    light.addColorStop(0, '#ffe3b9');
    light.addColorStop(1, '#d98d79');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, 128, 128);
    return core;
}
/** Trace a full plate so the injury and shatter describe the same shell. */
export function shellPlate(ctx: CanvasRenderingContext2D, index: number, r: number): void {
    ctx.beginPath();
    if (index === 0) {
        ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2, true);
        for (const [x, y] of [[.05, .55], [-.18, .28], [-.08, 0], [-.24, -.2], [.03, -.5], [0, -1]])
            ctx.lineTo(x * r, y * r);
    }
    else if (index === 1) {
        ctx.arc(0, 0, r, -Math.PI / 2, 0);
        for (const [x, y] of [[.55, -.06], [.3, .05], [-.08, 0], [-.24, -.2], [.03, -.5], [0, -1]])
            ctx.lineTo(x * r, y * r);
    }
    else {
        ctx.arc(0, 0, r, 0, Math.PI / 2);
        for (const [x, y] of [[.05, .55], [-.18, .28], [-.08, 0], [.3, .05], [.55, -.06], [1, 0]])
            ctx.lineTo(x * r, y * r);
    }
    ctx.closePath();
}
/** Separated plates reveal a warm core; eyes retain their actual size and direction. */
export function drawInjury(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, facing: number, visual: InjuryVisual): void {
    if (visual.remaining <= 0)
        return;
    const r = size / 2, u = visual.pixelRatio / Math.max(.001, Math.abs(ctx.getTransform().a));
    const heal = Math.min(1, visual.remaining / 750), open = visual.reduced ? 1 : Math.min(1, Math.max(0, visual.age / 180));
    const pulse = visual.reduced ? 1 : .94 + .06 * Math.sin(visual.age * Math.PI / 1000);
    const gap = Math.max(size * .025, 1.3 * u) * heal * open * pulse;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(facing);
    ctx.beginPath();
    ctx.arc(0, 0, r * .96, 0, Math.PI * 2);
    ctx.clip();
    ctx.globalAlpha *= heal;
    ctx.drawImage(warmCore(), -r, -r, size, size);
    for (let i = 0; i < 3; i++) {
        ctx.save();
        ctx.translate(i === 0 ? -gap : gap * .65, i === 1 ? -gap * .65 : i === 2 ? gap * .65 : 0);
        shellPlate(ctx, i, r);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = 'rgba(65,47,48,.55)';
        ctx.lineWidth = Math.max(1 * u, size * .009);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
    }
    ctx.restore();
}
