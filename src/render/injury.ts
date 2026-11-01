/** Rear and side fractures leave a quiet front plate for the eyes. Shared with the shatter. */
type ShellPoint = readonly [number, number];
const joint: ShellPoint = [-.26, 0];
const rays = [
    { angle: 1.32, points: [joint, [-.1, .23], [-.22, .45], [-.02, .66]] },
    { angle: 2.22, points: [joint, [-.36, .23], [-.6, .3], [-.5, .55]] },
    { angle: Math.PI, points: [joint, [-.5, .08], [-.64, -.09], [-.84, .06]] },
    { angle: 3.93, points: [joint, [-.46, -.13], [-.4, -.37], [-.63, -.48]] },
    { angle: 5.06, points: [joint, [-.18, -.23], [-.28, -.43], [-.07, -.56], [.02, -.78]] },
] satisfies ReadonlyArray<{ angle: number; points: ShellPoint[] }>;

export const INJURY_CRACKS: ReadonlyArray<ReadonlyArray<ShellPoint>> = rays.map(ray =>
    [...ray.points, [Math.cos(ray.angle), Math.sin(ray.angle)] as const]);

/** Each fragment leaves along its own outer arc, including the intact front plate. */
export const SHELL_PIECES = rays.map((ray, i) => {
    const next = rays[(i + 1) % rays.length].angle + (i === rays.length - 1 ? Math.PI * 2 : 0);
    return { start: ray.angle, end: next, angle: (ray.angle + next) / 2 };
});

export interface InjuryVisual {
    age: number;
    remaining: number;
    reduced: boolean;
    pixelRatio: number;
}

let core: HTMLCanvasElement | null = null;
function warmCore(): HTMLCanvasElement {
    if (core) return core;
    core = document.createElement('canvas');
    core.width = core.height = 128;
    const ctx = core.getContext('2d');
    if (!ctx) return core;
    const light = ctx.createRadialGradient(43, 64, 3, 64, 64, 67);
    light.addColorStop(0, '#fff0c4');
    light.addColorStop(.48, '#ffc181');
    light.addColorStop(1, '#e47865');
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, 128, 128);
    return core;
}

/** Trace exactly the boundaries used by the live fractures, not unrelated triangular debris. */
export function shellPlate(ctx: CanvasRenderingContext2D, index: number, r: number): void {
    const piece = SHELL_PIECES[index], first = INJURY_CRACKS[index], next = INJURY_CRACKS[(index + 1) % rays.length];
    ctx.beginPath();
    first.forEach(([x, y], i) => {
        if (i) ctx.lineTo(x * r, y * r); else ctx.moveTo(x * r, y * r);
    });
    ctx.arc(0, 0, r, piece.start, piece.end);
    for (let i = next.length - 2; i >= 0; i--) ctx.lineTo(next[i][0] * r, next[i][1] * r);
    ctx.closePath();
}

function traceFractures(ctx: CanvasRenderingContext2D, r: number): void {
    ctx.beginPath();
    for (const seam of INJURY_CRACKS) seam.forEach(([x, y], i) => {
        // Break the outer rim too, rather than leaving an unbroken healthy outline.
        const edge = i === seam.length - 1 ? 1.065 : 1;
        if (i) ctx.lineTo(x * r * edge, y * r * edge); else ctx.moveTo(x * r, y * r);
    });
}

/** A fractured shell with warm recessed seams. The face is painted afterward, never obscured. */
export function drawInjury(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, facing: number, visual: InjuryVisual): void {
    if (visual.remaining <= 0) return;
    const transform = ctx.getTransform(), r = size / 2;
    const u = visual.pixelRatio / Math.max(.001, Math.hypot(transform.a, transform.b));
    const closing = Math.min(1, visual.remaining / 750), heal = closing * closing * (3 - 2 * closing);
    const open = visual.reduced ? 1 : Math.min(1, Math.max(0, visual.age / 180));
    const strength = heal * open;
    const pulse = visual.reduced ? 1 : .96 + .04 * Math.sin(visual.age * Math.PI / 1000);
    const gap = Math.max(size * .014, 1.05 * u) * strength * pulse;
    const edge = Math.max(Math.min(2.4 * u, size * .07), size * .032);
    ctx.save();
    ctx.translate(x, y); ctx.rotate(facing);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.065, 0, Math.PI * 2); ctx.clip();
    // The shell keeps its original color. Only the openings reveal the warm interior.
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r * .985, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha *= strength;
    ctx.drawImage(warmCore(), -r, -r, size, size);
    for (let i = 0; i < SHELL_PIECES.length; i++) {
        const angle = SHELL_PIECES[i].angle, distance = i === SHELL_PIECES.length - 1 ? gap * .2 : gap;
        ctx.save(); ctx.translate(Math.cos(angle) * distance, Math.sin(angle) * distance);
        shellPlate(ctx, i, r);
        ctx.fillStyle = color; ctx.fill();
        ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha *= strength;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // A restrained lit lip makes the fractures feel recessed into a soft shell.
    ctx.save(); ctx.translate(-.65 * u, -.65 * u);
    traceFractures(ctx, r);
    ctx.strokeStyle = 'rgba(255,255,255,.65)';
    ctx.lineWidth = (edge + .6 * u) * strength;
    ctx.stroke(); ctx.restore();
    traceFractures(ctx, r);
    ctx.strokeStyle = '#6b3e4b';
    ctx.lineWidth = edge * strength;
    ctx.stroke();
    // Broad dark edges and a narrow warm center stay legible on white and colored bodies.
    ctx.strokeStyle = '#ed977b';
    ctx.lineWidth = edge * .52 * strength * pulse;
    ctx.stroke();
    ctx.strokeStyle = '#ffe4af';
    ctx.lineWidth = edge * .22 * strength * pulse;
    ctx.stroke();
    ctx.restore();
}
