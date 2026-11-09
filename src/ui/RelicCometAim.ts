import { arenaClearance, arenaCornerRadius, constrainArenaPoint } from '../../server/game/arenaBoundary';
import { RELIC, SHIFT } from '../../server/constants/gameConstants';
import { traceArena } from '../render/arenaBoundary';
import { blackHoleLook, drawBlackHoleMarker } from '../render/blackHoleStyle';
import { drawRelicStrikeBands, relicCometSeconds } from '../render/relicComet';
import type { SyncedGameState, SyncedPlayer, SyncedRelicComet } from '../types/synced';
import './relic-comet.css';

type Point = { x: number; y: number };
type AimCallbacks = { onOpen: () => void; onFire: (target: Point) => void; onClose?: () => void };
const KEY_DIRECTIONS: Record<string, Point | undefined> = {
    ArrowUp: { x: 0, y: -1 }, KeyW: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 }, KeyS: { x: 0, y: 1 },
    ArrowLeft: { x: -1, y: 0 }, KeyA: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 }, KeyD: { x: 1, y: 0 },
};
const FIRE_REPLY_TIMEOUT_MS = 3000;

export class RelicCometAim {
    private readonly ready = document.createElement('button');
    private readonly dialog = document.createElement('dialog');
    private readonly map: HTMLCanvasElement;
    private readonly instructions: HTMLElement;
    private readonly warning: HTMLElement;
    private readonly warningTime: HTMLElement;
    private readonly warningHint: HTMLElement;
    private readonly warningAlert: HTMLElement;
    private readonly fireButton: HTMLButtonElement;
    private readonly status: HTMLElement;
    private readonly finePointer = window.matchMedia('(pointer: fine)');
    private state?: SyncedGameState;
    private worldTime = 0;
    private localId: string | null = null;
    private target: Point | null = null;
    private canAim = false;
    private pending = false;
    private replyTimer = 0;
    private awaitingConsumption = false;
    private paintedAt = -Infinity;
    private paintFrame = 0;
    private ownsSpacePress = false;
    private pointer: { id: number; startX: number; startY: number; mouse: boolean } | null = null;

    constructor(private readonly callbacks: AimCallbacks) {
        this.ready.type = 'button';
        this.ready.className = 'relic-comet-ready';
        this.ready.textContent = 'Aim relic comet';
        this.ready.setAttribute('aria-haspopup', 'dialog');
        this.ready.hidden = true;
        this.dialog.className = 'relic-comet-aim';
        this.dialog.setAttribute('aria-labelledby', 'relic-comet-title');
        this.dialog.innerHTML = `
            <header class="relic-comet-heading">
                <h2 id="relic-comet-title">Relic comet</h2>
                <p id="relic-comet-instructions"></p>
                <p id="relic-comet-warning" class="relic-comet-warning" hidden>
                    <strong>Comet inbound · <span class="relic-comet-warning-time"></span></strong>
                    <span class="relic-comet-warning-hint"></span>
                </p>
                <span class="sr-only" role="alert"></span>
            </header>
            <canvas class="relic-comet-map" tabindex="0" role="group" aria-label="Arena map"
                aria-describedby="relic-comet-instructions"></canvas>
            <footer class="relic-comet-footer">
                <div class="relic-comet-actions">
                    <button type="button" class="relic-comet-cancel">Cancel</button>
                    <button type="button" class="relic-comet-fire" disabled>Fire comet</button>
                </div>
                <p class="relic-comet-status" role="status" aria-live="polite"></p>
            </footer>`;
        const map = this.dialog.querySelector('canvas');
        const instructions = this.dialog.querySelector<HTMLElement>('#relic-comet-instructions');
        const warning = this.dialog.querySelector<HTMLElement>('#relic-comet-warning');
        const warningTime = warning?.querySelector<HTMLElement>('.relic-comet-warning-time');
        const warningHint = warning?.querySelector<HTMLElement>('.relic-comet-warning-hint');
        const warningAlert = this.dialog.querySelector<HTMLElement>('[role="alert"]');
        const fireButton = this.dialog.querySelector<HTMLButtonElement>('.relic-comet-fire');
        const status = this.dialog.querySelector<HTMLElement>('.relic-comet-status');
        const cancelButton = this.dialog.querySelector('.relic-comet-cancel');
        if (!map || !instructions || !warning || !warningTime || !warningHint || !warningAlert || !fireButton || !status || !cancelButton) {
            throw new Error('Relic comet aiming controls are missing.');
        }
        this.map = map;
        this.instructions = instructions;
        this.warning = warning;
        this.warningTime = warningTime;
        this.warningHint = warningHint;
        this.warningAlert = warningAlert;
        this.fireButton = fireButton;
        this.status = status;
        this.ready.addEventListener('click', this.open);
        this.fireButton.addEventListener('click', () => this.fire());
        cancelButton.addEventListener('click', () => this.close());
        this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
        this.dialog.addEventListener('keydown', this.keydown);
        this.map.addEventListener('pointerdown', this.pointerDown);
        this.map.addEventListener('pointermove', this.pointerMove);
        this.map.addEventListener('pointerup', this.pointerUp);
        this.map.addEventListener('pointercancel', this.resetPointer);
        this.map.addEventListener('lostpointercapture', this.resetPointer);
        document.addEventListener('keydown', this.captureSpace, true);
        document.addEventListener('keyup', this.captureSpace, true);
        window.addEventListener('blur', this.resetSpacePress);
        document.body.append(this.ready, this.dialog);
    }

