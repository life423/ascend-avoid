import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedWeaponPart, SyncedPinwheel } from '../types/synced';
import { PINWHEEL, WEAPON_FLEET } from '../../server/constants/gameConstants';
import { FONT, roundedRect } from './style';
import { PART_COLORS, weaponRecipe } from './weaponStyle';
import { drawPulsarArray, pulsarPartIcon } from './shockwave';

import { allWeapons, weaponProfile, orbitalPosition, ionFiring } from '../../server/game/weaponKit';

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

function drawPart(ctx: CanvasRenderingContext2D, part: SyncedWeaponPart, remaining: number, timestamp: number, weapon: string, own: boolean, locked: boolean): void {
    ctx.save(); ctx.translate(part.x, part.y);
    if (locked) ctx.globalAlpha = .5;
    ctx.fillStyle = 'rgba(10, 25, 40, 0.9)'; ctx.strokeStyle = COLORS[part.kind]; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (part.owner && remaining > 0) {
        ctx.strokeStyle = own ? '#80fff1' : '#96a5bc'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, remaining / PINWHEEL.CLAIM_MS)); ctx.stroke();
    }
    if (weapon === 'pinwheel' || weapon === 'pulsar') partIcon(ctx, part.kind, 0, reducedMotion.matches ? 0 : Math.sin(timestamp / 350 + part.kind) * 2, !reducedMotion.matches && weapon === 'pinwheel' && part.kind === 1 ? timestamp / 1600 : -.1, weapon === 'pulsar');
    else satellitePart(ctx, weapon, part.kind);
    if (part.owner) {
        ctx.strokeStyle = own ? '#80fff1' : '#d0d8e8'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(24, -27, 4, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = own ? '#80fff1' : '#d0d8e8'; ctx.fillRect(18, -27, 12, 9);
    }
    ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = COLORS[part.kind];
    ctx.fillText(weaponRecipe(weapon).parts[part.kind], 0, 47); ctx.restore();
}

export function drawWeapons(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
    for (const w of allWeapons(state)) drawWeapon(mode, ctx, state, timestamp, w);
}

