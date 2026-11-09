import { SHOCKWAVE, WEAPON_FLEET, WEAPON_SHOTS } from '../../../server/constants/gameConstants';
import { pulsarRadius } from '../../../server/game/pulsar';
import { orbitalPosition } from '../../../server/game/weaponKit';
import { ANDROID_FIREFOX_RENDERING } from '../../../src/render/browserRendering';
import { drawPlayer } from '../../../src/render/players';
import { SMOOTHING } from '../../../src/render/shared';
import { drawWeapons } from '../../../src/render/weapons';

type Attack = 'bolt' | 'ion warning' | 'ion firing' | 'pulsar';

export function renderWeapon(attack: Attack, launcherOnscreen: boolean) {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    const now = 10_000;
    const worldWidth = 4200;
    const worldHeight = 4200;
    const ion = attack.startsWith('ion');
    const kind = ion ? 'ion' : attack === 'pulsar' ? 'pulsar' : 'pinwheel';
    const age = attack === 'ion warning' ? 300 : WEAPON_FLEET.ION_WARNING_MS + 100;
    const originX = ion ? 3570 : 2100;
    const originY = 2100;
    const source = ion ? orbitalPosition(originX, originY, age, worldWidth, worldHeight, kind) : { x: originX, y: originY };
    const pulseAge = SHOCKWAVE.WAVE_MS * 0.6;
    const attackDistance = attack === 'pulsar' ? pulsarRadius(pulseAge) : 230;
    const bolts = new Map();
    if (attack === 'bolt') {
        bolts.set('bolt', { x: source.x + attackDistance, y: source.y, angle: 0, bornAt: now - WEAPON_SHOTS.ARM_MS - 100 });
    }
    const weapon = {
        kind, owner: 'rival', phase: 'active', x: source.x, y: source.y, angle: 0,
        originX, originY, activatedAt: now - age, nextShotAt: now + 500,
        beatAt: now + 500, pulseAt: attack === 'pulsar' ? now - pulseAge : 0,
        pulseX: source.x, pulseY: source.y, pulseFacing: 0, parts: [], bolts,
    };
    const left = source.x + (launcherOnscreen ? -100 : 140);
    const top = source.y - 90.5;
    const mode = {
        cssScale: 1, worldNow: () => now, trafficLead: () => 0,
        multiplayerManager: { localSessionId: 'me' },
        renderView: { x: left + 100, y: top + 90, width: 200, height: 180, scale: 1 },
    };
    const state = { worldWidth, worldHeight, players: new Map(), pinwheel: weapon, weaponSets: [] };
    let chassisDraws = 0;
    const arc = ctx.arc.bind(ctx);
    ctx.arc = (...args: Parameters<CanvasRenderingContext2D['arc']>) => {
        if (args[0] === 0 && args[1] === 0 && args[2] === 43) chassisDraws++;
        arc(...args);
    };
    ctx.setTransform(1, 0, 0, 1, -left, -top);
    drawWeapons(mode as never, ctx, state as never, now);

    const attackX = source.x + attackDistance - left;
    let attackPixels = 0;
    if (!launcherOnscreen) {
        const pixels = ctx.getImageData(Math.floor(attackX) - 24, 80, 49, 21).data;
        for (let i = 0; i < pixels.length; i += 4) {
            const [r, g, b, a] = pixels.subarray(i, i + 4);
            // Hostile orange remains identifiable through anti-aliasing and the beam glow.
            if (r > 210 && g >= 110 && g <= 180 && b >= 80 && b <= 150 && a > 100) attackPixels++;
        }
    }
    return { androidFirefox: ANDROID_FIREFOX_RENDERING, chassisDraws, attackPixels };
}

export function renderMovingRival() {
    const canvas = document.createElement('canvas');
    canvas.width = 200;
    canvas.height = 180;
    const ctx = canvas.getContext('2d')!;
    const id = 'rival';
    const startX = 650;
    const player = { state: 'alive', playerIndex: 1, name: 'Rival', width: 20, height: 20, x: 700, y: 90 };
    const mode = {
        drawnPositions: new Map([[id, { x: startX, y: player.y }]]), drawnSizes: new Map(),
        contactShapes: new Map(), captures: new Map(), emerges: new Map(), gemPops: new Map(), flows: new Map(), puffs: [],
        renderView: { x: 100, y: 90, width: 200, height: 180, scale: 1 },
    };
    let paths = 0;
    const beginPath = ctx.beginPath.bind(ctx);
    ctx.beginPath = () => { paths++; beginPath(); };
    const frame = (timestamp: number) => {
        paths = 0;
        drawPlayer(mode as never, ctx, player as never, id, false, false, timestamp);
        return { x: mode.drawnPositions.get(id)?.x, paths };
    };

    const first = frame(1_000);
    const expectedFirst = startX + (player.x - startX) * SMOOTHING;
    player.x = 720;
    const second = frame(1_017);
    const expectedSecond = expectedFirst + (player.x - expectedFirst) * SMOOTHING;
    mode.renderView.x = 720;
    ctx.setTransform(1, 0, 0, 1, 100 - mode.renderView.x, 0);
    const visible = frame(1_034);
    const expectedVisible = expectedSecond + (player.x - expectedSecond) * SMOOTHING;

    return { first, second, visible, expectedFirst, expectedSecond, expectedVisible };
}
