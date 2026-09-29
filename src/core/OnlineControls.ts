import { ARENA_RULES } from '../../server/constants/gameConstants'

/** What the DASH button (or space) asks for: a dash, a charge starting, a slingshot, or a cancel */
export type ControlEvent = 'dash' | 'charge' | 'sling' | 'cancel'

/** How far (px) the joystick's knob travels from its center */
const STICK_RADIUS = 46
/** Pushed less than this share of the way, the joystick doesn't steer */
const DEAD_ZONE = 0.25
/** The DASH button's radius (px) */
const BUTTON_RADIUS = 38
const FONT = 'Montserrat, system-ui, sans-serif'

/**
 * Touch and mouse controls for the online game, drawn on the canvas. On a touchscreen, a joystick
 * appears wherever your thumb lands on the left half, and the right half is the DASH button: tap
 * to dash, hold to charge a slingshot (slide off to cancel). With a mouse, hold the button and your
 * player heads for the cursor; space works like the DASH button (Esc cancels a charge). The arrow
 * keys and WASD stay with the InputManager.
 */
export class OnlineControls {
    /** Whether this device has a touchscreen (the joystick and DASH button are drawn only then) */
    readonly touchDevice: boolean
    private stick: { id: number; originX: number; originY: number; x: number; y: number } | null = null
    private mouse: { id: number; x: number; y: number } | null = null
    /** DASH held down: by which pointer (or the space bar), since when, and whether it became a charge */
    private press: { id: number | 'key'; at: number; charging: boolean; maxed: boolean } | null = null
    private events: ControlEvent[] = []
    private ready = true
    private flashUntil = 0
    private deniedAt = 0
    private touchedOnce = false

    constructor(private canvas: HTMLCanvasElement) {
        this.touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
        canvas.style.touchAction = 'none'
        canvas.addEventListener('pointerdown', this.onDown)
        canvas.addEventListener('contextmenu', this.preventMenu)
        window.addEventListener('pointermove', this.onMove)
        window.addEventListener('pointerup', this.onUp)
        window.addEventListener('pointercancel', this.onUp)
        document.addEventListener('keydown', this.onKeyDown)
        document.addEventListener('keyup', this.onKeyUp)
    }

    dispose(): void {
        this.canvas.style.touchAction = ''
        this.canvas.removeEventListener('pointerdown', this.onDown)
        this.canvas.removeEventListener('contextmenu', this.preventMenu)
        window.removeEventListener('pointermove', this.onMove)
        window.removeEventListener('pointerup', this.onUp)
        window.removeEventListener('pointercancel', this.onUp)
        document.removeEventListener('keydown', this.onKeyDown)
        document.removeEventListener('keyup', this.onKeyUp)
    }

    /** Whether DASH is ready (not recharging); presses while it isn't just shake the button */
    setReady(ready: boolean): void {
        this.ready = ready
    }

    /** What DASH asked for since the last call; also notices when a hold becomes a charge */
    takeEvents(now: number): ControlEvent[] {
        if (this.press && !this.press.charging && now - this.press.at >= ARENA_RULES.CHARGE_AFTER_MS) {
            this.press.charging = true
            this.events.push('charge')
        }
        if (this.press?.charging && !this.press.maxed && (this.power(now) ?? 0) >= 1) {
            this.press.maxed = true
            navigator.vibrate?.(20)
        }
        const events = this.events
        this.events = []
        return events
    }

    /** How charged the slingshot is (0 to 1), or null when not charging */
    power(now: number): number | null {
        if (!this.press?.charging) return null
        return Math.max(0, Math.min(1, (now - this.press.at - ARENA_RULES.CHARGE_AFTER_MS) / ARENA_RULES.CHARGE_FULL_MS))
    }

    /**
     * The joystick or mouse steering as a direction no longer than 1 (a light push, or the cursor
     * close by, walks slower), or null when neither is in use. (playerX, playerY) is where your
     * player is on the canvas.
     */
    vector(playerX: number, playerY: number, playerSize: number): { x: number; y: number } | null {
        if (this.stick) {
            const dx = (this.stick.x - this.stick.originX) / STICK_RADIUS
            const dy = (this.stick.y - this.stick.originY) / STICK_RADIUS
            const reach = Math.hypot(dx, dy)
            if (reach < DEAD_ZONE) return { x: 0, y: 0 }
            // Full speed a little before the edge of the stick
            const push = Math.min(1, ((reach - DEAD_ZONE) / (1 - DEAD_ZONE)) * 1.25)
            return { x: (dx / reach) * push, y: (dy / reach) * push }
        }
        if (this.mouse) {
            const dx = this.mouse.x - playerX
            const dy = this.mouse.y - playerY
            const distance = Math.hypot(dx, dy)
            const stopAt = Math.max(8, playerSize / 2)
            if (distance < stopAt) return { x: 0, y: 0 }
            // Slowing as you reach the cursor
            const push = Math.min(1, (distance - stopAt) / (playerSize * 2 + 40))
            return { x: (dx / distance) * push, y: (dy / distance) * push }
        }
        return null
    }

