/**
 * Main game controller class that orchestrates all game systems.
 * Refactored to support responsive design across all devices and screen sizes.
 * Now with TypeScript support.
 */
import { GameObject, InputState, PerformanceStats, ScalingInfo } from '../types'

// Import player and background entities
import Background from '../entities/Background'
import Player from '../entities/Player'
import ResponsiveManager from '../managers/ResponsiveManager'
import TouchControls from '../ui/TouchControls'

// Fallback constants in case imports fail
// const BASE_CANVAS_WIDTH = 560 // Unused
const BASE_CANVAS_HEIGHT = 550

// Define interfaces for specific components
interface KeyMappings {
    UP: string[]
    DOWN: string[]
    LEFT: string[]
    RIGHT: string[]
    RESTART: string[]
    SHOOT: string[] // Added shooting support
    [key: string]: string[]
}

// Extended GameConfig interface to ensure type safety
interface GameConfigInterface {
    STATE: {
        READY: string
        WAITING: string
        STARTING: string
        PLAYING: string
        PAUSED: string
        GAME_OVER: string
    }
    getKeys(): KeyMappings
    getWinningLine(canvasHeight: number, baseHeight: number): number
    isDebugEnabled(): boolean
    setDesktopMode(isDesktop: boolean): void
    getObstacleMinWidthRatio(): number
    getObstacleMaxWidthRatio(): number
    getMaxCars(): number
}

// Import our manager classes
import ParticleSystem from '../entities/ParticleSystem'
import AssetManager from '../managers/AssetManager'
import InputManager from '../managers/InputManager'
import ObstacleManager from '../managers/ObstacleManager'
import UIManager from '../managers/UIManager'
import GameConfig from './GameConfig'

// Import game modes from consolidated file
import { GameMode, MultiplayerMode, SinglePlayerMode } from './GameModes'

// Removed unused interfaces

export default class Game {
    // Canvas and rendering context
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    responsiveManager!: ResponsiveManager

    // UI elements
    scoreElement: HTMLElement | null
    highScoreElement: HTMLElement | null

    // Game state
    score: number
    highScore: number
    gameState: string
    lastFrameTime: number
    isDesktop: boolean
    isMultiplayerMode: boolean

    // Core components
    config: GameConfig & GameConfigInterface
    player: Player
    background: Background
    touchControls: TouchControls
    currentGameMode: GameMode | null

    // Manager components
    inputManager: InputManager | null
    obstacleManager: ObstacleManager | null
    uiManager: UIManager | null
    assetManager: AssetManager | null
    particleSystem: ParticleSystem | null

    // Multiplayer state
    remotePlayers: Record<string, any>

    // Responsive scaling info
    scalingInfo: ScalingInfo

    // Performance monitoring
    frameTimes: number[]
    frameTimeIndex: number
    frameTimeWindow: number
    performanceStats: PerformanceStats
    particles?: any[] // Legacy fallback

    /**
     * Creates a new Game instance
     */
    constructor() {
        console.log('Game constructor called')

        // Get DOM elements - handle both canvas selectors for compatibility
        this.canvas =
            (document.querySelector(
                '.game-canvas'
            ) as HTMLCanvasElement) ||
            (document.getElementById('gameCanvas') as HTMLCanvasElement) ||
            document.createElement('canvas')
        console.log('Canvas element:', this.canvas)

        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d')!
            console.log('Canvas context:', this.ctx)

            // Check canvas dimensions
            console.log(
                'Canvas dimensions:',
                this.canvas.width,
                this.canvas.height
            )
            if (this.canvas.width === 0 || this.canvas.height === 0) {
                console.warn(
                    'Canvas has zero dimensions - may need explicit sizing'
                )
                // Don't set size here yet - let ResponsiveManager handle it
            }
        } else {
            console.error('Canvas element not found in DOM!')
            // Create a dummy canvas to prevent errors
            this.canvas = document.createElement('canvas')
            this.ctx = this.canvas.getContext('2d')!
        }

        this.scoreElement = document.querySelector(
            '.score-value.current-score'
        )
        this.highScoreElement = document.querySelector(
            '.score-value.high-score'
        )

