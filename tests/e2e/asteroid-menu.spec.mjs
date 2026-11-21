import { test, expect } from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import { openLesson, readPractice, practiceInput, playPractice } from './helpers/practice.mjs';

test('asteroid is a regular private lesson, already large and ready to launch', async ({ page, browserName, hasTouch }) => {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await enterGame(page);
  await page.evaluate(() => window.drawerUI.open());
  const menu = page.getByRole('dialog', { name: 'Game Menu' });
  await expect(menu.getByRole('button', { name: /asteroid tutorial/i })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Practice / Tutorials' });
  await expect(picker.locator('[data-lesson]')).toHaveCount(6);
  const lesson = picker.locator('[data-lesson="asteroid"]');
  await lesson.scrollIntoViewIfNeeded();
  await expect(lesson).toContainText('Start large with an asteroid ready');
  await page.screenshot({ path: test.info().outputPath('asteroid-picker.png'), scale: 'css' });
  await lesson.click();
  await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
  const prepared = await readPractice(page);
  expect(prepared.enabled).toBe(true);
  expect(prepared.lesson).toBe('asteroid');
  expect(prepared.me.width).toBeGreaterThanOrEqual(1100);
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().relicCometReady)).toBe(true);
  await page.waitForTimeout(1000);
  expect((await readPractice(page)).phase).toBe('ready');
  await page.screenshot({ path: test.info().outputPath('asteroid-prepared.png'), scale: 'css' });
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    await playPractice(page, input, { onStage: async v => {
      if (v.cue === 'inbound') await page.screenshot({ path: test.info().outputPath('asteroid-inbound.png'), scale: 'css' });
    } });
  } finally { await input.close(); }
  await expect(page.locator('.practice-instruction')).toContainText(/complete/i);
  expect((await readPractice(page)).completed).toContain('asteroid');
  expect(errors).toEqual([]);
});

test('missing restores the same giant and a ready asteroid for another attempt', async ({ page, browserName, hasTouch }) => {
  await openLesson(page, 'asteroid');
  const initial = await readPractice(page);
  await page.getByRole('button', { name: 'Ready', exact: true }).click();
  await page.getByRole('button', { name: 'Aim asteroid', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Launch an asteroid' });
  const map = dialog.getByRole('group', { name: 'Arena map' });
  await page.screenshot({ path: test.info().outputPath('asteroid-map.png'), scale: 'css' });
  const box = await map.boundingBox(), scale = Math.min(box.width, box.height) / 4200;
  const position = { x: (box.width - 4200 * scale) / 2 + 900 * scale, y: (box.height - 4200 * scale) / 2 + 900 * scale };
  if (hasTouch) { await map.tap({ position }); await dialog.getByRole('button', { name: 'Launch asteroid', exact: true }).tap(); }
  else await map.click({ position });
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await readPractice(page)).attempt, { timeout: 15000 }).toBeGreaterThan(initial.attempt);
  const retry = await readPractice(page);
  expect(retry.phase).toBe('waiting');
  expect(retry.me.width).toBeGreaterThanOrEqual(1100);
  expect(retry.me.gems).toBeGreaterThan(initial.me.gems - 30);
  expect(retry.passed).toBe(0);
  expect(retry.completed).toBe('');
  await expect(page.getByRole('button', { name: 'Aim asteroid', exact: true })).toBeVisible();
  const input = await practiceInput(page, browserName, hasTouch);
  try { await playPractice(page, input); } finally { await input.close(); }
});

test('the launch map supports cancel and keyboard aiming without moving the giant', async ({ page }) => {
  await openLesson(page, 'asteroid');
  await page.getByRole('button', { name: 'Ready', exact: true }).click();
  const aim = page.getByRole('button', { name: 'Aim asteroid', exact: true });
  await aim.click();
  const dialog = page.getByRole('dialog', { name: 'Launch an asteroid' });
  await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(aim).toBeFocused();
  const before = await readPractice(page);
  await page.keyboard.press('Enter');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('KeyA');
  const status = dialog.getByRole('status');
  await expect(status).toContainText('Target');
  const [, across, down] = (await status.textContent()).match(/(\d+)% across, (\d+)% down/);
  const horizontal = Math.round((before.target.x - Number(across) * 42) / 105);
  const vertical = Math.round((before.target.y - Number(down) * 42) / 105);
  for (let i = 0; i < Math.abs(horizontal); i++) await page.keyboard.press(horizontal < 0 ? 'KeyA' : 'KeyD');
  for (let i = 0; i < Math.abs(vertical); i++) await page.keyboard.press(vertical < 0 ? 'KeyW' : 'KeyS');
  await page.keyboard.press('Space');
  await expect(dialog).toBeHidden();
  await expect.poll(async () => (await readPractice(page)).phase, { timeout: 15000 }).toBe('complete');
  const after = await readPractice(page);
  expect(Math.hypot(after.me.x - before.me.x, after.me.y - before.me.y)).toBeLessThan(2);
  expect(after.failures).toBe(0);
});
