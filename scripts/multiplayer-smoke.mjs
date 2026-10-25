// Current gameplay rules, tested in fresh rooms so one scenario cannot contaminate another.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { test, after } from 'node:test';
import { Client } from 'colyseus.js';

const port = Number(process.env.SMOKE_PORT || 3170);
const url = `ws://localhost:${port}`;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const me = room => room.state.players.get(room.sessionId);
const server = spawn(process.execPath, ['server/dist/index.js'], {
  env: { ...process.env, NODE_ENV: 'test', PORT: String(port) }, stdio: ['ignore', 'ignore', 'inherit'],
});
after(() => server.kill());
async function until(condition, message, timeout = 2500) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (condition()) return; await sleep(25); }
  assert.fail(message);
}
let healthy = false;
for (let i = 0; i < 60; i++) {
  if (server.exitCode !== null) throw new Error('test server exited before becoming ready');
  try { if ((await fetch(`http://localhost:${port}/health`)).ok) { healthy = true; break; } } catch { /* starting */ }
  await sleep(100);
}
assert(healthy, 'test server becomes healthy');

async function scenario(name, run, options = {}) {
  await test(name, { timeout: 15000 }, async t => {
    const rooms = [];
    const connect = async (roomId, name) => {
      const client = new Client(url);
      const room = roomId ? await client.joinById(roomId, { name }) : await client.create('game_room', {
        name, testBots: 0, testCores: 0, testFieldGems: 0, testCalm: true, ...options,
      });
      room.messages = [];
      room.onMessage('*', (type, data) => room.messages.push({ type, data }));
      rooms.push(room);
      await until(() => me(room), 'player state arrives');
      return room;
    };
    t.after(async () => { await Promise.allSettled(rooms.filter(room => room.connection.isOpen).map(room => room.leave())); });
    const room = await connect(null, 'Alice');
    await run(room, name => connect(room.roomId, name));
  });
}
async function capture(captor, join) {
  const kid = await join('Kid');
  captor.send('test:setGems', { count: 16 });
  kid.send('test:setGems', { count: 4 });
  await until(() => me(captor).gems === 16 && me(kid).gems === 4, 'sizes set');
  captor.send('test:moveTo', { x: 800, y: 1000 });
  captor.send('test:face', { angle: 0 });
  kid.send('test:moveTo', { x: 860, y: 1012.75 });
  kid.send('test:protect', { ms: 0 });
  await sleep(150);
  captor.send('inhale');
  await until(() => me(kid).capturedBy === captor.sessionId, 'inhale captures the kid');
  return kid;
}