        // Game state
        this.score = 0
        this.highScore = 0
        this.lastFrameTime = 0
        this.currentGameMode = null

        // Performance monitoring
        this.frameTimes = []
        this.frameTimeIndex = 0
        this.frameTimeWindow = 60 // Store last 60 frames for analysis
        this.performanceStats = {
            avgFrameTime: 0,
            maxFrameTime: 0,
            minFrameTime: Infinity,
            frameCount: 0,
        }

        // Device detection now handled by ResponsiveManager
        // Default to desktop for initial rendering before ResponsiveManager initializes
        this.isDesktop = window.matchMedia('(min-width: 1200px)').matches

        // Create configuration with platform detection
        this.config = new GameConfig({
            isDesktop: this.isDesktop,
        }) as GameConfig & GameConfigInterface

        // Set initial game state
        this.gameState = this.config.STATE.READY

        // Initialize managers
        this.inputManager = null
        this.obstacleManager = null
        this.uiManager = null
        this.assetManager = null

        // Multiplayer state
        this.isMultiplayerMode = false
        this.remotePlayers = {}

        // Game scaling information
        this.scalingInfo = {
            widthScale: 1,
            heightScale: 1,
            pixelRatio: 1,
            reducedResolution: false,
        }

        // These will be initialized in init()
        this.player = null!
        this.background = null!
        this.touchControls = null!
        this.particleSystem = null

