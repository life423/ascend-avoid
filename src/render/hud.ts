import type { MultiplayerMode } from '../core/GameModes'
import { GEMS, PLAYER_COLORS, RELIC, SHIFT, WORLD } from '../../server/constants/gameConstants'
import { COMPACT, FONT, GOLD, drawCrown, hudPanel, roundedRect } from './style'
import { JOIN_NOTICE_MS, View } from './shared'
import type { SyncedGameState, SyncedPlayer, SyncedTurbine } from '../types/synced'
import { weaponRecipe } from './weaponStyle'
import { allWeapons, weaponProfile } from '../../server/game/weaponKit'
import { formatGems } from '../utils/score'
import { arenaCornerRadius } from '../../server/game/arenaBoundary'
import { ownsWeapon, ownershipStroke, ownershipShield, WEAPON_OWNERSHIP } from './weaponOwnership'
import { traceArena } from './arenaBoundary'
import { blackHoleLook, drawBlackHoleMarker } from './blackHoleStyle'
import { HudBackingFade, hudFocus, hudObstruction, type HudRect } from './hudReadability'
import { RELIC_STYLE, relicCometSeconds } from './relicComet'

const reducedMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null
const backingFades = new WeakMap<MultiplayerMode, Map<string, HudBackingFade>>()
function readablePanel(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, me: SyncedPlayer | undefined, key: string, rect: HudRect, radius: number): void {
    let fades = backingFades.get(mode)
    if (!fades) { fades = new Map(); backingFades.set(mode, fades) }
    let fade = fades.get(key)
    if (!fade) { fade = new HudBackingFade(); fades.set(key, fade) }
    const view = mode.renderView, position = mode.predicted ?? me
    const focus = me?.state === 'alive' && !me.capturedBy && !me.flying && view && position
        ? hudFocus(canvas.width / 2 + (position.x + me.width / 2 - view.x) * view.scale,
            canvas.height / 2 + (position.y + me.height / 2 - view.y) * view.scale,
            me.width, mode.localFacing, view.scale, Boolean(me.inhaling), mode.cssScale) : []
    const alpha = fade.update(hudObstruction(rect, focus, mode.cssScale), performance.now())
    ctx.save(); ctx.globalAlpha *= alpha
    hudPanel(ctx, rect.x, rect.y, rect.width, rect.height, radius)
    ctx.restore()
}

/** Navy outlines keep the retained information legible even over a white creature. */
function readableText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, pixel: number): void {
    ctx.save(); ctx.strokeStyle = '#07121e'; ctx.lineJoin = 'round'; ctx.lineWidth = 2.5 * pixel
    ctx.strokeText(text, x, y); ctx.fillText(text, x, y); ctx.restore()
}

function weaponMarker(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, own: boolean, charging = false, unit = 1): void {
    ctx.save(); ctx.translate(x, y); ctx.scale(unit, unit); ctx.fillStyle = '#0c1725';
    ctx.strokeStyle = kind === 'pulsar' ? '#dfa4ff' : weaponProfile(kind).color; ctx.lineWidth = 1.5;
    if (charging) ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    if (kind === 'pulsar') {
        ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.stroke();
    } else if (kind === 'pinwheel') {
        ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 5, Math.sin(a) * 5); } ctx.stroke();
    } else if (weaponProfile(kind).orbit) {
        ctx.strokeRect(-2, -4, 4, 8); ctx.strokeRect(-6, -2, 3, 4); ctx.strokeRect(3, -2, 3, 4);
    } else {
        ctx.beginPath(); ctx.moveTo(-4, 4); ctx.lineTo(0, -5); ctx.lineTo(4, 4); ctx.closePath(); ctx.stroke();
    }
    if (own) {
        ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ownershipStroke(ctx, WEAPON_OWNERSHIP.mint, 2, 1);
        ownershipShield(ctx, 6.5, 6.5, 6);
    }
    ctx.restore();
}

