import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedPlayer } from '../types/synced';
import { firstImpact, type IncomingShot } from '../../server/game/incomingShot';
import { inView } from './shared';
import { COMPACT } from './style';

const hints = new WeakMap<MultiplayerMode, { id: string; x: number; y: number; angle: number; at: number }>();
export function drawIncoming(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, me: SyncedPlayer | undefined, timestamp: number): void {
  const view = mode.renderView;
  if (!view || !me || me.state !== 'alive' || me.capturedBy || me.flying) { hints.delete(mode); return; }
  const lead = mode.trafficLead(timestamp), shots: IncomingShot[] = [];
  const id = mode.multiplayerManager?.localSessionId;
  state.players.forEach((p, key) => {
    if (key === id || p.state !== 'alive' || !p.flying || p.flightKind !== 'missile') return;
    const drawn = mode.centerOf(key, p);
    shots.push({ id: key, x: p.x + p.width / 2 + p.flightVx * lead, y: p.y + p.height / 2 + p.flightVy * lead,
      vx: p.flightVx, vy: p.flightVy, radius: p.width / 2, visible: inView(view, drawn.x, drawn.y, p.width / 2), remaining: p.flightRemainingMs / 1000 - lead });
  });
  const cx = me.x + me.width / 2 + me.movementVx * lead, cy = me.y + me.height / 2 + me.movementVy * lead;
  const hit = firstImpact({ x: cx, y: cy, vx: me.movementVx, vy: me.movementVy, radius: me.width / 2 }, shots);
  if (!hit) { hints.delete(mode); return; }
  const angle = Math.atan2(hit.y - cy, hit.x - cx), u = mode.cssScale, inset = 18 * u;
  const left = mode.hudInsets.left + inset, right = canvas.width - mode.hudInsets.right - inset;
  const top = mode.hudInsets.top + inset, bottom = canvas.height - mode.hudInsets.bottom - inset;
  const ox = Math.max(left, Math.min(right, canvas.width / 2 + (cx - view.x) * view.scale));
  const oy = Math.max(top, Math.min(bottom, canvas.height / 2 + (cy - view.y) * view.scale));
  const dx = Math.cos(angle), dy = Math.sin(angle);
  const tx = dx > .0001 ? (right - ox) / dx : dx < -.0001 ? (left - ox) / dx : Infinity;
  const ty = dy > .0001 ? (bottom - oy) / dy : dy < -.0001 ? (top - oy) / dy : Infinity;
  const distance = Math.min(tx, ty);
  let x = ox + dx * distance, y = oy + dy * distance;
  if (COMPACT.matches) {
    if (y <= top + 1) x = Math.max(left + 142 * u, Math.min(canvas.width - mode.hudInsets.right - 150 * u, x));
    if (x >= right - 1 && y < mode.minimapBottom + 16 * u) y = mode.minimapBottom + 16 * u;
    if (x <= left + 1 && y < top + 150 * u) y = top + 150 * u;
  }
  const old = hints.get(mode), blend = old?.id === hit.id ? 1 - Math.exp(-22 * Math.max(0, timestamp - old.at) / 1000) : 1;
  const a = old && old.id === hit.id ? old.angle + Math.atan2(Math.sin(angle - old.angle), Math.cos(angle - old.angle)) * blend : angle;
  if (old?.id === hit.id) { x = old.x + (x - old.x) * blend; y = old.y + (y - old.y) * blend; }
  hints.set(mode, { id: hit.id, x, y, angle: a, at: timestamp });
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(u, u);
  ctx.fillStyle = '#ffd47d'; ctx.strokeStyle = '#07131f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
