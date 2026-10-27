import { playerName, setPlayerName } from '../core/PlayerName';
import { GAME_RULES } from './GameRules';
import { sound } from '../core/Sound';
import { mouseControlEnabled, setMouseControl } from '../core/MouseControl';

/** Large screens: the drawer sizes itself to its content (see fitToScreen) */
const DESKTOP = '(min-width: 1200px)';
const COLUMN_WIDTH = 320;
const COLUMN_GAP = 32;
const CONTENT_PADDING = 25;
/** Text sizes to try, largest first */
const TEXT_STEPS = [1, 0.94, 0.88, 0.82, 0.76, 0.7, 0.66, 0.62];
export class DrawerUI {
    private container: HTMLElement;
    private hamburgerBtn!: HTMLButtonElement;
    private drawer!: HTMLDivElement;
    private overlay!: HTMLDivElement;
    private isOpen: boolean = false;
    private returnFocus: HTMLElement | null = null;
    private activity = (event: Event): void => {
        const text = (event as CustomEvent<string>).detail;
        const list = this.drawer.querySelector('.activity-history');
        if (!list || typeof text !== 'string') return;
        const item = document.createElement('li'); item.textContent = text;
        list.prepend(item);
        while (list.children.length > 20) list.lastElementChild?.remove();
    };
    private weaponRecord = (event: Event): void => {
        const data = (event as CustomEvent<{ damage: number; knockouts: number }>).detail;
        const record = this.drawer.querySelector('.weapon-record');
        if (record && data) record.textContent = `${data.damage.toLocaleString()} damage · ${data.knockouts.toLocaleString()} knockouts · +${data.damage.toLocaleString()} gems earned`;
    };

    constructor() {
        this.container = document.body;
        this.createElements();
        this.attachEventListeners();
        this.injectStyles();
        window.addEventListener('ascend:weapon-record', this.weaponRecord);
        window.addEventListener('ascend:activity', this.activity);
    }

    private createElements(): void {
        // Create hamburger button
        this.hamburgerBtn = document.createElement('button');
        this.hamburgerBtn.className = 'hamburger-button';
        this.hamburgerBtn.setAttribute('aria-label', 'Toggle menu');
        this.hamburgerBtn.innerHTML = `
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
            <span class="hamburger-line"></span>
        `;

        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'drawer-overlay';

        // Create drawer
        this.drawer = document.createElement('div');
        this.drawer.className = 'drawer';
        this.drawer.setAttribute('role', 'dialog');
        this.drawer.setAttribute('aria-modal', 'true');
        this.drawer.setAttribute('aria-hidden', 'true');
        this.drawer.setAttribute('aria-labelledby', 'game-menu-title');
        this.drawer.inert = true;
        this.drawer.innerHTML = `
            <div class="drawer-header">
                <h2 id="game-menu-title">Game Menu</h2>
                <button type="button" class="drawer-close" aria-label="Close">&times;</button>
            </div>
            <div class="drawer-content">
                <div class="menu-section name-section">
                    <h3>Your name</h3>
                    <form class="name-form" autocomplete="off">
                        <input class="name-input" type="text" maxlength="20" placeholder="Pick a name" aria-label="Your name" autocapitalize="words" spellcheck="false" enterkeyhint="done">
                        <button class="name-save" type="submit">Save</button>
                    </form>
                    <p class="name-note">Everyone sees it above your creature and on the leaderboard.</p>
                </div>
                <div class="menu-section">
                    <h3>How to Play</h3>
                    <div class="instructions">
                        ${GAME_RULES}
                    </div>
                </div>
                <div class="menu-section">
                    <h3>Weapon record</h3>
                    <p class="weapon-record">0 damage · 0 knockouts · +0 gems earned</p>
                </div>
                <div class="menu-section">
                    <h3>Recent activity</h3>
                    <ol class="activity-history"></ol>
                </div>
                <div class="menu-section">
                    <h3>Settings</h3>
                    <button type="button" role="switch" class="mouse-preference" data-action="mouse" aria-label="Mouse control" aria-checked="${mouseControlEnabled()}">Mouse <span>${mouseControlEnabled() ? 'On' : 'Off'}</span></button>
                    <button type="button" class="sound-toggle" aria-label="Mute sound" aria-pressed="${sound.muted}">Sound ${sound.muted ? 'off' : 'on'}</button>
                    <button type="button" class="replay-guide">Show starter tips</button>
                </div>
            </div>
        `;

        // Append to DOM
        this.container.appendChild(this.hamburgerBtn);
        this.container.appendChild(this.overlay);
        this.container.appendChild(this.drawer);
    }