function minimapLayout(mode: MultiplayerMode, canvas: HTMLCanvasElement, state: SyncedGameState) {
    const compact = COMPACT.matches, u = compact ? mode.cssScale : 1
    const size = compact ? (canvas.clientHeight < 500 ? 84 : Math.min(128, Math.max(96, canvas.clientWidth * .27))) * u
        : Math.round(Math.min(150, Math.max(84, Math.min(canvas.width, canvas.height) * .24)))
    const scale = size / Math.max(state.worldWidth, state.worldHeight)
    const width = state.worldWidth * scale, height = state.worldHeight * scale
    const dockX = canvas.width - width - mode.hudInsets.right - 26 * u
    const dockY = mode.hudInsets.top + 10 * u
    const x = compact ? dockX + 8 * u : canvas.width - width - mode.hudInsets.right - 12
    const bottomDock = !compact && !mode.controls?.touchDevice
    const y = compact ? dockY + 62 * u : bottomDock ? canvas.height - height - mode.hudInsets.bottom - 12 : Math.max(mode.hudInsets.top + 76, mode.chromeBottom + 24)
    return { x, y, width, height, scale, u, bottomDock }
}

/** The whole world in a corner: everyone in it, and the part your screen shows */
export function drawMinimap(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, view: View, localId: string | null, leaderId: string | null) : void {
    const { x, y, width, height, scale, u } = minimapLayout(mode, canvas, state)
    mode.minimapBottom = y + height
    ctx.save()
    // One arena-shaped surface; a second panel frame makes the small map feel boxed in.
    ctx.lineWidth = 1.25 * u
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.45)'
    ctx.beginPath()
    traceArena(ctx, x, y, width, height, arenaCornerRadius(state.worldWidth, state.worldHeight) * scale)
    ctx.fillStyle = '#07121e'
    ctx.fill()
    ctx.stroke()
    if (state.floor) {
        // The (new) floor: the void is dark, or red while it's still coming
        const tile = width / SHIFT.GRID
        ctx.fillStyle = state.shiftPhase === 'grace' ? 'rgba(255, 90, 90, 0.35)' : 'rgba(0, 0, 0, 0.75)'
        for (let i = 0; i < state.floor.length; i++) {
            if (state.floor[i] === '0') ctx.fillRect(x + (i % SHIFT.GRID) * tile, y + Math.floor(i / SHIFT.GRID) * tile, tile, tile)
        }
    }
    const maxPlayerWidth = Math.min(state.worldWidth, state.worldHeight) * GEMS.SIZE_MAX_SHARE
    const dotRadius = (player: SyncedPlayer) => 2 + 6 * Math.min(1, player.width / maxPlayerWidth) ** .6
    // Keep the rounded arena path as a clip for physical footprints only, below the map symbols.
    ctx.save()
    ctx.clip()
    ctx.globalAlpha *= .55
    ctx.lineWidth = u
    state.players.forEach((player, sessionId) => {
        if (player.state !== 'alive' || player.capturedBy || player.flying) return
        const radius = player.width * scale / 2
        if (radius <= dotRadius(player) + 1.5 * u) return
        const center = mode.centerOf(sessionId, player)
        ctx.strokeStyle = sessionId === localId ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
        ctx.beginPath()
        ctx.arc(x + center.x * scale, y + center.y * scale, radius, 0, Math.PI * 2)
        ctx.stroke()
    })
    ctx.restore()
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.strokeRect(
        x + (view.x - view.width / 2) * scale,
        y + (view.y - view.height / 2) * scale,
        view.width * scale,
        view.height * scale
    )
    // Landmark rings sit below player dots so an approaching player never disappears beneath one.
    const worldTime = mode.worldNow(state, performance.now())
    state.blackHoles?.forEach(hole => {
        if (state.floor && state.floor[Math.floor(hole.y / state.worldHeight * SHIFT.GRID) * SHIFT.GRID + Math.floor(hole.x / state.worldWidth * SHIFT.GRID)] !== '1') return
        drawBlackHoleMarker(ctx, x + hole.x * scale, y + hole.y * scale, hole, blackHoleLook(hole, worldTime), u)
    })
    state.players.forEach((player: SyncedPlayer, sessionId: string) => {
        if (player.state !== 'alive') return
        const isLocal = sessionId === localId
        const center = mode.centerOf(sessionId, player)
        const mx = x + center.x * scale, my = y + center.y * scale
        const markerRadius = dotRadius(player)
        ctx.fillStyle = isLocal ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
        ctx.beginPath()
        ctx.arc(mx, my, markerRadius, 0, Math.PI * 2)
        ctx.fill()
        if (sessionId === leaderId) {
            drawCrown(ctx, mx, my - markerRadius - 2, 10)
        }
    })
    state.turbines?.forEach((turbine: SyncedTurbine) => {
        // Turbines: a ring, with a tick for where the intake points (gold while one is about to switch on)
        const tx = x + turbine.x * scale
        const ty = y + turbine.y * scale
        ctx.strokeStyle = turbine.phase === 'warning' ? 'rgba(255, 209, 102, 0.95)' : 'rgba(160, 220, 255, 0.95)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(tx, ty, 3.5, 0, Math.PI * 2)
        ctx.moveTo(tx, ty)
        ctx.lineTo(tx + Math.cos(turbine.intake) * 7, ty + Math.sin(turbine.intake) * 7)
        ctx.stroke()
    })
    if (state.surgePhase === 'warning'  || state.surgePhase === 'active') {
        ctx.strokeStyle = GOLD
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(x + state.surgeX * scale, y + state.surgeY * scale, 7, 0, Math.PI * 2)
        ctx.stroke()
    }
    if (state.jackpotOn) {
        // The jackpot has a distinct gold diamond.
        const jx = x + state.jackpotX * scale
        const jy = y + state.jackpotY * scale
        ctx.fillStyle = GOLD
        ctx.beginPath()
        ctx.moveTo(jx, jy - 5)
        ctx.lineTo(jx + 4, jy)
        ctx.lineTo(jx, jy + 5)
        ctx.lineTo(jx - 4, jy)
        ctx.closePath()
        ctx.fill()
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    for (const w of allWeapons(state)) {
        if (w.phase === 'waiting') continue;
        const own = ownsWeapon(w, localId), locked = Boolean(w.owner && !own);
        ctx.globalAlpha = locked ? .3 : 1;
        if (w.phase === 'parts') {
            const letters = weaponRecipe(w.kind).letters;
            ctx.font = `800 8px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            const markers = Array.from(w.parts).map(p => ({ part: p, x: x + p.x * scale, y: y + p.y * scale, rawX: x + p.x * scale, rawY: y + p.y * scale }));
            if (own) for (let pass = 0; pass < 8; pass++) for (let i = 0; i < markers.length; i++) for (let j = i + 1; j < markers.length; j++) {
                const a = markers[i], b = markers[j], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
                if (d >= 15) continue;
                const nx = d > .01 ? dx / d : Math.cos(j * 2), ny = d > .01 ? dy / d : Math.sin(j * 2), shift = (15 - d) / 2;
                a.x = Math.max(x + 7, Math.min(x + width - 7, a.x - nx * shift));
                a.y = Math.max(y + 7, Math.min(y + height - 7, a.y - ny * shift));
                b.x = Math.max(x + 7, Math.min(x + width - 7, b.x + nx * shift));
                b.y = Math.max(y + 7, Math.min(y + height - 7, b.y + ny * shift));
            }
            for (const { part, x: px, y: py, rawX, rawY } of markers) {
                if (own) {
                    ctx.strokeStyle = '#80fff1'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(rawX, rawY); ctx.lineTo(px, py); ctx.stroke();
                }
                ctx.fillStyle = '#0c1725'; ctx.strokeStyle = own ? '#80fff1' : '#c1cbdc'; ctx.lineWidth = own ? 2 : 1;
                ctx.beginPath(); ctx.arc(px, py, own ? 6 : 3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                if (own && part.carriedBy !== localId) { ctx.fillStyle = '#80fff1'; ctx.fillText(letters[part.kind], px, py); }
            }
            if (!w.owner && (w.kind === 'pinwheel' || w.kind === 'pulsar')) weaponMarker(ctx, x + w.x * scale, y + w.y * scale, w.kind, false, false, u);
        } else {
            const wx = x + w.x * scale, wy = y + w.y * scale;
            weaponMarker(ctx, wx, wy, w.kind, own, w.phase === 'charging', u);
        }
    }
    ctx.globalAlpha = 1;
    drawRelicMapMarkers(ctx, state, x, y, scale, u, worldTime, localId)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.restore()
}

function drawRelicMapMarkers(ctx: CanvasRenderingContext2D, state: SyncedGameState, x: number, y: number, scale: number, unit: number, now: number, localId: string | null): void {
    const relic = state.relic, comet = state.relicComet
    const local = localId ? state.players.get(localId) : undefined
    const canHaul = local?.state === 'alive' && !local.isBot && local.width >= RELIC.MIN_WIDTH && !local.relicCometReady && !local.spawnProtected &&
        !local.flying && !local.capturedBy && !local.breathingBlocked && local.injuredUntil <= now
    const showRelic = relic?.phase === 'towed' || (relic?.phase === 'available' && canHaul)
    if (!showRelic && (!comet || comet.phase === 'idle')) return
    ctx.save()
    ctx.beginPath()
    traceArena(ctx, x, y, state.worldWidth * scale, state.worldHeight * scale, arenaCornerRadius(state.worldWidth, state.worldHeight) * scale)
    ctx.clip()
    ctx.lineWidth = 1.5 * unit
    if (showRelic) {
        if (relic.relayX > 0 && relic.relayY > 0) {
            const relayX = x + relic.relayX * scale, relayY = y + relic.relayY * scale
            ctx.beginPath()
            ctx.arc(relayX, relayY, 5.5 * unit, 0, Math.PI * 2)
            ctx.strokeStyle = RELIC_STYLE.relay
            ctx.stroke()
        }
        const rx = x + relic.x * scale, ry = y + relic.y * scale, r = 5 * unit
        ctx.beginPath()
        ctx.moveTo(rx - .5 * r, ry - .9 * r)
        ctx.lineTo(rx + .6 * r, ry - .8 * r)
        ctx.lineTo(rx + r, ry)
        ctx.lineTo(rx + .45 * r, ry + .9 * r)
        ctx.lineTo(rx - .6 * r, ry + .8 * r)
        ctx.lineTo(rx - r, ry)
        ctx.closePath()
        ctx.fillStyle = RELIC_STYLE.ink
        ctx.strokeStyle = RELIC_STYLE.relic
        ctx.fill()
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(rx - .35 * r, ry + .15 * r)
        ctx.lineTo(rx + .35 * r, ry - .15 * r)
        ctx.stroke()
    }
    if (comet?.phase === 'inbound' || comet?.phase === 'impact') {
        const cx = x + comet.x * scale, cy = y + comet.y * scale
        const r = Math.max(7 * unit, RELIC.OUTER_RADIUS * scale)
        ctx.strokeStyle = RELIC_STYLE.danger
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.moveTo(cx - 2.5 * unit, cy)
        ctx.lineTo(cx + 2.5 * unit, cy)
        ctx.moveTo(cx, cy - 2.5 * unit)
        ctx.lineTo(cx, cy + 2.5 * unit)
        ctx.stroke()
        const pulseAge = now - (comet.impactAt - RELIC.WARNING_MS)
        if (comet.phase === 'inbound' && !reducedMotion?.matches && pulseAge >= 0 && pulseAge < 420) {
            const progress = pulseAge / 420
            ctx.globalAlpha *= .7 * (1 - progress)
            ctx.lineWidth = unit
            ctx.beginPath()
            ctx.arc(cx, cy, r + (2 + 4 * progress) * unit, 0, Math.PI * 2)
            ctx.stroke()
        }
    }
    ctx.restore()
}

/** A short warning anchored to the map, clear of the arena center and touch controls. */
export function drawCometInbound(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, timestamp: number): void {
    const comet = state.relicComet
    if (comet?.phase !== 'inbound') return
    const map = minimapLayout(mode, canvas, state)
    const unit = mode.cssScale
    const height = 25 * unit
    const width = Math.min(148 * unit, canvas.width - mode.hudInsets.left - mode.hudInsets.right - 20 * unit)
    const x = Math.max(mode.hudInsets.left + 10 * unit, map.x + map.width - width)
    const y = map.bottomDock ? map.y - height - 8 * unit : map.y + map.height + 7 * unit
    if (width <= 30 * unit || y < mode.hudInsets.top || y + height > canvas.height - mode.hudInsets.bottom) return
    // Edge projectile arrows use this boundary to stay clear of the top-right dock.
    if (!map.bottomDock) mode.minimapBottom = Math.max(mode.minimapBottom, y + height)
    const text = `Comet inbound · ${relicCometSeconds(comet.impactAt, mode.worldNow(state, timestamp))}`
    ctx.save()
    roundedRect(ctx, x, y, width, height, height / 2)
    ctx.fillStyle = '#201922'
    ctx.strokeStyle = RELIC_STYLE.caution
    ctx.lineWidth = unit
    ctx.fill()
    ctx.stroke()
    ctx.font = `700 ${11 * unit}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#ffe2db'
    ctx.fillText(text, x + width / 2, y + height / 2, width - 16 * unit)
    ctx.restore()
}

/** The big banner for hits you caused: it pops in, holds, and fades */
export function drawBanner(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) : void {
    if (!mode.banner) return
    const age = performance.now() - mode.banner.at
    if (age > 1700) {
        mode.banner = null
        return
    }
    if (COMPACT.matches || mode.controls?.touchDevice) return
    const pop = age < 160 ? 1.35 - (age / 160) * 0.35 : 1
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = age > 1350 ? Math.max(0, 1 - (age - 1350) / 350) : 1
    ctx.translate(canvas.width / 2, Math.max(mode.hudInsets.top + 24, mode.chromeBottom + 24))
    ctx.scale(pop, pop)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    const fit = (text: string, weight: number, size: number): void => {
        ctx.font = `${weight} ${size}px ${FONT}`
        const scale = Math.min(1, (canvas.width - 32) / (Math.max(1, ctx.measureText(text).width) * pop))
        ctx.font = `${weight} ${size * scale}px ${FONT}`
    }
    fit(mode.banner.title, 900, Math.round(Math.min(34, canvas.width / 14)))
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(5, 12, 24, 0.85)'
    ctx.strokeText(mode.banner.title, 0, 0)
    ctx.fillStyle = GOLD
    ctx.fillText(mode.banner.title, 0, 0)
    if (mode.banner.sub) {
        fit(mode.banner.sub, 800, Math.round(Math.min(15, canvas.width / 28)))
        ctx.lineWidth = 4
        ctx.strokeText(mode.banner.sub, 0, 30)
        ctx.fillStyle = '#ffffff'
        ctx.fillText(mode.banner.sub, 0, 30)
    }
    ctx.restore()
}

/** A chip at the top: a shift coming up, its grace period, or how long until the arena returns */
export function drawShiftChip(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, timestamp: number) : void {
    // Arena shifts switched off: no countdown, no warnings
    if (!state.shiftsOn) return
    const left = Math.max(0, Math.ceil((state.phaseEndsAt - mode.worldNow(state, timestamp)) / 1000))
    let text = ''
    if (state.shiftPhase === 'grace') text = `New floor! Get on it · ${left}`
    else if (state.shiftPhase === 'shift') text = `Arena returns in ${left}`
    else if (left <= 10) text = `Arena shift in ${left}`
    if (!text) return
    const urgent = state.shiftPhase === 'grace'
    // On narrow screens the chip sits below the leaderboard
    const y = canvas.width < 560 ? 30 + Math.min(6, state.players.size) * 18 : 12
    ctx.save()
    ctx.font = `700 ${urgent ? 15 : 13}px ${FONT}`
    const width = ctx.measureText(text).width + 32
    ctx.fillStyle = urgent ? 'rgba(120, 20, 20, 0.85)' : 'rgba(5, 12, 24, 0.8)'
    roundedRect(ctx, (canvas.width - width) / 2, y, width, 30, 15)
    ctx.fill()
    ctx.strokeStyle = urgent ? 'rgba(255, 130, 130, 0.9)' : 'rgba(79, 209, 197, 0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, y + 15)
    ctx.restore()
}

/** "Traffic incoming 3" just before a traffic wave */
export function drawTrafficChip(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, timestamp: number) : void {
    if (state.trafficWave !== 'warning') return
    const left = Math.max(1, Math.ceil((state.waveAt - mode.worldNow(state, timestamp)) / 1000))
    const text = `Traffic incoming ${left}`
    const y = canvas.width < 560 ? 30 + Math.min(6, state.players.size) * 18 : 12
    ctx.save()
    ctx.font = `700 14px ${FONT}`
    const width = ctx.measureText(text).width + 32
    ctx.fillStyle = 'rgba(60, 38, 5, 0.85)'
    roundedRect(ctx, (canvas.width - width) / 2, y, width, 30, 15)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255, 196, 64, 0.9)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, canvas.width / 2, y + 15)
    ctx.restore()
}

