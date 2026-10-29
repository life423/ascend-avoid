import type { MultiplayerMode } from '../core/GameModes'
import { GEMS, PLAYER_COLORS, SHIFT, WORLD } from '../../server/constants/gameConstants'
import { drawCreature } from './creatures'
import { COMPACT, FONT, GOLD, drawCrown, drawRobot, drawPeople, hudPanel, roundedRect } from './style'
import { JOIN_NOTICE_MS, View } from './shared'
import type { SyncedGameState, SyncedPlayer, SyncedTurbine } from '../types/synced'
import { weaponRecipe } from './weaponStyle'
import { allWeapons, weaponProfile } from '../../server/game/weaponKit'
import { formatGems } from '../utils/score'

function weaponMarker(ctx: CanvasRenderingContext2D, x: number, y: number, kind: string, own: boolean, charging = false): void {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#0c1725';
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
    if (own) { ctx.strokeStyle = '#80fff1'; ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.stroke(); }
    ctx.restore();
}

/** The whole world in a corner: everyone in it, and the part your screen shows */
export function drawMinimap(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, view: View, localId: string | null, leaderId: string | null) : void {
    const compact = COMPACT.matches, u = compact ? mode.cssScale : 1
    const size = compact ? (canvas.clientHeight < 500 ? 84 : Math.min(128, Math.max(96, canvas.clientWidth * .27))) * u
        : Math.round(Math.min(150, Math.max(84, Math.min(canvas.width, canvas.height) * .24)))
    const scale = size / Math.max(state.worldWidth, state.worldHeight)
    const width = state.worldWidth * scale, height = state.worldHeight * scale
    const dockX = canvas.width - width - mode.hudInsets.right - 26 * u
    const dockY = mode.hudInsets.top + 10 * u
    const x = compact ? dockX + 8 * u : canvas.width - width - mode.hudInsets.right - 12
    const y = compact ? dockY + 52 * u : mode.controls?.touchDevice ? Math.max(mode.hudInsets.top + 76, mode.chromeBottom + 24) : canvas.height - height - mode.hudInsets.bottom - 12
    mode.minimapBottom = y + height
    ctx.save()
    if (compact) hudPanel(ctx, dockX, dockY, width + 16 * u, height + 60 * u, 12 * u)
    else hudPanel(ctx, x - 4, y - 4, width + 8, height + 8, 10)
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.25)'
    ctx.strokeRect(x, y, width, height)
    if (state.floor) {
        // The (new) floor: the void is dark, or red while it's still coming
        const tile = width / SHIFT.GRID
        ctx.fillStyle = state.shiftPhase === 'grace' ? 'rgba(255, 90, 90, 0.35)' : 'rgba(0, 0, 0, 0.75)'
        for (let i = 0; i < state.floor.length; i++) {
            if (state.floor[i] === '0') ctx.fillRect(x + (i % SHIFT.GRID) * tile, y + Math.floor(i / SHIFT.GRID) * tile, tile, tile)
        }
    }
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)'
    ctx.strokeRect(
        x + (view.x - view.width / 2) * scale,
        y + (view.y - view.height / 2) * scale,
        view.width * scale,
        view.height * scale
    )
    let playing = 0
    state.players.forEach((player: SyncedPlayer, sessionId: string) => {
        playing++
        if (player.state !== 'alive') return
        const isLocal = sessionId === localId
        const position = isLocal && mode.predicted ? mode.predicted : player
        const markerRadius = 2 + 6 * Math.min(1, player.width / (Math.min(state.worldWidth, state.worldHeight) * GEMS.SIZE_MAX_SHARE)) ** .6
        ctx.fillStyle = isLocal ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
        ctx.beginPath()
        ctx.arc(
            x + (position.x + player.width / 2) * scale,
            y + (position.y + player.height / 2) * scale,
            // Preserve size differences without a late giant hiding the minimap's other landmarks.
            markerRadius,
            0,
            Math.PI * 2
        )
        ctx.fill()
        if (sessionId === leaderId) {
            drawCrown(ctx, x + (position.x + player.width / 2) * scale, y + (position.y + player.height / 2) * scale - markerRadius - 2, 10)
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
    state.blackHoles?.forEach(hole => {
        const hx = x + hole.x * scale, hy = y + hole.y * scale
        ctx.fillStyle = '#02030c'; ctx.strokeStyle = state.time >= hole.activeAt ? '#d6a0ff' : GOLD; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.arc(hx, hy, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke()
        ctx.beginPath(); ctx.ellipse(hx, hy, 7, 2.5, -.35, 0, Math.PI * 2); ctx.stroke()
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
        const own = w.owner === localId, locked = Boolean(w.owner && !own);
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
            if (!w.owner && (w.kind === 'pinwheel' || w.kind === 'pulsar')) weaponMarker(ctx, x + w.x * scale, y + w.y * scale, w.kind, false);
        } else {
            const wx = x + w.x * scale, wy = y + w.y * scale;
            weaponMarker(ctx, wx, wy, w.kind, own, w.phase === 'charging');
        }
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    if (compact) {
        ctx.strokeStyle = '#d1e5ef'; drawPeople(ctx, dockX + 15 * u, dockY + 22 * u, 12 * u, '#d1e5ef')
        ctx.font = `700 ${12 * u}px ${FONT}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#d1e5ef'
        ctx.fillText(String(playing), dockX + 30 * u, dockY + 27 * u)
    } else {
        ctx.font = `600 11px ${FONT}`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
        ctx.fillText(`${playing} playing`, x + width, y - 8)
    }
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
    const ranked: { id: string; name: string; gems: number; isBot: boolean }[] = []
    state.players.forEach((player: SyncedPlayer, id: string) => {
        ranked.push({ id, name: String(player.name), gems: player.gems, isBot: player.isBot === true })
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
    ctx.save()
    hudPanel(ctx, x, y, width, rows.length * rowHeight + 10 * u + gapForYou, 10 * u)
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
            ctx.fillText(String(row.rank), x + 14 * u, rowY)
        }
        let nameX = x + 27 * u
        if (row.isBot) {
            drawRobot(ctx, x + 33 * u, rowY, 9 * u)
            nameX += 13 * u
        } else if (isLocal) {
            drawCreature(ctx, x + 33 * u, rowY, 14 * u, '#ffffff', -0.7)
            nameX += 13 * u
        }
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
        ctx.fillText(name, nameX, rowY)
        ctx.fillStyle = isLocal ? '#4fd1c5' : GOLD
        ctx.textAlign = 'right'
        ctx.fillText(score, x + width - 9 * u, rowY)
        rowY += rowHeight
    })
    ctx.restore()
}

/** Phones and tablets: score between the leaderboard and menu; player count belongs to the minimap. */
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
    hudPanel(ctx, pillX, top, pillWidth, pillHeight, pillHeight / 2)
    ctx.font = `600 ${12.5 * u}px ${FONT}`
    ctx.fillStyle = '#e8f4f8'
    ctx.fillText(label, pillX + 14 * u, top + pillHeight / 2)
    ctx.font = `800 ${18 * u}px ${FONT}`
    ctx.fillStyle = '#4fd1c5'
    ctx.textAlign = 'right'
    ctx.fillText(value, pillX + pillWidth - 14 * u, top + pillHeight / 2 + 1 * u)
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
    drawMessage(mode, ctx, canvas, title, seconds > 0 ? `Back in ${seconds}` : 'Back in a moment')
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