    private attachEventListeners(): void {
        this.drawer.querySelector('.mouse-preference')?.addEventListener('click', () => setMouseControl(!mouseControlEnabled()));
        const soundButton = this.drawer.querySelector<HTMLButtonElement>('.sound-toggle');
        soundButton?.addEventListener('click', () => {
            sound.toggle();
            soundButton.textContent = `Sound ${sound.muted ? 'off' : 'on'}`;
            soundButton.setAttribute('aria-pressed', String(sound.muted));
        });
        this.drawer.querySelector('.replay-guide')?.addEventListener('click', () => {
            window.dispatchEvent(new Event('ascend:replay-guide'));
            this.close();
        });
        // Toggle drawer on hamburger click
        this.hamburgerBtn.addEventListener('click', () => this.toggle());
        
        // Close drawer on overlay click
        this.overlay.addEventListener('click', () => this.close());

        // Close drawer on ESC key
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (!this.isOpen) return;
            if (e.key === 'Tab') {
                const targets = [...this.drawer.querySelectorAll<HTMLElement>('button, input, [tabindex="0"]')];
                const first = targets[0], last = targets[targets.length - 1];
                if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
                else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
            }
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Prevent drawer from closing when clicking inside it
        this.drawer.addEventListener('click', (e: Event) => {
            e.stopPropagation();
        });

        // Resizing the window resizes an open drawer to match
        window.addEventListener('resize', () => {
            if (this.isOpen) this.fitToScreen();
        });

        // Desktop has no menu button to close it with, so the drawer has its own x
        this.drawer.querySelector('.drawer-close')?.addEventListener('click', () => this.close());

        // Your name: saved on this device, and everyone sees the change right away
        this.injectNameStyles();
        const form = this.drawer.querySelector<HTMLFormElement>('.name-form');
        const input = this.drawer.querySelector<HTMLInputElement>('.name-input');
        const note = this.drawer.querySelector<HTMLElement>('.name-note');
        form?.addEventListener('submit', (e: Event) => {
            e.preventDefault();
            if (!input) return;
            const name = setPlayerName(input.value);
            input.value = name ?? playerName();
            if (!name) return;
            input.blur();
            if (note) note.textContent = `Saved! You're ${name} now.`;
        });

    }


    /** The name box shows the name you play under each time the drawer opens */
    private showName(): void {
        const input = this.drawer.querySelector<HTMLInputElement>('.name-input');
        const note = this.drawer.querySelector<HTMLElement>('.name-note');
        if (input && document.activeElement !== input) input.value = playerName();
        if (note) note.textContent = 'Everyone sees it above your creature and on the leaderboard.';
    }

    private injectNameStyles(): void {
        if (document.getElementById('drawer-name-styles')) return;
        const style = document.createElement('style');
        style.id = 'drawer-name-styles';
        style.textContent = `
            .name-form { display: flex; gap: 8px; margin: 8px 0 6px; }
            .name-input { flex: 1; min-width: 0; font-family: inherit; font-size: 16px; font-weight: 600; padding: 10px 12px;
                color: #fff; background: rgba(255, 255, 255, 0.08); border: 1px solid rgba(79, 209, 197, 0.45); border-radius: 10px; outline: none; }
            .name-input:focus { border-color: #4fd1c5; box-shadow: 0 0 0 3px rgba(79, 209, 197, 0.25); }
            .name-save { font-family: inherit; font-size: 15px; font-weight: 700; padding: 0 16px; color: #0b1422;
                background: #4fd1c5; border: 0; border-radius: 10px; cursor: pointer; }
            .name-save:active { transform: scale(0.97); }
            .name-note { font-size: 13px; opacity: 0.7; margin: 0; }
        `;
        document.head.appendChild(style);
    }