/** The top five by gems, top left, with you added below if you're further down */
export function drawLeaderboard(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, _canvas: HTMLCanvasElement, state: SyncedGameState, localId: string | null, leaderId: string | null) : void {
    const ranked: { id: string; name: string; gems: number }[] = []
    state.players.forEach((player: SyncedPlayer, id: string) => {
        ranked.push({ id, name: String(player.name), gems: player.gems })
    })
    ranked.sort((a, b) => b.gems - a.gems)
    const compact = COMPACT.matches
    const top = _canvas.clientHeight < 500 ? 1 : compact ? 3 : 5
    const rows = ranked.slice(0, top).map((entry, index) => ({ ...entry, rank: index + 1 }))
    const mine = ranked.findIndex((entry) => entry.id === localId)
    const apart = mine >= top
    const me = ranked[mine]
    if (apart && me) rows.push({ ...me, rank: mine + 1 })
    // Sizes in screen points on phones, so it lines up with everything else there
    const u = compact ? mode.cssScale : 1
    const x = mode.hudInsets.left + (compact ? 10 : 12) * u
    const width = (compact ? 132 : 190) * u
    const y = compact ? mode.hudInsets.top + 52 * u : Math.max(mode.hudInsets.top + 12, mode.chromeLeft < x + width + 12 ? mode.chromeBottom + 12 : 0)
    const rowHeight = (compact ? 21 : 24) * u
    const gapForYou = apart ? 7 * u : 0
    const rowsHeight = rows.length * rowHeight + 10 * u + gapForYou
    ctx.save()
    readablePanel(mode, ctx, _canvas, localId ? state.players.get(localId) : undefined, 'leaderboard', { x, y, width, height: rowsHeight }, 10 * u)
    ctx.font = `600 ${(compact ? 11.5 : 13) * u}px ${FONT}`
    ctx.textBaseline = 'middle'
    let rowY = y + 5 * u + rowHeight / 2
    rows.forEach((row, index) => {
        const isLocal = row.id === localId
        if (apart && index === rows.length - 1) {
            // You, further down: set apart by a line
            ctx.strokeStyle = 'rgba(79, 209, 197, 0.35)'
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(x + 8 * u, rowY - rowHeight / 2 + 3 * u)
            ctx.lineTo(x + width - 8 * u, rowY - rowHeight / 2 + 3 * u)
            ctx.stroke()
            rowY += gapForYou
        }
        if (row.id === leaderId) {
            drawCrown(ctx, x + 14 * u, rowY + 4 * u, 12 * u)
        } else {
            ctx.fillStyle = 'rgba(207, 216, 220, 0.7)'
            ctx.textAlign = 'center'
            readableText(ctx, String(row.rank), x + 14 * u, rowY, u)
        }
        const nameX = x + 27 * u
        ctx.fillStyle = isLocal ? '#4fd1c5' : 'rgba(225, 235, 240, 0.92)'
        ctx.textAlign = 'left'
        const score = formatGems(row.gems)
        const scoreWidth = Math.max(25 * u, ctx.measureText(score).width)
        const nameWidth = Math.max(10 * u, width - (nameX - x) - scoreWidth - 18 * u)
        let name = row.name
        if (ctx.measureText(name).width > nameWidth) {
            while (name.length && ctx.measureText(`${name}…`).width > nameWidth) name = name.slice(0, -1)
            name += '…'
        }
        readableText(ctx, name, nameX, rowY, u)
        ctx.fillStyle = isLocal ? '#4fd1c5' : GOLD
        ctx.textAlign = 'right'
        readableText(ctx, score, x + width - 9 * u, rowY, u)
        rowY += rowHeight
    })
    ctx.restore()
}

