/**
 * Consolidated game modes implementation using the Strategy Pattern.
 * This file contains the base GameMode class and all its implementations.
 */
import Player from '../entities/Player'
import { InputState } from '../types'
import { GameEvents } from '../constants/client-constants'
import { ARENA_RULES, BOMBS, GEMS, INHALE, LATCH, PLAYER_COLORS, SHIFT, WORLD } from '../../server/constants/gameConstants'
import { breathRate } from '../../server/game/airflow'
import { CameraRig } from '../../server/game/camera'
import { turnStep, walk } from '../../server/game/movement'
import { launchDuration, launchPosition } from '../../server/game/turbine'
import { OnlineControls } from './OnlineControls'
import type { Breath } from './OnlineControls'
import type { MultiplayerManager } from '../managers/MultiplayerManager'
import { Airflow } from '../render/airflow'
import { bounce } from '../render/creatures'
import { INTRO, IntroSpark, drawIntro, makeIntroSparks } from '../render/intro'
import { COMPACT, GOLD } from '../render/style'
import { drawBall, drawBomb, drawComet, drawGem, drawLaunchPuff, gemColor } from '../render/world'
import { SMOOTHING, SNAP_DISTANCE, View } from '../render/shared'
import { drawTopBar, drawLeaderboard, drawMinimap, drawBanner, drawShiftChip, drawTrafficChip, drawNotices, drawKnockedOut, drawMessage, drawCapturePrompt } from '../render/hud'
import { drawGemBursts, drawVanishes, drawBlasts, drawBursts, drawPuffs, drawTheft } from '../render/effects'
import { drawCores } from '../render/cores'
import { drawTurbines, drawTurbineFlights } from '../render/turbines'
import { drawFloor, drawShiftFloor, drawJackpot } from '../render/floor'
import { captorOf, drawPlayer } from '../render/players'
import { drawObstacle } from '../render/obstacles'
import { drawPickups } from '../render/pickups'
import type { SyncedGameState, SyncedGem, SyncedObstacle, SyncedPlayer } from '../types/synced'
import { drawCannon } from '../render/cannon'

// Forward reference for the Game type to avoid circular dependencies
interface Game {
    gameState: string
    isMultiplayerMode: boolean
    score: number
    highScore: number
    config: any
    canvas: HTMLCanvasElement
    ctx: CanvasRenderingContext2D
    player: Player
    obstacleManager: any
    particleSystem: any
    uiManager: any
    assetManager: any
    scalingInfo: any
}

// Common interfaces
interface Obstacle {
    x: number
    y: number
    width: number
    height: number
}

// interface ParticleOptions {
//   x: number;
//   y: number;
//   count: number;
//   minSize: number;
//   maxSize: number;
//   minLife: number;
//   maxLife: number;
// }

/**
 * Abstract base class for game modes implementing the Strategy Pattern.
 */
export abstract class GameMode {
    /**
     * Reference to the main game controller
     */
    protected game: Game

    /**
     * Whether this mode has been initialized
     */
    protected initialized: boolean

    /**
     * Creates a new GameMode instance
     * @param game - Reference to the main game controller
     */
    constructor(game: Game) {
        if (this.constructor === GameMode) {
            throw new Error(
                'GameMode is an abstract class and cannot be instantiated directly'
            )
        }

        this.game = game
        this.initialized = false
    }

    /**
     * Initialize the game mode
     * @returns A promise that resolves when initialization is complete
     */
    async initialize(): Promise<void> {
        this.initialized = true
        return Promise.resolve()
    }

    /**
     * Update game state for this mode
     * @param inputState - Current input state
     * @param deltaTime - Time since last frame in seconds
     * @param timestamp - Current timestamp for animation
     */
    abstract update(
        inputState: InputState,
        deltaTime: number,
        timestamp: number
    ): void

    /**
     * Render game elements specific to this mode
     * @param timestamp - Current timestamp for animation
     */
    abstract render(timestamp: number): void

    /**
     * Handle post-update operations like win/lose detection
     */
    abstract postUpdate(): void

    /**
     * Handle game reset
     */
    abstract reset(): void

    /**
     * Handle complete reset after game over
     */
    abstract completeReset(): void

    /**
     * Clean up resources when switching away from this mode
     */
    dispose(): void {
        // Default implementation is a no-op
    }

    /** True when the mode draws the whole scene itself; otherwise Game draws the solo scene */
    drawsOwnScene(): boolean {
        return false
    }

    /** True when the mode wants the canvas to fill all the space it has (the online world) */
    wantsFullCanvas(): boolean {
        return false
    }

    /** Drawn on top of the solo scene (the online mode's status line) */
    renderOverlay(_timestamp: number): void {
        // Nothing by default
    }
}

/**
 * Implementation of single-player game mode.
 */
export class SinglePlayerMode extends GameMode {
    /**
     * Creates a new SinglePlayerMode instance
     * @param game - Reference to the main game controller
     */
    constructor(game: Game) {
        super(game)

        // Bind methods to maintain proper 'this' context
        this.handleCollision = this.handleCollision.bind(this)
        this.checkForWinner = this.checkForWinner.bind(this)
    }

    /**
     * Initialize the single player mode
     */
    async initialize(): Promise<void> {
        await super.initialize()

        // Set initial state for single player mode
        this.game.isMultiplayerMode = false

        // Reset score and state
        this.reset()

        console.log('SinglePlayerMode initialized')
        return Promise.resolve()
    }

    /**
     * Update game state for single player mode
     */
    update(inputState: InputState, deltaTime: number, timestamp: number): void {
        // Skip if game is not in playing state
        if (this.game.gameState !== this.game.config.STATE.PLAYING) {
            return
        }

        // Update player movement based on input
        this.updatePlayerMovement(inputState)

        // Update player position
        if (this.game.player) {
            this.game.player.move()
        }

        // Update obstacles using scaling info for responsive sizing
        if (this.game.obstacleManager) {
            this.game.obstacleManager.update(
                timestamp,
                this.game.score,
                this.game.scalingInfo
            )

            // Check for collisions with continuous collision detection (pass deltaTime)
            const collision = this.game.obstacleManager.checkCollisions(
                this.game.player,
                deltaTime
            )
            if (collision) {
                this.handleCollision(collision)
            }
        }
    }

    /**
     * Update player movement based on input state
     */
    private updatePlayerMovement(inputState: InputState): void {
        if (!this.game.player) return

        // Apply input to player movement
        this.game.player.setMovementKey('up', inputState.up)
        this.game.player.setMovementKey('down', inputState.down)
        this.game.player.setMovementKey('left', inputState.left)
        this.game.player.setMovementKey('right', inputState.right)

        // Special case for up movement - make it more responsive and scale with screen size
        if (inputState.up && this.game.player.y > 30) {
            // Apply an immediate boost when pressing up, scaled by screen size
            const boostAmount = 30 * this.game.scalingInfo.heightScale
            this.game.player.y -= boostAmount * 0.1
        }
    }

