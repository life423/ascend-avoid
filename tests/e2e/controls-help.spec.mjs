import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
async function start(page) {
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  await waitForArena(page);
}
async function waitForArena(page) {
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
}
const position = page => page.evaluate(() => {
  const manager = window.game.currentGameMode.multiplayerManager;
  const p = manager.getLocalPlayer();
  return { x: p.x, y: p.y, facing: p.facing, inhaling: p.inhaling, time: manager.room.state.time, speed: Math.hypot(p.movementVx, p.movementVy) };
});
const mouseSwitch = page => page.getByRole('switch', { name: 'Mouse steering', exact: true });

async function centerPlayer(page) {
  const center = await page.evaluate(() => {
    const manager = window.game.currentGameMode.multiplayerManager;
    const player = manager.getLocalPlayer(), { worldWidth, worldHeight } = manager.room.state;
    const point = { x: (worldWidth - player.width) / 2, y: (worldHeight - player.height) / 2 };
    manager.room.send('test:moveTo', point);
    return point;
  });
  await expect.poll(async () => {
    const player = await position(page);
    return Math.hypot(player.x - center.x, player.y - center.y);
  }).toBeLessThan(1);
}

async function moveCursorRight(page) {
  const box = await page.locator('canvas.game-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * .8, box.y + box.height * .5);
}

async function afterMovementWindow(page, before) {
  await expect.poll(async () => (await position(page)).time - before.time).toBeGreaterThanOrEqual(350);
  return position(page);
}

async function expectStill(page) {
  const before = await position(page);
  const after = await afterMovementWindow(page, before);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(2);
}

async function holdKey(page, key, check) {
  await page.keyboard.down(key);
  try { await check(); }
  finally { await page.keyboard.up(key); }
}

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
  await expect(dialog.locator('button, input, a[href], [tabindex="0"]').last()).toBeFocused();
  await page.keyboard.press('Tab'); await expect(close).toBeFocused();
  const sound = dialog.getByRole('button', { name: 'Mute sound', exact: true });
  await sound.focus(); await page.keyboard.press('Space');
  await expect(sound).toHaveAttribute('aria-pressed', 'true');
  await close.focus();
  await page.screenshot({ path: test.info().outputPath('short-help.png') });
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden();
});

test('the arena stays free of duplicate surge countdowns while the event continues', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    window.surgeTexts = 0;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (/^Gem surge ·|^Gem surge in|^Jackpot!.*left/.test(String(text))) window.surgeTexts++;
      return fill.call(this, text, ...args);
    };
    window.game.currentGameMode.multiplayerManager.room.send('test:surge', { active: true });
  });
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.surgeTexts)).toBe(0);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.surgeTexts)).toBe(0);
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.state.surgePhase)).toBe('active');
});

test('a first-time desktop visitor enters the arena with keyboard steering ready', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'desktop steering');
  // The page context has no saved preference. Enter and move without dismissing
  // a prompt or choosing a mode.
  await start(page);
  await expect(mouseSwitch(page)).toHaveAttribute('aria-checked', 'false');
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.state.practice.enabled)).toBe(false);
  await centerPlayer(page);
  await moveCursorRight(page);
  await expectStill(page);
  const before = await position(page);
  await holdKey(page, 'ArrowRight', async () => {
    await expect.poll(async () => (await position(page)).x).toBeGreaterThan(before.x + 25);
  });
});

test('desktop Mouse steering is exclusive and remembers both choices across reloads', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'desktop steering');
  await start(page);
  const control = mouseSwitch(page);
  await centerPlayer(page);
  await control.click();
  await expect(control).toHaveAttribute('aria-checked', 'true');
  // A toolbar click leaves the cursor outside the arena. Mouse mode must stay
  // stationary even with a direction key held and no cursor target.
  await holdKey(page, 'ArrowLeft', () => expectStill(page));
  const beforeMouse = await position(page);
  await moveCursorRight(page);
  await expect.poll(async () => (await position(page)).x).toBeGreaterThan(beforeMouse.x + 25);
  await holdKey(page, 'ArrowLeft', async () => {
    const beforeKey = await position(page);
    const afterKey = await afterMovementWindow(page, beforeKey);
    expect(afterKey.x).toBeGreaterThan(beforeKey.x + 25);
  });

  await page.evaluate(() => window.drawerUI.open());
  await expect.poll(async () => (await position(page)).speed).toBeLessThan(2);
  await expectStill(page);
  await page.getByRole('dialog', { name: 'Game Menu' }).getByRole('button', { name: 'Close', exact: true }).click();
  await control.hover();
  await page.reload();
  await waitForArena(page);
  await expect(control).toHaveAttribute('aria-checked', 'true');
  await centerPlayer(page);
  const afterReload = await position(page);
  await moveCursorRight(page);
  await expect.poll(async () => (await position(page)).x).toBeGreaterThan(afterReload.x + 25);

  await control.focus();
  await page.keyboard.press('Space');
  await expect(control).toHaveAttribute('aria-checked', 'false');
  expect((await position(page)).inhaling, 'keyboard activation of the switch must not also inhale').toBe(false);
  await control.hover();
  await page.reload();
  await waitForArena(page);
  await expect(control).toHaveAttribute('aria-checked', 'false');
  await centerPlayer(page);
  await moveCursorRight(page);
  await expectStill(page);
  const beforeKeys = await position(page);
  await holdKey(page, 'ArrowRight', async () => {
    await expect.poll(async () => (await position(page)).x).toBeGreaterThan(beforeKeys.x + 25);
  });
});

test('touch can walk left while aiming inhale up even with a saved mouse preference', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'touch aiming');
  await page.addInitScript(() => localStorage.setItem('ascend.mouseFollow', 'on'));
  await start(page);
  if (await page.evaluate(() => matchMedia('(pointer: coarse)').matches)) {
    await expect(mouseSwitch(page)).toHaveCount(0);
    await page.evaluate(() => window.drawerUI.open());
    const drawer = page.getByRole('dialog', { name: 'Game Menu' });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole('switch', { name: 'Mouse steering', exact: true })).toHaveCount(0);
    await drawer.getByRole('button', { name: 'Close', exact: true }).click();
    await expect(drawer).toBeHidden();
  }
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
  await page.evaluate(() => {
    window.loadingPanels = 0;
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (/^Loading:/.test(String(text))) window.loadingPanels++;
      return fill.call(this, text, ...args);
    };
  });
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
    expect(await page.evaluate(() => window.loadingPanels)).toBe(0);
    expect(Math.abs(after.facing + Math.PI / 2)).toBeLessThan(.1);
    expect(await page.evaluate(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping)).toBe(true);
    await page.screenshot({ path: test.info().outputPath('touch-loaded-aim.png') });
    await page.evaluate(() => { window.captureAimEmit('pointerup', 31, 0, 0); window.captureAimEmit('pointerup', 32, 0, 0); });
  } finally { await peer.leave(); }
});
