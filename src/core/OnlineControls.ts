
/** What the button (or space) asks for: an inhale starting (pressed) and stopping (let go) */
/** inhale: hold begins; exhale: release stops inhaling; cancel: interrupted press; tap: puff, spit or fire. */
import { sound } from './Sound'
import { mouseControlEnabled, MOUSE_CONTROL_EVENT } from './MouseControl'
export type ControlEvent = 'inhale' | 'exhale' | 'cancel' | 'tap'

/**
 * How long a press can last and still be a tap. The button decides nothing until then: let go
 * within it and it's a tap (fire a captive, spit a bomb), never a moment of inhaling; keep holding
 * past it and the inhale starts
 */
export const TAP_MS = 180

/** Your breath, for the button and the ring around your creature: draining while you inhale, refilling while you catch it */
export type Breath = { phase: 'ready' } | { phase: 'inhaling'; left: number } | { phase: 'recovering'; back: number }

/** How far (px) the joystick's knob travels from its center */
const STICK_RADIUS = 68
/** Pushed less than this share of the way, the joystick doesn't steer */
const DEAD_ZONE = 0.25
/** The button's radius (px) */
const BUTTON_RADIUS = 50
const FONT = 'Montserrat, system-ui, sans-serif'

/** Whether a key went to a text box (the drawer's name box, say), so it shouldn't steer, inhale or toggle anything */
function isTyping(e: KeyboardEvent): boolean {
    const target = e.target as HTMLElement | null
    return !!target && (!!target.closest('input, textarea, button, select, a') || target.isContentEditable)
}

/**
 * Touch and mouse controls for the online game, drawn on the canvas. On a touchscreen, a joystick
 * appears wherever your thumb lands on the left half, and the right half is the button: hold it to
 * inhale (slide off to stop). With a mouse, move the cursor over the arena to steer without holding;
 * space works like the on-screen button (Esc stops an inhale). The
 * arrow keys and WASD stay with the InputManager.
 */
export class OnlineControls {
    action: 'INHALE' | 'SALVAGE' | 'FIRE' | 'SPIT' = 'INHALE'
    puffCooldown = 0
    puffNeedsBreath = false

    /** Whether this device has a touchscreen (the joystick and INHALE button are drawn only then) */
    readonly touchDevice: boolean
    private stick: { id: number; originX: number; originY: number; x: number; y: number } | null = null
    private mouse: { id: number; x: number; y: number } | null = null
    private touchAim: { id: number; originX: number; originY: number; x: number; y: number } | null = null
    /** The button held down: by which pointer (or the space bar) */
    private press: { id: number | 'key'; at: number; held: boolean } | null = null
    private events: ControlEvent[] = []
    private touchedOnce = false
    private insets = { top: 0, right: 0, bottom: 0, left: 0 }
    setInsets(insets: typeof this.insets): void { this.insets = insets }
    private get stickRadius(): number { return Math.max(40, STICK_RADIUS * Math.min(1, (this.canvas.width - this.insets.left - this.insets.right) / 320)) }
    get isPointerSteering(): boolean { return !!this.stick || !!this.mouse }

    constructor(private canvas: HTMLCanvasElement) {
        this.touchDevice = window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0
        canvas.style.touchAction = 'none'
        canvas.addEventListener('pointerdown', this.onDown)
        canvas.addEventListener('pointerleave', this.onLeave)
        window.addEventListener(MOUSE_CONTROL_EVENT, this.mousePreferenceChanged)
        canvas.addEventListener('contextmenu', this.preventMenu)
        window.addEventListener('pointermove', this.onMove)
        window.addEventListener('pointerup', this.onUp)
        window.addEventListener('pointercancel', this.onCancel)
        document.addEventListener('keydown', this.onKeyDown)
        document.addEventListener('keyup', this.onKeyUp)
    }

    reset(): void {
        this.stick = null
        this.mouse = null
        this.touchAim = null
        this.press = null
        this.events = []
    }