    /**
     * Handle collision with obstacle
     */
    private handleCollision(_obstacle: Obstacle): void {
        // Play collision sound
        if (this.game.assetManager) {
            this.game.assetManager.playSound('collision', 0.3)
        } else {
            // Fallback to legacy sound method
            const playSound = (window as any).playSound || (() => {})
            playSound('collision')
        }

        // Flash screen red
        if (this.game.uiManager) {
            this.game.uiManager.flashScreen('#ff0000', 200)
        }

        // Set game state to game over
        this.game.gameState = this.game.config.STATE.GAME_OVER

        // Show game over screen
        if (this.game.uiManager) {
            this.game.uiManager.showGameOver(
                this.game.score,
                this.game.highScore,
                this.completeReset.bind(this)
            )
        }
    }

    /**
     * Render single player mode specific elements
     */
    render(_timestamp: number): void {
        // Single player mode doesn't have any mode-specific rendering
        // All rendering is handled by the main Game.render method
    }

    /**
     * Post-update operations for single player mode
     */
    postUpdate(): void {
        // Only run these checks if the game is in PLAYING state
        if (this.game.gameState !== this.game.config.STATE.PLAYING) return

        // Check for winner
        this.checkForWinner()

        // Update high score
        this.updateHighScore()
    }

    /**
     * Check if player has reached the winning line
     */
    checkForWinner(): void {
        // Use EXACTLY the same calculation as Game.ts checkForWinner() and drawWinningLine()
        const BASE_CANVAS_HEIGHT = 550
        const scaledWinningLine = this.game.config.getWinningLine(
            this.game.canvas.height,
            BASE_CANVAS_HEIGHT
        )

        // Simple check: if player's top touches or crosses the winning line
        if (
            this.game.player.y <= scaledWinningLine &&
            !this.game.player.hasScored
        ) {
            // Mark as scored to prevent multiple scoring
            this.game.player.hasScored = true

            // Increment score
            this.game.score++
            if (this.game.uiManager) {
                this.game.uiManager.updateScore(this.game.score)
            }

            // Add more obstacles as game progresses
            this.addObstaclesBasedOnScore()

            // Add visual effects
            this.addScoreParticles(scaledWinningLine)

            // Play score sound
            if (this.game.assetManager) {
                this.game.assetManager.playSound('score', 0.3)
            }

            // Reset player to bottom of screen
            this.resetPlayerPosition()
        }
    }

    /**
     * Properly reset player position and scoring flags
     */
    private resetPlayerPosition(): void {
        if (!this.game.player) return

        // Reset player to bottom of screen
        this.game.player.resetPosition()

        // CRITICAL: Reset scoring flag so player can score again
        this.game.player.hasScored = false

        // Reset last position to current position
        this.game.player.lastY = this.game.player.y
    }

    /**
     * Add celebration particles when scoring
     */
    private addScoreParticles(winningLineY: number): void {
        if (!this.game.player || !this.game.particleSystem) return

        // Number of particles based on score (more particles for higher scores)
        const particleCount = Math.min(10 + this.game.score * 2, 50)

        // Apply scaling to particle sizes
        const scaleMultiplier = this.game.scalingInfo?.widthScale || 1

        this.game.particleSystem.createCelebration({
            x: this.game.player.x + this.game.player.width / 2,
            y: winningLineY, // Use exact winning line position
            count: particleCount,
            minSize: 2 * scaleMultiplier,
            maxSize: 7 * scaleMultiplier,
            minLife: 20,
            maxLife: 40,
        })
    }

    /**
     * Add obstacles based on current score
     */
    private addObstaclesBasedOnScore(): void {
        if (!this.game.obstacleManager) return

        // Add initial obstacles for new game
        if (this.game.score <= 2) {
            this.game.obstacleManager.addObstacle()
        }

        // Add obstacles as score increases (difficulty progression)
        if (this.game.score % 4 === 0) {
            this.game.obstacleManager.addObstacle()
        }

        // On small screens, cap the max number of obstacles
        if (
            this.game.scalingInfo.widthScale < 0.7 &&
            this.game.obstacleManager.getObstacles().length > 7
        ) {
            return
        }
    }

    /**
     * Update the high score if needed
     */
    private updateHighScore(): void {
        if (this.game.score > this.game.highScore) {
            this.game.highScore = this.game.score

            if (this.game.uiManager) {
                this.game.uiManager.updateHighScore(this.game.highScore)
            }
        }
    }

    /**
     * Reset game after collision
     */
    reset(): void {
        this.game.score = 0

        if (this.game.uiManager) {
            this.game.uiManager.updateScore(0)
        }

        if (this.game.obstacleManager) {
            this.game.obstacleManager.reset()
        }

        if (this.game.player) {
            this.game.player.resetPosition()
            // Reset scoring flag when game resets
            this.game.player.hasScored = false
        }

        // Clear particles
        if (this.game.particleSystem) {
            this.game.particleSystem.clear()
        }
    }

    /**
     * Complete reset after game over
     */
    completeReset(): void {
        // Hide any game over UI
        if (this.game.uiManager) {
            this.game.uiManager.hideGameOver()
        }

        // Reset game elements
        this.reset()

        // Set game state back to playing
        this.game.gameState = this.game.config.STATE.PLAYING
    }

    /**
     * Clean up resources
     */
    dispose(): void {
        console.log('SinglePlayerMode disposed')
    }
}

/** Wait this long before trying the server again */
const RECONNECT_DELAY_MS = 3000
/** Your drawn position jumps to the server's when they're this far apart (a respawn) */
const PREDICTION_SNAP = 150
/** How long the screen shakes when you're hit */
const SHAKE_MS = 300
/** Traffic is drawn at most this far ahead (seconds), in case updates stall */
const MAX_TRAFFIC_LEAD = 0.4
type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting'

/** It plays once per page load */
let introPlayed = false

/**
 * Online: one big open arena shared by everyone on the site. The server runs the world; this
 * mode hops your player the moment you press (telling the server about each hop) and draws the
 * part of the world around you, with a camera that follows you: gems, traffic, players, the
 * bursts when someone is hit or shoved, a leaderboard and a minimap.
 */
