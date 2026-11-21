import { RELIC } from '../../server/constants/gameConstants';
import { freeAreas, type Bounds } from '../practice/layout';
import type { SyncedGameState } from '../types/synced';
import './relic-comet.css';

const STORAGE_KEY = 'ascend.relicTutorial.v1';
const READING_MS = 12_000;
type Step = 'find' | 'tow' | 'launch';
const STEPS: readonly Step[] = ['find', 'tow', 'launch'];

/** Brief, state-observed coaching in the live arena; never interrupts a player's run. */
export class RelicTutorial {
    private readonly panel = document.createElement('aside');
    private readonly heading = document.createElement('strong');
    private readonly instruction = document.createElement('p');
    private readonly dismiss = document.createElement('button');
    private readonly aim = document.createElement('button');
    private readonly seen = new Set<Step>();
    private step: Step | null = null;
    private elapsed = 0;
    private lastAt: number | null = null;
    private dismissed = false;
    private replay = false;
    private layoutKey = '';
    private replayAt = 0;
    private placed: Bounds | null = null;

    constructor(onAim: () => void) {
        try {
            const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
            if (Array.isArray(saved)) for (const step of STEPS) if (saved.includes(step)) this.seen.add(step);
        } catch { /* Blocked or corrupt storage does not prevent learning. */ }
        this.panel.className = 'relic-tutorial';
        this.panel.hidden = true;
        this.panel.setAttribute('aria-label', 'Asteroid launch tutorial');
        const copy = document.createElement('div');
        copy.setAttribute('role', 'status');
        copy.setAttribute('aria-atomic', 'true');
        copy.append(this.heading, this.instruction);
        this.dismiss.type = 'button';
        this.dismiss.textContent = 'Dismiss';
        this.dismiss.setAttribute('aria-label', 'Dismiss asteroid tutorial');
        this.dismiss.addEventListener('click', this.skip);
        // Keep Space on this native button from also becoming an arena puff.
        this.dismiss.addEventListener('keydown', this.buttonKey);
        this.dismiss.addEventListener('keyup', this.buttonKey);
        this.aim.type = 'button';
        this.aim.textContent = 'Aim relic comet';
        this.aim.className = 'relic-tutorial-aim';
        this.aim.setAttribute('aria-haspopup', 'dialog');
        this.aim.hidden = true;
        this.aim.addEventListener('click', onAim);
        this.aim.addEventListener('keydown', this.buttonKey);
        this.aim.addEventListener('keyup', this.buttonKey);
        const actions = document.createElement('div');
        actions.className = 'relic-tutorial-actions';
        actions.append(this.aim, this.dismiss);
        this.panel.append(copy, actions);
        this.panel.addEventListener('scroll', this.readingScroll);
        this.panel.addEventListener('keydown', this.readingKey);
        document.body.append(this.panel);
        window.addEventListener('ascend:relic-tutorial', this.restart);
    }

    get visible(): boolean { return !this.panel.hidden && this.panel.style.visibility !== 'hidden'; }
    get needsLayout(): boolean { return !this.panel.hidden; }
    get teachesLaunch(): boolean { return !this.panel.hidden && this.step === 'launch'; }
    suspend(): void { this.panel.hidden = true; this.lastAt = null; }

    private buttonKey = (event: KeyboardEvent): void => {
        if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation();
    };
    private readingScroll = (): void => { this.elapsed = 0; };
    private readingKey = (event: KeyboardEvent): void => {
        if (this.panel.hasAttribute('tabindex') && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End', 'Space'].includes(event.code)) {
            event.stopPropagation(); // Native scrolling must not steer or inhale in the arena.
        }
    };

