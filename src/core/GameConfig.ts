/**
 * A class to encapsulate game configuration, avoiding mutation of global constants
 * and providing clean access to game settings based on platform.
 * Now with TypeScript support.
 */
import {
    DESKTOP_SETTINGS,
    GAME,
    KEYS,
    OBSTACLE,
    PLAYER,
} from '../../server/constants/gameConstants'
// The same state names the multiplayer server uses
import { STATE as GAME_STATE } from '../../server/constants/gameConstants'
import { GameConfig as GameConfigInterface } from '../types'

interface GameSettings {
    WINNING_LINE: number
    BASE_SPEED: number
    PLAYER_SIZE_RATIO: number
    MIN_STEP: number
    OBSTACLE_MIN_WIDTH_RATIO: number
    OBSTACLE_MAX_WIDTH_RATIO: number
    MAX_CARS: number
    DIFFICULTY_INCREASE_RATE: number
}

interface DebugSettings {
    enabled: boolean
    showCollisions: boolean
    showFPS: boolean
}

export default class GameConfig implements GameConfigInterface {
    private settings: GameSettings
    private debug: DebugSettings
    // private isDesktop: boolean; // Unused for now

    // Game state constants - use the standardized ones from constants
    public readonly STATE = GAME_STATE

    // Optional properties added by performance optimization
    deviceTier?: string
    targetFPS?: number

    /**
     * Creates a new GameConfig instance
     * @param options - Configuration options
     */
    constructor({ isDesktop = false }: { isDesktop?: boolean } = {}) {
        const params = new URLSearchParams(window.location.search)
        const debugFlag = params.get('debug') === 'true'

        this.settings = this.buildBaseSettings(isDesktop)
        // this.isDesktop = isDesktop; // Stored in settings instead
        this.debug = {
            enabled: debugFlag,
            showCollisions: debugFlag,
            showFPS: debugFlag,
        }
    }

    private buildBaseSettings(isDesktop: boolean): GameSettings {
        const base = {
            WINNING_LINE: GAME.WINNING_LINE,
            BASE_SPEED: OBSTACLE.BASE_SPEED,
            PLAYER_SIZE_RATIO: PLAYER.SIZE_RATIO,
            MIN_STEP: PLAYER.MIN_STEP,
            OBSTACLE_MIN_WIDTH_RATIO: OBSTACLE.MIN_WIDTH_RATIO,
            OBSTACLE_MAX_WIDTH_RATIO: OBSTACLE.MAX_WIDTH_RATIO,
            MAX_CARS: GAME.MAX_OBSTACLES,
            DIFFICULTY_INCREASE_RATE: GAME.DIFFICULTY_INCREASE_RATE,
        }
        return isDesktop ? { ...base, ...DESKTOP_SETTINGS } : base
    }
    /**
     * Update desktop mode setting
     * @param isDesktop - Whether the game is running on desktop
     */
    setDesktopMode(isDesktop: boolean): void {
        // this.isDesktop = isDesktop; // No longer needed as property
        this.settings = this.buildBaseSettings(isDesktop)
    }

    /**
     * Get the winning line position, scaled by the canvas height ratio if needed
     * @param canvasHeight - Current canvas height (optional)
     * @param baseCanvasHeight - Base canvas height (optional)
     * @returns The winning line position
     */
    getWinningLine(canvasHeight?: number, baseCanvasHeight?: number): number {
        const winningLine = this.settings.WINNING_LINE

        // If canvas dimensions are provided, scale the winning line
        if (canvasHeight && baseCanvasHeight) {
            return winningLine * (canvasHeight / baseCanvasHeight)
        }

        return winningLine
    }

    /**
     * Get the minimum obstacle width ratio
     * @returns The minimum obstacle width ratio
     */
    getObstacleMinWidthRatio(): number {
        return this.settings.OBSTACLE_MIN_WIDTH_RATIO
    }

    /**
     * Get the maximum obstacle width ratio
     * @returns The maximum obstacle width ratio
     */
    getObstacleMaxWidthRatio(): number {
        return this.settings.OBSTACLE_MAX_WIDTH_RATIO
    }

    /**
     * Get the maximum number of obstacles/cars
     * @returns The maximum number of cars
     */
    getMaxCars(): number {
        return this.settings.MAX_CARS
    }

    /**
     * Check if debug mode is enabled
     * @returns Whether debug mode is enabled
     */
    isDebugEnabled(): boolean {
        return this.debug.enabled
    }

    /**
     * Check if collision debugging is enabled
     * @returns Whether collision debugging is enabled
     */
    showCollisions(): boolean {
        return this.debug.showCollisions
    }

    /**
     * Get the key mappings
     * @returns The key mappings
     */
    getKeys(): Record<string, readonly string[]> {
        return KEYS
    }
}
