import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local server only');

async function scene(page, baseURL) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    if (message.text().includes('gustHit') && /not registered|no.*handler/i.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !window.game.currentGameMode.introPlaying && !document.body.classList.contains('intro-playing'));
  const id = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(id, { name: 'Chaser' });
  peer.onMessage('*', () => {});
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  await send('test:setGems', { count: 100 });
  peer.send('test:setGems', { count: 100 });
  await expect.poll(() => peer.state.players?.get(peer.sessionId)?.gems).toBe(100);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 100);
  const width = peer.state.players.get(peer.sessionId).width;
  await send('test:moveTo', { x: 2100, y: 2100 });
  await send('test:face', { angle: 0 });
  await send('test:protect', { ms: 0 });
  peer.send('test:moveTo', { x: 2100 - width - 80, y: 2100 });
  peer.send('test:face', { angle: 0 });
  peer.send('test:protect', { ms: 0 });
  await page.waitForFunction(() => {
    const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
    return !p.spawnProtected && Math.abs(p.x - 2100) < 1 && Math.abs(m.predicted.x - 2100) < 2;
  });
  return { peer, send, errors };
}

const read = page => page.evaluate(() => {
  const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
  const w = m.multiplayerManager.room.state.gustWaves.get(p.sessionId);
  return { x: p.x, y: p.y, facing: p.facing, stunned: p.stunned, sliding: p.sliding, injury: p.injuredUntil, gems: p.gems,
    wave: w ? { x: w.x, y: w.y, age: m.multiplayerManager.room.state.time - w.at } : null,
    squash: m.contactShapes.get(p.sessionId)?.amount ?? 0 };
});

test('the 140-degree rear arc reaches an off-axis pursuer without cancelling inhale', async ({ page, baseURL, hasTouch, browserName }) => {
  const { peer, send, errors } = await scene(page, baseURL);
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    await send('test:setGems', { count: 100000 }); peer.send('test:setGems', { count: 0 });
    // A giant's normal upkeep can spend gems before the next state patch arrives.
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().width > 600);
    await expect.poll(() => peer.state.players.get(peer.sessionId).gems).toBe(0);
    const size = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().width);
    const radius = Math.max(42, size / 2 + Math.min(40, 12 + size * .1)), angle = Math.PI + 65 * Math.PI / 180;
    await send('test:moveTo', { x: 2100 - size / 2, y: 2100 - size / 2 });
    peer.send('test:moveTo', { x: 2100 + Math.cos(angle) * radius - 10, y: 2100 + Math.sin(angle) * radius - 10 });
    peer.send('test:face', { angle: angle + Math.PI }); peer.send('inhale');
    await expect.poll(() => peer.state.players.get(peer.sessionId).inhaling).toBe(true);
    await input.tap();
    await expect.poll(() => peer.state.players.get(peer.sessionId).gustVx, { intervals: [20, 30] }).toBeLessThan(-20);
    expect(peer.state.players.get(peer.sessionId).inhaling).toBe(true);
    expect(peer.state.players.get(peer.sessionId).stunned).toBe(false);
    expect(Math.abs(peer.state.players.get(peer.sessionId).gustVx)).toBeLessThanOrEqual(280);
    await page.screenshot({ path: test.info().outputPath('140-degree-off-axis-gust.png'), scale: 'css' });
    expect(errors).toEqual([]);
  } finally { await input.close(); await peer.leave(); }
});