    dispose(): void {
        this.canvas.style.touchAction = ''
        this.canvas.removeEventListener('pointerdown', this.onDown)
        this.canvas.removeEventListener('pointerleave', this.onLeave)
        window.removeEventListener(MOUSE_CONTROL_EVENT, this.mousePreferenceChanged)
        this.canvas.removeEventListener('contextmenu', this.preventMenu)
        window.removeEventListener('pointermove', this.onMove)
        window.removeEventListener('pointerup', this.onUp)
        window.removeEventListener('pointercancel', this.onCancel)
        document.removeEventListener('keydown', this.onKeyDown)
        document.removeEventListener('keyup', this.onKeyUp)
    }

    /** What the button asked for since the last call */
    takeEvents(): ControlEvent[] {
        // A press held past the tap window becomes an inhale (decided here, once a frame, button or key)
        if (this.press && !this.press.held && performance.now() - this.press.at >= TAP_MS) {
            this.press.held = true
            if (!(this.touchAim && this.action !== 'INHALE')) this.events.push('inhale')
        }
        const events = this.events
        this.events = []
        return events
    }

    /** Drag the existing action control to aim independently of walking. */
    aimVector(): { x: number; y: number } | null {
        if (!this.touchAim) return null
        const x = this.touchAim.x - this.touchAim.originX, y = this.touchAim.y - this.touchAim.originY
        const length = Math.hypot(x, y)
        return length > 12 ? { x: x / length, y: y / length } : null
    }

    /**
     * The joystick or mouse steering as a direction no longer than 1 (a light push, or the cursor
     * close by, walks slower), or null when neither is in use. (playerX, playerY) is where your
     * player is on the canvas.
     */
    vector(playerX: number, playerY: number, playerSize: number): { x: number; y: number } | null {
        if (this.stick) {
            const dx = (this.stick.x - this.stick.originX) / this.stickRadius
            const dy = (this.stick.y - this.stick.originY) / this.stickRadius
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
     * where thumbs usually land) and the INHALE button, whose rim shows your breath draining while
     * you inhale and refilling while you catch it. With a keyboard: a small label for space that
     * also shows your breath.
     */
    draw(ctx: CanvasRenderingContext2D, timestamp: number, breath: Breath): void {
        const { width, height } = this.canvas
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
            ctx.fillStyle = inhaling ? breathColor : `rgba(255, 255, 255, ${recovering ? 0.35 : 0.65})`
            const hint = this.action === 'SALVAGE' ? 'Move to collect bonus gems · paid on safe return' : this.action === 'FIRE' ? 'SPACE  tap to FIRE' : this.action === 'SPIT' ? 'SPACE  tap to SPIT' : inhaling ? 'SPACE  inhaling' : `SPACE  hold to inhale · ${this.puffCooldown > 0 ? `puff in ${this.puffCooldown.toFixed(1)}s` : this.puffNeedsBreath ? 'puff needs 35% breath' : 'puff costs 35% breath'}`
            ctx.fillText(hint, 14 + this.insets.left, height - this.insets.bottom - 16)
            if (inhaling || recovering) {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.12)'
                ctx.fillRect(14 + this.insets.left, height - this.insets.bottom - 34, 140, 5)
                ctx.fillStyle = breathColor
                ctx.fillRect(14 + this.insets.left, height - this.insets.bottom - 34, 140 * Math.max(0, Math.min(1, share)), 5)
            }
            ctx.restore()
            return
        }
        this.drawStick(ctx, height, timestamp)

