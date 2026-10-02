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
    const alice = await join('Alice', { testFieldGems: 0, testCalm: true, testBots: 0, testTraffic: 'always', testBombs: true });
    const state = () => alice.state;
    const me = () => state().players.get(alice.sessionId);
    await waitFor(() => state().players?.size === 1, 2000, 'the first visitor is in the world right away');
    check(me().state === 'alive', 'no waiting room: you start in play');
    check(state().worldWidth >= 4000 && state().worldHeight === state().worldWidth, `the world is many screens across, room for giants (${state().worldWidth}×${state().worldHeight})`);
    check(me().spawnProtected === true, 'a new arrival starts protected');
    check(me().width === 20, `and starts small (${me().width} units)`);
    const hazards = state().obstacles.length + (state().comets?.length ?? 0) + (state().balls?.length ?? 0);
    // Live worlds have no traffic at all (this test world switches it on to keep that code working)
    const fresh = await new Client(URL).create('game_room', { name: 'Fresh', testBots: 0 });
    fresh.onMessage('*', () => {});
    await sleep(600);
    let freshMoving = 0;
    fresh.state.obstacles.forEach((o) => { if (o.vx || o.vy) freshMoving++; });
    fresh.state.comets?.forEach((c) => { if (c.vx || c.vy) freshMoving++; });
    fresh.state.balls?.forEach((b) => { if (b.vx || b.vy) freshMoving++; });
    check(freshMoving === 0 && fresh.state.trafficWave === 'calm', `a normal world has no traffic at all (${freshMoving} moving)`);
    await fresh.leave();
    check(hazards >= 12, `traffic fills the world (${state().obstacles.length} in lanes, ${state().comets?.length} comets, ${state().balls?.length} balls)`);

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
    check(directions.size >= 2, `traffic runs in several directions (${[...directions].join(', ')})`);
    const cruising = [];
    state().obstacles.forEach((o) => {
        if (o.vx || o.vy) cruising.push(o);
    });
    const acrossOf = (o) => (o.vx ? [o.y, o.height] : [o.x, o.width]);
    const laneSize = state().worldWidth / 14; // TRAFFIC.LANES lanes across the world
    const laneOf = (o) => Math.floor((acrossOf(o)[0] + acrossOf(o)[1] / 2) / laneSize);
    const insideLane = (o) => acrossOf(o)[0] >= laneOf(o) * laneSize - 0.5 && acrossOf(o)[0] + acrossOf(o)[1] <= (laneOf(o) + 1) * laneSize + 0.5;
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
    check(state().balls?.length === 3, `balls roll around the arena (${state().balls?.length})`);
    const comets = [];
    state().comets?.forEach((c) => comets.push({ vx: c.vx, vy: c.vy, turn: c.turn }));
    check(comets.length === 5, `comets fly across the arena (${comets.length})`);
    const slanted = comets.filter((c) => {
        const speed = Math.hypot(c.vx, c.vy);
        return Math.abs(c.vx) > speed * 0.35 && Math.abs(c.vy) > speed * 0.35;
    }).length;
    check(slanted === comets.length, `always at a slant, never along the lanes (${slanted} of ${comets.length})`);
    const cometsBefore = [];
    state().comets.forEach((c) => cometsBefore.push({ heading: Math.atan2(c.vy, c.vx), turn: c.turn }));
    await sleep(600);
    const bends = [];
    state().comets.forEach((c, i) => {
        if (!cometsBefore[i].turn || c.turn !== cometsBefore[i].turn) return; // straight, or it came round again meanwhile
        const change = Math.atan2(c.vy, c.vx) - cometsBefore[i].heading;
        bends.push(Math.abs(Math.atan2(Math.sin(change), Math.cos(change))));
    });
    check(bends.length >= 1 && bends.every((b) => b > 0.004 && b < 0.2), `some bend gently as they fly (${bends.map((b) => (b * 180 / Math.PI).toFixed(1) + '°').join(', ')} in 0.6s)`);

    // Traffic comes in waves: between them the arena is calm
    alice.send('test:traffic', { phase: 'calm' });
    await sleep(300);
    let stillMoving = 0;
    state().obstacles.forEach((o) => { if (o.vx || o.vy) stillMoving++; });
    state().comets.forEach((c) => { if (c.vx || c.vy) stillMoving++; });
    state().balls.forEach((b) => { if (b.vx || b.vy) stillMoving++; });
    check(state().trafficWave === 'calm' && stillMoving === 0, `between traffic waves the arena is calm (${stillMoving} hazards moving)`);
    alice.send('test:traffic', { phase: 'warning' });
    await sleep(200);
    check(state().trafficWave === 'warning', 'a wave is announced first (Traffic incoming)');
    await waitFor(() => state().trafficWave === 'wave', 4000, 'then the wave arrives');
    await sleep(1200);
    let arrived = 0;
    state().comets.forEach((c) => { if (c.vx || c.vy) arrived++; });
    state().balls.forEach((b) => { if (b.vx || b.vy) arrived++; });
    let lanesBack = 0;
    state().obstacles.forEach((o) => { if (o.vx || o.vy) lanesBack++; });
    check(arrived === 8 && lanesBack >= 3, `and brings comets, balls and lane traffic streaming in (${arrived} of 8, ${lanesBack} lanes)`);
    alice.send('test:traffic', { phase: 'always' });
    await sleep(200);
    let diagonal = 0;
    const ballsBefore = [];
    state().balls.forEach((b) => {
        if (Math.abs(b.vx) > 20 && Math.abs(b.vy) > 20) diagonal++;
        ballsBefore.push({ x: b.x, y: b.y });
    });
    check(diagonal === 3, `diagonally (${diagonal} of 3)`);
    await sleep(500);
    let rolled = 0;
    let inside = true;
    state().balls.forEach((b, i) => {
        if (Math.hypot(b.x - ballsBefore[i].x, b.y - ballsBefore[i].y) > 40) rolled++;
        if (b.x < b.radius - 1 || b.x > state().worldWidth - b.radius + 1 || b.y < b.radius - 1 || b.y > state().worldHeight - b.radius + 1) inside = false;
    });
    check(rolled === 3 && inside, `they keep rolling, bouncing off the walls (${rolled} of 3 moved)`);

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

    alice.send('test:setGems', { count: 100 });
    await waitFor(() => me().gems >= 99, 1000, 'Alice now holds 100 gems');
    check(me().width >= 142 && me().width <= 143.5, `gems make you much bigger (${me().width.toFixed(1)} units wide at 100 gems, 7x a newborn)`);
    alice.send('test:setGems', { count: 750 });
    await sleep(200);
    check(me().gems >= 745 && me().width >= 380, `there's no size cap: 750 gems makes a giant 19x a newborn's width (${me().width.toFixed(1)} units)`);
    alice.send('test:setGems', { count: 100 });
    await sleep(200);
    alice.send('steer', { x: sideways() === 'right' ? 1 : -1, y: 0 });
    await sleep(400);
    const bigFrom = me().x;
    await sleep(500);
    const bigSpeed = Math.abs(me().x - bigFrom) / 0.5;
    alice.send('steer', { x: 0, y: 0 });
    check(bigSpeed > 110 && bigSpeed < bobSpeed * 0.5, `and much slower (${Math.round(bigSpeed)} vs ${Math.round(bobSpeed)} units a second)`);
    alice.send('test:setGems', { count: 400 });
    await sleep(400);
    const shedFrom = me().gems;
    await sleep(2500);
    check(me().gems < shedFrom && me().gems > shedFrom - 5, `big creatures slowly shed gems, instead of hitting a ceiling (${shedFrom} to ${me().gems} in 2.5s)`);

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
        if (g.locked && g.owner === alice.sessionId) spilled.push({ x: g.x, y: g.y });
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

    // Bodies are solid: nobody overlaps or passes through anyone, and touching never shoves anyone
    await waitFor(() => !me().spawnProtected && !bobState().spawnProtected, 3000, 'neither player is protected');
    /** Line `walker` up just left of `wall` and walk it right (and down, at an angle); returns how far `wall` moved, how far `walker` got down, and the gap between them */
    async function walkInto(walker, wall, walkerGems, wallGems, { down = 0, inhale = false } = {}) {
        const walkerState = () => state().players.get(walker.sessionId);
        const wallState = () => state().players.get(wall.sessionId);
        walker.send('test:setGems', { count: walkerGems });
        wall.send('test:setGems', { count: wallGems });
        await sleep(150);
        walker.send('test:moveTo', { x: 700, y: 1000 });
        wall.send('test:moveTo', { x: 700 + walkerState().width + 20, y: 1000 + (walkerState().height - wallState().height) / 2 });
        walker.send('test:face', { angle: 0 });
        await sleep(250);
        const middle = (who) => ({ x: who.x + who.width / 2, y: who.y + who.height / 2 });
        const wallFrom = middle(wallState());
        const walkerFromY = walkerState().y;
        if (inhale) walker.send('inhale');
        walker.send('steer', { x: 1, y: down });
        await sleep(700);
        const w = walkerState();
        const v = wallState();
        const gap = Math.hypot(v.x + v.width / 2 - (w.x + w.width / 2), v.y + v.height / 2 - (w.y + w.height / 2)) - (w.width + v.width) / 2;
        walker.send('steer', { x: 0, y: 0 });
        if (inhale) walker.send('exhale');
        await sleep(400);
        return {
            wallMoved: Math.round(Math.hypot(middle(wallState()).x - wallFrom.x, middle(wallState()).y - wallFrom.y)),
            walkerDown: Math.round(walkerState().y - walkerFromY),
            gap: Math.round(gap),
        };
    }
    const even = await walkInto(alice, bob, 0, 0);
    check(even.wallMoved <= 2 && even.gap >= -2 && even.gap <= 8, `walking into someone stops you at their edge: no shove, no overlap (they moved ${even.wallMoved}, gap ${even.gap})`);
    const giantWalk = await walkInto(alice, bob, 100, 5);
    check(giantWalk.wallMoved <= 2 && giantWalk.gap >= -2, `a giant can't ram anyone either (they moved ${giantWalk.wallMoved}, gap ${giantWalk.gap})`);
    const slide = await walkInto(alice, bob, 0, 0, { down: 1 });
    check(slide.wallMoved <= 2 && slide.walkerDown > 80, `at an angle you slide along them (${slide.walkerDown} units down, they moved ${slide.wallMoved})`);
    await sleep(1100);
    const inhaleRam = await walkInto(alice, bob, 10, 10, { inhale: true });
    check(inhaleRam.wallMoved <= 2 && inhaleRam.gap >= -2, `inhaling changes nothing: you can't ram someone out of position (they moved ${inhaleRam.wallMoved})`);

    // Bombs: safe in your mouth, lit when spat, and the blast knocks everyone flying and gems loose
    await sleep(2700);
    alice.send('test:setGems', { count: 40 });
    bob.send('test:setGems', { count: 20 });
    await sleep(200);
    alice.send('test:moveTo', { x: 700, y: 1750 });
    alice.send('test:face', { angle: 0 });
    bob.send('test:moveTo', { x: 400, y: 400 });
    await sleep(150);
    alice.send('test:placeBomb', { x: 700 + me().width + 60, y: 1750 + me().height / 2 });
    await sleep(150);
    alice.send('inhale');
    await sleep(700);
    alice.send('exhale');
    check(me().mouth === 'bomb', `inhaling pulls a bomb into your mouth (${me().mouth || 'empty'})`);
    const aliceHolding = me().gems;
    await sleep(2600);
    check(me().mouth === 'bomb' && me().state === 'alive' && me().gems >= aliceHolding - 1, 'and it stays safe in your mouth until you spit it');
    bob.send('test:moveTo', { x: 700 + me().width + 170, y: 1750 + (me().height - bobState().height) / 2 });
    await sleep(300);
    const bobHad = bobState().gems;
    const bobFrom = bobState().x;
    alice.send('spit', { x: 1, y: 0 });
    await sleep(300);
    let lit = 0;
    state().bombs.forEach((bomb) => { if (bomb.explodesAt > 0) lit++; });
    check(me().mouth === '' && lit >= 1 && bobState().gems === bobHad, 'spitting it lights the fuse, and nothing happens until it runs down');
    await sleep(2400);
    check(bobHad - bobState().gems >= 2, `then it blows, knocking gems loose (${bobHad - bobState().gems} of ${bobHad})`);
    check(Math.abs(bobState().x - bobFrom) > 60, `and everyone in the blast is knocked flying (${Math.round(bobState().x - bobFrom)} units)`);

    // Swallowing is a finisher: only for someone far smaller, pulled to your mouth and held there a moment
    // (These checks take a while: keep the first arena shift away until its own checks below)
    alice.send('test:shift', { phase: 'normal', msLeft: 120000 });
    await sleep(1500);
    alice.send('test:setGems', { count: 100 });
    bob.send('test:setGems', { count: 5 });
    await sleep(200);
    // (The blast knocked Alice back: put her where Bob will be in front of her mouth)
    alice.send('test:moveTo', { x: 700, y: 1750 });
    alice.send('test:face', { angle: 0 });
    await sleep(150);
    bob.send('test:moveTo', { x: 700 + me().width + 20, y: 1750 + (me().height - bobState().height) / 2 });
    await sleep(1100); // a breath taken just before needs a moment to come back
    const aliceBeforeGulp = me().gems;
    alice.send('inhale');
    await sleep(400);
    const heldNotEaten = bobState().state === 'alive' && me().gulping === bob.sessionId;
    await sleep(1100);
    alice.send('exhale');
    check(heldNotEaten, 'a much smaller creature is pulled to your mouth and held there, not eaten at once');
    check(bobState().state !== 'alive' && me().gems >= aliceBeforeGulp + 4, `held there a moment, it's swallowed whole (Alice ${aliceBeforeGulp} then ${me().gems}, Bob ${bobState().state})`);
    await waitFor(() => bobState().state === 'alive' && !bobState().spawnProtected, 6000, 'Bob is back');
    // ...but running straight away breaks free (robbed on the way out, but not swallowed)
    bob.send('test:setGems', { count: 30 });
    await sleep(200);
    alice.send('test:moveTo', { x: 700, y: 1750 });
    alice.send('test:face', { angle: 0 });
    await sleep(150);
    bob.send('test:moveTo', { x: 700 + me().width + 90, y: 1750 + (me().height - bobState().height) / 2 });
    await sleep(1300);
    alice.send('inhale');
    bob.send('steer', { x: 1, y: 0 });
    await sleep(1600);
    alice.send('exhale');
    bob.send('steer', { x: 0, y: 0 });
    check(bobState().state === 'alive', 'but running straight away breaks free before it goes down');
    await sleep(1300);
    // A creature small enough to swallow is still robbed anywhere in your inhale, not only once it's at your mouth
    alice.send('test:setGems', { count: 100 });
    bob.send('test:setGems', { count: 20 });
    await sleep(200);
    alice.send('test:moveTo', { x: 700, y: 1750 });
    alice.send('test:face', { angle: 0 });
    await sleep(150);
    bob.send('test:moveTo', { x: 700 + me().width + 120, y: 1750 + (me().height - bobState().height) / 2 });
    await sleep(1300);
    const smallHad = bobState().gems;
    alice.send('inhale');
    await sleep(1000);
    alice.send('exhale');
    await sleep(150);
    check(smallHad - bobState().gems >= 4 && bobState().state === 'alive', `a smaller creature anywhere in your inhale is robbed, not just one at your mouth (${smallHad - bobState().gems} stolen)`);
    await sleep(1300);
    // An inhale's drain is shared: two creatures in it lose about one creature's worth between them
    const cara = await join('Cara');
    const caraState = () => state().players.get(cara.sessionId);
    await sleep(1800); // (newcomers are protected for a moment)
    alice.send('test:setGems', { count: 40 });
    bob.send('test:setGems', { count: 40 });
    cara.send('test:setGems', { count: 40 });
    await sleep(250);
    alice.send('test:moveTo', { x: 700, y: 1750 });
    alice.send('test:face', { angle: 0 });
    await sleep(150);
    bob.send('test:moveTo', { x: 700 + me().width + 30, y: 1750 - 60 });
    cara.send('test:moveTo', { x: 700 + me().width + 30, y: 1750 + me().height - caraState().height + 60 });
    await sleep(300);
    const bobShareFrom = bobState().gems;
    const caraShareFrom = caraState().gems;
    alice.send('inhale');
    await sleep(1500);
    alice.send('exhale');
    await sleep(150);
    const bobLost = bobShareFrom - bobState().gems;
    const caraLost = caraShareFrom - caraState().gems;
    check(bobLost >= 2 && caraLost >= 2 && bobLost + caraLost <= 12, `an inhale robs everyone in it, sharing one drain between them (Bob lost ${bobLost}, Cara ${caraLost})`);
    await cara.leave();
    await sleep(1300);

    // Gravity theft: inhale up close at anyone too big to swallow and their gems stream into you
    alice.send('test:setGems', { count: 40 });
    bob.send('test:setGems', { count: 40 });
    await sleep(200);
    alice.send('test:moveTo', { x: 700, y: 1750 });
    alice.send('test:face', { angle: 0 });
    bob.send('test:moveTo', { x: 700 + me().width + 20, y: 1750 });
    bob.send('test:face', { angle: 0 });
    await sleep(250);
    await sleep(1100); // a breath taken just before needs a moment to come back
    const bobBeforeTheft = bobState().gems;
    const aliceBeforeTheft = me().gems;
    alice.send('inhale');
    await sleep(700);
    const streaming = me().stealingFrom === bob.sessionId;
    await sleep(800);
    alice.send('exhale');
    await sleep(150);
    const stolen = bobBeforeTheft - bobState().gems;
    check(streaming && stolen >= 4 && me().gems - aliceBeforeTheft >= 4, `inhaling up close steals gems from anyone in front of your mouth (${stolen} stolen)`);
    // A breath lasts a moment, and you need a moment to catch it
    alice.send('inhale');
    await sleep(200);
    const tooSoon = me().inhaling;
    await sleep(1000);
    alice.send('inhale');
    await sleep(200);
    check(!tooSoon && me().inhaling, 'you need a moment to catch your breath between inhales');
    alice.send('exhale');
    await sleep(1100);
    // Head-on, both inhaling each other: both steal at once (gems stream both ways), and neither body is pulled
    alice.send('test:setGems', { count: 50 });
    bob.send('test:setGems', { count: 30 });
    await sleep(200);
    bob.send('test:moveTo', { x: 700 + me().width + 20, y: 1750 + (me().height - bobState().height) / 2 });
    bob.send('test:face', { angle: Math.PI });
    alice.send('test:face', { angle: 0 });
    await sleep(250);
    const aliceStoleBefore = me().stolenTotal;
    const bobStoleBefore = bobState().stolenTotal;
    const aliceAt = me().x;
    const bobAt = bobState().x;
    alice.send('inhale');
    bob.send('inhale');
    await sleep(700);
    const bothStreaming = me().stealingFrom === bob.sessionId && bobState().stealingFrom === alice.sessionId;
    await sleep(800);
    alice.send('exhale');
    bob.send('exhale');
    await sleep(150);
    const aliceTook = me().stolenTotal - aliceStoleBefore;
    const bobTook = bobState().stolenTotal - bobStoleBefore;
    check(bothStreaming && aliceTook >= 4 && bobTook >= 4, `head-on, both steal from each other at once (Alice took ${aliceTook}, Bob took ${bobTook})`);
    check(aliceTook > bobTook, `the bigger thief drains faster: small creatures hold on to gems weakly (Alice ${me().width.toFixed(0)} wide took ${aliceTook}, Bob ${bobState().width.toFixed(0)} wide took ${bobTook})`);
    check(Math.abs(me().x - aliceAt) < 6 && Math.abs(bobState().x - bobAt) < 6 && bobState().state === 'alive', 'and neither body is pulled: no tug-of-war');
    // A small creature can rob a giant: gems stream out, and the giant's body doesn't budge
    await sleep(1100);
    alice.send('test:setGems', { count: 5 });
    bob.send('test:setGems', { count: 300 });
    await sleep(250);
    alice.send('test:moveTo', { x: 700, y: 1750 });
    alice.send('test:face', { angle: 0 });
    await sleep(150);
    bob.send('test:moveTo', { x: 700 + me().width + 10, y: 1750 + (me().height - bobState().height) / 2 });
    await sleep(400);
    const giantFrom = bobState().x;
    const giantHad = bobState().gems;
    alice.send('inhale');
    await sleep(2000);
    alice.send('exhale');
    await sleep(150);
    check(giantHad - bobState().gems >= 2 && Math.abs(bobState().x - giantFrom) < 6, `a small creature can still rob a giant, slowly, and its body doesn't budge (${giantHad - bobState().gems} stolen)`);
    // Take someone's last gem and they're drained: gone until they come back (close enough in size that it
    // never turns into a swallow: drained small enough, it would)
    await sleep(1100);
    alice.send('test:setGems', { count: 1 });
    bob.send('test:setGems', { count: 3 });
    await sleep(250);
    bob.send('test:moveTo', { x: 700 + me().width + 30, y: 1750 + (me().height - bobState().height) / 2 });
    await sleep(250);
    alice.messages.length = 0;
    alice.send('inhale');
    await sleep(1500);
    alice.send('exhale');
    const drainedNote = alice.messages.find((m) => m.type === 'credit' && m.message?.how === 'drained');
    const vanished = alice.messages.some((m) => m.type === 'vanish');
    check(bobState().state !== 'alive' && !!drainedNote && vanished, `steal someone's last gem and they shrink away, out until they come back (${bobState().state})`);
    await waitFor(() => bobState().state === 'alive' && !bobState().spawnProtected, 6000, 'Bob is back');
    await sleep(300);
    // Turning right around takes a moment, and much longer for a giant (mass: slower to start turning, and slower at it)
    const turnAround = async (gems, ms) => {
        alice.send('test:setGems', { count: gems });
        await sleep(200);
        alice.send('test:moveTo', { x: 1500, y: 1200 });
        alice.send('test:face', { angle: 0 });
        await sleep(200);
        alice.send('steer', { x: -1, y: 0 });
        await sleep(ms);
        const facing = me().facing;
        alice.send('steer', { x: 0, y: 0 });
        await sleep(150);
        return Math.abs(Math.atan2(Math.sin(facing - Math.PI), Math.cos(facing - Math.PI)));
    };
    const halfway = await turnAround(0, 300);
    check(halfway > 1, `turning right around takes a moment (${halfway.toFixed(2)} radians still to go after 0.3s)`);
    const newbornOff = await turnAround(0, 900);
    const giantOff = await turnAround(300, 900);
    check(newbornOff < 0.2 && giantOff > 1, `a giant turns much slower than a newborn (after 0.9s, newborn ${newbornOff.toFixed(2)} and giant ${giantOff.toFixed(2)} radians off)`);
    // Inhaling never slows you down
    const stroll = async (inhaling) => {
        alice.send('test:moveTo', { x: 300, y: 1200 });
        await sleep(250);
        const from = me().x;
        if (inhaling) alice.send('inhale');
        alice.send('steer', { x: 1, y: 0 });
        await sleep(1200); // long enough that one tick of timing jitter is only a few percent
        const moved = me().x - from;
        alice.send('steer', { x: 0, y: 0 });
        alice.send('exhale');
        await sleep(1200);
        return moved;
    };
    const plainWalk = await stroll(false);
    const inhaleWalk = await stroll(true);
    check(inhaleWalk > plainWalk * 0.88, `inhaling never slows you down (${Math.round(inhaleWalk)} vs ${Math.round(plainWalk)} units)`);
    // ...and neither does running out of breath partway (a breath lasts 3 seconds)
    alice.send('test:moveTo', { x: 300, y: 1300 });
    await sleep(250);
    alice.send('inhale');
    alice.send('steer', { x: 1, y: 0 });
    await sleep(2600);
    const beforeBreath = me().x;
    await sleep(800);
    const afterBreath = me().x;
    alice.send('steer', { x: 0, y: 0 });
    alice.send('exhale');
    check(!me().inhaling && afterBreath - beforeBreath > plainWalk * 0.55, `running out of breath doesn't change how you move (${Math.round(afterBreath - beforeBreath)} units in 0.8s)`);
    await sleep(1200);
    // Stealing works on the move: walking up to someone while inhaling (no bouncing off them), and
    // chasing someone who runs (while you keep them in reach)
    alice.send('test:setGems', { count: 40 });
    bob.send('test:setGems', { count: 40 });
    await sleep(200);
    alice.send('test:moveTo', { x: 300, y: 900 });
    bob.send('test:moveTo', { x: 600, y: 900 });
    alice.send('test:face', { angle: 0 });
    await sleep(1300);
    const bobBeforeApproach = bobState().gems;
    alice.send('inhale');
    alice.send('steer', { x: 1, y: 0 });
    await sleep(2000);
    alice.send('steer', { x: 0, y: 0 });
    alice.send('exhale');
    check(bobBeforeApproach - bobState().gems >= 4, `walking up to someone while inhaling steals from them (${bobBeforeApproach - bobState().gems} stolen)`);
    await sleep(1300);
    bob.send('test:setGems', { count: 40 });
    await sleep(200);
    alice.send('test:moveTo', { x: 300, y: 1300 });
    bob.send('test:moveTo', { x: 300 + me().width + 60, y: 1300 + (me().height - bobState().height) / 2 });
    alice.send('test:face', { angle: 0 });
    await sleep(1300);
    const bobBeforeChase = bobState().gems;
    alice.send('inhale');
    alice.send('steer', { x: 1, y: 0 });
    bob.send('steer', { x: 1, y: 0 });
    await sleep(2500);
    alice.send('steer', { x: 0, y: 0 });
    bob.send('steer', { x: 0, y: 0 });
    alice.send('exhale');
    check(bobBeforeChase - bobState().gems >= 4, `chasing someone your size keeps stealing while you keep up (${bobBeforeChase - bobState().gems} stolen)`);
    // (In case he was drained: wait for him)
    await waitFor(() => bobState().state === 'alive' && !bobState().spawnProtected, 6000, 'Bob is back');
    bob.send('steer', { x: 0, y: 0 }); // his stop may have arrived while he was swallowed
    await sleep(1300);
    // Getting away is about speed: a newborn caught at the far end of a big creature's inhale outruns it
    alice.send('test:setGems', { count: 100 });
    bob.send('test:setGems', { count: 0 });
    await sleep(200);
    alice.send('test:moveTo', { x: 300, y: 1700 });
    alice.send('test:face', { angle: 0 });
    await sleep(100);
    bob.send('test:moveTo', { x: 300 + me().width + 130, y: 1700 + (me().height - bobState().height) / 2 });
    await sleep(1300);
    const gapToBob = () => bobState().x - (me().x + me().width);
    const escapeFrom = gapToBob();
    alice.send('inhale');
    alice.send('steer', { x: 1, y: 0 });
    bob.send('steer', { x: 1, y: 0 });
    await sleep(2000);
    const escapeTo = gapToBob();
    alice.send('steer', { x: 0, y: 0 });
    bob.send('steer', { x: 0, y: 0 });
    alice.send('exhale');
    check(bobState().state === 'alive' && escapeTo > escapeFrom + 50, `smaller is faster: a newborn caught in a big creature's inhale outruns it (gap ${Math.round(escapeFrom)} to ${Math.round(escapeTo)})`);
    await sleep(1300);

    // Walking into each other, both just stop: nobody bounces
    alice.send('test:setGems', { count: 10 });
    bob.send('test:setGems', { count: 10 });
    await sleep(200);
    alice.send('test:moveTo', { x: 600, y: 400 });
    bob.send('test:moveTo', { x: 600 + me().width + 60, y: 400 + (me().height - bobState().height) / 2 });
    await sleep(250);
    alice.send('steer', { x: 1, y: 0 });
    bob.send('steer', { x: -1, y: 0 });
    await sleep(600);
    alice.send('steer', { x: 0, y: 0 });
    bob.send('steer', { x: 0, y: 0 });
    await sleep(150);
    const metAt = { alice: me().x, bob: bobState().x };
    const headOnGap = bobState().x - (me().x + me().width);
    await sleep(500);
    check(headOnGap >= -2 && headOnGap <= 8 && Math.abs(me().x - metAt.alice) < 3 && Math.abs(bobState().x - metAt.bob) < 3, `walking into each other, both just stop: nobody bounces (gap ${Math.round(headOnGap)})`);
    await waitFor(() => bobState().state === 'alive' && !bobState().spawnProtected, 6000, 'Bob is back');

    // The 3-gem rule: with fewer than 3 gems, any hit knocks you out
    alice.send('test:setGems', { count: 2 });
    await sleep(150);
    alice.send('test:hit');
    await waitFor(() => me().state !== 'alive', 1000, 'with fewer than 3 gems, a hit knocks you out');
    await waitFor(() => me().state === 'alive', 4000, 'Alice is back');
    alice.send('test:setGems', { count: 3 });
    await sleep(150);
    alice.send('test:hit');
    await sleep(200);
    check(me().state === 'alive' && me().recovering, 'with 3, you survive the hit');
    await waitFor(() => !me().recovering, 2000, 'Alice recovers');
    let nearby = bobState().gems;
    state().gems.forEach((gem) => {
        if (Math.hypot(gem.x - me().x, gem.y - me().y) < 350) nearby += gem.value;
    });
    check(nearby >= 2, `and they burst out for the taking (${nearby} nearby)`);
    // Someone who just arrived is solid too
    bob.send('test:protect', { ms: 3000 });
    const shielded = await walkInto(alice, bob, 0, 0);
    bob.send('test:protect', { ms: 0 });
    check(shielded.wallMoved <= 2 && shielded.gap >= -2, `someone who just arrived is solid too (they moved ${shielded.wallMoved}, gap ${shielded.gap})`);

    // Traffic hits follow the shapes on screen and count along the whole path of a hop. All
    // traffic but one standing block is parked in a far corner, so only that block can hit Alice.
    alice.send('test:parkTraffic');
    alice.send('test:moveTo', { x: 1000, y: 1000 });
    alice.send('test:trafficHits', { on: true });
    // Keep the arena shift well away (during a shift's grace nobody can be hurt), however long the checks before took
    alice.send('test:shift', { phase: 'normal', msLeft: 120000 });
    await waitFor(() => !me().recovering && !me().spawnProtected, 3000, 'traffic is parked and Alice is ready');
    /** Stand the block where `place(half)` says (from Alice's center; half = half her width), maybe hop, and report a hit */
    async function struck(place, hopDirection) {
        alice.send('test:setGems', { count: 3 });
        await sleep(120);
        alice.send('test:placeObstacle', place(me().width / 2));
        if (hopDirection) alice.send('steer', { x: hopDirection === 'right' ? 1 : -1, y: 0 });
        await sleep(250);
        if (hopDirection) alice.send('steer', { x: 0, y: 0 });
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
    check(await struck((h) => ({ dx: h + 3, dy: -30, width: 11, height: 60, variant: 0 }), 'right'), 'walking into a thin block is a hit');
    /** Stand a ball where `place(half)` says (from Alice's center), and report whether it hits her */
    async function ballStruck(place) {
        alice.send('test:setGems', { count: 3 });
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
    alice.send('test:setGems', { count: 3 });
    await sleep(120);
    alice.send('test:placeComet', { dx: me().width / 2 + 12, dy: 0 });
    await sleep(250);
    check(me().recovering || me().state !== 'alive', 'a comet hits you too');
    alice.send('test:placeComet', { dx: 0, dy: -900 });
    await waitFor(() => me().state === 'alive' && !me().recovering && !me().sliding, 4000, 'Alice is steady');
    alice.send('test:moveTo', { x: 1000, y: 1000 });
    await sleep(120);
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
    const shiftTile = state().worldWidth / 10; // the shift draws its floor on a 10x10 grid
    const tileCenter = (i) => ({ x: (i % 10) * shiftTile + shiftTile / 2, y: Math.floor(i / 10) * shiftTile + shiftTile / 2 });
    const centerOf = (p) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
    const onFloor = (p) => {
        const floor = state().floor;
        if (!floor) return true;
        const c = centerOf(p);
        return floor[Math.min(9, Math.floor(c.y / shiftTile)) * 10 + Math.min(9, Math.floor(c.x / shiftTile))] === '1';
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
    const tileRight = ((edge % 10) + 1) * shiftTile;
    const rowMiddle = Math.floor(edge / 10) * shiftTile + shiftTile / 2;
    alice.send('test:moveTo', { x: tileRight - me().width - 4, y: rowMiddle - me().height / 2 });
    bob.send('test:moveTo', { x: tileRight - me().width - 4 - bobState().width - 20, y: rowMiddle - bobState().height / 2 });
    await sleep(250);
    bob.messages.length = 0;
    const aliceAtEdge = me().x;
    bob.send('steer', { x: 1, y: 0 });
    await sleep(700);
    bob.send('steer', { x: 0, y: 0 });
    await sleep(300);
    check(me().state === 'alive' && onFloor(me()) && Math.abs(me().x - aliceAtEdge) < 3 && !bob.messages.some((m) => m.type === 'credit'), `nobody can be rammed off the edge: bodies are solid (Alice moved ${Math.round(me().x - aliceAtEdge)} units)`);

    await waitFor(() => !me().recovering && !me().sliding, 2000, 'Alice is steady');

    // (Both newborn-sized, so both fit on the jackpot at once: bodies are solid)
    alice.send('test:setGems', { count: 0 });
    await sleep(150);
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
    // Renaming yourself (from the drawer) shows up for everyone, cleaned up
    alice.send('updateName', { name: '  Alicia <3  ' });
    await waitFor(() => me()?.name === 'Alicia 3', 1500, 'renaming yourself shows up for everyone');
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
    await waitFor(() => dave.state.players.size === 11 && botsIn(dave).length === 10, 2000, 'bots fill a quiet world up to eleven players');
    const names = botsIn(dave).map((bot) => bot.name);
    check(new Set(names).size === 10, `each with its own name (${names.join(', ')})`);
    const botStarts = botsIn(dave).map((bot) => ({ bot, x: bot.x, y: bot.y }));
    await sleep(2500);
    const wandered = botStarts.filter(({ bot, x, y }) => Math.hypot(bot.x - x, bot.y - y) > 50).length;
    check(wandered >= 6, `bots move around on their own (${wandered} of 10)`);
    const erin = await join('Erin');
    await waitFor(() => dave.state.players.size === 11 && botsIn(dave).length === 9, 2000, 'a bot makes room when a person joins');
    await erin.leave();
    await waitFor(() => botsIn(dave).length === 10, 2000, 'and another fills in when they leave');
    await dave.leave();

    // Turbines, in a world of their own (placed by hand)
    const tia = await new Client(URL).create('game_room', { name: 'Tia', testBots: 0, testFieldGems: 0, testCalm: true, testTurbines: 'manual' });
    const tom = await new Client(URL).joinById(tia.roomId, { name: 'Tom' });
    for (const turbineRoom of [tia, tom]) turbineRoom.onMessage('*', () => {});
    await sleep(1800);
    const ts = () => tia.state;
    const tiaState = () => ts().players.get(tia.sessionId);
    const tomState = () => ts().players.get(tom.sessionId);
    const placeAt = (turbineRoom, who, cx, cy) => turbineRoom.send('test:moveTo', { x: cx - who().width / 2, y: cy - who().height / 2 });
    // At (2000, 2000), the intake facing right (its mouth at 2060); for these checks the exhaust holds straight back (left)
    tia.send('test:placeTurbine', { x: 2000, y: 2000, intake: 0, still: true });
    placeAt(tom, tomState, 3400, 3400);
    tia.send('test:setGems', { count: 40 });
    await sleep(250);
    check(ts().turbines.length === 1 && ts().turbines[0].phase === 'active', 'a turbine stands in the world');
    const intakeWas = ts().turbines[0].intake;
    const seenFlights = new Set();
    let fromTia = 0;
    const watching = setInterval(() => {
        ts().flights.forEach((flight, id) => {
            if (seenFlights.has(id)) return;
            seenFlights.add(id);
            if (flight.victim === tia.sessionId) fromTia++;
        });
    }, 30);
    placeAt(tia, tiaState, 2060 + 40 + tiaState().width / 2, 2000);
    await sleep(1500);
    placeAt(tia, tiaState, 600, 600);
    await sleep(150);
    const ripped = 40 - tiaState().gems;
    check(ripped >= 4, `its intake rips gems out of anyone up close (${ripped} in 1.5s)`);
    check(fromTia >= ripped - 1, `each one visibly flies from that player into the turbine, the same for everyone (${fromTia} flights from Tia)`);
    await sleep(2600);
    clearInterval(watching);
    const fired = [];
    ts().gems.forEach((gem) => {
        if (gem.launchAt > 0) fired.push(gem);
    });
    const reach = fired.map((gem) => Math.round(Math.hypot(gem.x - 2000, gem.y - 2000)));
    check(fired.length >= ripped - 1 && fired.every((gem) => gem.x < 2000), `every one fires out of the exhaust, on the far side (${fired.length} fired)`);
    check(reach.length > 0 && reach.every((d) => d > 420 && d < 820), `and lands 400-700 units away (${reach.join(', ')} from the middle)`);
    check(ts().turbines[0].intake === intakeWas, 'the intake never turns');
    const prize = fired[0];
    if (prize) placeAt(tom, tomState, prize.x, prize.y);
    await sleep(400);
    check(tomState().gems >= 1, "the gems it fires are ordinary gems anyone can grab");
    const gemsBefore = new Set([...ts().gems.keys()]);
    tia.send('test:placeGem', { dx: 2400 - (tiaState().x + tiaState().width / 2), dy: 2000 - (tiaState().y + tiaState().height / 2) });
    await sleep(300);
    const loose = [...ts().gems.keys()].find((id) => !gemsBefore.has(id));
    await waitFor(() => loose && !ts().gems.has(loose), 3000, 'loose gems in front of the intake get sucked in');
    const windPush = async (gems) => {
        tom.send('test:setGems', { count: gems });
        await sleep(200);
        placeAt(tom, tomState, 1940 - 90 - tomState().width / 2, 2000);
        await sleep(150);
        const turbineFrom = tomState().x;
        await sleep(400);
        return turbineFrom - tomState().x;
    };
    const smallPush = await windPush(0);
    const bigPush = await windPush(400);
    check(smallPush > 40 && smallPush > bigPush * 1.8, `the exhaust's wind pushes small creatures much harder than giants (${Math.round(smallPush)} vs ${Math.round(bigPush)} units)`);
    await tia.leave();
    await tom.leave();

    // On their own: three turbines appear (with a warning first), spread out and away from the edge, and move on
    const ann = await new Client(URL).create('game_room', { name: 'Ann', testBots: 0, testFieldGems: 0, testCalm: true, testTurbines: true });
    ann.onMessage('*', () => {});
    let warned = false;
    const phases = setInterval(() => ann.state.turbines?.forEach((turbine) => {
        if (turbine.phase === 'warning') warned = true;
    }), 50);
    await waitFor(() => ann.state.turbines?.length === 3, 8000, 'three turbines appear around the world');
    const spots = () => ann.state.turbines.map((turbine) => ({ x: turbine.x, y: turbine.y }));
    const first = spots();
    const turbineApart = first.every((a, turbineI) => first.every((b, j) => turbineI === j || Math.hypot(a.x - b.x, a.y - b.y) >= 1300));
    const turbineInside = first.every((t) => t.x >= 600 && t.y >= 600 && t.x <= ann.state.worldWidth - 600 && t.y <= ann.state.worldHeight - 600);
    check(warned, 'a new turbine warns before it switches on');
    check(turbineApart && turbineInside, `they're spread out and away from the edge (${first.map((t) => `${t.x},${t.y}`).join('  ')})`);
    for (let turbineI = 0; turbineI < 3; turbineI++) {
        ann.send('test:endTurbines');
        await sleep(200);
    }
    await waitFor(() => ann.state.turbines.length === 0, 3000, 'turbines power down and go');
    await waitFor(() => ann.state.turbines.length === 3, 9000, 'and come back');
    const second = spots();
    check(second.every((s) => first.every((f) => Math.hypot(s.x - f.x, s.y - f.y) > 50)), 'somewhere else');
    clearInterval(phases);
    await ann.leave();
} catch (error) {
    check(false, `unexpected error: ${error.message}`);
} finally {
    server.kill('SIGTERM');
}

console.log(failures ? `\n${failures} check(s) failed` : '\nAll multiplayer checks passed');
process.exit(failures ? 1 : 0);