    private injectStyles(): void {
        if (document.getElementById('drawer-styles')) return;

        const style = document.createElement('style');
        style.id = 'drawer-styles';
        style.textContent = `
            /* Hamburger Button */
            .hamburger-button {
                position: fixed;
                top: 20px;
                right: 20px;
                width: 40px;
                height: 40px;
                background: rgba(12, 199, 199, 0.1);
                border: 2px solid rgba(12, 199, 199, 0.3);
                border-radius: 8px;
                cursor: pointer;
                z-index: 1001;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                gap: 4px;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
                -webkit-backdrop-filter: blur(10px);
            }

            .hamburger-button:hover {
                background: rgba(12, 199, 199, 0.2);
                border-color: rgba(12, 199, 199, 0.5);
                box-shadow: 0 0 20px rgba(12, 199, 199, 0.3);
            }

            .hamburger-button.active {
                background: rgba(12, 199, 199, 0.3);
                border-color: #0CC7C7;
            }

            /* Hamburger lines */
            .hamburger-line {
                width: 20px;
                height: 2px;
                background: #0CC7C7;
                transition: all 0.3s ease;
            }

            .hamburger-button.active .hamburger-line:nth-child(1) {
                transform: rotate(45deg) translate(5px, 5px);
            }

            .hamburger-button.active .hamburger-line:nth-child(2) {
                opacity: 0;
            }

            .hamburger-button.active .hamburger-line:nth-child(3) {
                transform: rotate(-45deg) translate(5px, -5px);
            }

            /* Overlay */
            .drawer-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                opacity: 0;
                visibility: hidden;
                transition: all 0.3s ease;
                z-index: 999;
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
            }

            .drawer-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            /* Drawer */
            .drawer {
                position: fixed;
                top: 0;
                left: 0;
                width: 320px;
                height: 100%;
                background: rgba(10, 10, 10, 0.95);
                border-right: 1px solid rgba(12, 199, 199, 0.3);
                transform: translateX(-100%);
                visibility: hidden;
                transition: transform 0.3s ease, visibility 0s linear 0.3s;
                z-index: 1000;
                overflow-y: auto;
                touch-action: pan-y;
                overscroll-behavior-y: contain;
                -webkit-overflow-scrolling: touch;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
            }

            .drawer.active {
                transform: translateX(0);
                visibility: visible;
                transition-delay: 0s;
                box-shadow: 0 0 50px rgba(12, 199, 199, 0.2);
            }

            /* Drawer Header */
            .drawer-header {
                padding: 30px 25px 20px;
                border-bottom: 1px solid rgba(12, 199, 199, 0.2);
                background: rgba(12, 199, 199, 0.05);
            }

            .drawer-header h2 {
                color: #0CC7C7;
                font-size: 24px;
                font-weight: 600;
                text-shadow: 0 0 20px rgba(12, 199, 199, 0.5);
                margin: 0;
            }

            /* Drawer Content */
            .drawer-content {
                padding: 25px;
            }

            .menu-section {
                margin-bottom: 30px;
                padding-bottom: 20px;
                border-bottom: 1px solid rgba(12, 199, 199, 0.1);
            }

            .menu-section:last-child {
                border-bottom: none;
                margin-bottom: 0;
            }

            .menu-section h3 {
                color: #0CC7C7;
                margin-bottom: 15px;
                font-size: 18px;
            }

            .menu-section h4 {
                color: #0CC7C7;
                margin-bottom: 10px;
                font-size: 16px;
            }

            .instructions {
                line-height: 1.8;
                color: #e0e0e0;
            }

            .instructions p {
                margin-bottom: 15px;
                color: #b0b0b0;
            }

            .instructions ul {
                list-style: none;
                margin-bottom: 15px;
                padding: 0;
            }

            .instructions li {
                margin-bottom: 8px;
                padding-left: 25px;
                position: relative;
                color: #b0b0b0;
            }

            .instructions li:before {
                content: '▸';
                position: absolute;
                left: 0;
                color: #0CC7C7;
            }

            .instructions .highlight {
                color: #0CC7C7;
                font-weight: 500;
            }

            .instructions .emphasis {
                display: block;
                margin: 15px 0;
                padding: 15px;
                background: rgba(12, 199, 199, 0.1);
                border-left: 3px solid #0CC7C7;
                border-radius: 4px;
                font-style: italic;
                color: #e0e0e0;
            }

            /* Menu Buttons */
            .menu-button {
                width: 100%;
                padding: 15px 20px;
                background: rgba(12, 199, 199, 0.1);
                border: 1px solid rgba(12, 199, 199, 0.3);
                border-radius: 8px;
                color: #0CC7C7;
                font-size: 16px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 12px;
                margin-bottom: 10px;
            }

            .menu-button:hover {
                background: rgba(12, 199, 199, 0.2);
                border-color: rgba(12, 199, 199, 0.5);
                box-shadow: 0 0 15px rgba(12, 199, 199, 0.2);
                transform: translateY(-1px);
            }

            .menu-button:active {
                transform: translateY(0);
            }

            .button-icon {
                font-size: 18px;
            }

            .button-text {
                flex: 1;
                text-align: left;
            }

            .activity-history { padding-left: 18px; font-size: 12px; line-height: 1.5; }
            .activity-history li { margin: 6px 0; overflow-wrap: anywhere; }

            /* Mobile Responsive */
            @media (max-width: 480px) {
                .drawer {
                    width: 85%;
                    max-width: 320px;
                }

                .hamburger-button {
                    top: 15px;
                    right: 15px;
                    width: 36px;
                    height: 36px;
                }

                .drawer-header {
                    padding: 25px 20px 15px;
                }

                .drawer-content {
                    padding: 20px;
                }

                .menu-section {
                    margin-bottom: 25px;
                }
            }

            /* Tablet */
            @media (min-width: 481px) and (max-width: 768px) {
                .drawer {
                    width: 340px;
                }
            }

            /* Hide multiplayer button on mobile when drawer is present */
            @media (max-width: 768px) {
                .mp-button-container {
                    display: none !important;
                }
            }

            /* Hide hamburger button on desktop when desktop-nav-buttons is visible */
            @media (min-width: 1200px) {
                .hamburger-button {
                    display: none !important;
                }
            }
        `;

        document.head.appendChild(style);
    }

