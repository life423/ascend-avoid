import type { MultiplayerMode } from '../core/GameModes'
import { CANNON, PLAYER_COLORS, SHIFT, WORLD } from '../../server/constants/gameConstants'
import { drawCreature } from './creatures'
import { COMPACT, FONT, GOLD, drawCrown, drawPeople, drawRobot, hudPanel, roundedRect } from './style'
import { JOIN_NOTICE_MS, View } from './shared'
import type { SyncedGameState, SyncedPlayer, SyncedTurbine } from '../types/synced'

/** The whole world in a corner: everyone in it, and the part your screen shows */
export function drawMinimap(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, view: View, localId: string | null, leaderId: string | null) : void {
    const size = Math.round(Math.min(150, Math.max(84, Math.min(canvas.width, canvas.height) * 0.24)))
    const scale = size / Math.max(state.worldWidth, state.worldHeight)
    const width = state.worldWidth * scale
    const height = state.worldHeight * scale
    const x = canvas.width - width - (COMPACT.matches ? 10 * mode.cssScale : 12)
    // On phones and tablets it sits under the menu button; elsewhere, on a touchscreen the INHALE button has the bottom right, so it moves to the top
    const y = COMPACT.matches ? Math.round(54 * mode.cssScale) : mode.controls?.touchDevice ? 34 : canvas.height - height - 12
    mode.minimapBottom = y + height
    ctx.save()
    ctx.fillStyle = 'rgba(5, 12, 24, 0.72)'
    roundedRect(ctx, x - 4, y - 4, width + 8, height + 8, 10)
    ctx.fill()
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.5)'
    ctx.lineWidth = 1.5
    ctx.stroke()
    ctx.lineWidth = 1
    ctx.strokeStyle = 'rgba(79, 209, 197, 0.55)'
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
        ctx.fillStyle = isLocal ? '#ffffff' : PLAYER_COLORS[player.playerIndex % PLAYER_COLORS.length]
        ctx.beginPath()
        ctx.arc(
            x + (position.x + player.width / 2) * scale,
            y + (position.y + player.height / 2) * scale,
            // Sized like they really are, scaled up 2.5x so the differences show on so small a map
            1.5 + (player.width / 2) * scale * 2.5,
            0,
            Math.PI * 2
        )
        ctx.fill()
        if (sessionId === leaderId) {
            drawCrown(ctx, x + (position.x + player.width / 2) * scale, y + (position.y + player.height / 2) * scale - (3.5 + (player.width / 2) * scale * 2.5), 10)
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
    if (state.jackpotOn) {
        // The jackpot is the one thing the minimap points out
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
    ctx.font = `600 11px ${FONT}`
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    if (!COMPACT.matches) ctx.fillText(`${playing} playing`, x + width, y - 8)
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
    const pop = age < 160 ? 1.35 - (age / 160) * 0.35 : 1
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = age > 1350 ? Math.max(0, 1 - (age - 1350) / 350) : 1
    ctx.translate(canvas.width / 2, canvas.height * 0.3)
    ctx.scale(pop, pop)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = `900 ${Math.round(Math.min(34, canvas.width / 14))}px ${FONT}`
    ctx.lineWidth = 6
    ctx.strokeStyle = 'rgba(5, 12, 24, 0.85)'
    ctx.strokeText(mode.banner.title, 0, 0)
    ctx.fillStyle = GOLD
    ctx.fillText(mode.banner.title, 0, 0)
    if (mode.banner.sub) {
        ctx.font = `800 ${Math.round(Math.min(15, canvas.width / 28))}px ${FONT}`
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
    const top = compact ? 3 : 5
    const rows = ranked.slice(0, top).map((entry, index) => ({ ...entry, rank: index + 1 }))
    const mine = ranked.findIndex((entry) => entry.id === localId)
    const apart = mine >= top
    const me = ranked[mine]
    if (apart && me) rows.push({ ...me, rank: mine + 1 })
    // Sizes in screen points on phones, so it lines up with everything else there
    const u = compact ? mode.cssScale : 1
    const x = (compact ? 10 : 12) * u
    const y = (compact ? 10 : 12) * u
    const width = (compact ? 132 : 190) * u
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
        ctx.fillText(row.name, nameX, rowY, width - (nameX - x) - 34 * u)
        ctx.fillStyle = isLocal ? '#4fd1c5' : GOLD
        ctx.textAlign = 'right'
        ctx.fillText(String(row.gems), x + width - 9 * u, rowY)
        rowY += rowHeight
    })
    ctx.restore()
}

