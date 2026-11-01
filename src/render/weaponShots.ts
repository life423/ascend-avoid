import type { MultiplayerMode } from '../core/GameModes';
import type { SyncedPinwheel } from '../types/synced';
import { WEAPON_SHOTS } from '../../server/constants/gameConstants';
import { weaponProfile } from '../../server/game/weaponKit';
import { inView } from './shared';
import { roundedRect } from './style';

/** Long, directional capsules and tracers, never collectible diamond silhouettes or loot halos. */
export function drawWeaponBolts(mode: MultiplayerMode, ctx: CanvasRenderingContext2D, w: SyncedPinwheel, time: number, timestamp: number): void {
  const profile = weaponProfile(w.kind), lead = mode.trafficLead(timestamp);
  const unit = mode.cssScale / Math.max(.001, Math.abs(ctx.getTransform().a));
  const own = w.owner === mode.multiplayerManager?.localSessionId;
  w.bolts.forEach(bolt => {
    const x = bolt.x + Math.cos(bolt.angle) * profile.speed * lead, y = bolt.y + Math.sin(bolt.angle) * profile.speed * lead;
    if (!inView(mode.renderView, x, y, 65 * unit)) return;
    const armed = time - bolt.bornAt >= WEAPON_SHOTS.ARM_MS;
    const color = own ? '#91d8f5' : '#ff896f';
    const radius = Math.max(profile.radius * .5, 2.5 * unit), length = Math.max(24, 11 * unit);
    ctx.save(); ctx.translate(x, y); ctx.rotate(bolt.angle); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // A dark edge separates the tracer from bright loot and the star field.
    ctx.beginPath(); ctx.moveTo(-length * 1.7, 0); ctx.lineTo(-length * .35, 0);
    ctx.strokeStyle = '#07131f'; ctx.lineWidth = 6 * unit; ctx.stroke();
    ctx.strokeStyle = armed ? color : '#82a5b7'; ctx.lineWidth = (armed ? 2.5 : 1.2) * unit; ctx.stroke();
    roundedRect(ctx, -length / 2, -radius, length, radius * 2, radius);
    ctx.fillStyle = armed ? color : '#102332'; ctx.fill();
    ctx.strokeStyle = armed ? '#fff3e9' : '#a7c6d6'; ctx.lineWidth = 1.4 * unit; ctx.stroke();
    if (armed) {
      ctx.strokeStyle = '#fff7ef'; ctx.lineWidth = 1.4 * unit;
      ctx.beginPath(); ctx.moveTo(-length * .2, 0); ctx.lineTo(length * .25, 0); ctx.stroke();
    }
    // Fletching makes travel direction readable in shape as well as color.
    ctx.strokeStyle = armed ? color : '#a7c6d6'; ctx.lineWidth = 1.5 * unit;
    ctx.beginPath(); ctx.moveTo(-length * .8, -radius * 1.6); ctx.lineTo(-length * .55, 0); ctx.lineTo(-length * .8, radius * 1.6); ctx.stroke();
    ctx.restore();
  });
}
