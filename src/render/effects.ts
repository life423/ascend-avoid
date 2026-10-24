import type { MultiplayerMode } from '../core/GameModes'
import { ARENA_RULES, EXHALE } from '../../server/constants/gameConstants'
import { INHALE_LOOK, suctionPower } from './airflow'
import { drawCreature, mouthOf, mouthRadius } from './creatures'
import { BURST_MS } from './shared'
import type { SyncedGameState, SyncedPlayer } from '../types/synced'

/** Bursts of gems (a flash, a ring and sparks, bigger for bigger piles) and shockwaves from hits */
export function drawGemBursts(mode: MultiplayerMode, ctx: CanvasRenderingContext2D) : void {
    const now = performance.now()
    mode.gemBursts = mode.gemBursts.filter((burst) => now - burst.at < 500)
    mode.impacts = mode.impacts.filter((impact) => now - impact.at < 320)
    ctx.save()
    for (const burst of mode.gemBursts) {
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
    for (const impact of mode.impacts) {
        const t = (now - impact.at) / 320
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.7 * (1 - t)})`
        ctx.lineWidth = 2 + impact.size * 0.06
        ctx.beginPath()
        ctx.arc(impact.x, impact.y, impact.size * (0.5 + t * 2), 0, Math.PI * 2)
        ctx.stroke()
    }
    ctx.restore()
}

/**
 * Gravity theft: every gem stolen pops out of the victim and arcs into the thief's mouth, so you
 * can watch them shrink, with a faint gold tether between the two while the stream runs
 */
/**
 * Swallows: the captive is already out of sight inside its swallower, so the moment shows on the swallower
 * instead: its mouth snaps shut and the gulp ripples out from it. (A vanish with nobody to be inside of
 * shrinks away where it was, with a last ring of gold.)
 */
export function drawVanishes(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, timestamp: number) : void {
    const now = performance.now()
    const VANISH_MS = 550
    mode.vanishes = mode.vanishes.filter((v) => now - v.at < VANISH_MS)
    const state = mode.multiplayerManager?.getState() as SyncedGameState | undefined
    const localId = mode.multiplayerManager?.localSessionId ?? null
    for (const v of mode.vanishes) {
        const k = (now - v.at) / VANISH_MS
        const prey = state?.players.get(v.id)
        const eaterId = prey ? (prey.state === 'gulped' ? prey.insideOf : prey.capturedBy) : ''
        const eater = eaterId ? state?.players.get(eaterId) : undefined
        ctx.save()
        if (eater && eaterId) {
            const at = mode.centerOf(eaterId, eater)
            const size = mode.drawnSizes.get(eaterId)?.size ?? eater.width
            const facing = eaterId === localId ? mode.localFacing : (eater.facing ?? -Math.PI / 2)
            const m = mouthOf(at.x, at.y, size, facing)
            const open = Math.min(size * 0.21, mouthRadius(size) * 1.25)
            // The mouth snapping shut...
            const shut = Math.min(1, k / 0.4)
            ctx.fillStyle = '#10151f'
            ctx.beginPath()
            ctx.arc(m.x, m.y, Math.max(0.1, open * (1 - shut)), 0, Math.PI * 2)
            ctx.fill()
            // ...and the gulp rippling out from it
            for (const delay of [0, 0.25]) {
                const q = (k - delay) / (1 - delay)
                if (q <= 0) continue
                ctx.globalAlpha = (1 - q) * 0.7
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
                ctx.lineWidth = Math.max(1, size * 0.03 * (1 - q))
                ctx.beginPath()
                ctx.arc(m.x, m.y, open + size * 0.6 * q, 0, Math.PI * 2)
                ctx.stroke()
            }
        } else {
            ctx.globalAlpha = 1 - k * 0.6
            drawCreature(ctx, v.x, v.y, Math.max(1, v.size * Math.pow(1 - k, 1.6)), v.color, v.facing, timestamp)
            ctx.globalAlpha = (1 - k) * 0.8
            ctx.strokeStyle = '#ffd166'
            ctx.lineWidth = 2
            ctx.beginPath()
            ctx.arc(v.x, v.y, v.size * 0.5 + 30 * k, 0, Math.PI * 2)
            ctx.stroke()
        }
        ctx.restore()
    }
}

export function drawTheft(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number) : void {
    const now = performance.now()
    // Who is robbing whom (a thief can rob several at once): a faint dashed tether from each victim to each thief
    const robbers = new Map<string, string[]>()
    state.players.forEach((thief: SyncedPlayer, id: string) => {
        for (const victimId of String(thief.robbing ?? '').split(',')) {
            const victim = victimId ? state.players.get(victimId) : null
            if (!victim) continue
            const list = robbers.get(victimId) ?? []
            list.push(id)
            robbers.set(victimId, list)
            const a = mode.centerOf(victimId, victim)
            const b = mode.centerOf(id, thief)
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
        }
    })
    // Each gem a victim just lost pops out of it and heads for one of the thieves robbing it
    state.players.forEach((victim: SyncedPlayer, victimId: string) => {
        const total = Number(victim.robbedTotal) || 0
        const had = mode.theftGems.get(victimId) ?? total
        mode.theftGems.set(victimId, total)
        const thieves = robbers.get(victimId)
        if (!thieves || total <= had) return
        for (let i = 0; i < Math.min(8, total - had); i++) {
            const to = thieves[i % thieves.length] as string
            const power = suctionPower(state.players.get(to)?.width ?? ARENA_RULES.PLAYER_SIZE)
            mode.theftParticles.push({ from: victimId, to, at: now + i * 45, angle: Math.random() * Math.PI * 2, flight: INHALE_LOOK.THEFT_FLIGHT_MS / Math.sqrt(power), power })
        }
    })
    for (const id of [...mode.theftGems.keys()]) if (!state.players.has(id)) mode.theftGems.delete(id)
    // The stolen gems in flight: out of the victim's body, a little arc, then sucked into the mouth
    mode.theftParticles = mode.theftParticles.filter((p) => now - p.at < p.flight)
    for (const p of mode.theftParticles) {
        const t = (now - p.at) / p.flight
        if (t < 0) continue
        const victim = state.players.get(p.from)
        const thief = state.players.get(p.to)
        if (!victim || !thief) continue
        const a = mode.centerOf(p.from, victim)
        const b = mode.centerOf(p.to, thief)
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

/** Bomb blasts: a bright flash, then a ring racing out to the edge of the blast */
export function drawBlasts(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, timestamp: number) : void {
    mode.blasts = mode.blasts.filter((blast) => timestamp - blast.at < 500)
    for (const blast of mode.blasts) {
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

/** Rings bursting out where someone was hit (gold) or knocked out (red) */
export function drawBursts(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, timestamp: number) : void {
    mode.bursts = mode.bursts.filter((burst) => timestamp - burst.at < BURST_MS)
    for (const burst of mode.bursts) {
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

/** Exhales: three arcs of air rolling out of the mouth through the puff's cone, fading as they go */
export function drawPuffs(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, timestamp: number) : void {
    const PUFF_MS = 320
    const arc = (EXHALE.ARC * Math.PI) / 180
    mode.puffs = mode.puffs.filter((puff) => timestamp - puff.at < PUFF_MS)
    for (const puff of mode.puffs) {
        const t = Math.max(0, (timestamp - puff.at) / PUFF_MS)
        ctx.save()
        ctx.lineCap = 'round'
        for (const lag of [0, 0.12, 0.24]) {
            const k = t - lag
            if (k <= 0) continue
            const out = k / (1 - lag)
            ctx.strokeStyle = `rgba(220, 240, 255, ${0.75 * (1 - out)})`
            ctx.lineWidth = 4 * (1 - out) + 1
            ctx.beginPath()
            ctx.arc(puff.x, puff.y, puff.reach * (0.12 + 0.88 * out), puff.facing - arc * (1 - 0.3 * out), puff.facing + arc * (1 - 0.3 * out))
            ctx.stroke()
        }
        ctx.restore()
    }
}