export class MultiplayerMode extends GameMode {
    multiplayerManager: MultiplayerManager | null = null
    private status: ConnectionStatus = 'connecting'
    private disposed = false
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    /** Where each other player is drawn, eased toward the server position */
    drawnPositions = new Map<string, { x: number; y: number }>()
    /** Your own position, hopped on your screen right away */
    predicted: { x: number; y: number } | null = null
    /** The world point at the center of the screen */
    private camera: { x: number; y: number } | null = null
    private lastRenderAt = 0
    /** Each player's drawn size, springing toward their real size so growing and shrinking pop */
    drawnSizes = new Map<string, { size: number; speed: number }>()
    /** Each creature's growth pop: when it last gained a gem and how big the pop was (see drawPlayer) */
    gemPops = new Map<string, { at: number; amount: number }>()
    /** Creatures caught in a mouth: when and where each was caught, so it can be seen sliding in (see drawPlayer) */
    captures = new Map<string, { at: number; x: number; y: number }>()
    /** Creatures just back out of a mouth: when each came out, so it can be seen swelling back to size (see drawPlayer) */
    emerges = new Map<string, number>()
    /** The camera rig, and the creature's last middle and smoothed velocity it follows */
    private cameraRig = new CameraRig()
    private cameraFrom: { x: number; y: number } | null = null
    private cameraVelocity = { x: 0, y: 0 }
    /** Each creature's airflow while it inhales (see drawAirflow) */
    flows = new Map<string, Airflow>()
    /** Where each Core is drawn: carrying on at its velocity, easing to each server update (see drawCores) */
    coresDrawn = new Map<string, { x: number; y: number }>()
    coresDrawnAt = 0
    /** Canvas pixels per screen point (the HUD on phones is laid out in screen points) */
    cssScale = 1
    /** The opening: when it started (null until then), and what it pulls in */
    private introStart: number | null = null
    private introSparks: IntroSpark[] = []
    /** When your player was knocked out, for the "back in" countdown */
    knockedOutAt: number | null = null
    /** The last time someone got you (and how), for the knocked-out screen: "Swallowed by Drew" */
    knockoutCause: { how: string; by: string; at: number } | null = null
    /** Messages at the top right: who joined, who shoved whom off the edge, who took the jackpot */
    notices: { text: string; at: number; strong: boolean }[] = []
    /** When each dropping gem was first seen, to draw its fall */
    private fallingSince = new Map<string, number>()
    /** Whether everyone is protected right now (a shift's grace period) */
    inGrace = false
    /** The joystick, INHALE button and mouse steering (drawn on the canvas) */
    controls: OnlineControls | null = null
    /** Your walking velocity */
    private velocity = { x: 0, y: 0 }
    /** Holding the button: inhaling (it never changes how you move) */
    private inhaleHeld = false
    private aim = { x: 0, y: -1 }
    /** The aim last sent (your eyes turn toward it for everyone), and which way you face */
    private sentAim = { x: 0, y: 0 }
    localFacing = -Math.PI / 2
    /** How fast your creature is turning (radians a second; see turnStep) */
    private localSpin = 0
    /** Your breath, tracked from when the server starts and stops your inhale (see breathOf) */
    /** Your breath (0-1), worked out like the server does: drains while you inhale, refills from wherever it is */
    stamina = 1
    private staminaAt = 0
    breath: Breath = { phase: 'ready' }
    /** Gem bursts and hard hits to draw, the banner for hits you cause, and the shake they bring */
    gemBursts: { x: number; y: number; count: number; at: number }[] = []
    impacts: { x: number; y: number; size: number; at: number }[] = []
    banner: { title: string; sub: string; at: number } | null = null
    private hitShake = { until: 0, strength: 0 }
    private facing = { x: 0, y: -1 }
    /** The steering last sent to the server */
    private sentSteer = { x: 0, y: 0 }
    /** Where you were drawn over the last second, to compare with the server (which runs a round trip behind) */
    private history: { at: number; x: number; y: number }[] = []
    private lastMoveAt = 0
    /** The view as last drawn, to find your player on screen for mouse steering */
    private lastView: View | null = null
    minimapBottom = 0
    /**
     * Our clock minus the world's clock for the quickest update seen: lining the two up this way
     * places traffic by the server's own timing rather than by when updates happen to land
     */
    private clockGap = Infinity
    /** Where each gem is drawn, eased toward the server position as sprayed gems slide */
    private drawnGems = new Map<string, { x: number; y: number }>()
    /** Each player as of the last frame, to spot hits and pickups */
    private lastSeen = new Map<string, { alive: boolean; recovering: boolean; sliding: boolean; gems: number; cx: number; cy: number }>()
    bursts: { x: number; y: number; size: number; color: string; at: number }[] = []
    /** Bomb blasts going off: a flash and a ring racing out to the blast's edge */
    blasts: { x: number; y: number; radius: number; at: number }[] = []
    /** Exhales: a puff of air out of a mouth, arcs rolling out through its cone */
    puffs: { x: number; y: number; facing: number; reach: number; at: number }[] = []
    /** Gravity theft on screen: each victim's gems last frame, and the stolen gems in flight */
    theftGems = new Map<string, number>()
    /** Swallowed creatures sliding down the throat, shrinking away (see drawVanishes) */
    vanishes: { id: string; x: number; y: number; size: number; color: string; facing: number; at: number }[] = []
    theftParticles: { from: string; to: string; at: number; angle: number; flight: number; power: number }[] = []
    pickups: { amount: number; at: number }[] = []
    private shakeUntil = 0
    /** Gems shown in the header (as Score), and the most you've held this visit (as High Score) */
    private shownGems = -1
    private bestGems = 0

    async initialize(): Promise<void> {
        await super.initialize()
        this.game.isMultiplayerMode = true
        // Coming from solo: put its game-over screen away; the online world never pauses
        this.game.uiManager?.hideGameOver()
        this.game.gameState = this.game.config.STATE.PLAYING
        // Touch and mouse controls drawn on the canvas; the D-pad and swipes are for solo
        if (this.game.canvas) this.controls = new OnlineControls(this.game.canvas)
        document.body.classList.add('online-mode')
        const inputManager = (this.game as any).inputManager
        if (inputManager) inputManager.swipesEnabled = false
        // Online, the header shows your gems and the most you've held this visit
        this.game.uiManager?.updateScore(0)
        this.game.uiManager?.updateHighScore(0)

        const [{ MultiplayerManager }, { EventBus }, { default: AssetManager }] = await Promise.all([
            import('../managers/MultiplayerManager'),
            import('./EventBus'),
            import('../managers/AssetManager'),
        ])
        const eventBus = new EventBus()
        this.multiplayerManager = new MultiplayerManager(eventBus, new AssetManager())
        eventBus.on(GameEvents.PLAYER_JOINED, (data: any) => {
            if (data?.id && data.id !== this.multiplayerManager?.localSessionId) {
                this.addNotice(`${String(data.name ?? 'Someone')} joined`)
            }
        })
        eventBus.on(GameEvents.MULTIPLAYER_DISCONNECTED, () => this.reconnectSoon())
        eventBus.on(GameEvents.MULTIPLAYER_STATE_UPDATE, (state: SyncedGameState) => {
            if (typeof state?.time !== 'number') return
            const gap = performance.now() - state.time
            // Keep the quickest arrival, drifting up slowly in case the clocks wander
            this.clockGap = gap < this.clockGap ? gap : this.clockGap + (gap - this.clockGap) * 0.005
        })
        eventBus.on('multiplayer:credit', (data: any) => this.noteCredit(data))
        eventBus.on('multiplayer:burst', (data: any) => this.noteBurst(data))
        eventBus.on('multiplayer:vanish', (data: any) => {
            const local = data?.id === this.multiplayerManager?.localSessionId
            this.vanishes.push({
                id: String(data?.id ?? ''),
                x: Number(data?.x) || 0,
                y: Number(data?.y) || 0,
                size: Number(data?.size) || 20,
                color: local ? '#ffffff' : PLAYER_COLORS[(Number(data?.index) || 0) % PLAYER_COLORS.length],
                facing: Number(data?.facing) || 0,
                at: performance.now(),
            })
        })
        eventBus.on('multiplayer:impact', (data: any) => this.noteImpact(data))
        eventBus.on('multiplayer:blast', (data: any) => this.blasts.push({ x: Number(data?.x) || 0, y: Number(data?.y) || 0, radius: Number(data?.radius) || BOMBS.BLAST_RADIUS, at: performance.now() }))
        eventBus.on('multiplayer:exhale', (data: any) => this.puffs.push({ x: Number(data?.x) || 0, y: Number(data?.y) || 0, facing: Number(data?.facing) || 0, reach: Number(data?.reach) || 200, at: performance.now() }))
        eventBus.on('multiplayer:jackpot', (data: any) => {
            this.addNotice(`${this.nameOf(data?.byId, data?.by)} took the jackpot! +${data?.value ?? ''}`, true)
        })

        // Connect in the background; the canvas says so meanwhile
        this.connect()
    }

