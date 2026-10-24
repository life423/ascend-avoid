// Measures how often captives really escape before being swallowed, instead of assuming it: real
// captures on a real server, the captor holding and re-aiming straight at its captive the whole time
// (the strongest play), the captive reacting after a delay (200 ms like a quick desktop player, 350 ms
// like a phone) and then freezing, pushing straight out, or slipping sideways round the mouth.
// Run with: npm run measure:escape
import { spawn } from 'node:child_process';
import { Client } from 'colyseus.js';

const PORT = Number(process.env.MEASURE_PORT || 3175);
const URL = `ws://localhost:${PORT}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const mine = (room) => room.state.players.get(room.sessionId);
const middle = (p) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });

const server = spawn(process.execPath, ['server/dist/index.js'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test' },
  stdio: ['ignore', 'ignore', 'inherit'],
});

async function trial(captor, captive, captorGems, captiveGems, reactMs, plan) {
  captor.send('exhale');
  captive.send('steer', { x: 0, y: 0 });
  for (let i = 0; i < 80 && mine(captive).state !== 'alive'; i++) await sleep(50);
  captor.send('test:setGems', { count: captorGems });
  captive.send('test:setGems', { count: captiveGems });
  captor.send('test:breath', { stamina: 1 });
  await sleep(1700); // immunity from the last trial runs out
  const lineY = 2600;
  captor.send('test:moveTo', { x: 900, y: lineY - mine(captor).width / 2 });
  captor.send('test:face', { angle: 0 });
  await sleep(200);
  captive.send('test:moveTo', { x: 900 + mine(captor).width + 4, y: lineY - mine(captive).width / 2 });
  await sleep(200);
  captor.send('inhale');
  let caughtAt = 0;
  for (let i = 0; i < 80 && !caughtAt; i++) {
    if (mine(captive).capturedBy === captor.sessionId) caughtAt = Date.now();
    else await sleep(10);
  }
  if (!caughtAt) return { outcome: 'not caught', ms: 0 };
  let reacting = false;
  const reaction = setTimeout(() => { reacting = true; }, reactMs);
  const play = setInterval(() => {
    const c = mine(captor);
    const v = mine(captive);
    if (!c || !v) return;
    const a = middle(c);
    const b = middle(v);
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const ax = (b.x - a.x) / d;
    const ay = (b.y - a.y) / d;
    captor.send('aim', { x: ax, y: ay }); // the captor keeps its mouth on its captive
    if (!reacting || plan === 'freeze') return;
    let sx = ax;
    let sy = ay;
    if (plan === 'slip') {
      sx = -ay * 0.9 + ax * 0.45;
      sy = ax * 0.9 + ay * 0.45;
      const n = Math.hypot(sx, sy);
      sx /= n;
      sy /= n;
    }
    captive.send('steer', { x: sx, y: sy });
  }, 40);
  let outcome = 'still held';
  while (Date.now() - caughtAt < 2200) {
    const v = mine(captive);
    if (!v || v.state !== 'alive') { outcome = 'swallowed'; break; }
    if (!v.capturedBy) { outcome = Date.now() - caughtAt >= 1200 ? 'timed out' : 'escaped'; break; }
    await sleep(10);
  }
  const ms = Date.now() - caughtAt;
  clearTimeout(reaction);
  clearInterval(play);
  captor.send('exhale');
  captive.send('steer', { x: 0, y: 0 });
  return { outcome, ms };
}

try {
  for (let i = 0; i < 50; i++) {
    try {
      if ((await fetch(`http://localhost:${PORT}/health`)).ok) break;
    } catch {
      await sleep(200);
    }
  }
  const captor = await new Client(URL).joinOrCreate('game_room', { name: 'Captor', testCalm: true });
  const captive = await new Client(URL).joinOrCreate('game_room', { name: 'Captive', testCalm: true });
  await sleep(600);
  const rows = [];
  for (const captorGems of [30, 100, 400]) {
    for (const reactMs of [200, 350]) {
      for (const plan of ['freeze', 'push', 'slip']) {
        const { outcome, ms } = await trial(captor, captive, captorGems, 4, reactMs, plan);
        rows.push({ captorGems, reactMs, plan, outcome, ms });
        console.log(`captor ${String(captorGems).padStart(3)} gems vs captive 4 | reacts ${reactMs} ms | ${plan.padEnd(6)} | ${outcome.padEnd(10)} after ${ms} ms`);
      }
    }
  }
  const survived = (r) => r.outcome === 'escaped' || r.outcome === 'timed out';
  for (const plan of ['freeze', 'push', 'slip']) {
    const ofPlan = rows.filter((r) => r.plan === plan);
    console.log(`${plan}: survived ${ofPlan.filter(survived).length} of ${ofPlan.length} (escaped ${ofPlan.filter((r) => r.outcome === 'escaped').length})`);
  }
  await captor.leave();
  await captive.leave();
} finally {
  server.kill('SIGTERM');
}