    private save(): void {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen])); } catch { /* Session fallback. */ }
    }

    private skip = (): void => {
        this.dismissed = true;
        for (const step of STEPS) this.seen.add(step);
        this.save();
        // Return keyboard play to the arena without moving pointer focus on arrival.
        this.dismiss.blur();
        this.panel.hidden = true;
    };

    private restart = (): void => {
        this.dismissed = false;
        this.replay = true;
        this.step = null;
        this.elapsed = 0;
        this.lastAt = null;
        this.replayAt = performance.now() + 320; // Let Help's existing closing transition finish.
    };

    update(state: SyncedGameState, localId: string | null, available: boolean, now: number, canLaunch: boolean): void {
        if (this.lastAt !== null && this.visible) this.elapsed += Math.min(250, Math.max(0, now - this.lastAt));
        this.lastAt = now;
        const me = localId ? state.players.get(localId) : undefined;
        const relic = state.relic;
        if (state.relicComet.ownerId === localId && state.relicComet.phase !== 'idle' && !this.seen.has('launch')) {
            for (const step of STEPS) this.seen.add(step);
            this.save();
            this.replay = false;
        }
        const safeToRead = available && now >= this.replayAt && !document.hidden && me?.state === 'alive' && !me.capturedBy &&
            !me.flying && !me.stunned && !me.breathingBlocked && !me.inhaling && !me.gulping &&
            state.relicComet.phase !== 'inbound';
        if (this.dismissed || !safeToRead || relic.phase === 'disabled' || !me) { this.panel.hidden = true; return; }
        const step: Step = me.relicCometReady ? 'launch' : relic.carrierId === localId && relic.phase === 'towed' ? 'tow' : 'find';
        if (step === 'launch' && !canLaunch) { this.panel.hidden = true; return; }
        if (step === 'find' && me.width < RELIC.MIN_WIDTH && !this.replay) { this.panel.hidden = true; return; }
        if (this.step !== step) {
            // Actual towing/delivery certifies earlier steps, even if the player moved quickly.
            if (step === 'tow' || step === 'launch') this.seen.add('find');
            if (step === 'launch') this.seen.add('tow');
            this.save();
            this.step = step;
            this.panel.dataset.step = step;
            this.elapsed = 0;
            this.layoutKey = '';
        }
        if (this.elapsed >= READING_MS && (!this.seen.has(step) || this.replay) && !this.panel.contains(document.activeElement)) {
            this.seen.add(step);
            this.save();
            this.replay = false;
        }
        if (this.seen.has(step) && !this.replay) { this.panel.hidden = true; return; }
        const heading = `Asteroid launch · ${STEPS.indexOf(step) + 1} of 3`;
        if (this.heading.textContent !== heading) this.heading.textContent = heading;
        const instruction = step === 'find'
            ? me.width < RELIC.MIN_WIDTH
                ? 'Grow until “Relic unlocked” appears. Then walk into the gold relic shown on the radar to hook it.'
                : relic.phase === 'waiting'
                    ? 'You’re big enough. A gold relic will appear on the radar. Walk into it to hook it; no button needed.'
                    : relic.phase === 'towed'
                        ? 'Another player has the relic. Look for the next gold relic on the radar, then walk into it to hook it.'
                        : 'You’re big enough. Walk into the gold relic on the radar to hook it. No button needed.'
            : step === 'tow'
                ? 'Tow toward the cyan RELAY on the radar. Walk past it until the trailing relic enters the ring. You have 60 seconds.'
                : 'Asteroid ready. Choose a strike on the arena map. Rivals get a warning before impact.';
        if (this.instruction.textContent !== instruction) {
            this.instruction.textContent = instruction;
            this.layoutKey = '';
        }
        this.panel.hidden = false;
        if (this.aim.hidden !== (step !== 'launch')) this.aim.hidden = step !== 'launch';
    }

    layout(view: Bounds, obstacles: Bounds[]): void {
        if (this.panel.hidden) return;
        const font = getComputedStyle(this.panel).font;
        const key = JSON.stringify([view, this.panel.dataset.step, this.instruction.textContent, window.devicePixelRatio, font, getComputedStyle(this.heading).font, getComputedStyle(this.dismiss).font]);
        const placed = this.placed;
        // Keep the cue steady as the camera follows, relocating only for a real obstruction.
        if (key === this.layoutKey && placed && obstacles.every(b => b.left - 8 >= placed.right || b.right + 8 <= placed.left ||
            b.top - 8 >= placed.bottom || b.bottom + 8 <= placed.top)) return;
        this.layoutKey = key;
        const scrollTop = this.panel.scrollTop;
        this.panel.style.maxHeight = '';
        this.panel.style.overflowY = '';
        this.panel.removeAttribute('tabindex');
        // Fit the rendered text, not a fixed offset above a thumb control.
        const areas = freeAreas(view, obstacles, 8).sort((a, b) => a.top - b.top || (b.right - b.left) - (a.right - a.left));
        for (const area of areas) {
            if (area.right - area.left < 240) continue;
            this.panel.style.width = `${Math.min(view.bottom - view.top < 440 ? 520 : 360, Math.floor(area.right - area.left))}px`;
            const box = this.panel.getBoundingClientRect();
            if (box.height > area.bottom - area.top) continue;
            this.panel.style.left = `${Math.max(area.left, Math.min(area.right - box.width, (view.left + view.right - box.width) / 2))}px`;
            this.panel.style.top = `${area.top}px`;
            this.panel.style.visibility = '';
            const left = parseFloat(this.panel.style.left);
            this.placed = { left, right: left + box.width, top: area.top, bottom: area.top + box.height };
            return;
        }
        // Enlarged text and short viewports retain readable copy and keyboard-reachable actions.
        const area = areas.filter(a => a.right - a.left >= 240 && a.bottom - a.top >= 88)
            .sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top))[0];
        if (area) {
            this.panel.style.width = `${Math.min(520, Math.floor(area.right - area.left))}px`;
            this.panel.style.maxHeight = `${Math.floor(area.bottom - area.top)}px`;
            this.panel.style.overflowY = 'auto';
            this.panel.tabIndex = 0;
            this.panel.style.left = `${area.left}px`;
            this.panel.style.top = `${area.top}px`;
            this.panel.style.visibility = '';
            const box = this.panel.getBoundingClientRect();
            this.placed = { left: box.left, top: box.top, right: box.right, bottom: box.bottom };
            this.panel.scrollTop = scrollTop;
            const focused = document.activeElement;
            if (focused instanceof HTMLElement && focused !== this.panel && this.panel.contains(focused)) {
                focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
            return;
        }
        // Keep the arena usable in a temporarily cramped visual viewport.
        this.panel.style.visibility = 'hidden';
        this.placed = null;
        this.lastAt = null;
    }

    dispose(): void {
        window.removeEventListener('ascend:relic-tutorial', this.restart);
        this.dismiss.removeEventListener('click', this.skip);
        this.dismiss.removeEventListener('keydown', this.buttonKey);
        this.dismiss.removeEventListener('keyup', this.buttonKey);
        this.panel.removeEventListener('scroll', this.readingScroll);
        this.panel.removeEventListener('keydown', this.readingKey);
        this.panel.remove();
    }
}
