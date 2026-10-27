import type { SyncedGameState } from '../types/synced';
import { allWeapons } from '../../server/game/weaponKit';

/** Touch, mouse and keyboard all issue the same explicit placement request. */
export class WeaponPlacement {
    private button = document.createElement('button');
    private touchPlacedAt = -Infinity;
    constructor(private readonly place: () => void) {
        this.button.type = 'button';
        this.button.className = 'weapon-place-button';
        this.button.setAttribute('aria-label', 'Place weapon');
        this.button.textContent = 'Place weapon';
        const key = document.createElement('kbd'); key.textContent = 'E'; key.setAttribute('aria-hidden', 'true');
        this.button.append(key); this.button.hidden = true;
        this.button.addEventListener('click', this.activate);
        this.button.addEventListener('pointerdown', this.pointerdown);
        window.addEventListener('keydown', this.keydown);
        document.body.append(this.button);
    }
    private activate = (event?: MouseEvent): void => {
        // A touch is handled immediately below. Some engines still synthesize its click.
        if (event?.detail && performance.now() - this.touchPlacedAt < 700) return;
        if (!this.button.hidden && !this.button.disabled) this.place();
    };
    private pointerdown = (event: PointerEvent): void => {
        if (event.pointerType === 'mouse' || this.button.hidden || this.button.disabled) return;
        // Multitouch does not reliably produce a compatibility click while the other
        // thumb is steering. Place on this finger's press without taking its focus.
        event.preventDefault();
        this.touchPlacedAt = performance.now();
        this.activate();
    };
    private keydown = (event: KeyboardEvent): void => {
        const target = event.target as HTMLElement | null;
        if (event.code !== 'KeyE' || event.repeat || target?.matches('input, textarea, [contenteditable="true"]') || this.button.hidden || this.button.disabled) return;
        event.preventDefault(); this.place();
    };
    update(state: SyncedGameState, localId: string | null | undefined, intro: boolean): void {
        const me = localId ? state.players.get(localId) : undefined;
        this.button.hidden = intro || !me || !!me.capturedBy || me.flying || me.state !== 'alive' || !allWeapons(state).some(w => w.phase === 'carried' && w.owner === localId);
        this.button.disabled = !me || me.stunned;
    }
    dispose(): void {
        this.button.removeEventListener('click', this.activate);
        this.button.removeEventListener('pointerdown', this.pointerdown);
        window.removeEventListener('keydown', this.keydown);
        this.button.remove();
    }
}
