import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
async function start(page) {
  await page.addInitScript(() => localStorage.setItem('ascend.guideSeen', 'true'));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.lastView);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
}
async function fills(page) {
  await expect.poll(() => page.evaluate(() => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect(), v = visualViewport;
    const s = getComputedStyle(c), root = document.documentElement;
    return Math.max(Math.abs(r.left - v.offsetLeft), Math.abs(r.top - v.offsetTop), Math.abs(r.width - v.width), Math.abs(r.height - v.height), root.scrollWidth - innerWidth, root.scrollHeight - innerHeight, parseFloat(s.borderTopWidth), parseFloat(s.borderRadius));
  })).toBeLessThan(1);
  await expect.poll(() => page.evaluate(() => {
    const m = window.game.currentGameMode, v = m.lastView, s = m.multiplayerManager.room.state;
    return Math.max(0, v.width / 2 - v.x, v.height / 2 - v.y, v.x + v.width / 2 - s.worldWidth, v.y + v.height / 2 - s.worldHeight);
  })).toBeLessThan(.1);
}

test('visual viewport changes refit the stage and keep Help usable', async ({ page }) => {
  await start(page);
  await page.evaluate(() => {
    // Model a browser toolbar/keyboard reducing and panning the visual viewport without a layout resize.
    const v = visualViewport;
    Object.defineProperty(v, 'height', { configurable: true, get: () => innerHeight - 220 });
    Object.defineProperty(v, 'offsetTop', { configurable: true, get: () => 20 });
    v.dispatchEvent(new Event('resize')); v.dispatchEvent(new Event('scroll'));
  });
  await fills(page);
  await page.evaluate(() => window.drawerUI.open());
  const dialog = page.getByRole('dialog', { name: 'Game Menu' });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box.y).toBeCloseTo(20, 0); expect(box.height).toBeCloseTo(page.viewportSize().height - 220, 0);
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await page.keyboard.press('Escape'); await fills(page);
  await page.evaluate(() => { delete visualViewport.height; delete visualViewport.offsetTop; visualViewport.dispatchEvent(new Event('resize')); });
  await fills(page);
  await expect(page.locator('.drawer')).toBeHidden();
});

test('arena covers the visible viewport through resizing, corners, zoom and knockout', async ({ page }) => {
  await start(page);
  const original = page.viewportSize();
  for (const size of [original, { width: 320, height: 568 }, { width: 568, height: 320 }, { width: 820, height: 1180 }, { width: 1200, height: 800 }, { width: 3440, height: 1440 }, { width: 5120, height: 1080 }, { width: 1440, height: 2560 }]) {
    await page.setViewportSize(size); await fills(page);
    for (const count of [0, 1500]) {
      await page.evaluate(count => {
        const r = window.game.currentGameMode.multiplayerManager.room;
        r.send('test:setGems', { count }); r.send('test:moveTo', { x: count ? 4170 : 0, y: count ? 4170 : 0 });
      }, count);
      await page.waitForTimeout(150); await fills(page);
    }
  }
  await page.setViewportSize(original); await fills(page);
  await page.screenshot({ path: test.info().outputPath('full-viewport.png') });
  await page.evaluate(() => { const r = window.game.currentGameMode.multiplayerManager.room; r.send('test:setGems', { count: 0 }); r.send('test:protect', { ms: 0 }); r.send('test:hit'); });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'dead'); await fills(page);
  await page.screenshot({ path: test.info().outputPath('full-viewport-knockout.png') });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'alive'); await fills(page);
});

test('floating controls preserve canvas size and mouse access in focus view', async ({ page, hasTouch }) => {
  test.skip(hasTouch, 'desktop toolbar');
  await page.setViewportSize({ width: 1680, height: 1000 }); await start(page); await fills(page);
  const before = await page.locator('canvas').boundingBox();
  await page.getByRole('button', { name: 'Focus view', exact: true }).click();
  await expect(page.locator('.app-header')).toHaveAttribute('aria-hidden', 'true');
  const mouse = page.getByRole('switch', { name: 'Mouse control', exact: true });
  await mouse.click(); await expect(mouse).toHaveAttribute('aria-checked', 'false');
  await page.getByRole('button', { name: 'Help & settings', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Game Menu' });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.keyboard.press('f'); await expect(page.getByRole('button', { name: 'Save name', exact: true })).toBeVisible();
  expect(await page.locator('canvas').boundingBox()).toEqual(before); await fills(page);
  await page.screenshot({ path: test.info().outputPath('floating-toolbar.png') });
  // A desktop window narrower than the toolbar retains the preference in Help.
  await page.setViewportSize({ width: 900, height: 700 });
  await page.evaluate(() => window.drawerUI.open());
  await expect(mouse).toHaveAttribute('aria-checked', 'false'); await mouse.click();
  await expect(mouse).toHaveAttribute('aria-checked', 'true');
  await page.keyboard.press('Escape'); await fills(page);
});

test('safe areas protect controls without shrinking the playfield', async ({ page, hasTouch }) => {
  await start(page);
  await page.evaluate(() => {
    for (const [side, value] of Object.entries({ top: 24, right: 28, bottom: 34, left: 28 })) document.documentElement.style.setProperty(`--arena-safe-${side}`, `${value}px`);
    dispatchEvent(new Event('resize'));
  });
  await fills(page);
  await expect.poll(() => page.evaluate(() => window.game.currentGameMode.hudInsets.bottom)).toBeGreaterThanOrEqual(34);
  if (hasTouch) {
    await page.evaluate(() => {
      const arc = CanvasRenderingContext2D.prototype.arc;
      CanvasRenderingContext2D.prototype.arc = function(x, y, r, ...args) {
        const t = this.getTransform();
        if (t.isIdentity && x > this.canvas.width / 2 && y > this.canvas.height / 2 && r >= 28 && r <= 50) window.actionCircle = { right: x + r, bottom: y + r, width: this.canvas.width, height: this.canvas.height };
        return arc.call(this, x, y, r, ...args);
      };
    });
    await page.waitForFunction(() => !!window.actionCircle);
    const bounds = await page.evaluate(() => window.actionCircle);
    expect(bounds.right).toBeLessThanOrEqual(bounds.width - 28); expect(bounds.bottom).toBeLessThanOrEqual(bounds.height - 34);
  }
  await page.screenshot({ path: test.info().outputPath('safe-area.png') });
});