/** Phones and tablets: the score in a pill at the top middle, and how many are playing beside the menu button */
export function drawTopBar(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, me: SyncedPlayer) : void {
    const u = mode.cssScale
    ctx.save()
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    const top = 10 * u
    // The score
    const label = 'Score'
    const value = String(me?.gems ?? 0)
    ctx.font = `600 ${12.5 * u}px ${FONT}`
    const labelWidth = ctx.measureText(label).width
    ctx.font = `800 ${18 * u}px ${FONT}`
    const valueWidth = ctx.measureText(value).width
    const pillHeight = 34 * u
    const pillWidth = labelWidth + valueWidth + 36 * u
    const pillX = canvas.width / 2 - pillWidth / 2
    hudPanel(ctx, pillX, top, pillWidth, pillHeight, pillHeight / 2)
    ctx.font = `600 ${12.5 * u}px ${FONT}`
    ctx.fillStyle = '#e8f4f8'
    ctx.fillText(label, pillX + 14 * u, top + pillHeight / 2)
    ctx.font = `800 ${18 * u}px ${FONT}`
    ctx.fillStyle = '#4fd1c5'
    ctx.fillText(value, pillX + 22 * u + labelWidth, top + pillHeight / 2 + 1 * u)
    // How many are playing, beside the menu button
    const text = `${state.players?.size ?? 0} playing`
    ctx.font = `600 ${11 * u}px ${FONT}`
    const textWidth = ctx.measureText(text).width
    const height = 28 * u
    const width = textWidth + 34 * u
    const x = canvas.width - (10 + 36 + 8) * u - width
    const y = top + (36 * u - height) / 2
    hudPanel(ctx, x, y, width, height, height / 2)
    drawPeople(ctx, x + 14 * u, y + height / 2, 14 * u, '#cfe8ee')
    ctx.fillStyle = '#e8f4f8'
    ctx.fillText(text, x + 25 * u, y + height / 2)
    ctx.restore()
}

