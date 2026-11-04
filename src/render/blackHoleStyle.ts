import { BLACK_HOLE } from '../../server/constants/gameConstants';

type HolePhase = 'warning' | 'active' | 'closing' | 'dormant';
export interface BlackHoleVisualSource {
  radius: number;
  activeAt: number;
  phase?: string;
  at?: number;
}
export interface BlackHoleLook {
  phase: HolePhase;
  lethal: boolean;
  progress: number;
}

/** A shared symbol language: dark singularity, violet live rim, gold phase clock. */
export const BLACK_HOLE_STYLE = {
  core: '#02030c',
  edge: '#07121e',
  live: '#d6b8ff',
  orbit: '#b58ce7',
  warning: '#ffd166',
} as const;

/** Honor authoritative phases. activeAt remains a fallback for older fixtures/wire shapes. */
export function blackHoleLook(hole: BlackHoleVisualSource, now: number): BlackHoleLook {
  const phase: HolePhase = hole.phase === 'warning' || hole.phase === 'active' || hole.phase === 'closing' || hole.phase === 'dormant'
    ? hole.phase : hole.phase ? 'dormant' : now >= hole.activeAt ? 'active' : 'warning';
  const duration = phase === 'closing' ? BLACK_HOLE.CLOSING_MS : BLACK_HOLE.WARNING_MS;
  const deadline = hole.at ?? hole.activeAt;
  const progress = Math.max(0, Math.min(1, 1 - (deadline - now) / duration));
  return { phase, lethal: phase === 'active' || phase === 'closing', progress };
}

/** The orbit follows size without changing the actual core or physical soft-rim radius. */
export const blackHoleRingRadius = (radius: number): number => radius + BLACK_HOLE.RING_RADIUS - BLACK_HOLE.CORE_RADIUS;
const TAU = Math.PI * 2;

function ring(ctx: CanvasRenderingContext2D, radius: number, color: string, width: number, start = 0, end = TAU): void {
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.beginPath(); ctx.arc(0, 0, radius, start, end); ctx.stroke();
}

function brokenRing(ctx: CanvasRenderingContext2D, radius: number, color: string, width: number, rotation: number): void {
  for (let i = 0; i < 3; i++) {
    const start = rotation + i * TAU / 3;
    ring(ctx, radius, color, width, start, start + TAU * .245);
  }
}

/** Pure circular paths: no blur, gradients, tilted ellipses, or per-frame cache surfaces. */
export function drawBlackHoleWorld(ctx: CanvasRenderingContext2D, hole: BlackHoleVisualSource, look: BlackHoleLook,
  timestamp: number, pixel: number, reducedMotion: boolean): void {
  if (look.phase === 'dormant') return;
  const radius = hole.radius, orbit = blackHoleRingRadius(radius), stroke = Math.max(2.5, pixel * 1.1);
  const rotation = reducedMotion ? -.6 : timestamp / 16000 - .6;
  ctx.save(); ctx.lineCap = 'round';
  if (look.lethal) {
    ctx.fillStyle = BLACK_HOLE_STYLE.core;
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, TAU); ctx.fill();
    // The full lethal core stays visible throughout closing; only the phase clock retires.
    ring(ctx, radius, BLACK_HOLE_STYLE.edge, stroke * 2.5);
    ring(ctx, radius, BLACK_HOLE_STYLE.live, stroke);
    ring(ctx, radius + BLACK_HOLE.RIM_CLEARANCE, 'rgba(182, 143, 234, .27)', Math.max(2, pixel * .8));
    brokenRing(ctx, orbit, BLACK_HOLE_STYLE.orbit, Math.max(2, pixel * .8), rotation);
  } else {
    // A forming location is hollow, so warning artwork cannot read as a live core.
    ctx.setLineDash([Math.max(5, radius * .11), Math.max(5, radius * .10)]);
    ring(ctx, radius, BLACK_HOLE_STYLE.edge, stroke * 2.5);
    ring(ctx, radius, BLACK_HOLE_STYLE.warning, stroke);
    ctx.setLineDash([]);
    brokenRing(ctx, orbit, 'rgba(255, 209, 102, .34)', Math.max(2, pixel * .8), -.6);
  }
  if (look.phase === 'warning' || look.phase === 'closing') {
    const remaining = look.phase === 'closing' ? 1 - look.progress : look.progress;
    if (remaining > .001) ring(ctx, orbit, BLACK_HOLE_STYLE.warning, Math.max(3.5, pixel * 1.25), -Math.PI / 2, -Math.PI / 2 + TAU * remaining);
  }
  ctx.restore();
}

/** A stationary, DPR-correct minimap symbol. Player dots are drawn above these landmarks. */
export function drawBlackHoleMarker(ctx: CanvasRenderingContext2D, x: number, y: number, hole: BlackHoleVisualSource,
  look: BlackHoleLook, unit = 1): void {
  if (look.phase === 'dormant') return;
  const size = Math.max(.85, Math.min(1.2, hole.radius / BLACK_HOLE.CORE_RADIUS));
  ctx.save(); ctx.translate(x, y); ctx.scale(unit * size, unit * size); ctx.lineCap = 'round';
  if (look.lethal) {
    ctx.fillStyle = BLACK_HOLE_STYLE.core;
    ctx.beginPath(); ctx.arc(0, 0, 3.1, 0, TAU); ctx.fill();
    ring(ctx, 3.1, BLACK_HOLE_STYLE.live, 1.15);
  } else {
    ctx.setLineDash([1.3, 1.4]);
    ring(ctx, 3.1, BLACK_HOLE_STYLE.warning, 1.1);
    ctx.setLineDash([]);
  }
  brokenRing(ctx, 5.8, look.phase === 'warning' ? 'rgba(255, 209, 102, .5)' : BLACK_HOLE_STYLE.orbit, 1.25, -.6);
  if (look.phase === 'warning' || look.phase === 'closing') {
    const remaining = look.phase === 'closing' ? 1 - look.progress : look.progress;
    if (remaining > .001) ring(ctx, 5.8, BLACK_HOLE_STYLE.warning, 1.6, -Math.PI / 2, -Math.PI / 2 + TAU * remaining);
  }
  ctx.restore();
}