/** Phones and tablets: score above the leaderboard, opposite the labeled menu. */
export function drawTopBar(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, _state: SyncedGameState, me: SyncedPlayer) : void {
    const u = mode.cssScale
    if (canvas.clientWidth < 300 || (canvas.clientHeight < 500 && me.capturedBy)) return
    ctx.save()
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const top = mode.hudInsets.top + 10 * u
    // The score
    const label = 'Score'
    const gems = me?.gems ?? 0
    const value = formatGems(gems)
    ctx.font = `600 ${12.5 * u}px ${FONT}`
    ctx.font = `800 ${18 * u}px ${FONT}`
    const pillHeight = 34 * u
    const pillWidth = 132 * u
    const pillX = mode.hudInsets.left + 10 * u
    readablePanel(mode, ctx, canvas, me, 'score', { x: pillX, y: top, width: pillWidth, height: pillHeight }, pillHeight / 2)
    ctx.font = `600 ${12.5 * u}px ${FONT}`
    ctx.fillStyle = '#e8f4f8'
    readableText(ctx, label, pillX + 14 * u, top + pillHeight / 2, u)
    ctx.font = `800 ${18 * u}px ${FONT}`
    ctx.fillStyle = '#4fd1c5'
    ctx.textAlign = 'right'
    readableText(ctx, value, pillX + pillWidth - 14 * u, top + pillHeight / 2 + 1 * u, u)
    ctx.restore()
}

