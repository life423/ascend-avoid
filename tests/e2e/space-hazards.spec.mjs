import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
async function start(page, options = {}) {
  await page.addInitScript(() => localStorage.setItem('ascend.guideSeen', 'true'));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual', ...options }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
}
const send = (page, type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });

test('a small missed cannon shot burns up, explains why and respawns on the map', async ({ page, baseURL }) => {
  await start(page);
  const id = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const captor = await new Client(baseURL.replace(/^http/, 'ws')).joinById(id, { name: 'Burnup regression' }); captor.onMessage('*', () => {});
  try {
    captor.send('test:setGems', { count: 16 }); captor.send('test:moveTo', { x: 800, y: 1000 }); captor.send('test:face', { angle: 0 }); captor.send('test:protect', { ms: 0 });
    await send(page, 'test:setGems', { count: 4 }); await send(page, 'test:moveTo', { x: 860, y: 1012.75 }); await send(page, 'test:protect', { ms: 0 });
    await page.waitForTimeout(150); captor.send('inhale');
    await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().capturedBy);
    captor.send('tap');
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().flying);
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'dead' && window.game.currentGameMode.knockoutCause?.how === 'burnup');
    await page.screenshot({ path: test.info().outputPath('missile-burnup.png') });
    await page.waitForFunction(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return p.state === 'alive' && p.spawnProtected; });
    const outside = await page.evaluate(() => { const m = window.game.currentGameMode, s = m.multiplayerManager.room.state, v = m.lastView; return Math.max(0, v.width / 2 - v.x, v.height / 2 - v.y, v.x + v.width / 2 - s.worldWidth, v.y + v.height / 2 - s.worldHeight); });
    expect(outside).toBeLessThan(.1);
  } finally { await captor.leave(); }
});

test('the fan blocks an oversized creature but launches a fitting small player safely', async ({ page }) => {
  await start(page);
  await send(page, 'test:placeTurbine', { x: 2000, y: 2000, intake: 0, still: true });
  await send(page, 'test:setGems', { count: 100 }); await send(page, 'test:moveTo', { x: 2064, y: 1928.5 }); await send(page, 'test:protect', { ms: 0 });
  await page.waitForTimeout(400);
  const big = await page.evaluate(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return { flying: p.flying, width: p.width, distance: Math.hypot(p.x + p.width / 2 - 2000, p.y + p.height / 2 - 2000) }; });
  expect(big.width).toBeGreaterThan(54); expect(big.flying).toBe(false); expect(big.distance).toBeGreaterThanOrEqual(60 + big.width / 2 - .1);
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
  const predicted = await page.evaluate(() => { const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(); return Math.hypot(m.predicted.x + p.width / 2 - 2000, m.predicted.y + p.width / 2 - 2000) - 60 - p.width / 2; });
  expect(predicted).toBeGreaterThan(-3, 'client prediction also stops at the solid fan');
  await page.screenshot({ path: test.info().outputPath('fan-blocks-large-player.png') });
  await send(page, 'test:setGems', { count: 4 }); await send(page, 'test:moveTo', { x: 2064, y: 1982.75 });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().flying);
  await page.waitForFunction(() => !window.game.currentGameMode.multiplayerManager.getLocalPlayer().flying);
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state), 'the small-player turbine comeback does not inherit cannon-miss burnup').toBe('alive');
});

test('field crystals are replenished with spacing and a quiet readable arena', async ({ page }) => {
  await start(page, { testFieldGems: 950 });
  const field = await page.evaluate(() => {
    const gems = [...window.game.currentGameMode.multiplayerManager.room.state.gems.values()];
    let nearest = Infinity;
    for (let i = 0; i < gems.length; i++) for (let j = 0; j < i; j++) nearest = Math.min(nearest, Math.hypot(gems[i].x - gems[j].x, gems[i].y - gems[j].y));
    return { count: gems.length, nearest };
  });
  expect(field.count).toBe(950); expect(field.nearest).toBeGreaterThan(65);
  await page.screenshot({ path: test.info().outputPath('spaced-field-crystals.png') });
});
