import { constrainArenaPoint } from '../../server/game/arenaBoundary';
import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedWeaponPart, SyncedPinwheel } from '../types/synced';
import { PINWHEEL, SHOCKWAVE, WEAPON_FLEET, WEAPON_SHOTS } from '../../server/constants/gameConstants';
import { COMPACT, FONT, roundedRect } from './style';
import { PART_COLORS, weaponRecipe } from './weaponStyle';
import { drawPulsarArray, pulsarPartIcon } from './shockwave';

import { allWeapons, weaponProfile, orbitalPosition, ionFiring } from '../../server/game/weaponKit';
import { inView, segmentInView } from './shared';
import { ANDROID_FIREFOX_RENDERING } from './browserRendering';
import { pulsarRadius } from '../../server/game/pulsar';
import { drawWeaponBolts } from './weaponShots';
import { ownsWeapon, ownershipReveal, drawOwnership, ownershipStroke, WEAPON_OWNERSHIP } from './weaponOwnership';

const COLORS = PART_COLORS;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

function partIcon(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, angle: number, pulsar = false): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = COLORS[kind]; ctx.strokeStyle = '#e9f6ff'; ctx.lineWidth = 2;
    if (pulsar) pulsarPartIcon(ctx, kind);
    else if (kind === 0) {
        ctx.beginPath();
        for (let i = 0; i < 24; i++) {
            const a = i * Math.PI / 12, r = i % 3 === 0 ? 20 : 16;
            if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
            else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#203343'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    } else if (kind === 1) {
        for (let i = 0; i < 4; i++) {
            ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0);
            ctx.quadraticCurveTo(26, -19, 20, 3); ctx.quadraticCurveTo(12, 14, 0, 0); ctx.fill(); ctx.stroke();
        }
    } else {
        roundedRect(ctx, -21, -9, 42, 18, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#26394a'; ctx.fillRect(12, -7, 6, 14);
        ctx.fillStyle = '#fff'; ctx.fillRect(-10, -8, 4, 16);
    }
    ctx.restore();
}

