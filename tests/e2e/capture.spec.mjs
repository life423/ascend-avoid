import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

// This suite uses development-only placement hooks against an isolated local test server.
test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires a local NODE_ENV=test server');

const mine = page => page.evaluate(() => {
  const room = window.game.currentGameMode.multiplayerManager.room;
  const p = room.state.players.get(room.sessionId);
  return { capturedBy: p.capturedBy, escapeKeys: p.escapeKeys, escapeStep: p.escapeStep, x: p.x, y: p.y, flying: p.flying, inhaling: p.inhaling };
});

test('gust stun blocks real keyboard input and shows a readable dizzy face', async ({ page }) => {
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
  // An actual peer gust is covered in the network suite; this fixture holds the visual state long
  // enough to check input and capture screenshots on both fast desktops and slower phone projects.
  await send('test:stun', { ms: 1200 });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().stunned);
  const before = await mine(page);
  await page.keyboard.down('ArrowDown');
  await page.keyboard.down('Space');
  await page.waitForTimeout(200);
  const after = await mine(page);
  expect(after.inhaling).toBe(false);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
  await page.screenshot({ path: test.info().outputPath('gust-stunned.png') });
  await page.keyboard.up('Space');
  await page.waitForFunction(() => !window.game.currentGameMode.multiplayerManager.getLocalPlayer().stunned);
  await expect.poll(async () => (await mine(page)).y).toBeGreaterThan(before.y + 5);
  await page.keyboard.up('ArrowDown');
});

test('WASD and arrow taps free a real captive; focus loss cancels movement and inhale', async ({ page, baseURL, hasTouch }) => {
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const captor = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, { name: 'Capture regression' });
  captor.onMessage('*', () => {});
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  try {
    await expect.poll(() => captor.state.players?.size).toBe(2);
    for (const useArrows of [false, true, ...(hasTouch ? ['touch'] : [])]) {
      captor.send('test:breath', { stamina: 1 });
      captor.send('test:setGems', { count: 16 });
      captor.send('test:moveTo', { x: 800, y: 1000 });
      captor.send('test:face', { angle: 0 });
      await send('test:setGems', { count: 4 });
      await send('test:moveTo', { x: 860, y: 1012.75 });
      await send('test:protect', { ms: 0 });
      captor.send('test:protect', { ms: 0 });
      await page.waitForTimeout(200);
      captor.send('inhale');
      await expect.poll(async () => (await mine(page)).capturedBy).toBe(captor.sessionId);
      captor.send('tap'); // queue the earliest possible shot while the human reads the puzzle
      await page.waitForFunction(() => {
        const room = window.game.currentGameMode.multiplayerManager.room;
        return room.state.time >= room.state.players.get(room.sessionId).dazedUntil;
      });
      const keys = (await mine(page)).escapeKeys;
      expect(keys).toHaveLength(3);
      await page.screenshot({ path: test.info().outputPath(`capture-${String(useArrows)}.png`) });
      await page.waitForTimeout(650); // human reading/reaction time after the daze
      const mapping = useArrows ? { U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' } : { U: 'w', D: 's', L: 'a', R: 'd' };
      for (const direction of keys) {
        // A quick tap: keydown/up may both occur before the next simulation tick.
        if (useArrows === 'touch') {
          await page.evaluate(direction => {
            const canvas = document.querySelector('canvas');
            const rect = canvas.getBoundingClientRect();
            const x = rect.left + rect.width * .25, y = rect.top + rect.height * .65;
            const [dx, dy] = { U: [0, -70], D: [0, 70], L: [-70, 0], R: [70, 0] }[direction];
            const pointer = (type, px, py) => new PointerEvent(type, { pointerId: 99, pointerType: 'touch', clientX: px, clientY: py, bubbles: true });
            canvas.dispatchEvent(pointer('pointerdown', x, y));
            window.dispatchEvent(pointer('pointermove', x + dx, y + dy));
          }, direction);
          await page.waitForTimeout(100);
          await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 99, pointerType: 'touch', bubbles: true })));
        } else await page.keyboard.press(mapping[direction], { delay: 20 });
        await page.waitForTimeout(useArrows === 'touch' ? 400 : 480);
      }
      await expect.poll(async () => (await mine(page)).capturedBy).toBe('');
      expect((await mine(page)).flying).toBe(false);
      await page.waitForTimeout(1750); // post-escape protection/slide ends before the next trial
    }
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('Space');
    await expect.poll(async () => (await mine(page)).inhaling).toBe(true);
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await expect.poll(async () => (await mine(page)).inhaling).toBe(false);
    expect(await page.evaluate(() => window.game.inputManager.getInputState())).toEqual({ up: false, down: false, left: false, right: false });
    const before = await mine(page);
    await page.waitForTimeout(400);
    const after = await mine(page);
    expect(Math.abs(after.x - before.x)).toBeLessThan(30);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Space');
    // Hit feedback and world edges must never displace the locked camera.
    await send('test:setGems', { count: 100 });
    for (const position of [{ x: 8, y: 8 }, { x: 3900, y: 3900 }]) {
      await send('test:moveTo', position);
      await page.waitForTimeout(200);
      await page.evaluate(() => window.game.currentGameMode.addShake(12));
      const error = await page.evaluate(() => {
        const mode = window.game.currentGameMode;
        const room = mode.multiplayerManager.room;
        const p = room.state.players.get(room.sessionId);
        return Math.hypot(mode.predicted.x + p.width / 2 - mode.lastView.x, mode.predicted.y + p.height / 2 - mode.lastView.y);
      });
      expect(error, 'player remains at the exact view center').toBeLessThan(0.1);
    }
    if (!hasTouch) {
      await page.locator('.bar-name-input').fill('Saved with button');
      await page.getByRole('button', { name: 'Save name', exact: true }).click();
      await expect.poll(() => page.evaluate(() => localStorage.getItem('playerName'))).toBe('Saved with button');
      await page.locator('.bar-name-input').fill('Saved with Enter');
      await page.locator('.bar-name-input').press('Enter');
      await expect.poll(() => page.evaluate(() => localStorage.getItem('playerName'))).toBe('Saved with Enter');
      await page.getByRole('button', { name: 'Focus view', exact: true }).click();
      await expect(page.getByRole('button', { name: /Show controls/ })).toBeVisible();
      await page.locator('.bar-tab [data-action="help"]').click();
      await expect(page.getByRole('button', { name: 'Mute sound', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Mute sound', exact: true }).click();
      expect(await page.evaluate(() => localStorage.getItem('ascend.muted'))).toBe('true');
    }
    if (hasTouch) {
      // Pointer edges use the same server escape path and require returning to neutral.
      expect(await page.evaluate(() => window.game.currentGameMode.controls.touchDevice)).toBe(true);
    }
  } finally { await captor.leave(); }
});
