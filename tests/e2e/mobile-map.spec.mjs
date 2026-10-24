import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
test('mobile map fills the viewport during an edge knockout and after rotation', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'mobile framing regression');
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  const outside = () => page.evaluate(() => {
    const m = window.game.currentGameMode, v = m.lastView, s = m.multiplayerManager.room.state;
    return Math.max(0, v.width / 2 - v.x, v.height / 2 - v.y, v.x + v.width / 2 - s.worldWidth, v.y + v.height / 2 - s.worldHeight);
  });
  await page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room;
    room.send('test:moveTo', { x: 4170, y: 4170 }); room.send('test:protect', { ms: 0 });
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.send('test:hit'));
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'dead');
  expect(await outside()).toBeLessThan(.1);
  await page.screenshot({ path: test.info().outputPath('map-knockout-portrait.png') });
  await page.setViewportSize({ width: 851, height: 393 }); await page.waitForTimeout(100);
  expect(await outside()).toBeLessThan(.1);
  await page.screenshot({ path: test.info().outputPath('map-knockout-landscape.png') });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'alive');
  expect(await outside()).toBeLessThan(.1);
});
