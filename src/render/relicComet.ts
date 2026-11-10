import type { MultiplayerMode } from '../core/GameModes'
import type { SyncedGameState } from '../types/synced'
import { RELIC } from '../../server/constants/gameConstants'
import { inView, segmentInView } from './shared'
import { FONT } from './style'

export const RELIC_STYLE = {
    relic: '#ffda8e',
    relay: '#8adfff',
    caution: '#ffb1a2',
    danger: '#ff866f',
    ink: '#101821',
} as const

const TAU = Math.PI * 2
const FALL_MS = 2900
const FALL_X = 570
const FALL_Y = 1370
const MAX_TAIL_LENGTH = 1400
const IMPACT_FLASH_MS = 105
const IMPACT_RIPPLE_MS = 340
const RELIC_HULL = [[-.63, -.76], [.26, -.94], [.84, -.5], [.98, .13], [.57, .75], [-.2, .96], [-.81, .53], [-.97, -.13]] as const
const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
const clamp01 = (value: number) => Math.max(0, Math.min(1, value))

export function relicCometSeconds(impactAt: number, now: number): string {
    return `${(Math.max(0, Math.ceil((impactAt - now) / 100)) / 10).toFixed(1)}s`
}

function ring(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, width: number): void {
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.stroke()
}

function disk(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(x, y, r, 0, TAU)
    ctx.fill()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, color: string, pixel: number): void {
    ctx.font = `800 ${12 * pixel}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 3 * pixel
    ctx.strokeStyle = RELIC_STYLE.ink
    ctx.fillStyle = color
    ctx.strokeText(text, x, y)
    ctx.fillText(text, x, y)
}

function drawRelay(ctx: CanvasRenderingContext2D, x: number, y: number, pixel: number, ownTow: boolean): void {
    const r = RELIC.RELAY_RADIUS
    disk(ctx, x, y, r, 'rgba(83, 176, 218, .055)')
    ring(ctx, x, y, r, 'rgba(9, 25, 37, .8)', 3.8 * pixel)
    ring(ctx, x, y, r, 'rgba(138, 223, 255, .63)', 1.6 * pixel)
    ctx.lineWidth = 2 * pixel
    ctx.strokeStyle = RELIC_STYLE.relay
    ctx.beginPath()
    for (let i = 0; i < 4; i++) {
        const angle = Math.PI * i / 2
        const dx = Math.cos(angle), dy = Math.sin(angle)
        ctx.moveTo(x + (r - 7 * pixel) * dx, y + (r - 7 * pixel) * dy)
        ctx.lineTo(x + (r + 3 * pixel) * dx, y + (r + 3 * pixel) * dy)
    }
    ctx.stroke()
    label(ctx, 'RELAY', x, y - (ownTow ? 7 * pixel : 0), RELIC_STYLE.relay, pixel)
    if (ownTow) label(ctx, 'Tow here', x, y + 8 * pixel, '#d4f2ff', pixel)
}

function drawRelic(ctx: CanvasRenderingContext2D, x: number, y: number, pixel: number): void {
    const r = Math.max(RELIC.RADIUS, 8 * pixel)
    ctx.save()
    ctx.translate(x, y)
    ctx.scale(r, r)
    ctx.lineJoin = 'round'
    ctx.fillStyle = '#302c39'
    ctx.strokeStyle = '#13141d'
    ctx.lineWidth = Math.max(.055, 3.5 * pixel / r)
    ctx.beginPath()
    RELIC_HULL.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
    ctx.closePath()
    ctx.fill()
    ctx.stroke()
    // Large, interlocking faces give the object depth while its silhouette stays clear at zoom.
    ctx.fillStyle = '#6e5061'
    ctx.beginPath()
    ctx.moveTo(-.63, -.76); ctx.lineTo(.26, -.94); ctx.lineTo(.84, -.5)
    ctx.lineTo(.33, -.34); ctx.lineTo(-.42, -.37); ctx.lineTo(-.97, -.13)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = '#483343'
    ctx.beginPath()
    ctx.moveTo(.84, -.5); ctx.lineTo(.98, .13); ctx.lineTo(.57, .75)
    ctx.lineTo(-.2, .96); ctx.lineTo(.01, .51); ctx.lineTo(.33, -.34)
    ctx.closePath(); ctx.fill()
    ctx.lineWidth = Math.max(.028, 1.35 * pixel / r)
    ctx.strokeStyle = '#d4a16c'
    ctx.beginPath()
    RELIC_HULL.forEach(([px, py], i) => i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py))
    ctx.closePath(); ctx.stroke()
    // One embedded gold seam is distinct from the loose gem silhouettes.
    ctx.fillStyle = '#171820'
    ctx.beginPath()
    ctx.moveTo(-.33, -.39); ctx.lineTo(.45, -.31); ctx.lineTo(.61, -.05)
    ctx.lineTo(.24, .43); ctx.lineTo(-.48, .26); ctx.lineTo(-.58, -.03)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#bb7750'
    ctx.beginPath()
    ctx.moveTo(-.30, -.31); ctx.lineTo(.4, -.25); ctx.lineTo(.52, -.04)
    ctx.lineTo(.21, .34); ctx.lineTo(-.41, .20); ctx.lineTo(-.49, -.02)
    ctx.closePath(); ctx.fill()
    ctx.fillStyle = RELIC_STYLE.relic
    ctx.beginPath()
    ctx.moveTo(-.30, -.31); ctx.lineTo(.4, -.25); ctx.lineTo(.11, .05); ctx.lineTo(-.49, -.02)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#e5b88b'
    ctx.beginPath()
    ctx.moveTo(-.62, .47); ctx.lineTo(-.35, .56); ctx.moveTo(.57, .43); ctx.lineTo(.74, .19)
    ctx.stroke()
    ctx.restore()
}

function drawTow(ctx: CanvasRenderingContext2D, fromX: number, fromY: number, x: number, y: number, pixel: number): void {
    ctx.beginPath()
    ctx.moveTo(fromX, fromY)
    ctx.lineTo(x, y)
    ctx.lineWidth = 4 * pixel
    ctx.strokeStyle = RELIC_STYLE.ink
    ctx.stroke()
    ctx.lineWidth = 2 * pixel
    ctx.strokeStyle = RELIC_STYLE.relic
    ctx.stroke()
}

function drawRelayArrow(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, pixel: number): void {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(angle)
    const r = Math.max(RELIC.RADIUS, 8 * pixel) + 4 * pixel
    ctx.beginPath()
    ctx.moveTo(r, -3.5 * pixel)
    ctx.lineTo(r + 5 * pixel, 0)
    ctx.lineTo(r, 3.5 * pixel)
    ctx.lineWidth = 4 * pixel
    ctx.strokeStyle = RELIC_STYLE.ink
    ctx.stroke()
    ctx.lineWidth = 1.8 * pixel
    ctx.strokeStyle = RELIC_STYLE.relay
    ctx.stroke()
    ctx.restore()
}

/** The same three boundaries in world space and the targeting map. */
export function drawRelicStrikeBands(ctx: CanvasRenderingContext2D, x: number, y: number, scale: number, pixel: number): void {
    const outer = RELIC.OUTER_RADIUS * scale, damage = RELIC.INNER_RADIUS * scale, direct = RELIC.DIRECT_RADIUS * scale
    ctx.save()
    disk(ctx, x, y, outer, 'rgba(250, 132, 117, .065)')
    disk(ctx, x, y, damage, 'rgba(250, 92, 82, .08)')
    disk(ctx, x, y, direct, 'rgba(255, 177, 116, .13)')
    ring(ctx, x, y, outer, RELIC_STYLE.ink, 3.5 * pixel)
    ctx.setLineDash([5 * pixel, 4 * pixel])
    ring(ctx, x, y, outer, RELIC_STYLE.caution, 1.65 * pixel)
    ctx.setLineDash([])
    ring(ctx, x, y, damage, RELIC_STYLE.ink, 3.2 * pixel)
    ring(ctx, x, y, damage, RELIC_STYLE.danger, 1.6 * pixel)
    ring(ctx, x, y, direct, RELIC_STYLE.ink, 3.8 * pixel)
    ring(ctx, x, y, direct, '#ffdc9e', 2.1 * pixel)
    ctx.restore()
}

function drawStrikeWarning(ctx: CanvasRenderingContext2D, x: number, y: number, impactAt: number, now: number, pixel: number): void {
    drawRelicStrikeBands(ctx, x, y, 1, pixel)
    if (!reducedMotion?.matches) {
        const remaining = clamp01((impactAt - now) / RELIC.WARNING_MS)
        ctx.strokeStyle = RELIC_STYLE.caution
        ctx.lineWidth = 2 * pixel
        ctx.beginPath()
        ctx.arc(x, y, RELIC.OUTER_RADIUS + 5 * pixel, -Math.PI / 2, -Math.PI / 2 + TAU * remaining)
        ctx.stroke()
    }
    label(ctx, relicCometSeconds(impactAt, now), x, y, '#ffe0cc', pixel)
}

function drawStrikeImpact(ctx: CanvasRenderingContext2D, x: number, y: number, age: number, pixel: number): void {
    if (age >= RELIC.IMPACT_VISIBLE_MS) return
    const reduce = reducedMotion?.matches
    if (!reduce && age < IMPACT_FLASH_MS) {
        ctx.save()
        const flash = 1 - Math.max(0, age - 22) / (IMPACT_FLASH_MS - 22)
        ctx.globalAlpha *= .90 * flash ** 2
        disk(ctx, x, y, Math.min(RELIC.DIRECT_RADIUS * .62, 68 * pixel), '#fff0cf')
        ctx.restore()
    }
    const travel = reduce ? 1 : clamp01(age / IMPACT_RIPPLE_MS)
    const radius = RELIC.OUTER_RADIUS * (1 - (1 - travel) ** 2)
    ctx.globalAlpha *= 1 - age / RELIC.IMPACT_VISIBLE_MS
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, TAU)
    ctx.lineWidth = 5.6 * pixel
    ctx.strokeStyle = RELIC_STYLE.ink
    ctx.stroke()
    ctx.lineWidth = 3.1 * pixel
    ctx.strokeStyle = '#ffd19e'
    ctx.stroke()
}

/** A hot, angular nucleus and tapered tail distinguish the earned strike from roaming traffic. */
function drawFallingComet(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, tailLength: number, fall: number): void {
    ctx.save()
    // Near contact, the broad nucleus remains readable without covering the target area.
    ctx.globalAlpha *= .94 - .31 * fall
    ctx.translate(x, y)
    ctx.rotate(Math.atan2(FALL_Y, FALL_X))
    ctx.scale(radius, radius)
    const tail = tailLength / radius
    ctx.fillStyle = 'rgba(255, 110, 86, .31)'
    ctx.beginPath()
    ctx.moveTo(-tail, -.09)
    ctx.quadraticCurveTo(-tail * .45, -1.15, -.35, -.99)
    ctx.quadraticCurveTo(.7, 0, -.35, 1.0)
    ctx.quadraticCurveTo(-tail * .45, 1.05, -tail, -.09)
    ctx.fill()
    ctx.fillStyle = 'rgba(255, 191, 122, .68)'
    ctx.beginPath()
    ctx.moveTo(-tail * .79, -.02)
    ctx.quadraticCurveTo(-tail * .36, -.55, -.3, -.63)
    ctx.lineTo(.42, .06)
    ctx.lineTo(-.25, .55)
    ctx.quadraticCurveTo(-tail * .36, .45, -tail * .79, -.02)
    ctx.fill()
    disk(ctx, 0, 0, 1.22, 'rgba(255, 143, 94, .27)')
    ctx.fillStyle = '#ffb073'
    ctx.strokeStyle = '#ffe1a5'
    ctx.lineWidth = .10
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(-.96, -.31); ctx.lineTo(-.44, -.85); ctx.lineTo(.3, -.93)
    ctx.lineTo(.87, -.46); ctx.lineTo(.97, .32); ctx.lineTo(.4, .91)
    ctx.lineTo(-.42, .86); ctx.lineTo(-.92, .4)
    ctx.closePath(); ctx.fill(); ctx.stroke()
    ctx.fillStyle = '#fff2ca'
    ctx.beginPath()
    ctx.moveTo(-.39, -.43); ctx.lineTo(.34, -.58); ctx.lineTo(.71, -.24)
    ctx.lineTo(.64, .4); ctx.lineTo(.11, .62); ctx.lineTo(-.28, .38)
    ctx.closePath(); ctx.fill()
    ctx.strokeStyle = '#d76b59'
    ctx.lineWidth = .08
    ctx.beginPath()
    ctx.moveTo(-.46, -.81); ctx.lineTo(-.25, -.4); ctx.lineTo(-.39, -.11)
    ctx.moveTo(-.84, .31); ctx.lineTo(-.49, .38); ctx.lineTo(-.28, .71)
    ctx.stroke()
    ctx.restore()
}

/** Draw after players so the cargo stays visible at the rim and along walls. */
export function drawRelicComet(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
    const relic = state.relic, comet = state.relicComet
    const relicOnArena = relic?.phase === 'available' || relic?.phase === 'towed'
    if (!relicOnArena && (!comet || comet.phase === 'idle')) return
    const view = mode.renderView
    const pixel = mode.cssScale / Math.max(.001, view?.scale ?? 1)
    const now = mode.worldNow(state, timestamp)
    ctx.save()
    ctx.lineCap = 'round'
    if (relicOnArena) {
        const towing = relic.phase === 'towed'
        const { x, y, relayX, relayY, carrierId } = relic
        const ownTow = towing && carrierId === mode.multiplayerManager?.localSessionId
        if (relayX > 0 && relayY > 0 && inView(view, relayX, relayY, RELIC.RELAY_RADIUS + 7 * pixel)) drawRelay(ctx, relayX, relayY, pixel, ownTow)
        const carrier = towing ? state.players.get(carrierId) : undefined
        if (carrier) {
            const center = ownTow && mode.predicted
                ? { x: mode.predicted.x + carrier.width / 2, y: mode.predicted.y + carrier.height / 2 }
                : mode.centerOf(carrierId, carrier)
            const dx = x - center.x, dy = y - center.y, distance = Math.hypot(dx, dy)
            const rim = Math.min(carrier.width / 2, distance)
            if (distance > rim) {
                const fromX = center.x + dx * rim / distance, fromY = center.y + dy * rim / distance
                if (segmentInView(view, fromX, fromY, x, y, 4 * pixel)) drawTow(ctx, fromX, fromY, x, y, pixel)
            }
        }
        if (inView(view, x, y, Math.max(RELIC.RADIUS, 8 * pixel) + 22 * pixel)) {
            drawRelic(ctx, x, y, pixel)
            if (towing) {
                drawRelayArrow(ctx, x, y, Math.atan2(relayY - y, relayX - x), pixel)
                if (ownTow) {
                    const seconds = Math.max(0, Math.ceil((relic.towEndsAt - now) / 1000))
                    label(ctx, `Tow relic · ${seconds}s`, x, y - Math.max(RELIC.RADIUS, 8 * pixel) - 10 * pixel, RELIC_STYLE.relic, pixel)
                }
            } else label(ctx, 'RELIC', x, y - Math.max(RELIC.RADIUS, 8 * pixel) - 10 * pixel, RELIC_STYLE.relic, pixel)
        }
    }
    if (comet?.phase === 'inbound') {
        const { x, y, impactAt } = comet
        const fall = clamp01(1 - (impactAt - now) / FALL_MS)
        if (fall > 0 && !reducedMotion?.matches) {
            const offset = 1 - fall ** 2
            const fx = x - FALL_X * offset, fy = y - FALL_Y * offset
            const r = RELIC.OUTER_RADIUS * (.24 + .76 * fall ** 1.55)
            const tail = Math.min(MAX_TAIL_LENGTH, r * 5.9)
            if (inView(view, fx, fy, r * 1.23 + tail)) drawFallingComet(ctx, fx, fy, r, tail, fall)
        }
        // Keep the exact zones and clock on top even as the incoming body fills the ring.
        if (inView(view, x, y, RELIC.OUTER_RADIUS + 8 * pixel)) drawStrikeWarning(ctx, x, y, impactAt, now, pixel)
    } else if (comet?.phase === 'impact' && inView(view, comet.x, comet.y, RELIC.OUTER_RADIUS + 7 * pixel)) {
        drawStrikeImpact(ctx, comet.x, comet.y, Math.max(0, now - comet.impactAt), pixel)
    }
    ctx.restore()
}
