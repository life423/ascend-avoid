/** Directions being steered, as keys (a diagonal presses two) */
interface Keys {
    up: boolean
    down: boolean
    left: boolean
    right: boolean
}

const NONE: Keys = { up: false, down: false, left: false, right: false }
/** How far (px) the joystick's knob travels from its center */
const STICK_RADIUS = 46
/** Pushed less than this share of the way, the joystick doesn't steer */
const DEAD_ZONE = 0.25
/** Within about 22 degrees of an axis you go straight; otherwise diagonally */
const AXIS = 0.38
const FONT = 'Montserrat, system-ui, sans-serif'

/**
 * Touch and mouse controls for the online game, drawn on the canvas. On a touchscreen, a joystick
 * appears wherever your thumb lands on the left half, and tapping the right half dashes. With a
 * mouse, hold the button and your player heads for the cursor. Space dashes too. (The arrow keys
 * and WASD stay with the InputManager.)
 */
export class OnlineControls {
    /** Whether this device has a touchscreen (the joystick and DASH button are drawn only then) */
    readonly touchDevice: boolean
    private stick: { id: number; originX: number; originY: number; x: number; y: number } | null = null
    private mouse: { id: number; x: number; y: number } | null = null
    private action: number | null = null
    private dashQueued = false
    private touchedOnce = false

    constructor(private canvas: HTMLCanvasElement) {
        this.touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
        canvas.style.touchAction = 'none'
        canvas.addEventListener('pointerdown', this.onDown)
        canvas.addEventListener('contextmenu', this.preventMenu)
        window.addEventListener('pointermove', this.onMove)
        window.addEventListener('pointerup', this.onUp)
        window.addEventListener('pointercancel', this.onUp)
        document.addEventListener('keydown', this.onKey)
    }

    dispose(): void {
        this.canvas.style.touchAction = ''
        this.canvas.removeEventListener('pointerdown', this.onDown)
        this.canvas.removeEventListener('contextmenu', this.preventMenu)
        window.removeEventListener('pointermove', this.onMove)
        window.removeEventListener('pointerup', this.onUp)
        window.removeEventListener('pointercancel', this.onUp)
        document.removeEventListener('keydown', this.onKey)
    }

    /** A dash asked for since the last call: a tap on the right half, or space */
    takeDash(): boolean {
        const wanted = this.dashQueued
        this.dashQueued = false
        return wanted
    }

    /** The directions being steered; (playerX, playerY) is where your player is on the canvas */
    keys(playerX: number, playerY: number, playerSize: number): Keys {
        let dx = 0
        let dy = 0
        if (this.stick) {
            dx = (this.stick.x - this.stick.originX) / STICK_RADIUS
            dy = (this.stick.y - this.stick.originY) / STICK_RADIUS
            if (Math.hypot(dx, dy) < DEAD_ZONE) return { ...NONE }
        } else if (this.mouse) {
            dx = this.mouse.x - playerX
            dy = this.mouse.y - playerY
            // Close enough to the cursor: stop
            if (Math.hypot(dx, dy) < Math.max(12, playerSize / 2)) return { ...NONE }
        } else {
            return { ...NONE }
        }
        const length = Math.hypot(dx, dy)
        const x = dx / length
        const y = dy / length
        return { left: x < -AXIS, right: x > AXIS, up: y < -AXIS, down: y > AXIS }
    }

    /**
     * Draw the controls. On a touchscreen: the joystick (or, until you touch it, a faint pulsing
     * one where thumbs usually land) and the DASH button with its recharge sweep. With a keyboard:
     * a small label for space.
     */
    draw(ctx: CanvasRenderingContext2D, timestamp: number, dashReady: number): void {
        const { width, height } = this.canvas
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (!this.touchDevice) {
            ctx.font = `600 12px ${FONT}`
            ctx.textAlign = 'left'
            ctx.fillStyle = `rgba(255, 255, 255, ${dashReady < 1 ? 0.35 : 0.6})`
            ctx.fillText('SPACE  dash', 14, height - 16)
            ctx.restore()
            return
        }
        const drawStick = (x: number, y: number, knobX: number, knobY: number, alpha: number) => {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.35})`
            ctx.beginPath()
            ctx.arc(x, y, STICK_RADIUS, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.9, alpha * 1.8)})`
            ctx.beginPath()
            ctx.arc(knobX, knobY, 22, 0, Math.PI * 2)
            ctx.fill()
        }
        if (this.stick) {
            let dx = this.stick.x - this.stick.originX
            let dy = this.stick.y - this.stick.originY
            const reach = Math.hypot(dx, dy)
            if (reach > STICK_RADIUS) {
                dx *= STICK_RADIUS / reach
                dy *= STICK_RADIUS / reach
            }
            drawStick(this.stick.originX, this.stick.originY, this.stick.originX + dx, this.stick.originY + dy, 0.4)
        } else {
            // Where thumbs usually land; it pulses until the first touch
            const x = STICK_RADIUS + 28
            const y = height - STICK_RADIUS - 28
            drawStick(x, y, x, y, this.touchedOnce ? 0.18 : 0.24 + 0.14 * Math.sin(timestamp / 300))
        }

        const x = width - 68
        const y = height - 76
        ctx.fillStyle = `rgba(79, 209, 197, ${this.action !== null ? 0.4 : 0.2})`
        ctx.beginPath()
        ctx.arc(x, y, 36, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = 'rgba(79, 209, 197, 0.8)'
        ctx.lineWidth = 2
        ctx.stroke()
        if (dashReady < 1) {
            // Recharging: the ring fills back up
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
            ctx.lineWidth = 4
            ctx.beginPath()
            ctx.arc(x, y, 36, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * dashReady)
            ctx.stroke()
        }
        ctx.fillStyle = `rgba(255, 255, 255, ${dashReady < 1 ? 0.5 : 0.95})`
        ctx.font = `700 13px ${FONT}`
        ctx.fillText('DASH', x, y)
        ctx.font = `600 11px ${FONT}`
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
        ctx.fillText('TAP  dash', x, y + 52)
        ctx.restore()
    }

    private toCanvas(e: PointerEvent): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect()
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
        }
    }

    private onDown = (e: PointerEvent): void => {
        const point = this.toCanvas(e)
        if (e.pointerType === 'mouse') {
            if (e.button !== 0) return
            this.mouse = { id: e.pointerId, x: point.x, y: point.y }
        } else if (point.x < this.canvas.width / 2) {
            if (this.stick) return
            this.touchedOnce = true
            this.stick = { id: e.pointerId, originX: point.x, originY: point.y, x: point.x, y: point.y }
        } else {
            this.touchedOnce = true
            this.action = e.pointerId
        }
        e.preventDefault()
    }

    private onMove = (e: PointerEvent): void => {
        if (this.stick?.id === e.pointerId) {
            const point = this.toCanvas(e)
            this.stick.x = point.x
            this.stick.y = point.y
        } else if (this.mouse?.id === e.pointerId) {
            const point = this.toCanvas(e)
            this.mouse.x = point.x
            this.mouse.y = point.y
        }
    }

    private onUp = (e: PointerEvent): void => {
        if (this.stick?.id === e.pointerId) this.stick = null
        if (this.mouse?.id === e.pointerId) this.mouse = null
        if (this.action === e.pointerId) {
            this.action = null
            this.dashQueued = true
        }
    }

    private onKey = (e: KeyboardEvent): void => {
        if (e.code !== 'Space') return
        e.preventDefault()
        if (!e.repeat) this.dashQueued = true
    }

    private preventMenu = (e: Event): void => {
        e.preventDefault()
    }
}
