// Run against the signed Firefox app on the CI Android emulator via geckodriver.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const driver = 'http://127.0.0.1:4444';
const arena = 'http://127.0.0.1:3002/';

async function command(path, method, body, timeout = 10000) {
    const response = await fetch(`${driver}${path}`, {
        method,
        ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(timeout),
    });
    const { value } = await response.json();
    assert(response.ok && !value?.error, `${method} ${path}: ${value?.message ?? response.status}`);
    return value;
}

const session = await command('/session', 'POST', {
    capabilities: {
        alwaysMatch: {
            browserName: 'firefox',
            'moz:firefoxOptions': {
                androidPackage: 'org.mozilla.firefox',
                androidDeviceSerial: process.env.ANDROID_SERIAL || 'emulator-5554',
                // Mozilla's onboarding bypass for automation on an ADB-enabled device.
                androidIntentArguments: ['-a', 'android.intent.action.VIEW', '-d', 'about:blank', '--ez', 'automationtest', 'true'],
            },
        },
    },
}, 90000);
assert(session.sessionId, 'geckodriver created an Android Firefox session');
const sessionPath = `/session/${session.sessionId}`;
const execute = (fn) => command(`${sessionPath}/execute/sync`, 'POST', { script: `return (${fn})();`, args: [] });

function sampleArena() {
    const game = window.game;
    const mode = game?.currentGameMode;
    const manager = mode?.multiplayerManager;
    const state = manager?.getState();
    const player = manager?.getLocalPlayer();
    const canvas = game?.canvas;
    const play = document.querySelector('.join-dialog[open] .join-play');
    return {
        userAgent: navigator.userAgent,
        touchPoints: navigator.maxTouchPoints,
        attributes: game?.ctx?.getContextAttributes?.() ?? null,
        rendered: !!mode?.renderView && canvas?.width > 0 && canvas?.height > 0,
        room: manager?.getRoom()?.id ?? null,
        time: state?.time ?? 0,
        hasBots: [...(state?.players?.values() ?? [])].some(p => p.isBot),
        play: play?.getBoundingClientRect().toJSON() ?? null,
        controls: mode?.controls?.touchBounds() ?? [],
        width: state?.worldWidth ?? 0,
        player: player ? { x: player.x, alive: player.state === 'alive', inhaling: player.inhaling } : null,
    };
}

async function observe(description, matches) {
    const deadline = Date.now() + 15000;
    let latest;
    do {
        latest = await execute(sampleArena);
        if (matches(latest)) return latest;
        await delay(100);
    } while (Date.now() < deadline);
    assert.fail(`${description}: ${JSON.stringify(latest)}`);
}

const touch = (actions) => command(`${sessionPath}/actions`, 'POST', {
    actions: [{ type: 'pointer', id: 'finger', parameters: { pointerType: 'touch' }, actions }],
});
const middle = (bounds) => ({ x: Math.round((bounds.left + bounds.right) / 2), y: Math.round((bounds.top + bounds.bottom) / 2) });
const move = (point, duration = 0) => ({ type: 'pointerMove', origin: 'viewport', duration, ...point });
const down = { type: 'pointerDown', button: 0 };
const up = { type: 'pointerUp', button: 0 };

try {
    await command(`${sessionPath}/url`, 'POST', { url: arena }, 30000);
    const preview = await observe('the live bot arena renders behind the join screen', value => value.rendered && value.room && value.hasBots && value.play);
    assert.match(preview.userAgent, /Android.*Mobile.*Firefox\//);
    assert(preview.touchPoints > 0, 'the Firefox session is touch capable');
    assert.equal(preview.attributes?.alpha, false, 'the game canvas uses an opaque context');
    assert.equal(preview.attributes?.willReadFrequently, true, 'the game canvas selected the Android Firefox software path');
    await observe('WebSocket state advances before joining', value => value.room === preview.room && value.time > preview.time);
    assert.equal(preview.player, null, 'watching the arena does not spawn a player');

    await touch([move(middle(preview.play)), down, up]);
    const playing = await observe('Play admits a player into the watched room', value => value.room === preview.room && !value.play && value.player?.alive && value.controls.length === 2);
    assert(playing.time >= preview.time, 'the player joins the running arena');

    const direction = playing.player.x < playing.width / 2 ? 1 : -1;
    const stick = middle(playing.controls[0]);
    const x = stick.x + direction * Math.min(65, stick.x - 8);
    await touch([move(stick), down, move({ x, y: stick.y }, 160)]);
    const moved = await observe('the joystick moves the server player', value => value.player?.alive && (value.player.x - playing.player.x) * direction > 10);
    await touch([up]);

    const action = middle(moved.controls[1]);
    await touch([move(action), down]);
    await observe('holding the touch action starts inhale on the server', value => value.player?.inhaling);
    await touch([up]);
    const released = await observe('releasing the touch action stops inhale on the server', value => value.player?.alive && !value.player.inhaling);

    const report = {
        browser: session.capabilities?.browserVersion,
        userAgent: preview.userAgent,
        touchPoints: preview.touchPoints,
        canvas: preview.attributes,
        arenaTimeAdvancedMs: released.time - preview.time,
        joystickDisplacement: Math.round((moved.player.x - playing.player.x) * direction),
        inhalePressedAndReleased: true,
    };
    const results = JSON.stringify(report, null, 2);
    console.log(results);
    if (process.env.FIREFOX_ANDROID_RESULTS) await writeFile(join(process.env.FIREFOX_ANDROID_RESULTS, 'result.json'), `${results}\n`);
} finally {
    await command(`${sessionPath}/actions`, 'DELETE').catch(() => {});
    await command(sessionPath, 'DELETE');
}
