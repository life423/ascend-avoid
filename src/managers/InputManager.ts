/**
 * Handles and normalizes all input for the game, decoupling input handling
 * from game logic. Supports keyboard and touch controls.
 * Now with TypeScript support.
 */
import { InputState } from '../types'

interface Point {
    x: number
    y: number
}

interface KeyMappings {
    UP: string[]
    DOWN: string[]
    LEFT: string[]
    RIGHT: string[]
    RESTART: string[]
    SHOOT: string[] // Added shooting support
    [key: string]: string[]
}

interface InputManagerOptions {
    keyMappings: KeyMappings
}

export default class InputManager {
    private keyMappings: KeyMappings
    private keys: InputState & { restart: boolean; shoot: boolean } // Added shoot
    private touchStart: Point
    /** Swipes on the canvas move you in solo; the online mode turns this off for its joystick */
    swipesEnabled = true
    // private _isTouchDevice: boolean = false // Removed unused property

    /**
     * Creates a new InputManager
     * @param options - Configuration options
     */
    constructor({ keyMappings }: InputManagerOptions) {
        // Store key mappings
        this.keyMappings = keyMappings

        // Internal state for tracking pressed keys
        this.keys = {
            up: false,
            down: false,
            left: false,
            right: false,
            restart: false,
            shoot: false, // Added shoot state
        }

        // Touch state tracking
        this.touchStart = { x: 0, y: 0 }
        // this._isTouchDevice is initialized in property declaration

        // Bind methods to maintain context
        this.handleKeyDown = this.handleKeyDown.bind(this)
        this.handleKeyUp = this.handleKeyUp.bind(this)
        this.handleTouchStart = this.handleTouchStart.bind(this)
        this.handleTouchEnd = this.handleTouchEnd.bind(this)

        // Set up event listeners
        this.setupEventListeners()

        // Detect if device supports touch
        this.detectTouchSupport()
    }

    /**
     * Set up event listeners for keyboard and touch input
     */
    private setupEventListeners(): void {
        // Keyboard events
        document.addEventListener('keydown', this.handleKeyDown)
        document.addEventListener('keyup', this.handleKeyUp)
    }

    /**
     * Set up touch event listeners for a specific canvas
     * @param canvas - The canvas element for touch controls
     */
    setupTouchControls(canvas: HTMLCanvasElement): void {
        if (canvas) {
            canvas.addEventListener('touchstart', this.handleTouchStart)
            canvas.addEventListener('touchend', this.handleTouchEnd)
        }
    }

    /**
     * Remove all event listeners - important for cleanup
     */
    private removeEventListeners(): void {
        // Remove keyboard events
        document.removeEventListener('keydown', this.handleKeyDown)
        document.removeEventListener('keyup', this.handleKeyUp)

        // Can't remove touch events here since we don't store canvas reference
        // This should be handled in dispose() with a stored canvas reference
    }

    /**
     * Detect if the device supports touch
     */
    private detectTouchSupport(): void {
        // Touch device detection removed as it was unused
        // this._isTouchDevice = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window || navigator.maxTouchPoints > 0
    }

    /**
     * Handle keydown events
     * @param e - The keyboard event
     */
    private handleKeyDown(e: KeyboardEvent): void {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
        // Look for movement keys
        if (this.keyMappings.UP.includes(e.key) || e.keyCode === 38) {
            this.keys.up = true
        }

        if (this.keyMappings.DOWN.includes(e.key) || e.keyCode === 40) {
            this.keys.down = true
        }

        if (this.keyMappings.LEFT.includes(e.key) || e.keyCode === 37) {
            this.keys.left = true
        }

        if (this.keyMappings.RIGHT.includes(e.key) || e.keyCode === 39) {
            this.keys.right = true
        }

        // Check for restart key
        if (this.keyMappings.RESTART.includes(e.key)) {
            this.keys.restart = true

            // Fire a custom event for restart to avoid checking each frame
            document.dispatchEvent(new CustomEvent('game:restart'))
        }

        // Check for shoot key
        if (this.keyMappings.SHOOT.includes(e.key) || e.keyCode === 32) { // 32 is spacebar
            this.keys.shoot = true
        }

        // Debug logging if needed
        if ((window as any).DEBUG) {
            console.log('Key down:', e.key, e.keyCode)
        }
    }

