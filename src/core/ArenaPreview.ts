import { constrainArenaView, type ArenaView } from '../../server/game/camera';
import type { SyncedGameState, SyncedPlayer } from '../types/synced';

type Point = { x: number; y: number };
type ScreenBounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

export const PREVIEW_SHORT_SIDE = 1040;
const SHOT_HOLD_MS = 8000;
const SCENE_SPACING = PREVIEW_SHORT_SIDE * .36;

function center(player: SyncedPlayer): Point {
    return { x: player.x + player.width / 2, y: player.y + player.height / 2 };
}

/** Put the scene in the largest clear strip around the join card. */
function previewAnchor(canvas: ScreenBounds, card?: ScreenBounds): Point {
    if (!card) return { x: .5, y: .5 };
    const left = Math.max(0, card.left - canvas.left);
    const right = Math.max(0, canvas.right - card.right);
    const top = Math.max(0, card.top - canvas.top);
    const bottom = Math.max(0, canvas.bottom - card.bottom);
    const side = Math.max(left, right);
    const vertical = Math.max(top, bottom);
    // The small tie allowance avoids flipping sides due to subpixel layout differences.
    if (side > vertical) return { x: right + 1 >= left ? 1 - right / (2 * canvas.width) : left / (2 * canvas.width), y: .5 };
    return { x: .5, y: top + 1 >= bottom ? top / (2 * canvas.height) : 1 - bottom / (2 * canvas.height) };
}

export class ArenaPreview {
    private scene: Point | null = null;
    private current: Point | null = null;
    private transition: { from: Point; to: Point; duration: number; elapsed: number } | null = null;
    private reviewAt = 0;
    private width = 0;
    private height = 0;
    private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    update(state: SyncedGameState, size: Omit<ArenaView, 'x' | 'y'>, canvas: ScreenBounds,
        readCard: () => ScreenBounds | undefined, timestamp: number, dt: number): ArenaView {
        const fit = (position: Point) => constrainArenaView({ ...position, ...size }, state.worldWidth, state.worldHeight);
        const resized = size.width !== this.width || size.height !== this.height;
        this.width = size.width;
        this.height = size.height;

        if (this.reducedMotion.matches) this.transition = null;
        if (!this.current || resized || (!this.transition && timestamp >= this.reviewAt && (!this.scene || !this.reducedMotion.matches))) {
            const card = readCard();
            const anchor = previewAnchor(canvas, card);
            const position = (focus: Point) => fit({
                x: focus.x + (.5 - anchor.x) * size.width,
                y: focus.y + (.5 - anchor.y) * size.height,
            });
            if (resized && this.scene) {
                this.current = position(this.scene);
                this.transition = null;
                this.reviewAt = timestamp + SHOT_HOLD_MS;
            } else {
                let best: { focus: Point; view: ArenaView; score: number } | null = null;
                for (const player of state.players.values()) {
                    if (player.state !== 'alive' || player.capturedBy || player.flying) continue;
                    const subject = center(player);
                    const partner = state.players.get(player.stealingFrom || player.latchTarget);
                    const other = partner?.state === 'alive' ? center(partner) : subject;
                    const together = Math.hypot(subject.x - other.x, subject.y - other.y) < SCENE_SPACING;
                    const focus = together ? { x: (subject.x + other.x) / 2, y: (subject.y + other.y) / 2 } : subject;
                    const travel = this.scene ? Math.hypot(focus.x - this.scene.x, focus.y - this.scene.y) : 0;
                    if (this.scene && travel < SCENE_SPACING) continue;

                    const moving = Math.min(1, Math.hypot(player.movementVx, player.movementVy) / 160);
                    const action = (player.stealingFrom ? 4 : player.inhaling ? 2 : 0) + (player.gulping ? 3 : 0) + moving;
                    if (this.scene && action < .25) continue;
                    const view = position(focus);
                    const x = (focus.x - view.x) / view.width + .5;
                    const y = (focus.y - view.y) / view.height + .5;
                    const sx = canvas.left + x * canvas.width, sy = canvas.top + y * canvas.height;
                    const covered = card && sx >= card.left && sx <= card.right && sy >= card.top && sy <= card.bottom;
                    if (covered || x <= 0 || x >= 1 || y <= 0 || y >= 1) continue;
                    const score = action + Math.min(2, player.width / 80) - travel / 1800
                        - 10 * Math.hypot(x - anchor.x, y - anchor.y);
                    if (!best || score > best.score) best = { focus, view, score };
                }
                this.reviewAt = timestamp + (this.scene || best ? SHOT_HOLD_MS : 1500);
                if (best) {
                    this.scene = best.focus;
                    if (this.current && !this.reducedMotion.matches) {
                        const distance = Math.hypot(best.view.x - this.current.x, best.view.y - this.current.y);
                        this.transition = { from: this.current, to: best.view, duration: Math.max(1800, distance * 1.8), elapsed: 0 };
                    } else {
                        this.current = best.view;
                    }
                }
                this.current ??= { x: state.worldWidth / 2, y: state.worldHeight / 2 };
            }
        }

        if (this.transition) {
            const pan = this.transition;
            pan.elapsed += Math.min(.1, Math.max(0, dt)) * 1000;
            const t = Math.min(1, pan.elapsed / pan.duration);
            const blend = t * t * (3 - 2 * t);
            this.current = {
                x: pan.from.x + (pan.to.x - pan.from.x) * blend,
                y: pan.from.y + (pan.to.y - pan.from.y) * blend,
            };
            if (t === 1) {
                this.transition = null;
                this.reviewAt = timestamp + SHOT_HOLD_MS;
            }
        }
        return fit(this.current);
    }
}