scenario('instant join, safe spawn, shared names, whole arena and dormant hazards', async (a, join) => {
  assert.equal(me(a).state, 'alive');
  assert.equal(me(a).width, 20);
  assert(me(a).spawnProtected);
  assert.equal(a.state.worldWidth, 4200);
  assert.equal(a.state.shiftsOn, false);
  assert.equal(a.state.trafficWave, 'calm');
  const b = await join('<Bob>');
  await until(() => a.state.players.get(b.sessionId)?.name === 'Bob', 'sanitized name reaches peers');
  b.send('updateName', { name: 'New Bob' });
  await until(() => a.state.players.get(b.sessionId)?.name === 'New Bob', 'renaming reaches peers');
});
scenario('steering is normalized; cancel stops movement and inhaling', async a => {
  a.send('test:moveTo', { x: 1500, y: 1500 });
  await sleep(100);
  const x = me(a).x;
  a.send('steer', { x: 10000, y: 0 });
  a.send('inhale');
  await sleep(450);
  assert(me(a).x > x + 90 && me(a).x < x + 160);
  assert.equal(me(a).spawnProtected, false);
  a.send('cancel');
  await until(() => !me(a).inhaling, 'cancel releases inhale');
  await sleep(300);
  const stopped = me(a).x;
  await sleep(250);
  assert(Math.abs(me(a).x - stopped) < 5);
});
scenario('gems grow the player; hits spill half; knockout respawns alive', async a => {
  a.send('test:placeGem', { dx: 0, dy: 0 });
  await until(() => me(a).gems === 1, 'nearby gem collected');
  assert(me(a).width > 20);
  a.send('test:setGems', { count: 20 });
  await until(() => me(a).gems === 20, 'gems assigned');
  a.send('test:hit');
  await until(() => me(a).gems === 10 && me(a).recovering, 'half spilled');
  assert(a.state.gems.size > 0);
  a.send('test:setGems', { count: 0 });
  await sleep(80);
  a.send('test:hit');
  await until(() => me(a).state === 'dead', 'empty player knocked out');
  await until(() => me(a).state === 'alive' && me(a).spawnProtected, 'respawn protected', 3000);
});
scenario('healthy gems are safe; injury theft finishes a player and credits the knockout', async (a, join) => {
  const credits = []; a.onMessage('credit', data => credits.push(data));
  const b = await join('Victim');
  a.send('test:setGems', { count: 0 });
  b.send('test:setGems', { count: 2 });
  await sleep(100);
  a.send('test:moveTo', { x: 800, y: 1000 });
  a.send('test:face', { angle: 0 });
  b.send('test:moveTo', { x: 840, y: 1000 });
  b.send('test:protect', { ms: 0 });
  a.send('test:protect', { ms: 3000 });
  await sleep(100);
  a.send('inhale');
  await until(() => !me(a).spawnProtected, 'offense ends protection');
  await sleep(350); assert.equal(me(b).gems, 2, 'healthy victim keeps its gems');
  b.send('test:injure');
  await until(() => me(b).injuredUntil > b.state.time, 'injury syncs');
  await until(() => me(b).state === 'dead', 'injured victim drained completely', 4000);
  assert.equal(me(b).gems, 0);
  await until(() => credits.some(e => e.how === 'drain' && e.byId === a.sessionId && e.targetId === b.sessionId && e.out), 'last thief gets knockout credit');
  await until(() => me(b).state === 'alive' && me(b).spawnProtected, 'drained victim respawns protected', 3000);
  assert.equal(me(b).injuredUntil, 0);
});
scenario('quick keyboard escape presses work; releasing inhale keeps the capture', async (a, join) => {
  const kid = await capture(a, join);
  a.send('exhale');
  await sleep(100);
  assert.equal(me(kid).capturedBy, a.sessionId);
  assert.equal(me(kid).flying, false);
  await until(() => kid.state.time >= me(kid).dazedUntil, 'capture daze ends');
  const keys = me(kid).escapeKeys;
  assert.equal(keys.length, 3);
  for (const key of keys) { kid.send('escape', { key }); await sleep(90); }
  await until(() => !me(kid).capturedBy, 'explicit key presses free the captive');
  assert.equal(me(a).gulping, '');
  assert.equal(me(kid).state, 'alive');
});
scenario('a real gust stuns a non-inhaling target and the target recovers', async (a, join) => {
  const target = await join('Gust target');
  a.send('test:moveTo', { x: 1000, y: 1000 });
  a.send('test:face', { angle: 0 });
  target.send('test:moveTo', { x: 1100, y: 1000 });
  target.send('test:protect', { ms: 0 });
  await sleep(100);
  a.send('tap');
  await until(() => me(target).stunned, 'the gust stuns the target');
  target.send('test:moveTo', { x: 1300, y: 1000 });
  target.send('steer', { x: 0, y: 1 });
  target.send('inhale');
  await sleep(150);
  assert.equal(me(target).inhaling, false);
  assert(Math.abs(me(target).y - 1000) < 1, 'movement inputs cannot override a gust stun');
  await until(() => !me(target).stunned, 'stun ends');
  await until(() => me(target).y > 1010, 'steering works again');
});
scenario('a small missile burns up after missing and respawns protected', async (a, join) => {
  const kid = await capture(a, join);
  a.send('tap');
  await until(() => me(kid).flying, 'queued shot launches', 3500);
  await until(() => me(kid).state === 'dead' && !me(kid).flying, 'small missed shot burns up', 4500);
  assert(a.messages.some(m => m.type === 'credit' && m.data.how === 'burnup' && m.data.targetId === kid.sessionId && m.data.byId === a.sessionId));
  await until(() => me(kid).state === 'alive' && me(kid).spawnProtected, 'burned missile respawns protected', 3000);
});
scenario('an armed shot emits launch, impact and shooter/projectile attribution', async (a, join) => {
  const kid = await capture(a, join);
  const target = await join('Target');
  target.send('test:setGems', { count: 100 });
  await sleep(100);
  target.send('test:moveTo', { x: 1270, y: 984.25 });
  target.send('test:protect', { ms: 0 });
  a.send('tap');
  await sleep(100);
  assert.equal(me(kid).flying, false, 'a premature tap does not fire');
  kid.send('steer', { x: 0, y: 1 });
  await sleep(2800);
  a.send('tap');
  await until(() => a.messages.some(m => m.type === 'launch'), 'shot launched');
  await until(() => me(target).gems < 100, 'shot hits the target despite the captive holding sideways');
  await until(() => a.messages.some(m => m.type === 'impact' && m.data.projectileId === kid.sessionId), 'impact event arrives');
  assert(a.messages.some(m => m.type === 'credit' && m.data.how === 'cannon' && m.data.byId === a.sessionId));
  await until(() => me(kid).state === 'dead' && !me(kid).flying, 'spent missile is knocked out over the network');
  await until(() => me(kid).state === 'alive' && me(kid).spawnProtected, 'spent missile respawns protected', 3000);
  target.send('test:moveTo', { x: 2500, y: 2500 });
  a.send('test:breath', { stamina: 1 });
  a.send('test:moveTo', { x: 800, y: 1000 });
  a.send('test:face', { angle: 0 });
  kid.send('test:moveTo', { x: 860, y: 1012.75 });
  await sleep(100);
  a.send('inhale');
  await sleep(300);
  assert.equal(me(kid).capturedBy, '', 'the original captor cannot immediately reuse the same bullet');
  assert(Math.abs(me(kid).x - 860) < 2, 'landing protection prevents suction as well as capture');
});
scenario('a captor disconnecting releases the captive', async (a, join) => {
  const kid = await capture(a, join);
  await a.leave();
  await until(() => !me(kid).capturedBy, 'orphaned captive freed');
  assert.equal(me(kid).state, 'alive');
});
scenario('bots fill to the configured population and make room for humans', async (a, join) => {
  const bots = () => [...a.state.players.values()].filter(p => p.isBot);
  await until(() => a.state.players.size === 20, '20 total players');
  assert.equal(bots().length, 19);
  assert.equal(new Set(bots().map(p => p.name)).size, 19);
  const b = await join('Human');
  await until(() => bots().length === 18 && a.state.players.size === 20, 'bot makes room');
  await b.leave();
  await until(() => bots().length === 19, 'bot returns');
}, { testBots: undefined });
scenario('surges announce a location and then drop bonus gems', async a => {
  a.send('test:surge', {});
  await until(() => a.state.surgePhase === 'warning', 'warning synced');
  assert(a.state.surgeX > 0 && a.state.surgeY > 0);
  a.send('test:surge', { active: true });
  await until(() => a.state.surgePhase === 'active' && a.state.gems.size >= 10, 'active shower synced');
  assert(a.messages.some(m => m.type === 'surge' && m.data.phase === 'active'));
});
scenario('experimental traffic, bombs and shift geometry still activate explicitly', async a => {
  assert.equal(a.state.trafficWave, 'wave');
  await until(() => [...a.state.obstacles].some(o => o.vx || o.vy), 'lane traffic enters on a simulation tick');
  assert.equal(a.state.bombs.length, 6);
  a.send('test:shift', { phase: 'grace', msLeft: 5000 });
  await until(() => a.state.shiftPhase === 'grace' && a.state.floor.length === 100, 'experimental floor shown');
}, { testTraffic: 'always', testBombs: true, testShifts: true });
scenario('message floods are disconnected', async a => {
  let code = null;
  a.onLeave(value => { code = value; });
  for (let i = 0; i < 3000; i++) a.send('steer', { x: i % 2 ? 1 : -1, y: 0 });
  await until(() => code !== null, 'flood disconnected');
  assert.equal(code, 4002);
});
