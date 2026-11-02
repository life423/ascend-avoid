import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedGameState, SyncedPlayer } from '../types/synced';
import { firstImpact, playerMissileShot, PLAYER_SHOT_WARNING_S, type IncomingShot } from '../../server/game/incomingShot';
import { inView } from './shared';
import { COMPACT } from './style';
import { weaponShots } from '../../server/game/weaponShots';
import { allWeapons } from '../../server/game/weaponKit';
import { WEAPON_SHOTS } from '../../server/constants/gameConstants';

const hints = new WeakMap<MultiplayerMode, { id: string; x: number; y: number; angle: number; at: number; enteredAt?: number }>();
export function drawIncoming(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, state: SyncedGameState, me: SyncedPlayer | undefined, timestamp: number): void {
  const view = mode.renderView;
  if (!view || !me || me.state !== 'alive' || me.capturedBy || me.flying) { hints.delete(mode); return; }
  const lead = mode.trafficLead(timestamp), shots: IncomingShot[] = [];
  const id = mode.multiplayerManager?.localSessionId;
  state.players.forEach((p, key) => {
    const drawn = mode.centerOf(key, p);
    const shot = playerMissileShot(p, key, id ?? '', lead, inView(view, drawn.x, drawn.y, p.width / 2));
    if (shot && !me.spawnProtected) shots.push(shot);
  });
  const weapons = !me.spawnProtected ? weaponShots(allWeapons(state), state.time, id ?? '', lead, (x, y, r) => inView(view, x, y, r)).map(shot => ({
    ...shot, arming: Math.max(shot.arming ?? 0, (me.weaponSafeUntil - state.time) / 1000 - lead),
  })) : [];
  const cx = me.x + me.width / 2 + me.movementVx * lead, cy = me.y + me.height / 2 + me.movementVy * lead;
  const target = { x: cx, y: cy, vx: me.movementVx, vy: me.movementVy, radius: me.width / 2 };
  const playerHit = firstImpact(target, shots, PLAYER_SHOT_WARNING_S, true), weaponHit = firstImpact(target, weapons, WEAPON_SHOTS.WARNING_S);
  const hit = playerHit && (!weaponHit || playerHit.seconds <= weaponHit.seconds) ? playerHit : weaponHit;
  if (!hit) { hints.delete(mode); return; }
  const angle = Math.atan2(hit.y - cy, hit.x - cx), u = mode.cssScale, inset = 18 * u;
  const old = hints.get(mode);
  let enteredAt: number | undefined;
  if (hit.id.startsWith('player:')) {
    const key = hit.id.slice(7), p = state.players.get(key);
    if (!p) { hints.delete(mode); return; }
    const drawn = mode.centerOf(key, p), r = p.width / 2, margin = 24 * u / view.scale;
    const sx = canvas.width / 2 + (drawn.x - view.x) * view.scale, sy = canvas.height / 2 + (drawn.y - view.y) * view.scale;
    const covered = coveredByControls(mode, canvas, sx, sy, r * view.scale + 12 * u);
    if (inView(view, drawn.x, drawn.y, r) && !covered) drawPlayerThreat(ctx, sx, sy, r * view.scale, Math.atan2(p.flightVy, p.flightVx), hit.seconds, u);
    const entered = !covered && drawn.x - r - margin >= view.x - view.width / 2 && drawn.x + r + margin <= view.x + view.width / 2
      && drawn.y - r - margin >= view.y - view.height / 2 && drawn.y + r + margin <= view.y + view.height / 2;
    if (entered) {
      enteredAt = old?.id === hit.id ? old.enteredAt ?? timestamp : timestamp;
      if (old?.id !== hit.id || timestamp - enteredAt >= 180) { hints.delete(mode); return; }
    }
  }
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
  const blend = old?.id === hit.id ? 1 - Math.exp(-22 * Math.max(0, timestamp - old.at) / 1000) : 1;
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
  hints.set(mode, { id: hit.id, x, y, angle: a, at: timestamp, enteredAt });
  ctx.save(); ctx.translate(x, y); ctx.rotate(a); ctx.scale(u, u);
  if (enteredAt !== undefined) ctx.globalAlpha *= Math.max(0, 1 - (timestamp - enteredAt) / 180);
  if (hit.id.startsWith('player:')) {
    // A compact, directional wind-comet cue: shape and outline carry meaning without flashing or text.
    ctx.strokeStyle = '#07131f'; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(-6, 0, 17, -.9, .9); ctx.stroke();
    ctx.strokeStyle = '#ffd47d'; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = '#ffd47d'; ctx.strokeStyle = '#07131f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(1, -7); ctx.lineTo(3, 0); ctx.lineTo(1, 7); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore(); return;
  }
  if (hit.id.startsWith('weapon:')) ctx.scale(1.35, 1.35);
  ctx.fillStyle = hit.id.startsWith('weapon:') ? '#ff896f' : '#ffd47d'; ctx.strokeStyle = '#07131f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-5, -6); ctx.lineTo(-2, 0); ctx.lineTo(-5, 6); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawPlayerThreat(ctx: CanvasRenderingContext2D, x: number, y: number, bodyRadius: number, angle: number, seconds: number, u: number): void {
  const radius = Math.max(12, bodyRadius / u + 6);
  const urgency = Math.max(0, Math.min(1, 1 - seconds / PLAYER_SHOT_WARNING_S));
  ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(u, u);
  // Outside the shell: leave the creature's face and eyes readable. The short wake is not a firing lane.
  ctx.strokeStyle = '#07131f'; ctx.lineWidth = 6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(0, 0, radius, -2.5, 2.5); ctx.stroke();
  ctx.strokeStyle = '#ffd47d'; ctx.lineWidth = 3; ctx.globalAlpha *= .7 + .3 * urgency; ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-radius - 4, 0); ctx.lineTo(-radius - 28 - urgency * 14, 0);
  ctx.moveTo(-radius - 9, -5); ctx.lineTo(-radius - 23, -5);
  ctx.moveTo(-radius - 9, 5); ctx.lineTo(-radius - 23, 5); ctx.stroke(); ctx.restore();
}

function coveredByControls(mode: MultiplayerMode, canvas: HTMLCanvasElement, x: number, y: number, r: number): boolean {
  const u = mode.cssScale, top = mode.hudInsets.top;
  if (y - r < mode.chromeBottom || COMPACT.matches && (x - r < mode.hudInsets.left + 144 * u && y - r < top + 156 * u
    || x + r > canvas.width - mode.hudInsets.right - 154 * u && y - r < mode.minimapBottom + 16 * u)) return true;
  const box = canvas.getBoundingClientRect();
  return (mode.controls?.touchBounds() ?? []).some(b => x + r >= (b.left - box.left) * u && x - r <= (b.right - box.left) * u
    && y + r >= (b.top - box.top) * u && y - r <= (b.bottom - box.top) * u);
}
