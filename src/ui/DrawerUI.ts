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
            </div>
            <div class="drawer-content">
                <div class="menu-section">
                    <h3>How to Play</h3>
                    <div class="instructions">
                        <p>Everyone on the site shares one big arena. Grab <span class="highlight">gems</span> to grow, shove other players around, and stay out of the way of everything that moves.</p>

                        <h4>Moving</h4>
                        <p>Use the <span class="highlight">joystick</span> on the left side of the screen. Put your thumb down anywhere on the left and the joystick appears right under it. Push it the way you want to go, and let go to stop. The faint joystick in the bottom-left corner shows you where to start.</p>
                        <p>On a computer, use the <span class="highlight">arrow keys</span> or <span class="highlight">WASD</span>, or hold the mouse button and your player heads for the cursor.</p>

                        <h4>Gems</h4>
                        <p>Gems are your score. Every one you grab makes you a little bigger and heavier. Big players shove harder and see more of the arena, but they're also bigger targets, so growth is power and risk at once.</p>

                        <h4>Dash, slingshot and shove</h4>
                        <p>Tap the <span class="highlight">right side</span> of the screen (<span class="highlight">space</span> on a computer) to dash: a quick burst that costs a gem. Dash into another player to shove them. The heavier you are, the farther they go.</p>
                        <p>Hold the button instead of tapping to charge a <span class="highlight">slingshot</span>. You stop, a ring fills around you, and the joystick aims (the mouse or arrow keys on a computer, holding space). Let go to launch: the longer you held, the farther you fly and the harder you hit, even the biggest players. You fly over the void, so a good slingshot can jump the gap between islands during a shift. It costs 2 gems and takes a few seconds to recharge. Slide off the button to cancel.</p>
                        <p>The leader wears a crown. Every hit knocks some gems loose (more for a harder hit, and always a few from the leader), and they can't grab them back for a moment.</p>

                        <h4>Getting hit</h4>
                        <p>Traffic, bouncing balls and the edge of the floor all knock you around. Take a hit and you skid, drop half your gems, and blink for a moment while nothing can touch you.</p>
                        <p>Your dropped gems take a second before you can grab them back, but anyone else can grab them right away. With no gems left, a hit knocks you out, and you're back in two seconds.</p>

                        <h4>Arena shifts</h4>
                        <p>Every few minutes the floor changes shape. You'll see the new floor first, and nobody can be hurt while everyone gets onto it. Then the rest falls away into the void.</p>
                        <p>While the arena is small, gems rain down. Near the end a jackpot crystal drops: stand on it alone to claim 20 gems. If anyone else is touching it, nobody's claim moves.</p>

                        <h4>Bots</h4>
                        <p>Players with a robot next to their name are bots. They fill in when the arena is quiet and leave as people arrive.</p>

                        <h4>Tips</h4>
                        <ul>
                            <li>Waiting in a gap for traffic to pass is often smarter than running.</li>
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