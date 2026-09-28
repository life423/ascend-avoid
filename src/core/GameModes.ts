/**
 * Consolidated game modes implementation using the Strategy Pattern.
 * This file contains the base GameMode class and all its implementations.
 */
import Player from '../entities/Player'
import { InputState } from '../types'
import { getSprite } from '../utils/sprites'
import { GameEvents } from '../constants/client-constants'
import { PLAYER_COLORS } from '../../server/constants/gameConstants'
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
/** Round phases, as the server sends them in state.gameState */
const PHASE = {
    WAITING: 'waiting',
    STARTING: 'starting',
    PLAYING: 'playing',
    GAME_OVER: 'game_over',
} as const

/** How much of the gap to the server position a drawn player closes each frame */
const SMOOTHING = 0.35
/** Jump straight to the server position when it's this far off (arena pixels), e.g. a new round */
const SNAP_DISTANCE = 120
/** Wait this long before trying the server again */
const RECONNECT_DELAY_MS = 3000
/** How long "Name joined" stays in the countdown */
const JOIN_NOTICE_MS = 8000
const FONT = 'Montserrat, system-ui, sans-serif'
const NO_KEYS: InputState = { up: false, down: false, left: false, right: false }

type ConnectionStatus = 'connecting' | 'connected' | 'reconnecting'

/**
 * Online: everyone on the site shares one room. While you're the only one there you play
 * the regular solo game; when someone else arrives the server counts down and a
 * last-one-standing match starts for everyone. During a match the server runs the game:
 * this mode sends the keys you hold and draws the server's state, scaled to the canvas.
 */
export class MultiplayerMode extends GameMode {
    private multiplayerManager: MultiplayerManager | null = null
    /** The solo game, played whenever nobody else is online */
    private solo: SinglePlayerMode
    private status: ConnectionStatus = 'connecting'
    private disposed = false
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null
    private lastSentInput: InputState = { ...NO_KEYS }
    /** Whether the match view (rather than solo play) is on screen; null before the first check */
    private showingMatch: boolean | null = null
    private lastJoin: { name: string; at: number } | null = null
    /** Where each player is drawn, eased toward the server position so movement looks smooth */
    private drawnPositions = new Map<string, { x: number; y: number }>()

    /** A hidden tab stops running the game loop, so let go of any held keys */
    private releaseKeysWhenHidden = (): void => {
        if (document.hidden) this.sendInput(NO_KEYS)
    }

    constructor(game: Game) {
        super(game)
        this.solo = new SinglePlayerMode(game)
    }

    async initialize(): Promise<void> {
        await super.initialize()
        this.game.isMultiplayerMode = true
        this.syncView() // a fresh solo run while we connect

        const [{ MultiplayerManager }, { EventBus }, { default: AssetManager }] = await Promise.all([
            import('../managers/MultiplayerManager'),
            import('./EventBus'),
            import('../managers/AssetManager'),
        ])
        const eventBus = new EventBus()
        this.multiplayerManager = new MultiplayerManager(eventBus, new AssetManager())
        eventBus.on(GameEvents.MULTIPLAYER_STATE_UPDATE, () => this.syncView())
        eventBus.on(GameEvents.PLAYER_JOINED, (data: any) => {
            if (data?.id && data.id !== this.multiplayerManager?.localSessionId) {
                this.lastJoin = { name: String(data.name ?? 'Someone'), at: Date.now() }
            }
        })
        eventBus.on(GameEvents.MULTIPLAYER_DISCONNECTED, () => this.reconnectSoon())
        document.addEventListener('visibilitychange', this.releaseKeysWhenHidden)

        // Connect in the background; solo play carries on meanwhile
        this.connect()
    }

    private async connect(): Promise<void> {
        if (!this.multiplayerManager || this.disposed) return
        const connected = await this.multiplayerManager.connect()
        if (this.disposed) return
        if (connected) {
            this.status = 'connected'
            this.syncView()
        } else if (!this.multiplayerManager.isConnected()) {
            this.reconnectSoon()
        }
    }