    get isOpen(): boolean { return this.dialog.open; }

    update(state: SyncedGameState | undefined, localId: string | null, canAim: boolean, worldTime = state?.time ?? 0): void {
        this.state = state;
        this.worldTime = worldTime;
        this.localId = localId;
        const me = localId ? state?.players.get(localId) : undefined;
        if (!canAim) this.awaitingConsumption = false;
        this.canAim = Boolean(canAim && !this.awaitingConsumption && me && state && state.worldWidth > 0 && state.worldHeight > 0);
        if (this.isOpen && (!me || (!this.canAim && !this.pending))) this.close();
        this.ready.hidden = !this.canAim || this.isOpen;
        if (this.isOpen && performance.now() - this.paintedAt >= 66) this.paint();
    }

    private open = (): void => {
        const state = this.state;
        const me = this.localId ? state?.players.get(this.localId) : undefined;
        if (!this.canAim || this.isOpen || !state || !me) return;
        const desktop = this.finePointer.matches;
        this.target = this.startingTarget(me, state);
        this.status.textContent = '';
        this.fireButton.disabled = !this.target;
        this.dialog.classList.toggle('relic-comet-touch', !desktop);
        this.instructions.textContent = desktop
            ? 'Aim with WASD or arrows. Press Space or Enter to fire, or click the map.'
            : 'Tap or drag the reticle, then tap Fire comet.';
        if (desktop) this.dialog.showModal();
        else this.dialog.show(); // Leave the arena’s thumb controls available below the map.
        document.body.classList.add('relic-comet-aiming');
        this.ready.hidden = true;
        this.map.focus({ preventScroll: true });
        this.callbacks.onOpen();
        this.paint();
    };

    close(): void {
        if (!this.isOpen) return;
        this.pending = false;
        window.clearTimeout(this.replyTimer);
        this.pointer = null;
        cancelAnimationFrame(this.paintFrame);
        this.paintFrame = 0;
        this.dialog.close();
        this.updateWarning(undefined);
        document.body.classList.remove('relic-comet-aiming');
        this.ready.hidden = !this.canAim;
        this.callbacks.onClose?.();
    }

    resolve(status: 'accepted' | 'rejected', message?: string): void {
        if (!this.isOpen || !this.pending) return;
        this.pending = false;
        window.clearTimeout(this.replyTimer);
        if (status === 'accepted' || !this.canAim) {
            if (status === 'accepted' && this.canAim) this.awaitingConsumption = true;
            this.canAim = false;
            this.close();
            return;
        }
        this.status.textContent = message || 'The comet couldn’t fire. Choose a target and try again.';
        this.fireButton.disabled = !this.target;
    }

    dispose(): void {
        this.close();
        document.removeEventListener('keydown', this.captureSpace, true);
        document.removeEventListener('keyup', this.captureSpace, true);
        window.removeEventListener('blur', this.resetSpacePress);
        this.dialog.remove();
        this.ready.remove();
    }

