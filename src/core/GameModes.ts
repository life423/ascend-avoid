/**
 * Consolidated game modes implementation using the Strategy Pattern.
 * This file contains the base GameMode class and all its implementations.
 */
import Player from '../entities/Player'
import { InputState } from '../types'
import { getSprite } from '../utils/sprites'
import { GameEvents } from '../constants/client-constants'
import { ARENA_RULES, BOMBS, GEMS, INHALE, PLAYER_COLORS, SHIFT, TURBINE, WORLD } from '../../server/constants/gameConstants'
import { turnRate, turnToward, walk } from '../../server/game/movement'
import { exhaustAngle, launchDuration, launchPosition } from '../../server/game/turbine'
import { OnlineControls } from './OnlineControls'
import type { Breath } from './OnlineControls'
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
/** How long a notice (someone joined, a shove, the jackpot) stays up */
const JOIN_NOTICE_MS = 3500
/** How quickly the camera catches up with you (share of the distance per 60 fps frame) */
const CAMERA_EASE = 0.2
/** Grid spacing on the arena floor (world units) */
const GRID = 100
const FONT = 'Montserrat, system-ui, sans-serif'
/** Your drawn position jumps to the server's when they're this far apart (a respawn) */
const PREDICTION_SNAP = 150
/** How long a hit's burst ring lasts */
const BURST_MS = 500
/** How long the screen shakes when you're hit */
const SHAKE_MS = 300
/** How long "+1" floats above you after grabbing gems */
const PICKUP_TEXT_MS = 800
/** Traffic is drawn at most this far ahead (seconds), in case updates stall */
const MAX_TRAFFIC_LEAD = 0.4
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
/** A wedge from (x, y): `reach` long, `arc` radians either side of `angle` */
function wedge(ctx: CanvasRenderingContext2D, x: number, y: number, reach: number, angle: number, arc: number): void {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.arc(x, y, reach, angle - arc, angle + arc)
    ctx.closePath()
}

/** A turbine about to switch on: a pulsing ring filling up, a warning sign, and a hint of where the intake will pull */
function drawTurbineWarning(ctx: CanvasRenderingContext2D, x: number, y: number, intake: number, progress: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    const pulse = 0.5 + 0.5 * Math.sin(timestamp / 120)
    ctx.save()
    ctx.fillStyle = `rgba(255, 209, 102, ${0.06 + 0.1 * progress})`
    wedge(ctx, x + Math.cos(intake) * r, y + Math.sin(intake) * r, TURBINE.INTAKE_REACH * progress, intake, TURBINE.INTAKE_ARC)
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.35 + 0.45 * pulse})`
    ctx.lineWidth = 3
    ctx.setLineDash([10, 8])
    ctx.lineDashOffset = -timestamp / 30
    ctx.beginPath()
    ctx.arc(x, y, r + 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.9)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(x, y, r - 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 209, 102, 0.95)'
    ctx.font = `800 ${Math.round(r * 0.9)}px Montserrat, system-ui, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('!', x, y + 2)
    ctx.restore()
}

/** The intake's suction: a cone strongest near the mouth, its inner zone tinted red, and streaks rushing in */
function drawIntakeWind(ctx: CanvasRenderingContext2D, x: number, y: number, intake: number, power: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    const mx = x + Math.cos(intake) * r
    const my = y + Math.sin(intake) * r
    ctx.save()
    const glow = ctx.createRadialGradient(mx, my, 0, mx, my, TURBINE.INTAKE_REACH)
    glow.addColorStop(0, `rgba(120, 200, 255, ${0.32 * power})`)
    glow.addColorStop(1, 'rgba(120, 200, 255, 0)')
    ctx.fillStyle = glow
    wedge(ctx, mx, my, TURBINE.INTAKE_REACH, intake, TURBINE.INTAKE_ARC)
    ctx.fill()
    ctx.fillStyle = `rgba(255, 107, 107, ${0.14 * power})`
    wedge(ctx, mx, my, TURBINE.DANGER_REACH, intake, TURBINE.INTAKE_ARC)
    ctx.fill()
    ctx.strokeStyle = `rgba(255, 107, 107, ${0.55 * power})`
    ctx.lineWidth = 2
    ctx.setLineDash([6, 6])
    ctx.beginPath()
    ctx.arc(mx, my, TURBINE.DANGER_REACH, intake - TURBINE.INTAKE_ARC, intake + TURBINE.INTAKE_ARC)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(210, 238, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 22; i++) {
        const lane = ((i * 0.618) % 1) * 2 - 1
        const phase = (timestamp / 900 + i * 0.37) % 1
        const distance = TURBINE.INTAKE_REACH * Math.pow(1 - phase, 1.6)
        const angle = intake + lane * TURBINE.INTAKE_ARC * 0.9 * (0.3 + 0.7 * (distance / TURBINE.INTAKE_REACH))
        const length = 10 + 34 * phase
        ctx.globalAlpha = Math.min(1, phase * 3) * 0.6 * power
        ctx.beginPath()
        ctx.moveTo(mx + Math.cos(angle) * distance, my + Math.sin(angle) * distance)
        ctx.lineTo(mx + Math.cos(angle) * Math.max(0, distance - length), my + Math.sin(angle) * Math.max(0, distance - length))
        ctx.stroke()
    }
    ctx.restore()
}

/** The exhaust's wind: a cone where it points right now, with streamlines blowing out */
function drawExhaustWind(ctx: CanvasRenderingContext2D, x: number, y: number, exhaust: number, power: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    const nx = x + Math.cos(exhaust) * r
    const ny = y + Math.sin(exhaust) * r
    ctx.save()
    const glow = ctx.createRadialGradient(nx, ny, 0, nx, ny, TURBINE.EXHAUST_REACH)
    glow.addColorStop(0, `rgba(255, 255, 255, ${0.2 * power})`)
    glow.addColorStop(1, 'rgba(255, 255, 255, 0)')
    ctx.fillStyle = glow
    wedge(ctx, nx, ny, TURBINE.EXHAUST_REACH, exhaust, TURBINE.EXHAUST_ARC)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    for (let i = 0; i < 16; i++) {
        const lane = ((i * 0.618) % 1) * 2 - 1
        const phase = (timestamp / 600 + i * 0.29) % 1
        const distance = 10 + TURBINE.EXHAUST_REACH * phase
        const angle = exhaust + lane * TURBINE.EXHAUST_ARC * 0.85 * Math.min(1, 0.4 + phase)
        const length = 16 + 30 * (1 - phase)
        ctx.globalAlpha = (1 - phase) * 0.7 * power
        ctx.beginPath()
        ctx.moveTo(nx + Math.cos(angle) * distance, ny + Math.sin(angle) * distance)
        ctx.lineTo(nx + Math.cos(angle) * (distance + length), ny + Math.sin(angle) * (distance + length))
        ctx.stroke()
    }
    ctx.restore()
}

