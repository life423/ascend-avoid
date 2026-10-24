import type { SyncedGameState } from '../types/synced';

/** Touch, mouse and keyboard all issue the same explicit placement request. */
export class WeaponPlacement {
    private button = document.createElement('button');
    constructor(private readonly place: () => void) {
        this.button.type = 'button';
        this.button.className = 'weapon-place-button';
        this.button.setAttribute('aria-label', 'Place weapon');
        this.button.textContent = 'Place weapon';
        const key = document.createElement('kbd'); key.textContent = 'E'; key.setAttribute('aria-hidden', 'true');
        this.button.append(key); this.button.hidden = true;
        this.button.addEventListener('click', this.activate);
        window.addEventListener('keydown', this.keydown);
        document.body.append(this.button);
    }
    private activate = (): void => {
        if (!this.button.hidden && !this.button.disabled) this.place();
    };
    private keydown = (event: KeyboardEvent): void => {
        const target = event.target as HTMLElement | null;
        if (event.code !== 'KeyE' || event.repeat || target?.matches('input, textarea, [contenteditable="true"]') || this.button.hidden || this.button.disabled) return;
        event.preventDefault(); this.place();
    };
    update(state: SyncedGameState, localId: string | null | undefined, intro: boolean): void {
        const me = localId ? state.players.get(localId) : undefined;
        this.button.hidden = intro || !me || !!me.capturedBy || me.flying || me.state !== 'alive' || state.pinwheel?.phase !== 'carried' || state.pinwheel.owner !== localId;
        this.button.disabled = !me || me.stunned;
    }
    dispose(): void {
        this.button.removeEventListener('click', this.activate);
        window.removeEventListener('keydown', this.keydown);
        this.button.remove();
    }
}