function drawPart(ctx: CanvasRenderingContext2D, part: SyncedWeaponPart, remaining: number, timestamp: number, weapon: string, own: boolean, locked: boolean, stealable = false): void {
    ctx.save(); ctx.translate(part.x, part.y);
    if (locked) ctx.globalAlpha = stealable ? .85 : .3;
    ctx.fillStyle = 'rgba(10, 25, 40, 0.9)'; ctx.strokeStyle = COLORS[part.kind]; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (part.owner && remaining > 0) {
        ctx.strokeStyle = own ? '#80fff1' : '#96a5bc'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, remaining / PINWHEEL.CLAIM_MS)); ctx.stroke();
    }
    if (weapon === 'pinwheel' || weapon === 'pulsar') partIcon(ctx, part.kind, 0, reducedMotion.matches ? 0 : Math.sin(timestamp / 350 + part.kind) * 2, !reducedMotion.matches && weapon === 'pinwheel' && part.kind === 1 ? timestamp / 1600 : -.1, weapon === 'pulsar');
    else satellitePart(ctx, weapon, part.kind);
    if (part.owner) {
        ctx.globalAlpha = 1;
        const accent = locked ? (stealable ? '#ffd47d' : '#ff7c82') : '#80fff1';
        ctx.strokeStyle = accent; ctx.lineWidth = 3;
        if (locked) ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.arc(0, 0, 35, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = '#102030'; ctx.beginPath(); ctx.arc(25, -25, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = accent; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
        if (stealable) { ctx.moveTo(31, -29); ctx.lineTo(19, -21); ctx.moveTo(20, -29); ctx.lineTo(19, -21); ctx.lineTo(27, -20); }
        else if (locked) { ctx.moveTo(20, -30); ctx.lineTo(30, -20); ctx.moveTo(30, -30); ctx.lineTo(20, -20); }
        else { ctx.moveTo(19, -25); ctx.lineTo(23, -21); ctx.lineTo(31, -30); }
        ctx.stroke();
    }
    if (part.carriedBy && part.theftBy && part.theftMs > 0) {
        const progress = Math.min(1, part.theftMs / PINWHEEL.PART_THEFT_MS);
        ctx.globalAlpha = 1; ctx.lineWidth = 4; ctx.lineCap = 'round';
        ctx.strokeStyle = '#33291b'; ctx.beginPath(); ctx.arc(0, 0, 41, 0, Math.PI * 2); ctx.stroke();
        ctx.strokeStyle = '#ffd47d'; ctx.beginPath(); ctx.arc(0, 0, 41, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2); ctx.stroke();
    }
    if (!COMPACT.matches && !locked) {
        ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = COLORS[part.kind];
        ctx.fillText(weaponRecipe(weapon).parts[part.kind], 0, 47);
    }
    ctx.restore();
}

export function drawWeapons(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
    const weapons = allWeapons(state);
    const now = mode.worldNow(state, timestamp);
    const unit = mode.cssScale / Math.max(.001, Math.abs(ctx.getTransform().a));
    for (const w of weapons) drawWeapon(mode, ctx, state, timestamp, w, now, unit, weapons);
}

function drawWeapon(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number, w: SyncedPinwheel, now: number, unit: number, weapons: readonly SyncedPinwheel[]): void {
    if (!w) return;
    const reveal = ownershipReveal(w, mode.multiplayerManager?.localSessionId, now);
    if (w.phase === 'waiting') return;
    const localId = mode.multiplayerManager?.localSessionId;
    const own = ownsWeapon(w, localId), locked = Boolean(w.owner && !own);
    const view = ANDROID_FIREFOX_RENDERING ? mode.renderView : null;
    if (w.phase === 'parts') {
        // Claim links fan out toward the locked siblings as soon as a first piece is collected.
        const claimAge = now - w.claimedAt;
        if (w.owner && claimAge >= 0 && claimAge < WEAPON_FLEET.CLAIM_PULSE_MS && !reducedMotion.matches) {
            const source = state.players.get(w.owner);
            if (source) {
                const at = mode.centerOf(w.owner, source), t = claimAge / WEAPON_FLEET.CLAIM_PULSE_MS;
                ctx.save(); ctx.strokeStyle = own ? '#80fff1' : '#aabbd3'; ctx.globalAlpha = 1 - t; ctx.lineWidth = 2;
                for (const p of w.parts) {
                    const x = at.x + (p.x - at.x) * t, y = at.y + (p.y - at.y) * t;
                    if (segmentInView(view, at.x, at.y, x, y, 2)) {
                        ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.lineTo(x, y); ctx.stroke();
                    }
                    if (inView(view, p.x, p.y, 66)) {
                        ctx.beginPath(); ctx.arc(p.x, p.y, 30 + (1 - t) * 35, 0, Math.PI * 2); ctx.stroke();
                    }
                }
                ctx.restore();
            }
        }
        if (own && localId) drawGuidance(mode, ctx, state, w, localId);
        w.parts.forEach(p => {
            const carrier = p.carriedBy ? state.players.get(p.carriedBy) : undefined;
            if (carrier) {
                const at = mode.centerOf(p.carriedBy, carrier);
                const facing = p.carriedBy === mode.multiplayerManager?.localSessionId ? mode.localFacing : carrier.facing;
                const a = facing + Math.PI + (p.kind - 1) * 0.55;
                const radius = carrier.width / 2 + 43;
                let x = Math.max(30, Math.min(state.worldWidth - 30, at.x + Math.cos(a) * radius));
                let y = Math.max(30, Math.min(state.worldHeight - 30, at.y + Math.sin(a) * radius));
                const bounded = { x, y }; constrainArenaPoint(bounded, state.worldWidth, state.worldHeight, 30);
                x = bounded.x; y = bounded.y;
                if (segmentInView(view, at.x, at.y, x, y, 2)) {
                    ctx.save(); ctx.strokeStyle = 'rgba(200, 225, 240, 0.4)'; ctx.lineWidth = 1.5;
                    ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
                }
                if (inView(mode.renderView, x, y, 85)) drawPart(ctx, { ...p, x, y }, w.claimUntil - now, timestamp, w.kind, own, locked, locked && !carrier.spawnProtected && carrier.launchSafeUntil <= now && !weapons.some(other => other && other !== w && other.owner === localId && (other.phase === 'parts' || other.phase === 'carried')));
            } else if (inView(mode.renderView, p.x, p.y, 85)) drawPart(ctx, p, w.claimUntil - now, timestamp, w.kind, own, locked);
        });
        return;
    }
    let drawX = w.x, drawY = w.y;
    const profile = weaponProfile(w.kind);
    if (w.phase === 'active' && profile.orbit) {
        const at = orbitalPosition(w.originX, w.originY, now - w.activatedAt, state.worldWidth, state.worldHeight, w.kind);
        drawX = at.x; drawY = at.y;
    }
    const carried = w.phase === 'carried';
    const holder = carried ? state.players.get(w.owner) : undefined;
    if (holder) {
        const at = mode.centerOf(w.owner, holder);
        const facing = w.owner === mode.multiplayerManager?.localSessionId ? mode.localFacing : holder.facing;
        drawX = Math.max(56, Math.min(state.worldWidth - 56, at.x - Math.cos(facing) * (holder.width / 2 + 58)));
        drawY = Math.max(56, Math.min(state.worldHeight - 56, at.y - Math.sin(facing) * (holder.height / 2 + 58)));
    }
    const bounded = { x: drawX, y: drawY }; constrainArenaPoint(bounded, state.worldWidth, state.worldHeight, 56);
    drawX = bounded.x; drawY = bounded.y;
    // A weapon can fire into the view even when its chassis is offscreen.
    const bodyVisible = inView(view, drawX, drawY, 85 + 28 * unit);
    const age = now - w.pulseAt;
    const waveVisible = w.kind === 'pulsar' && w.phase === 'active' && w.pulseAt > 0
        && age >= 0 && age <= SHOCKWAVE.WAVE_MS + SHOCKWAVE.FADE_MS
        && inView(view, drawX + w.pulseX - w.x, drawY + w.pulseY - w.y, pulsarRadius(age) + 12 + 4 * unit);
    const ionVisible = w.kind === 'ion' && !carried
        && segmentInView(view, drawX + 48 * Math.cos(w.angle), drawY + 48 * Math.sin(w.angle),
            drawX + WEAPON_FLEET.ION_RANGE * Math.cos(w.angle), drawY + WEAPON_FLEET.ION_RANGE * Math.sin(w.angle), 10 + 4 * unit);
    if (bodyVisible || waveVisible || ionVisible) {
        ctx.save(); ctx.translate(drawX, drawY);
        const charging = w.phase === 'charging';
        if (bodyVisible) {
            ctx.strokeStyle = charging ? '#ffd47d' : '#8195aa'; ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(22, 41, 58, 0.95)'; ctx.beginPath(); ctx.arc(0, 0, 43, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        }
        if (w.kind === 'pulsar') drawPulsarArray(ctx, w, now, own, unit, bodyVisible, waveVisible);
        else if (w.kind !== 'pinwheel') drawSatellite(ctx, w, now, own, unit, bodyVisible, ionVisible);
        else if (bodyVisible) {
            // Barrel-local preparation, with no arena-spanning dotted firing lanes.
            ctx.save(); ctx.rotate(w.angle);
            partIcon(ctx, 2, 31, 0, 0); ctx.restore();
            ctx.save(); ctx.scale(1.3, 1.3); partIcon(ctx, 1, 0, 0, charging ? timestamp / 160 : w.angle * 2); partIcon(ctx, 0, 0, 0, w.angle); ctx.restore();
            if (w.phase === 'active') { ctx.save(); ctx.rotate(w.angle); drawMuzzleCharge(ctx, 1 - (w.nextShotAt - now) / profile.shotMs, own, unit); ctx.restore(); }
        }
        if (own && bodyVisible) drawOwnership(ctx, unit, reveal, reducedMotion.matches);
        ctx.restore();
    }
    drawWeaponBolts(mode, ctx, w, now, timestamp);
}

/** Three functional silhouettes: power source, aiming assembly, and emitter. */
function satellitePart(ctx: CanvasRenderingContext2D, weapon: string, kind: number): void {
    const color = weaponProfile(weapon).color;
    ctx.strokeStyle = color; ctx.fillStyle = '#233b56'; ctx.lineWidth = 2;
    if (kind === 0) {
        roundedRect(ctx, -20, -13, 40, 26, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath();
        for (let x = -12; x <= 12; x += 8) { ctx.moveTo(x, -12); ctx.lineTo(x, 12); }
        ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
    } else if (kind === 1) {
        ctx.beginPath(); ctx.moveTo(-18, -12); ctx.quadraticCurveTo(0, 24, 18, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -21); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -21, 3, 0, Math.PI * 2); ctx.fill();
    } else {
        roundedRect(ctx, -21, -9, 42, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color; ctx.fillRect(12, -10, 7, 20); ctx.fillRect(-14, -5, 5, 10);
    }
}

function drawSatellite(ctx: CanvasRenderingContext2D, w: SyncedPinwheel, now: number, own: boolean, unit: number, bodyVisible: boolean, ionVisible: boolean): void {
    const profile = weaponProfile(w.kind), active = w.phase === 'active';
    const phase = Math.max(0, now - w.activatedAt) % WEAPON_FLEET.ION_PERIOD_MS;
    ctx.save(); ctx.rotate(w.angle);
    const chargingShot = active && now >= w.nextShotAt - WEAPON_SHOTS.CHARGE_MS;
    if (ionVisible) {
        const firing = active && ionFiring(now - w.activatedAt);
        const color = own ? WEAPON_OWNERSHIP.mint : WEAPON_OWNERSHIP.hostile;
        const reach = WEAPON_FLEET.ION_RANGE;
        if (!firing) ctx.setLineDash([9, 12]);
        // Dash/solid remains the warning/firing distinction independently of ownership.
        if (!active || phase < WEAPON_FLEET.ION_WARNING_MS || firing) {
            ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(reach, 0);
            if (firing) {
                ctx.save(); ctx.globalAlpha = .35; ctx.strokeStyle = profile.color; ctx.lineWidth = 18; ctx.stroke(); ctx.restore();
            }
            ownershipStroke(ctx, color, (firing ? 2.5 : 1.2) * unit, unit);
        }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    if (!bodyVisible) { ctx.restore(); return; }
    // Wide solar wings make moving satellites recognizable at a glance.
    if (profile.orbit) {
        ctx.save(); ctx.rotate(Math.PI / 2);
        for (const side of [-1, 1]) {
            ctx.save(); ctx.translate(side * 49, 0); ctx.scale(1.2, 1); satellitePart(ctx, w.kind, 0); ctx.restore();
        }
        ctx.restore();
    } else {
        ctx.strokeStyle = profile.color; ctx.lineWidth = 5;
        ctx.beginPath();
        for (const side of [-1, 1]) { ctx.moveTo(-22, side * 13); ctx.lineTo(-40, side * 35); }
        ctx.stroke();
    }
    satellitePart(ctx, w.kind, 1);
    ctx.save(); ctx.translate(27, 0); satellitePart(ctx, w.kind, 2); ctx.restore();
    if (chargingShot && w.kind !== 'ion') drawMuzzleCharge(ctx, 1 - (w.nextShotAt - now) / WEAPON_SHOTS.CHARGE_MS, own, unit);
    ctx.restore();
    ctx.fillStyle = profile.color; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
}

/** A chamber filling with light and a tightening flare show commitment without drawing a lane. */
function drawMuzzleCharge(ctx: CanvasRenderingContext2D, progress: number, own: boolean, unit: number): void {
    const t = Math.max(0, Math.min(1, progress));
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const rgb = own ? '128,255,241' : '255,137,111';
    ctx.fillStyle = `rgba(${rgb},${.35 + .6 * t})`;
    ctx.fillRect(22, -4, 26 * t, 8);
    ctx.fillStyle = `rgba(${rgb},${.08 + .12 * t})`;
    ctx.beginPath(); ctx.arc(50, 0, 9 + (reducedMotion.matches ? 0 : 4 * t), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff3e9'; ctx.beginPath(); ctx.arc(50, 0, 2 + 3 * t, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = own ? WEAPON_OWNERSHIP.mint : '#ffad94'; ctx.lineWidth = 2;
    const x = reducedMotion.matches ? 64 : 64 - 7 * t, height = 9 - 3 * t;
    ctx.beginPath(); ctx.moveTo(x - 5, -height); ctx.lineTo(x + 2, 0); ctx.lineTo(x - 5, height); ownershipStroke(ctx, own ? WEAPON_OWNERSHIP.mint : WEAPON_OWNERSHIP.hostile, 1.5 * unit, unit);
    ctx.restore();
}

function drawGuidance(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, w: SyncedPinwheel, id: string): void {
    const player = state.players.get(id); if (!player) return;
    const at = mode.centerOf(id, player);
    const parts = Array.from(w.parts).filter(p => p.carriedBy !== id);
    parts.sort((a, b) => Math.hypot(a.x - at.x, a.y - at.y) - Math.hypot(b.x - at.x, b.y - at.y));
    const target = parts[0]; if (!target) return;
    const angle = Math.atan2(target.y - at.y, target.x - at.x), radius = player.width / 2 + 72;
    ctx.save(); ctx.translate(at.x, at.y); ctx.rotate(angle); ctx.translate(radius, 0);
    ctx.strokeStyle = '#80fff1'; ctx.fillStyle = '#80fff1'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-10, -9); ctx.lineTo(0, 0); ctx.lineTo(-10, 9); ctx.stroke();
    ctx.rotate(-angle);
    ctx.save(); ctx.translate(0, 24); ctx.scale(.45, .45);
    if (w.kind === 'pinwheel' || w.kind === 'pulsar') partIcon(ctx, target.kind, 0, 0, 0, w.kind === 'pulsar');
    else satellitePart(ctx, w.kind, target.kind);
    ctx.restore();
    for (let i = 0; i < 3; i++) {
        const collected = Boolean(w.progress & (1 << i));
        ctx.fillStyle = collected ? '#80fff1' : '#102030'; ctx.strokeStyle = '#80fff1'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc((i-1)*10, 45, 3.5, 0, Math.PI*2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
}
