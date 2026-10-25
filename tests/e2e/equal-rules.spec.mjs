import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local test server only');
for (const kind of ['pinwheel', 'pulsar']) test(`a bot collects, carries and places a real ${kind} without human-only UI`, async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 2, testFieldGems: 0, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 2 && !document.body.classList.contains('intro-playing'));
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  await send('test:moveTo', { x: 100, y: 100 }); await send('test:protect', { ms: 60000 });
  const placement = await page.evaluate(() => {
    const s = window.game.currentGameMode.multiplayerManager.room.state, bot = [...s.players.values()].find(p => p.isBot);
    return { x: bot.x + bot.width / 2 + 120, y: bot.y + bot.height / 2, id: bot.sessionId };
  });
  await send('test:pinwheel', { x: placement.x, y: placement.y, kind });
  await page.waitForFunction(id => { const w = window.game.currentGameMode.multiplayerManager.room.state.pinwheel; return w.owner === id && w.phase === 'carried'; }, placement.id, { timeout: 30000 });
  const bot = await page.evaluate(id => { const p = window.game.currentGameMode.multiplayerManager.room.state.players.get(id); return { x: p.x, y: p.y }; }, placement.id);
  await send('test:moveTo', { x: bot.x + 65, y: bot.y });
  await page.screenshot({ path: test.info().outputPath(`bot-${kind}-cargo.png`) });
  await expect(page.locator('.weapon-place-button')).toBeHidden();
  expect(await page.evaluate(() => window.game.currentGameMode.notices.filter(n => n.category === 'weapon').length)).toBe(0);
  await page.waitForFunction(id => { const w = window.game.currentGameMode.multiplayerManager.room.state.pinwheel; return w.owner === id && w.phase === 'active'; }, placement.id, { timeout: 12000 });
  await page.screenshot({ path: test.info().outputPath(`bot-${kind}-active.png`) });
});

test('extreme gem totals keep a playable body and full arena at center and corners', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  for (const count of [0, 1500, 10000, 1e9]) {
    await send('test:setGems', { count });
    await page.waitForFunction(count => Math.abs(window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems - count) <= Math.max(2, count * .01), count);
    for (const corner of ['center', 'top-left', 'bottom-right']) {
      const position = await page.evaluate(corner => { const m = window.game.currentGameMode, s = m.multiplayerManager.room.state, p = m.multiplayerManager.getLocalPlayer(); return { x: corner === 'center' ? (s.worldWidth - p.width) / 2 : corner === 'top-left' ? 0 : s.worldWidth - p.width, y: corner === 'center' ? (s.worldHeight - p.height) / 2 : corner === 'top-left' ? 0 : s.worldHeight - p.height }; }, corner);
      await send('test:moveTo', position);
      await expect.poll(() => page.evaluate(() => { const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(), v = m.lastView; return p.width / Math.min(v.width, v.height); })).toBeLessThan(.7);
      await expect.poll(() => page.evaluate(() => { const m = window.game.currentGameMode, s = m.multiplayerManager.room.state, p = m.multiplayerManager.getLocalPlayer(), v = m.lastView, r = document.querySelector('canvas').getBoundingClientRect(); return Math.max(0, p.width - 1260, -p.x, -p.y, p.x + p.width - s.worldWidth, p.y + p.height - s.worldHeight, v.width / 2 - v.x, v.height / 2 - v.y, v.x + v.width / 2 - s.worldWidth, v.y + v.height / 2 - s.worldHeight, Math.abs(r.left), Math.abs(r.top), Math.abs(r.width - visualViewport.width), Math.abs(r.height - visualViewport.height)); })).toBeLessThan(.5);
      if (count === 1e9) {
        await expect(page.locator('.score-value:not(.high-score)')).toHaveText(/^\d+(\.\d+)?[MB]$/);
        await page.screenshot({ path: test.info().outputPath(`extreme-score-${corner}.png`) });
      }
    }
  }
});