    private reconnectSoon(): void {
        if (this.disposed || this.reconnectTimer) return
        this.status = 'reconnecting'
        this.syncView()
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null
            this.connect()
        }, RECONNECT_DELAY_MS)
    }

    /** Match view whenever the server is running a round: countdown, play or results */
    private inMatch(): boolean {
        if (this.status !== 'connected') return false
        const phase = this.multiplayerManager?.getState()?.gameState
        return !!phase && phase !== PHASE.WAITING
    }

    /** Switch between solo play and the match view when the server's phase changes */
    private syncView(): void {
        const match = this.inMatch()
        if (match === this.showingMatch) return
        this.showingMatch = match
        if (match) {
            // A match is starting: put the solo run (and any game-over screen) away
            this.game.uiManager?.hideGameOver()
            this.game.gameState = this.game.config.STATE.PLAYING
            this.drawnPositions.clear()
            this.lastSentInput = { ...NO_KEYS }
        } else {
            // Nobody else here, or not connected yet: a fresh solo run
            this.solo.completeReset()
        }
    }

    update(inputState: InputState, deltaTime: number, timestamp: number): void {
        this.syncView()
        if (this.showingMatch) {
            this.sendInput(inputState)
        } else {
            this.solo.update(inputState, deltaTime, timestamp)
        }
    }

    /** The server moves everyone in a match; tell it which keys are held whenever that changes */
    private sendInput(input: InputState): void {
        if (this.status !== 'connected' || !this.multiplayerManager) return
        const last = this.lastSentInput
        if (input.up === last.up && input.down === last.down && input.left === last.left && input.right === last.right) {
            return
        }
        this.lastSentInput = { up: input.up, down: input.down, left: input.left, right: input.right }
        this.multiplayerManager.sendInput(this.lastSentInput)
    }

    /** During a match this mode draws everything; during solo play Game draws the usual scene */
    drawsOwnScene(): boolean {
        return this.showingMatch === true
    }

    render(timestamp: number): void {
        const { ctx, canvas } = this.game
        const state = this.multiplayerManager?.getState()
        if (!ctx || !canvas || !state || !state.arenaWidth) return

        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        // Draw the arena in its own units (600×700), scaled to fit and centered
        const scale = Math.min(canvas.width / state.arenaWidth, canvas.height / state.arenaHeight)
        ctx.translate(
            (canvas.width - state.arenaWidth * scale) / 2,
            (canvas.height - state.arenaHeight * scale) / 2
        )
        ctx.scale(scale, scale)
        this.drawSafeArea(ctx, state)
        state.obstacles.forEach((obstacle: any) => {
            ctx.drawImage(
                getSprite('obstacle', obstacle.variant, timestamp),
                obstacle.x,
                obstacle.y,
                obstacle.width,
                obstacle.height
            )
        })
        const localId = this.multiplayerManager?.localSessionId ?? null
        const present = new Set<string>()
        state.players.forEach((player: any, sessionId: string) => {
            present.add(sessionId)
            this.drawPlayer(ctx, player, sessionId, sessionId === localId, timestamp)
        })
        for (const id of this.drawnPositions.keys()) {
            if (!present.has(id)) this.drawnPositions.delete(id)
        }

        // Screen-space overlays
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.drawHud(ctx, canvas, state)
        this.drawPhase(ctx, canvas, state, localId)
        ctx.restore()
    }

    /** Solo play: a small line at the top saying you're online and others can join */
    renderOverlay(_timestamp: number): void {
        const { ctx, canvas } = this.game
        if (!ctx || !canvas) return
        const text =
            this.status === 'connected'
                ? 'Online · others can jump in'
                : this.status === 'reconnecting'
                  ? 'Offline · reconnecting…'
                  : 'Connecting…'
        const size = Math.max(11, Math.round(canvas.height * 0.022))
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.font = `600 ${size}px ${FONT}`
        const padding = size * 0.8
        const dotRadius = size * 0.3
        const height = Math.round(size * 1.8)
        const width = ctx.measureText(text).width + padding * 2 + dotRadius * 2 + size * 0.5
        const x = (canvas.width - width) / 2
        const y = 6
        ctx.fillStyle = 'rgba(5, 12, 24, 0.6)'
        ctx.beginPath()
        if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, height / 2)
        else ctx.rect(x, y, width, height)
        ctx.fill()
        ctx.fillStyle = this.status === 'connected' ? '#4ade80' : '#fbbf24'
        ctx.beginPath()
        ctx.arc(x + padding + dotRadius, y + height / 2, dotRadius, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.88)'
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, x + padding + dotRadius * 2 + size * 0.5, y + height / 2)
        ctx.restore()
    }

    private drawPlayer(
        ctx: CanvasRenderingContext2D,
        player: any,
        sessionId: string,
        isLocal: boolean,
        timestamp: number
    ): void {
        if (player.state === 'spectating') return

        // Ease toward the server position so ~20 updates a second still look smooth at 60 fps
        let drawn = this.drawnPositions.get(sessionId)
        if (!drawn || Math.hypot(player.x - drawn.x, player.y - drawn.y) > SNAP_DISTANCE) {
            drawn = { x: player.x, y: player.y }
            this.drawnPositions.set(sessionId, drawn)
        } else {
            drawn.x += (player.x - drawn.x) * SMOOTHING
            drawn.y += (player.y - drawn.y) * SMOOTHING
        }

        ctx.save()
        if (player.state !== 'alive') ctx.globalAlpha = 0.3
        if (isLocal) {
            ctx.drawImage(getSprite('player', 0, timestamp), drawn.x, drawn.y, player.width, player.height)
        } else {
            ctx.fillStyle = PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
            ctx.beginPath()
            if (typeof ctx.roundRect === 'function') {
                ctx.roundRect(drawn.x, drawn.y, player.width, player.height, 6)
            } else {
                ctx.rect(drawn.x, drawn.y, player.width, player.height)
            }
            ctx.fill()
        }
        ctx.font = `600 13px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = isLocal ? '#ffffff' : '#cfd8dc'
        ctx.fillText(isLocal ? 'You' : player.name, drawn.x + player.width / 2, drawn.y - 4)
        ctx.restore()
    }

    /** Shade what's outside the safe area and outline it (the server's GameState.safeArea) */
    private drawSafeArea(ctx: CanvasRenderingContext2D, state: any): void {
        if (state.areaPercentage >= 100) return
        const scale = state.areaPercentage / 100
        const width = state.arenaWidth * scale
        const height = state.arenaHeight * scale
        const left = (state.arenaWidth - width) / 2
        const top = (state.arenaHeight - height) / 2
        ctx.save()
        ctx.fillStyle = 'rgba(255, 82, 82, 0.12)'
        ctx.beginPath()
        ctx.rect(0, 0, state.arenaWidth, state.arenaHeight)
        ctx.rect(left, top, width, height)
        ctx.fill('evenodd')
        ctx.strokeStyle = 'rgba(255, 82, 82, 0.85)'
        ctx.lineWidth = 3
        ctx.setLineDash([12, 8])
        ctx.strokeRect(left, top, width, height)
        ctx.restore()
    }

    private drawHud(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: any): void {
        if (state.gameState !== PHASE.PLAYING) return
        let inRound = 0
        state.players.forEach((player: any) => {
            if (player.state !== 'spectating') inRound++
        })
        ctx.font = `600 ${Math.max(12, Math.round(canvas.height * 0.028))}px ${FONT}`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.fillText(`${state.aliveCount} of ${inRound} still in`, canvas.width - 10, 10)
    }

    private drawPhase(
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        state: any,
        localId: string | null
    ): void {
        const me = localId ? state.players.get(localId) : undefined
        switch (state.gameState) {
            case PHASE.STARTING: {
                const joined =
                    this.lastJoin && Date.now() - this.lastJoin.at < JOIN_NOTICE_MS ? this.lastJoin.name : null
                this.drawMessage(
                    ctx,
                    canvas,
                    String(state.countdownTime || ''),
                    joined ? `${joined} joined · get ready` : `${state.players.size} players · get ready`,
                    true
                )
                break
            }
            case PHASE.GAME_OVER: {
                const youWon = me?.state === 'alive' && state.winnerName !== 'No one'
                const next =
                    state.players.size >= 2 ? `Next round in ${state.countdownTime}` : `Back to solo in ${state.countdownTime}`
                this.drawMessage(
                    ctx,
                    canvas,
                    youWon ? 'You win!' : state.winnerName === 'No one' ? 'No winner' : `${state.winnerName} wins`,
                    next
                )
                break
            }
            case PHASE.PLAYING:
                if (me?.state === 'dead') this.drawBanner(ctx, canvas, "You're out. Watching until the next round")
                else if (me?.state === 'spectating') this.drawBanner(ctx, canvas, 'Round in progress. You join the next one')
                break
        }
    }

    /** Dim the arena and show a centered title and subtitle */
    private drawMessage(
        ctx: CanvasRenderingContext2D,
        canvas: HTMLCanvasElement,
        title: string,
        subtitle: string,
        bigTitle = false
    ): void {
        ctx.save()
        ctx.fillStyle = 'rgba(5, 12, 24, 0.55)'
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = '#4fd1c5'
        ctx.font = `700 ${Math.round(canvas.height * (bigTitle ? 0.16 : 0.055))}px ${FONT}`
        ctx.fillText(title, canvas.width / 2, canvas.height * 0.45, canvas.width * 0.9)
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.font = `500 ${Math.max(12, Math.round(canvas.height * 0.03))}px ${FONT}`
        ctx.fillText(subtitle, canvas.width / 2, canvas.height * (bigTitle ? 0.58 : 0.53), canvas.width * 0.9)
        ctx.restore()
    }

    /** A strip along the bottom of the canvas */
    private drawBanner(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, text: string): void {
        const height = Math.round(canvas.height * 0.07)
        ctx.save()
        ctx.fillStyle = 'rgba(5, 12, 24, 0.75)'
        ctx.fillRect(0, canvas.height - height, canvas.width, height)
        ctx.fillStyle = '#ffffff'
        ctx.font = `600 ${Math.round(height * 0.4)}px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, canvas.width / 2, canvas.height - height / 2, canvas.width * 0.92)
        ctx.restore()
    }

    postUpdate(): void {
        // Solo scoring runs between matches; in a match the server decides everything
        if (!this.showingMatch) this.solo.postUpdate()
    }

    reset(): void {
        if (!this.showingMatch) this.solo.reset()
    }

    completeReset(): void {
        if (!this.showingMatch) this.solo.completeReset()
    }

    dispose(): void {
        this.disposed = true
        document.removeEventListener('visibilitychange', this.releaseKeysWhenHidden)
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer)
        this.reconnectTimer = null
        this.multiplayerManager?.disconnect()
        this.multiplayerManager = null
        this.drawnPositions.clear()
    }
}

// Default exports for backward compatibility
export { SinglePlayerMode as default }