    private async connect(): Promise<void> {
        if (!this.multiplayerManager || this.disposed) return
        const connected = await this.multiplayerManager.connect()
        if (this.disposed) return
        if (connected) {
            this.status = 'connected'
            this.clockGap = Infinity // a new world has its own clock
            this.predicted = null
            this.camera = null
        } else if (!this.multiplayerManager.isConnected()) {
            this.reconnectSoon()
        }
    }

    private reconnectSoon(): void {
        if (this.disposed || this.reconnectTimer) return
        this.status = 'reconnecting'
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, RECONNECT_DELAY_MS)
    }

    /** The world as the server last described it, once connected */
    private worldState(): any {
        return this.status === 'connected' ? this.multiplayerManager?.getState() : null
    }

    update(inputState: InputState, _deltaTime: number, _timestamp: number): void {
        this.moveLocalPlayer(inputState)
        this.showGems()
    }

    /** Where you're steering: the joystick or mouse if in use (analog), otherwise the keys (eight ways) */
    private steerVector(input: InputState, me: SyncedPlayer): { x: number; y: number } {
        const view = this.lastView
        const canvas = this.game.canvas
        if (this.controls && view && canvas) {
            const position = this.predicted ?? me
            const x = (position.x + me.width / 2 - view.x) * view.scale + canvas.width / 2
            const y = (position.y + me.height / 2 - view.y) * view.scale + canvas.height / 2
            const pointer = this.controls.vector(x, y, me.width * view.scale)
            if (pointer) return pointer
        }
        const x = (input.right ? 1 : 0) - (input.left ? 1 : 0)
        const y = (input.down ? 1 : 0) - (input.up ? 1 : 0)
        const length = Math.hypot(x, y)
        return length > 0 ? { x: x / length, y: y / length } : { x: 0, y: 0 }
    }

    /** Tell the server where you're steering, whenever it changes */
    private sendSteer(steer: { x: number; y: number }): void {
        const x = Math.round(steer.x * 100) / 100
        const y = Math.round(steer.y * 100) / 100
        const wasStill = this.sentSteer.x === 0 && this.sentSteer.y === 0
        const still = x === 0 && y === 0
        if (still === wasStill && Math.abs(x - this.sentSteer.x) < 0.04 && Math.abs(y - this.sentSteer.y) < 0.04) return
        this.sentSteer = { x, y }
        this.multiplayerManager?.sendMessage('steer', { x, y })
    }

    private resetMotion(): void {
        this.velocity = { x: 0, y: 0 }
        this.inhaleHeld = false
        this.history = []
    }

    /** Keep the header's Score (your gems) and High Score (your most this visit) current */
    private showGems(): void {
        const state = this.worldState()
        const localId = this.multiplayerManager?.localSessionId
        const me = state && localId ? state.players.get(localId) : undefined
        if (!me || me.gems === this.shownGems) return
        this.shownGems = me.gems
        this.bestGems = Math.max(this.bestGems, me.gems)
        this.game.uiManager?.updateScore(me.gems)
        this.game.uiManager?.updateHighScore(this.bestGems)
    }

    /**
     * Hop your player the moment you press (holding keeps hopping), and tell the server about
     * each hop. The server applies the same hops and decides hits; once you stop, your player
     * settles onto the server's position, and a big difference (a respawn) snaps to it.
     */
    private moveLocalPlayer(input: InputState): void {
        const now = performance.now()
        // The button: hold to inhale (taken every frame, so nothing waits for later)
        const events = this.controls?.takeEvents() ?? []
        if (this.introPlaying) events.length = 0
        const deltaTime = this.lastMoveAt ? Math.min(0.1, (now - this.lastMoveAt) / 1000) : 0
        this.lastMoveAt = now

        const state = this.worldState()
        const localId = this.multiplayerManager?.localSessionId
        const me = state && localId ? state.players.get(localId) : undefined
        if (!state || !me) {
            this.predicted = null
            return
        }
        // Stunned (by a Core), you can't steer, just like on the server
        const steer = this.introPlaying || me.stunned ? { x: 0, y: 0 } : this.steerVector(input, me)
        // Inhaling never slows you down: you always steer exactly as usual
        this.sendSteer(steer)
        if (me.state !== 'alive') {
            this.predicted = { x: me.x, y: me.y }
            this.resetMotion()
            return
        }
        if (!this.predicted) this.predicted = { x: me.x, y: me.y }
        // (caught in a mouth or flying, the server moves you too)
        if (me.sliding || me.recovering || me.flying || me.capturedBy) {
            // Shoved or knocked into a skid: go where the server says, no steering until you've recovered
            this.predicted = {
                x: this.predicted.x + (me.x - this.predicted.x) * 0.5,
                y: this.predicted.y + (me.y - this.predicted.y) * 0.5,
            }
            this.resetMotion()
            return
        }

        const steering = Math.hypot(steer.x, steer.y)
        if (steering > 0.2) this.facing = { x: steer.x / steering, y: steer.y / steering }
        // Your mouth points where you're going (the joystick, mouse and keys all aim directly)
        this.aim = steering > 0.2 ? { x: steer.x / steering, y: steer.y / steering } : { ...this.facing }
        if (this.inhaleHeld && Math.hypot(this.aim.x - this.sentAim.x, this.aim.y - this.sentAim.y) > 0.1) {
            // You turn to face your aim, for everyone to see
            this.sentAim = { ...this.aim }
            this.multiplayerManager?.sendMessage('aim', { x: this.aim.x, y: this.aim.y })
        }
        for (const event of events) {
            if (event === 'inhale') {
                this.inhaleHeld = true
                this.sentAim = { x: 0, y: 0 }
                this.multiplayerManager?.sendMessage('inhale', {})
            } else if (event === 'tap') {
                // A quick tap, never an inhale: fires a captive, or spits a bomb
                this.multiplayerManager?.sendMessage('tap', {})
            } else if (event === 'exhale' && this.inhaleHeld) {
                // Let go: stop inhaling (someone caught stays inside; the next press fires them)
                this.inhaleHeld = false
                this.multiplayerManager?.sendMessage('exhale', {})
            } else if (event === 'cancel' && this.inhaleHeld) {
                // Cut short (slid off, Esc, a cancelled touch): stop inhaling, never a launch
                this.inhaleHeld = false
                this.multiplayerManager?.sendMessage('cancel', {})
            }
        }

        // Move exactly the way the server does
        const box = { x: this.predicted.x, y: this.predicted.y, width: me.width, height: me.height }
        // Facing, worked out like the server does: the aim while inhaling, else where you steer
        const intent = this.inhaleHeld ? this.aim : steer
        // A focused latch adds a little aim toward its target, as on the server (your turning does the rest)
        const latched = me.latchTarget && me.latchPull > 0 && me.inhaling ? this.multiplayerManager?.getState()?.players?.get(me.latchTarget) : null
        let aimed = intent
        if (latched) {
            const dx = latched.x + latched.width / 2 - (me.x + me.width / 2)
            const dy = latched.y + latched.height / 2 - (me.y + me.height / 2)
            const d = Math.max(1e-6, Math.hypot(dx, dy))
            aimed = { x: intent.x + (dx / d) * LATCH.ASSIST * me.latchPull, y: intent.y + (dy / d) * LATCH.ASSIST * me.latchPull }
        }
        const turn = turnStep(this.localFacing, this.localSpin, Math.hypot(aimed.x, aimed.y) > 0.25 ? Math.atan2(aimed.y, aimed.x) : null, me.width, this.inhaleHeld, deltaTime)
        this.localFacing = turn.facing
        this.localSpin = turn.spin
        walk(box, this.velocity, steer, deltaTime, state.worldWidth, state.worldHeight)
        // Creatures are solid: stop at anyone you walk into and slide along them, as the server does
        const myId = this.multiplayerManager?.localSessionId
        state.players.forEach((other: SyncedPlayer, id: string) => {
            if (id === myId || other.state !== 'alive') return
            // Your captive is held where your mouth puts it (inside you), and a captor you're in isn't a wall:
            // no separation between those two, exactly as on the server (bodies.ts), or you'd be shoved out of
            // your own captive here and dragged back by the server every frame
            if (other.capturedBy === myId || me.capturedBy === id) return
            const at = this.drawnPositions.get(id) ?? { x: other.x, y: other.y }
            const dx = box.x + box.width / 2 - (at.x + other.width / 2)
            const dy = box.y + box.height / 2 - (at.y + other.height / 2)
            const distance = Math.hypot(dx, dy)
            const overlap = (box.width + other.width) / 2 - distance
            if (overlap <= -ARENA_RULES.CONTACT_TOUCH || distance < 1e-6) return
            const nx = dx / distance
            const ny = dy / distance
            // Touching: most of this step's sideways movement is undone unless you're moving away (as the server does)
            const speed = Math.hypot(this.velocity.x, this.velocity.y)
            const toward = -(this.velocity.x * nx + this.velocity.y * ny)
            if (speed > 1e-6 && toward >= -0.2 * speed) {
                box.x -= (this.velocity.x + toward * nx) * deltaTime * ARENA_RULES.CONTACT_GRIP
                box.y -= (this.velocity.y + toward * ny) * deltaTime * ARENA_RULES.CONTACT_GRIP
            }
            // Soft bodies: a little squish before pushing back hard
            const excess = overlap - ARENA_RULES.CONTACT_SQUISH * Math.min(box.width, other.width)
            if (excess <= 0) return
            box.x += nx * excess
            box.y += ny * excess
            const into = -(this.velocity.x * nx + this.velocity.y * ny)
            if (into > 0) {
                this.velocity.x += into * nx
                this.velocity.y += into * ny
            }
        })

        // The server shows where you were about a round trip ago: quietly correct any drift from that
        this.history.push({ at: now, x: box.x, y: box.y })
        while (this.history.length > 1 && now - this.history[0].at > 1000) this.history.shift()
        const lag = (this.multiplayerManager?.roundTripMs ?? 0) + 50
        const then = this.history.find((entry) => entry.at >= now - lag) ?? this.history[0]
        const driftX = me.x - then.x
        const driftY = me.y - then.y
        const drift = Math.hypot(driftX, driftY)
        if (drift > PREDICTION_SNAP) {
            box.x = me.x
            box.y = me.y
            this.history = []
        } else if (drift > 1) {
            const fixX = driftX * 0.1
            const fixY = driftY * 0.1
            box.x += fixX
            box.y += fixY
            for (const entry of this.history) {
                entry.x += fixX
                entry.y += fixY
            }
        }
        this.predicted = { x: box.x, y: box.y }
    }

    /** Where your breath is: draining over INHALE.MAX_MS while you inhale, refilling over INHALE.REFILL_MS from wherever it is */
    breathOf(inhaling: boolean, now: number, beamQuality = 0): Breath {
        // A step at most a quarter second long, so coming back to a paused tab does not empty (or fill) it at once
        const elapsed = Math.min(250, Math.max(0, now - this.staminaAt))
        this.staminaAt = now
        // (a clean focused beam uses less breath, then none, then slowly refills it: see game/airflow)
        this.stamina = Math.min(1, Math.max(0, this.stamina + (inhaling ? elapsed * breathRate(beamQuality, this.stamina) : elapsed / INHALE.REFILL_MS)))
        if (inhaling) return { phase: 'inhaling', left: this.stamina }
        if (this.stamina < 1) return { phase: 'recovering', back: this.stamina }
        return { phase: 'ready' }
    }

    /** The online mode always draws the whole scene itself */
    drawsOwnScene(): boolean {
        return true
    }

    /** The world is bigger than the screen, so the canvas takes all the space it has */
    wantsFullCanvas(): boolean {
        return true
    }

    render(timestamp: number): void {
        const { ctx, canvas } = this.game
        if (!ctx || !canvas) return
        const state = this.worldState()
        if (!state || !state.worldWidth) {
            drawMessage(this, ctx, canvas, this.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…', 'Joining the arena')
            return
        }
        const localId = this.multiplayerManager?.localSessionId ?? null
        const me = localId ? state.players.get(localId) : undefined
        this.trackKnockout(me)
        this.trackEvents(state, localId, timestamp)
        const view = this.updateCamera(canvas, state, me, timestamp)
        if (timestamp < this.shakeUntil) {
            const strength = ((this.shakeUntil - timestamp) / SHAKE_MS) * 8
            view.x += (Math.random() - 0.5) * 2 * strength
            view.y += (Math.random() - 0.5) * 2 * strength
        }
        const jolt = this.extraShake()
        view.x += jolt.x
        view.y += jolt.y
        this.lastView = view
        const leaderId = this.leaderId(state)
        this.inGrace = state.shiftPhase === 'grace'

        ctx.save()
        ctx.setTransform(
            view.scale, 0, 0, view.scale,
            canvas.width / 2 - view.x * view.scale,
            canvas.height / 2 - view.y * view.scale
        )
        drawFloor(this, ctx, state, view)
        drawShiftFloor(this, ctx, state, view, timestamp)
        const margin = 120
        const left = view.x - view.width / 2 - margin
        const right = view.x + view.width / 2 + margin
        const top = view.y - view.height / 2 - margin
        const bottom = view.y + view.height / 2 + margin
        drawTurbines(this, ctx, state, timestamp)
        drawCannon(this, ctx, state, timestamp)
        drawCores(this, ctx, state, timestamp)
        this.drawGems(ctx, state, left, right, top, bottom, timestamp)
        drawGemBursts(this, ctx)
        drawJackpot(this, ctx, state, localId, timestamp)
        const lead = this.trafficLead(timestamp)
        state.obstacles.forEach((obstacle: SyncedObstacle) => {
            const x = obstacle.x + (obstacle.vx ?? 0) * lead
            const y = obstacle.y + (obstacle.vy ?? 0) * lead
            if (x > right || x + obstacle.width < left || y > bottom || y + obstacle.height < top) return
            drawObstacle(this, ctx, { x, y, width: obstacle.width, height: obstacle.height, variant: obstacle.variant }, timestamp)
        })
        const rolling = state.trafficWave === 'wave'
        state.balls?.forEach((ball: any) => {
            // Out of the world between traffic waves (and rolling straight out as one ends)
            const r = ball.radius
            if (ball.x < -r || ball.y < -r || ball.x > state.worldWidth + r || ball.y > state.worldHeight + r) return
            const x = rolling ? bounce(ball.x, (ball.vx ?? 0) * lead, r, state.worldWidth - r) : ball.x + (ball.vx ?? 0) * lead
            const y = rolling ? bounce(ball.y, (ball.vy ?? 0) * lead, r, state.worldHeight - r) : ball.y + (ball.vy ?? 0) * lead
            if (x + ball.radius < left || x - ball.radius > right || y + ball.radius < top || y - ball.radius > bottom) return
            drawBall(ctx, x, y, ball.radius)
        })
        state.bombs?.forEach((bomb: any) => {
            if (bomb.x < -100) return // in someone's mouth, or about to turn up again
            const x = bomb.x + (bomb.vx ?? 0) * lead
            const y = bomb.y + (bomb.vy ?? 0) * lead
            const reach = BOMBS.BLAST_RADIUS + 20
            if (x + reach < left || x - reach > right || y + reach < top || y - reach > bottom) return
            const fuseLeft = bomb.explodesAt > 0 ? bomb.explodesAt - this.worldNow(state, timestamp) : null
            drawBomb(ctx, x, y, bomb.radius, fuseLeft, timestamp)
        })
        state.comets?.forEach((comet: any) => {
            const x = comet.x + (comet.vx ?? 0) * lead
            const y = comet.y + (comet.vy ?? 0) * lead
            const reach = comet.radius * 6
            if (x + reach < left || x - reach > right || y + reach < top || y - reach > bottom) return
            drawComet(ctx, x, y, comet.radius, comet.vx ?? 0, comet.vy ?? 0)
        })
        const present = new Set<string>()
        state.players.forEach((player: SyncedPlayer, sessionId: string) => {
            present.add(sessionId)
            if (captorOf(state, player, sessionId)) return // held in a mouth: its captor draws it there (see drawPlayer)
            drawPlayer(this, ctx, player, sessionId, sessionId === localId, sessionId === leaderId, timestamp)
        })
        for (const id of this.drawnPositions.keys()) {
            if (!present.has(id)) this.drawnPositions.delete(id)
        }
        for (const id of this.drawnSizes.keys()) {
            if (!present.has(id)) this.drawnSizes.delete(id)
        }
        for (const id of this.flows.keys()) {
            if (!present.has(id)) this.flows.delete(id)
        }
        for (const id of this.gemPops.keys()) {
            if (!present.has(id)) this.gemPops.delete(id)
        }
        for (const id of this.captures.keys()) {
            if (!present.has(id)) this.captures.delete(id)
        }
        for (const id of this.emerges.keys()) {
            if (!present.has(id)) this.emerges.delete(id)
        }

        drawTheft(this, ctx, state, timestamp)
        drawTurbineFlights(this, ctx, state, timestamp)
        drawVanishes(this, ctx, timestamp)
        drawBlasts(this, ctx, timestamp)
        drawPuffs(this, ctx, timestamp)
        drawBursts(this, ctx, timestamp)
        drawPickups(this, ctx, me, timestamp)

        // Screen-space overlays: hidden while the opening plays, then fading in
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.cssScale = canvas.width / Math.max(1, canvas.getBoundingClientRect().width)
        const hud = this.runIntro(ctx, canvas, timestamp)
        if (hud > 0) {
            ctx.globalAlpha = hud
            if (COMPACT.matches) drawTopBar(this, ctx, canvas, state, me)
            drawMinimap(this, ctx, canvas, state, view, localId, leaderId)
            drawLeaderboard(this, ctx, canvas, state, localId, leaderId)
            drawNotices(this, ctx, canvas)
            drawShiftChip(this, ctx, canvas, state, timestamp)
            drawTrafficChip(this, ctx, canvas, state, timestamp)
            drawBanner(this, ctx, canvas)
            drawCapturePrompt(this, ctx, canvas, state, me, timestamp)
            this.controls?.draw(ctx, timestamp, this.breath)
            if (me && me.state === 'gulped') drawMessage(this, ctx, canvas, `Gulped by ${this.nameOf(me.insideOf, 'someone')}`, 'Hang on: you pop back out in a moment')
            else if (me && me.state !== 'alive') drawKnockedOut(this, ctx, canvas)
            ctx.globalAlpha = 1
        }
        ctx.restore()
    }

    /**
     * Follow your player. Every screen sees the same amount of world (WORLD.VIEW_AREA), shaped
     * to the screen within the aspect limits; a screen outside them sees less, never more.
     */
    private updateCamera(canvas: HTMLCanvasElement, state: SyncedGameState, me: SyncedPlayer, timestamp: number): View {
        const aspect = Math.min(WORLD.MAX_VIEW_ASPECT, Math.max(WORLD.MIN_VIEW_ASPECT, canvas.width / canvas.height))
        // The soft-follow rig (game/camera): it leads your movement a little (and your facing, more while
        // inhaling), follows on a spring, and zooms by how big you should look and the threat horizon
        const dt = this.lastRenderAt ? (timestamp - this.lastRenderAt) / 1000 : 0
        let subject = null
        if (me && me.state === 'alive') {
            const position = this.predicted ?? me
            const middleX = position.x + me.width / 2
            const middleY = position.y + me.height / 2
            if (this.cameraFrom && dt > 0) {
                const blend = 1 - Math.exp(-10 * Math.min(0.1, dt))
                this.cameraVelocity.x += ((middleX - this.cameraFrom.x) / dt - this.cameraVelocity.x) * blend
                this.cameraVelocity.y += ((middleY - this.cameraFrom.y) / dt - this.cameraVelocity.y) * blend
            }
            this.cameraFrom = { x: middleX, y: middleY }
            subject = { x: middleX, y: middleY, vx: this.cameraVelocity.x, vy: this.cameraVelocity.y, width: me.width, facing: this.localFacing, inhaling: Boolean(me.inhaling) }
        }
        this.cameraRig.update(subject, dt)
        const short = this.cameraRig.short || 600
        const scale = Math.max(canvas.width / (canvas.width >= canvas.height ? short * aspect : short), canvas.height / (canvas.width >= canvas.height ? short : short / aspect))
        const width = canvas.width / scale
        const height = canvas.height / scale
        this.camera = this.cameraRig.short ? { x: this.cameraRig.x, y: this.cameraRig.y } : (this.camera ?? { x: state.worldWidth / 2, y: state.worldHeight / 2 })
        this.lastRenderAt = timestamp

        // Keep the view inside the world
        const x = width >= state.worldWidth
            ? state.worldWidth / 2
            : Math.min(Math.max(this.camera.x, width / 2), state.worldWidth - width / 2)
        const y = height >= state.worldHeight
            ? state.worldHeight / 2
            : Math.min(Math.max(this.camera.y, height / 2), state.worldHeight - height / 2)
        return { x, y, width, height, scale }
    }

    /**
     * How far ahead (seconds) to draw traffic: to where it will be when a hop you make now
     * reaches the server, which is where the server judges hits. Traffic moves in straight
     * lines, so this is exact, and it also keeps it moving smoothly between updates.
     */
    private trafficLead(timestamp: number): number {
        const state = this.worldState()
        if (!state || typeof state.time !== 'number' || !Number.isFinite(this.clockGap)) return 0
        const sinceTick = timestamp - (state.time + this.clockGap)
        const roundTrip = this.multiplayerManager?.roundTripMs ?? 0
        return Math.max(0, Math.min(MAX_TRAFFIC_LEAD, (sinceTick + roundTrip) / 1000))
    }

    /** Our best guess at the world's clock right now */
    worldNow(state: SyncedGameState, timestamp: number): number {
        return Number.isFinite(this.clockGap) ? timestamp - this.clockGap : state.time
    }

    private addNotice(text: string, strong = false): void {
        this.notices.push({ text, at: performance.now(), strong })
        if (this.notices.length > 3) this.notices.shift()
    }

    /** "You" for your own player, their name for anyone else */
    private nameOf(id: string | undefined, name: string | undefined): string {
        return id && id === this.multiplayerManager?.localSessionId ? 'You' : String(name ?? 'Someone')
    }

    /** Someone knocked someone else into trouble: say who did it, with a big banner if it was you */
    private noteCredit(data: any): void {
        const localId = this.multiplayerManager?.localSessionId
        const targetIsYou = data?.targetId === localId
        const target = targetIsYou ? 'you' : String(data?.target ?? 'someone')
        const how = String(data?.how ?? '')
        if (targetIsYou && how !== 'stole' && how !== 'gulped') {
            this.knockoutCause = { how, by: String(data?.by ?? 'Someone'), at: performance.now() }
        }
        const verb = how === 'stole' ? 'robbed' : how === 'gulped' ? 'gulped' : how === 'turbine' ? 'fed' : how === 'bomb' ? 'blew up' : 'shoved'
        const where = how === 'stole' ? `of ${Number(data?.gems) || 0} gems` : how === 'gulped' ? (Number(data?.gems) > 0 ? `(${Number(data?.gems)} gems spilled)` : '') : how === 'turbine' ? 'to a turbine' : how === 'edge' ? 'off the edge' : how === 'traffic' ? 'into traffic' : ''
        if (data?.byId === localId) {
            const name = String(data?.target ?? 'someone')
            const title = how === 'stole' ? `You stole ${Number(data?.gems) || 0} gems from ${name}!` : how === 'gulped' ? `You gulped ${name}!` : how === 'turbine' ? `You fed ${name} to a turbine!` : how === 'bomb' ? `You blew up ${name}!` : `You wrecked ${name}!`
            const parts =
                how === 'stole' ? []
                : how === 'gulped' ? (Number(data?.gems) > 0 ? [`${Number(data?.gems)} gems spilled`] : [])
                : how === 'bomb' ? [data?.out ? 'knocked out' : `${Number(data?.gems) || 0} gems knocked loose`]
                : [where, data?.out ? 'knocked out' : '']
            this.banner = { title, sub: parts.filter(Boolean).join(' · ').toUpperCase(), at: performance.now() }
            return
        }
        const out = how !== 'gulped' && how !== 'turbine' && data?.out ? (targetIsYou ? ' and knocked you out' : ' and knocked them out') : ''
        this.addNotice(`${this.nameOf(data?.byId, data?.by)} ${verb} ${target}${where ? ' ' + where : ''}${out}!`, data?.out === true)
    }

    /** A pile of gems burst out somewhere: draw it, and shake the screen if it was big and close */
    private noteBurst(data: any): void {
        const x = Number(data?.x)
        const y = Number(data?.y)
        const count = Number(data?.count) || 0
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        this.gemBursts.push({ x, y, count, at: performance.now() })
        if (this.gemBursts.length > 12) this.gemBursts.shift()
        const me = this.predicted
        if (me && count >= 6 && Math.hypot(me.x - x, me.y - y) < 700) this.addShake(Math.min(10, 2 + count * 0.3))
    }

    /** A bump connected: a shockwave, and a jolt for the two players involved */
    private noteImpact(data: any): void {
        const x = Number(data?.x)
        const y = Number(data?.y)
        const size = Number(data?.size) || 20
        if (!Number.isFinite(x) || !Number.isFinite(y)) return
        this.impacts.push({ x, y, size, at: performance.now() })
        if (this.impacts.length > 12) this.impacts.shift()
        const localId = this.multiplayerManager?.localSessionId
        if (data?.byId === localId || data?.targetId === localId) this.addShake(3 + size * 0.08)
    }

    private addShake(strength: number): void {
        const now = performance.now()
        const current = now < this.hitShake.until ? this.hitShake.strength : 0
        this.hitShake = { until: now + 280, strength: Math.max(strength, current) }
    }

    /** This frame's extra screen shake from bursts and hits */
    private extraShake(): { x: number; y: number } {
        const now = performance.now()
        const left = this.hitShake.until - now
        if (left <= 0) return { x: 0, y: 0 }
        const amount = this.hitShake.strength * (left / 280)
        return { x: Math.sin(now * 0.09) * amount, y: Math.cos(now * 0.13) * amount }
    }

    /** Where a player is drawn this frame (its center) */
    centerOf(id: string, player: SyncedPlayer): { x: number; y: number } {
        const at = this.drawnPositions.get(id) ?? player
        return { x: at.x + player.width / 2, y: at.y + player.height / 2 }
    }

    /** Whoever has the most gems (nobody, until someone has one) */
    private leaderId(state: SyncedGameState): string | null {
        let leader: string | null = null
        let most = 0
        state.players.forEach((player: SyncedPlayer, id: string) => {
            if (player.state === 'alive' && player.gems > most) {
                most = player.gems
                leader = id
            }
        })
        return leader
    }

    /** Spot hits and pickups by comparing each player with the last frame */
    private trackEvents(state: SyncedGameState, localId: string | null, timestamp: number): void {
        const seen = new Set<string>()
        state.players.forEach((player: SyncedPlayer, id: string) => {
            seen.add(id)
            const before = this.lastSeen.get(id)
            const alive = player.state === 'alive'
            if (before) {
                const hit = (player.recovering && !before.recovering) || (!alive && before.alive)
                if (hit) {
                    // Gold when gems burst out, red when it knocked them out
                    const color = alive ? GOLD : '#ff6b6b'
                    this.bursts.push({ x: before.cx, y: before.cy, size: player.width, color, at: timestamp })
                    if (id === localId) this.shakeUntil = timestamp + SHAKE_MS
                } else if (id === localId && player.gems > before.gems) {
                    // Stealing: a "+1" for each gem coming in (head-on, whoever is winning the exchange); otherwise what you grabbed
                    const gained = player.gems - before.gems
                    if (player.stealingFrom) for (let i = 0; i < gained; i++) this.pickups.push({ amount: 1, at: timestamp + i * 70 })
                    else this.pickups.push({ amount: gained, at: timestamp })
                } else if (id === localId && player.gems < before.gems && this.beingRobbed(state, id)) {
                    // Gems pulled out of you: a "-1" for each one, one after another
                    for (let i = 0; i < before.gems - player.gems; i++) this.pickups.push({ amount: -1, at: timestamp + i * 70 })
                }
                // Every gem shows: the creature pops a little as each one comes in
                if (alive && player.gems > before.gems) {
                    // 2.5% a gem, adding to whatever pop is still settling, up to 5% (so a fast drain swells rather than vibrates)
                    const last = this.gemPops.get(id)
                    const left = last ? last.amount * Math.max(0, 1 - (timestamp - last.at) / 130) : 0
                    this.gemPops.set(id, { at: timestamp, amount: Math.min(0.05, left + 0.025 * (player.gems - before.gems)) })
                }
                if (player.sliding && !before.sliding) {
                    // Shoved: a small white ring, and a nudge of your screen if it's you
                    const cx = player.x + player.width / 2
                    const cy = player.y + player.height / 2
                    this.bursts.push({ x: cx, y: cy, size: player.width * 0.6, color: 'rgba(255, 255, 255, 0.9)', at: timestamp })
                    if (id === localId) this.shakeUntil = Math.max(this.shakeUntil, timestamp + SHAKE_MS / 2)
                }
            }
            this.lastSeen.set(id, {
                alive,
                recovering: player.recovering,
                sliding: player.sliding,
                gems: player.gems,
                cx: player.x + player.width / 2,
                cy: player.y + player.height / 2,
            })
        })
        for (const id of this.lastSeen.keys()) {
            if (!seen.has(id)) this.lastSeen.delete(id)
        }
    }

    private drawGems(
        ctx: CanvasRenderingContext2D,
        state: SyncedGameState,
        left: number,
        right: number,
        top: number,
        bottom: number,
        timestamp: number
    ): void {
        const present = new Set<string>()
        const localId = this.multiplayerManager?.localSessionId
        const clock = this.worldNow(state, timestamp)
        state.gems?.forEach((gem: SyncedGem, id: string) => {
            present.add(id)
            let drawn = this.drawnGems.get(id)
            const flying = gem.launchAt > 0 ? clock - gem.launchAt : -1
            if (flying >= 0 && flying < launchDuration(gem.launchSpeed) * 1000) {
                // Fired out of a turbine: exactly on its path (the same for everyone), with a short trail and a puff as it leaves
                const at = (ms: number) => launchPosition(gem.launchX, gem.launchY, gem.launchAngle, gem.launchSpeed, Math.max(0, ms) / 1000, state.worldWidth, state.worldHeight)
                const here = at(flying)
                drawn = { x: here.x, y: here.y }
                this.drawnGems.set(id, drawn)
                if (flying < 260) drawLaunchPuff(ctx, gem.launchX, gem.launchY, gem.launchAngle, flying / 260)
                for (let back = 2; back >= 1; back--) {
                    const ghost = at(flying - back * 35)
                    ctx.globalAlpha = 0.25 / back
                    drawGem(ctx, ghost.x, ghost.y, GEMS.RADIUS * (1 - back * 0.15))
                }
                ctx.globalAlpha = 1
            } else if (!drawn || Math.hypot(gem.x - drawn.x, gem.y - drawn.y) > SNAP_DISTANCE) {
                drawn = { x: gem.x, y: gem.y }
                this.drawnGems.set(id, drawn)
            } else {
                drawn.x += (gem.x - drawn.x) * SMOOTHING
                drawn.y += (gem.y - drawn.y) * SMOOTHING
            }
            if (drawn.x < left || drawn.x > right || drawn.y < top || drawn.y > bottom) return
            if (gem.expiring && Math.floor(timestamp / 120) % 2) return // blinking before it vanishes
            const phase = Number(id.slice(1)) || 0
            const radius = (GEMS.RADIUS + Math.min(6, (gem.value - 1) * 1.2)) * (1 + 0.08 * Math.sin(timestamp / 180 + phase))
            if (gem.falling) {
                // Still dropping: a shadow that grows as it comes down
                const since = this.fallingSince.get(id) ?? timestamp
                this.fallingSince.set(id, since)
                const fall = Math.min(1, (timestamp - since) / SHIFT.DROP_MS)
                ctx.fillStyle = `rgba(0, 0, 0, ${0.15 + 0.3 * fall})`
                ctx.beginPath()
                ctx.ellipse(drawn.x, drawn.y + radius * 0.6, radius * (0.4 + 0.8 * fall), radius * (0.2 + 0.35 * fall), 0, 0, Math.PI * 2)
                ctx.fill()
                drawGem(ctx, drawn.x, drawn.y - (1 - fall) * 90, radius, gemColor(id))
                return
            }
            this.fallingSince.delete(id)
            if (gem.locked && gem.owner === localId) {
                // Your own spilled gem: faded until you can grab it back
                ctx.globalAlpha = 0.35
                drawGem(ctx, drawn.x, drawn.y, radius, gemColor(id))
                ctx.globalAlpha = 1
                return
            }
            drawGem(ctx, drawn.x, drawn.y, radius, gemColor(id))
        })
        for (const id of this.drawnGems.keys()) {
            if (!present.has(id)) this.drawnGems.delete(id)
        }
    }

    /** Whether anyone is stealing gems from this player right now */
    private beingRobbed(state: SyncedGameState, id: string): boolean {
        let robbed = false
        state.players.forEach((other: SyncedPlayer) => {
            if (String(other.robbing ?? '').split(',').includes(id)) robbed = true
        })
        return robbed
    }

    /**
     * The opening over the arena (see drawIntro), once per page load, with nothing else on screen
     * and the controls off; returns how visible the HUD should be (it fades in after)
     */
    private runIntro(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, timestamp: number): number {
        if (this.introStart === null) {
            if (introPlayed) return 1
            introPlayed = true
            this.introStart = timestamp
            this.introSparks = makeIntroSparks()
            document.body.classList.add('intro-playing')
            // The header just went away on phones: let the canvas take the whole screen
            window.dispatchEvent(new Event('resize'))
        }
        const t = timestamp - this.introStart
        if (t < INTRO.MS) {
            drawIntro(ctx, canvas, t, this.introSparks)
            return 0
        }
        if (this.introSparks.length) {
            this.introSparks = []
            document.body.classList.remove('intro-playing')
        }
        return Math.min(1, (t - INTRO.MS) / INTRO.HUD_FADE_MS)
    }

    /** Whether the opening is still playing (the controls are off until it's done) */
    private get introPlaying(): boolean {
        return this.introStart !== null && this.introSparks.length > 0
    }

    private trackKnockout(me: SyncedPlayer): void {
        if (me && me.state !== 'alive' && me.state !== 'gulped') {
            if (this.knockedOutAt === null) this.knockedOutAt = performance.now()
        } else {
            this.knockedOutAt = null
        }
    }

    postUpdate(): void {
        // The server decides hits; nothing to check here
    }

    reset(): void {
        // Nothing to reset: the world runs on the server
    }

    completeReset(): void {
        // Nothing to reset: the world runs on the server
    }

    dispose(): void {
        this.disposed = true
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this.multiplayerManager?.disconnect()
        this.multiplayerManager = null
        this.drawnPositions.clear()
        this.drawnGems.clear()
        this.controls?.dispose()
        this.controls = null
        document.body.classList.remove('online-mode')
        const inputManager = (this.game as any).inputManager
        if (inputManager) inputManager.swipesEnabled = true
        // Hand the header back to solo's scores
        this.game.uiManager?.updateScore(this.game.score)
        this.game.uiManager?.updateHighScore(this.game.highScore)
    }
}

// Default exports for backward compatibility
export { SinglePlayerMode as default }