/** Recent notices at the top right, newest first, fading out */
export function drawNotices(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) : void {
    const now = performance.now()
    mode.notices = mode.notices.filter((notice) => now - notice.at < JOIN_NOTICE_MS)
    if (COMPACT.matches || mode.controls?.touchDevice) return
    let y = Math.max(mode.hudInsets.top + 12, mode.chromeBottom + 12)
    const phase = mode.multiplayerManager?.getState()?.surgePhase
    if (phase === 'warning' || phase === 'active') y += 54 * mode.cssScale
    ctx.save()
    for (const notice of [...mode.notices].reverse()) {
        ctx.globalAlpha = Math.min(1, (JOIN_NOTICE_MS - (now - notice.at)) / 500)
        ctx.font = `${notice.strong ? 700 : 600} ${notice.strong ? 14 : 13}px ${FONT}`
        // Leave room for the leaderboard on the left
        const width = Math.min(canvas.width - mode.hudInsets.left - mode.hudInsets.right - 150, ctx.measureText(notice.text).width + 28)
        ctx.fillStyle = notice.strong ? 'rgba(60, 40, 0, 0.85)' : 'rgba(5, 12, 24, 0.75)'
        roundedRect(ctx, canvas.width - mode.hudInsets.right - width - 12, y, width, 26, 13)
        ctx.fill()
        ctx.fillStyle = notice.strong ? GOLD : '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(notice.text, canvas.width - mode.hudInsets.right - width / 2 - 12, y + 13, width - 20)
        y += 32
    }
    ctx.restore()
}

