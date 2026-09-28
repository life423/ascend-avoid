/**
 * Manages responsive design and performance adaptations for the game
 * Handles canvas scaling, UI adjustments, and performance optimizations
 * based on device/screen size and capabilities
 */
import { CANVAS, DEVICE_SETTINGS } from '../constants/gameConstants'
import { ScalingInfo } from '../types'

// Define types for ResponsiveManager
interface DeviceCapabilities {
    highPerformance: boolean
    canUseWebGL: boolean
    maxParticles: number
    targetFPS: number
    deviceTier: 'high' | 'medium' | 'low'
    memoryLimit: 'high' | 'medium' | 'low'
    deviceProfile: DeviceProfile | null
}

interface DeviceProfile {
    userAgent: string
    hardwareConcurrency: number
    deviceMemory: number
    screenSize: {
        width: number
        height: number
        pixelRatio: number
    }
    perfScore: number
    webGL: boolean
}

// Game interface (minimal for type safety)
interface Game {
    particleSystem?: {
        setMaxParticles: (max: number) => void
    } | null
    config?: {
        deviceTier?: string
        targetFPS?: number
    }
    [key: string]: any // Allow additional properties
}

export default class ResponsiveManager {
    game: Game
    canvas: HTMLCanvasElement | null
    baseCanvasWidth: number
    baseCanvasHeight: number
    isDesktop: boolean
    deviceSettings: any
    scalingInfo: ScalingInfo
    capabilities: DeviceCapabilities
    onResize?: (
        widthScale: number,
        heightScale: number,
        isDesktop: boolean
    ) => void

    /**
     * Creates a new ResponsiveManager instance
     * @param game - Reference to the game instance
     */
    private resizeObserver: ResizeObserver | null = null
    private boundResize = (): void => this.handleResize()
    private boundVisibilityChange = (): void => this.handleVisibilityChange()

    constructor(game: Game) {
        this.game = game
        this.canvas = null
        this.baseCanvasWidth = CANVAS.BASE_WIDTH
        this.baseCanvasHeight = CANVAS.BASE_HEIGHT

        // Current device settings
        this.isDesktop = this.detectDesktop()
        this.deviceSettings = this.isDesktop
            ? DEVICE_SETTINGS.DESKTOP
            : DEVICE_SETTINGS.MOBILE

        // Scaling information
        this.scalingInfo = {
            widthScale: 1,
            heightScale: 1,
            pixelRatio: window.devicePixelRatio || 1,
            reducedResolution: false,
        }

        // Performance capabilities
        this.capabilities = {
            highPerformance: true,
            canUseWebGL: false,
            maxParticles: 500,
            targetFPS: 60,
            deviceTier: 'high', // 'high', 'medium', 'low'
            memoryLimit: 'high', // 'high', 'medium', 'low'
            deviceProfile: null, // Will hold detailed performance analysis
        }
    }

    /**
     * Initialize the responsive manager with a canvas
     * @param canvas - The game canvas
     */
    init(canvas: HTMLCanvasElement): void {
        this.canvas = canvas

        // Set up event listeners
        this.setupEventListeners()

        // Detect device capabilities
        this.detectDeviceCapabilities().then(capabilities => {
            this.capabilities = capabilities
            console.log('Device capabilities detected:', this.capabilities)

            // Apply performance settings based on capabilities
            this.applyPerformanceSettings()
        })

        // Initial resize
        this.handleResize()
    }

    /**
     * Set up event listeners for responsive behavior
     */
    setupEventListeners(): void {
        window.addEventListener('resize', this.boundResize)
        window.addEventListener('orientationchange', this.boundResize)
        document.addEventListener('visibilitychange', this.boundVisibilityChange)

        // Refit whenever the canvas's container changes size: rotation, mobile toolbars
        // showing or hiding, touch controls appearing
        const container = this.canvas?.parentElement
        if (container && typeof ResizeObserver !== 'undefined') {
            this.resizeObserver = new ResizeObserver(this.boundResize)
            this.resizeObserver.observe(container)
        }
    }

