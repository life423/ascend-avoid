import { constrainArenaView, type ArenaView } from '../../server/game/camera';
import type { SyncedGameState, SyncedPlayer } from '../types/synced';

type Point = { x: number; y: number };
type Scene = { subjectId: string; partnerId?: string; focus: Point; slot: number };
type ScreenBounds = Pick<DOMRect, 'left' | 'top' | 'right' | 'bottom' | 'width' | 'height'>;

export const PREVIEW_SHORT_SIDE = 1040;
const SHOT_HOLD_MS = 8000;
const SCENE_SPACING = PREVIEW_SHORT_SIDE * .36;
const FOLLOW_SPEED = 360;
const FOLLOW_EASING = 3.5;

function center(player: SyncedPlayer): Point {
    return { x: player.x + player.width / 2, y: player.y + player.height / 2 };
}

/** Prefer the largest clear strip and retain alternatives for scenes near a wall. */
function previewAnchors(canvas: ScreenBounds, card?: ScreenBounds): Point[] {
    if (!card) return [{ x: .5, y: .5 }];
    const left = Math.max(0, card.left - canvas.left);
    const right = Math.max(0, canvas.right - card.right);
    const top = Math.max(0, card.top - canvas.top);
    const bottom = Math.max(0, canvas.bottom - card.bottom);
    const strips = [
        { room: top, x: .5, y: top / (2 * canvas.height) },
        { room: bottom, x: .5, y: 1 - bottom / (2 * canvas.height) },
        { room: right, x: 1 - right / (2 * canvas.width), y: .5 },
        { room: left, x: left / (2 * canvas.width), y: .5 },
    ].filter(strip => strip.room >= 32);
    // The small tie allowance avoids flipping sides due to subpixel layout differences.
    strips.sort((a, b) => Math.abs(a.room - b.room) <= 1 ? 0 : b.room - a.room);
    return strips.length ? strips : [{ x: .5, y: .5 }];
}

function available(player: SyncedPlayer | undefined): player is SyncedPlayer {
    return !!player && player.state === 'alive' && !player.capturedBy && !player.flying;
}

