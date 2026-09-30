import { ARENA_RULES } from '../../server/constants/gameConstants'

/** What the button (or space) asks for: a dash (a tap), or an inhale starting and stopping (a hold) */
export type ControlEvent = 'dash' | 'inhale' | 'exhale'

/** Your breath, for the button and the ring around your creature: draining while you inhale, refilling while you catch it */
export type Breath = { phase: 'ready' } | { phase: 'inhaling'; left: number } | { phase: 'recovering'; back: number }

/** How far (px) the joystick's knob travels from its center */
const STICK_RADIUS = 46
/** Pushed less than this share of the way, the joystick doesn't steer */
const DEAD_ZONE = 0.25
/** The button's radius (px) */
const BUTTON_RADIUS = 38
const FONT = 'Montserrat, system-ui, sans-serif'

/**
 * Touch and mouse controls for the online game, drawn on the canvas. On a touchscreen, a joystick
 * appears wherever your thumb lands on the left half, and the right half is the button: hold to
 * inhale, tap to dash (slide off to stop inhaling). With a mouse, hold the mouse button and your
 * player heads for the cursor; space works like the on-screen button (Esc stops an inhale). The
 * arrow keys and WASD stay with the InputManager.
 */
export class OnlineControls {
    /** Whether this device has a touchscreen (the joystick and DASH button are drawn only then) */
    readonly touchDevice: boolean
    private stick: { id: number; originX: number; originY: number; x: number; y: number } | null = null
    private mouse: { id: number; x: number; y: number } | null = null
    /** The button held down: by which pointer (or the space bar), since when, and whether it became an inhale */
    private press: { id: number | 'key'; at: number; inhaling: boolean } | null = null
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

    /** Whether the dash is ready (not recharging); a tap while it isn't just shakes the button */
    setReady(ready: boolean): void {
        this.ready = ready
    }

    /** What the button asked for since the last call; also notices when a hold becomes an inhale */
    takeEvents(now: number): ControlEvent[] {
        if (this.press && !this.press.inhaling && now - this.press.at >= ARENA_RULES.CHARGE_AFTER_MS) {
            this.press.inhaling = true
            this.events.push('inhale')
        }
        const events = this.events
        this.events = []
        return events
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
     * where thumbs usually land) and the button, which shows its state: INHALE (tap: dash), a
     * ring running round as a hold becomes an inhale, your breath draining while you inhale and
     * refilling while you catch it, a flash on a dash, and a darkened clock while the dash recharges.
     * With a keyboard: a small label for space that also shows your breath.
     */
    draw(ctx: CanvasRenderingContext2D, timestamp: number, readyShare: number, breath: Breath): void {
        const { width, height } = this.canvas
        const now = performance.now()
        const inhaling = breath.phase === 'inhaling'
        const recovering = breath.phase === 'recovering'
        const share = breath.phase === 'inhaling' ? breath.left : breath.phase === 'recovering' ? breath.back : 1
        const low = inhaling && share < 0.25
        const breathColor = !inhaling
            ? 'rgba(255, 255, 255, 0.45)'
            : share > 0.5
              ? '#a0e6ff'
              : share > 0.25
                ? '#ffd166'
                : `rgba(255, 107, 107, ${0.75 + 0.25 * Math.sin(timestamp / 60)})`
        ctx.save()
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        if (!this.touchDevice) {
            // The keyboard: a small label for space, which also shows your breath
            ctx.textAlign = 'left'
            ctx.font = `700 12px ${FONT}`
            ctx.fillStyle = inhaling ? breathColor : `rgba(255, 255, 255, ${recovering || readyShare < 1 ? 0.35 : 0.65})`
            ctx.fillText(inhaling ? 'SPACE  inhaling' : recovering ? 'catching your breath…' : 'SPACE  hold: inhale · tap: dash', 14, height - 16)
            if (inhaling || recovering) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
                ctx.fillRect(14, height - 34, 140, 5)
                ctx.fillStyle = breathColor
                ctx.fillRect(14, height - 34, 140 * Math.max(0, Math.min(1, share)), 5)
            }
            ctx.restore()
            return
        }
        this.drawStick(ctx, height, timestamp)

        // The button, squashing briefly on a dash and shaking on a tap while the dash recharges
        const shake = now - this.deniedAt < 250 ? Math.sin((now - this.deniedAt) / 25) * 4 : 0
        const x = width - 70 + shake
        const y = height - 78
        const squash = now < this.flashUntil ? 0.9 : 1
        const r = BUTTON_RADIUS * squash
        const dim = recovering || (readyShare < 1 && !inhaling)
        ctx.fillStyle =
            now < this.flashUntil
                ? 'rgba(255, 255, 255, 0.45)'
                : inhaling
                  ? `rgba(160, 230, 255, ${0.16 + 0.1 * Math.sin(timestamp / 90)})`
                  : dim
                    ? 'rgba(20, 30, 40, 0.55)'
                    : 'rgba(79, 209, 197, 0.16)'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = dim ? 'rgba(255, 255, 255, 0.15)' : 'rgba(79, 209, 197, 0.55)'
        ctx.stroke()
        const arc = (portion: number, color: string, thickness: number) => {
            ctx.strokeStyle = color
            ctx.lineWidth = thickness
            ctx.beginPath()
            ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, portion))
            ctx.stroke()
        }
        // Its rim: your breath while you inhale or catch it, a clock while the dash recharges, and
        // running round as a hold becomes an inhale
        if (inhaling || recovering) arc(share, breathColor, inhaling ? 5 : 3)
        else if (readyShare < 1) arc(readyShare, 'rgba(255, 255, 255, 0.6)', 3)
        else if (this.press) arc((now - this.press.at) / ARENA_RULES.CHARGE_AFTER_MS, 'rgba(79, 209, 197, 0.9)', 3)

        ctx.fillStyle = dim ? 'rgba(255, 255, 255, 0.4)' : '#ffffff'
        ctx.font = `800 14px ${FONT}`
        ctx.fillText('INHALE', x, y - 5)
        ctx.font = `600 8px ${FONT}`
        ctx.fillStyle = low ? breathColor : `rgba(255, 255, 255, ${dim ? 0.35 : 0.6})`
        ctx.fillText(recovering ? 'BREATHE…' : inhaling ? (low ? 'LOW!' : '') : 'TAP: DASH', x, y + 11)
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

    /** The button pressed (by a pointer on the right half, or the space bar). A hold always inhales, even while the dash recharges */
    private pressDown(id: number | 'key'): void {
        if (this.press) return
        this.press = { id, at: performance.now(), inhaling: false }
    }

    /** The button let go: a hold stops inhaling; a tap dashes, or shakes the button while the dash recharges */
    private pressUp(id: number | 'key'): void {
        if (this.press?.id !== id) return
        if (this.press.inhaling) {
            this.events.push('exhale')
        } else if (this.ready) {
            this.events.push('dash')
            this.flashUntil = performance.now() + 150
        } else {
            this.deniedAt = performance.now()
        }
        this.press = null
    }

    /** Slid off the button (or pressed Esc): a tap never happens, and an inhale stops */
    private cancelPress(): void {
        if (!this.press) return
        if (this.press.inhaling) this.events.push('exhale')
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
