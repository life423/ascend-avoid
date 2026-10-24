import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
async function start(page) {
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
}
const position = page => page.evaluate(() => {
  const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer();
  return { x: p.x, y: p.y, facing: p.facing, inhaling: p.inhaling };
});

test('short Help fits, has reachable actions and keeps keyboard focus inside', async ({ page }) => {
  await start(page);
  await page.evaluate(() => window.drawerUI.open());
  const dialog = page.getByRole('dialog', { name: 'Game Menu' });
  await expect(dialog).toBeVisible();
  await expect.poll(() => dialog.evaluate(el => {
    const r = el.getBoundingClientRect(); return r.left >= -.1 && r.right <= innerWidth + .1;
  })).toBe(true);
  const words = (await dialog.locator('.instructions').innerText()).trim().split(/\s+/).length;
  expect(words).toBeLessThanOrEqual(129);
  expect(await dialog.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThan(2);
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  await expect(close).toBeFocused();
  const rect = await close.boundingBox(); expect(rect.width).toBeGreaterThanOrEqual(44); expect(rect.height).toBeGreaterThanOrEqual(44);
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Show starter tips', exact: true })).toBeFocused();
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  await page.screenshot({ path: test.info().outputPath('short-help.png') });
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
});

test('gem-surge notice disappears after three seconds while the event continues', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.surgeTexts = 0;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (/^Gem surge ·/.test(String(text))) window.surgeTexts++;
      return fill.call(this, text, ...args);
    };
    window.game.currentGameMode.multiplayerManager.room.send('test:surge', { active: true });
  });
  await expect.poll(() => page.evaluate(() => window.surgeTexts)).toBeGreaterThan(0);
  await page.waitForTimeout(3250);
  const count = await page.evaluate(() => window.surgeTexts);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.surgeTexts)).toBe(count);
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.state.surgePhase)).toBe('active');
});

test('desktop follows an unpressed mouse and keyboard can take over', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'desktop mouse control');
  await start(page);
  const box = await page.locator('canvas').first().boundingBox(), before = await position(page);
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .5);
  await expect.poll(async () => (await position(page)).x).toBeGreaterThan(before.x + 25);
  await page.keyboard.down('ArrowLeft'); const left = await position(page);
  await expect.poll(async () => (await position(page)).x).toBeLessThan(left.x - 25);
  await page.keyboard.up('ArrowLeft'); await page.waitForTimeout(250);
  const stopped = await position(page); await page.waitForTimeout(250);
  expect(Math.abs((await position(page)).x - stopped.x)).toBeLessThan(2);
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .6);
  await page.evaluate(() => window.drawerUI.open());
  await page.waitForTimeout(250); const menu = await position(page);
  await page.waitForTimeout(250); expect(Math.abs((await position(page)).x - menu.x)).toBeLessThan(2);
});

test('touch can walk left while aiming the inhale up with the existing action control', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'touch aiming');
  await start(page);
  await page.evaluate(() => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect();
    const emit = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true }));
    window.aimEmit = emit;
    emit('pointerdown', 21, 110, r.height - 100); emit('pointermove', 21, 55, r.height - 100);
    emit('pointerdown', 22, r.width - 75, r.height - 80); emit('pointermove', 22, r.width - 75, r.height - 145);
  });
  const before = await position(page);
  await expect.poll(async () => (await position(page)).inhaling).toBe(true);
  await expect.poll(async () => (await position(page)).facing).toBeLessThan(-1.2);
  expect((await position(page)).x).toBeLessThan(before.x - 5);
  await page.screenshot({ path: test.info().outputPath('touch-independent-aim.png') });
  await page.evaluate(() => { window.aimEmit('pointerup', 21, 0, 0); window.aimEmit('pointerup', 22, 0, 0); });
  await expect.poll(async () => (await position(page)).inhaling).toBe(false);
});

test('held touch aim survives capturing a real peer while walking sideways', async ({ page, hasTouch, baseURL }) => {
  test.skip(!hasTouch, 'touch capture transition');
  await start(page);
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, { name: 'Aim regression' });
  peer.onMessage('*', () => {});
  try {
    peer.send('test:moveTo', { x: 3000, y: 3000 }); peer.send('test:setGems', { count: 4 }); peer.send('test:protect', { ms: 0 });
    await page.evaluate(() => {
      const room = window.game.currentGameMode.multiplayerManager.room;
      room.send('test:setGems', { count: 16 }); room.send('test:moveTo', { x: 1000, y: 1000 }); room.send('test:face', { angle: -Math.PI / 2 }); room.send('test:protect', { ms: 0 });
      const c = document.querySelector('canvas'), r = c.getBoundingClientRect();
      window.captureAimEmit = (type, id, x, y) => c.dispatchEvent(new PointerEvent(type, { pointerType: 'touch', pointerId: id, clientX: r.left + x, clientY: r.top + y, bubbles: true, cancelable: true }));
      window.captureAimEmit('pointerdown', 31, r.width - 75, r.height - 80);
      window.captureAimEmit('pointermove', 31, r.width - 75, r.height - 145);
    });
    await expect.poll(async () => (await position(page)).inhaling).toBe(true);
    await page.waitForTimeout(200); // the server has received the pre-capture inhale aim
    peer.send('test:moveTo', { x: 1012.75, y: 972.75 });
    await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping);
    const before = await position(page);
    await page.evaluate(() => { const h = document.querySelector('canvas').getBoundingClientRect().height; window.captureAimEmit('pointerdown', 32, 110, h - 100); window.captureAimEmit('pointermove', 32, 55, h - 100); });
    await page.waitForTimeout(700);
    const after = await position(page);
    expect(after.x).toBeLessThan(before.x - 15);
    expect(Math.abs(after.facing + Math.PI / 2)).toBeLessThan(.1);
    expect(await page.evaluate(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('touch-loaded-aim.png') });
    await page.evaluate(() => { window.captureAimEmit('pointerup', 31, 0, 0); window.captureAimEmit('pointerup', 32, 0, 0); });
  } finally { await peer.leave(); }
});
