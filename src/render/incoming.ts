import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedPlayer } from '../types/synced';
import { firstImpact, type IncomingShot } from '../../server/game/incomingShot';
import { inView } from './shared';
import { COMPACT } from './style';
import { weaponShots } from '../../server/game/weaponShots';
import { allWeapons } from '../../server/game/weaponKit';
import { WEAPON_SHOTS } from '../../server/constants/gameConstants';

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
      vx: p.flightVx, vy: p.flightVy, radius: p.width / 2, visible: inView(view, drawn.x, drawn.y, p.width / 2), remaining: Math.min(.5, p.flightRemainingMs / 1000 - lead) });
  });
  if (!me.spawnProtected) shots.push(...weaponShots(allWeapons(state), state.time, id ?? '', lead, (x, y, r) => inView(view, x, y, r)).map(shot => ({
    ...shot, arming: Math.max(shot.arming ?? 0, (me.weaponSafeUntil - state.time) / 1000 - lead),
  })));
  const cx = me.x + me.width / 2 + me.movementVx * lead, cy = me.y + me.height / 2 + me.movementVy * lead;
  const hit = firstImpact({ x: cx, y: cy, vx: me.movementVx, vy: me.movementVy, radius: me.width / 2 }, shots, WEAPON_SHOTS.WARNING_S);
  if (!hit) { hints.delete(mode); return; }
  const angle = Math.atan2(hit.y - cy, hit.x - cx), u = mode.cssScale, inset = 18 * u;
  const left = mode.hudInsets.left + inset, right = canvas.width - mode.hudInsets.right - inset;
  const top = Math.max(mode.hudInsets.top + inset, mode.chromeBottom + inset), bottom = canvas.height - mode.hudInsets.bottom - inset;
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
  x = Math.max(left, Math.min(right, x)); y = Math.max(top, Math.min(bottom, y));
  // Resolve clearance after smoothing, including when chrome or a held joystick moves.
  if (!COMPACT.matches && !mode.controls?.touchDevice && y > canvas.height - 180 * u && x > canvas.width - 180 * u) x = canvas.width - 200 * u;
  const canvasBox = canvas.getBoundingClientRect();
  for (const bounds of mode.controls?.touchBounds() ?? []) {
    const bx = (bounds.left - canvasBox.left) * u, by = (bounds.top - canvasBox.top) * u;
    const br = (bounds.right - canvasBox.left) * u, bb = (bounds.bottom - canvasBox.top) * u;
    if (x >= bx - inset && x <= br + inset && y >= by - inset && y <= bb + inset) y = Math.max(top, by - inset);
  }
  hints.set(mode, { id: hit.id, x, y, angle: a, at: timestamp });
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(u, u);
  if (hit.id.startsWith('weapon:')) ctx.scale(1.35, 1.35);
  ctx.fillStyle = hit.id.startsWith('weapon:') ? '#ff896f' : '#ffd47d'; ctx.strokeStyle = '#07131f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}
