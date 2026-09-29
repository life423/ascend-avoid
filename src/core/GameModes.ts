/**
 * Consolidated game modes implementation using the Strategy Pattern.
 * This file contains the base GameMode class and all its implementations.
 */
import Player from '../entities/Player'
import { InputState } from '../types'
import { getSprite } from '../utils/sprites'
import { GameEvents } from '../constants/client-constants'
import { ARENA_RULES, GEMS, PLAYER_COLORS, WORLD } from '../../server/constants/gameConstants'
import { hop, hopsThisFrame, newHopTimers, newPresses } from '../../server/game/movement'
import type { HopTimers } from '../../server/game/movement'
import type { MultiplayerManager } from '../managers/MultiplayerManager'

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

/**
 * Implementation of multiplayer game mode.
 */
/** How much of the gap to the server position another player's drawing closes each frame */
const SMOOTHING = 0.35
/** Jump straight to the server position when it's this far off (world units), e.g. a respawn */
const SNAP_DISTANCE = 150
/** Wait this long before trying the server again */
const RECONNECT_DELAY_MS = 3000
/** How long "Name joined" stays up */
const JOIN_NOTICE_MS = 3000
/** How quickly the camera catches up with you (share of the distance per 60 fps frame) */
const CAMERA_EASE = 0.2
/** Grid spacing on the arena floor (world units) */
const GRID = 100
const FONT = 'Montserrat, system-ui, sans-serif'
const NO_KEYS: InputState = { up: false, down: false, left: false, right: false }
/** Your drawn position jumps to the server's when they're this far apart (a respawn) */
const PREDICTION_SNAP = 150
/** Once you've stopped hopping this long, your drawn position settles onto the server's */
const SETTLE_AFTER_MS = 300
/** How long a hit's burst ring lasts */
const BURST_MS = 500
/** How long the screen shakes when you're hit */
const SHAKE_MS = 300
/** How long "+1" floats above you after grabbing gems */
const PICKUP_TEXT_MS = 800
const GOLD = '#ffd166'

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting'

/** The part of the world on screen: its center, size (world units) and scale (pixels per unit) */
interface View {
    x: number
    y: number
    width: number
    height: number
    scale: number
}

/** A rounded rectangle path, or a plain one where roundRect isn't supported */
function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
    ctx.beginPath()
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, radius)
    else ctx.rect(x, y, width, height)
}

/** A gold gem: a faceted diamond with a soft glow */
function drawGem(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.fillStyle = 'rgba(255, 209, 102, 0.18)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.9, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.78, y)
    ctx.lineTo(x, y + radius)
    ctx.lineTo(x - radius * 0.78, y)
    ctx.closePath()
    ctx.fillStyle = GOLD
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.78, y)
    ctx.lineTo(x, y)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.fill()
}

/** The leader's crown, standing on (centerX, bottom) */
function drawCrown(ctx: CanvasRenderingContext2D, centerX: number, bottom: number, width: number): void {
    const height = width * 0.7
    ctx.beginPath()
    ctx.moveTo(centerX - width / 2, bottom)
    ctx.lineTo(centerX - width / 2, bottom - height * 0.55)
    ctx.lineTo(centerX - width / 4, bottom - height * 0.25)
    ctx.lineTo(centerX, bottom - height)
    ctx.lineTo(centerX + width / 4, bottom - height * 0.25)
    ctx.lineTo(centerX + width / 2, bottom - height * 0.55)
    ctx.lineTo(centerX + width / 2, bottom)
    ctx.closePath()
    ctx.fillStyle = GOLD
    ctx.fill()
    ctx.strokeStyle = 'rgba(120, 80, 0, 0.8)'
    ctx.lineWidth = Math.max(1, width * 0.06)
    ctx.stroke()
}

/**
 * Online: one big open arena shared by everyone on the site. The server runs the world; this
 * mode hops your player the moment you press (telling the server about each hop) and draws the
 * part of the world around you, with a camera that follows you: gems, traffic, players, the
 * bursts when someone is hit, a leaderboard and a minimap.
 */
