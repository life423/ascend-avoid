// Test real human message paths against an isolated server with headless-only trial constants.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { writeFileSync } from 'node:fs';
import { Client } from 'colyseus.js';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(condition, message, timeout = 3000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (condition()) return; await sleep(20); }
  assert.fail(message);
}
async function freePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
const results = [];
for (const delay of [750, 1000, 2000]) {
  const port = await freePort();
  const code = `const {CANNON}=require('./server/dist/constants/gameConstants.js'); CANNON.PEER_HIT_SHARE=.33; CANNON.CAPTURE_FIRE_DELAY_MS=${delay}; require('./server/dist/index.js');`;
  const server = spawn(process.execPath, ['-e', code], {
    env: { ...process.env, NODE_ENV:'test', PORT:String(port) },
    windowsHide:true, stdio:['ignore','ignore','pipe'],
  });
  let serverErrors = '';
  server.stderr.on('data', chunk => { serverErrors += chunk; });
  try {
    let healthy = false;
    for (let i = 0; i < 60; i++) {
      assert.equal(server.exitCode, null, serverErrors);
      try { healthy = (await fetch(`http://127.0.0.1:${port}/health`)).ok; } catch { /* starting */ }
      if (healthy) break;
      await sleep(100);
    }
    assert(healthy, 'isolated server starts');
    for (const lateAction of ['tap','inhale']) {
      const rooms = [], client = new Client(`ws://127.0.0.1:${port}`);
      const player = room => room.state.players.get(room.sessionId);
      try {
        const owner = await client.create('game_room', {
          name:'Owner', testBots:0, testCores:0, testFieldGems:0, testCalm:true,
        });
        rooms.push(owner); owner.onMessage('*', () => {});
        const ammo = await client.joinById(owner.roomId, {name:'Ammo'}); rooms.push(ammo); ammo.onMessage('*', () => {});
        const target = await client.joinById(owner.roomId, {name:'Target'}); rooms.push(target); target.onMessage('*', () => {});
        for (const room of rooms) {
          await until(() => player(room), 'player state arrives');
          room.send('test:setGems', {count:room === ammo ? 32 : 100});
          room.send('test:protect', {ms:0});
        }
        await until(() => player(owner).gems === 100 && player(ammo).gems === 32 && player(target).gems === 100, 'sizes set');
        const width = player(owner).width, ammoWidth = player(ammo).width;
        owner.send('test:moveTo', {x:1000,y:1500}); owner.send('test:face', {angle:0});
        ammo.send('test:moveTo', {x:1000+width*.8+1-ammoWidth/2,y:1500+(width-ammoWidth)/2});
        target.send('test:moveTo', {x:1000+width+350,y:1500});
        await sleep(100); owner.send('inhale');
        await until(() => player(ammo).capturedBy === owner.sessionId, 'ordinary inhale captures ammo');
        const observedCaptureAt = Date.now();
        owner.send('exhale'); owner.send('tap');
        await sleep(80);
        assert.equal(player(ammo).capturedBy, owner.sessionId, 'early tap retains captive');
        owner.send('inhale');
        await sleep(80);
        assert.equal(player(ammo).capturedBy, owner.sessionId, 'early inhale message cannot bypass delay');
        await sleep(Math.max(0, observedCaptureAt + delay + 150 - Date.now()));
        assert.equal(player(ammo).capturedBy, owner.sessionId, 'an early press never queues a delayed automatic shot');
        owner.send(lateAction);
        await until(() => player(ammo).capturedBy === '', 'fresh action launches ready ammo');
        await until(() => player(target).gems === 67, 'actual network impact removes 33% at equal width');
        results.push({delayMs:delay,lateAction,earlyTapBlocked:true,earlyInhaleBlocked:true,
          noAutomaticShot:true,lateActionFired:true,targetBefore:100,targetAfter:67});
      } finally {
        await Promise.allSettled(rooms.filter(room => room.connection.isOpen).map(room => room.leave()));
      }
    }
  } finally {
    server.kill();
    await new Promise(resolve => { if (server.exitCode !== null) resolve(); else server.once('exit', resolve); });
  }
}
writeFileSync('reports/combat/capture-fire-delay-network.json',JSON.stringify({results},null,2));
console.log(`Capture-fire delay: ${results.length} human network cases passed with 33% damage.`);
