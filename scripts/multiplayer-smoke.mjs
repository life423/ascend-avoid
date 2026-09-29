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

async function join(name, options = {}) {
    const room = await new Client(URL).joinOrCreate('game_room', { name, ...options });
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

    // This world starts with no loose gems, no bots, and traffic that can't hit anyone (the test
    // hits players itself), so nothing happens by accident and every count is exact
    const alice = await join('Alice', { testFieldGems: 0, testCalm: true, testBots: 0 });
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

    // Gems (Alice is kept safe from traffic so the counts stay exact)
    alice.send('test:protect', { ms: 20000 });
    const sideways = () => (me().x < state().worldWidth / 2 ? 'right' : 'left');
    const way = sideways();
    alice.send('test:placeGem', { dx: way === 'right' ? 60 : -60, dy: 0 });
    await waitFor(() => state().gems.size === 1, 1000, 'a gem appears one hop away');
    alice.send('hop', { direction: way });
    await waitFor(() => me().gems === 1, 1000, 'hopping onto a gem picks it up');
    check(state().gems.size === 0, 'and it leaves the world');

    alice.send('test:setGems', { count: 100 });
    await waitFor(() => me().gems >= 99, 1000, 'Alice now holds 100 gems');
    check(Math.abs(me().width - 67.5) < 0.6, `gems make you bigger, up to 1.5x (${me().width} units wide)`);
    const bigX = me().x;
    alice.send('hop', { direction: sideways() });
    await sleep(250);
    const bigHop = Math.abs(me().x - bigX);
    check(Math.abs(bigHop - 90) < 1.5, `and hops grow with you (${Math.round(bigHop)} units)`);
    const shedFrom = me().gems;
    await sleep(2500);
    check(me().gems < shedFrom, `very big players slowly shed gems (${shedFrom} to ${me().gems} in 2.5s)`);

    alice.send('test:setGems', { count: 20 });
    await waitFor(() => me().gems === 20, 1000, 'down to 20 gems');
    const hitX = me().x + me().width / 2;
    const hitY = me().y + me().height / 2;
    alice.send('test:hit');
    await waitFor(() => me().gems === 10, 1000, 'a hit sprays out half your gems');
    check(me().state === 'alive' && me().recovering === true, 'and you blink for a moment instead of being knocked out');
    let sprayed = 0;
    state().gems.forEach((gem) => {
        sprayed += gem.value;
    });
    check(sprayed === 10, `the lost gems burst into the world (${sprayed} in ${state().gems.size} pieces)`);
    await sleep(700);
    let spread = 0;
    state().gems.forEach((gem) => {
        spread += Math.hypot(gem.x - hitX, gem.y - hitY);
    });
    spread /= Math.max(1, state().gems.size);
    check(spread > 80, `they fly outward (${Math.round(spread)} units on average)`);
    check(me().gems === 10, `and don't snap straight back to you (${me().gems} gems)`);
    await waitFor(() => me().recovering === false, 2000, 'the blinking wears off');

    // Hits with nothing left
    alice.send('test:setGems', { count: 0 });
    await waitFor(() => me().gems === 0, 1000, 'down to no gems');
    alice.send('test:hit');
    await waitFor(() => me().state === 'dead', 1000, 'a hit with no gems knocks you out');
    const outAt = Date.now();
    await waitFor(() => me().state === 'alive', 3500, 'and you come back');
    const outFor = (Date.now() - outAt) / 1000;
    check(outFor > 1.5 && outFor < 2.8, `about two seconds later (${outFor.toFixed(1)}s)`);
    check(me().spawnProtected === true, 'protected when you come back');
    const room = clearance(state(), me());
    check(room >= 100, `somewhere clear of traffic (${Math.round(room)} units from the nearest obstacle)`);

    // Shoving
    await waitFor(() => !me().spawnProtected && !bobState().spawnProtected, 3000, 'neither player is protected');
    /** Line `left` up just left of `right`, have `left` hop into `right`, and return how far `right` slides */
    async function shove(left, right, leftGems, rightGems) {
        const leftState = () => state().players.get(left.sessionId);
        const rightState = () => state().players.get(right.sessionId);
        left.send('test:setGems', { count: leftGems });
        right.send('test:setGems', { count: rightGems });
        await sleep(150);
        left.send('test:moveTo', { x: 700, y: 1000 });
        right.send('test:moveTo', { x: 700 + leftState().width + 20, y: 1000 });
        await sleep(250);
        const startX = rightState().x;
        left.send('hop', { direction: 'right' });
        await sleep(900);
        return rightState().x - startX;
    }
    const even = await shove(alice, bob, 0, 0);
    check(even > 100 && even < 180, `hopping into someone shoves them (${Math.round(even)} units)`);
    check(bobState().sliding === false, 'and they slide to a stop');
    const heavy = await shove(alice, bob, 100, 0);
    check(heavy > even * 1.6, `heavier players shove harder (${Math.round(heavy)} units)`);
    const light = await shove(bob, alice, 0, 100);
    check(light < even * 0.6, `and are harder to shove (${Math.round(light)} units)`);
    const knockedLoose = 100 - me().gems;
    check(knockedLoose >= 2 && knockedLoose <= 12, `shoving the leader knocks some of their gems loose (${knockedLoose})`);
    let nearby = bobState().gems;
    state().gems.forEach((gem) => {
        if (Math.hypot(gem.x - me().x, gem.y - me().y) < 350) nearby += gem.value;
    });
    check(nearby >= 2, `and they burst out for the taking (${nearby} nearby)`);
    bob.send('test:protect', { ms: 3000 });
    const shielded = await shove(alice, bob, 0, 0);
    check(Math.abs(shielded) < 5, `players who just arrived can't be shoved (${Math.round(shielded)} units)`);
    bob.send('test:protect', { ms: 0 });
    alice.send('test:protect', { ms: 3000 });
    await sleep(100);
    const freed = await shove(alice, bob, 0, 0);
    check(freed > 100 && me().spawnProtected === false, 'shoving someone ends your own protection');

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
    await waitFor(() => dave.state.gems?.size >= 60, 2000, 'a fresh world has gems lying around');

    // Bots
    const botsIn = (room) => {
        const found = [];
        room.state.players.forEach((player) => {
            if (player.isBot) found.push(player);
        });
        return found;
    };
    await waitFor(() => dave.state.players.size === 6 && botsIn(dave).length === 5, 2000, 'bots fill a quiet world up to six players');
    const names = botsIn(dave).map((bot) => bot.name);
    check(new Set(names).size === 5, `each with its own name (${names.join(', ')})`);
    const botStarts = botsIn(dave).map((bot) => ({ bot, x: bot.x, y: bot.y }));
    await sleep(2500);
    const wandered = botStarts.filter(({ bot, x, y }) => Math.hypot(bot.x - x, bot.y - y) > 50).length;
    check(wandered >= 3, `bots move around on their own (${wandered} of 5)`);
    const erin = await join('Erin');
    await waitFor(() => dave.state.players.size === 6 && botsIn(dave).length === 4, 2000, 'a bot makes room when a person joins');
    await erin.leave();
    await waitFor(() => botsIn(dave).length === 5, 2000, 'and another fills in when they leave');
    await dave.leave();
} catch (error) {
    check(false, `unexpected error: ${error.message}`);
} finally {
    server.kill('SIGTERM');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll multiplayer checks passed');
process.exit(failures ? 1 : 0);