    /**
     * Handle window resize event
     */
    handleResize(): void {
        // Re-check device type
        const wasDesktop = this.isDesktop
        this.isDesktop = this.detectDesktop()

        // Update device settings if device type changed
        if (wasDesktop !== this.isDesktop) {
            this.deviceSettings = this.isDesktop
                ? DEVICE_SETTINGS.DESKTOP
                : DEVICE_SETTINGS.MOBILE
        }

        // Resize canvas
        this.resizeCanvas()

        // Execute callback if provided
        if (this.onResize) {
            this.onResize(
                this.scalingInfo.widthScale,
                this.scalingInfo.heightScale,
                this.isDesktop
            )
        }
    }

    /**
     * Handle document visibility change (active tab changes)
     */
    handleVisibilityChange(): void {
        if (document.visibilityState === 'visible') {
            // Force a resize check when tab becomes visible again
            this.handleResize()
        }
    }

    /**
     * Detect if current viewport is desktop sized
     * @returns Whether the current viewport is desktop sized
     */
    detectDesktop(): boolean {
        // Use a more practical detection method that works with browser automation
        const isWideScreen = window.innerWidth >= 800 // Lower threshold to match browser viewport
        const hasLargeHeight = window.innerHeight >= 500

        // Consider desktop if screen is both wide and tall enough
        // This is more reliable than pointer detection which can fail in automation
        const isDesktopSize = isWideScreen && hasLargeHeight

        console.log(
            `Desktop detection: width=${window.innerWidth}, height=${window.innerHeight}, isDesktop=${isDesktopSize}`
        )

        return isDesktopSize
    }

    /**
     * Fit the canvas (600×700 proportions) inside its container. CSS decides how much room
     * the container gets (the header, touch controls and sidebar take theirs first), so this
     * never has to guess the size of anything else on the page.
     */
    resizeCanvas(): void {
        if (!this.canvas) return
        const container = this.canvas.parentElement
        if (!container) return

        const box = getComputedStyle(container)
        const availableWidth =
            container.clientWidth - parseFloat(box.paddingLeft) - parseFloat(box.paddingRight)
        const availableHeight =
            container.clientHeight - parseFloat(box.paddingTop) - parseFloat(box.paddingBottom)
        if (availableWidth <= 0 || availableHeight <= 0) return

        // The canvas border sits inside its CSS size (border-box), so leave room for it
        const canvasBox = getComputedStyle(this.canvas)
        const borderX = parseFloat(canvasBox.borderLeftWidth) + parseFloat(canvasBox.borderRightWidth)
        const borderY = parseFloat(canvasBox.borderTopWidth) + parseFloat(canvasBox.borderBottomWidth)

        const scale = Math.min(
            (availableWidth - borderX) / this.baseCanvasWidth,
            (availableHeight - borderY) / this.baseCanvasHeight
        )
        const width = Math.max(1, Math.floor(this.baseCanvasWidth * scale))
        const height = Math.max(1, Math.floor(this.baseCanvasHeight * scale))

        this.scalingInfo = {
            widthScale: width / this.baseCanvasWidth,
            heightScale: height / this.baseCanvasHeight,
            pixelRatio: 1,
            reducedResolution: false,
        }
        // Resizing clears the canvas, so skip it when nothing changed
        if (this.canvas.width === width && this.canvas.height === height) return

        this.canvas.style.width = `${width + borderX}px`
        this.canvas.style.height = `${height + borderY}px`
        this.canvas.style.display = 'block'
        this.canvas.width = width
        this.canvas.height = height
        this.canvas.getContext('2d')?.setTransform(1, 0, 0, 1, 0, 0)
    }

    /**
     * Get the current device settings
     * @returns The current device settings
     */
    getDeviceSettings(): any {
        return this.deviceSettings
    }

    /**
     * Get the current scaling information
     * @returns The current scaling information
     */
    getScalingInfo(): ScalingInfo {
        return this.scalingInfo
    }

    /**
     * Check if the current device is desktop
     * @returns Whether the current device is desktop
     */
    isDesktopDevice(): boolean {
        return this.isDesktop
    }

