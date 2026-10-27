import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local test server only');
async function start(page, baseURL) {
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, { name: 'Body pull regression' });
  peer.onMessage('*', () => {});
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  const mine = () => page.evaluate(() => {
    const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
    return { x: p.x, y: p.y, gems: p.gems, width: p.width, predictedX: m.predicted?.x, capturedBy: p.capturedBy, injury: p.injuredUntil, robbed: p.robbedTotal, shield: p.launchSafeUntil - m.multiplayerManager.room.state.time };
  });
  return { peer, send, mine };
}

test('a healthy local player visibly moves toward an inhaler while keeping its gems', async ({ page, baseURL }) => {
  const { peer, send, mine } = await start(page, baseURL);
  try {
    peer.send('test:setGems', { count: 100 }); await send('test:setGems', { count: 100 });
    await expect.poll(() => peer.state.players?.get(peer.sessionId)?.gems).toBe(100);
    const w = peer.state.players.get(peer.sessionId).width;
    const x = 1700 + w * .8 + (80 + w * 2) * .5;
    peer.send('test:moveTo', { x: 1700, y: 1700 }); peer.send('test:face', { angle: 0 });
    await send('test:moveTo', { x, y: 1700 }); await send('test:protect', { ms: 0 });
    await expect.poll(async () => { const p = await mine(); return Math.abs(p.x - x) < 1 && Math.abs(p.predictedX - x) < 2; }).toBe(true);
    peer.send('inhale');
    await expect.poll(async () => (await mine()).x, { timeout: 2000, intervals: [50, 100] }).toBeLessThan(x - 90);
    const pulled = await mine();
    expect(pulled.predictedX).toBeLessThan(x - 60);
    expect(pulled.gems).toBe(100); expect(pulled.robbed).toBe(0); expect(pulled.injury).toBe(0); expect(pulled.capturedBy).toBe('');
    await page.screenshot({ path: test.info().outputPath('healthy-body-pull.png') });
    await page.keyboard.down('ArrowDown'); const y = pulled.y;
    await expect.poll(async () => (await mine()).y, { timeout: 2000 }).toBeGreaterThan(y + 90);
    await page.keyboard.up('ArrowDown');
    peer.send('cancel');
  } finally { await peer.leave(); }
});

test('timeout ejection from a giant begins clear of its body with four seconds to move away', async ({ page, baseURL }) => {
  const { peer, send, mine } = await start(page, baseURL);
  try {
    peer.send('test:setGems', { count: 10000 }); await send('test:setGems', { count: 4 });
    await expect.poll(() => peer.state.players?.get(peer.sessionId)?.gems).toBeGreaterThan(9900);
    const w = peer.state.players.get(peer.sessionId).width;
    peer.send('test:moveTo', { x: 1400, y: 1400 }); peer.send('test:face', { angle: 0 });
    await send('test:moveTo', { x: 1400 + w * .8, y: 1400 + (w - 28.5) / 2 });
    await send('test:protect', { ms: 0 });
    await page.waitForTimeout(100); peer.send('inhale');
    await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().capturedBy);
    await expect.poll(async () => (await mine()).capturedBy, {timeout: 14000, intervals:[30,60,100]}).toBe('');
    const escaped = await mine(); expect(escaped.shield).toBeGreaterThan(3600);
    const captor = peer.state.players.get(peer.sessionId);
    const d = Math.hypot(escaped.x + escaped.width / 2 - captor.x - captor.width / 2, escaped.y + escaped.width / 2 - captor.y - captor.height / 2);
    expect(d).toBeGreaterThan((escaped.width + captor.width) / 2);
    peer.send('test:breath', { stamina: 1 }); peer.send('inhale');
    await page.keyboard.down('ArrowDown');
    await expect.poll(async () => (await mine()).y).toBeGreaterThan(escaped.y + 150);
    await page.screenshot({ path: test.info().outputPath('clear-escape-with-shield.png') });
    expect((await mine()).capturedBy).toBe('');
    await page.keyboard.up('ArrowDown');
  } finally { await peer.leave(); }
});