/** Recent notices at the top right, newest first, fading out */
export function drawNotices(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) : void {
    const now = performance.now()
    mode.notices = mode.notices.filter((notice) => now - notice.at < JOIN_NOTICE_MS)
    let y = mode.controls?.touchDevice || COMPACT.matches ? mode.minimapBottom + 12 : 12
    ctx.save()
    for (const notice of [...mode.notices].reverse()) {
        ctx.globalAlpha = Math.min(1, (JOIN_NOTICE_MS - (now - notice.at)) / 500)
        ctx.font = `${notice.strong ? 700 : 600} ${notice.strong ? 14 : 13}px ${FONT}`
        // Leave room for the leaderboard on the left
        const width = Math.min(canvas.width - 150, ctx.measureText(notice.text).width + 28)
        ctx.fillStyle = notice.strong ? 'rgba(60, 40, 0, 0.85)' : 'rgba(5, 12, 24, 0.75)'
        roundedRect(ctx, canvas.width - width - 12, y, width, 26, 13)
        ctx.fill()
        ctx.fillStyle = notice.strong ? GOLD : '#ffffff'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(notice.text, canvas.width - width / 2 - 12, y + 13, width - 20)
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
        : cause?.how === 'bomb' ? 'Blown up'
        : cause?.how === 'edge' ? 'Shoved off'
        : cause?.how === 'traffic' ? 'Wrecked'
        : 'Knocked out'
    const title = credited && cause ? `${verb} by ${cause.by}` : 'Hit!'
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

/**
 * Caught, or holding someone: the prompt at the bottom of the screen. Caught: the directions to push, in
 * order, lighting up as you get them (greyed while you're dazed; a wrong one flashes red and starts you
 * over). Holding someone: who you've got, and that letting go fires them.
 */
export function drawCapturePrompt(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, me: SyncedPlayer | undefined, timestamp: number) : void {
    if (!me || me.state !== 'alive') return
    const compact = COMPACT.matches
    const u = compact ? mode.cssScale : 1
    const touch = Boolean(mode.controls?.touchDevice)
    const centerX = canvas.width / 2
    const bottom = canvas.height - (touch ? 124 : 36) * u
    if (me.capturedBy) {
        const captor = state.players.get(me.capturedBy)
        const keys = String(me.escapeKeys ?? '').split('').filter(Boolean)
        if (keys.length === 0) return
        const now = mode.worldNow(state, timestamp)
        const dazed = now < me.dazedUntil
        // When the captor can first fire: the hold's safety net ends HOLD_MS after the catch, the gun loads ARM_MS after it
        const armedAt = captor ? captor.gulpEndsAt - CANNON.HOLD_MS + CANNON.ARM_MS : 0
        const loading = captor ? Math.max(0, Math.min(1, 1 - (armedAt - now) / CANNON.ARM_MS)) : 1
        const sinceMiss = now - me.escapeMissAt
        const missed = me.escapeMissAt > 0 && sinceMiss < 380
        const cell = 46 * u
        const gap = 10 * u
        const width = Math.max(240 * u, keys.length * (cell + gap) - gap + 48 * u)
        const height = 120 * u
        const x = centerX - width / 2
        const y = bottom - height
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        hudPanel(ctx, x, y, width, height, 16 * u)
        if (missed) {
            ctx.strokeStyle = `rgba(255, 90, 90, ${0.9 * (1 - sinceMiss / 380)})`
            ctx.lineWidth = 3 * u
            roundedRect(ctx, x, y, width, height, 16 * u)
            ctx.stroke()
        }
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.font = `800 ${16 * u}px ${FONT}`
        ctx.fillStyle = dazed ? '#cfd8dc' : GOLD
        const who = captor ? String(captor.name ?? '') : 'someone'
        ctx.fillText(dazed ? `Caught by ${who}!` : 'Wriggle out!', centerX, y + 22 * u, width - 24 * u)
        ctx.font = `600 ${12 * u}px ${FONT}`
        ctx.fillStyle = 'rgba(255, 255, 255, 0.75)'
        const hint = dazed ? 'Hang on…' : missed ? 'Wrong one: from the top' : loading >= 1 ? 'They can fire you now' : touch ? 'Flick the stick these ways, in order' : 'Tap these, in order (WASD or arrows)'
        ctx.fillStyle = loading >= 1 && !dazed && !missed ? 'rgba(255, 120, 120, 0.9)' : 'rgba(255, 255, 255, 0.75)'
        ctx.fillText(hint, centerX, y + 42 * u, width - 24 * u)
        // The directions, lit as they're got; the next one pulses
        const rowY = y + 82 * u
        const startX = centerX - (keys.length * (cell + gap) - gap) / 2
        for (let i = 0; i < keys.length; i++) {
            const kx = startX + i * (cell + gap)
            const done = i < me.escapeStep
            const current = i === me.escapeStep && !dazed
            ctx.fillStyle = done ? GOLD : current ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.07)'
            roundedRect(ctx, kx, rowY - cell / 2, cell, cell, 10 * u)
            ctx.fill()
            if (current) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${0.55 + 0.45 * Math.sin(timestamp / 110)})`
                ctx.lineWidth = 2 * u
                roundedRect(ctx, kx, rowY - cell / 2, cell, cell, 10 * u)
                ctx.stroke()
            }
            drawArrow(ctx, kx + cell / 2, rowY, cell * 0.5, keys[i], done ? '#2a2000' : dazed ? 'rgba(255, 255, 255, 0.35)' : current ? '#ffffff' : 'rgba(255, 255, 255, 0.6)')
        }
        // Along the bottom: the captor's gun loading (red, filling up), and while you're dazed, your daze draining (blue, above it)
        if (loading < 1) {
            ctx.fillStyle = 'rgba(255, 90, 90, 0.25)'
            roundedRect(ctx, x + 14 * u, y + height - 10 * u, width - 28 * u, 4 * u, 2 * u)
            ctx.fill()
            ctx.fillStyle = 'rgba(255, 90, 90, 0.9)'
            roundedRect(ctx, x + 14 * u, y + height - 10 * u, Math.max(1, (width - 28 * u) * loading), 4 * u, 2 * u)
            ctx.fill()
        }
        if (dazed) {
            const left = Math.max(0, Math.min(1, (me.dazedUntil - now) / CANNON.CAPTIVE_STUN_MS))
            ctx.fillStyle = 'rgba(160, 230, 255, 0.85)'
            roundedRect(ctx, x + 14 * u, y + height - 17 * u, Math.max(1, (width - 28 * u) * left), 4 * u, 2 * u)
            ctx.fill()
        }
        ctx.restore()
        return
    }
    if (me.gulping) {
        const captive = state.players.get(me.gulping)
        if (!captive || captive.capturedBy !== me.sessionId) return
        const now = mode.worldNow(state, timestamp)
        const armedAt = me.gulpEndsAt - CANNON.HOLD_MS + CANNON.ARM_MS
        const loading = Math.max(0, Math.min(1, 1 - (armedAt - now) / CANNON.ARM_MS))
        const armed = loading >= 1
        const width = 270 * u
        const height = 64 * u
        const x = centerX - width / 2
        const y = bottom - height
        ctx.save()
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        hudPanel(ctx, x, y, width, height, 14 * u)
        // Loading: a bar fills along the bottom; loaded: the frame glows
        if (armed) {
            ctx.strokeStyle = `rgba(255, 209, 102, ${0.5 + 0.4 * Math.sin(timestamp / 160)})`
            ctx.lineWidth = 2 * u
            roundedRect(ctx, x, y, width, height, 14 * u)
            ctx.stroke()
        } else {
            ctx.fillStyle = 'rgba(255, 209, 102, 0.2)'
            roundedRect(ctx, x + 14 * u, y + height - 9 * u, width - 28 * u, 4 * u, 2 * u)
            ctx.fill()
            ctx.fillStyle = GOLD
            roundedRect(ctx, x + 14 * u, y + height - 9 * u, Math.max(1, (width - 28 * u) * loading), 4 * u, 2 * u)
            ctx.fill()
        }
        ctx.fillStyle = PLAYER_COLORS[captive.playerIndex % PLAYER_COLORS.length]
        ctx.beginPath()
        ctx.arc(x + 26 * u, y + height / 2, 9 * u, 0, Math.PI * 2)
        ctx.fill()
        ctx.textAlign = 'left'
        ctx.textBaseline = 'middle'
        ctx.font = `800 ${15 * u}px ${FONT}`
        ctx.fillStyle = GOLD
        ctx.fillText(`${armed ? 'Loaded' : 'Loading'}: ${String(captive.name ?? '')}`, x + 44 * u, y + 22 * u, width - 56 * u)
        ctx.font = `600 ${12 * u}px ${FONT}`
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)'
        const ready = armed ? (touch ? 'Face your target, then tap the button to fire' : 'Face your target, then tap to fire') : `Ready to fire in ${Math.max(0, (armedAt - now) / 1000).toFixed(1)} s`
        ctx.fillText(ready, x + 44 * u, y + 41 * u, width - 56 * u)
        ctx.restore()
    }
}

/** An arrow pointing U, D, L or R: a stem and a head */
function drawArrow(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, key: string, color: string) : void {
    const angle = key === 'U' ? -Math.PI / 2 : key === 'D' ? Math.PI / 2 : key === 'L' ? Math.PI : 0
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(angle)
    ctx.strokeStyle = color
    ctx.lineWidth = Math.max(2, size * 0.16)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(-size * 0.45, 0)
    ctx.lineTo(size * 0.45, 0)
    ctx.moveTo(size * 0.1, -size * 0.35)
    ctx.lineTo(size * 0.45, 0)
    ctx.lineTo(size * 0.1, size * 0.35)
    ctx.stroke()
    ctx.restore()
}