export class MultiplayerMode extends GameMode {
    private multiplayerManager: MultiplayerManager | null = null
    private status: ConnectionStatus = 'connecting'
    private disposed = false
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    /** Where each other player is drawn, eased toward the server position */
    private drawnPositions = new Map<string, { x: number; y: number }>()
    /** Your own position, hopped on your screen right away */
    private predicted: { x: number; y: number } | null = null
    private previousKeys: InputState = { ...NO_KEYS }
    private hopTimers: HopTimers = newHopTimers()
    private lastHopAt = 0
    /** The world point at the center of the screen */
    private camera: { x: number; y: number } | null = null
    private lastRenderAt = 0
    /** When your player was knocked out, for the "back in" countdown */
    private knockedOutAt: number | null = null
    private lastJoin: { name: string; at: number } | null = null
    /** Where each gem is drawn, eased toward the server position as sprayed gems slide */
    private drawnGems = new Map<string, { x: number; y: number }>()
    /** Each player as of the last frame, to spot hits and pickups */
    private lastSeen = new Map<string, { alive: boolean; recovering: boolean; gems: number; cx: number; cy: number }>()
    private bursts: { x: number; y: number; size: number; color: string; at: number }[] = []
    private pickups: { amount: number; at: number }[] = []
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
                this.lastJoin = { name: String(data.name ?? 'Someone'), at: performance.now() }
            }
        })
        eventBus.on(GameEvents.MULTIPLAYER_DISCONNECTED, () => this.reconnectSoon())

        // Connect in the background; the canvas says so meanwhile
        this.connect()
    }

    private async connect(): Promise<void> {
        if (!this.multiplayerManager || this.disposed) return
        const connected = await this.multiplayerManager.connect()
        if (this.disposed) return
        if (connected) {
            this.status = 'connected'
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

    update(inputState: InputState, deltaTime: number, _timestamp: number): void {
        this.moveLocalPlayer(inputState, deltaTime)
        this.showGems()
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
    private moveLocalPlayer(input: InputState, deltaTime: number): void {
        const presses = newPresses(this.previousKeys, input)
        this.previousKeys = { up: input.up, down: input.down, left: input.left, right: input.right }

        const state = this.worldState()
        const localId = this.multiplayerManager?.localSessionId
        const me = state && localId ? state.players.get(localId) : undefined
        if (!state || !me) {
            this.predicted = null
            return
        }
        if (me.state !== 'alive') {
            this.predicted = { x: me.x, y: me.y }
            this.hopTimers = newHopTimers()
            return
        }
        if (!this.predicted) this.predicted = { x: me.x, y: me.y }

        // Bigger players keep a slower rhythm when holding a direction
        const repeat = ARENA_RULES.HOP_REPEAT * (me.width / ARENA_RULES.PLAYER_SIZE)
        const hops = hopsThisFrame(input, presses, this.hopTimers, deltaTime, repeat)
        if (hops.length > 0) {
            const box = { x: this.predicted.x, y: this.predicted.y, width: me.width, height: me.height }
            for (const direction of hops) {
                hop(box, direction, state.worldWidth, state.worldHeight)
                this.multiplayerManager?.sendMessage('hop', { direction })
            }
            this.predicted = { x: box.x, y: box.y }
            this.lastHopAt = performance.now()
        }

        const dx = me.x - this.predicted.x
        const dy = me.y - this.predicted.y
        if (Math.hypot(dx, dy) > PREDICTION_SNAP) {
            this.predicted = { x: me.x, y: me.y }
        } else if (performance.now() - this.lastHopAt > SETTLE_AFTER_MS) {
            this.predicted = { x: this.predicted.x + dx * 0.25, y: this.predicted.y + dy * 0.25 }
        }
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
            this.drawMessage(ctx, canvas, this.status === 'reconnecting' ? 'Reconnecting…' : 'Connecting…', 'Joining the arena')
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
        const leaderId = this.leaderId(state)

        ctx.save()
        ctx.setTransform(
            view.scale, 0, 0, view.scale,
            canvas.width / 2 - view.x * view.scale,
            canvas.height / 2 - view.y * view.scale
        )
        this.drawFloor(ctx, state, view)
        const margin = 120
        const left = view.x - view.width / 2 - margin
        const right = view.x + view.width / 2 + margin
        const top = view.y - view.height / 2 - margin
        const bottom = view.y + view.height / 2 + margin
        this.drawGems(ctx, state, left, right, top, bottom, timestamp)
        state.obstacles.forEach((obstacle: any) => {
            if (obstacle.x > right || obstacle.x + obstacle.width < left || obstacle.y > bottom || obstacle.y + obstacle.height < top) return
            this.drawObstacle(ctx, obstacle, timestamp)
        })
        const present = new Set<string>()
        state.players.forEach((player: any, sessionId: string) => {
            present.add(sessionId)
            this.drawPlayer(ctx, player, sessionId, sessionId === localId, sessionId === leaderId, timestamp)
        })
        for (const id of this.drawnPositions.keys()) {
            if (!present.has(id)) this.drawnPositions.delete(id)
        }

        this.drawBursts(ctx, timestamp)
        this.drawPickups(ctx, me, timestamp)

        // Screen-space overlays
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.drawMinimap(ctx, canvas, state, view, localId, leaderId)
        this.drawLeaderboard(ctx, canvas, state, localId, leaderId)
        this.drawJoinNotice(ctx, canvas)
        if (me && me.state !== 'alive') this.drawKnockedOut(ctx, canvas)
        ctx.restore()
    }

    /**
     * Follow your player. Every screen sees the same amount of world (WORLD.VIEW_AREA), shaped
     * to the screen within the aspect limits; a screen outside them sees less, never more.
     */
    private updateCamera(canvas: HTMLCanvasElement, state: any, me: any, timestamp: number): View {
        const aspect = Math.min(WORLD.MAX_VIEW_ASPECT, Math.max(WORLD.MIN_VIEW_ASPECT, canvas.width / canvas.height))
        const scale = Math.max(
            canvas.width / Math.sqrt(WORLD.VIEW_AREA * aspect),
            canvas.height / Math.sqrt(WORLD.VIEW_AREA / aspect)
        )
        const width = canvas.width / scale
        const height = canvas.height / scale

        let focus = this.camera ?? { x: state.worldWidth / 2, y: state.worldHeight / 2 }
        if (me && me.state === 'alive') {
            const position = this.predicted ?? me
            focus = { x: position.x + me.width / 2, y: position.y + me.height / 2 }
        }
        if (!this.camera || Math.hypot(focus.x - this.camera.x, focus.y - this.camera.y) > Math.max(width, height)) {
            // First frame, or a respawn far away: jump there
            this.camera = { x: focus.x, y: focus.y }
        } else {
            const frames = this.lastRenderAt ? Math.min(4, (timestamp - this.lastRenderAt) / (1000 / 60)) : 1
            const ease = 1 - Math.pow(1 - CAMERA_EASE, Math.max(0, frames))
            this.camera.x += (focus.x - this.camera.x) * ease
            this.camera.y += (focus.y - this.camera.y) * ease
        }
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

    /** The arena floor: a faint grid, and the wall around the world */
    private drawFloor(ctx: CanvasRenderingContext2D, state: any, view: View): void {
        const left = Math.max(0, view.x - view.width / 2)
        const right = Math.min(state.worldWidth, view.x + view.width / 2)
        const top = Math.max(0, view.y - view.height / 2)
        const bottom = Math.min(state.worldHeight, view.y + view.height / 2)
        ctx.save()
        ctx.strokeStyle = 'rgba(79, 209, 197, 0.09)'
        ctx.lineWidth = 1 / view.scale
        ctx.beginPath()
        for (let x = Math.ceil(left / GRID) * GRID; x <= right; x += GRID) {
            ctx.moveTo(x, top)
            ctx.lineTo(x, bottom)
        }
        for (let y = Math.ceil(top / GRID) * GRID; y <= bottom; y += GRID) {
            ctx.moveTo(left, y)
            ctx.lineTo(right, y)
        }
        ctx.stroke()
        ctx.strokeStyle = 'rgba(79, 209, 197, 0.75)'
        ctx.lineWidth = 6
        ctx.strokeRect(0, 0, state.worldWidth, state.worldHeight)
        ctx.restore()
    }

    /** Obstacles use the solo sprites; vertical ones are drawn turned on their side */
    private drawObstacle(ctx: CanvasRenderingContext2D, obstacle: any, timestamp: number): void {
        const sprite = getSprite('obstacle', obstacle.variant, timestamp)
        if (obstacle.height <= obstacle.width) {
            ctx.drawImage(sprite, obstacle.x, obstacle.y, obstacle.width, obstacle.height)
            return
        }
        ctx.save()
        ctx.translate(obstacle.x + obstacle.width / 2, obstacle.y + obstacle.height / 2)
        ctx.rotate(Math.PI / 2)
        ctx.drawImage(sprite, -obstacle.height / 2, -obstacle.width / 2, obstacle.height, obstacle.width)
        ctx.restore()
    }

    private drawPlayer(
        ctx: CanvasRenderingContext2D,
        player: any,
        sessionId: string,
        isLocal: boolean,
        isLeader: boolean,
        timestamp: number
    ): void {
        if (player.state !== 'alive') return // knocked out: gone until they're back

        // Your own player is drawn where your hops put it; other players ease toward the
        // server position so ~20 updates a second still look smooth at 60 fps
        let drawn = this.drawnPositions.get(sessionId)
        if (isLocal && this.predicted) {
            drawn = { x: this.predicted.x, y: this.predicted.y }
            this.drawnPositions.set(sessionId, drawn)
        } else if (!drawn || Math.hypot(player.x - drawn.x, player.y - drawn.y) > SNAP_DISTANCE) {
            drawn = { x: player.x, y: player.y }
            this.drawnPositions.set(sessionId, drawn)
        } else {
            drawn.x += (player.x - drawn.x) * SMOOTHING
            drawn.y += (player.y - drawn.y) * SMOOTHING
        }

        ctx.save()
        if (player.spawnProtected) {
            // Just back in: translucent inside a soft bubble until the protection wears off
            ctx.globalAlpha = 0.45 + 0.15 * Math.sin(timestamp / 90)
            ctx.strokeStyle = 'rgba(160, 235, 255, 0.95)'
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(drawn.x + player.width / 2, drawn.y + player.height / 2, player.width * 0.85, 0, Math.PI * 2)
            ctx.stroke()
        }
        if (player.recovering) {
            // Just hit: blink until traffic can touch you again
            ctx.globalAlpha = Math.floor(timestamp / 90) % 2 ? 0.25 : 0.9
        }
        if (isLocal) {
            ctx.drawImage(getSprite('player', 0, timestamp), drawn.x, drawn.y, player.width, player.height)
        } else {
            ctx.fillStyle = PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
            roundedRect(ctx, drawn.x, drawn.y, player.width, player.height, 8)
            ctx.fill()
        }
        ctx.globalAlpha = 1
        ctx.font = `600 16px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = isLocal ? '#ffffff' : '#cfd8dc'
        ctx.fillText(isLocal ? 'You' : player.name, drawn.x + player.width / 2, drawn.y - 6)
        if (isLeader) drawCrown(ctx, drawn.x + player.width / 2, drawn.y - 26, 22)
        ctx.restore()
    }

    /** The whole world in a corner: everyone in it, and the part your screen shows */
    private drawMinimap(
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        state: any,
        view: View,
        localId: string | null,
        leaderId: string | null
    ): void {
        const size = Math.round(Math.min(150, Math.max(84, Math.min(canvas.width, canvas.height) * 0.24)))
        const scale = size / Math.max(state.worldWidth, state.worldHeight)
        const width = state.worldWidth * scale
        const height = state.worldHeight * scale
        const x = canvas.width - width - 12
        const y = canvas.height - height - 12
        ctx.save()
        ctx.fillStyle = 'rgba(5, 12, 24, 0.72)'
        roundedRect(ctx, x - 4, y - 4, width + 8, height + 8, 6)
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(79, 209, 197, 0.55)'
        ctx.strokeRect(x, y, width, height)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
        ctx.strokeRect(
            x + (view.x - view.width / 2) * scale,
            y + (view.y - view.height / 2) * scale,
            view.width * scale,
            view.height * scale
        )
        let playing = 0
        state.players.forEach((player: any, sessionId: string) => {
            playing++
            if (player.state !== 'alive') return
            const isLocal = sessionId === localId
            const position = isLocal && this.predicted ? this.predicted : player
            ctx.fillStyle = isLocal ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
            ctx.beginPath()
            ctx.arc(
                x + (position.x + player.width / 2) * scale,
                y + (position.y + player.height / 2) * scale,
                isLocal ? 3.5 : 2.5,
                0,
                Math.PI * 2
            )
            ctx.fill()
            if (sessionId === leaderId) {
                drawCrown(ctx, x + (position.x + player.width / 2) * scale, y + (position.y + player.height / 2) * scale - 4, 10)
            }
        })
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.font = `600 11px ${FONT}`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${playing} playing`, x + width, y - 8)
        ctx.restore()
    }

    /** Whoever has the most gems (nobody, until someone has one) */
    private leaderId(state: any): string | null {
        let leader: string | null = null
        let most = 0
        state.players.forEach((player: any, id: string) => {
            if (player.state === 'alive' && player.gems > most) {
                most = player.gems
                leader = id
            }
        })
        return leader
    }

    /** Spot hits and pickups by comparing each player with the last frame */
    private trackEvents(state: any, localId: string | null, timestamp: number): void {
        const seen = new Set<string>()
        state.players.forEach((player: any, id: string) => {
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
                    this.pickups.push({ amount: player.gems - before.gems, at: timestamp })
                }
            }
            this.lastSeen.set(id, {
                alive,
                recovering: player.recovering,
                gems: player.gems,
                cx: player.x + player.width / 2,
                cy: player.y + player.height / 2,
            })
        })
        for (const id of this.lastSeen.keys()) {
            if (!seen.has(id)) this.lastSeen.delete(id)
        }
    }

    /** Gems lying around, and sprayed ones sliding to a stop (eased, like other players) */
    private drawGems(
        ctx: CanvasRenderingContext2D,
        state: any,
        left: number,
        right: number,
        top: number,
        bottom: number,
        timestamp: number
    ): void {
        const present = new Set<string>()
        state.gems?.forEach((gem: any, id: string) => {
            present.add(id)
            let drawn = this.drawnGems.get(id)
            if (!drawn || Math.hypot(gem.x - drawn.x, gem.y - drawn.y) > SNAP_DISTANCE) {
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
            drawGem(ctx, drawn.x, drawn.y, radius)
        })
        for (const id of this.drawnGems.keys()) {
            if (!present.has(id)) this.drawnGems.delete(id)
        }
    }

    /** Rings bursting out where someone was hit (gold) or knocked out (red) */
    private drawBursts(ctx: CanvasRenderingContext2D, timestamp: number): void {
        this.bursts = this.bursts.filter((burst) => timestamp - burst.at < BURST_MS)
        for (const burst of this.bursts) {
            const t = (timestamp - burst.at) / BURST_MS
            ctx.save()
            ctx.globalAlpha = 1 - t
            ctx.strokeStyle = burst.color
            ctx.lineWidth = 2 + 6 * (1 - t)
            ctx.beginPath()
            ctx.arc(burst.x, burst.y, burst.size * (0.6 + 2.2 * t), 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
        }
    }

    /** "+1" rising above you when you grab gems */
    private drawPickups(ctx: CanvasRenderingContext2D, me: any, timestamp: number): void {
        this.pickups = this.pickups.filter((pickup) => timestamp - pickup.at < PICKUP_TEXT_MS)
        if (!me || this.pickups.length === 0) return
        const position = this.predicted ?? me
        ctx.save()
        ctx.font = `700 18px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = GOLD
        for (const pickup of this.pickups) {
            const t = (timestamp - pickup.at) / PICKUP_TEXT_MS
            ctx.globalAlpha = 1 - t
            ctx.fillText(`+${pickup.amount}`, position.x + me.width / 2, position.y - 30 - t * 34)
        }
        ctx.restore()
    }

    /** The top five by gems, top left, with you added below if you're further down */
    private drawLeaderboard(
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        state: any,
        localId: string | null,
        leaderId: string | null
    ): void {
        const ranked: { id: string; name: string; gems: number }[] = []
        state.players.forEach((player: any, id: string) => {
            ranked.push({ id, name: id === localId ? 'You' : String(player.name), gems: player.gems })
        })
        ranked.sort((a, b) => b.gems - a.gems)
        const rows = ranked.slice(0, 5).map((entry, index) => ({ ...entry, rank: index + 1 }))
        const mine = ranked.findIndex((entry) => entry.id === localId)
        if (mine >= 5) rows.push({ ...ranked[mine], rank: mine + 1 })

        const width = Math.round(Math.min(170, Math.max(120, canvas.width * 0.3)))
        const rowHeight = 18
        const x = 12
        const y = 12
        ctx.save()
        ctx.fillStyle = 'rgba(5, 12, 24, 0.72)'
        roundedRect(ctx, x, y, width, rows.length * rowHeight + 10, 6)
        ctx.fill()
        ctx.font = `600 12px ${FONT}`
        ctx.textBaseline = 'middle'
        rows.forEach((row, index) => {
            const rowY = y + 5 + rowHeight * index + rowHeight / 2
            const isLocal = row.id === localId
            if (row.id === leaderId) {
                drawCrown(ctx, x + 14, rowY + 5, 13)
            } else {
                ctx.fillStyle = 'rgba(207, 216, 220, 0.7)'
                ctx.textAlign = 'center'
                ctx.fillText(String(row.rank), x + 14, rowY)
            }
            ctx.fillStyle = isLocal ? '#ffffff' : 'rgba(207, 216, 220, 0.9)'
            ctx.textAlign = 'left'
            ctx.fillText(row.name, x + 28, rowY, width - 70)
            ctx.fillStyle = GOLD
            ctx.textAlign = 'right'
            ctx.fillText(String(row.gems), x + width - 10, rowY)
        })
        ctx.restore()
    }

    /** "Name joined", briefly, at the top right of the screen */
    private drawJoinNotice(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        if (!this.lastJoin) return
        const age = performance.now() - this.lastJoin.at
        if (age > JOIN_NOTICE_MS) {
            this.lastJoin = null
            return
        }
        const text = `${this.lastJoin.name} joined`
        ctx.save()
        ctx.globalAlpha = Math.min(1, (JOIN_NOTICE_MS - age) / 500)
        ctx.font = `600 13px ${FONT}`
        const width = ctx.measureText(text).width + 28
        ctx.fillStyle = 'rgba(5, 12, 24, 0.75)'
        roundedRect(ctx, canvas.width - width - 12, 12, width, 26, 13)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, canvas.width - width / 2 - 12, 25)
        ctx.restore()
    }

    private trackKnockout(me: any): void {
        if (me && me.state !== 'alive') {
            if (this.knockedOutAt === null) this.knockedOutAt = performance.now()
        } else {
            this.knockedOutAt = null
        }
    }

    private drawKnockedOut(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        const elapsed = this.knockedOutAt === null ? 0 : performance.now() - this.knockedOutAt
        const seconds = Math.ceil((WORLD.RESPAWN_DELAY_MS - elapsed) / 1000)
        this.drawMessage(ctx, canvas, 'Hit!', seconds > 0 ? `Back in ${seconds}` : 'Back in a moment')
    }

    /** Dim the screen and show a centered title and subtitle */
    private drawMessage(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, title: string, subtitle: string): void {
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = 'rgba(5, 12, 24, 0.55)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#4fd1c5'
        ctx.font = `700 ${Math.round(Math.min(canvas.height * 0.09, canvas.width * 0.1))}px ${FONT}`
        ctx.fillText(title, canvas.width / 2, canvas.height * 0.45, canvas.width * 0.9)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.font = `500 ${Math.max(13, Math.round(canvas.height * 0.03))}px ${FONT}`
        ctx.fillText(subtitle, canvas.width / 2, canvas.height * 0.55, canvas.width * 0.9)
        ctx.restore()
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
        // Hand the header back to solo's scores
        this.game.uiManager?.updateScore(this.game.score)
        this.game.uiManager?.updateHighScore(this.game.highScore)
    }
}

// Default exports for backward compatibility
export { SinglePlayerMode as default }
