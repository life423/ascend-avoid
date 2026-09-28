// End-to-end multiplayer check: starts the built server, connects scripted players and walks
// through the shared world. Run with: npm run test:multiplayer
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';

const PORT = Number(process.env.SMOKE_PORT || 3170);
const URL = `ws://localhost:${PORT}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let failures = 0;
function check(ok, label) {
    console.log(`${ok ? '✓' : '✗'} ${label}`);
    if (!ok) failures++;
}

async function waitFor(condition, timeoutMs, label) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        if (condition()) return check(true, label);
        await sleep(50);
    }
    check(false, `${label} (still not true after ${timeoutMs / 1000}s)`);
}

async function join(name) {
    const room = await new Client(URL).joinOrCreate('game_room', { name });
    room.onMessage('*', () => {}); // playerJoined / playerLeft notices aren't needed here
    return room;
}

/** Distance from a player's center to the nearest obstacle */
function clearance(state, player) {
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    let nearest = Infinity;
    state.obstacles.forEach((o) => {
        const dx = Math.max(o.x - cx, 0, cx - (o.x + o.width));
        const dy = Math.max(o.y - cy, 0, cy - (o.y + o.height));
        nearest = Math.min(nearest, Math.hypot(dx, dy));
    });
    return nearest;
}

const server = spawn(process.execPath, ['server/dist/index.js'], {
    env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
    stdio: ['ignore', 'ignore', 'inherit'],
});

try {
    for (let i = 0; i < 50; i++) {
        try {
            if ((await fetch(`http://localhost:${PORT}/health`)).ok) break;
        } catch {
            // not listening yet
        }
        await sleep(100);
    }

    const alice = await join('Alice');
    const state = () => alice.state;
    const me = () => state().players.get(alice.sessionId);
    await waitFor(() => state().players?.size === 1, 2000, 'the first visitor is in the world right away');
    check(me().state === 'alive', 'no waiting room: you start in play');
    check(state().worldWidth === 2100 && state().worldHeight === 2100, `the world is several screens across (${state().worldWidth}×${state().worldHeight})`);
    check(me().spawnProtected === true, 'a new arrival starts protected');
    check(state().obstacles.length >= 30, `traffic fills the world (${state().obstacles.length} obstacles)`);

    const bob = await join('Bob');
    check(bob.roomId === alice.roomId, 'a second visitor joins the same world');
    const bobState = () => state().players.get(bob.sessionId);
    await waitFor(() => bobState()?.name === 'Bob', 2000, 'names reach other players');
    const apart = Math.hypot(me().x - bobState().x, me().y - bobState().y);
    check(apart > 150, `players spawn apart (${Math.round(apart)} units)`);

    // Movement, while Bob is still protected from traffic
    const bobX = bobState().x;
    bob.send('hop', { direction: bobX > state().worldWidth / 2 ? 'left' : 'right' });
    await sleep(250);
    const hopped = Math.abs(bobState().x - bobX);
    check(Math.abs(hopped - 60) < 1, `a hop is 60 units, like solo play (${Math.round(hopped)})`);
    const bobY = bobState().y;
    const vertical = bobY > state().worldHeight / 2 ? 'up' : 'down';
    for (let i = 0; i < 3; i++) bob.send('hop', { direction: vertical }); // a burst, like a laggy network
    await sleep(350);
    const burst = Math.abs(bobState().y - bobY);
    check(Math.abs(burst - 180) < 1, `hops that arrive together all count (${Math.round(burst)} units for 3)`);
    const floodY = bobState().y;
    for (let i = 0; i < 20; i++) bob.send('hop', { direction: vertical === 'up' ? 'down' : 'up' });
    await sleep(600);
    const flooded = Math.round(Math.abs(bobState().y - floodY) / 60);
    check(flooded <= 5, `flooding hops can't speed anyone up (${flooded} of 20 applied)`);
    await waitFor(() => bobState().spawnProtected === false, 2500, 'protection wears off after a moment');

    // Traffic
    const before = [];
    state().obstacles.forEach((o) => before.push({ x: o.x, y: o.y }));
    await sleep(500);
    const directions = new Set();
    let moving = 0;
    state().obstacles.forEach((o, i) => {
        const dx = o.x - before[i].x;
        const dy = o.y - before[i].y;
        const moved = Math.hypot(dx, dy);
        if (moved > 20 && moved < 400) {
            moving++;
            directions.add(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        }
    });
    check(moving >= state().obstacles.length * 0.8, `obstacles move (${moving} of ${state().obstacles.length})`);
    check(directions.size >= 3, `traffic runs in several directions (${[...directions].join(', ')})`);

    // Hits
    alice.send('test:knockout');
    await waitFor(() => me().state === 'dead', 1000, 'a hit knocks you out');
    const outAt = Date.now();
    await waitFor(() => me().state === 'alive', 3500, 'and you come back');
    const outFor = (Date.now() - outAt) / 1000;
    check(outFor > 1.5 && outFor < 2.8, `about two seconds later (${outFor.toFixed(1)}s)`);
    check(me().spawnProtected === true, 'protected when you come back');
    const room = clearance(state(), me());
    check(room >= 100, `somewhere clear of traffic (${Math.round(room)} units from the nearest obstacle)`);

    // Leaving and joining
    await bob.leave();
    await waitFor(() => state().players.size === 1, 2000, 'a player who leaves disappears for everyone');
    const carol = await join('Carol');
    check(carol.roomId === alice.roomId, 'the world keeps running: a new visitor joins it');
    await alice.leave();
    await carol.leave();
    await sleep(400);
    const dave = await join('Dave');
    check(dave.roomId !== alice.roomId, 'the room closes once everyone has left');
    await dave.leave();
} catch (error) {
    check(false, `unexpected error: ${error.message}`);
} finally {
    server.kill('SIGTERM');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll multiplayer checks passed');
process.exit(failures ? 1 : 0);
