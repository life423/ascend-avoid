import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedWeaponPart } from '../types/synced';
import { PINWHEEL } from '../../server/constants/gameConstants';
import { FONT, COMPACT, hudPanel, roundedRect } from './style';
import { PART_COLORS, weaponRecipe, weaponChipBounds } from './weaponStyle';
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
    // Phones already have a status chip/placement button; keep floating text off nearby faces.
    if (!COMPACT.matches) {
        ctx.font = `800 12px ${FONT}`; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe4aa';
        ctx.fillText(carried ? 'READY TO PLACE' : charging ? w.kind === 'pulsar' ? 'CHARGING…' : 'SPINNING UP…' : weaponRecipe(w.kind).title, 0, -58);
        const owner = state.players.get(w.owner);
        ctx.font = `600 11px ${FONT}`; ctx.fillStyle = '#dbe9ee';
        ctx.fillText(carried ? `${owner?.name || 'Builder'} · carried` : `${owner?.name || 'Builder'} · ${Math.max(0, Math.ceil((w.at - now) / 1000))}s`, 0, 64);
    }
    ctx.restore();
    w.bolts.forEach(bolt => {
        ctx.save(); ctx.translate(bolt.x, bolt.y); ctx.rotate(bolt.angle);
        ctx.strokeStyle = 'rgba(255, 212, 125, 0.45)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(-26, 0); ctx.lineTo(-8, 0); ctx.stroke();
        ctx.fillStyle = '#ffe6a3'; ctx.strokeStyle = '#fff7df'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(0, -7); ctx.lineTo(-8, 0); ctx.lineTo(0, 7); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.restore();
    });
}

export function drawWeaponHud(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, timestamp: number): void {
    const w = state.pinwheel;
    if (!w || w.phase === 'waiting') return;
    const local = mode.multiplayerManager?.getLocalPlayer();
    if (local?.capturedBy || local?.gulping || local?.state !== 'alive') return;
    if (COMPACT.matches && w.phase === 'carried' && w.owner === local.sessionId) return;
    const u = COMPACT.matches ? mode.cssScale : 1;
    const recipe = weaponRecipe(w.kind);
    const count = [1, 2, 4].filter(bit => (w.progress & bit) !== 0).length;
    if (COMPACT.matches) {
        const chip = weaponChipBounds(canvas.width, canvas.height, u);
        ctx.save(); hudPanel(ctx, chip.x, chip.y, chip.width, chip.height, 18 * u);
        ctx.textAlign = 'left'; ctx.fillStyle = '#ffe4aa'; ctx.font = `700 ${11 * u}px ${FONT}`;
        const status = w.phase === 'parts' ? recipe.name : w.phase === 'carried' ? 'Weapon carried' : w.kind === 'pulsar' ? 'Pulsar · dodge waves' : 'Pinwheel · dodge bolts';
        ctx.fillText(status, chip.x + 13 * u, chip.y + 22 * u, chip.width - (w.phase === 'parts' ? 110 : 26) * u);
        if (w.phase === 'parts') {
            for (let i = 0; i < 3; i++) {
                const owned = Boolean(w.progress & (1 << i));
                ctx.fillStyle = owned ? COLORS[i] : 'rgba(255,255,255,.12)'; ctx.strokeStyle = owned ? COLORS[i] : 'rgba(255,255,255,.35)';
                ctx.lineWidth = u; ctx.beginPath(); ctx.arc(chip.x + chip.width - (82 - i * 17) * u, chip.y + 18 * u, 5 * u, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            }
            ctx.font = `700 ${10 * u}px ${FONT}`; ctx.textAlign = 'right'; ctx.fillStyle = '#d1e3ec';
            ctx.fillText(`${count}/3`, chip.x + chip.width - 10 * u, chip.y + 22 * u);
        }
        ctx.restore(); return;
    }
    const width = Math.min(canvas.width - 24 * u, 350 * u), height = (w.phase === 'parts' ? 65 : 51) * u;
    const landscape = COMPACT.matches && canvas.height / u < 500;
    const x = (canvas.width - width) / 2, y = landscape ? 70 * u : canvas.height - (COMPACT.matches ? (w.phase === 'parts' ? 256 : 238) : 104) * u;
    const now = mode.worldNow(state, timestamp), owner = state.players.get(w.owner);
    ctx.save(); hudPanel(ctx, x, y, width, height, 12 * u);
    const me = mode.multiplayerManager?.getLocalPlayer();
    let target = { x: w.x, y: w.y };
    if (w.phase === 'parts' && me) {
        let nearest = Infinity;
        w.parts.forEach(p => {
            if (p.carriedBy === me.sessionId) return;
            const d = Math.hypot(p.x - me.x - me.width / 2, p.y - me.y - me.height / 2);
            if (d < nearest) { nearest = d; target = p; }
        });
    }
    if (me) {
        ctx.save(); ctx.translate(x + 16 * u, y + 17 * u);
        ctx.rotate(Math.atan2(target.y - me.y - me.height / 2, target.x - me.x - me.width / 2));
        ctx.fillStyle = '#ffa8be'; ctx.beginPath(); ctx.moveTo(6 * u, 0); ctx.lineTo(-4 * u, -4 * u); ctx.lineTo(-2 * u, 0); ctx.lineTo(-4 * u, 4 * u); ctx.closePath(); ctx.fill(); ctx.restore();
    }
    ctx.textAlign = 'center'; ctx.fillStyle = '#ffe4aa'; ctx.font = `800 ${12 * u}px ${FONT}`;
    ctx.fillText(w.phase === 'parts' ? `${recipe.title} · ${count}/3 PARTS` : w.phase === 'carried' ? `${recipe.title} READY TO PLACE` : w.phase === 'charging' ? `${recipe.title} CHARGING` : w.kind === 'pulsar' ? 'SHOCKWAVE — WATCH THE RINGS' : 'PINWHEEL FIRING — DODGE THE BOLTS', canvas.width / 2, y + 19 * u);
    ctx.fillStyle = '#d1e3ec'; ctx.font = `600 ${10 * u}px ${FONT}`;
    const label = w.phase === 'parts' ? owner ? `${owner.name}'s build · ${Math.max(0, Math.ceil((w.claimUntil - now) / 1000))}s claim` : 'Touch or inhale the three parts' : w.phase === 'carried' ? w.owner === local.sessionId ? 'Move to your spot, then place it' : `${owner?.name || 'Builder'} is carrying it` : `${owner?.name || 'Builder'} · ${Math.max(0, Math.ceil((w.at - now) / 1000))}s`;
    ctx.fillText(label, canvas.width / 2, y + 37 * u, width - 16 * u); ctx.restore();
    if (w.phase === 'parts') {
        ctx.save(); ctx.textAlign = 'center'; ctx.font = `700 ${9 * u}px ${FONT}`;
        for (let i = 0; i < 3; i++) {
            ctx.fillStyle = COLORS[i]; ctx.fillText(`${recipe.letters[i]} · ${recipe.parts[i]}`, x + width * (i + 0.5) / 3, y + 54 * u);
        }
        ctx.restore();
    }
}
