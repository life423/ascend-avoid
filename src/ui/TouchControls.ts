/**
 * On-screen touch controls for mobile devices using DOM elements instead of canvas
 * Converted to TypeScript and organized in ui/ directory.
 */
import Game from '../core/Game'
import Player from '../entities/Player'

// Interface for control button definition
interface ControlButton {
    key: string
    symbol: string
    label?: string
    action?: string
}

// Interface for button element references
interface ButtonElements {
    up: HTMLElement
    down: HTMLElement
    left: HTMLElement
    right: HTMLElement
    restart: HTMLElement
    boost?: HTMLElement
    missile?: HTMLElement
    shield?: HTMLElement
    [key: string]: HTMLElement | undefined
}

export default class TouchControls {
    private game: Game
    private player: Player

    // Control button properties with symbols
    private buttons: Record<string, ControlButton>

    // Active button state - maps button keys to touch IDs
    private activeButtons: Record<string, number> // DOM elements
    private container: HTMLElement | null = null
    private directionControls!: HTMLElement
    buttonElements!: ButtonElements

    // Device detection
    private isTouchDevice: boolean

    /**
     * Creates a new TouchControls instance
     * @param game - The main game instance
     */
    constructor(game: Game) {
        this.game = game
        this.player = game.player

        // Control button properties with symbols
        this.buttons = {
            up: { key: 'up', symbol: '▲' },
            down: { key: 'down', symbol: '▼' },
            left: { key: 'left', symbol: '◀' },
            right: { key: 'right', symbol: '▶' },
            restart: { key: 'restart', symbol: '⟳' },
            boost: {
                key: 'boost',
                symbol: '⚡',
                label: 'BOOST',
                action: 'boost',
            },
            missile: {
                key: 'missile',
                symbol: '🚀',
                label: 'FIRE',
                action: 'missile',
            },
            shield: {
                key: 'shield',
                symbol: '🛡️',
                label: 'SHIELD',
                action: 'shield',
            },
        }

        // Active button state
        this.activeButtons = {}

        // Check if we're on a touch device (improved detection focusing on input method not screen size)
        this.isTouchDevice =
            'ontouchstart' in window ||
            navigator.maxTouchPoints > 0 ||
            window.matchMedia('(pointer: coarse)').matches

        // Always create controls, but hide them on non-touch devices
        this.createControlElements()
        this.setupTouchListeners()


        // Hide controls on desktop/mouse-based devices or when desktop layout is forced
        if (
            !this.isTouchDevice ||
            document.body.classList.contains('desktop-layout')
        ) {
            this.hide()
        }

        // Handle window resize to show/hide controls dynamically
        window.addEventListener('resize', this.handleResize.bind(this))
    }

    /**
     * Handle window resize and adjust controls for the screen size
     */
    handleResize(): void {
        // Always show touch controls on small screens regardless of touch support
        // This ensures they're available on all mobile devices
        const isSmallScreen = window.innerWidth < 1200 // 1200px matches CSS breakpoint

        // Also check for desktop layout class or large-screen class
        const isLargeDisplay =
            document.body.classList.contains('desktop-layout') ||
            document.body.classList.contains('large-screen')

        // Show controls if it's a small screen AND NOT on a large display
        if (isSmallScreen && !isLargeDisplay) {
            console.log('Showing touch controls on small screen')
            this.show()
        } else {
            console.log('Hiding touch controls on large screen')
            this.hide()
        }
    }