    /**
     * Calculate a responsive value based on the base value and scaling
     * @param baseValue - The base value
     * @param dimension - The dimension to scale by ('width', 'height', or 'both')
     * @returns The scaled value
     */
    getResponsiveValue(
        baseValue: number,
        dimension: 'width' | 'height' | 'both' = 'both'
    ): number {
        if (dimension === 'width') {
            return baseValue * this.scalingInfo.widthScale
        } else if (dimension === 'height') {
            return baseValue * this.scalingInfo.heightScale
        } else {
            // Use average scaling for 'both'
            const avgScale =
                (this.scalingInfo.widthScale + this.scalingInfo.heightScale) / 2
            return baseValue * avgScale
        }
    }

    /**
     * Detect device capabilities for performance optimizations
     * @returns A promise that resolves to device capabilities
     */
    async detectDeviceCapabilities(): Promise<DeviceCapabilities> {
        const capabilities: DeviceCapabilities = {
            highPerformance: true,
            canUseWebGL: false,
            maxParticles: 500,
            targetFPS: 60,
            deviceTier: 'high',
            memoryLimit: 'high', // 'high', 'medium', 'low'
            deviceProfile: null,
        }

        // Check for mobile/low-end devices based on user agent
        const isMobile = /Android|iPhone|iPad|iPod|IEMobile|Opera Mini/i.test(
            navigator.userAgent
        )
        const isLowEndMobile =
            /Android 4|Android 5|iPhone 6|iPhone 7|iPhone 8|iPad Mini/i.test(
                navigator.userAgent
            )

        // Check hardware capabilities
        const hardwareConcurrency = navigator.hardwareConcurrency || 2
        const deviceMemory = (navigator as any).deviceMemory || 4

        // Check WebGL support
        try {
            const canvas = document.createElement('canvas')
            const gl =
                canvas.getContext('webgl') ||
                (canvas.getContext(
                    'experimental-webgl'
                ) as WebGLRenderingContext | null)
            capabilities.canUseWebGL = !!gl

            // Additional WebGL capabilities check if supported
            if (gl) {
                // Check for WebGL extensions
                interface WebGLDebugRendererInfo {
                    UNMASKED_VENDOR_WEBGL: number
                    UNMASKED_RENDERER_WEBGL: number
                }

                const debugInfo = gl.getExtension(
                    'WEBGL_debug_renderer_info'
                ) as WebGLDebugRendererInfo | null
                if (debugInfo) {
                    const renderer = gl.getParameter(
                        debugInfo.UNMASKED_RENDERER_WEBGL
                    ) as string
                    console.log(`WebGL Renderer: ${renderer}`)

                    // Detect low-end GPUs
                    const isLowEndGPU =
                        /Intel|HD Graphics|GMA|Mali-4|Mali-T|Adreno 3|PowerVR/i.test(
                            renderer
                        )
                    if (isLowEndGPU) {
                        capabilities.highPerformance = false
                    }
                }
            }
        } catch (e) {
            capabilities.canUseWebGL = false
            console.warn('WebGL detection failed:', e)
        }

        // Run a quick performance test
        const perfScore = await this.runPerformanceTest()

        // Determine device tier based on all factors
        if (
            isLowEndMobile ||
            hardwareConcurrency <= 2 ||
            deviceMemory <= 2 ||
            perfScore < 10
        ) {
            capabilities.deviceTier = 'low'
            capabilities.highPerformance = false
            capabilities.maxParticles = 50
            capabilities.targetFPS = 30
            capabilities.memoryLimit = 'low'
        } else if (
            isMobile ||
            hardwareConcurrency <= 4 ||
            deviceMemory <= 4 ||
            perfScore < 25
        ) {
            capabilities.deviceTier = 'medium'
            capabilities.highPerformance = false
            capabilities.maxParticles = 150
            capabilities.targetFPS = 45
            capabilities.memoryLimit = 'medium'
        }

        // Create device profile for analytics
        capabilities.deviceProfile = {
            userAgent: navigator.userAgent,
            hardwareConcurrency,
            deviceMemory,
            screenSize: {
                width: window.screen.width,
                height: window.screen.height,
                pixelRatio: window.devicePixelRatio || 1,
            },
            perfScore,
            webGL: capabilities.canUseWebGL,
        }

        return capabilities
    }

