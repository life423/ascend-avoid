import { test, expect } from '@playwright/test';
import { openLesson, readPractice, practiceInput, playPractice } from './helpers/practice.mjs';

test.skip(!process.env.PRACTICE_E2E, 'explicit tutorial readiness checks');
test.beforeEach(({ page }) => page.on('pageerror', error => { throw error; }));

for (const direction of [-1, 1]) {
  test(`a thumb or key held ${direction < 0 ? 'left' : 'right'} before Ready works without lifting`, async ({ page, browserName, hasTouch }) => {
    test.setTimeout(60000);
    await openLesson(page, 'defense');
    const input = await practiceInput(page, browserName, hasTouch);
    try {
      for (const stage of ['rear-cover', 'injured-escape']) {
        if (stage === 'injured-escape') await playPractice(page, input, { until: v => v.stage === stage && v.phase === 'ready' });
        await expect(page.locator('.practice-instruction')).toContainText(stage === 'rear-cover' ? 'Puff & flee' : 'Escape while injured');
        const before = await readPractice(page);
        await input.move(direction, 0);
        await page.waitForTimeout(180);
        expect((await readPractice(page)).me.x).toBeCloseTo(before.me.x, 0);
        await input.tapButton(page.getByRole('button', { name: 'Ready', exact: true }));
        await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'waiting');
        await expect.poll(async () => direction * ((await readPractice(page)).me.x - before.me.x), { timeout: 1000 }).toBeGreaterThan(6);
        await input.stop();
        expect((await readPractice(page)).attempt).toBe(before.attempt);
      }
      // Left deliberately moves toward this pursuer. It must steer, but is not
      // an escape strategy; the away-direction case proves a clean completion.
      if (direction > 0) {
        const result = await playPractice(page, input);
        expect(result.completed).toContain('defense');
        expect(result.failures).toBe(0);
      }
    } finally { await input.close(); }
  });
}

test('a held escape direction survives the transition into the injured exercise', async ({ page, browserName, hasTouch }) => {
  test.setTimeout(45000);
  await openLesson(page, 'defense');
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    await input.move(1, 0);
    await input.tapButton(page.getByRole('button', { name: 'Ready', exact: true }));
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.cue === 'attacking');
    await input.tap();
    await page.waitForFunction(() => {
      const v = window.game.currentGameMode.multiplayerManager.getState().practice;
      return v.stage === 'injured-escape' && v.phase === 'ready';
    });
    await page.waitForTimeout(150);
    const before = await readPractice(page);
    await input.tapButton(page.getByRole('button', { name: 'Ready', exact: true }));
    await expect.poll(async () => (await readPractice(page)).me.x - before.me.x, { timeout: 1000 }).toBeGreaterThan(6);
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
    expect((await readPractice(page)).failures).toBe(0);
  } finally { await input.close(); }
});

test('Ready discards a held action without firing the prepared captive', async ({ page, browserName, hasTouch }) => {
  await openLesson(page, 'combat');
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    const before = await readPractice(page);
    await input.hold();
    await page.waitForTimeout(240);
    await input.tapButton(page.getByRole('button', { name: 'Ready', exact: true }));
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase !== 'ready');
    await input.releaseAction();
    await page.waitForTimeout(250);
    const after = await readPractice(page);
    expect(after.me.gulping).toBe(before.me.gulping);
    expect(after.me.inhaling).toBe(false);
    expect(after.failures).toBe(0);
    expect(await page.evaluate(() => window.game.currentGameMode.cannonHits.length)).toBe(0);
  } finally { await input.close(); }
});

test('defense stages are distinct and lesson actions fit beside mobile play controls', async ({ page, browserName, hasTouch }) => {
  test.setTimeout(60000);
  await openLesson(page, 'defense');
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    for (const stage of ['rear-cover', 'injured-escape']) {
      if (stage === 'injured-escape') await playPractice(page, input, { until: v => v.stage === stage && v.phase === 'ready' });
      const panel = await page.locator('.practice-panel').boundingBox();
      const dock = await page.locator('.practice-actions').boundingBox();
      const { width, height } = page.viewportSize();
      expect(dock.x).toBeGreaterThanOrEqual(0);
      expect(dock.x + dock.width).toBeLessThanOrEqual(width + 1);
      expect(dock.y + dock.height).toBeLessThanOrEqual(height + 1);
      if (hasTouch) {
        expect(dock.y).toBeGreaterThan(height / 2);
        expect(dock.y).toBeGreaterThan(panel.y + panel.height);
        if (width > height) {
          expect(dock.x).toBeGreaterThanOrEqual(168);
          expect(dock.x + dock.width).toBeLessThanOrEqual(width - 168);
        } else expect(dock.y + dock.height).toBeLessThanOrEqual(height - 150);
      }
      for (const name of ['Ready', 'Skip lesson', 'Exit tutorial']) {
        expect(await page.getByRole('button', { name, exact: true }).evaluate(el => {
          const r = el.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
          return r.height >= 44 && (el === hit || el.contains(hit));
        })).toBe(true);
      }
      await page.screenshot({ path: test.info().outputPath(`${stage}-ready.png`), scale: 'css' });
    }
    await page.getByRole('button', { name: 'Choose any lesson', exact: true }).click();
    await expect(page.locator('[data-lesson="defense"]')).toContainText('Two exercises: Puff & flee, then Escape while injured');
    expect(await page.locator('[data-lesson="defense"]').count()).toBe(1);
    expect(await page.locator('[data-lesson]').count()).toBe(5);
  } finally { await input.close(); }
});