test('a forward puff wraps behind and shoves once without a stun or barrier', async ({ page, baseURL, hasTouch, browserName }) => {
  const { peer, errors } = await scene(page, baseURL);
  let cdp;
  const points = new Map();
  const touch = async (type, id, x, y) => {
    const released = points.get(id);
    if (type === 'touchEnd') points.delete(id);
    else points.set(id, { id, x, y, radiusX: 8, radiusY: 8 });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' && released ? [released] : [...points.values()] });
  };
  try {
    peer.send('inhale');
    await expect.poll(() => peer.state.players.get(peer.sessionId).inhaling).toBe(true);
    const before = await read(page), { width, height } = page.viewportSize();
    if (hasTouch && browserName === 'chromium') {
      cdp = await page.context().newCDPSession(page);
      await touch('touchStart', 1, 96, height - 100);
      await touch('touchMove', 1, 152, height - 100);
      await touch('touchStart', 2, width - 74, height - 80);
      await page.waitForTimeout(40);
      await touch('touchEnd', 2);
      expect(await page.evaluate(() => window.game.currentGameMode.controls.press)).toBeNull();
      expect(await page.evaluate(() => !!window.game.currentGameMode.controls.stick)).toBe(true);
    } else {
      await page.keyboard.down('ArrowRight');
      if (hasTouch) await page.touchscreen.tap(width - 74, height - 80);
      else await page.keyboard.press('Space');
    }
    await expect.poll(async () => (await read(page)).wave).not.toBeNull();
    const cast = (await read(page)).wave;
    await expect.poll(() => peer.state.players.get(peer.sessionId).gustVx, { intervals: [20, 30, 50] }).toBeLessThan(0);
    expect(peer.state.players.get(peer.sessionId).inhaling).toBe(true);
    // The peer's wind patch may arrive before this browser's world clock patch.
    await expect.poll(async () => (await read(page)).wave?.age ?? -1, { intervals: [20, 30] }).toBeGreaterThanOrEqual(220);
    const covered = await read(page);
    expect(covered.wave).not.toBeNull();
    expect(covered.wave.age).toBeGreaterThanOrEqual(200);
    expect(covered.wave.x).toBe(cast.x);
    expect(Math.abs(covered.facing)).toBeLessThan(.1);
    expect(covered.stunned).toBe(false);
    expect(peer.state.players.get(peer.sessionId).stunned).toBe(false);
    expect(peer.state.players.get(peer.sessionId).sliding).toBe(false);
    const chaserY = peer.state.players.get(peer.sessionId).y;
    peer.send('steer', { x: 0, y: 1 });
    await page.screenshot({ path: test.info().outputPath('rear-airflow-while-fleeing.png'), scale: 'css' });
    await expect.poll(() => peer.state.players.get(peer.sessionId).y, { intervals: [20, 30] }).toBeGreaterThan(chaserY + 2);
    await expect.poll(async () => (await read(page)).x).toBeGreaterThan(before.x + 60);
    await expect.poll(async () => (await read(page)).wave).toBeNull();
    expect((await read(page)).gems).toBe(100);
    expect(errors).toEqual([]);
  } finally {
    if (cdp) { for (const id of [...points.keys()]) await touch('touchEnd', id); await cdp.detach(); }
    else await page.keyboard.up('ArrowRight');
    await peer.leave();
  }
});

test('the receiving player feels separate rear wind and can keep moving with keyboard or thumb', async ({page,baseURL,hasTouch,browserName}) => {
  const {peer,errors}=await scene(page,baseURL), input=await practiceInput(page,browserName,hasTouch);
  try {
    const width=peer.state.players.get(peer.sessionId).width;
    peer.send('test:moveTo',{x:2100+width+80,y:2100}); peer.send('test:face',{angle:0});
    await expect.poll(()=>peer.state.players.get(peer.sessionId).x).toBeCloseTo(2100+width+80,0);
    await input.hold(); await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling);
    const before=await read(page); peer.send('tap');
    await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gustVx < -20);
    await input.releaseAction(); await input.move(0,1); await page.waitForTimeout(180);
    const after=await read(page); expect(after.x).toBeLessThan(before.x-15); expect(after.y).toBeGreaterThan(before.y+5);
    expect(after.stunned).toBe(false); expect(after.sliding).toBe(false); expect(after.gems).toBe(100);
    const state=await page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return{
      wind:Math.hypot(p.gustVx,p.gustVy),weapon:p.puffVx,error:Math.abs(m.predicted.x-p.x)};});
    expect(state.wind).toBeLessThanOrEqual(280);expect(state.weapon).toBe(0);expect(state.error).toBeLessThan(25);
    await page.screenshot({path:test.info().outputPath('receiving-rear-wind-with-control.png'),scale:'css'});
    await expect.poll(()=>page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gustVx)).toBe(0);
    expect(errors).toEqual([]);
  }finally{await input.close();await peer.leave();}
});

test('puffs spend 75% of full breath, reject rapid repeats and refill normally without a timer', async ({ page, baseURL, hasTouch, browserName }) => {
  const { peer } = await scene(page, baseURL), input = await practiceInput(page, browserName, hasTouch);
  await page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room;
    window.puffReceipts = [];
    room.onMessage('exhale', data => { if (data.id === room.sessionId) window.puffReceipts.push({ breath: data.breathLeft, at: performance.now() }); });
  });
  const meter = () => page.evaluate(() => {
    const m = window.game.currentGameMode;
    return { breath: m.stamina, cooldown: m.controls.puffCooldown, receipts: window.puffReceipts, now: performance.now() };
  });
  try {
    await peer.leave(); await input.tap();
    await expect.poll(async () => (await meter()).receipts.length).toBe(1);
    const first = await meter(); expect(first.receipts[0].breath).toBeCloseTo(.25, 5);
    expect(first.cooldown).toBe(0);
    await input.tap(); await input.tap();
    expect((await meter()).receipts.length).toBe(1);
    await page.waitForTimeout(750);
    expect((await meter()).breath).toBeGreaterThan(.4);
    await expect.poll(async () => (await meter()).breath, { intervals: [20, 40] }).toBeGreaterThan(.83);
    await input.tap();
    await expect.poll(async () => (await meter()).receipts.length).toBe(2);
    const next = await meter(), receipt = next.receipts.at(-1);
    expect(receipt.breath).toBeLessThanOrEqual(.25 + 1e-6);
    expect(Math.abs(next.breath - Math.min(1, receipt.breath + (next.now - receipt.at) / 3000))).toBeLessThan(.03);
    expect(next.cooldown).toBe(0);
    await page.screenshot({ path: test.info().outputPath('75-percent-puff-breath.png'), scale: 'css' });
  } finally { await input.close(); }
});

