import { test, expect } from '@playwright/test';
import { enterGame, playFromEntry } from './helpers/enter-game.mjs';

test.skip(!process.env.PRACTICE_E2E, 'explicit local production interface checks');
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');
  });
  await enterGame(page);
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing'));
});

async function openMenu(page) {
  const dialog = page.getByRole('dialog', { name: 'Game Menu', exact: true });
  if (await dialog.isVisible()) return dialog;
  const compact = page.getByRole('button', { name: 'Toggle menu', exact: true });
  if (await compact.isVisible()) await compact.click();
  else await page.getByRole('button', { name: /Help & settings/ }).filter({ visible: true }).first().click();
  await expect.poll(() => dialog.evaluate(e => e.getBoundingClientRect().left)).toBeGreaterThanOrEqual(-.1);
  await expect.poll(() => dialog.evaluate(e => e.getBoundingClientRect().right - innerWidth)).toBeLessThanOrEqual(.1);
  return dialog;
}
async function soundControl(page) {
  if (page.viewportSize().width < 1200) return (await openMenu(page)).getByRole('button', { name: 'Mute sound effects', exact: true });
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
  const sound = dialog.getByRole('button', { name: 'Mute sound effects', exact: true });
  const silentAppleDevice = await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
  if (silentAppleDevice) {
    await expect(sound).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Background music', exact: true })).toHaveCount(0);
  }
  for (const button of silentAppleDevice ? [tutorial] : [tutorial, sound]) {
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
  test.skip(await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)), 'iPhone and iPad intentionally have no sound controls');
  let button = await soundControl(page);
  await expect(button).toHaveText('Effects on'); await expect(button).toHaveAttribute('aria-pressed', 'false');
  const box = await button.boundingBox(); expect(box.height).toBeGreaterThanOrEqual(44);
  await button.click(); await expect(button).toHaveText('Effects off');
  expect(await page.evaluate(() => localStorage.getItem('ascend.muted'))).toBe('true');
  const dialog = await openMenu(page), setting = dialog.getByRole('button', { name: 'Mute sound effects', exact: true });
  await expect(setting).toHaveText('Effects off'); await expect(setting).toHaveAttribute('aria-pressed', 'true');
  await setting.click(); await expect(setting).toHaveText('Effects on');
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(dialog).toBeHidden();
  button = await soundControl(page);
  await button.focus(); await page.keyboard.press('Space');
  await expect(button).toHaveText('Effects off');
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
  await page.screenshot({ path: test.info().outputPath('one-tap-mute.png') });
  await page.reload();
  await playFromEntry(page);
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing'));
  await expect(await soundControl(page)).toHaveText('Effects off');
});
