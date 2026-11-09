import { mouseControlEnabled, setMouseControl } from '../core/MouseControl';
import { playerName, setPlayerName } from '../core/PlayerName';
import { sound } from '../core/Sound';
import './join.css';

export type JoinDestination = 'play' | 'tutorial';

export class JoinUI {
    private readonly dialog = document.createElement('dialog');
    private readonly form: HTMLFormElement;
    private readonly name: HTMLInputElement;
    private readonly steering: HTMLFieldSetElement;
    private readonly touchHint: HTMLParagraphElement;
    private readonly mouse: HTMLInputElement;
    private readonly keyboard: HTMLInputElement;
    private readonly play: HTMLButtonElement;
    private readonly tutorial: HTMLButtonElement;
    private readonly status: HTMLParagraphElement;
    private readonly finePointer = window.matchMedia('(pointer: fine)');
    private busy = false;

    constructor(private readonly choose: (destination: JoinDestination) => Promise<boolean>) {
        this.dialog.className = 'join-dialog';
        this.dialog.setAttribute('aria-labelledby', 'join-title');
        this.dialog.innerHTML = `
            <h2 id="join-title">Ascend Avoid</h2>
            <form class="join-form">
                <div class="join-name">
                    <label for="join-name">Your name</label>
                    <input id="join-name" type="text" maxlength="20" spellcheck="false" autocomplete="off"
                        autocapitalize="words" enterkeyhint="go" required>
                </div>
                <fieldset class="join-steering" aria-describedby="join-space-help">
                    <legend>Steering</legend>
                    <div class="join-steering-options">
                        <label>
                            <input type="radio" name="join-steering" value="keyboard" aria-label="Keyboard"
                                aria-describedby="join-keyboard-help">
                            <span><strong>Keyboard</strong><small id="join-keyboard-help">WASD or arrows</small></span>
                        </label>
                        <label>
                            <input type="radio" name="join-steering" value="mouse" aria-label="Mouse"
                                aria-describedby="join-mouse-help">
                            <span><strong>Mouse</strong><small id="join-mouse-help">Follow your cursor</small></span>
                        </label>
                    </div>
                    <p id="join-space-help" class="join-space-help">
                        <kbd>Space</kbd><span>Hold to inhale · Tap to shoot when loaded</span>
                    </p>
                </fieldset>
                <p class="join-touch" hidden>Left stick to move · Hold INHALE</p>
                <div class="join-actions">
                    <button type="submit" class="join-play" autofocus>Play now</button>
                    <button type="submit" class="join-tutorial">Tutorial</button>
                </div>
            </form>
            <p class="join-status" role="status"></p>
        `;
        const element = <T extends HTMLElement>(selector: string): T => {
            const found = this.dialog.querySelector<T>(selector);
            if (!found) throw new Error(`Join dialog is missing ${selector}`);
            return found;
        };
        this.form = element('form');
        this.name = element('#join-name');
        this.steering = element('fieldset');
        this.touchHint = element('.join-touch');
        this.mouse = element('[value="mouse"]');
        this.keyboard = element('[value="keyboard"]');
        this.play = element('.join-play');
        this.tutorial = element('.join-tutorial');
        this.status = element('.join-status');

        this.form.addEventListener('submit', event => {
            event.preventDefault();
            void this.start(event.submitter === this.tutorial ? 'tutorial' : 'play');
        });
        this.name.addEventListener('input', () => this.name.setCustomValidity(''));
        // Entry requires choosing an action. Keep arena shortcuts outside the dialog.
        this.dialog.addEventListener('cancel', event => event.preventDefault());
        this.dialog.addEventListener('keydown', event => event.stopPropagation());
        this.dialog.addEventListener('keyup', event => event.stopPropagation());
        document.body.append(this.dialog);
    }

    get isOpen(): boolean { return this.dialog.open; }
    previewBounds(): DOMRect | undefined { return this.isOpen ? this.dialog.getBoundingClientRect() : undefined; }

    open(returning: boolean): void {
        if (this.isOpen) return;
        this.name.value = playerName();
        this.name.setCustomValidity('');
        this.touchHint.hidden = !window.matchMedia('(pointer: coarse)').matches && navigator.maxTouchPoints === 0;
        this.mouse.checked = mouseControlEnabled();
        this.keyboard.checked = !this.mouse.checked;
        this.play.textContent = returning ? 'Play' : 'Play now';
        this.tutorial.hidden = returning;
        this.status.textContent = '';
        this.fitViewport();
        this.dialog.showModal();
        (window.visualViewport ?? window).addEventListener('resize', this.fitViewport);
        window.visualViewport?.addEventListener('scroll', this.fitViewport);
    }

    close(): void {
        if (!this.isOpen) return;
        this.dialog.close();
        (window.visualViewport ?? window).removeEventListener('resize', this.fitViewport);
        window.visualViewport?.removeEventListener('scroll', this.fitViewport);
    }

    private fitViewport = (): void => {
        const viewport = window.visualViewport;
        this.dialog.classList.toggle('join-compact', (viewport?.height ?? window.innerHeight) <= 480);
        if (!viewport) return;
        this.dialog.style.setProperty('--join-viewport-top', `${viewport.offsetTop}px`);
        this.dialog.style.setProperty('--join-viewport-left', `${viewport.offsetLeft}px`);
        this.dialog.style.setProperty('--join-viewport-width', `${viewport.width}px`);
        this.dialog.style.setProperty('--join-viewport-height', `${viewport.height}px`);
    };

    private async start(destination: JoinDestination): Promise<void> {
        if (this.busy) return;
        const name = setPlayerName(this.name.value);
        if (!name) {
            this.name.setCustomValidity('Enter a player name.');
            this.name.reportValidity();
            return;
        }
        this.name.value = name;
        if (this.finePointer.matches) setMouseControl(this.mouse.checked);
        sound.unlock();
        const action = destination === 'play' ? this.play : this.tutorial;
        action.focus({ preventScroll: true });
        this.setBusy(true);
        this.status.textContent = destination === 'play' ? 'Joining the arena…' : 'Opening the tutorial…';
        try {
            if (await this.choose(destination)) {
                this.close();
                return;
            }
        } catch {
            // A failed connection and a rejected launch share the same retry prompt.
        } finally {
            this.setBusy(false);
        }
        this.status.textContent = destination === 'play'
            ? 'Couldn’t join the arena. Try again.'
            : 'Couldn’t open the tutorial. Try again.';
        this.status.classList.add('join-error');
    }

    private setBusy(busy: boolean): void {
        this.busy = busy;
        this.form.setAttribute('aria-busy', String(busy));
        this.name.readOnly = busy;
        this.steering.disabled = busy;
        this.play.setAttribute('aria-disabled', String(busy));
        this.tutorial.setAttribute('aria-disabled', String(busy));
        this.status.classList.remove('join-error');
    }
}