test('body contact compresses smoothly while the player keeps steering', async ({ page, baseURL }) => {
  const { peer, send, errors } = await scene(page, baseURL);
  try {
    const width = peer.state.players.get(peer.sessionId).width;
    peer.send('test:moveTo', { x: 2100 + width * .85, y: 2100 });
    peer.send('steer', { x: -1, y: 0 });
    await page.keyboard.down('ArrowRight');
    await expect.poll(async () => (await read(page)).squash).toBeGreaterThan(.01);
    const pressed = await read(page);
    expect(pressed.stunned).toBe(false);
    expect(pressed.sliding).toBe(false);
    expect(pressed.injury).toBe(0);
    await page.screenshot({ path: test.info().outputPath('soft-body-contact.png'), scale: 'css' });
    await page.keyboard.up('ArrowRight');
    peer.send('steer', { x: 0, y: 0 });
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => (await read(page)).y).toBeGreaterThan(pressed.y + width);
    await page.keyboard.up('ArrowDown');
    await expect.poll(async () => (await read(page)).squash).toBeLessThan(.002);
    expect((await read(page)).gems).toBe(100);
    expect(errors).toEqual([]);
  } finally { await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowDown'); await peer.leave(); }
});

test('a real weapon bolt leaves keyboard and thumb movement available during its push', async ({ page, baseURL, browserName, hasTouch }) => {
  const { peer, send, errors } = await scene(page, baseURL);
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    await send('test:moveTo', { x: 3100, y: 3100 });
    peer.send('test:setGems', { count: 1000 });
    await expect.poll(() => peer.state.players.get(peer.sessionId).gems).toBe(1000);
    const width = peer.state.players.get(peer.sessionId).width;
    peer.send('test:moveTo', { x: 2000 - width / 2, y: 2000 - width / 2 });
    peer.send('test:face', { angle: 0 });
    peer.send('test:pinwheel', { x: 2000, y: 2000, kind: 'pinwheel' });
    await expect.poll(() => peer.state.pinwheel.phase).toBe('carried');
    peer.send('placeWeapon');
    await expect.poll(() => peer.state.pinwheel.phase).toBe('active');
    await page.waitForFunction(() => {
      const s = window.game.currentGameMode.multiplayerManager.getState();
      return [...s.pinwheel.bolts.values()].some(b => s.time - b.bornAt >= 600 && b.traveled < 650);
    });
    const angle = await page.evaluate(() => {
      const m = window.game.currentGameMode, s = m.multiplayerManager.getState(), p = m.multiplayerManager.getLocalPlayer();
      const bolt = [...s.pinwheel.bolts.values()].find(b => s.time - b.bornAt >= 600 && b.traveled < 650);
      if (!bolt) throw Error('The selected live bolt expired before arranging its collision');
      const gap = p.width / 2 + 35;
      m.multiplayerManager.room.send('test:moveTo', {
        x: bolt.x + Math.cos(bolt.angle) * gap - p.width / 2,
        y: bolt.y + Math.sin(bolt.angle) * gap - p.height / 2,
      });
      return bolt.angle;
    });
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems < 100);
    const hit = await read(page);
    expect(hit.stunned).toBe(false); expect(hit.sliding).toBe(false); expect(hit.injury).toBeGreaterThan(0);
    const tx = -Math.sin(angle), ty = Math.cos(angle);
    await input.move(tx, ty);
    await page.waitForTimeout(180);
    const after = await read(page);
    expect((after.x - hit.x) * tx + (after.y - hit.y) * ty).toBeGreaterThan(8);
    expect(after.stunned).toBe(false); expect(after.sliding).toBe(false);
    expect(peer.state.players.get(peer.sessionId).weaponDamage).toBe(24);
    await page.screenshot({ path: test.info().outputPath('steering-through-weapon-impact.png'), scale: 'css' });
    expect(errors).toEqual([]);
  } finally { await input.close(); await peer.leave(); }
});