export function drawKnockedOut(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) : void {
    const me=mode.multiplayerManager?.getLocalPlayer();
    if(me?.state==='spawning'){drawMessage(mode,ctx,canvas,'Joining the arena','Finding clear space…');return}
    const elapsed = mode.knockedOutAt === null ? 0 : performance.now() - mode.knockedOutAt
    const seconds = Math.ceil((WORLD.RESPAWN_DELAY_MS - elapsed) / 1000)
    // The credit and the knockout can land a frame or two apart, in either order
    const cause = mode.knockoutCause
    const credited = cause !== null && mode.knockedOutAt !== null && Math.abs(cause.at - mode.knockedOutAt) < 1500
    const verb =
        cause?.how === 'turbine' ? 'Fed to a turbine'
        : cause?.how === 'cannon' ? 'Blasted'
        : cause?.how === 'pulsar' ? 'Blasted'
        : cause?.how === 'bomb' ? 'Blown up'
        : cause?.how === 'edge' ? 'Shoved off'
        : cause?.how === 'traffic' ? 'Wrecked'
        : cause?.how === 'drain' ? 'Drained'
        : 'Knocked out'
    const title = credited && cause ? cause.how === 'burnup' ? 'Burned up in flight' : cause.how === 'blackhole' ? 'Shot into a black hole' : `${verb} by ${cause.by}` : 'Hit!'
    drawMessage(mode, ctx, canvas, title, seconds > 0 ? `Back in ${seconds}` : 'Finding clear space…')
}