    /**
     * Create DOM elements for touch controls in GameBoy style layout
     * D-pad on left, two action buttons on right
     */
    private createControlElements(): void {
        // Get the touch controls area from the HTML structure
        const touchControlsArea = document.querySelector('.touch-controls-area')
        
        if (touchControlsArea) {
            // Create the container within the touch-controls-area
            this.container = document.createElement('div')
            this.container.className = 'touch-controller'
            this.container.setAttribute('data-controller', 'main')
            
            touchControlsArea.appendChild(this.container)
        } else {
            console.warn('Touch controls area not found in HTML structure')
            // Fallback to body if touch-controls-area doesn't exist
            this.container = document.createElement('div')
            this.container.className = 'touch-controller'
            
            document.body.appendChild(this.container)
        }

        // Create left side controls (D-pad)
        const leftControls = document.createElement('div')
        leftControls.className = 'left-controls'

        // Create d-pad container with grid layout (GameBoy style)
        this.directionControls = document.createElement('div')
        this.directionControls.className = 'dpad-controls'
        this.directionControls.style.gridTemplateAreas =
            '". up ." "left . right" ". down ."'

        // Create directional buttons
        for (const direction of ['up', 'down', 'left', 'right']) {
            const button = document.createElement('div')
            button.className = 'control-button dpad-button'
            button.dataset.key = direction
            button.dataset.direction = direction
            button.textContent = this.buttons[direction].symbol


            // Position in grid based on direction

            this.directionControls.appendChild(button)
        }

        leftControls.appendChild(this.directionControls)

        // Create right side controls (action buttons in GameBoy layout)
        const rightControls = document.createElement('div')
        rightControls.className = 'right-controls'

        // Create action buttons container - horizontal layout for GameBoy style
        const actionButtons = document.createElement('div')
        actionButtons.className = 'action-buttons'

        // Create two action buttons: boost and missile (GameBoy A and B style)
        for (const action of ['boost', 'missile']) {
            const button = document.createElement('div')
            button.className = 'control-button action-button'
            button.dataset.action = action

            // Only use the letter label (A or B), no icon
            button.textContent = action === 'boost' ? 'B' : 'A' // GameBoy style labels
            

            actionButtons.appendChild(button)
        }

        // Add action buttons to right controls
        rightControls.appendChild(actionButtons)

        // Assemble the layout
        this.container.appendChild(leftControls)
        this.container.appendChild(rightControls)

        // Store references to all buttons for easy access
        this.buttonElements = {
            up: this.directionControls.querySelector(
                '[data-direction="up"]'
            ) as HTMLElement,
            down: this.directionControls.querySelector(
                '[data-direction="down"]'
            ) as HTMLElement,
            left: this.directionControls.querySelector(
                '[data-direction="left"]'
            ) as HTMLElement,
            right: this.directionControls.querySelector(
                '[data-direction="right"]'
            ) as HTMLElement,
            boost: actionButtons.querySelector(
                '[data-action="boost"]'
            ) as HTMLElement,
            missile: actionButtons.querySelector(
                '[data-action="missile"]'
            ) as HTMLElement,
            restart: null as unknown as HTMLElement, // No restart button but keep the property
            shield: null as unknown as HTMLElement,
        }
    }

    /**
     * Set up touch event listeners for all control buttons
     */
    private setupTouchListeners(): void {
        // For each button, add event listeners - check that button exists first
        Object.keys(this.buttonElements).forEach(key => {
            const button = this.buttonElements[key]

            // Skip if button doesn't exist (like removed shield button)
            if (!button) {
                console.log(
                    `Skipping event listeners for missing button: ${key}`
                )
                return
            }

            // Touch start - activate button
            button.addEventListener(
                'touchstart',
                (e: TouchEvent) => {
                    e.preventDefault()
                    this.handleButtonActivation(
                        key,
                        true,
                        e.changedTouches[0].identifier
                    )
                },
                { passive: false }
            )

            // Touch end - deactivate button
            button.addEventListener(
                'touchend',
                (e: TouchEvent) => {
                    e.preventDefault()
                    this.handleButtonActivation(
                        key,
                        false,
                        e.changedTouches[0].identifier
                    )
                },
                { passive: false }
            )

            // Touch cancel - deactivate button
            button.addEventListener(
                'touchcancel',
                (e: TouchEvent) => {
                    e.preventDefault()
                    this.handleButtonActivation(
                        key,
                        false,
                        e.changedTouches[0].identifier
                    )
                },
                { passive: false }
            )

            // Touch move - deactivate button if touch moves out (replaces non-standard touchleave)
            button.addEventListener(
                'touchmove',
                (e: TouchEvent) => {
                    e.preventDefault()
                    // Check if touch has moved outside of button
                    const touch = e.changedTouches[0]
                    const buttonRect = button.getBoundingClientRect()
                    if (
                        touch.clientX < buttonRect.left ||
                        touch.clientX > buttonRect.right ||
                        touch.clientY < buttonRect.top ||
                        touch.clientY > buttonRect.bottom
                    ) {
                        this.handleButtonActivation(
                            key,
                            false,
                            touch.identifier
                        )
                    }
                },
                { passive: false }
            )
        })
    }