    /**
     * Handle keyup events
     * @param e - The keyboard event
     */
    private handleKeyUp(e: KeyboardEvent): void {
        const target = e.target as HTMLElement | null
        if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
        // Release movement keys
        if (this.keyMappings.UP.includes(e.key) || e.keyCode === 38) {
            this.keys.up = false
        }

        if (this.keyMappings.DOWN.includes(e.key) || e.keyCode === 40) {
            this.keys.down = false
        }

        if (this.keyMappings.LEFT.includes(e.key) || e.keyCode === 37) {
            this.keys.left = false
        }

        if (this.keyMappings.RIGHT.includes(e.key) || e.keyCode === 39) {
            this.keys.right = false
        }

        if (this.keyMappings.RESTART.includes(e.key)) {
            this.keys.restart = false
        }

        // Release shoot key
        if (this.keyMappings.SHOOT.includes(e.key) || e.keyCode === 32) { // 32 is spacebar
            this.keys.shoot = false
        }

        // Debug logging if needed
        if ((window as any).DEBUG) {
            console.log('Key up:', e.key, e.keyCode)
        }
    }

    /**
     * Handle touch start events
     * @param e - The touch event
     */
    private handleTouchStart(e: TouchEvent): void {
        if (!this.swipesEnabled) return
        e.preventDefault()
        const touch = e.touches[0]
        this.touchStart.x = touch.clientX
        this.touchStart.y = touch.clientY
    }

    /**
     * Handle touch end events
     * @param e - The touch event
     */
    private handleTouchEnd(e: TouchEvent): void {
        if (!this.swipesEnabled) return
        e.preventDefault()
        const touch = e.changedTouches[0]
        const touchEndX = touch.clientX
        const touchEndY = touch.clientY

        // Calculate deltas
        const deltaX = touchEndX - this.touchStart.x
        const deltaY = touchEndY - this.touchStart.y

        // Determine swipe direction based on the larger delta
        if (Math.abs(deltaX) > Math.abs(deltaY)) {
            // Horizontal swipe
            if (deltaX > 20) {
                this.setTemporaryInput('right')
            } else if (deltaX < -20) {
                this.setTemporaryInput('left')
            }
        } else {
            // Vertical swipe
            if (deltaY > 20) {
                this.setTemporaryInput('down')
            } else if (deltaY < -20) {
                this.setTemporaryInput('up')
            }
        }
    }

    /**
     * Set a temporary input (for swipes)
     * @param direction - The direction ('up', 'down', 'left', 'right')
     * @param duration - How long to apply the input in ms
     */
    private setTemporaryInput(
        direction: keyof InputState,
        duration: number = 100
    ): void {
        // Set the input to true
        this.keys[direction] = true

        // Reset after the specified duration
        setTimeout(() => {
            this.keys[direction] = false
        }, duration)
    }

    /**
     * Get the current input state
     * @returns The current input state
     */
    getInputState(): InputState {
        // Return a copy of the current keys state to prevent external modification
        // Exclude restart from InputState interface
        const { up, down, left, right } = this.keys
        return { up, down, left, right }
    }

    /**
     * Check if the shoot key is currently pressed
     * @returns True if shoot key is pressed
     */
    isShootPressed(): boolean {
        return this.keys.shoot
    }

    /**
     * Register a custom touch button
     * @param element - The button element
     * @param inputName - The input to activate ('up', 'down', etc.)
     */
    registerTouchButton(element: HTMLElement, inputName: string): void {
        if (element && (this.keys as any).hasOwnProperty(inputName)) {
            // Add touch listeners to the button
            element.addEventListener('touchstart', e => {
                e.preventDefault()
                ;(this.keys as any)[inputName] = true
                element.classList.add('active')
            })

            element.addEventListener('touchend', e => {
                e.preventDefault()
                ;(this.keys as any)[inputName] = false
                element.classList.remove('active')
            })

            // Also handle mouse events for testing on desktop
            element.addEventListener('mousedown', () => {
                ;(this.keys as any)[inputName] = true
                element.classList.add('active')
            })

            element.addEventListener('mouseup', () => {
                ;(this.keys as any)[inputName] = false
                element.classList.remove('active')
            })

            // Handle case where mouse exits button while pressed
            element.addEventListener('mouseleave', () => {
                if (element.classList.contains('active')) {
                    ;(this.keys as any)[inputName] = false
                    element.classList.remove('active')
                }
            })
        }
    }

    /**
     * Clean up resources and remove event listeners
     */
    dispose(): void {
        this.removeEventListeners()
    }
}
