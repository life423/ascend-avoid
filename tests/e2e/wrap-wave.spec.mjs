import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local server only');

async function scene(page, baseURL) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
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

test('a forward puff gives a fleeing player fixed rear cover without turning', async ({ page, baseURL, hasTouch, browserName }) => {
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
    await expect.poll(() => peer.state.players.get(peer.sessionId).inhaling, { intervals: [20, 30, 50] }).toBe(false);
    const covered = await read(page);
    expect(covered.wave).not.toBeNull();
    expect(covered.wave.age).toBeGreaterThanOrEqual(200);
    expect(covered.wave.x).toBe(cast.x);
    expect(Math.abs(covered.facing)).toBeLessThan(.1);
    expect(covered.stunned).toBe(false);
    expect(peer.state.players.get(peer.sessionId).stunned).toBe(false);
    await page.screenshot({ path: test.info().outputPath('rear-cover-while-fleeing.png'), scale: 'css' });
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