    /**
     * On large screens the drawer opens just wide enough to show everything without scrolling:
     * How to Play flows into columns, one more at a time, and the text only shrinks (a step at a
     * time) if even nearly the screen's whole width isn't enough. Phones keep the narrow drawer.
     */
    private fitToScreen(): void {
        const content = this.drawer.querySelector<HTMLElement>('.drawer-content');
        if (!content) return;
        if (!window.matchMedia(DESKTOP).matches) {
            this.drawer.style.width = '';
            content.style.columnCount = '';
            content.style.zoom = '';
            return;
        }
        // Leaves a sliver of the game showing
        const maxWidth = window.innerWidth - 48;
        const layOut = (zoom: number, columns: number, width: number): boolean => {
            this.drawer.style.width = `${width}px`;
            content.style.zoom = String(zoom);
            content.style.columnCount = String(columns);
            return this.drawer.scrollHeight <= this.drawer.clientHeight + 1;
        };
        for (const zoom of TEXT_STEPS) {
            for (let columns = 1; ; columns++) {
                const width = Math.ceil(zoom * (columns * COLUMN_WIDTH + (columns - 1) * COLUMN_GAP + 2 * CONTENT_PADDING));
                if (width > maxWidth) break;
                if (layOut(zoom, columns, width)) return;
            }
        }
        // A very short screen: as wide as allowed with the smallest text, and it scrolls after all
        const zoom = TEXT_STEPS[TEXT_STEPS.length - 1] ?? 1;
        const columns = Math.max(1, Math.floor((maxWidth / zoom - 2 * CONTENT_PADDING + COLUMN_GAP) / (COLUMN_WIDTH + COLUMN_GAP)));
        layOut(zoom, columns, maxWidth);
    }

    public toggle(): void {
        if (this.isOpen) this.close();
        else this.open();
    }

    public open(): void {
        this.returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.isOpen = true;
        this.drawer.inert = false;
        this.drawer.setAttribute('aria-hidden', 'false');
        this.hamburgerBtn.classList.add('active');
        this.drawer.classList.add('active');
        this.overlay.classList.add('active');
        this.showName();
        this.fitToScreen();
        document.body.style.overflow = 'hidden';
        this.drawer.querySelector<HTMLButtonElement>('.drawer-close')?.focus();
    }

    public close(): void {
        this.isOpen = false;
        this.hamburgerBtn.classList.remove('active');
        this.drawer.classList.remove('active');
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
        const canvas = document.querySelector<HTMLCanvasElement>('body.online-mode .game-canvas');
        if (canvas) { canvas.tabIndex = 0; canvas.focus({ preventScroll: true }); }
        else this.returnFocus?.focus();
        this.drawer.inert = true;
        this.drawer.setAttribute('aria-hidden', 'true');
    }

    public destroy(): void {
        window.removeEventListener('ascend:weapon-record', this.weaponRecord);
        window.removeEventListener('ascend:activity', this.activity);
        this.hamburgerBtn.remove();
        this.drawer.remove();
        this.overlay.remove();
        document.getElementById('drawer-styles')?.remove();
    }

    public updateContent(content: string): void {
        const contentDiv = this.drawer.querySelector('.drawer-content');
        if (contentDiv) {
            contentDiv.innerHTML = content;
        }
    }

    public isDrawerOpen(): boolean {
        return this.isOpen;
    }
}
