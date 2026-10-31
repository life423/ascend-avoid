import type { MultiplayerMode } from '../core/GameModes'
import type { SyncedGameState } from '../types/synced'
import { INJURY_CRACKS, shellPlate } from './injury'
import { PLAYER_COLORS } from '../../server/constants/gameConstants'

export interface CombatRewardEvent {
    eventId: string; byId: string; targetId: string; how: string
    x: number; y: number; size: number; facing: number; earned: number
    holeX?: number; holeY?: number
    playerIndex?: number
}
export interface CombatRewardEffect extends CombatRewardEvent { at: number }
const duration = (effect: CombatRewardEffect, reduced: boolean): number => effect.how === 'blackhole' ? 2200 : reduced ? 650 : 1550;

/** Visual only: the server has already settled the reward. */
export function drawCombatRewards(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, now: number): void {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    mode.rewardEffects = mode.rewardEffects.filter(e => now - e.at < duration(e, reduced))
    for (const effect of mode.rewardEffects) {
        const age = now - effect.at, t = Math.min(1, age / duration(effect, reduced))
        const owner = state.players.get(effect.byId)
        const end = owner ? mode.centerOf(effect.byId, owner) : { x: effect.x, y: effect.y }
        ctx.save()
        const screenUnit = mode.cssScale / Math.max(.001, Math.abs(ctx.getTransform().a))
        const gemRadius = (effect.how === 'blackhole' ? 7 : 5) * screenUnit
        if (effect.how === 'mouth' || effect.how === 'cannon') {
            const shatter = Math.min(1, age / 550)
            ctx.save(); ctx.translate(effect.x, effect.y); ctx.rotate(effect.facing)
            ctx.strokeStyle = '#ffbd77'; ctx.lineWidth = Math.max(1.5, effect.size * .016)
            ctx.globalAlpha = 1 - shatter
            for (const seam of INJURY_CRACKS) {
                ctx.beginPath()
                seam.forEach(([x, y], i) => {
                    const scale = effect.size / 2 * (1 + (reduced ? 0 : shatter * 1.6))
                    if (i) ctx.lineTo(x * scale, y * scale); else ctx.moveTo(x * scale, y * scale)
                }); ctx.stroke()
            }
            if (!reduced && age < 550) {
                const color = effect.targetId === mode.multiplayerManager?.localSessionId ? '#ffffff' : PLAYER_COLORS[(effect.playerIndex ?? 0) % PLAYER_COLORS.length]
                const spread = 1 - Math.pow(1 - shatter, 2), r = effect.size / 2
                for (let i = 0; i < 3; i++) {
                    const angle = i===0?Math.PI:i===1?-Math.PI/4:Math.PI/4, travel = r * (.15 + spread * 1.4)
                    ctx.save(); ctx.translate(Math.cos(angle) * travel, Math.sin(angle) * travel)
                    ctx.rotate(shatter * (i % 2 ? 1 : -1)); ctx.fillStyle = color
                    ctx.globalAlpha = Math.max(0, 1 - shatter); ctx.lineWidth = Math.max(1, effect.size * .004)
                    shellPlate(ctx,i,r*(1-shatter*.2)); ctx.fill(); ctx.stroke(); ctx.restore()
                }
            }
            ctx.restore()
        }
        if (effect.earned > 0) {
            if (reduced) {
                ctx.globalAlpha = Math.max(0, 1 - age / duration(effect, reduced))
                ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2
                ctx.beginPath(); ctx.arc(end.x, end.y, (owner?.width ?? 8) / 2 + 10 * screenUnit, 0, Math.PI * 2); ctx.stroke()
            } else for (let i = 0; i < 8; i++) {
                const p = Math.max(0, Math.min(1, (t - i * .015) / .86))
                let x: number, y: number
                const angle = i * Math.PI / 4
                if (effect.how === 'blackhole' && p < .3) {
                    const spiral = p / .3, radius = (1 - spiral) * 60
                    x = (effect.holeX ?? effect.x) + Math.cos(angle + spiral * Math.PI * 2) * radius
                    y = (effect.holeY ?? effect.y) + Math.sin(angle + spiral * Math.PI * 2) * radius
                } else {
                    const travel = effect.how === 'blackhole' ? Math.max(0, (p - .3) / .7) : p
                    const ease = travel * travel
                    const sx = effect.holeX ?? effect.x, sy = effect.holeY ?? effect.y
                    const dx = end.x - sx, dy = end.y - sy, d = Math.hypot(dx, dy) || 1
                    const arc = Math.sin(Math.PI * travel) * Math.min(100, d * .2) * (i % 2 ? 1 : -1)
                    x = sx + dx * ease - dy / d * arc
                    y = sy + dy * ease + dx / d * arc
                }
                ctx.globalAlpha = Math.min(1, (1 - p) * 8)
                ctx.fillStyle = '#ffd166'; ctx.strokeStyle = '#fff2bc'; ctx.lineWidth = screenUnit; ctx.beginPath()
                ctx.moveTo(x, y - gemRadius); ctx.lineTo(x + gemRadius * .7, y); ctx.lineTo(x, y + gemRadius); ctx.lineTo(x - gemRadius * .7, y); ctx.closePath(); ctx.fill(); ctx.stroke()
                ctx.fillStyle = '#fff2bc'; ctx.beginPath(); ctx.moveTo(x, y - gemRadius); ctx.lineTo(x, y); ctx.lineTo(x - gemRadius * .7, y); ctx.closePath(); ctx.fill()
            }
        }
        ctx.restore()
    }
}