    private fire(): void {
        if (!this.canAim || this.pending || !this.target || !this.state) return;
        if (!this.targetAllowed(this.target, this.state)) {
            this.target = null;
            this.fireButton.disabled = true;
            this.status.textContent = 'Choose a target on the arena floor.';
            this.paint();
            return;
        }
        this.pending = true;
        this.fireButton.disabled = true;
        this.status.textContent = 'Launching comet…';
        this.replyTimer = window.setTimeout(() => {
            this.resolve('rejected', 'The comet hasn’t confirmed. Try again.');
        }, FIRE_REPLY_TIMEOUT_MS);
        this.callbacks.onFire({ ...this.target });
    }

    private captureSpace = (event: KeyboardEvent): void => {
        if (event.code !== 'Space' && event.key !== ' ') return;
        const release = event.type === 'keyup';
        const owned = this.ownsSpacePress;
        if (!owned && (release || !this.isOpen || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey)) return;

        // Consume the whole press even if the server closes the aiming view before keyup.
        event.preventDefault();
        event.stopPropagation();
        this.ownsSpacePress = !release;
        if (!release && !owned && !event.repeat) this.fire();
    };

    private resetSpacePress = (): void => { this.ownsSpacePress = false; };

    private keydown = (event: KeyboardEvent): void => {
        event.stopPropagation();
        if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
        if (event.key === 'Tab' && this.dialog.classList.contains('relic-comet-touch')) {
            const buttons = [...this.dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
            const last = buttons[buttons.length - 1];
            if (event.shiftKey && event.target === this.map) { event.preventDefault(); last?.focus(); }
            if (!event.shiftKey && event.target === last) { event.preventDefault(); this.map.focus(); }
            return;
        }
        if (event.key === 'Enter' && event.target === this.map) {
            event.preventDefault();
            if (!event.repeat) this.fire();
            return;
        }
        const direction = KEY_DIRECTIONS[event.code] ?? KEY_DIRECTIONS[event.key];
        const state = this.state;
        if (!direction || !state) return;
        event.preventDefault();
        if (this.pending) return;
        const step = Math.min(state.worldWidth, state.worldHeight) / 40;
        const me = this.localId ? state.players.get(this.localId) : undefined;
        const start = this.target ?? (me ? { x: me.x + me.width / 2, y: me.y + me.height / 2 }
            : { x: state.worldWidth / 2, y: state.worldHeight / 2 });
        const point = { x: start.x + direction.x * step, y: start.y + direction.y * step };
        constrainArenaPoint(point, state.worldWidth, state.worldHeight, 1e-4);
        if (this.targetAllowed(point, state)) this.setTarget(point, true);
    };

    private mapBounds(width: number, height: number, state: SyncedGameState) {
        const scale = Math.min(width / state.worldWidth, height / state.worldHeight);
        return { x: (width - state.worldWidth * scale) / 2, y: (height - state.worldHeight * scale) / 2, scale };
    }

    private startingTarget(player: SyncedPlayer, state: SyncedGameState): Point | null {
        const center = { x: player.x + player.width / 2, y: player.y + player.height / 2 };
        const reach = player.width / 2 + RELIC.OUTER_RADIUS + 40;
        const ahead = { x: center.x + Math.cos(player.facing) * reach, y: center.y + Math.sin(player.facing) * reach };
        constrainArenaPoint(ahead, state.worldWidth, state.worldHeight, 1e-4);
        if (Math.hypot(ahead.x - center.x, ahead.y - center.y) >= RELIC.OUTER_RADIUS && this.targetAllowed(ahead, state)) return ahead;
        return this.targetAllowed(center, state) ? center : null;
    }

    private pointerPoint(event: PointerEvent): Point | null {
        const state = this.state;
        if (!state) return null;
        const rect = this.map.getBoundingClientRect();
        const bounds = this.mapBounds(rect.width, rect.height, state);
        if (!bounds.scale) return null;
        const point = { x: (event.clientX - rect.left - bounds.x) / bounds.scale, y: (event.clientY - rect.top - bounds.y) / bounds.scale };
        return this.targetAllowed(point, state) ? point : null;
    }

    private targetAllowed(point: Point, state: SyncedGameState): boolean {
        if (arenaClearance(point.x, point.y, state.worldWidth, state.worldHeight) < 0) return false;
        if (!state.floor) return true;
        const col = Math.min(SHIFT.GRID - 1, Math.floor(point.x / state.worldWidth * SHIFT.GRID));
        const row = Math.min(SHIFT.GRID - 1, Math.floor(point.y / state.worldHeight * SHIFT.GRID));
        return state.floor[row * SHIFT.GRID + col] === '1';
    }

    private pointerDown = (event: PointerEvent): void => {
        if (this.pending || this.pointer || event.button !== 0) return;
        const point = this.pointerPoint(event);
        if (!point) return;
        event.preventDefault();
        this.map.focus({ preventScroll: true });
        this.pointer = { id: event.pointerId, startX: event.clientX, startY: event.clientY, mouse: event.pointerType === 'mouse' };
        if (event.isTrusted) this.map.setPointerCapture(event.pointerId);
        this.setTarget(point);
    };

    private pointerMove = (event: PointerEvent): void => {
        if (this.pending || (this.pointer ? this.pointer.id !== event.pointerId : event.pointerType !== 'mouse')) return;
        const point = this.pointerPoint(event);
        if (point) this.setTarget(point);
    };

    private pointerUp = (event: PointerEvent): void => {
        const pressed = this.pointer;
        if (pressed?.id !== event.pointerId) return;
        this.pointer = null;
        const point = this.pointerPoint(event);
        if (!point || this.pending) return;
        this.setTarget(point, true);
        if (pressed.mouse && Math.hypot(event.clientX - pressed.startX, event.clientY - pressed.startY) <= 8) this.fire();
    };

    private resetPointer = (event: PointerEvent): void => {
        if (this.pointer?.id === event.pointerId) this.pointer = null;
    };

    private setTarget(point: Point, announce = false): void {
        this.target = point;
        this.fireButton.disabled = false;
        if (announce && this.state) {
            this.status.textContent = `Target ${Math.round(point.x / this.state.worldWidth * 100)}% across, ${Math.round(point.y / this.state.worldHeight * 100)}% down.`;
        } else if (this.status.textContent?.startsWith('Target ')) {
            this.status.textContent = '';
        }
        if (!this.paintFrame) this.paintFrame = requestAnimationFrame(() => {
            this.paintFrame = 0;
            if (this.isOpen) this.paint();
        });
    }

    private paint(): void {
        const state = this.state;
        const ctx = this.map.getContext('2d');
        if (!state || !ctx) return;
        const comet = state.relicComet;
        const incoming = comet?.phase === 'inbound' && comet.ownerId !== this.localId ? comet : undefined;
        this.updateWarning(incoming);
        const { width, height } = this.map.getBoundingClientRect();
        if (width <= 0 || height <= 0) return;
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        const pixelWidth = Math.max(1, Math.round(width * ratio)), pixelHeight = Math.max(1, Math.round(height * ratio));
        if (this.map.width !== pixelWidth || this.map.height !== pixelHeight) {
            this.map.width = pixelWidth;
            this.map.height = pixelHeight;
        }
        this.paintedAt = performance.now();
        ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
        ctx.clearRect(0, 0, width, height);
        const { x, y, scale } = this.mapBounds(width, height, state);
        const arenaWidth = state.worldWidth * scale, arenaHeight = state.worldHeight * scale;
        ctx.save();
        ctx.translate(x, y);
        ctx.beginPath();
        traceArena(ctx, 0, 0, arenaWidth, arenaHeight, arenaCornerRadius(state.worldWidth, state.worldHeight) * scale);
        ctx.fillStyle = '#102336'; ctx.fill();
        ctx.strokeStyle = '#559d9d'; ctx.lineWidth = 2; ctx.stroke();
        ctx.clip();
        this.paintLandmarks(ctx, state, scale, arenaWidth, arenaHeight);
        state.players.forEach((player, id) => {
            if (id !== this.localId && player.state === 'alive' && !player.capturedBy) this.paintPlayer(ctx, player, scale, false);
        });
        const me = this.localId ? state.players.get(this.localId) : undefined;
        if (me) this.paintPlayer(ctx, me, scale, true);
        ctx.restore();
        if (incoming) drawRelicStrikeBands(ctx, x + incoming.x * scale, y + incoming.y * scale, scale, 1);
        if (this.target) this.paintTarget(ctx, x + this.target.x * scale, y + this.target.y * scale, scale, !incoming);
    }

    private updateWarning(incoming: SyncedRelicComet | undefined): void {
        const visible = Boolean(incoming);
        if (this.warning.hidden === visible) {
            this.warning.hidden = !visible;
            this.instructions.hidden = visible;
            this.map.setAttribute('aria-describedby', visible ? this.warning.id : this.instructions.id);
            if (visible) {
                this.warningHint.textContent = this.finePointer.matches ? 'Esc or Cancel to move' : 'Tap Cancel to move';
                this.warningAlert.textContent = `Comet inbound. ${this.warningHint.textContent}.`;
            } else this.warningAlert.textContent = '';
        }
        if (incoming) {
            const time = relicCometSeconds(incoming.impactAt, this.worldTime);
            if (this.warningTime.textContent !== time) this.warningTime.textContent = time;
        }
    }

    private paintPlayer(ctx: CanvasRenderingContext2D, player: SyncedPlayer, scale: number, local: boolean): void {
        const x = (player.x + player.width / 2) * scale, y = (player.y + player.height / 2) * scale;
        const radius = player.width / 2 * scale;
        if (radius >= 6) {
            ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fillStyle = local ? 'rgba(112, 222, 192, .08)' : 'rgba(185, 205, 223, .07)'; ctx.fill();
            ctx.strokeStyle = local ? '#5d978f' : '#506577'; ctx.lineWidth = 1; ctx.stroke();
        }
        ctx.beginPath();
        if (local) {
            ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath();
        } else ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = local ? '#a4f0d9' : '#c8d7e5'; ctx.fill();
        ctx.strokeStyle = '#0a1521'; ctx.lineWidth = 1; ctx.stroke();
        if (local) {
            ctx.font = '750 10px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const labelY = y < 24 ? y + 13 : y - 13;
            ctx.lineWidth = 3; ctx.strokeText('YOU', x, labelY); ctx.fillText('YOU', x, labelY);
        }
    }

    private paintLandmarks(ctx: CanvasRenderingContext2D, state: SyncedGameState, scale: number, width: number, height: number): void {
        ctx.strokeStyle = '#21394d'; ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 1; i < 4; i++) {
            ctx.moveTo(width * i / 4, 0); ctx.lineTo(width * i / 4, height);
            ctx.moveTo(0, height * i / 4); ctx.lineTo(width, height * i / 4);
        }
        ctx.stroke();
        if (state.floor) {
            ctx.fillStyle = '#0a1420';
            const tileWidth = width / SHIFT.GRID, tileHeight = height / SHIFT.GRID;
            for (let i = 0; i < state.floor.length; i++) {
                if (state.floor[i] === '0') ctx.fillRect(i % SHIFT.GRID * tileWidth, Math.floor(i / SHIFT.GRID) * tileHeight, tileWidth, tileHeight);
            }
        }
        ctx.fillStyle = '#476074';
        state.obstacles?.forEach(item => ctx.fillRect(item.x * scale, item.y * scale, item.width * scale, item.height * scale));
        state.blackHoles?.forEach(hole => drawBlackHoleMarker(ctx, hole.x * scale, hole.y * scale, hole, blackHoleLook(hole, state.time)));
    }

    private paintTarget(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, showRings: boolean): void {
        if (showRings) drawRelicStrikeBands(ctx, x, y, scale, 1);
        ctx.beginPath();
        ctx.moveTo(x - 11, y); ctx.lineTo(x - 4, y);
        ctx.moveTo(x + 4, y); ctx.lineTo(x + 11, y);
        ctx.moveTo(x, y - 11); ctx.lineTo(x, y - 4);
        ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 11);
        ctx.strokeStyle = '#07121e'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = '#fff0c7'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fff0c7'; ctx.fill();
    }
}
