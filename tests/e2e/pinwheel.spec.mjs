import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');

test('inhale assembles three floating parts and the pinwheel spins up and fires', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  await page.evaluate(() => {
    const mode = window.game.currentGameMode, room = mode.multiplayerManager.room;
    room.send('test:setGems', { count: 200 });
  });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 200);
  await page.evaluate(() => {
    const mode = window.game.currentGameMode, room = mode.multiplayerManager.room;
    const p = mode.multiplayerManager.getLocalPlayer();
    room.send('test:moveTo', { x: 1840 - p.width * 0.8, y: 2100 - p.height / 2 });
    room.send('test:face', { angle: 0 });
    room.send('test:pinwheel', { x: 2100, y: 2100 });
    mode.localFacing = 0; mode.localSpin = 0; mode.facing = { x: 1, y: 0 };
  });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.parts.length === 3);
  await page.screenshot({ path: test.info().outputPath('pinwheel-parts.png') });
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase === 'charging', null, { timeout: 5000 });
  await page.keyboard.up('Space');
  const builder = await page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room;
    return room.state.pinwheel.owner === room.sessionId;
  });
  expect(builder).toBe(true);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.bolts.size > 0);
  await page.screenshot({ path: test.info().outputPath('pinwheel-firing.png') });
  expect(errors).toEqual([]);
});
