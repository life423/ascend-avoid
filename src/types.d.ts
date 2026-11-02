/** Shared client contracts and browser globals. Network types are generated in types/synced.ts. */

export interface GameObject {
    x: number
    y: number
    width: number
    height: number
    update(deltaTime: number, ...args: any[]): void
    render(ctx: CanvasRenderingContext2D, scalingInfo?: ScalingInfo | number): void
}

export interface InputState {
    up: boolean
    down: boolean
    left: boolean
    right: boolean
    restart?: boolean  // Made optional since many places don't provide it
    shoot?: boolean
    [key: string]: boolean | undefined
}

export interface ScalingInfo {
    scaleX?: number
    scaleY?: number
    offsetX?: number
    offsetY?: number
    canvasWidth?: number
    canvasHeight?: number
    baseWidth?: number
    baseHeight?: number
    devicePixelRatio?: number
    isDesktop?: boolean
    isMobile?: boolean
    isTablet?: boolean
    // Legacy support for existing code
    widthScale: number
    heightScale: number
    pixelRatio: number
    reducedResolution?: boolean
}

export interface PerformanceStats {
    fps?: number
    frameTime?: number
    averageFrameTime?: number
    memoryUsage?: number
    renderTime?: number
    updateTime?: number
    // Legacy support for existing code
    avgFrameTime: number
    maxFrameTime: number
    minFrameTime: number
    frameCount: number
}

export interface GameConfig {
    STATE?: {
        READY: string
        WAITING: string
        STARTING: string
        PLAYING: string
        PAUSED: string
        GAME_OVER: string
    }
    WINNING_LINE?: number
    DEBUG_MODE?: boolean
    DESKTOP_MODE?: boolean
    OBSTACLE_MIN_WIDTH_RATIO?: number
    OBSTACLE_MAX_WIDTH_RATIO?: number
    MAX_CARS?: number
    KEYS?: {
        UP: string[]
        DOWN: string[]
        LEFT: string[]
        RIGHT: string[]
        RESTART: string[]
        SHOOT?: string[]
    }
}

declare global {
    interface Window {
        game?: {
            onResize?: (
                widthScale: number,
                heightScale: number,
                isDesktop: boolean
            ) => void
            pause?: () => void
            resume?: () => void
            restart?: () => void
            toggleMultiplayer?: () => void
            getStats?: () => PerformanceStats
            [key: string]: any
        }
        devicePixelRatio: number
    }
}
