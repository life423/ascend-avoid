import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedWeaponPart } from '../types/synced';
import { PINWHEEL } from '../../server/constants/gameConstants';
import { FONT, COMPACT, hudPanel, roundedRect } from './style';

const COLORS = ['#ffd47d', '#80e7de', '#ffa8be'];
const NAMES = ['HUB', 'ROTOR', 'BARREL'];

function partIcon(ctx: CanvasRenderingContext2D, kind: number, x: number, y: number, angle: number): void {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle);
    ctx.fillStyle = COLORS[kind]; ctx.strokeStyle = '#e9f6ff'; ctx.lineWidth = 2;
    if (kind === 0) {
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

function drawPart(ctx: CanvasRenderingContext2D, part: SyncedWeaponPart, remaining: number, timestamp: number): void {
    ctx.save(); ctx.translate(part.x, part.y);
    ctx.fillStyle = 'rgba(10, 25, 40, 0.9)'; ctx.strokeStyle = COLORS[part.kind]; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (part.owner && remaining > 0) {
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 3; ctx.beginPath();
        ctx.arc(0, 0, 34, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, remaining / PINWHEEL.CLAIM_MS)); ctx.stroke();
    }
    partIcon(ctx, part.kind, 0, Math.sin(timestamp / 350 + part.kind) * 2, part.kind === 1 ? timestamp / 1600 : -0.1);
    ctx.font = `800 10px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = COLORS[part.kind];
    ctx.fillText(NAMES[part.kind], 0, 47); ctx.restore();
}

export function drawPinwheel(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, state: SyncedGameState, timestamp: number): void {
    const w = state.pinwheel;
    if (!w || w.phase === 'waiting') return;
    const now = mode.worldNow(state, timestamp);
    if (w.phase === 'parts') {
        w.parts.forEach(p => drawPart(ctx, p, w.claimUntil - now, timestamp));
        return;
    }
    ctx.save(); ctx.translate(w.x, w.y);
    const charging = w.phase === 'charging';
    ctx.strokeStyle = charging ? '#ffd47d' : '#80e7de'; ctx.lineWidth = 2;
    ctx.fillStyle = 'rgba(22, 41, 58, 0.95)'; ctx.beginPath(); ctx.arc(0, 0, 43, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    // A visible barrel and faint aim ray show the next shot before it fires.
    ctx.save(); ctx.rotate(w.angle);
    ctx.strokeStyle = 'rgba(255, 212, 125, 0.23)'; ctx.setLineDash([9, 12]); ctx.beginPath(); ctx.moveTo(54, 0); ctx.lineTo(210, 0); ctx.stroke(); ctx.setLineDash([]);
    partIcon(ctx, 2, 31, 0, 0); ctx.restore();
    ctx.save(); ctx.scale(1.3, 1.3); partIcon(ctx, 1, 0, 0, charging ? timestamp / 160 : w.angle * 2); partIcon(ctx, 0, 0, 0, w.angle); ctx.restore();
    ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe4aa';
    ctx.fillText(charging ? 'SPINNING UP…' : 'PINWHEEL CANNON', 0, -58);
    const owner = state.players.get(w.owner);
    ctx.font = `600 11px ${FONT}`; ctx.fillStyle = '#dbe9ee';
    ctx.fillText(`${owner?.name || 'Builder'} · ${Math.max(0, Math.ceil((w.at - now) / 1000))}s`, 0, 64);
    ctx.restore();
    w.bolts.forEach(bolt => {
        ctx.save(); ctx.translate(bolt.x, bolt.y); ctx.rotate(bolt.angle);
        ctx.strokeStyle = 'rgba(255, 212, 125, 0.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-8, 0); ctx.stroke();
        ctx.fillStyle = '#ffe6a3'; ctx.strokeStyle = '#fff7df'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(0, -7); ctx.lineTo(-8, 0); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    });
}

export function drawPinwheelHud(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, timestamp: number): void {
    const w = state.pinwheel;
    if (!w || w.phase === 'waiting') return;
    const local = mode.multiplayerManager?.getLocalPlayer();
    if (local?.capturedBy || local?.gulping || local?.state !== 'alive') return;
    const u = COMPACT.matches ? mode.cssScale : 1;
    const width = Math.min(canvas.width - 24 * u, 350 * u), height = 51 * u;
    const x = (canvas.width - width) / 2, y = canvas.height - (COMPACT.matches ? 142 : 104) * u;
    const now = mode.worldNow(state, timestamp), owner = state.players.get(w.owner);
    const count = [1, 2, 4].filter(bit => (w.progress & bit) !== 0).length;
    ctx.save(); hudPanel(ctx, x, y, width, height, 12 * u);
    const me = mode.multiplayerManager?.getLocalPlayer();
    if (me) {
        ctx.save(); ctx.translate(x + 16 * u, y + 17 * u);
        ctx.rotate(Math.atan2(w.y - me.y - me.height / 2, w.x - me.x - me.width / 2));
        ctx.fillStyle = '#ffa8be'; ctx.beginPath(); ctx.moveTo(6 * u, 0); ctx.lineTo(-4 * u, -4 * u); ctx.lineTo(-2 * u, 0); ctx.lineTo(-4 * u, 4 * u); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffe4aa'; ctx.font = `800 ${12 * u}px ${FONT}`;
    ctx.fillText(w.phase === 'parts' ? `PINWHEEL · ${count}/3 PARTS` : w.phase === 'charging' ? 'PINWHEEL SPINNING UP' : 'PINWHEEL FIRING — DODGE THE BOLTS', canvas.width / 2, y + 19 * u);
    ctx.fillStyle = '#d1e3ec'; ctx.font = `600 ${10 * u}px ${FONT}`;
    const label = w.phase === 'parts' ? owner ? `${owner.name}'s build · ${Math.max(0, Math.ceil((w.claimUntil - now) / 1000))}s claim` : 'Inhale the hub, rotor and barrel together' : `${owner?.name || 'Builder'} · ${Math.max(0, Math.ceil((w.at - now) / 1000))}s`;
    ctx.fillText(label, canvas.width / 2, y + 37 * u, width - 16 * u); ctx.restore();
}