        // Initialize game
        this.init()
    }

    /**
     * Initialize the game and all its components
     */
    async init(): Promise<void> {
        console.log('Initializing game...')

        // Create UI manager
        this.uiManager = new UIManager({
            scoreElement: this.scoreElement || document.createElement('div'),
            highScoreElement:
                this.highScoreElement || document.createElement('div'),
            config: this.config,
        })

        // Show loading screen while we set up
        this.uiManager.showLoading('Loading game assets...')

        // Initialize asset manager and preload assets
        this.assetManager = new AssetManager()
        await this.preloadAssets()

        // Initialize the responsive manager
        this.responsiveManager = new ResponsiveManager(this)
        this.responsiveManager.init(this.canvas)

        // Get the scaling info from the responsive manager
        this.scalingInfo = this.responsiveManager.getScalingInfo()

        // Set callback for resize events
        this.responsiveManager.onResize = this.onResize.bind(this)

        // Create background
        this.background = new Background(this.canvas)

        // Create player
        this.player = new Player(this.canvas)

        // Initialize particle system
        this.particleSystem = new ParticleSystem({
            canvas: this.canvas,
            poolSize: 200,
            maxParticles: 500,
        })

        // Initialize obstacle manager
        this.obstacleManager = new ObstacleManager({
            canvas: this.canvas,
            config: this.config,
        })
        this.obstacleManager.initialize()

        // Initialize input manager
        this.inputManager = new InputManager({
            keyMappings: this.config.getKeys() as KeyMappings,
        })

        // Listen for restart events from input manager
        document.addEventListener(
            'game:restart',
            this.handleRestartEvent.bind(this)
        )

        // Set up touch controls if needed
        this.setupTouchControls()

        // Everyone who opens the site joins the shared multiplayer game
        // (initializeGameMode falls back to single player if multiplayer can't load)
        await this.initializeGameMode('multiplayer')

        // Hide loading screen
        this.uiManager.hideLoading()

        // Set game state to playing
        this.gameState = this.config.STATE.PLAYING

        // Start game loop
        requestAnimationFrame(this.gameLoop.bind(this))

        console.log('Game initialized successfully')
    }

    /**
     * Initialize the specified game mode
     * @param mode - The mode to initialize ('singlePlayer' or 'multiplayer')
     * @returns A promise that resolves when the mode is initialized
     */
    async initializeGameMode(
        mode: 'singlePlayer' | 'multiplayer'
    ): Promise<void> {
        // Clean up any existing game mode
        if (this.currentGameMode) {
            this.currentGameMode.dispose()
            this.currentGameMode = null
        }

        try {
            // Create the appropriate game mode directly
            switch (mode) {
                case 'multiplayer':
                    this.currentGameMode = new MultiplayerMode(this)
                    break

                case 'singlePlayer':
                default:
                    this.currentGameMode = new SinglePlayerMode(this)
                    break
            }

            // Initialize the game mode
            await this.currentGameMode.initialize()
            // The online world fills the page; solo keeps its shape
            this.responsiveManager?.handleResize()

            console.log(`Game mode initialized: ${mode}`)
            return Promise.resolve()
        } catch (error) {
            console.error(`Failed to initialize game mode ${mode}:`, error)
            // Fallback to single player mode if multiplayer fails
            if (mode === 'multiplayer') {
                console.log('Falling back to single player mode')
                return this.initializeGameMode('singlePlayer')
            }
            return Promise.reject(error)
        }
    }

    /**
     * Switch to the specified game mode
     * @param mode - The mode to switch to ('singlePlayer' or 'multiplayer')
     * @returns A promise that resolves when the mode switch is complete
     */
    async switchGameMode(mode: 'singlePlayer' | 'multiplayer'): Promise<void> {
        // Show loading indicator during mode switch
        if (this.uiManager) {
            this.uiManager.showLoading(
                `Switching to ${
                    mode === 'multiplayer' ? 'multiplayer' : 'single player'
                } mode...`
            )
        }

        try {
            // Initialize the new game mode
            await this.initializeGameMode(mode)

            // Reset game state
            this.resetGame()

            // Hide loading indicator
            if (this.uiManager) {
                this.uiManager.hideLoading()
            }

            return Promise.resolve()
        } catch (error: any) {
            console.error(`Failed to switch to game mode ${mode}:`, error)

            // Hide loading and show error
            if (this.uiManager) {
                this.uiManager.hideLoading()
                this.uiManager.showError(
                    `Failed to switch game mode: ${error.message}`
                )
            }

            return Promise.reject(error)
        }
    }

    /**
     * Callback for when canvas or window size changes
     * Called when the window is resized or orientation changes
     */
    onResize(
        _widthScale?: number,
        _heightScale?: number,
        _isDesktop?: boolean
    ): void {
        // Get updated scaling info from responsive manager
        this.scalingInfo = this.responsiveManager.getScalingInfo()

        // Update device detection
        this.isDesktop = window.innerWidth >= 1024

        // Update game config with new device info
        this.config.setDesktopMode(this.isDesktop)

        // Update game elements with new dimensions
        if (this.player) {
            this.player.resetPosition()
        }

        if (this.background) {
            this.background.resize()
        }

        if (this.obstacleManager) {
            // Update obstacles
            const obstacles = this.obstacleManager.getObstacles()
            for (const obstacle of obstacles) {
                obstacle.calculateHeight()
            }
        }

        console.log(
            `Game resized: isDesktop=${
                this.isDesktop
            }, scale=${this.scalingInfo.widthScale.toFixed(2)}`
        )
    }

    /**
     * Set up touch controls for mobile screens
     * Always creates touch controls for small screens
     */
    setupTouchControls(): void {
        // Always create touch controls - they will be shown/hidden based on screen size
        this.touchControls = new TouchControls(this)

        // Check screen size to determine if controls should be shown
        const isSmallScreen = window.innerWidth < 768
        const isLargeDisplay =
            document.body.classList.contains('desktop-layout') ||
            document.body.classList.contains('large-screen')

        // Only show on small screens not in desktop mode
        if (isSmallScreen && !isLargeDisplay) {
            console.log('Small screen detected, showing touch controls')
            this.touchControls.show()
        } else {
            console.log(
                'Large screen or desktop layout detected, hiding touch controls'
            )
        }

        // Register touch buttons with input manager
        if (this.inputManager && this.touchControls.buttonElements) {
            for (const [direction, button] of Object.entries(
                this.touchControls.buttonElements
            )) {
                // Skip null buttons (like shield which we removed)
                if (button) {
                    this.inputManager.registerTouchButton(
                        button as HTMLElement,
                        direction
                    )
                }
            }
        }

        // Set up canvas touch events
        if (this.inputManager) {
            this.inputManager.setupTouchControls(this.canvas)
        }
    }

    /**
     * Preload all game assets
     */
    async preloadAssets(): Promise<boolean> {
        // Note: We don't need to preload image assets since sprites are
        // created dynamically by the SpriteManager using Canvas

        // Return immediately as there are no assets to load
        console.log('No external assets to preload - using generated sprites')
        return true
    }

    /**
     * Handle restart event from input manager
     * Can be triggered by keyboard or touch controls
     */
    handleRestartEvent(): void {
        // Only handle restart events in specific states
        if (this.gameState === this.config.STATE.GAME_OVER) {
            // Complete reset from game over state
            this.completeReset()
        } else if (this.gameState === this.config.STATE.PLAYING) {
            // In playing state, just reset positions but continue playing
            this.resetGame()
        }

        // Trigger any UI updates needed
        if (this.uiManager) {
            this.uiManager.hideGameOver() // Hide game over UI if visible
        }
    }

    /**
     * Main game loop
     * @param timestamp - Current animation timestamp
     */
    gameLoop(timestamp: number): void {
        // Performance measurement - start time
        const frameStartTime = performance.now()

        // Request next frame first to ensure smooth animation
        requestAnimationFrame(this.gameLoop.bind(this))

        // Calculate delta time (in seconds) with capping to prevent physics issues
        // when tab becomes active again after being inactive
        let deltaTime = 0
        if (this.lastFrameTime !== 0) {
            deltaTime = (timestamp - this.lastFrameTime) / 1000

            // Cap deltaTime to prevent large jumps
            // This prevents objects from "teleporting" if the game is inactive
            deltaTime = Math.min(deltaTime, 0.1)
        }

        this.lastFrameTime = timestamp

        try {
            // Skip updates if game is paused or in game over state
            if (this.gameState !== this.config.STATE.PLAYING) {
                // Just render the current state without updating
                this.render(timestamp)
                // Performance tracking - measure render-only time
                this.trackFrameTime(performance.now() - frameStartTime)
                return
            }

            // Get current input state
            const inputState = this.inputManager
                ? this.inputManager.getInputState()
                : { up: false, down: false, left: false, right: false }

            // 1. Update phase - delegate to current game mode
            if (this.currentGameMode) {
                this.currentGameMode.update(inputState, deltaTime, timestamp)
            }

            // 2. Update common systems (particles, etc)
            this.updateCommonSystems(deltaTime, timestamp)

            // 3. Render phase
            this.render(timestamp)

            // 4. Post-update phase (check win/lose conditions)
            if (this.currentGameMode) {
                this.currentGameMode.postUpdate()
            } else {
                // Fallback to the game's postUpdate if no game mode is active
                this.postUpdate()
            }

            // Performance tracking - measure full frame time
            this.trackFrameTime(performance.now() - frameStartTime)
        } catch (error) {
            console.error('Error in game loop:', error)
        }
    }

    /**
     * Track frame time for performance monitoring
     * @param frameTime - Time taken to process this frame in ms
     */
    trackFrameTime(frameTime: number): void {
        // Store frame time in circular buffer
        this.frameTimes[this.frameTimeIndex] = frameTime
        this.frameTimeIndex = (this.frameTimeIndex + 1) % this.frameTimeWindow

        // Update performance stats every 60 frames
        this.performanceStats.frameCount++
        if (this.performanceStats.frameCount % 60 === 0) {
            // Calculate stats from the frame time buffer
            let sum = 0
            let max = 0
            let min = Infinity

            for (let i = 0; i < this.frameTimes.length; i++) {
                const time = this.frameTimes[i] || 0
                sum += time
                max = Math.max(max, time)
                if (time > 0) {
                    // Only consider valid times for minimum
                    min = Math.min(min, time)
                }
            }

            // Update stats
            const validTimes = this.frameTimes.filter(t => t > 0)
            this.performanceStats.avgFrameTime = sum / (validTimes.length || 1)
            this.performanceStats.maxFrameTime = max
            this.performanceStats.minFrameTime = min === Infinity ? 0 : min

            // Log stats if debug mode is enabled
            if (this.config.isDebugEnabled()) {
                console.log(
                    `Performance: avg=${this.performanceStats.avgFrameTime.toFixed(
                        2
                    )}ms, ` +
                        `min=${this.performanceStats.minFrameTime.toFixed(
                            2
                        )}ms, ` +
                        `max=${this.performanceStats.maxFrameTime.toFixed(2)}ms`
                )
            }
        }
    }

    /**
     * Update common game systems that work the same regardless of game mode
     * @param deltaTime - Time since last frame in seconds
     * @param timestamp - Current timestamp for animation
     */
    updateCommonSystems(deltaTime: number, _timestamp: number): void {
        // Update particles
        this.updateParticles(deltaTime)
    }

    /**
     * Update all particles
     * @param deltaTime - Time since last frame in seconds
     */
    updateParticles(deltaTime: number): void {
        // Update particle system if it exists
        if (this.particleSystem) {
            this.particleSystem.update(deltaTime)
        }
    }

    /**
     * Update player movement based on input state
     * @param inputState - Current input state
     */
    updatePlayerMovement(inputState: InputState): void {
        // Apply input to player movement
        this.player.setMovementKey('up', inputState.up)
        this.player.setMovementKey('down', inputState.down)
        this.player.setMovementKey('left', inputState.left)
        this.player.setMovementKey('right', inputState.right)

        // Special case for up movement - make it more responsive
        // and scale with screen size
        if (inputState.up && this.player.y > 30) {
            // Apply an immediate boost when pressing up, scaled by screen size
            const boostAmount = 30 * this.scalingInfo.heightScale
            this.player.y -= boostAmount * 0.1
        }
    }

    /**
     * Handle collision with obstacle
     * @param obstacle - The obstacle that was hit
     */
    handleCollision(_obstacle: GameObject): void {
        // Play collision sound
        if (this.assetManager) {
            this.assetManager.playSound('collision', 0.3)
        } else {
            // Fallback to legacy sound method
            const playSound = (window as any).playSound || (() => {})
            playSound('collision')
        }

        // Flash screen red
        if (this.uiManager) {
            this.uiManager.flashScreen('#ff0000', 200)
        }

        // Set game state to game over
        this.gameState = this.config.STATE.GAME_OVER

        // Show game over screen
        if (this.uiManager) {
            this.uiManager.showGameOver(
                this.score,
                this.highScore,
                this.completeReset.bind(this)
            )
        }
    }

    /**
     * Render the game
     * @param timestamp - Current animation timestamp
     */
    render(timestamp: number): void {
        // Draw background (replaces clearRect)
        if (this.background) {
            try {
                this.background.update(timestamp)
            } catch (e) {
                console.error('Error updating background:', e)
                // Fallback: Clear the canvas manually
                if (this.ctx && this.canvas) {
                    this.ctx.clearRect(
                        0,
                        0,
                        this.canvas.width,
                        this.canvas.height
                    )
                    this.ctx.fillStyle = '#0a192f' // Dark blue background
                    this.ctx.fillRect(
                        0,
                        0,
                        this.canvas.width,
                        this.canvas.height
                    )
                }
            }
        } else {
            console.warn('No background object available')
            // Fallback: Clear the canvas manually
            if (this.ctx && this.canvas) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
                this.ctx.fillStyle = '#0a192f' // Dark blue background
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
            }
        }

        // During an online match the whole scene comes from the server, drawn by the mode
        if (this.currentGameMode?.drawsOwnScene()) {
            this.currentGameMode.render(timestamp)
            if (this.touchControls && typeof this.touchControls.draw === 'function') {
                this.touchControls.draw()
            }
            return
        }

        // Get obstacles - with error handling
        let obstacles: GameObject[] = []
        try {
            if (this.obstacleManager) {
                obstacles = this.obstacleManager.getObstacles()
            } else {
                console.error('Obstacle manager not available')
            }
        } catch (e) {
            console.error('Error getting obstacles:', e)
        }

        // Draw obstacles
        for (const obstacle of obstacles) {
            if (typeof (obstacle as any).draw === 'function') {
                ;(obstacle as any).draw(this.ctx)
            } else if (typeof obstacle.render === 'function') {
                obstacle.render(this.ctx, timestamp)
            }
        }

        // Draw local player - with error handling
        try {
            if (this.player) {
                this.player.draw(timestamp)
            } else {
                console.error('Player object not available for drawing')
            }
        } catch (e) {
            console.error('Error drawing player:', e)
        }

        // Draw particles
        this.drawParticles()

        // Draw touch controls if active and draw method exists
        if (
            this.touchControls &&
            typeof this.touchControls.draw === 'function'
        ) {
            this.touchControls.draw()
        }

        // Draw winning line
        this.drawWinningLine(timestamp)

        // Anything the mode adds on top (the online status line)
        this.currentGameMode?.renderOverlay(timestamp)

        // Draw debug information if enabled
        if (this.config.isDebugEnabled()) {
            this.drawDebugInfo(timestamp)
        }
    }

    /**
     * Draw all particles
     */
    drawParticles(): void {
        // Use particle system if it exists
        if (this.particleSystem) {
            this.particleSystem.draw()
        }
    }

    /**
     * Post-update phase for checking game conditions
     */
    postUpdate(): void {
        // Only run these checks if the game is in PLAYING state
        if (this.gameState !== this.config.STATE.PLAYING) return

        // Check for winner
        this.checkForWinner()

        // Update high score
        this.updateHighScore()
    }

    /**
     * Reset game after collision
     */
    resetGame(): void {
        this.score = 0
        if (this.uiManager) {
            this.uiManager.updateScore(0)
        }

        if (this.obstacleManager) {
            this.obstacleManager.reset()
        }

        if (this.player) {
            this.player.resetPosition()
        }

        // Clear particles
        if (this.particleSystem) {
            this.particleSystem.clear()
        } else if (this.particles) {
            this.particles = []
        }
    }

    /**
     * Complete reset after game over
     */
    completeReset(): void {
        // Hide any game over UI
        if (this.uiManager) {
            this.uiManager.hideGameOver()
        }

        // Reset game elements
        this.resetGame()

        // Set game state back to playing
        this.gameState = this.config.STATE.PLAYING
    }

    /**
     * Add celebration particles when scoring
     * @param winningLineScreenY - The winning line position in screen coordinates
     */
    addScoreParticles(winningLineScreenY?: number): void {
        // Use provided winningLineScreenY or calculate it
        const scaledWinningLine =
            winningLineScreenY ??
            this.config.getWinningLine(this.canvas.height, BASE_CANVAS_HEIGHT)

        // Number of particles based on score (more particles for higher scores)
        const particleCount = Math.min(10 + this.score * 2, 50)

        if (this.particleSystem) {
            // Use particle system if available
            this.particleSystem.createCelebration({
                x: this.player.x + this.player.width / 2,
                y: scaledWinningLine,
                count: particleCount,
                minSize: 2 * this.scalingInfo.widthScale,
                maxSize: 7 * this.scalingInfo.widthScale,
                minLife: 20,
                maxLife: 40,
            })
        }
    }

    /**
     * Check if player has reached the winning line
     */
    checkForWinner(): void {
        if (!this.player) return

        // Get winning line in screen coordinates (already scaled by getWinningLine)
        const winningLineScreenY = this.config.getWinningLine(
            this.canvas.height,
            BASE_CANVAS_HEIGHT
        )

        // Convert player position to screen coordinates to match winning line
        const scale = this.canvas.height / BASE_CANVAS_HEIGHT // Check if ANY part of the player crosses the winning line
        // Player.y is the TOP of the player in world coordinates
        const playerTopScreenY = this.player.y * scale
        // const playerBottomScreenY = (this.player.y + this.player.height) * scale

        // Trigger if any part of the player crosses or touches the winning line
        if (playerTopScreenY <= winningLineScreenY) {
            this.handleScore(winningLineScreenY)
        }
    }

    /**
     * Handle scoring when player crosses winning line
     * @param winningLineScreenY - The winning line position in screen coordinates
     */
    private handleScore(winningLineScreenY: number): void {
        // Increment score
        this.score++
        if (this.uiManager) {
            this.uiManager.updateScore(this.score)
        }

        // Add more obstacles as game progresses
        this.addObstaclesBasedOnScore()

        // Add visual effects at the correct screen position
        this.addScoreParticles(winningLineScreenY)

        // Play score sound
        if (this.assetManager) {
            this.assetManager.playSound('score', 0.3)
        } else {
            // Fallback to legacy sound method
            const playSound = (window as any).playSound || (() => {})
            playSound('score')
        }

        // Reset player to bottom of screen
        this.player.resetPosition()
    }

    /**
     * Add obstacles based on current score
     */
    addObstaclesBasedOnScore(): void {
        if (!this.obstacleManager) return

        // Add initial obstacles for new game
        if (this.score <= 2) {
            this.obstacleManager.addObstacle()
        }

        // Add obstacles as score increases (difficulty progression)
        if (this.score % 4 === 0) {
            this.obstacleManager.addObstacle()
        }

        // On small screens, cap the max number of obstacles to avoid overwhelming
        // the player
        if (
            this.scalingInfo.widthScale < 0.7 &&
            this.obstacleManager.getObstacles().length > 7
        ) {
            return
        }
    }

    /**
     * Update the high score if needed
     */
    updateHighScore(): void {
        if (this.score > this.highScore) {
            this.highScore = this.score
            if (this.uiManager) {
                this.uiManager.updateHighScore(this.highScore)
            }
        }
    }

    /**
     * Draw the winning line
     * @param timestamp - Current animation timestamp
     */
    drawWinningLine(timestamp: number): void {
        // Only draw winning line if score is high enough or on desktop
        if (this.score <= 5 && !this.isDesktop) return

        // Get the winning line position
        const scaledWinningLine = this.config.getWinningLine(
            this.canvas.height,
            BASE_CANVAS_HEIGHT
        )

        // Draw a subtle animated line
        this.ctx.save()
        this.ctx.globalAlpha = 0.7 + 0.3 * Math.sin(timestamp * 0.002)
        this.ctx.strokeStyle = '#7FDBFF'
        // this.ctx.strokeStyle = '#66D9EF'
        this.ctx.lineWidth = 2 * this.scalingInfo.heightScale
        this.ctx.setLineDash([5, 5])
        this.ctx.beginPath()
        this.ctx.moveTo(0, scaledWinningLine)
        this.ctx.lineTo(this.canvas.width, scaledWinningLine)
        this.ctx.stroke()
        this.ctx.restore()
    }

    /**
     * Draw debug information
     * @param timestamp - Current animation timestamp
     */
    drawDebugInfo(_timestamp: number): void {
        this.ctx.save()
        this.ctx.fillStyle = '#ffffff'
        this.ctx.font = '12px monospace'
        this.ctx.textAlign = 'left'

        const debugLines = [
            `FPS: ${Math.round(
                1000 / (this.performanceStats.avgFrameTime || 16)
            )}`,
            `Frame Time: ${this.performanceStats.avgFrameTime.toFixed(2)}ms`,
            `Scale: ${this.scalingInfo.widthScale.toFixed(
                2
            )}x${this.scalingInfo.heightScale.toFixed(2)}`,
            `Canvas: ${this.canvas.width}x${this.canvas.height}`,
            `Player: (${this.player?.x.toFixed(0)}, ${this.player?.y.toFixed(
                0
            )})`,
            `Game State: ${this.gameState}`,
            `Obstacles: ${this.obstacleManager?.getObstacles().length || 0}`,
            `Particles: ${
                this.particleSystem?.getStats().activeParticles || 0
            }`,
        ]

        debugLines.forEach((line, index) => {
            this.ctx.fillText(line, 10, 20 + index * 15)
        })

        this.ctx.restore()
    }

    /**
     * Clean up resources when game is destroyed
     */
    dispose(): void {
        // Remove event listeners
        document.removeEventListener(
            'game:restart',
            this.handleRestartEvent.bind(this)
        )

        // Clean up game mode
        if (this.currentGameMode) {
            this.currentGameMode.dispose()
            this.currentGameMode = null
        }

        // Clean up managers
        if (this.responsiveManager) {
            this.responsiveManager.dispose()
        }

        if (this.touchControls) {
            this.touchControls.hide()
        }

        // Clear any remaining intervals/timeouts
        // (none currently used, but good practice for future additions)
    }
}
