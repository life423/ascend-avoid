import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

// This suite uses development-only placement hooks against an isolated local test server.
test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires a local NODE_ENV=test server');

const mine = page => page.evaluate(() => {
  const room = window.game.currentGameMode.multiplayerManager.room;
  const p = room.state.players.get(room.sessionId);
  return { capturedBy: p.capturedBy, x: p.x, y: p.y, flying: p.flying, inhaling: p.inhaling };
});

test('a hard-impact stun blocks keyboard input and held movement resumes afterward', async ({ page }) => {
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  await send('test:setGems', { count: 300 });
  await send('test:moveTo', { x: 1500, y: 1500 });
  await send('test:protect', { ms: 0 });
  // Actual missile-impact timing is covered by the server regressions. This fixture holds that
  // disabled-input state long enough to inspect it; gusts and ordinary contact never set it.
  await send('test:stun', { ms: 1200 });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().stunned);
  const before = await mine(page);
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  const after = await mine(page);
  expect(after.inhaling).toBe(false);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
  await page.screenshot({ path: test.info().outputPath('impact-stunned.png') });
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.game.currentGameMode.multiplayerManager.getLocalPlayer().stunned);
  await expect.poll(async () => (await mine(page)).y).toBeGreaterThan(before.y + 5);
  await page.keyboard.up('ArrowDown');
});
