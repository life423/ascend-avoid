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
    // Keep every message (playerJoined, credit, jackpot...) so checks can look for them
    room.messages = [];
    room.onMessage('*', (type, message) => room.messages.push({ type, message }));
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
    check(me().width === 20, `and starts small (${me().width} units)`);
    check(state().obstacles.length >= 30, `traffic fills the world (${state().obstacles.length} obstacles)`);

    const bob = await join('Bob');
    check(bob.roomId === alice.roomId, 'a second visitor joins the same world');
    const bobState = () => state().players.get(bob.sessionId);
    await waitFor(() => bobState()?.name === 'Bob', 2000, 'names reach other players');
    const apart = Math.hypot(me().x - bobState().x, me().y - bobState().y);
    check(apart > 150, `players spawn apart (${Math.round(apart)} units)`);

    // Movement, while Bob is still protected from traffic
    const toward = bobState().x > state().worldWidth / 2 ? -1 : 1;
    const upward = bobState().y > state().worldHeight / 2 ? -1 : 1;
    const bobX = bobState().x;
    bob.send('steer', { x: toward, y: 0 });
    await sleep(400);
    const midX = bobState().x;
    await sleep(500);
    const bobSpeed = Math.abs(bobState().x - midX) / 0.5;
    bob.send('steer', { x: 0, y: 0 });
    check(Math.abs(midX - bobX) > 20 && bobSpeed > 270 && bobSpeed < 370, `steering moves you smoothly (${Math.round(bobSpeed)} units a second)`);
    await sleep(400);
    const stoppedX = bobState().x;
    await sleep(300);
    check(Math.abs(bobState().x - stoppedX) < 1, 'and letting go glides you to a stop');
    const cheatX = bobState().x;
    const cheatY = bobState().y;
    bob.send('steer', { x: toward * 40, y: upward * 40 });
    await sleep(500);
    bob.send('steer', { x: 0, y: 0 });
    const cheated = Math.hypot(bobState().x - cheatX, bobState().y - cheatY);
    check(cheated < 220, `steering harder can't speed anyone up (${Math.round(cheated)} units in half a second)`);
    await sleep(400);
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
    const cruising = [];
    state().obstacles.forEach((o) => {
        if (o.vx || o.vy) cruising.push(o);
    });
    const acrossOf = (o) => (o.vx ? [o.y, o.height] : [o.x, o.width]);
    const laneOf = (o) => Math.floor((acrossOf(o)[0] + acrossOf(o)[1] / 2) / 150);
    const insideLane = (o) => acrossOf(o)[0] >= laneOf(o) * 150 - 0.5 && acrossOf(o)[0] + acrossOf(o)[1] <= (laneOf(o) + 1) * 150 + 0.5;
    check(cruising.every(insideLane), `traffic keeps to lanes (${cruising.length} obstacles)`);
    let tightest = Infinity;
    for (const a of cruising) {
        for (const b of cruising) {
            if (a === b || !a.vx !== !b.vx || laneOf(a) !== laneOf(b)) continue;
            const [as, al, bs, bl] = a.vx ? [a.x, a.width, b.x, b.width] : [a.y, a.height, b.y, b.height];
            tightest = Math.min(tightest, Math.max(bs - (as + al), as - (bs + bl)));
        }
    }
    check(tightest >= 140, `obstacles in a lane keep a gap wider than any player (closest ${Math.round(tightest)} units)`);
    check(state().balls?.length === 5, `balls roll around the arena (${state().balls?.length})`);
    let diagonal = 0;
    const ballsBefore = [];
    state().balls.forEach((b) => {
        if (Math.abs(b.vx) > 20 && Math.abs(b.vy) > 20) diagonal++;
        ballsBefore.push({ x: b.x, y: b.y });
    });
    check(diagonal === 5, `diagonally (${diagonal} of 5)`);
    await sleep(500);
    let rolled = 0;
    let inside = true;
    state().balls.forEach((b, i) => {
        if (Math.hypot(b.x - ballsBefore[i].x, b.y - ballsBefore[i].y) > 40) rolled++;
        if (b.x < b.radius - 1 || b.x > 2100 - b.radius + 1 || b.y < b.radius - 1 || b.y > 2100 - b.radius + 1) inside = false;
    });
    check(rolled === 5 && inside, `they keep rolling, bouncing off the walls (${rolled} of 5 moved)`);

    // Gems (Alice is kept safe from traffic so the counts stay exact)
    alice.send('test:protect', { ms: 20000 });
    const sideways = () => (me().x < state().worldWidth / 2 ? 'right' : 'left');
    const way = sideways();
    alice.send('test:placeGem', { dx: way === 'right' ? 60 : -60, dy: 0 });
    await waitFor(() => state().gems.size === 1, 1000, 'a gem appears nearby');
    alice.send('steer', { x: way === 'right' ? 1 : -1, y: 0 });
    await waitFor(() => me().gems === 1, 1500, 'walking onto a gem picks it up');
    alice.send('steer', { x: 0, y: 0 });
    await sleep(400);
    check(state().gems.size === 0, 'and it leaves the world');
    const dashX = me().x;
    alice.send('dash', { x: way === 'right' ? 1 : -1, y: 0 });
    await sleep(450);
    const dashed = Math.abs(me().x - dashX);
    check(dashed > 150 && dashed < 240, `a dash is a quick burst (${Math.round(dashed)} units)`);
    check(me().gems === 0, 'and costs a gem');
    const afterDash = me().x;
    alice.send('dash', { x: way === 'right' ? 1 : -1, y: 0 });
    await sleep(200);
    check(Math.abs(me().x - afterDash) < 3, 'and needs a moment to recharge');
    await sleep(900);
    alice.send('test:placeGem', { dx: way === 'right' ? 70 : -70, dy: 0 });
    await waitFor(() => state().gems.size === 1, 1000, 'another gem appears ahead');
    const beforeSweep = me().gems;
    alice.send('dash', { x: way === 'right' ? 1 : -1, y: 0 });
    await waitFor(() => me().gems > beforeSweep, 1000, 'a dash picks up gems it passes over');

    alice.send('test:setGems', { count: 100 });
    await waitFor(() => me().gems >= 99, 1000, 'Alice now holds 100 gems');
    check(me().width >= 78 && me().width <= 80.5, `gems make you much bigger (${me().width} units wide at 100 gems)`);
    alice.send('steer', { x: sideways() === 'right' ? 1 : -1, y: 0 });
    await sleep(400);
    const bigFrom = me().x;
    await sleep(500);
    const bigSpeed = Math.abs(me().x - bigFrom) / 0.5;
    alice.send('steer', { x: 0, y: 0 });
    check(bigSpeed > 200 && bigSpeed < bobSpeed, `and a little slower (${Math.round(bigSpeed)} vs ${Math.round(bobSpeed)} units a second)`);
    await sleep(400);
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

    // Your own spilled gems wait for you, but anyone else can grab them right away
    alice.send('test:moveTo', { x: 1600, y: 600 });
    alice.send('test:setGems', { count: 12 });
    await sleep(200);
    const spillX = me().x + me().width / 2;
    const spillY = me().y + me().height / 2;
    alice.send('test:hit');
    await sleep(700);
    const spilled = [];
    state().gems.forEach((g) => {
        if (Math.hypot(g.x - spillX, g.y - spillY) < 300) spilled.push({ x: g.x, y: g.y });
    });
    let markedMine = 0;
    state().gems.forEach((g) => {
        if (g.locked && g.owner === alice.sessionId) markedMine++;
    });
    check(markedMine >= 3, `your spilled gems are marked as yours (${markedMine})`);
    const aliceHeld = me().gems;
    alice.send('test:moveTo', { x: spilled[0].x - me().width / 2, y: spilled[0].y - me().height / 2 });
    await sleep(250);
    check(me().gems === aliceHeld, `your own spilled gems wait a moment before you can grab them back (${me().gems - aliceHeld} grabbed)`);
    const bobHeld = bobState().gems;
    // Where that gem is now (sprayed gems may still be sliding)
    const aim = { x: spilled[1].x, y: spilled[1].y, distance: Infinity };
    state().gems.forEach((g) => {
        const distance = Math.hypot(g.x - spilled[1].x, g.y - spilled[1].y);
        if (distance < aim.distance) Object.assign(aim, { x: g.x, y: g.y, distance });
    });
    bob.send('test:moveTo', { x: aim.x - bobState().width / 2, y: aim.y - bobState().height / 2 });
    await waitFor(() => bobState().gems > bobHeld, 1000, 'but anyone else can grab them right away');
    await waitFor(() => {
        let stillLocked = 0;
        state().gems.forEach((g) => {
            if (g.locked) stillLocked++;
        });
        return stillLocked === 0;
    }, 2000, 'then the wait ends and you can grab them too');
    await waitFor(() => !me().recovering, 2000, 'Alice recovers again');

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
        left.send('dash', { x: 1, y: 0 });
        await sleep(900);
        return rightState().x - startX;
    }
    const even = await shove(alice, bob, 0, 0);
    check(even > 100 && even < 180, `dashing into someone shoves them (${Math.round(even)} units)`);
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

    // Traffic hits follow the shapes on screen and count along the whole path of a hop. All
    // traffic but one standing block is parked in a far corner, so only that block can hit Alice.
    alice.send('test:parkTraffic');
    alice.send('test:moveTo', { x: 1000, y: 1000 });
    alice.send('test:trafficHits', { on: true });
    await waitFor(() => !me().recovering && !me().spawnProtected, 3000, 'traffic is parked and Alice is ready');
    /** Stand the block where `place(half)` says (from Alice's center; half = half her width), maybe hop, and report a hit */
    async function struck(place, hopDirection) {
        alice.send('test:setGems', { count: hopDirection ? 2 : 1 });
        await sleep(120);
        alice.send('test:placeObstacle', place(me().width / 2));
        if (hopDirection) alice.send('dash', { x: hopDirection === 'right' ? 1 : -1, y: 0 });
        await sleep(250);
        const hit = me().recovering || me().state !== 'alive';
        alice.send('test:placeObstacle', { dx: 0, dy: 700, width: 20, height: 20 });
        const until = Date.now() + 2500;
        while ((me().recovering || me().state !== 'alive') && Date.now() < until) await sleep(50);
        alice.send('test:moveTo', { x: 1000, y: 1000 });
        await sleep(120);
        return hit;
    }
    check(!(await struck((h) => ({ dx: h + 4, dy: -17, width: 60, height: 34, variant: 0 }))), 'a block just short of you is a miss');
    check(await struck((h) => ({ dx: h - 10, dy: -17, width: 60, height: 34, variant: 0 })), 'a block 10 units into your edge is a hit');
    check(await struck((h) => ({ dx: h - 10, dy: -17, width: 60, height: 34, variant: 1 })), "a diamond's point 10 units into you is a hit");
    check(!(await struck((h) => ({ dx: h - 12, dy: h - 12, width: 60, height: 34, variant: 1 }))), "a diamond's empty corner over yours is a miss");
    check(await struck((h) => ({ dx: h + 3, dy: -30, width: 11, height: 60, variant: 0 }), 'right'), 'dashing through a thin block is a hit');
    /** Stand a ball where `place(half)` says (from Alice's center), and report whether it hits her */
    async function ballStruck(place) {
        alice.send('test:setGems', { count: 1 });
        await sleep(120);
        alice.send('test:placeBall', place(me().width / 2));
        await sleep(250);
        const hit = me().recovering || me().state !== 'alive';
        alice.send('test:placeBall', { dx: 0, dy: 700 });
        const until = Date.now() + 2500;
        while ((me().recovering || me().state !== 'alive') && Date.now() < until) await sleep(50);
        alice.send('test:moveTo', { x: 1000, y: 1000 });
        await sleep(120);
        return hit;
    }
    check(await ballStruck((h) => ({ dx: h + 14, dy: 0 })), 'a ball touching your side is a hit');
    check(!(await ballStruck((h) => ({ dx: h + 16, dy: h + 16 }))), "a ball just off your corner is a miss (it's round)");
    // After a hit you skid away from what hit you, and can't hop until you've recovered
    alice.send('test:setGems', { count: 4 });
    alice.send('test:moveTo', { x: 1000, y: 1000 });
    await sleep(150);
    const skidFromX = me().x;
    const skidFromY = me().y;
    alice.send('test:placeBall', { dx: me().width / 2 + 14, dy: 0 });
    await sleep(80);
    alice.send('steer', { x: 0, y: 1 });
    await sleep(600);
    check(me().x < skidFromX - 30, `a hit sends you skidding away from what hit you (${Math.round(skidFromX - me().x)} units)`);
    check(Math.abs(me().y - skidFromY) < 5, "and you can't steer until you've recovered");
    alice.send('steer', { x: 0, y: 0 });
    alice.send('test:placeBall', { dx: 0, dy: 700 });
    await waitFor(() => !me().recovering && !me().sliding, 2000, 'Alice is steady again');
    alice.send('test:trafficHits', { on: false });

    // The arena shift
    const tileCenter = (i) => ({ x: (i % 10) * 210 + 105, y: Math.floor(i / 10) * 210 + 105 });
    const centerOf = (p) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
    const onFloor = (p) => {
        const floor = state().floor;
        if (!floor) return true;
        const c = centerOf(p);
        return floor[Math.min(9, Math.floor(c.y / 210)) * 10 + Math.min(9, Math.floor(c.x / 210))] === '1';
    };
    const placeCenter = (room, player, point) =>
        room.send('test:moveTo', { x: point.x - player.width / 2, y: point.y - player.height / 2 });
    check(state().shiftPhase === 'normal' && state().phaseEndsAt >= 60000, `the arena starts whole, with the first shift ${Math.round(state().phaseEndsAt / 1000)}s in`);
    alice.send('test:shift', { phase: 'grace', msLeft: 5000 });
    await waitFor(() => state().shiftPhase === 'grace' && state().floor.length === 100, 1000, 'a shift starts by showing the new floor');
    const floor = state().floor;
    const floorTiles = [...floor].flatMap((c, i) => (c === '1' ? [i] : []));
    check(floorTiles.length >= 35 && floorTiles.length <= 65, `it covers ${floorTiles.length}% of the arena`);
    const reached = new Set([floorTiles[0]]);
    for (const queue = [floorTiles[0]]; queue.length > 0; ) {
        const i = queue.pop();
        for (const j of [i - 10, i + 10, i % 10 > 0 ? i - 1 : -1, i % 10 < 9 ? i + 1 : -1]) {
            if (j >= 0 && j < 100 && floor[j] === '1' && !reached.has(j)) {
                reached.add(j);
                queue.push(j);
            }
        }
    }
    check(reached.size === floorTiles.length, 'and all of it connects');
    let dropping = 0;
    state().gems.forEach((gem) => {
        if (gem.falling && onFloor({ x: gem.x, y: gem.y, width: 0, height: 0 })) dropping++;
    });
    check(dropping >= 10, `gems drop onto the new floor (${dropping})`);
    alice.send('test:trafficHits', { on: true });
    alice.send('test:setGems', { count: 4 });
    alice.send('test:placeObstacle', { dx: -30, dy: -17, width: 60, height: 34, variant: 0 });
    await sleep(300);
    check(!me().recovering && me().state === 'alive', 'nothing can hurt you during the grace period');
    alice.send('test:placeObstacle', { dx: 0, dy: 700, width: 20, height: 20 });
    alice.send('test:trafficHits', { on: false });
    placeCenter(alice, me(), tileCenter(floorTiles[0]));
    placeCenter(bob, bobState(), tileCenter(floorTiles[floorTiles.length - 1]));
    await waitFor(() => state().shiftPhase === 'shift', 6000, 'then the rest of the arena drops away');
    check(me().state === 'alive' && !me().recovering && onFloor(me()), 'players on the new floor are fine');

    const voidTile = floor.indexOf('0');
    alice.send('test:setGems', { count: 10 });
    await sleep(150);
    placeCenter(alice, me(), tileCenter(voidTile));
    await waitFor(() => me().recovering, 1000, 'stepping over the edge counts as a hit');
    check(me().gems <= 6, `half your gems burst out (${me().gems} left)`);
    check(onFloor(me()), 'and you land back on the floor');
    await waitFor(() => !me().recovering, 2000, 'Alice recovers');
    alice.send('test:setGems', { count: 0 });
    await sleep(150);
    placeCenter(alice, me(), tileCenter(voidTile));
    await waitFor(() => me().state === 'dead', 1000, 'with no gems, going over the edge knocks you out');
    await waitFor(() => me().state === 'alive', 3500, 'and you come back');
    check(onFloor(me()), 'on the floor');

    const edge = floorTiles.find((i) => i % 10 < 9 && floor[i + 1] === '0');
    await waitFor(() => !me().spawnProtected && !bobState().spawnProtected && !bobState().recovering, 3000, 'both players are ready');
    alice.send('test:setGems', { count: 6 });
    bob.send('test:setGems', { count: 0 });
    await sleep(150);
    const tileRight = ((edge % 10) + 1) * 210;
    const rowMiddle = Math.floor(edge / 10) * 210 + 105;
    alice.send('test:moveTo', { x: tileRight - me().width - 4, y: rowMiddle - me().height / 2 });
    bob.send('test:moveTo', { x: tileRight - me().width - 4 - bobState().width - 20, y: rowMiddle - bobState().height / 2 });
    await sleep(250);
    bob.messages.length = 0;
    bob.send('dash', { x: 1, y: 0 });
    await waitFor(() => bob.messages.some((m) => m.type === 'credit' && m.message.how === 'edge'), 2000, 'shoving someone off the edge is credited');
    const credit = bob.messages.find((m) => m.type === 'credit')?.message;
    check(credit?.by === 'Bob' && credit?.target === 'Alice', `everyone sees who did it (${credit?.by} shoved ${credit?.target})`);

    await waitFor(() => !me().recovering && !me().sliding, 2000, 'Alice is steady');
    const spot = tileCenter(floorTiles[Math.floor(floorTiles.length / 2)]);
    placeCenter(alice, me(), spot);
    placeCenter(bob, bobState(), { x: spot.x + 10, y: spot.y });
    await sleep(250);
    const aliceBefore = me().gems;
    alice.messages.length = 0;
    alice.send('test:jackpot');
    await sleep(1200);
    check(state().jackpotOn && state().jackpotProgress === 0, 'with two players on the jackpot, nobody claims it');
    placeCenter(bob, bobState(), tileCenter(floorTiles[0]));
    await waitFor(() => !state().jackpotOn && me().gems >= aliceBefore + 20, 2000, 'alone on it, you claim the jackpot (+20)');
    check(alice.messages.some((m) => m.type === 'jackpot' && m.message.by === 'Alice'), 'and everyone hears about it');

    alice.send('test:shift', { phase: 'shift', msLeft: 800 });
    await waitFor(() => state().shiftPhase === 'normal' && state().floor === '', 3000, 'after a while the whole arena returns');
    const untilNext = Math.round((state().phaseEndsAt - state().time) / 1000);
    check(untilNext > 100, `with the next shift a couple of minutes away (${untilNext}s)`);

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
