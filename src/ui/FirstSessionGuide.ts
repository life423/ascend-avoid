import type { SyncedPlayer } from '../types/synced';

/** A first-visit hint expires after four seconds, or sooner when dismissed. */
export class FirstSessionGuide {
    private element = document.createElement('div');
    private text = document.createElement('span');
    private step = 0;
    private dismissed = false;
    private shownAt: number | null = null;
    constructor() {
        try { this.dismissed = localStorage.getItem('ascend.guideSeen') === 'true'; } catch { /* optional storage */ }
        this.element.className = 'first-session-guide';
        this.element.setAttribute('role', 'status');
        const close = document.createElement('button');
        close.type = 'button';
        close.textContent = 'Got it';
        close.addEventListener('click', () => this.dismiss());
        this.element.append(this.text, close);
        this.element.hidden = true;
        document.body.append(this.element);
        window.addEventListener('ascend:replay-guide', this.replay);
    }
    launched(): void { this.step = 4; }
    update(me: SyncedPlayer | undefined, intro: boolean): void {
        if (me?.gems && this.step === 0) this.step = 1;
        if (me?.inhaling && this.step === 1) this.step = 2;
        if (me?.gulping) this.step = Math.max(3, this.step);
        if (this.step === 4) this.dismiss();
        this.element.hidden = this.dismissed || intro || !me || me.state !== 'alive' || !!me.capturedBy || !!me.gulping || me.flying;
        if (!this.element.hidden) {
            this.shownAt ??= performance.now();
            if (performance.now() - this.shownAt >= 4000) this.dismiss();
        }
        const tip = this.step === 0 ? 'Move with the mouse, WASD, arrows or the left stick. Grab a gem to grow.'
            : this.step === 1 ? 'Hold Space or the right button to inhale gems and steal from creatures ahead.'
            : this.step === 2 ? 'Catch someone smaller, release, aim and tap FIRE.'
            : 'Aim by moving, then tap FIRE. Your aim sets the shot; the captive cannot steer it.';
        if (this.text.textContent !== tip) this.text.textContent = tip;
    }
    private dismiss(): void {
        this.dismissed = true;
        this.element.hidden = true;
        try { localStorage.setItem('ascend.guideSeen', 'true'); } catch { /* optional storage */ }
    }
    private replay = (): void => { this.dismissed = false; this.step = 0; this.shownAt = null; };
    dispose(): void {
        window.removeEventListener('ascend:replay-guide', this.replay);
        this.element.remove();
    }
}