        // The button: lit while you inhale, dimmed while you catch your breath
        const r = Math.max(28, BUTTON_RADIUS * Math.min(1, (width - this.insets.left - this.insets.right) / 320))
        const x = width - this.insets.right - r - 24
        const y = height - this.insets.bottom - r - 30
        ctx.fillStyle = inhaling
            ? `rgba(160, 230, 255, ${0.16 + 0.1 * Math.sin(timestamp / 90)})`
            : recovering
              ? 'rgba(20, 30, 40, 0.55)'
              : 'rgba(6, 22, 34, 0.72)'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
        // A glowing teal ring
        ctx.lineWidth = 4
        ctx.strokeStyle = recovering ? 'rgba(255, 255, 255, 0.15)' : 'rgba(79, 209, 197, 0.95)'
        ctx.shadowColor = 'rgba(79, 209, 197, 0.65)'
        ctx.shadowBlur = recovering ? 0 : 16
        ctx.stroke()
        ctx.shadowBlur = 0
        // Its rim: your breath while you inhale or catch it
        if (inhaling || recovering) {
            ctx.strokeStyle = breathColor
            ctx.lineWidth = inhaling ? 5 : 3
            ctx.beginPath()
            ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.01, share))
            ctx.stroke()
        }
        // Center the complete label block, including its helper, rather than centering only INHALE.
        ctx.fillStyle = recovering ? 'rgba(255, 255, 255, 0.4)' : low ? breathColor : '#ffffff'
        ctx.textBaseline = 'alphabetic'
        const helper = this.action === 'INHALE' ? this.puffCooldown > 0 ? `PUFF ${this.puffCooldown.toFixed(1)}s` : this.puffNeedsBreath ? 'NEED 35% BREATH' : 'PUFF −35%' : ''
        const lines = [{ text: this.action, weight: 800, size: 17 }, ...(helper ? [{ text: helper, weight: 600, size: 10 }] : [])]
        const measured = lines.map(line => {
            ctx.font = `${line.weight} ${line.size}px ${FONT}`
            const width = ctx.measureText(line.text).width
            const size = Math.min(line.size, line.size * (2 * r - 24) / Math.max(1, width))
            const font = `${line.weight} ${size}px ${FONT}`
            ctx.font = font
            const metrics = ctx.measureText(line.text)
            return { ...line, font, metrics, height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent }
        })
        const gap = helper ? 8 : 0
        let top = y - (measured.reduce((sum, line) => sum + line.height, 0) + gap) / 2
        for (const line of measured) {
            ctx.font = line.font
            ctx.fillText(line.text, x + (line.metrics.actualBoundingBoxLeft - line.metrics.actualBoundingBoxRight) / 2, top + line.metrics.actualBoundingBoxAscent)
            top += line.height + gap
        }
        const aim = this.aimVector()
        if (aim) {
            ctx.strokeStyle = '#fff'; ctx.lineWidth = 3
            ctx.beginPath(); ctx.moveTo(x + aim.x * (r + 8), y + aim.y * (r + 8))
            ctx.lineTo(x + aim.x * (r + 24), y + aim.y * (r + 24)); ctx.stroke()
        }
        ctx.restore()
    }

    private drawStick(ctx: CanvasRenderingContext2D, height: number, timestamp: number): void {
        const radius = this.stickRadius, knob = Math.min(28, radius / 2)
        const drawStick = (x: number, y: number, knobX: number, knobY: number, alpha: number) => {
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.35})`
            ctx.beginPath()
            ctx.arc(x, y, radius, 0, Math.PI * 2)
            ctx.fill()
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`
            ctx.lineWidth = 2
            ctx.stroke()
            ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.9, alpha * 1.8)})`
            ctx.beginPath()
            ctx.arc(knobX, knobY, knob, 0, Math.PI * 2)
            ctx.fill()
        }
        if (this.stick) {
            let dx = this.stick.x - this.stick.originX
            let dy = this.stick.y - this.stick.originY
            const reach = Math.hypot(dx, dy)
            if (reach > radius) {
                dx *= radius / reach
                dy *= radius / reach
            }
            const x = Math.max(this.insets.left + radius + knob, Math.min(this.canvas.width / 2 - radius - knob, this.stick.originX))
            const y = Math.max(this.insets.top + radius + knob, Math.min(height - this.insets.bottom - radius - knob, this.stick.originY))
            drawStick(x, y, x + dx, y + dy, 0.4)
        } else {
            // Where thumbs usually land; it pulses until the first touch
            const x = this.insets.left + radius + 28
            const y = height - this.insets.bottom - radius - 28
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

    /** The button pressed (by a pointer on the right half, or the space bar): nothing yet; held past TAP_MS it becomes an inhale (see takeEvents) */
    private pressDown(id: number | 'key'): void {
        if (this.press) return
        this.press = { id, at: performance.now(), held: false }
    }

    /** The button let go: within the tap window it was a tap (never an inhale); past it, the inhale stops */
    private pressUp(id: number | 'key'): void {
        if (this.press?.id !== id) return
        if (this.touchAim?.id === id && this.aimVector() && !this.press.held) { this.press = null; return }
        this.events.push(this.press.held ? 'exhale' : 'tap')
        this.press = null
    }

    /** Slid off the button, pressed Esc, or the touch was cancelled: an inhale stops (but it isn't a release); a press still undecided was nothing */
    private cancelPress(): void {
        if (!this.press) return
        if (this.press.held) this.events.push('cancel')
        this.press = null
    }

    private onDown = (e: PointerEvent): void => {
        sound.unlock()
        const point = this.toCanvas(e)
        if (e.pointerType === 'mouse') {
            if (!mouseControlEnabled()) return
            if (e.button !== 0) return
            this.mouse = { id: e.pointerId, x: point.x, y: point.y }
        } else if (point.x < this.canvas.width / 2) {
            if (this.stick) return
            this.touchedOnce = true
            this.stick = { id: e.pointerId, originX: point.x, originY: point.y, x: point.x, y: point.y }
        } else {
            this.touchedOnce = true
            this.touchAim = { id: e.pointerId, originX: point.x, originY: point.y, ...point }
            this.pressDown(e.pointerId)
        }
        e.preventDefault()
    }

    private onMove = (e: PointerEvent): void => {
        if (e.pointerType === 'mouse') {
            if (!mouseControlEnabled()) { this.mouse = null; return }
            const editing = document.activeElement?.matches('input, textarea, [contenteditable="true"]')
            if (e.target !== this.canvas || editing || document.querySelector('.drawer.active')) { this.mouse = null; return }
            this.mouse = { id: e.pointerId, ...this.toCanvas(e) }
            return
        }
        if (this.stick?.id === e.pointerId) {
            const point = this.toCanvas(e)
            this.stick.x = point.x
            this.stick.y = point.y
        } else if (this.mouse?.id === e.pointerId) {
            const point = this.toCanvas(e)
            this.mouse.x = point.x
            this.mouse.y = point.y
        } else if (this.touchAim?.id === e.pointerId) {
            const point = this.toCanvas(e)
            this.touchAim.x = point.x; this.touchAim.y = point.y
        }
    }

    /** The system cancelled a pointer (a gesture took over, the page lost it): the stick lets go, and a press is cut short, never released */
    private onCancel = (e: PointerEvent): void => {
        if (this.stick?.id === e.pointerId) this.stick = null
        if (this.mouse?.id === e.pointerId) this.mouse = null
        if (this.touchAim?.id === e.pointerId) this.touchAim = null
        if (this.press?.id === e.pointerId) this.cancelPress()
    }

    private onUp = (e: PointerEvent): void => {
        this.pressUp(e.pointerId)
        if (this.stick?.id === e.pointerId) this.stick = null
        if (this.touchAim?.id === e.pointerId) this.touchAim = null
    }

    private onLeave = (e: PointerEvent): void => {
        if (e.pointerType === 'mouse') this.mouse = null
    }

    private mousePreferenceChanged = (): void => { this.mouse = null }

    private onKeyDown = (e: KeyboardEvent): void => {
        if (isTyping(e) || document.querySelector('.drawer.active')) return
        sound.unlock()
        const direction: Record<string, string> = { KeyW: 'U', ArrowUp: 'U', KeyS: 'D', ArrowDown: 'D', KeyA: 'L', ArrowLeft: 'L', KeyD: 'R', ArrowRight: 'R' }
        if (direction[e.code]) this.mouse = null // keyboard takes over until the mouse moves again
        if (e.code === 'Escape') this.cancelPress()
        if (e.code !== 'Space') return
        e.preventDefault()
        if (!e.repeat) this.pressDown('key')
    }

    private onKeyUp = (e: KeyboardEvent): void => {
        if (e.code !== 'Space') return
        if (isTyping(e)) { this.cancelPress(); return }
        e.preventDefault()
        this.pressUp('key')
    }

    private preventMenu = (e: Event): void => {
        e.preventDefault()
    }
}