function midpoint(a: Point, b: Point): Point {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function visible(focus: Point, view: ArenaView, canvas: ScreenBounds, card?: ScreenBounds): boolean {
    const x = canvas.left + ((focus.x - view.x) / view.width + .5) * canvas.width;
    const y = canvas.top + ((focus.y - view.y) / view.height + .5) * canvas.height;
    return x > canvas.left && x < canvas.right && y > canvas.top && y < canvas.bottom
        && (!card || x < card.left || x > card.right || y < card.top || y > card.bottom);
}

function follow(from: Point, to: Point, dt: number): Point {
    const dx = to.x - from.x, dy = to.y - from.y;
    const distance = Math.hypot(dx, dy);
    if (distance === 0) return from;
    const blend = Math.min(1 - Math.exp(-FOLLOW_EASING * dt), FOLLOW_SPEED * dt / distance);
    return { x: from.x + dx * blend, y: from.y + dy * blend };
}

export class ArenaPreview {
    private scene: Scene | null = null;
    private current: Point | null = null;
    private transition: { from: Point; to: Point; duration: number; elapsed: number } | null = null;
    private reviewAt = 0;
    private pausedAt: number | null = null;
    private width = 0;
    private height = 0;
    private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

    update(state: SyncedGameState, size: Omit<ArenaView, 'x' | 'y'>, canvas: ScreenBounds,
        readCard: () => ScreenBounds | undefined, timestamp: number, dt: number, paused = false): ArenaView {
        const fit = (position: Point) => constrainArenaView({ ...position, ...size }, state.worldWidth, state.worldHeight);
        const arenaCenter = { x: state.worldWidth / 2, y: state.worldHeight / 2 };
        if (paused) {
            this.pausedAt ??= timestamp;
            return fit(this.current ?? arenaCenter);
        }
        if (this.pausedAt !== null) {
            this.reviewAt += timestamp - this.pausedAt;
            this.pausedAt = null;
        }

        const resized = size.width !== this.width || size.height !== this.height;
        this.width = size.width;
        this.height = size.height;
        const card = readCard();
        const anchors = previewAnchors(canvas, card);
        const frame = (focus: Point, preferred = 0): { view: ArenaView; slot: number } | null => {
            const place = (slot: number) => {
                const anchor = anchors[slot];
                const view = fit({
                    x: focus.x + (.5 - anchor.x) * size.width,
                    y: focus.y + (.5 - anchor.y) * size.height,
                });
                return visible(focus, view, canvas, card) ? { view, slot } : null;
            };
            const slot = Math.min(preferred, anchors.length - 1);
            const chosen = place(slot);
            if (chosen) return chosen;
            for (let other = 0; other < anchors.length; other++) {
                if (other === slot) continue;
                const alternate = place(other);
                if (alternate) return alternate;
            }
            return null;
        };

        const reduced = this.reducedMotion.matches;
        if (reduced) {
            this.transition = null;
            if (resized && this.scene) this.current = frame(this.scene.focus, this.scene.slot)?.view ?? this.current;
        } else if (this.scene) {
            const subject = state.players.get(this.scene.subjectId);
            const partner = this.scene.partnerId ? state.players.get(this.scene.partnerId) : undefined;
            if (available(subject)) {
                const point = center(subject);
                const other = available(partner) ? center(partner) : point;
                this.scene.focus = Math.hypot(point.x - other.x, point.y - other.y) < SCENE_SPACING
                    ? midpoint(point, other) : point;
            } else if (available(partner)) {
                this.scene.focus = center(partner);
            }
        }

        if (!this.current || (!this.transition && timestamp >= this.reviewAt && (!this.scene || !reduced))) {
            let best: { scene: Scene; view: ArenaView; score: number } | null = null;
            for (const player of state.players.values()) {
                const id = player.sessionId;
                if (!available(player) || id === this.scene?.subjectId || id === this.scene?.partnerId) continue;
                const subject = center(player);
                const partnerId = player.stealingFrom || player.latchTarget;
                const partner = state.players.get(partnerId);
                const other = available(partner) ? center(partner) : subject;
                let together = available(partner) && Math.hypot(subject.x - other.x, subject.y - other.y) < SCENE_SPACING;
                let focus = together ? midpoint(subject, other) : subject;
                let framed = frame(focus);
                // If the strip cannot show both players, compose around the active one.
                if (together && (!framed || !visible(subject, framed.view, canvas, card) || !visible(other, framed.view, canvas, card))) {
                    together = false;
                    focus = subject;
                    framed = frame(focus);
                }
                if (!framed) continue;
                const { view, slot } = framed;
                const anchor = anchors[slot];
                const travel = this.scene ? Math.hypot(focus.x - this.scene.focus.x, focus.y - this.scene.focus.y) : 0;
                if (this.scene && travel < SCENE_SPACING) continue;

                const moving = Math.min(1, Math.hypot(player.movementVx, player.movementVy) / 160);
                const action = (player.stealingFrom ? 4 : player.inhaling ? 2 : 0) + (player.gulping ? 3 : 0) + moving;
                if (this.scene && action < .25) continue;
                const x = (focus.x - view.x) / view.width + .5;
                const y = (focus.y - view.y) / view.height + .5;
                const score = action + Math.min(2, player.width / 80) - travel / 1800
                    - 10 * Math.hypot(x - anchor.x, y - anchor.y) - slot;
                if (!best || score > best.score) {
                    best = { scene: { subjectId: id, partnerId: together ? partnerId : undefined, focus, slot }, view, score };
                }
            }
            this.reviewAt = timestamp + (this.scene || best ? SHOT_HOLD_MS : 1500);
            if (best) {
                this.scene = best.scene;
                if (this.current && !reduced) {
                    const distance = Math.hypot(best.view.x - this.current.x, best.view.y - this.current.y);
                    this.transition = { from: this.current, to: best.view, duration: Math.max(1800, distance * 1.8), elapsed: 0 };
                } else {
                    this.current = best.view;
                }
            }
            this.current ??= arenaCenter;
        }

        const step = Math.min(.1, Math.max(0, dt));
        const tracked = this.scene && !reduced ? frame(this.scene.focus, this.scene.slot) : null;
        if (tracked && this.scene) this.scene.slot = tracked.slot;
        const followTarget = tracked?.view;
        if (this.transition) {
            const pan = this.transition;
            if (followTarget) pan.to = follow(pan.to, followTarget, step);
            pan.elapsed += step * 1000;
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
        } else if (followTarget) {
            this.current = follow(this.current, followTarget, step);
        }
        return fit(this.current);
    }
}
