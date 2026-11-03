import { drawMinimap } from '../../src/render/hud';
import { drawWeapons } from '../../src/render/weapons';
import { WEAPON_OWNERSHIP, drawOwnership } from '../../src/render/weaponOwnership';
import { orbitalPosition } from '../../server/game/weaponKit';
import { pulsarRadius } from '../../server/game/pulsar';
import { WEAPON_SHOTS, WEAPON_FLEET } from '../../server/constants/gameConstants';

/** Isolated render controls use the actual production drawing functions. Never included in the app bundle. */
export function render(canvas: HTMLCanvasElement, kind: string, own: boolean, bright: boolean, armed = true, zoom = 1, localId: string | null = 'me'): { mark: { x: number; y: number; r: number }; attack: { x: number; y: number }; color: string } {
    const ctx = canvas.getContext('2d')!; canvas.width = 520; canvas.height = 240;
    ctx.fillStyle = bright ? '#ffffff' : '#0a192f'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const now = 10000, x = 2100, y = 2100;
    const w = { kind, owner: own ? 'me' : 'other', phase: 'active', x, y, angle: 0, at: now + 10000, progress: 7,
        originX: x, originY: y, activatedAt: now - (kind === 'ion' ? WEAPON_FLEET.ION_WARNING_MS + 100 : 0),
        nextShotAt: now + 100, beatAt: now + 500, pulseAt: kind === 'pulsar' ? now - 350 : 0, pulseX: x, pulseY: y, pulseFacing: 0,
        claimedAt: now - 5000, claimUntil: now + 1000, parts: [], bolts: new Map(),
    };
    if (!['ion', 'pulsar'].includes(kind)) w.bolts.set('bolt', { x: x + 200, y, angle: 0, bornAt: now - (armed ? WEAPON_SHOTS.ARM_MS + 100 : 100), traveled: 200 });
    // Pin orbital presentation to its current, synchronized origin while retaining real beam/bolt renderers.
    const state = { pinwheel: w, weaponSets: [], players: new Map(), worldWidth: 4200, worldHeight: 4200 };
    const mode = { cssScale: 1, worldNow: () => now, trafficLead: () => 0, multiplayerManager: { localSessionId: localId }, renderView: { x: 0, y: 0, width: 10000, height: 10000 }, localFacing: 0 };
    if (['sentinel','ricochet','ion'].includes(kind)) {
        // Pick the broad orbit's instantaneous point as the controlled visible position.
        w.originX = 2100 + 1470; w.originY = 2100; w.x = w.originX; w.y = w.originY;
        if (kind !== 'ion') { w.activatedAt = now; w.bolts.forEach(b => { b.x += w.x - x; b.y += w.y - y; }); }
    }
    const position = profileOrbit(kind) ? orbitalPosition(w.originX, w.originY, now - w.activatedAt, 4200, 4200, kind) : w;
    const drawX = position.x, drawY = position.y;
    const offsetX = 90 - drawX * zoom, offsetY = 110 - drawY * zoom;
    ctx.setTransform(zoom, 0, 0, zoom, offsetX, offsetY);
    drawWeapons(mode as never, ctx, state as never, now);
    const attack = kind === 'pulsar' ? { x: 90 + pulsarRadius(350) * zoom, y: 110 }
        : { x: kind === 'ion' ? 90 + 180 * zoom : 90 + (200) * zoom, y: 110 };
    return { mark: { x: 90, y: 110, r: Math.max(48 * zoom, 15) }, attack, color: own && localId === 'me' ? WEAPON_OWNERSHIP.mint : WEAPON_OWNERSHIP.hostile };
}
export function mark(canvas: HTMLCanvasElement, bright = true, reveal: number | null = null): void {
    const c = canvas.getContext('2d')!; canvas.width = 100; canvas.height = 100;
    c.fillStyle = bright ? '#fff' : '#0a192f'; c.fillRect(0, 0, 100, 100); c.translate(50, 50); drawOwnership(c, 1, reveal, matchMedia('(prefers-reduced-motion: reduce)').matches);
}

function profileOrbit(kind: string): boolean { return ['sentinel', 'ricochet', 'ion'].includes(kind); }

export function minimap(canvas: HTMLCanvasElement, kind: string, own: boolean, localId: string | null = 'me', unit = 1): void {
    canvas.width = 240 * unit; canvas.height = 240 * unit; canvas.style.width = '240px'; canvas.style.height = '240px';
    const ctx = canvas.getContext('2d')!;
    const mode = {cssScale:unit,hudInsets:{top:0,right:0,bottom:0,left:0},controls:{touchDevice:false},chromeBottom:0};
    const state = {worldWidth:4200,worldHeight:4200,players:new Map(),pinwheel:{kind,phase:'active',owner:own?'me':'other',x:2100,y:2100},weaponSets:[]};
    drawMinimap(mode as never,ctx,canvas,state as never,{x:2100,y:2100,width:1000,height:1000,scale:1},localId,null);
}