    /**
     * Handle button activation state
     * @param key - The button key (up, down, left, right, restart, boost, missile)
     * @param isActive - Whether to activate or deactivate the button
     * @param touchId - Touch identifier to keep track of which touch is on which button
     */
    private handleButtonActivation(
        key: string,
        isActive: boolean,
        touchId: number
    ): void {
        const button = this.buttonElements[key]

        // Skip if button doesn't exist
        if (!button) {
            console.log(`Cannot activate non-existent button: ${key}`)
            return
        }

        if (isActive) {
            // Activate button
            button.classList.add('active')
            this.activeButtons[key] = touchId

            // Trigger action based on button
            if (key === 'restart') {
                this.game.resetGame()
            } else if (key === 'boost' || key === 'missile') {
                // GameBoy style buttons - only boost and missile
                console.log(`Action button pressed: ${key}`)
            } else {
                this.player.setMovementKey(key, true)
            }
        } else {
            // If this touch ID matches the one that activated this button
            if (this.activeButtons[key] === touchId) {
                // Deactivate button
                button.classList.remove('active')
                delete this.activeButtons[key]

                // Stop movement for movement keys
                if (key !== 'restart' && key !== 'boost' && key !== 'missile') {
                    this.player.setMovementKey(key, false)
                }
            }
        }
    }

    /**
     * Hide the touch controls - called when touch is not supported or not needed
     */
    hide(): void {
        if (this.container) {
            // First set display to none
            this.container.style.cssText = 'display: none !important'

            // For larger screens, completely remove from DOM instead of just hiding
            if (window.innerWidth >= 1200) {
                // Use setTimeout to avoid any potential race conditions
                setTimeout(() => {
                    if (this.container && this.container.parentNode) {
                        this.container.parentNode.removeChild(this.container)
                        console.log(
                            'Touch controls removed from DOM for larger screen'
                        )
                    }
                }, 100)
            }
        }
        
        // Also hide the touch-controls-area container on desktop
        const touchControlsArea = document.querySelector('.touch-controls-area')
        if (touchControlsArea && window.innerWidth >= 1200) {
            (touchControlsArea as HTMLElement).style.display = 'none'
        }
    }
    /**
     * Show the touch controls
     */
    show(): void {
        if (this.container) {
            // If container is in the DOM, just show it
            this.container.style.display = 'flex'
        } else {
            // If container was removed from DOM, recreate it
            console.log(
                'Touch controls container was removed, recreating for small screen'
            )
            this.createControlElements()
            this.setupTouchListeners()

            if (this.container) {
                (this.container as HTMLElement).style.display = 'flex';
            }
        }
        
        // Also show the touch-controls-area container
        const touchControlsArea = document.querySelector('.touch-controls-area')
        if (touchControlsArea) {
            (touchControlsArea as HTMLElement).style.display = 'flex'
        }
    }

    /**
     * Draw the touch controls - empty method to match Game's expectations
     * Since we're using DOM elements, no actual canvas drawing is needed
     */
    draw(): void {
        // No canvas drawing needed - controls are DOM elements
        // This method exists to match the Game class expectations
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        // Remove window resize listener
        window.removeEventListener('resize', this.handleResize.bind(this))

        // Clean up button event listeners
        if (this.buttonElements) {
            Object.keys(this.buttonElements).forEach(key => {
                const button = this.buttonElements[key]
                if (button) {
                    button.replaceWith(button.cloneNode(true))
                }
            })
        }


        // Remove container if needed
        if (this.container && this.container.parentNode) {
            // Only remove if we created it programmatically
            if (
                this.container.className.includes('touch-controller') &&
                !document.querySelector(
                    '.touch-controller[data-controller="main"]'
                )
            ) {
                this.container.parentNode.removeChild(this.container)
            }
        }
    }
}