    /**
     * Draw the controls. On a touchscreen: the joystick (or, until you touch it, a faint pulsing one
     * where thumbs usually land) and the DASH button, which shows its state rather than instructions:
     * DASH (tap • hold), a ring running round as you hold, CHARGE with an aim arrow, MAX!, a flash on
     * release, and a darkened clock while it recharges. With a keyboard: a small label for space.
     */
    draw(ctx: CanvasRenderingContext2D, timestamp: number, readyShare: number, aim: { x: number; y: number } | null): void {
        const { width, height } = this.canvas
        const now = performance.now()
        const power = this.power(now)
        const label = power === null ? 'DASH' : power >= 1 ? 'MAX!' : 'CHARGE'
        const pulse = 0.5 + 0.5 * Math.sin(timestamp / 90)
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (!this.touchDevice) {
            ctx.textAlign = 'left'
            ctx.font = `700 12px ${FONT}`
            ctx.fillStyle = power !== null ? (power >= 1 ? '#ff6b6b' : '#ffd166') : `rgba(255, 255, 255, ${readyShare < 1 ? 0.35 : 0.65})`
            ctx.fillText(power === null ? 'SPACE  tap • hold' : `SPACE  ${label}`, 14, height - 16)
            ctx.restore()
            return
        }
        this.drawStick(ctx, height, timestamp)

        // The DASH button, squashing briefly on release and shaking when pressed too early
        const shake = now - this.deniedAt < 250 ? Math.sin((now - this.deniedAt) / 25) * 4 : 0
        const x = width - 70 + shake
        const y = height - 78
        const squash = now < this.flashUntil ? 0.9 : 1
        const r = BUTTON_RADIUS * squash
        const recharging = readyShare < 1
        ctx.fillStyle = recharging
            ? 'rgba(20, 30, 40, 0.55)'
            : now < this.flashUntil
              ? 'rgba(255, 255, 255, 0.45)'
              : power !== null
                ? `rgba(255, 196, 64, ${0.18 + 0.12 * pulse})`
                : 'rgba(79, 209, 197, 0.16)'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        // Its rim: subtle when idle, a clock while recharging, running round while held, power while charging
        ctx.lineWidth = 2
        ctx.strokeStyle = recharging ? 'rgba(255, 255, 255, 0.15)' : 'rgba(79, 209, 197, 0.55)'
        ctx.stroke()
        const arc = (share: number, color: string, thickness: number) => {
            ctx.strokeStyle = color
            ctx.lineWidth = thickness
            ctx.beginPath()
            ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, share))
            ctx.stroke()
        }
        if (recharging) arc(readyShare, 'rgba(255, 255, 255, 0.6)', 3)
        else if (power !== null) arc(power, power >= 1 ? `rgba(255, 107, 107, ${0.75 + 0.25 * pulse})` : '#ffd166', power >= 1 ? 5 + 2 * pulse : 5)
        else if (this.press) arc((now - this.press.at) / ARENA_RULES.CHARGE_AFTER_MS, 'rgba(79, 209, 197, 0.9)', 3)

        ctx.fillStyle = recharging ? 'rgba(255, 255, 255, 0.4)' : '#ffffff'
        ctx.font = `800 ${label === 'DASH' ? 15 : 12}px ${FONT}`
        ctx.fillText(label, x, power === null ? y - 5 : y - 8)
        if (power === null) {
            ctx.font = `600 8px ${FONT}`
            ctx.fillStyle = `rgba(255, 255, 255, ${recharging ? 0.3 : 0.6})`
            ctx.fillText('TAP • HOLD', x, y + 11)
        } else if (aim) {
            // An arrow that turns with the joystick: it's aiming now
            const angle = Math.atan2(aim.y, aim.x)
            ctx.save()
            ctx.translate(x, y + 11)
            ctx.rotate(angle)
            ctx.fillStyle = '#ffffff'
            ctx.beginPath()
            ctx.moveTo(9, 0)
            ctx.lineTo(-5, -6)
            ctx.lineTo(-2, 0)
            ctx.lineTo(-5, 6)
            ctx.closePath()
            ctx.fill()
            ctx.restore()
        }
        ctx.restore()
    }

    private drawStick(ctx: CanvasRenderingContext2D, height: number, timestamp: number): void {
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
    }

    private toCanvas(e: PointerEvent): { x: number; y: number } {
        const rect = this.canvas.getBoundingClientRect()
        return {
            x: (e.clientX - rect.left) * (this.canvas.width / rect.width),
            y: (e.clientY - rect.top) * (this.canvas.height / rect.height),
        }
    }

    /** DASH pressed (by a pointer on the right half, or the space bar) */
    private pressDown(id: number | 'key'): void {
        if (this.press) return
        if (!this.ready) {
            this.deniedAt = performance.now()
            return
        }
        this.press = { id, at: performance.now(), charging: false, maxed: false }
    }

    /** DASH let go: a tap dashes, a charge launches */
    private pressUp(id: number | 'key'): void {
        if (this.press?.id !== id) return
        this.events.push(this.press.charging ? 'sling' : 'dash')
        this.press = null
        this.flashUntil = performance.now() + 150
    }

    /** Slid off the button (or pressed Esc): nothing happens, and nothing is spent */
    private cancelPress(): void {
        if (!this.press) return
        if (this.press.charging) this.events.push('cancel')
        this.press = null
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
            this.pressDown(e.pointerId)
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
        } else if (this.press?.id === e.pointerId && this.toCanvas(e).x < this.canvas.width / 2 - 30) {
            this.cancelPress()
        }
    }

    private onUp = (e: PointerEvent): void => {
        if (this.stick?.id === e.pointerId) this.stick = null
        if (this.mouse?.id === e.pointerId) this.mouse = null
        this.pressUp(e.pointerId)
    }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (e.code === 'Escape') this.cancelPress()
        if (e.code !== 'Space') return
        e.preventDefault()
        if (!e.repeat) this.pressDown('key')
    }

    private onKeyUp = (e: KeyboardEvent): void => {
        if (e.code !== 'Space') return
        e.preventDefault()
        this.pressUp('key')
    }

    private preventMenu = (e: Event): void => {
        e.preventDefault()
    }
}