    /**
     * Run a quick performance test to estimate device capabilities
     * @returns Performance score (higher is better)
     */
    async runPerformanceTest(): Promise<number> {
        return new Promise(resolve => {
            console.log('Running performance test...')

            let frameCount = 0
            const startTime = performance.now()
            const iterations = 1000

            // Test array operations
            const arrays: Float32Array[] = []
            for (let i = 0; i < 10; i++) {
                arrays.push(new Float32Array(1000))
            }

            // Test rendering performance
            const testCanvas = document.createElement('canvas')
            testCanvas.width = 200
            testCanvas.height = 200
            const ctx = testCanvas.getContext('2d')

            // Run the test
            const runIteration = (iter: number): void => {
                if (iter >= iterations) {
                    // Test complete
                    const duration = performance.now() - startTime
                    const score = Math.round((iterations / duration) * 1000)
                    console.log(
                        `Performance test completed with score: ${score}`
                    )

                    // Cleanup
                    arrays.length = 0

                    resolve(score)
                    return
                }

                // Test array manipulations (CPU)
                for (let i = 0; i < arrays.length; i++) {
                    const arr = arrays[i]
                    for (let j = 0; j < 100; j++) {
                        arr[j] = Math.sin(j) * Math.cos(j)
                    }
                }

                // Test canvas drawing (GPU)
                if (ctx) {
                    ctx.clearRect(0, 0, 200, 200)
                    for (let i = 0; i < 10; i++) {
                        ctx.fillStyle = `rgba(${Math.random() * 255}, ${
                            Math.random() * 255
                        }, ${Math.random() * 255}, 0.5)`
                        ctx.beginPath()
                        ctx.arc(
                            Math.random() * 200,
                            Math.random() * 200,
                            10 + Math.random() * 20,
                            0,
                            Math.PI * 2
                        )
                        ctx.fill()
                    }
                }

                frameCount++

                // Continue test asynchronously to avoid blocking UI
                if (iter % 50 === 0) {
                    setTimeout(() => runIteration(iter + 1), 0)
                } else {
                    runIteration(iter + 1)
                }
            }

            // Start the test
            runIteration(0)
        })
    }

    /**
     * Apply performance settings based on detected capabilities
     */
    applyPerformanceSettings(): void {
        console.log(
            `Applying performance settings for ${this.capabilities.deviceTier} tier device`
        )

        // Update scalingInfo with performance considerations
        this.scalingInfo.reducedResolution =
            this.capabilities.deviceTier === 'low'

        // Apply settings to game components if they exist
        if (this.game) {
            // Update particle system settings
            if (this.game.particleSystem) {
                const maxParticles = this.capabilities.maxParticles
                this.game.particleSystem.setMaxParticles(maxParticles)
                console.log(`Set max particles to ${maxParticles}`)
            }

            // Update rendering quality
            if (this.canvas) {
                if (this.capabilities.deviceTier === 'low') {
                    // Lower quality for low-end devices
                    this.canvas.className = 'low-quality'

                    // Reduce canvas size for low-end devices
                    const pixelRatio = 0.75 // 75% of native resolution
                    const ctx = this.canvas.getContext('2d')
                    if (ctx) {
                        ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
                    }
                }
            }

            // Store settings in game configuration
            if (this.game.config) {
                // Allow game to access device tier for conditional logic
                this.game.config.deviceTier = this.capabilities.deviceTier
                this.game.config.targetFPS = this.capabilities.targetFPS
            }
        }

        // Apply FPS throttling for lower-end devices
        if (this.capabilities.targetFPS < 60) {
            console.log(
                `Throttling FPS to target ${this.capabilities.targetFPS} FPS`
            )
        }
    }

    /**
     * Clean up resources (important for memory management)
     */
    dispose(): void {
        // The same function objects that were added, so these actually remove them
        window.removeEventListener('resize', this.boundResize)
        window.removeEventListener('orientationchange', this.boundResize)
        document.removeEventListener('visibilitychange', this.boundVisibilityChange)
        this.resizeObserver?.disconnect()
        this.resizeObserver = null
    }
}