/** Dim the screen and show a centered title and subtitle */
export function drawMessage(_mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, title: string, subtitle: string) : void {
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.fillStyle = 'rgba(5, 12, 24, 0.55)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = '#4fd1c5'
    // Shrink a long title (like one with a long player name) to fit, rather than squashing it
    let titleSize = Math.round(Math.min(canvas.height * 0.09, canvas.width * 0.1))
    ctx.font = `700 ${titleSize}px ${FONT}`
    const titleWidth = ctx.measureText(title).width
    if (titleWidth > canvas.width * 0.9) {
        titleSize = Math.floor((titleSize * canvas.width * 0.9) / titleWidth)
        ctx.font = `700 ${titleSize}px ${FONT}`
    }
    ctx.fillText(title, canvas.width / 2, canvas.height * 0.45, canvas.width * 0.9)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
    ctx.font = `500 ${Math.max(13, Math.round(canvas.height * 0.03))}px ${FONT}`
    ctx.fillText(subtitle, canvas.width / 2, canvas.height * 0.55, canvas.width * 0.9)
    ctx.restore()
}

/** Contextual aiming hint for the captor; no captive minigame or interior overlay. */
export function drawCapturePrompt(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, me: SyncedPlayer | undefined, timestamp: number): void {
    if (!me || me.state !== 'alive') return
    const u = mode.cssScale
    const now = mode.worldNow(state, timestamp)
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0)
    if (me.gulping && !COMPACT.matches) {
        ctx.fillStyle = GOLD; ctx.textAlign = 'center'; ctx.font = `700 ${13 * u}px ${FONT}`
        ctx.fillText(`Aim, then tap FIRE · ${Math.max(0, (me.gulpEndsAt - now) / 1000).toFixed(1)}s`, canvas.width / 2, canvas.height - mode.hudInsets.bottom - 68 * u)
    }
    ctx.restore()
}