/** The machine: a fixed intake funnel, a nozzle that turns with the exhaust, and a fan that spins (slowing as it powers down) */
function drawTurbineBody(ctx: CanvasRenderingContext2D, x: number, y: number, intake: number, exhaust: number, power: number, timestamp: number): void {
    const r = TURBINE.BODY_RADIUS
    ctx.save()
    ctx.translate(x, y)
    ctx.save()
    ctx.rotate(exhaust)
    ctx.fillStyle = '#3a4a5c'
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 2
    ctx.fillRect(r * 0.55, -r * 0.32, r * 0.72, r * 0.64)
    ctx.strokeRect(r * 0.55, -r * 0.32, r * 0.72, r * 0.64)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.25 + 0.45 * power})`
    ctx.fillRect(r * 1.22, -r * 0.27, 5, r * 0.54)
    ctx.restore()
    ctx.save()
    ctx.rotate(intake)
    ctx.fillStyle = '#2b3846'
    ctx.strokeStyle = 'rgba(160, 220, 255, 0.85)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(r * 0.6, -r * 0.45)
    ctx.lineTo(r * 1.15, -r * 0.8)
    ctx.lineTo(r * 1.15, r * 0.8)
    ctx.lineTo(r * 0.6, r * 0.45)
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    ctx.restore()
    const body = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r)
    body.addColorStop(0, '#5a6f84')
    body.addColorStop(1, '#1e2833')
    ctx.fillStyle = body
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.85)'
    ctx.lineWidth = 3
    ctx.stroke()
    ctx.rotate((timestamp / 90) * power)
    ctx.fillStyle = 'rgba(200, 225, 240, 0.85)'
    for (let i = 0; i < 5; i++) {
        ctx.rotate((Math.PI * 2) / 5)
        ctx.beginPath()
        ctx.ellipse(r * 0.38, 0, r * 0.36, r * 0.12, 0.5, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = '#1e2833'
    ctx.beginPath()
    ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
}

/** A puff of air where a turbine just fired a gem (k: 0 to 1 over the puff) */
function drawLaunchPuff(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, k: number): void {
    ctx.save()
    ctx.globalAlpha = 1 - k
    ctx.fillStyle = 'rgba(235, 245, 255, 0.6)'
    for (let i = 0; i < 3; i++) {
        const spread = (i - 1) * 0.45
        const distance = 8 + 26 * k
        ctx.beginPath()
        ctx.arc(x + Math.cos(angle + spread) * distance, y + Math.sin(angle + spread) * distance, 5 + 9 * k, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.restore()
}

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

/** The jackpot crystal: a big violet gem with a glow */
function drawCrystal(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.fillStyle = 'rgba(179, 136, 255, 0.25)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.7, y - radius * 0.2)
    ctx.lineTo(x + radius * 0.45, y + radius)
    ctx.lineTo(x - radius * 0.45, y + radius)
    ctx.lineTo(x - radius * 0.7, y - radius * 0.2)
    ctx.closePath()
    ctx.fillStyle = '#b388ff'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(x, y - radius)
    ctx.lineTo(x + radius * 0.7, y - radius * 0.2)
    ctx.lineTo(x, y + radius * 0.1)
    ctx.closePath()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)'
    ctx.fill()
}

/** A coordinate moved by `distance` between `low` and `high`, bouncing off the ends (how balls move) */
function bounce(position: number, distance: number, low: number, high: number): number {
    const span = high - low
    if (span <= 0) return low
    let p = (position - low + distance) % (2 * span)
    if (p < 0) p += 2 * span
    return low + (p > span ? 2 * span - p : p)
}

/** A round creature with eyes toward where it faces, so everyone can see which side is its back */
function drawCreature(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, facing: number, timestamp = 0, mouth = '', inhaling = false): void {
    const r = size / 2
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = Math.max(1.5, size * 0.06)
    ctx.stroke()
    const fx = Math.cos(facing)
    const fy = Math.sin(facing)
    for (const side of [-1, 1]) {
        const ex = x + fx * r * 0.42 - fy * r * 0.36 * side
        const ey = y + fy * r * 0.42 + fx * r * 0.36 * side
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.arc(ex, ey, r * 0.26, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(16, 21, 31, 0.55)'
        ctx.lineWidth = Math.max(1, size * 0.025)
        ctx.stroke()
        ctx.fillStyle = '#10151f'
        ctx.beginPath()
        ctx.arc(ex + fx * r * 0.1, ey + fy * r * 0.1, r * 0.13, 0, Math.PI * 2)
        ctx.fill()
    }
    // The mouth: wide open while inhaling, bulging with a rock when full
    const mx = x + fx * r * 0.74
    const my = y + fy * r * 0.74
    if (inhaling) {
        ctx.fillStyle = '#10151f'
        ctx.beginPath()
        ctx.arc(mx, my, r * (0.24 + 0.03 * Math.sin(timestamp / 60)), 0, Math.PI * 2)
        ctx.fill()
    } else if (mouth) {
        // A bomb held in the mouth (sparking if its fuse is running)
        const bx = x + fx * r * 0.82
        const by = y + fy * r * 0.82
        ctx.fillStyle = '#23262f'
        ctx.beginPath()
        ctx.arc(bx, by, r * 0.32, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)'
        ctx.lineWidth = Math.max(1, size * 0.03)
        ctx.stroke()
        if (mouth === 'lit' && Math.sin(timestamp / 60) > 0) {
            ctx.fillStyle = '#ffb347'
            ctx.beginPath()
            ctx.arc(bx + fx * r * 0.3, by + fy * r * 0.3, Math.max(2.5, r * 0.12), 0, Math.PI * 2)
            ctx.fill()
        }
    }
}

/**
 * Your breath around your creature: draining while you inhale (blue, then amber, then flashing red
 * when it's nearly gone), and refilling while you catch it, with little puffs rising
 */
function drawBreath(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, breath: Breath, timestamp: number): void {
    if (breath.phase === 'ready') return
    const r = size / 2 + 8
    const start = -Math.PI / 2
    ctx.save()
    ctx.lineCap = 'round'
    ctx.lineWidth = 4
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)'
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.stroke()
    if (breath.phase === 'inhaling') {
        const left = breath.left
        ctx.strokeStyle =
            left > 0.5 ? 'rgba(160, 230, 255, 0.95)' : left > 0.25 ? 'rgba(255, 209, 102, 0.95)' : `rgba(255, 107, 107, ${0.7 + 0.3 * Math.sin(timestamp / 60)})`
        ctx.beginPath()
        ctx.arc(x, y, r, start, start + Math.PI * 2 * Math.max(0.01, left))
        ctx.stroke()
    } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.arc(x, y, r, start, start + Math.PI * 2 * Math.max(0.01, breath.back))
        ctx.stroke()
        // Catching your breath: little puffs rising
        for (let i = 0; i < 3; i++) {
            const t = (timestamp / 700 + i / 3) % 1
            ctx.fillStyle = `rgba(220, 235, 255, ${0.5 * (1 - t)})`
            ctx.beginPath()
            ctx.arc(x + (i - 1) * size * 0.18, y - size / 2 - 10 - t * 16, 2.5 + t * 2.5, 0, Math.PI * 2)
            ctx.fill()
        }
    }
    ctx.restore()
}

/**
 * How suction looks (browsers only). A creature's suction power grows with its size,
 * (width / newborn width) ^ POWER_GROWTH up to POWER_MAX, and everything about its inhale scales
 * with it: more, longer, thicker, faster streaks and a brighter cone; gems it steals fly faster
 * and glow more. Mouth and cone size already grow with the creature itself.
 */
const INHALE_LOOK = {
    POWER_GROWTH: 0.5,
    POWER_MAX: 4,
    STREAKS: 6, // streaks in a newborn's cone...
    STREAKS_PER_POWER: 4, // ...plus this many per point of power (about 20 for a 12x giant)
    STREAK_SPEED: 260, // units a second a newborn's streaks rush in, times power
    STREAK_LENGTH: 14, // plus 10 per point of power
    GLOW: 0.22, // cone brightness, plus 0.06 per point of power
    THEFT_FLIGHT_MS: 450, // how long a stolen gem takes to fly over, divided by the square root of the thief's power
} as const

/** How strong a creature's suction looks: 1 for a newborn, growing with size (see INHALE_LOOK) */
function suctionPower(width: number): number {
    return Math.min(INHALE_LOOK.POWER_MAX, Math.pow(Math.max(1, width / ARENA_RULES.PLAYER_SIZE), INHALE_LOOK.POWER_GROWTH))
}

/** Air rushing into an inhaling creature's mouth: a fading cone, its streaks denser, longer and faster the stronger its suction */
function drawInhaleCone(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, facing: number, timestamp: number, intensity = 1): void {
    const r = size / 2
    const reach = INHALE.REACH + size * INHALE.REACH_PER_SIZE
    const spread = (INHALE.ARC * Math.PI) / 180
    // Bigger creatures pull harder, and draining or swallowing someone pulls harder still
    const power = Math.min(6, suctionPower(size) * intensity)
    ctx.save()
    const glow = ctx.createRadialGradient(x, y, r, x, y, r + reach)
    glow.addColorStop(0, `rgba(180, 230, 255, ${Math.min(0.5, INHALE_LOOK.GLOW + 0.06 * power)})`)
    glow.addColorStop(1, 'rgba(180, 230, 255, 0)')
    ctx.fillStyle = glow
    ctx.beginPath()
    ctx.arc(x, y, r + reach, facing - spread, facing + spread)
    ctx.arc(x, y, r, facing + spread, facing - spread, true)
    ctx.closePath()
    ctx.fill()
    ctx.strokeStyle = `rgba(220, 245, 255, ${Math.min(0.85, 0.5 + 0.08 * power)})`
    ctx.lineWidth = 1.5 + 0.6 * power
    ctx.lineCap = 'round'
    const streaks = Math.round(INHALE_LOOK.STREAKS + INHALE_LOOK.STREAKS_PER_POWER * power)
    const period = (reach / (INHALE_LOOK.STREAK_SPEED * power)) * 1000
    const length = INHALE_LOOK.STREAK_LENGTH + 10 * power
    for (let i = 0; i < streaks; i++) {
        const t = (timestamp / period + i / streaks) % 1
        // Faster and faster as it nears the mouth
        const along = r + reach * (1 - t) * (1 - t * 0.35)
        // Lanes close in on the mouth as the air rushes in
        const angle = facing + spread * 0.85 * Math.sin(i * 2.3) * (1 - 0.55 * t)
        ctx.globalAlpha = Math.min(1, t * 4)
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(angle) * along, y + Math.sin(angle) * along)
        ctx.lineTo(x + Math.cos(angle) * Math.max(r, along - length), y + Math.sin(angle) * Math.max(r, along - length))
        ctx.stroke()
    }
    // The mouth glows and throbs, harder and faster the stronger the pull
    ctx.globalAlpha = 1
    const throb = 0.5 + 0.5 * Math.sin((timestamp / 1000) * Math.PI * 2 * (2 + power))
    const mouthX = x + Math.cos(facing) * r
    const mouthY = y + Math.sin(facing) * r
    const core = r * (0.35 + 0.1 * power) * (0.85 + 0.15 * throb) * 2.2
    const rush = ctx.createRadialGradient(mouthX, mouthY, 0, mouthX, mouthY, core)
    rush.addColorStop(0, `rgba(235, 250, 255, ${Math.min(0.75, 0.25 + 0.12 * power)})`)
    rush.addColorStop(1, 'rgba(235, 250, 255, 0)')
    ctx.fillStyle = rush
    ctx.beginPath()
    ctx.arc(mouthX, mouthY, core, 0, Math.PI * 2)
    ctx.fill()
    // Once the pull is strong, the cone's edges shimmer
    if (power > 1.4) {
        ctx.strokeStyle = `rgba(220, 245, 255, ${Math.min(0.45, 0.1 * (power - 1) * (0.6 + 0.4 * throb))})`
        ctx.lineWidth = 1 + 0.5 * power
        ctx.beginPath()
        ctx.moveTo(x + Math.cos(facing - spread) * r, y + Math.sin(facing - spread) * r)
        ctx.lineTo(x + Math.cos(facing - spread) * (r + reach), y + Math.sin(facing - spread) * (r + reach))
        ctx.moveTo(x + Math.cos(facing + spread) * r, y + Math.sin(facing + spread) * r)
        ctx.lineTo(x + Math.cos(facing + spread) * (r + reach), y + Math.sin(facing + spread) * (r + reach))
        ctx.stroke()
    }
    ctx.restore()
}

/**
 * A bomb: round, black, with a fuse. Lit, its spark and a red glow blink faster as the fuse runs
 * down, and its blast circle shows on the ground so everyone can see where not to be.
 */
function drawBomb(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, fuseLeft: number | null, timestamp: number): void {
    const lit = fuseLeft !== null
    const urgency = lit ? 1 - Math.max(0, Math.min(1, fuseLeft / BOMBS.FUSE_MS)) : 0
    const blink = lit && Math.sin(timestamp / Math.max(35, (fuseLeft ?? 0) / 10)) > 0
    if (lit) {
        ctx.save()
        ctx.fillStyle = `rgba(255, 80, 60, ${0.05 + 0.12 * urgency})`
        ctx.strokeStyle = `rgba(255, 110, 90, ${0.35 + 0.45 * urgency})`
        ctx.lineWidth = 2
        ctx.setLineDash([10, 8])
        ctx.beginPath()
        ctx.arc(x, y, BOMBS.BLAST_RADIUS, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.restore()
    }
    if (blink) {
        ctx.fillStyle = 'rgba(255, 70, 50, 0.45)'
        ctx.beginPath()
        ctx.arc(x, y, radius * 1.7, 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = '#23262f'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
    ctx.beginPath()
    ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.stroke()
    // The fuse
    const tipX = x + radius * 0.95
    const tipY = y - radius * 1.2
    ctx.strokeStyle = '#c9a36b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x + radius * 0.5, y - radius * 0.75)
    ctx.quadraticCurveTo(x + radius * 1.1, y - radius * 0.9, tipX, tipY)
    ctx.stroke()
    if (lit) {
        ctx.fillStyle = blink ? '#fff2b0' : '#ff8c3a'
        ctx.beginPath()
        ctx.arc(tipX, tipY, blink ? 5 : 3.5, 0, Math.PI * 2)
        ctx.fill()
    }
}

/** A comet: a glowing violet head with a tail trailing back along its path */
function drawComet(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, vx: number, vy: number): void {
    const speed = Math.hypot(vx, vy) || 1
    const ux = vx / speed
    const uy = vy / speed
    for (let i = 5; i >= 1; i--) {
        ctx.fillStyle = `rgba(167, 139, 250, ${0.34 - i * 0.055})`
        ctx.beginPath()
        ctx.arc(x - ux * radius * 0.85 * i, y - uy * radius * 0.85 * i, radius * (1 - i * 0.15), 0, Math.PI * 2)
        ctx.fill()
    }
    ctx.fillStyle = 'rgba(167, 139, 250, 0.25)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.45, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#c4b5fd'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.beginPath()
    ctx.arc(x + ux * radius * 0.25, y + uy * radius * 0.25, radius * 0.42, 0, Math.PI * 2)
    ctx.fill()
}

/** A ball: a glowing orb with a highlight */
function drawBall(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number): void {
    ctx.fillStyle = 'rgba(255, 92, 138, 0.22)'
    ctx.beginPath()
    ctx.arc(x, y, radius * 1.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ff5c8a'
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 210, 225, 0.8)'
    ctx.lineWidth = 2
    ctx.stroke()
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
    ctx.beginPath()
    ctx.arc(x - radius * 0.35, y - radius * 0.35, radius * 0.3, 0, Math.PI * 2)
    ctx.fill()
}

/** A little robot head, marking bots, centered on (centerX, centerY) */
function drawRobot(ctx: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
    const width = size
    const height = size * 0.8
    ctx.fillStyle = '#9fb3c8'
    roundedRect(ctx, centerX - width / 2, centerY - height / 2, width, height, size * 0.2)
    ctx.fill()
    ctx.fillRect(centerX - size * 0.06, centerY - height / 2 - size * 0.28, size * 0.12, size * 0.28)
    ctx.beginPath()
    ctx.arc(centerX, centerY - height / 2 - size * 0.32, size * 0.13, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(5, 12, 24, 0.9)'
    ctx.fillRect(centerX - width * 0.3, centerY - height * 0.15, width * 0.2, height * 0.25)
    ctx.fillRect(centerX + width * 0.1, centerY - height * 0.15, width * 0.2, height * 0.25)
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
 * bursts when someone is hit or shoved, a leaderboard and a minimap.
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
    /** The world point at the center of the screen */
    private camera: { x: number; y: number } | null = null
    private lastRenderAt = 0
    /** How far the camera is zoomed out (grows with your size, eased so it never jumps) */
    private zoom: number = WORLD.VIEW_ZOOM_SMALL
    /** Each player's drawn size, springing toward their real size so growing and shrinking pop */
    private drawnSizes = new Map<string, { size: number; speed: number }>()
    /** When your player was knocked out, for the "back in" countdown */
    private knockedOutAt: number | null = null
    /** The last time someone got you (and how), for the knocked-out screen: "Swallowed by Drew" */
    private knockoutCause: { how: string; by: string; at: number } | null = null
    /** Messages at the top right: who joined, who shoved whom off the edge, who took the jackpot */
    private notices: { text: string; at: number; strong: boolean }[] = []
    /** When each dropping gem was first seen, to draw its fall */
    private fallingSince = new Map<string, number>()
    /** Whether everyone is protected right now (a shift's grace period) */
    private inGrace = false
    /** The joystick, INHALE button and mouse steering (drawn on the canvas) */
    private controls: OnlineControls | null = null
    /** Your walking velocity */
    private velocity = { x: 0, y: 0 }
    /** Holding the button: inhaling (it never changes how you move) */
    private inhaleHeld = false
    private aim = { x: 0, y: -1 }
    /** The aim last sent (your eyes turn toward it for everyone), and which way you face */
    private sentAim = { x: 0, y: 0 }
    private localFacing = -Math.PI / 2
    /** Your breath, tracked from when the server starts and stops your inhale (see breathOf) */
    private breathStartedAt = 0
    private breathEndedAt = -Infinity
    private wasInhaling = false
    private breath: Breath = { phase: 'ready' }
    /** Gem bursts and hard hits to draw, the banner for hits you cause, and the shake they bring */
    private gemBursts: { x: number; y: number; count: number; at: number }[] = []
    private impacts: { x: number; y: number; size: number; at: number }[] = []
    private banner: { title: string; sub: string; at: number } | null = null
    private hitShake = { until: 0, strength: 0 }
    private facing = { x: 0, y: -1 }
    /** The steering last sent to the server */
    private sentSteer = { x: 0, y: 0 }
    /** Where you were drawn over the last second, to compare with the server (which runs a round trip behind) */
    private history: { at: number; x: number; y: number }[] = []
    private lastMoveAt = 0
    /** The view as last drawn, to find your player on screen for mouse steering */
    private lastView: View | null = null
    private minimapBottom = 0
    /**
     * Our clock minus the world's clock for the quickest update seen: lining the two up this way
     * places traffic by the server's own timing rather than by when updates happen to land
     */
    private clockGap = Infinity
    /** Where each gem is drawn, eased toward the server position as sprayed gems slide */
    private drawnGems = new Map<string, { x: number; y: number }>()
    /** Each player as of the last frame, to spot hits and pickups */
    private lastSeen = new Map<string, { alive: boolean; recovering: boolean; sliding: boolean; gems: number; cx: number; cy: number }>()
    private bursts: { x: number; y: number; size: number; color: string; at: number }[] = []
    /** Bomb blasts going off: a flash and a ring racing out to the blast's edge */
    private blasts: { x: number; y: number; radius: number; at: number }[] = []
    /** Gravity theft on screen: each victim's gems last frame, and the stolen gems in flight */
    private theftGems = new Map<string, number>()
    /** Drained creatures shrinking away to nothing */
    private vanishes: { x: number; y: number; size: number; color: string; facing: number; at: number }[] = []
    private theftParticles: { from: string; to: string; at: number; angle: number; flight: number; power: number }[] = []
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
        eventBus.on(GameEvents.MULTIPLAYER_STATE_UPDATE, (state: any) => {
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
    private steerVector(input: InputState, me: any): { x: number; y: number } {
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
        const deltaTime = this.lastMoveAt ? Math.min(0.1, (now - this.lastMoveAt) / 1000) : 0
        this.lastMoveAt = now

        const state = this.worldState()
        const localId = this.multiplayerManager?.localSessionId
        const me = state && localId ? state.players.get(localId) : undefined
        if (!state || !me) {
            this.predicted = null
            return
        }
        const steer = this.steerVector(input, me)
        // Inhaling never slows you down: you always steer exactly as usual
        this.sendSteer(steer)
        if (me.state !== 'alive') {
            this.predicted = { x: me.x, y: me.y }
            this.resetMotion()
            return
        }
        if (!this.predicted) this.predicted = { x: me.x, y: me.y }
        if (me.sliding || me.recovering) {
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
            } else if (event === 'exhale' && this.inhaleHeld) {
                // Let go: stop inhaling
                this.inhaleHeld = false
                this.multiplayerManager?.sendMessage('exhale', {})
            }
        }

        // Move exactly the way the server does
        const box = { x: this.predicted.x, y: this.predicted.y, width: me.width, height: me.height }
        // Facing, worked out like the server does: the aim while inhaling, else where you steer
        const intent = this.inhaleHeld ? this.aim : steer
        if (Math.hypot(intent.x, intent.y) > 0.25) {
            this.localFacing = turnToward(this.localFacing, Math.atan2(intent.y, intent.x), turnRate(me.width) * deltaTime)
        }
        walk(box, this.velocity, steer, deltaTime, state.worldWidth, state.worldHeight)
        // Creatures are solid: stop at anyone you walk into and slide along them, as the server does
        const myId = this.multiplayerManager?.localSessionId
        state.players.forEach((other: any, id: string) => {
            if (id === myId || other.state !== 'alive') return
            const at = this.drawnPositions.get(id) ?? { x: other.x, y: other.y }
            const dx = box.x + box.width / 2 - (at.x + other.width / 2)
            const dy = box.y + box.height / 2 - (at.y + other.height / 2)
            const distance = Math.hypot(dx, dy)
            const overlap = (box.width + other.width) / 2 - distance
            if (overlap <= 0 || distance < 1e-6) return
            const nx = dx / distance
            const ny = dy / distance
            box.x += nx * overlap
            box.y += ny * overlap
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

    /** Where your breath is: draining for INHALE.MAX_MS while you inhale, then refilling for INHALE.RECOVER_MS */
    private breathOf(inhaling: boolean, now: number): Breath {
        if (inhaling && !this.wasInhaling) this.breathStartedAt = now
        if (!inhaling && this.wasInhaling) this.breathEndedAt = now
        this.wasInhaling = inhaling
        if (inhaling) return { phase: 'inhaling', left: Math.max(0, 1 - (now - this.breathStartedAt) / INHALE.MAX_MS) }
        if (now - this.breathEndedAt < INHALE.RECOVER_MS) return { phase: 'recovering', back: (now - this.breathEndedAt) / INHALE.RECOVER_MS }
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
        this.drawFloor(ctx, state, view)
        this.drawShiftFloor(ctx, state, view, timestamp)
        const margin = 120
        const left = view.x - view.width / 2 - margin
        const right = view.x + view.width / 2 + margin
        const top = view.y - view.height / 2 - margin
        const bottom = view.y + view.height / 2 + margin
        this.drawTurbines(ctx, state, timestamp)
        this.drawGems(ctx, state, left, right, top, bottom, timestamp)
        this.drawGemBursts(ctx)
        this.drawJackpot(ctx, state, localId, timestamp)
        const lead = this.trafficLead(timestamp)
        state.obstacles.forEach((obstacle: any) => {
            const x = obstacle.x + (obstacle.vx ?? 0) * lead
            const y = obstacle.y + (obstacle.vy ?? 0) * lead
            if (x > right || x + obstacle.width < left || y > bottom || y + obstacle.height < top) return
            this.drawObstacle(ctx, { x, y, width: obstacle.width, height: obstacle.height, variant: obstacle.variant }, timestamp)
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
        state.players.forEach((player: any, sessionId: string) => {
            present.add(sessionId)
            this.drawPlayer(ctx, player, sessionId, sessionId === localId, sessionId === leaderId, timestamp)
        })
        for (const id of this.drawnPositions.keys()) {
            if (!present.has(id)) this.drawnPositions.delete(id)
        }
        for (const id of this.drawnSizes.keys()) {
            if (!present.has(id)) this.drawnSizes.delete(id)
        }

        this.drawTheft(ctx, state, timestamp)
        this.drawTurbineFlights(ctx, state, timestamp)
        this.drawGulps(ctx, state, timestamp)
        this.drawVanishes(ctx, timestamp)
        this.drawBlasts(ctx, timestamp)
        this.drawBursts(ctx, timestamp)
        this.drawPickups(ctx, me, timestamp)

        // Screen-space overlays
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        this.drawMinimap(ctx, canvas, state, view, localId, leaderId)
        this.drawLeaderboard(ctx, canvas, state, localId, leaderId)
        this.drawNotices(ctx, canvas)
        this.drawShiftChip(ctx, canvas, state, timestamp)
        this.drawTrafficChip(ctx, canvas, state, timestamp)
        this.drawBanner(ctx, canvas)
        this.controls?.draw(ctx, timestamp, this.breath)
        if (me && me.state !== 'alive') this.drawKnockedOut(ctx, canvas)
        ctx.restore()
    }

    /**
     * Follow your player. Every screen sees the same amount of world (WORLD.VIEW_AREA), shaped
     * to the screen within the aspect limits; a screen outside them sees less, never more.
     */
    private updateCamera(canvas: HTMLCanvasElement, state: any, me: any, timestamp: number): View {
        const aspect = Math.min(WORLD.MAX_VIEW_ASPECT, Math.max(WORLD.MIN_VIEW_ASPECT, canvas.width / canvas.height))
        // The view widens as you grow, but much less than you do and only so far, so a giant fills its own screen and looms on everyone else's
        const grown = me ? Math.max(1, me.width / ARENA_RULES.PLAYER_SIZE) : 1
        this.zoom += (Math.min(WORLD.VIEW_ZOOM_MAX, WORLD.VIEW_ZOOM_SMALL * Math.pow(grown, WORLD.VIEW_GROWTH)) - this.zoom) * 0.05
        const area = WORLD.VIEW_AREA * this.zoom * this.zoom
        const scale = Math.max(
            canvas.width / Math.sqrt(area * aspect),
            canvas.height / Math.sqrt(area / aspect)
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
        if (player.spawnProtected || this.inGrace) {
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
        // Size changes pop: a quick overshoot and settle, centered on where the player is
        let grow = this.drawnSizes.get(sessionId)
        if (!grow) {
            grow = { size: player.width, speed: 0 }
            this.drawnSizes.set(sessionId, grow)
        }
        grow.speed = (grow.speed + (player.width - grow.size) * 0.3) * 0.6
        grow.size += grow.speed
        const size = Math.max(4, grow.size)
        const left = drawn.x + (player.width - size) / 2
        const top = drawn.y + (player.height - size) / 2
        const centerX = drawn.x + player.width / 2
        const centerY = drawn.y + player.height / 2
        if (player.inhaling) {
            // Draining someone (harder the bigger it is next to them) or holding someone to swallow: the inhale looks stronger
            const world = this.multiplayerManager?.getState()
            const victim = player.stealingFrom ? world?.players?.get(player.stealingFrom) : null
            const grip = victim ? Math.min(INHALE.STEAL_MAX, Math.max(INHALE.STEAL_MIN, player.width / victim.width)) : 0
            const intensity = player.gulping ? 1.8 : victim ? 1 + 0.5 * grip : 1
            drawInhaleCone(ctx, centerX, centerY, size, isLocal ? this.localFacing : (player.facing ?? -Math.PI / 2), timestamp, intensity)
        }
        if (isLocal) {
            // Your breath: draining around you while you inhale, refilling while you catch it
            this.breath = this.breathOf(Boolean(player.inhaling), performance.now())
            drawBreath(ctx, centerX, centerY, size, this.breath, timestamp)
        }
        if (isLocal && player.gems < GEMS.SURVIVE_AT) {
            // One hit from behind from being knocked out: a cracked red ring
            ctx.save()
            ctx.setLineDash([5, 4])
            ctx.strokeStyle = `rgba(255, 90, 90, ${0.45 + 0.25 * Math.sin(timestamp / 250)})`
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(left + size / 2, top + size / 2, size / 2 + 4, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
        }
        if (player.sliding) {
            // Dust kicked up by a slide or a skid
            ctx.fillStyle = 'rgba(200, 210, 220, 0.35)'
            for (let i = 0; i < 3; i++) {
                ctx.beginPath()
                ctx.arc(left + size * (0.2 + 0.3 * i), top + size + 3 + Math.sin(timestamp / 60 + i * 2) * 2, size * 0.14, 0, Math.PI * 2)
                ctx.fill()
            }
        }
        // A round creature whose eyes show which way it faces (its back is where it's vulnerable)
        const facing = isLocal ? this.localFacing : (player.facing ?? -Math.PI / 2)
        drawCreature(ctx, left + size / 2, top + size / 2, size, isLocal ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length], facing, timestamp, player.mouth ?? '', Boolean(player.inhaling))
        ctx.globalAlpha = 1
        ctx.font = `600 16px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = isLocal ? '#ffffff' : '#cfd8dc'
        const label = String(player.name ?? '')
        const labelX = drawn.x + player.width / 2
        ctx.fillText(label, labelX, drawn.y - 6)
        if (player.isBot) drawRobot(ctx, labelX - ctx.measureText(label).width / 2 - 11, drawn.y - 14, 12)
        if (isLeader) {
            drawCrown(ctx, drawn.x + player.width / 2, drawn.y - 26, 22)
            // What the leader is worth
            ctx.font = `800 14px ${FONT}`
            ctx.fillStyle = GOLD
            ctx.fillText(`${player.gems}`, drawn.x + player.width / 2, drawn.y - 50)
        }
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
        // On a touchscreen the INHALE button has the bottom right, so the minimap moves to the top
        const y = this.controls?.touchDevice ? 34 : canvas.height - height - 12
        this.minimapBottom = y + height
        ctx.save()
        ctx.fillStyle = 'rgba(5, 12, 24, 0.72)'
        roundedRect(ctx, x - 4, y - 4, width + 8, height + 8, 6)
        ctx.fill()
        ctx.lineWidth = 1
        ctx.strokeStyle = 'rgba(79, 209, 197, 0.55)'
        ctx.strokeRect(x, y, width, height)
        if (state.floor) {
            // The (new) floor: the void is dark, or red while it's still coming
            const tile = width / SHIFT.GRID
            ctx.fillStyle = state.shiftPhase === 'grace' ? 'rgba(255, 90, 90, 0.35)' : 'rgba(0, 0, 0, 0.75)'
            for (let i = 0; i < state.floor.length; i++) {
                if (state.floor[i] === '0') ctx.fillRect(x + (i % SHIFT.GRID) * tile, y + Math.floor(i / SHIFT.GRID) * tile, tile, tile)
            }
        }
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
        state.turbines?.forEach((turbine: any) => {
            // Turbines: a ring, with a tick for where the intake points (gold while one is about to switch on)
            const tx = x + turbine.x * scale
            const ty = y + turbine.y * scale
            ctx.strokeStyle = turbine.phase === 'warning' ? 'rgba(255, 209, 102, 0.95)' : 'rgba(160, 220, 255, 0.95)'
            ctx.lineWidth = 1.5
            ctx.beginPath()
            ctx.arc(tx, ty, 3.5, 0, Math.PI * 2)
            ctx.moveTo(tx, ty)
            ctx.lineTo(tx + Math.cos(turbine.intake) * 7, ty + Math.sin(turbine.intake) * 7)
            ctx.stroke()
        })
        if (state.jackpotOn) {
            // The jackpot is the one thing the minimap points out
            const jx = x + state.jackpotX * scale
            const jy = y + state.jackpotY * scale
            ctx.fillStyle = GOLD
            ctx.beginPath()
            ctx.moveTo(jx, jy - 5)
            ctx.lineTo(jx + 4, jy)
            ctx.lineTo(jx, jy + 5)
            ctx.lineTo(jx - 4, jy)
            ctx.closePath()
            ctx.fill()
        }
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
        ctx.font = `600 11px ${FONT}`
        ctx.textAlign = 'right'
        ctx.textBaseline = 'bottom'
        ctx.fillText(`${playing} playing`, x + width, y - 8)
        ctx.restore()
    }

    /** Our best guess at the world's clock right now */
    private worldNow(state: any, timestamp: number): number {
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
        if (targetIsYou && how !== 'stole') {
            this.knockoutCause = { how, by: String(data?.by ?? 'Someone'), at: performance.now() }
        }
        const verb = how === 'stole' ? 'robbed' : how === 'ate' ? 'swallowed' : how === 'drained' ? 'drained' : how === 'turbine' ? 'fed' : how === 'bomb' ? 'blew up' : 'shoved'
        const where = how === 'stole' ? `of ${Number(data?.gems) || 0} gems` : how === 'turbine' ? 'to a turbine' : how === 'edge' ? 'off the edge' : how === 'traffic' ? 'into traffic' : ''
        if (data?.byId === localId) {
            const name = String(data?.target ?? 'someone')
            const title = how === 'stole' ? `You stole ${Number(data?.gems) || 0} gems from ${name}!` : how === 'ate' ? `You swallowed ${name}!` : how === 'drained' ? `You drained ${name}!` : how === 'turbine' ? `You fed ${name} to a turbine!` : how === 'bomb' ? `You blew up ${name}!` : `You wrecked ${name}!`
            const parts =
                how === 'stole' ? []
                : how === 'ate' || how === 'drained' ? [`+${Number(data?.gems) || 0} gems`]
                : how === 'bomb' ? [data?.out ? 'knocked out' : `${Number(data?.gems) || 0} gems knocked loose`]
                : [where, data?.out ? 'knocked out' : '']
            this.banner = { title, sub: parts.filter(Boolean).join(' · ').toUpperCase(), at: performance.now() }
            return
        }
        const out = how !== 'ate' && how !== 'drained' && how !== 'turbine' && data?.out ? (targetIsYou ? ' and knocked you out' : ' and knocked them out') : ''
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

    /** Bursts of gems (a flash, a ring and sparks, bigger for bigger piles) and shockwaves from hits */
    private drawGemBursts(ctx: CanvasRenderingContext2D): void {
        const now = performance.now()
        this.gemBursts = this.gemBursts.filter((burst) => now - burst.at < 500)
        this.impacts = this.impacts.filter((impact) => now - impact.at < 320)
        ctx.save()
        for (const burst of this.gemBursts) {
            const t = (now - burst.at) / 500
            const reach = 24 + t * Math.min(260, 50 + burst.count * 7)
            if (t < 0.3) {
                ctx.fillStyle = `rgba(255, 236, 160, ${(0.3 - t) * 1.6})`
                ctx.beginPath()
                ctx.arc(burst.x, burst.y, reach * 0.6, 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.strokeStyle = `rgba(255, 209, 102, ${0.8 * (1 - t)})`
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(burst.x, burst.y, reach, 0, Math.PI * 2)
            ctx.stroke()
            const sparks = Math.min(28, 6 + burst.count)
            ctx.lineWidth = 2
            for (let i = 0; i < sparks; i++) {
                const angle = (i / sparks) * Math.PI * 2 + burst.count
                ctx.beginPath()
                ctx.moveTo(burst.x + Math.cos(angle) * reach * 0.7, burst.y + Math.sin(angle) * reach * 0.7)
                ctx.lineTo(burst.x + Math.cos(angle) * reach * 1.05, burst.y + Math.sin(angle) * reach * 1.05)
                ctx.stroke()
            }
        }
        for (const impact of this.impacts) {
            const t = (now - impact.at) / 320
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - t)})`
            ctx.lineWidth = 2 + impact.size * 0.06
            ctx.beginPath()
            ctx.arc(impact.x, impact.y, impact.size * (0.5 + t * 2), 0, Math.PI * 2)
            ctx.stroke()
        }
        ctx.restore()
    }

    /** The big banner for hits you caused: it pops in, holds, and fades */
    private drawBanner(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        if (!this.banner) return
        const age = performance.now() - this.banner.at
        if (age > 1700) {
            this.banner = null
            return
        }
        const pop = age < 160 ? 1.35 - (age / 160) * 0.35 : 1
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = age > 1350 ? Math.max(0, 1 - (age - 1350) / 350) : 1
        ctx.translate(canvas.width / 2, canvas.height * 0.3)
        ctx.scale(pop, pop)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.lineJoin = 'round'
        ctx.font = `900 ${Math.round(Math.min(34, canvas.width / 14))}px ${FONT}`
        ctx.lineWidth = 6
        ctx.strokeStyle = 'rgba(5, 12, 24, 0.85)'
        ctx.strokeText(this.banner.title, 0, 0)
        ctx.fillStyle = GOLD
        ctx.fillText(this.banner.title, 0, 0)
        if (this.banner.sub) {
            ctx.font = `800 ${Math.round(Math.min(15, canvas.width / 28))}px ${FONT}`
            ctx.lineWidth = 4
            ctx.strokeText(this.banner.sub, 0, 30)
            ctx.fillStyle = '#ffffff'
            ctx.fillText(this.banner.sub, 0, 30)
        }
        ctx.restore()
    }

    /**
     * The shift on the floor: during the grace period the tiles about to drop away pulse red,
     * faster as time runs out; during the shift they're a dark void. The floor's edge is outlined.
     */
    private drawShiftFloor(ctx: CanvasRenderingContext2D, state: any, view: View, timestamp: number): void {
        const floor: string = state.floor
        if (!floor) return
        const grid = SHIFT.GRID
        const tile = state.worldWidth / grid
        const grace = state.shiftPhase === 'grace'
        let fill = 'rgba(1, 3, 8, 0.93)'
        if (grace) {
            const left = Math.max(0, Math.min(1, (state.phaseEndsAt - this.worldNow(state, timestamp)) / SHIFT.GRACE_MS))
            const speed = 4 + (1 - left) * 14
            fill = `rgba(255, 80, 80, ${0.16 + 0.16 * (0.5 + 0.5 * Math.sin((timestamp / 1000) * speed))})`
        }
        const firstCol = Math.max(0, Math.floor((view.x - view.width / 2) / tile))
        const lastCol = Math.min(grid - 1, Math.floor((view.x + view.width / 2) / tile))
        const firstRow = Math.max(0, Math.floor((view.y - view.height / 2) / tile))
        const lastRow = Math.min(grid - 1, Math.floor((view.y + view.height / 2) / tile))
        const isVoid = (row: number, col: number) => row >= 0 && row < grid && col >= 0 && col < grid && floor[row * grid + col] === '0'
        ctx.save()
        ctx.fillStyle = fill
        for (let row = firstRow; row <= lastRow; row++) {
            for (let col = firstCol; col <= lastCol; col++) {
                if (isVoid(row, col)) ctx.fillRect(col * tile, row * tile, tile, tile)
            }
        }
        ctx.strokeStyle = grace ? 'rgba(255, 130, 130, 0.9)' : 'rgba(79, 209, 197, 0.7)'
        ctx.lineWidth = 4
        ctx.setLineDash(grace ? [16, 10] : [])
        ctx.beginPath()
        for (let row = firstRow; row <= lastRow; row++) {
            for (let col = firstCol; col <= lastCol; col++) {
                if (isVoid(row, col)) continue
                const x = col * tile
                const y = row * tile
                if (isVoid(row - 1, col)) { ctx.moveTo(x, y); ctx.lineTo(x + tile, y) }
                if (isVoid(row + 1, col)) { ctx.moveTo(x, y + tile); ctx.lineTo(x + tile, y + tile) }
                if (isVoid(row, col - 1)) { ctx.moveTo(x, y); ctx.lineTo(x, y + tile) }
                if (isVoid(row, col + 1)) { ctx.moveTo(x + tile, y); ctx.lineTo(x + tile, y + tile) }
            }
        }
        ctx.stroke()
        ctx.restore()
    }

    /** The jackpot crystal: a shadow while it drops, then a big crystal with a ring showing the claim */
    private drawJackpot(ctx: CanvasRenderingContext2D, state: any, localId: string | null, timestamp: number): void {
        if (!state.jackpotOn) return
        const x = state.jackpotX
        const y = state.jackpotY
        const untilLanding = state.jackpotLandsAt - this.worldNow(state, timestamp)
        ctx.save()
        if (untilLanding > 0) {
            const fall = 1 - Math.min(1, untilLanding / (SHIFT.DROP_MS * 1.5))
            ctx.fillStyle = `rgba(0, 0, 0, ${0.2 + 0.35 * fall})`
            ctx.beginPath()
            ctx.ellipse(x, y + 16, 20 + 30 * fall, 8 + 12 * fall, 0, 0, Math.PI * 2)
            ctx.fill()
            drawCrystal(ctx, x, y - (1 - fall) * 160, 30)
            ctx.restore()
            return
        }
        drawCrystal(ctx, x, y, 30 * (1 + 0.06 * Math.sin(timestamp / 150)))
        if (state.jackpotProgress > 0) {
            ctx.strokeStyle = state.jackpotHolder === localId ? GOLD : '#ffffff'
            ctx.lineWidth = 5
            ctx.beginPath()
            ctx.arc(x, y, 44, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * state.jackpotProgress)
            ctx.stroke()
        }
        ctx.font = `700 16px ${FONT}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'bottom'
        ctx.fillStyle = GOLD
        ctx.fillText(`+${SHIFT.JACKPOT_VALUE}`, x, y - 40)
        ctx.restore()
    }

    /** A chip at the top: a shift coming up, its grace period, or how long until the arena returns */
    private drawShiftChip(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: any, timestamp: number): void {
        const left = Math.max(0, Math.ceil((state.phaseEndsAt - this.worldNow(state, timestamp)) / 1000))
        let text = ''
        if (state.shiftPhase === 'grace') text = `New floor! Get on it · ${left}`
        else if (state.shiftPhase === 'shift') text = `Arena returns in ${left}`
        else if (left <= 10) text = `Arena shift in ${left}`
        if (!text) return
        const urgent = state.shiftPhase === 'grace'
        // On narrow screens the chip sits below the leaderboard
        const y = canvas.width < 560 ? 30 + Math.min(6, state.players.size) * 18 : 12
        ctx.save()
        ctx.font = `700 ${urgent ? 15 : 13}px ${FONT}`
        const width = ctx.measureText(text).width + 32
        ctx.fillStyle = urgent ? 'rgba(120, 20, 20, 0.85)' : 'rgba(5, 12, 24, 0.8)'
        roundedRect(ctx, (canvas.width - width) / 2, y, width, 30, 15)
        ctx.fill()
        ctx.strokeStyle = urgent ? 'rgba(255, 130, 130, 0.9)' : 'rgba(79, 209, 197, 0.7)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, canvas.width / 2, y + 15)
        ctx.restore()
    }

    /** "Traffic incoming 3" just before a traffic wave */
    private drawTrafficChip(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: any, timestamp: number): void {
        if (state.trafficWave !== 'warning') return
        const left = Math.max(1, Math.ceil((state.waveAt - this.worldNow(state, timestamp)) / 1000))
        const text = `Traffic incoming ${left}`
        const y = canvas.width < 560 ? 30 + Math.min(6, state.players.size) * 18 : 12
        ctx.save()
        ctx.font = `700 14px ${FONT}`
        const width = ctx.measureText(text).width + 32
        ctx.fillStyle = 'rgba(60, 38, 5, 0.85)'
        roundedRect(ctx, (canvas.width - width) / 2, y, width, 30, 15)
        ctx.fill()
        ctx.strokeStyle = 'rgba(255, 196, 64, 0.9)'
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.fillStyle = '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(text, canvas.width / 2, y + 15)
        ctx.restore()
    }

    /**
     * Gravity theft: every gem stolen pops out of the victim and arcs into the thief's mouth, so you
     * can watch them shrink, with a faint gold tether between the two while the stream runs
     */
    /** Someone held at a mouth, about to be swallowed: a red ring closes in on them (they're still free if they get away first) */
    private drawGulps(ctx: CanvasRenderingContext2D, state: any, timestamp: number): void {
        const now = this.worldNow(state, timestamp)
        state.players?.forEach((eater: any) => {
            if (!eater.gulping) return
            const prey = state.players.get(eater.gulping)
            if (!prey || prey.state !== 'alive') return
            const left = Math.max(0, Math.min(1, (eater.gulpEndsAt - now) / INHALE.GULP_MS))
            const at = this.centerOf(eater.gulping, prey)
            ctx.save()
            ctx.strokeStyle = `rgba(255, 107, 107, ${0.55 + 0.45 * (1 - left)})`
            ctx.lineWidth = 3
            ctx.beginPath()
            ctx.arc(at.x, at.y, prey.width / 2 + 4 + 24 * left, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
        })
    }

    /** Drained creatures: each shrinks away to nothing where it was, with a last ring of gold */
    private drawVanishes(ctx: CanvasRenderingContext2D, timestamp: number): void {
        const now = performance.now()
        const VANISH_MS = 550
        this.vanishes = this.vanishes.filter((v) => now - v.at < VANISH_MS)
        for (const v of this.vanishes) {
            const k = (now - v.at) / VANISH_MS
            ctx.save()
            ctx.globalAlpha = 1 - k * 0.6
            drawCreature(ctx, v.x, v.y, Math.max(1, v.size * Math.pow(1 - k, 1.6)), v.color, v.facing, timestamp)
            ctx.globalAlpha = (1 - k) * 0.8
            ctx.strokeStyle = '#ffd166'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(v.x, v.y, v.size * 0.5 + 30 * k, 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
        }
    }

    private drawTheft(ctx: CanvasRenderingContext2D, state: any, timestamp: number): void {
        const now = performance.now()
        const thieves = new Set<string>()
        state.players.forEach((thief: any, id: string) => {
            if (!thief.stealingFrom) return
            const victim = state.players.get(thief.stealingFrom)
            if (!victim) return
            thieves.add(id)
            // Each gem the thief just took pops out of the victim and heads for the thief (counted per thief, so it works both ways at once)
            const total = Number(thief.stolenTotal) || 0
            const had = this.theftGems.get(id) ?? total
            for (let i = 0; i < Math.min(8, total - had); i++) {
                this.theftParticles.push({ from: thief.stealingFrom, to: id, at: now + i * 45, angle: Math.random() * Math.PI * 2, flight: INHALE_LOOK.THEFT_FLIGHT_MS / Math.sqrt(suctionPower(thief.width)), power: suctionPower(thief.width) })
            }
            this.theftGems.set(id, total)
            const a = this.centerOf(thief.stealingFrom, victim)
            const b = this.centerOf(id, thief)
            ctx.save()
            ctx.strokeStyle = 'rgba(255, 209, 102, 0.25)'
            ctx.lineWidth = 2
            ctx.setLineDash([4, 8])
            ctx.lineDashOffset = -timestamp / 20
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
            ctx.restore()
        })
        for (const id of [...this.theftGems.keys()]) if (!thieves.has(id)) this.theftGems.delete(id)
        // The stolen gems in flight: out of the victim's body, a little arc, then sucked into the mouth
        this.theftParticles = this.theftParticles.filter((p) => now - p.at < p.flight)
        for (const p of this.theftParticles) {
            const t = (now - p.at) / p.flight
            if (t < 0) continue
            const victim = state.players.get(p.from)
            const thief = state.players.get(p.to)
            if (!victim || !thief) continue
            const a = this.centerOf(p.from, victim)
            const b = this.centerOf(p.to, thief)
            const facing = thief.facing ?? 0
            const mouthX = b.x + Math.cos(facing) * thief.width * 0.35
            const mouthY = b.y + Math.sin(facing) * thief.width * 0.35
            const startX = a.x + Math.cos(p.angle) * victim.width * 0.45
            const startY = a.y + Math.sin(p.angle) * victim.width * 0.45
            const ease = t * t
            const lift = Math.sin(t * Math.PI) * 18
            const x = startX + (mouthX - startX) * ease
            const y = startY + (mouthY - startY) * ease - lift
            const g = 6.5 * (0.9 + 0.1 * p.power) * (1 - t * 0.5)
            ctx.save()
            ctx.shadowColor = 'rgba(255, 209, 102, 0.9)'
            ctx.shadowBlur = 6 + 4 * p.power
            ctx.fillStyle = '#ffd166'
            ctx.beginPath()
            ctx.moveTo(x, y - g)
            ctx.lineTo(x + g * 0.7, y)
            ctx.lineTo(x, y + g)
            ctx.lineTo(x - g * 0.7, y)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
        }
    }

    /** Where a player is drawn this frame (its center) */
    private centerOf(id: string, player: any): { x: number; y: number } {
        const at = this.drawnPositions.get(id) ?? player
        return { x: at.x + player.width / 2, y: at.y + player.height / 2 }
    }

    /** Bomb blasts: a bright flash, then a ring racing out to the edge of the blast */
    private drawBlasts(ctx: CanvasRenderingContext2D, timestamp: number): void {
        this.blasts = this.blasts.filter((blast) => timestamp - blast.at < 500)
        for (const blast of this.blasts) {
            const t = Math.max(0, (timestamp - blast.at) / 500)
            ctx.save()
            if (t < 0.3) {
                ctx.fillStyle = `rgba(255, 220, 150, ${0.55 * (1 - t / 0.3)})`
                ctx.beginPath()
                ctx.arc(blast.x, blast.y, blast.radius * (0.4 + t), 0, Math.PI * 2)
                ctx.fill()
            }
            ctx.strokeStyle = `rgba(255, 140, 80, ${0.9 * (1 - t)})`
            ctx.lineWidth = 6 * (1 - t) + 1
            ctx.beginPath()
            ctx.arc(blast.x, blast.y, blast.radius * Math.min(1, 0.3 + t * 1.2), 0, Math.PI * 2)
            ctx.stroke()
            ctx.restore()
        }
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
                    // Stealing: a "+1" for each gem coming in (head-on, whoever is winning the exchange); otherwise what you grabbed
                    const gained = player.gems - before.gems
                    if (player.stealingFrom) for (let i = 0; i < gained; i++) this.pickups.push({ amount: 1, at: timestamp + i * 70 })
                    else this.pickups.push({ amount: gained, at: timestamp })
                } else if (id === localId && player.gems < before.gems && this.beingRobbed(state, id)) {
                    // Gems pulled out of you: a "-1" for each one, one after another
                    for (let i = 0; i < before.gems - player.gems; i++) this.pickups.push({ amount: -1, at: timestamp + i * 70 })
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

    /** Gems lying around, and sprayed ones sliding to a stop (eased, like other players) */
    /** Turbines, under the gems and players: warnings, the intake's suction, the exhaust's wind, and the machines */
    private drawTurbines(ctx: CanvasRenderingContext2D, state: any, timestamp: number): void {
        if (!state.turbines?.length) return
        const now = this.worldNow(state, timestamp)
        state.turbines.forEach((turbine: any) => {
            if (turbine.phase === 'warning') {
                const progress = Math.max(0, Math.min(1, 1 - (turbine.phaseEndsAt - now) / TURBINE.WARNING_MS))
                drawTurbineWarning(ctx, turbine.x, turbine.y, turbine.intake, progress, timestamp)
                return
            }
            const power = turbine.phase === 'ending' ? Math.max(0, Math.min(1, (turbine.phaseEndsAt - now) / TURBINE.POWER_DOWN_MS)) : 1
            const exhaust = exhaustAngle(turbine.intake, turbine.sweepFrom, now)
            drawIntakeWind(ctx, turbine.x, turbine.y, turbine.intake, power, timestamp)
            drawExhaustWind(ctx, turbine.x, turbine.y, exhaust, power, timestamp)
            drawTurbineBody(ctx, turbine.x, turbine.y, turbine.intake, exhaust, power, timestamp)
        })
    }

    /**
     * Gems on their way through turbines, over everything: out of the victim's body (a pop where it
     * leaves), rushing into the intake, then across the machine to the exhaust. Everyone sees the
     * same ones, timed by the server; once fired, the gem itself takes over (see drawGems).
     */
    private drawTurbineFlights(ctx: CanvasRenderingContext2D, state: any, timestamp: number): void {
        if (!state.flights?.size) return
        const now = this.worldNow(state, timestamp)
        const turbines = new Map<string, any>()
        state.turbines?.forEach((turbine: any) => turbines.set(turbine.id, turbine))
        const r = TURBINE.BODY_RADIUS
        state.flights.forEach((flight: any) => {
            const turbine = turbines.get(flight.turbine)
            if (!turbine || now >= flight.fireAt) return
            const mouthX = turbine.x + Math.cos(turbine.intake) * r
            const mouthY = turbine.y + Math.sin(turbine.intake) * r
            if (now < flight.arriveAt) {
                const k = Math.max(0, Math.min(1, (now - flight.startAt) / Math.max(1, flight.arriveAt - flight.startAt)))
                if (k < 0.25) {
                    // Popping out of the victim
                    ctx.strokeStyle = `rgba(255, 209, 102, ${0.8 * (1 - k * 4)})`
                    ctx.lineWidth = 2
                    ctx.beginPath()
                    ctx.arc(flight.fromX, flight.fromY, 6 + 40 * k, 0, Math.PI * 2)
                    ctx.stroke()
                }
                for (let back = 2; back >= 0; back--) {
                    const e = Math.max(0, k - back * 0.06) ** 2
                    ctx.globalAlpha = back ? 0.25 / back : 1
                    drawGem(ctx, flight.fromX + (mouthX - flight.fromX) * e, flight.fromY + (mouthY - flight.fromY) * e, GEMS.RADIUS * (1 - back * 0.15))
                }
                ctx.globalAlpha = 1
                return
            }
            // Across the machine, from the intake to where the exhaust will be pointing when it fires
            const k = (now - flight.arriveAt) / Math.max(1, flight.fireAt - flight.arriveAt)
            const out = exhaustAngle(turbine.intake, turbine.sweepFrom, flight.fireAt)
            const nx = turbine.x + Math.cos(out) * r
            const ny = turbine.y + Math.sin(out) * r
            const a = (1 - k) * (1 - k)
            const b = 2 * (1 - k) * k
            const c = k * k
            ctx.globalAlpha = 0.85
            drawGem(ctx, a * mouthX + b * turbine.x + c * nx, a * mouthY + b * turbine.y + c * ny, GEMS.RADIUS * 0.75)
            ctx.globalAlpha = 1
        })
    }

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
        const localId = this.multiplayerManager?.localSessionId
        const clock = this.worldNow(state, timestamp)
        state.gems?.forEach((gem: any, id: string) => {
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
                drawGem(ctx, drawn.x, drawn.y - (1 - fall) * 90, radius)
                return
            }
            this.fallingSince.delete(id)
            if (gem.locked && gem.owner === localId) {
                // Your own spilled gem: faded until you can grab it back
                ctx.globalAlpha = 0.35
                drawGem(ctx, drawn.x, drawn.y, radius)
                ctx.globalAlpha = 1
                return
            }
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

    /** Whether anyone is stealing gems from this player right now */
    private beingRobbed(state: any, id: string): boolean {
        let robbed = false
        state.players.forEach((other: any) => {
            if (other.stealingFrom === id) robbed = true
        })
        return robbed
    }

    /** "+1" rising above you when you grab gems, and a red "-1" for each one someone steals */
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
            if (t < 0) continue
            ctx.globalAlpha = 1 - t
            ctx.fillStyle = pickup.amount > 0 ? GOLD : '#ff6b6b'
            ctx.fillText(pickup.amount > 0 ? `+${pickup.amount}` : `${pickup.amount}`, position.x + me.width / 2, position.y - 30 - t * 34)
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
        const ranked: { id: string; name: string; gems: number; isBot: boolean }[] = []
        state.players.forEach((player: any, id: string) => {
            ranked.push({ id, name: String(player.name), gems: player.gems, isBot: player.isBot === true })
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
            let nameX = x + 28
            if (row.isBot) {
                drawRobot(ctx, x + 34, rowY, 10)
                nameX += 14
            }
            ctx.fillStyle = isLocal ? '#ffffff' : 'rgba(207, 216, 220, 0.9)'
            ctx.textAlign = 'left'
            ctx.fillText(row.name, nameX, rowY, width - 70 - (nameX - x - 28))
            ctx.fillStyle = GOLD
            ctx.textAlign = 'right'
            ctx.fillText(String(row.gems), x + width - 10, rowY)
        })
        ctx.restore()
    }

    /** Recent notices at the top right, newest first, fading out */
    private drawNotices(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement): void {
        const now = performance.now()
        this.notices = this.notices.filter((notice) => now - notice.at < JOIN_NOTICE_MS)
        let y = this.controls?.touchDevice ? this.minimapBottom + 12 : 12
        ctx.save()
        for (const notice of [...this.notices].reverse()) {
            ctx.globalAlpha = Math.min(1, (JOIN_NOTICE_MS - (now - notice.at)) / 500)
            ctx.font = `${notice.strong ? 700 : 600} ${notice.strong ? 14 : 13}px ${FONT}`
            // Leave room for the leaderboard on the left
            const width = Math.min(canvas.width - 150, ctx.measureText(notice.text).width + 28)
            ctx.fillStyle = notice.strong ? 'rgba(60, 40, 0, 0.85)' : 'rgba(5, 12, 24, 0.75)'
            roundedRect(ctx, canvas.width - width - 12, y, width, 26, 13)
            ctx.fill()
            ctx.fillStyle = notice.strong ? GOLD : '#ffffff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText(notice.text, canvas.width - width / 2 - 12, y + 13, width - 20)
            y += 32
        }
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
        // The credit and the knockout can land a frame or two apart, in either order
        const cause = this.knockoutCause
        const credited = cause !== null && this.knockedOutAt !== null && Math.abs(cause.at - this.knockedOutAt) < 1500
        const verb =
            cause?.how === 'ate' ? 'Swallowed'
            : cause?.how === 'drained' ? 'Drained'
            : cause?.how === 'turbine' ? 'Fed to a turbine'
            : cause?.how === 'bomb' ? 'Blown up'
            : cause?.how === 'edge' ? 'Shoved off'
            : cause?.how === 'traffic' ? 'Wrecked'
            : 'Knocked out'
        const title = credited && cause ? `${verb} by ${cause.by}` : 'Hit!'
        this.drawMessage(ctx, canvas, title, seconds > 0 ? `Back in ${seconds}` : 'Back in a moment')
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
        // Shrink a long title (like one with a long player name) to fit, rather than squashing it
        let titleSize = Math.round(Math.min(canvas.height * 0.09, canvas.width * 0.1))
        ctx.font = `700 ${titleSize}px ${FONT}`
        const titleWidth = ctx.measureText(title).width
        if (titleWidth > canvas.width * 0.9) {
            titleSize = Math.floor((titleSize * canvas.width * 0.9) / titleWidth)
            ctx.font = `700 ${titleSize}px ${FONT}`
        }
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
