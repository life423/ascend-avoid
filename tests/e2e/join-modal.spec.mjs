import { expect, test } from '@playwright/test';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires the local build with the join screen');

const joinScreen = page => page.getByRole('dialog', { name: 'Ascend Avoid', exact: true });
const nameField = page => joinScreen(page).getByRole('textbox', { name: 'Your name', exact: true });
const play = (page, returning = false) => joinScreen(page).getByRole('button', { name: returning ? 'Play' : 'Play now', exact: true });
const tutorial = page => joinScreen(page).getByRole('button', { name: 'Tutorial', exact: true });
const steering = (page, mode) => joinScreen(page).getByRole('radio', { name: mode, exact: true });

const arena = page => page.evaluate(() => {
  const mode = window.game?.currentGameMode;
  const manager = mode?.multiplayerManager;
  const state = manager?.getState();
  const player = manager?.getLocalPlayer();
  return {
    roomId: manager?.getRoom()?.id ?? null,
    time: state?.time ?? 0,
    worldWidth: state?.worldWidth ?? 0,
    rendered: Boolean(mode?.renderView),
    renderedBot: [...(state?.players?.values() ?? [])].some(bot => bot.isBot && mode?.drawnPositions?.has(bot.sessionId)),
    player: player ? { name: player.name, x: player.x, state: player.state } : null,
    lesson: state?.practice?.enabled ? state.practice.lesson : null,
    sequence: Boolean(state?.practice?.sequence),
  };
});

async function seeLivePreview(page) {
  await expect(joinScreen(page)).toBeVisible();
  await expect(page.locator('canvas.game-canvas')).toBeVisible();
  await expect.poll(async () => {
    const state = await arena(page);
    return state.rendered && state.renderedBot && state.worldWidth > 0;
  }).toBe(true);
  const time = (await arena(page)).time;
  await expect.poll(async () => (await arena(page)).time).toBeGreaterThan(time);
  expect((await arena(page)).player).toBeNull();
}

test('live arena preview waits for Play and remembers the chosen name and steering', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await seeLivePreview(page);
  const watchedRoom = (await arena(page)).roomId;
  const desktopSteering = await page.evaluate(() => matchMedia('(pointer: fine)').matches);
  await expect(tutorial(page)).toBeVisible();
  if (desktopSteering) {
    await expect(steering(page, 'Keyboard')).toBeChecked();
    await steering(page, 'Mouse').check();
    await expect(steering(page, 'Mouse')).toBeChecked();
  } else {
    await expect(steering(page, 'Keyboard')).toHaveCount(0);
    await expect(steering(page, 'Mouse')).toHaveCount(0);
  }
  await nameField(page).fill('Ridge Runner');
  expect((await arena(page)).player).toBeNull();
  await page.screenshot({ path: test.info().outputPath('first-visit.png'), scale: 'css' });
  await play(page).click();
  await expect(joinScreen(page)).toBeHidden();
  await expect.poll(async () => (await arena(page)).player?.name).toBe('Ridge Runner');
  expect((await arena(page)).roomId).toBe(watchedRoom);
  expect((await arena(page)).lesson).toBeNull();

  await page.reload();
  await seeLivePreview(page);
  await expect(nameField(page)).toHaveValue('Ridge Runner');
  if (desktopSteering) await expect(steering(page, 'Mouse')).toBeChecked();
  await expect(play(page, true)).toBeVisible();
  await expect(joinScreen(page).getByRole('button')).toHaveCount(1);
  await expect(tutorial(page)).toHaveCount(0);
  await play(page, true).click();
  await expect.poll(async () => (await arena(page)).player?.name).toBe('Ridge Runner');
  expect(errors).toEqual([]);
});

test('Tutorial enters the first private lesson directly from a fresh preview', async ({ page }) => {
  await page.goto('/');
  await seeLivePreview(page);
  await nameField(page).fill('First Lesson');
  await tutorial(page).click();
  await expect(joinScreen(page)).toBeHidden();
  await expect.poll(async () => (await arena(page)).lesson).toBe('basics');
  await expect.poll(async () => (await arena(page)).player?.name).toBe('First Lesson');
  expect((await arena(page)).sequence).toBe(true);
  await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
});

test('leaving the initial preview without choosing still returns to Play only', async ({ page }) => {
  await page.goto('/');
  await expect(tutorial(page)).toBeVisible();
  await page.reload();
  await seeLivePreview(page);
  await expect(play(page, true)).toBeVisible();
  await expect(tutorial(page)).toHaveCount(0);
});

test('the phone join screen leads to ordinary joystick movement', async ({ page, browserName, hasTouch }) => {
  test.skip(!hasTouch, 'exercises touch controls');
  await page.goto('/');
  await seeLivePreview(page);
  const bounds = await joinScreen(page).evaluate(dialog => {
    const rect = dialog.getBoundingClientRect();
    return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight;
  });
  expect(bounds).toBe(true);
  await play(page).tap();
  await expect(joinScreen(page)).toBeHidden();
  await expect.poll(async () => (await arena(page)).player?.state).toBe('alive');
  await page.waitForFunction(() => !window.game.currentGameMode.introPlaying);
  const start = await arena(page);
  const direction = start.player.x < start.worldWidth / 2 ? 1 : -1;
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    await input.move(direction, 0);
    await expect.poll(async () => direction * ((await arena(page)).player?.x - start.player.x), { timeout: 3000 })
      .toBeGreaterThan(20);
  } finally {
    await input.close();
  }
});
