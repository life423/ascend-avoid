import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedWeaponPart } from '../types/synced';
import { PINWHEEL } from '../../server/constants/gameConstants';
import { FONT, roundedRect } from './style';
import { PART_COLORS, weaponRecipe } from './weaponStyle';
import { drawPulsarArray, pulsarPartIcon } from './shockwave';

const COLORS = PART_COLORS;

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

function drawPart(ctx: CanvasRenderingContext2D, part: SyncedWeaponPart, remaining: number, timestamp: number, weapon: string): void {
    ctx.save(); ctx.translate(part.x, part.y);
    ctx.fillStyle = 'rgba(10, 25, 40, 0.9)'; ctx.strokeStyle = COLORS[part.kind]; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (part.owner && remaining > 0) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, remaining / PINWHEEL.CLAIM_MS)); ctx.stroke();
    }
    partIcon(ctx, part.kind, 0, Math.sin(timestamp / 350 + part.kind) * 2, weapon !== 'pulsar' && part.kind === 1 ? timestamp / 1600 : -0.1, weapon === 'pulsar');
    ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = COLORS[part.kind];
    ctx.fillText(weaponRecipe(weapon).parts[part.kind], 0, 47); ctx.restore();
}

export function drawWeapons(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
    const w = state.pinwheel;
    if (!w || w.phase === 'waiting') return;
    const now = mode.worldNow(state, timestamp);
    if (w.phase === 'parts') {
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
                drawPart(ctx, { ...p, x, y }, w.claimUntil - now, timestamp, w.kind);
            } else drawPart(ctx, p, w.claimUntil - now, timestamp, w.kind);
        });
        return;
    }
    let drawX = w.x, drawY = w.y;
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
        ctx.fillStyle = '#ffe6a3'; ctx.strokeStyle = '#fff7df'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(0, -7); ctx.lineTo(-8, 0); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    });
}
