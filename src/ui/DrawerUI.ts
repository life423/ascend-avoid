import { playerName, setPlayerName } from '../core/PlayerName';
export class DrawerUI {
    private container: HTMLElement;
    private hamburgerBtn!: HTMLButtonElement;
    private drawer!: HTMLDivElement;
    private overlay!: HTMLDivElement;
    private isOpen: boolean = false;

    constructor() {
        this.container = document.body;
        this.createElements();
        this.attachEventListeners();
        this.injectStyles();
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
        this.drawer.innerHTML = `
            <div class="drawer-header">
                <h2>Game Menu</h2>
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
                        <p>Everyone on the site shares one big arena. Grab <span class="highlight">gems</span> to grow, shove other players around, and steal their gems.</p>

                        <h4>Moving</h4>
                        <p>Use the <span class="highlight">joystick</span> on the left side of the screen. Put your thumb down anywhere on the left and the joystick appears right under it. Push it the way you want to go, and let go to stop. The faint joystick in the bottom-left corner shows you where to start.</p>
                        <p>On a computer, use the <span class="highlight">arrow keys</span> or <span class="highlight">WASD</span>, or hold the mouse button and your player heads for the cursor.</p>

                        <h4>Gems</h4>
                        <p>Gems are your score. Every one you grab makes you a little bigger and heavier. Big players shove harder and see more of the arena, but they're also bigger targets, so growth is power and risk at once. Bigger creatures can swallow smaller ones, but anyone can steal gems from anyone by inhaling up close from where their mouth isn't pointing. There's no size limit, but big creatures slowly shed gems, faster the bigger they get, so becoming a giant takes real effort.</p>

                        <h4>Shoving</h4>
                        <p>Run into another player to <span class="highlight">bump</span> them: you both bounce apart, and the heavier you are, the farther they go. Bumps don't cost gems, but bumping someone off an island during an arena shift costs them plenty. The leader wears a crown.</p>

                        <h4>Inhale</h4>
                        <p>Hold the button to <span class="highlight">inhale</span> and pull in everything in front of your mouth, for up to 3 seconds before you need a breath (the ring around you shows how much is left, then refills). Gems are swallowed, and so are creatures clearly smaller than you, along with all their gems.</p>
                        <p>Get right up close to anyone too big to swallow and inhale to <span class="highlight">steal</span> their gems: they stream straight into your mouth. To escape a thief, run (anyone smaller than the thief is faster) or turn and inhale back. Bigger creatures pull harder, so head-on, the stronger pull wins the tug-of-war. Small creatures turn faster, so steal from the side, where their mouth isn't pointing, and get away before they turn around.</p>

                        <h4>Getting hit</h4>
                        <p>Bumps just knock you around, but anyone inhaling right up against you can steal your gems, and being swallowed costs you everything. Falling off the edge of the floor during an arena shift is a real hit: you skid, drop half your gems, and blink for a moment while nothing can touch you.</p>
                        <p>Your dropped gems take a second before you can grab them back, but anyone else can grab them right away. With fewer than 3 gems, a hit knocks you out (a dashed red outline warns you), and you're back in two seconds.</p>

                        <h4>Turbines</h4>
                        <p>Turbines pop up around the arena for a minute or so, then move on. The <span class="highlight">intake</span> sucks in loose gems, and rips gems right out of anyone who gets too close (giants lose them fastest). Every one shoots out of the sweeping <span class="highlight">exhaust</span> and lands across the arena for anyone to grab. The exhaust's wind blows small creatures around. Bump someone into an intake and watch their gems fly.</p>
                        <h4>Arena shifts</h4>
                        <p>Every few minutes the floor changes shape. You'll see the new floor first, and nobody can be hurt while everyone gets onto it. Then the rest falls away into the void.</p>
                        <p>While the arena is small, gems rain down. Near the end a jackpot crystal drops: stand on it alone to claim 20 gems. If anyone else is touching it, nobody's claim moves.</p>

                        <h4>Bots</h4>
                        <p>Players with a robot next to their name are bots. They fill in when the arena is quiet and leave as people arrive.</p>

                        <h4>Tips</h4>
                        <ul>
                            <li>Watch the eyes: an inhaling creature is aiming its mouth. Stay out of the way of anything bigger than you.</li>
                            <li>When someone drops their gems, move fast, because they can't grab them back right away.</li>
                            <li>Shoving someone off the edge during a shift is the biggest swing in the game.</li>
                        </ul>

                        <h4>Solo</h4>
                        <p>Solo is the classic game: reach the top without getting hit, and press <span class="highlight">R</span> to restart.</p>
                    </div>
                </div>
            </div>
        `;

        // Append to DOM
        this.container.appendChild(this.hamburgerBtn);
        this.container.appendChild(this.overlay);
        this.container.appendChild(this.drawer);
    }

    private attachEventListeners(): void {
        // Toggle drawer on hamburger click
        this.hamburgerBtn.addEventListener('click', () => this.toggle());
        
        // Close drawer on overlay click
        this.overlay.addEventListener('click', () => this.close());

        // Close drawer on ESC key
        document.addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Prevent drawer from closing when clicking inside it
        this.drawer.addEventListener('click', (e: Event) => {
            e.stopPropagation();
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
                transition: transform 0.3s ease;
                z-index: 1000;
                overflow-y: auto;
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
            }

            .drawer.active {
                transform: translateX(0);
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

    public toggle(): void {
        this.isOpen ? this.close() : this.open();
    }

    public open(): void {
        this.isOpen = true;
        this.hamburgerBtn.classList.add('active');
        this.drawer.classList.add('active');
        this.overlay.classList.add('active');
        this.showName();
        document.body.style.overflow = 'hidden';
    }

    public close(): void {
        this.isOpen = false;
        this.hamburgerBtn.classList.remove('active');
        this.drawer.classList.remove('active');
        this.overlay.classList.remove('active');
        document.body.style.overflow = '';
    }

    public destroy(): void {
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