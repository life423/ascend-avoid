import { FONT, GOLD } from './style'
import { drawGem } from './world'

/**
 * The opening: how long it plays (MS), and how long the HUD then takes to fade in. Its choreography
 * below is written on a DESIGN_MS timeline and plays scaled to MS, so MS alone sets the pace.
 */
export const INTRO = { MS: 2000, DESIGN_MS: 2300, HUD_FADE_MS: 450 } as const

export type IntroSpark = { x: number; y: number; color: string; size: number; delay: number; gem: boolean }

/** Stars and gems around the screen for the opening to pull in (positions as shares of the screen) */
export function makeIntroSparks(): IntroSpark[] {
    const colors = ['#ffffff', '#ffffff', GOLD, '#4fe3d9', '#5aa8ff', '#ff7ad9']
    const sparks: IntroSpark[] = []
    for (let i = 0; i < 70; i++) {
        const angle = Math.random() * Math.PI * 2
        const distance = 0.2 + Math.random() * 0.55
        sparks.push({
            x: 0.5 + Math.cos(angle) * distance,
            y: 0.45 + Math.sin(angle) * distance * 1.2,
            color: colors[i % colors.length] ?? '#ffffff',
            size: 1 + Math.random() * 2,
            delay: Math.random() * 450,
            gem: i % 4 === 0,
        })
    }
    return sparks
}

/**
 * The opening, over the arena: ASCEND appears large, its letters spread apart; stars and gems are
 * drawn toward it; then the letters are pulled inward, crushed into a tiny glowing point, and pop.
 */
export function drawIntro(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, elapsed: number, sparks: IntroSpark[]): void {
    // Where the choreography is (on its DESIGN_MS timeline), playing it in INTRO.MS
    const t = elapsed * (INTRO.DESIGN_MS / INTRO.MS)
    const clamp = (v: number) => Math.max(0, Math.min(1, v))
    const ease = (v: number) => v * v * (3 - 2 * v)
    const w = canvas.width
    const h = canvas.height
    const cx = w / 2
    const cy = h * 0.45
    ctx.save()
    // The arena dims behind the word, coming back as it goes
    ctx.fillStyle = `rgba(2, 6, 14, ${0.55 * (1 - clamp((t - 1700) / 500))})`
    ctx.fillRect(0, 0, w, h)
    // Stars and gems drawn in: slowly, then rushing
    ctx.lineCap = 'round'
    for (const spark of sparks) {
        const k = clamp((t - 250 - spark.delay) / 1100)
        if (k <= 0) continue
        const pull = k * k * k
        const sx = spark.x * w
        const sy = spark.y * h
        const x = sx + (cx - sx) * pull
        const y = sy + (cy - sy) * pull
        const back = Math.max(0, pull - 0.12 * k)
        ctx.globalAlpha = 0.85 * (1 - clamp((k - 0.85) / 0.15))
        ctx.strokeStyle = spark.color
        ctx.lineWidth = spark.size * 0.8
        ctx.beginPath()
        ctx.moveTo(sx + (cx - sx) * back, sy + (cy - sy) * back)
        ctx.lineTo(x, y)
        ctx.stroke()
        if (spark.gem) {
            drawGem(ctx, x, y, spark.size * 2.4, spark.color)
        } else {
            ctx.fillStyle = spark.color
            ctx.beginPath()
            ctx.arc(x, y, spark.size, 0, Math.PI * 2)
            ctx.fill()
        }
    }
    ctx.globalAlpha = 1
    // The word, letters spread apart, then sucked into the middle
    const word = 'ASCEND'
    const size = Math.min(w * 0.15, 112)
    ctx.font = `900 ${size}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const widths = word.split('').map((letter) => ctx.measureText(letter).width)
    const appear = ease(clamp(t / 450))
    const suck = clamp((t - 950) / 750)
    const inward = suck * suck
    const gap = size * 0.35 * (1 - 0.35 * ease(clamp(t / 900)))
    const total = widths.reduce((sum, width) => sum + width, 0) + gap * (word.length - 1)
    let left = cx - total / 2
    ctx.shadowColor = 'rgba(79, 209, 197, 0.9)'
    ctx.shadowBlur = 18 + 22 * suck
    word.split('').forEach((letter, i) => {
        const width = widths[i] ?? 0
        const home = left + width / 2
        left += width + gap
        const alpha = appear * (1 - clamp((suck - 0.85) / 0.15))
        if (alpha <= 0) return
        ctx.save()
        ctx.globalAlpha = alpha
        ctx.translate(home + (cx - home) * inward, cy)
        ctx.rotate((i - 2.5) * 0.3 * inward)
        const scale = (0.85 + 0.15 * appear) * (1 - 0.92 * inward)
        ctx.scale(scale, scale)
        ctx.fillStyle = '#eaffff'
        ctx.fillText(letter, 0, 0)
        ctx.restore()
    })
    ctx.shadowBlur = 0
    // A tiny glowing point gathers, then pops
    const gather = clamp((t - 1500) / 350)
    const pop = clamp((t - 1850) / 400)
    if (gather > 0 && pop < 1) {
        const r = (4 + 10 * gather) * (1 - pop) * 5
        const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, r))
        glow.addColorStop(0, `rgba(255, 255, 255, ${0.95 * (1 - pop)})`)
        glow.addColorStop(0.3, `rgba(160, 240, 255, ${0.6 * (1 - pop)})`)
        glow.addColorStop(1, 'rgba(79, 209, 197, 0)')
        ctx.fillStyle = glow
        ctx.beginPath()
        ctx.arc(cx, cy, Math.max(1, r), 0, Math.PI * 2)
        ctx.fill()
    }
    if (pop > 0 && pop < 1) {
        ctx.strokeStyle = `rgba(200, 250, 255, ${1 - pop})`
        ctx.lineWidth = 1 + 3 * (1 - pop)
        ctx.beginPath()
        ctx.arc(cx, cy, 10 + 150 * ease(pop), 0, Math.PI * 2)
        ctx.stroke()
    }
    ctx.restore()
}
