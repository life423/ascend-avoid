import { test, expect } from '@playwright/test';

/** Your own creature, as the server last told this page */
function me(page) {
  return page.evaluate(() => {
    const room = window.game?.currentGameMode?.multiplayerManager?.room;
    const p = room?.state?.players?.get(room.sessionId);
    return p ? { x: p.x, y: p.y, inhaling: Boolean(p.inhaling) } : null;
  });
}

/** Press a touch pointer on the canvas at this share of its width and height; returns a function that lifts it */
async function touchDown(page, id, shareX, shareY) {
  await page.evaluate(({ id, shareX, shareY }) => {
    const canvas = document.querySelector('canvas');
    const r = canvas.getBoundingClientRect();
    const at = { x: r.left + r.width * shareX, y: r.top + r.height * shareY };
    const event = (type, dx = 0) =>
      new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 1, clientX: at.x + dx, clientY: at.y, bubbles: true, cancelable: true });
    canvas.dispatchEvent(event('pointerdown'));
    window.__touches = window.__touches || {};
    window.__touches[id] = { move: (dx) => window.dispatchEvent(event('pointermove', dx)), up: (dx = 0) => window.dispatchEvent(event('pointerup', dx)) };
  }, { id, shareX, shareY });
}

test('the game loads, connects, draws, fits the screen, moves and inhales', async ({ page, hasTouch }) => {
  const problems = [];
  // colyseus.js 0.15 first opens its socket Node-style (new WebSocket(url, { headers, protocols })), and
  // falls back to the browser form when that throws; Safari reports that caught first try as an error.
  // It's harmless (the fallback connects), so it's the one message allowed here.
  const known = [/Wrong protocol for WebSocket '\[object Object\]'/];
  const report = (text) => {
    if (!known.some((pattern) => pattern.test(text))) problems.push(text);
  };
  page.on('pageerror', (error) => report(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') report(`console error: ${message.text()}`);
  });

  await page.goto('/');
  // It connects, and your creature is in the world
  await page.waitForFunction(() => {
    const room = window.game?.currentGameMode?.multiplayerManager?.room;
    return Boolean(room?.sessionId && room.state?.players?.get(room.sessionId));
  }, null, { timeout: 20_000 });
  await page.waitForTimeout(2600); // the opening

  // It draws: the canvas fills most of the screen and holds a real picture, and nothing spills sideways
  const view = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    let low = 765, high = 0;
    for (let i = 0; i < data.length; i += 4 * 61) {
      const v = data[i] + data[i + 1] + data[i + 2];
      low = Math.min(low, v);
      high = Math.max(high, v);
    }
    const box = canvas.getBoundingClientRect();
    return { spread: high - low, canvasWidth: box.width, viewportWidth: innerWidth, overflow: document.documentElement.scrollWidth - innerWidth };
  });
  expect(view.spread, 'the canvas shows a real picture').toBeGreaterThan(60);
  expect(view.canvasWidth, 'the canvas fills most of the screen').toBeGreaterThan(view.viewportWidth * 0.5);
  expect(view.overflow, 'nothing spills off the side of the screen').toBeLessThanOrEqual(1);

  // You can move: the arrow keys on a desktop, the joystick (a thumb on the left half) on a touchscreen
  const before = await me(page);
  if (hasTouch) {
    await touchDown(page, 1, 0.25, 0.6);
    for (let i = 1; i <= 6; i++) {
      await page.evaluate((dx) => window.__touches[1].move(dx), i * 10);
      await page.waitForTimeout(16);
    }
    await page.waitForTimeout(1200);
    await page.evaluate(() => window.__touches[1].up(60));
  } else {
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(1200);
    await page.keyboard.up('ArrowRight');
  }
  await page.waitForTimeout(300);
  const after = await me(page);
  expect(after.x - before.x, 'your creature moves right').toBeGreaterThan(30);

  // You can inhale: space on a desktop, holding the right half of a touchscreen; letting go stops it
  if (hasTouch) await touchDown(page, 2, 0.8, 0.6);
  else await page.keyboard.down('Space');
  await expect.poll(async () => (await me(page)).inhaling, { message: 'inhaling starts', timeout: 3000 }).toBe(true);
  if (hasTouch) await page.evaluate(() => window.__touches[2].up());
  else await page.keyboard.up('Space');
  await expect.poll(async () => (await me(page)).inhaling, { message: 'inhaling stops when you let go', timeout: 3000 }).toBe(false);

  expect(problems, 'no page or console errors').toEqual([]);
});
