// End-to-end multiplayer check: starts the built server, connects scripted players and
// walks through a full round cycle. Run with: npm run test:multiplayer
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
    await waitFor(() => state().gameState === 'waiting' && state().players.size === 1, 2000, 'a lone player waits for others');
    check(state().arenaWidth === 600 && state().arenaHeight === 700, 'arena is the fixed 600×700');
    check(state().players.get(alice.sessionId)?.name === 'Alice', 'player names reach clients');

    const bob = await join('Bob');
    check(bob.roomId === alice.roomId, 'the second player lands in the same room');
    await waitFor(() => state().gameState === 'starting', 2000, 'a second player starts the countdown');
    const a = state().players.get(alice.sessionId);
    const b = state().players.get(bob.sessionId);
    check(a && b && a.x !== b.x, `players start in different spots (x ${a?.x} and ${b?.x})`);
    check(state().countdownTime >= 4, `countdown starts near 5 (${state().countdownTime})`);

    await waitFor(() => state().gameState === 'playing', 7000, 'the round starts when the countdown ends');
    check(state().obstacles.length >= 5, `obstacles spawn (${state().obstacles.length})`);

    const obstacleStart = [];
    state().obstacles.forEach((o) => obstacleStart.push(o.x));
    const bobStart = state().players.get(bob.sessionId).x;
    bob.send('input', { right: true });
    await sleep(500);
    bob.send('input', { right: false });
    await sleep(150);
    const bobMoved = state().players.get(bob.sessionId).x - bobStart;
    check(bobMoved > 30, `input moves the player (${Math.round(bobMoved)}px in 0.5s)`);
    let obstaclesMoved = 0;
    state().obstacles.forEach((o, i) => {
        if (o.x > obstacleStart[i] + 20) obstaclesMoved++;
    });
    check(obstaclesMoved > 0, `obstacles move (${obstaclesMoved} of ${obstacleStart.length} advanced 20px+ in 0.65s)`);

    await bob.leave();
    await waitFor(() => state().gameState === 'game_over', 2000, 'the round ends when one player is left');
    check(state().winnerName === 'Alice', `the last player standing wins (winner: ${state().winnerName})`);

    await waitFor(() => state().gameState === 'waiting', 7000, 'after the results, a lone player goes back to waiting');

    const carol = await join('Carol');
    check(carol.roomId === alice.roomId, 'a new visitor joins the same room');
    await waitFor(() => state().gameState === 'starting' && state().countdownTime >= 4, 2000, 'the next round gets a fresh countdown');

    await alice.leave();
    await carol.leave();
} catch (error) {
    check(false, `unexpected error: ${error.message}`);
} finally {
    server.kill('SIGTERM');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll multiplayer checks passed');
process.exit(failures ? 1 : 0);