function drawWeapon(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number, w: SyncedPinwheel): void {
    if (!w || w.phase === 'waiting') return;
    const now = mode.worldNow(state, timestamp);
    const localId = mode.multiplayerManager?.localSessionId;
    const own = w.owner === localId, locked = Boolean(w.owner && !own);
    if (w.phase === 'parts') {
        // Claim links fan out toward the locked siblings as soon as a first piece is collected.
        const claimAge = now - w.claimedAt;
        if (w.owner && claimAge >= 0 && claimAge < WEAPON_FLEET.CLAIM_PULSE_MS && !reducedMotion.matches) {
            const source = state.players.get(w.owner);
            if (source) {
                const at = mode.centerOf(w.owner, source), t = claimAge / WEAPON_FLEET.CLAIM_PULSE_MS;
                ctx.save(); ctx.strokeStyle = own ? '#80fff1' : '#aabbd3'; ctx.globalAlpha = 1 - t; ctx.lineWidth = 2;
                for (const p of w.parts) {
                    ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.lineTo(at.x + (p.x - at.x) * t, at.y + (p.y - at.y) * t); ctx.stroke();
                    ctx.beginPath(); ctx.arc(p.x, p.y, 30 + (1 - t) * 35, 0, Math.PI * 2); ctx.stroke();
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
                const x = Math.max(30, Math.min(state.worldWidth - 30, at.x + Math.cos(a) * radius));
                const y = Math.max(30, Math.min(state.worldHeight - 30, at.y + Math.sin(a) * radius));
                ctx.save(); ctx.strokeStyle = 'rgba(200, 225, 240, 0.4)'; ctx.lineWidth = 1.5;
                ctx.beginPath(); ctx.moveTo(at.x, at.y); ctx.lineTo(x, y); ctx.stroke(); ctx.restore();
                drawPart(ctx, { ...p, x, y }, w.claimUntil - now, timestamp, w.kind, own, locked);
            } else drawPart(ctx, p, w.claimUntil - now, timestamp, w.kind, own, locked);
        });
        return;
    }
    let drawX = w.x, drawY = w.y;
    const profile = weaponProfile(w.kind);
    if (w.phase === 'active' && profile.orbit) {
        const at = orbitalPosition(w.originX, w.originY, now - w.activatedAt, state.worldWidth, state.worldHeight);
        drawX = at.x; drawY = at.y;
        ctx.save(); ctx.strokeStyle = profile.color; ctx.globalAlpha = .18; ctx.lineWidth = 2; ctx.setLineDash([8, 18]);
        ctx.beginPath(); ctx.ellipse(state.worldWidth / 2, state.worldHeight / 2, state.worldWidth * .35, state.worldHeight * .32, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    const carried = w.phase === 'carried';
    const holder = carried ? state.players.get(w.owner) : undefined;
    if (holder) {
        const at = mode.centerOf(w.owner, holder);
        const facing = w.owner === mode.multiplayerManager?.localSessionId ? mode.localFacing : holder.facing;
        drawX = Math.max(56, Math.min(state.worldWidth - 56, at.x - Math.cos(facing) * (holder.width / 2 + 58)));
        drawY = Math.max(56, Math.min(state.worldHeight - 56, at.y - Math.sin(facing) * (holder.height / 2 + 58)));
    }
    ctx.save(); ctx.translate(drawX, drawY);
    const charging = w.phase === 'charging';
    ctx.strokeStyle = charging ? '#ffd47d' : '#80e7de'; ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(22, 41, 58, 0.95)'; ctx.beginPath(); ctx.arc(0, 0, 43, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (w.kind === 'pulsar') drawPulsarArray(ctx, w, now);
    else if (w.kind !== 'pinwheel') drawSatellite(ctx, w, now);
    else {
    // A visible barrel and faint aim ray show the next shot before it fires.
    ctx.save(); ctx.rotate(w.angle);
    if (!carried) { ctx.strokeStyle = 'rgba(255, 212, 125, 0.23)'; ctx.setLineDash([9, 12]); ctx.beginPath(); ctx.moveTo(54, 0); ctx.lineTo(210, 0); ctx.stroke(); ctx.setLineDash([]); }
    partIcon(ctx, 2, 31, 0, 0); ctx.restore();
    ctx.save(); ctx.scale(1.3, 1.3); partIcon(ctx, 1, 0, 0, charging ? timestamp / 160 : w.angle * 2); partIcon(ctx, 0, 0, 0, w.angle); ctx.restore();
    }
    ctx.restore();
    w.bolts.forEach(bolt => {
        ctx.save(); ctx.translate(bolt.x, bolt.y); ctx.rotate(bolt.angle);
        ctx.strokeStyle = 'rgba(255, 212, 125, 0.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-8, 0); ctx.stroke();
        if (w.kind === 'comet') ctx.scale(1.7, 1.7);
        ctx.fillStyle = profile.color; ctx.strokeStyle = '#fff7df'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(0, -7); ctx.lineTo(-8, 0); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    });
}

/** Three functional silhouettes: power source, aiming assembly, and emitter. */
function satellitePart(ctx: CanvasRenderingContext2D, weapon: string, kind: number): void {
    const color = weaponProfile(weapon).color;
    ctx.strokeStyle = color; ctx.fillStyle = '#233b56'; ctx.lineWidth = 2;
    if (kind === 0) {
        roundedRect(ctx, -20, -13, 40, 26, 3); ctx.fill(); ctx.stroke();
        for (let x = -12; x <= 12; x += 8) { ctx.beginPath(); ctx.moveTo(x, -12); ctx.lineTo(x, 12); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(-20, 0); ctx.lineTo(20, 0); ctx.stroke();
    } else if (kind === 1) {
        ctx.beginPath(); ctx.moveTo(-18, -12); ctx.quadraticCurveTo(0, 24, 18, -12); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, 4); ctx.lineTo(0, -21); ctx.stroke();
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(0, -21, 3, 0, Math.PI * 2); ctx.fill();
    } else {
        roundedRect(ctx, -21, -9, 42, 18, 4); ctx.fill(); ctx.stroke();
        ctx.fillStyle = color; ctx.fillRect(12, -10, 7, 20); ctx.fillRect(-14, -5, 5, 10);
    }
}

function drawSatellite(ctx: CanvasRenderingContext2D, w: SyncedPinwheel, now: number): void {
    const profile = weaponProfile(w.kind), active = w.phase === 'active', carried = w.phase === 'carried';
    const phase = Math.max(0, now - w.activatedAt) % WEAPON_FLEET.ION_PERIOD_MS;
    ctx.save(); ctx.rotate(w.angle);
    if (!carried) {
        const firing = active && w.kind === 'ion' && ionFiring(now - w.activatedAt);
        ctx.strokeStyle = profile.color; ctx.globalAlpha = firing ? .85 : .3;
        ctx.lineWidth = firing ? 18 : 2;
        if (!firing) ctx.setLineDash([9, 12]);
        const reach = w.kind === 'ion' ? WEAPON_FLEET.ION_RANGE : 260;
        // Ion's warning line is always visible before its firing interval.
        if (w.kind !== 'ion' || !active || phase < WEAPON_FLEET.ION_WARNING_MS || firing) {
            ctx.beginPath(); ctx.moveTo(48, 0); ctx.lineTo(reach, 0); ctx.stroke();
            if (firing) { ctx.globalAlpha = 1; ctx.strokeStyle = '#eaffff'; ctx.lineWidth = 4; ctx.stroke(); }
        }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    // Wide solar wings make moving satellites recognizable at a glance.
    if (profile.orbit) {
        ctx.save(); ctx.rotate(Math.PI / 2);
        for (const side of [-1, 1]) {
            ctx.save(); ctx.translate(side * 49, 0); ctx.scale(1.2, 1); satellitePart(ctx, w.kind, 0); ctx.restore();
        }
        ctx.restore();
    } else {
        ctx.strokeStyle = profile.color; ctx.lineWidth = 5;
        for (const side of [-1, 1]) { ctx.beginPath(); ctx.moveTo(-22, side * 13); ctx.lineTo(-40, side * 35); ctx.stroke(); }
    }
    satellitePart(ctx, w.kind, 1);
    ctx.translate(27, 0); satellitePart(ctx, w.kind, 2); ctx.restore();
    ctx.fillStyle = profile.color; ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
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
    ctx.rotate(-angle); ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center';
    ctx.fillText(weaponRecipe(w.kind).parts[target.kind], 0, 24); ctx.restore();
}
