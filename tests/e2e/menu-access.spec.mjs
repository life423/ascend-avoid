import { test, expect } from '@playwright/test';

test.skip(!process.env.PRACTICE_E2E, 'explicit local production interface checks');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing'));
});

async function openMenu(page) {
  const dialog = page.getByRole('dialog', { name: 'Game Menu', exact: true });
  if (await dialog.isVisible()) return dialog;
  const compact = page.getByRole('button', { name: 'Toggle menu', exact: true });
  if (await compact.isVisible()) await compact.click();
  else await page.getByRole('button', { name: /Help & settings/ }).filter({ visible: true }).first().click();
  await expect.poll(() => dialog.evaluate(e => {
    const r = e.getBoundingClientRect(); return r.left >= -.1 && r.right <= innerWidth + .1;
  })).toBe(true);
  return dialog;
}
async function soundControl(page) {
  if (page.viewportSize().width < 1200) return (await openMenu(page)).getByRole('button', { name: 'Mute sound', exact: true });
  return page.locator('.bar-sound:visible').first();
}

test('tutorials and settings are immediately reachable even after a long activity feed', async ({ page }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.evaluate(() => {
    for (let i = 0; i < 20; i++) window.dispatchEvent(new CustomEvent('ascend:activity', { detail: `Rival ${i} landed a shot in the arena.` }));
  });
  const dialog = await openMenu(page);
  const tutorial = dialog.getByRole('button', { name: 'Practice / Tutorials', exact: true });
  await expect(dialog.locator('.drawer-content button').first()).toHaveText('Practice / Tutorials');
  const sound = dialog.getByRole('button', { name: 'Mute sound', exact: true });
  for (const button of [tutorial, sound]) {
    const b = await button.boundingBox(); expect(b.y).toBeGreaterThanOrEqual(0); expect(b.y + b.height).toBeLessThanOrEqual(page.viewportSize().height);
    expect(b.height).toBeGreaterThanOrEqual(44);
  }
  expect(await dialog.evaluate(e => e.scrollWidth - e.clientWidth)).toBeLessThan(2);
  await page.screenshot({ path: test.info().outputPath('menu-top.png') });
  await dialog.evaluate(e => { e.scrollTop = e.scrollHeight; });
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  await openMenu(page);
  expect(await dialog.evaluate(e => e.scrollTop)).toBeLessThan(2);
  await tutorial.click();
  await expect(page.getByRole('button', { name: 'Start full tutorial', exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('sound is reachable, synchronizes with settings, persists and does not inhale on keyboard activation', async ({ page }) => {
  let button = await soundControl(page);
  await expect(button).toHaveText('Sound on'); await expect(button).toHaveAttribute('aria-pressed', 'false');
  const box = await button.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
  await button.click(); await expect(button).toHaveText('Sound off');
  expect(await page.evaluate(() => localStorage.getItem('ascend.muted'))).toBe('true');
  const dialog = await openMenu(page), setting = dialog.getByRole('button', { name: 'Mute sound', exact: true });
  await expect(setting).toHaveText('Sound off'); await expect(setting).toHaveAttribute('aria-pressed', 'true');
  await setting.click(); await expect(setting).toHaveText('Sound on');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  button = await soundControl(page);
  await button.focus(); await page.keyboard.press('Space');
  await expect(button).toHaveText('Sound off');
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
  await page.screenshot({ path: test.info().outputPath('one-tap-mute.png') });
  await page.reload();
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing'));
  await expect(await soundControl(page)).toHaveText('Sound off');
});
