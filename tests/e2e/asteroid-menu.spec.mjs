import { test, expect } from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import { openLesson, readPractice, practiceInput, playPractice } from './helpers/practice.mjs';

test.setTimeout(100_000);

async function expectHaulVisible(page) {
  const layout = await page.evaluate(() => {
    const mode = window.game.currentGameMode, manager = mode.multiplayerManager, state = manager.getState(), p = manager.getLocalPlayer();
    const view = mode.lastView, canvas = document.querySelector('canvas.game-canvas'), box = canvas.getBoundingClientRect(), u = box.width / canvas.width;
    const rect = (x, y, radius) => ({ left: box.left + (canvas.width / 2 + (x - radius - view.x) * view.scale) * u, right: box.left + (canvas.width / 2 + (x + radius - view.x) * view.scale) * u,
      top: box.top + (canvas.height / 2 + (y - radius - view.y) * view.scale) * u, bottom: box.top + (canvas.height / 2 + (y + radius - view.y) * view.scale) * u });
    const position = mode.predicted ?? p, x = position.x + p.width / 2, y = position.y + p.height / 2, r = p.width / 2, fx = Math.cos(mode.localFacing), fy = Math.sin(mode.localFacing);
    const overlays = [...document.querySelectorAll('.practice-panel, .practice-actions')].map(el => { const r = el.getBoundingClientRect(); return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}; });
    return { body: rect(x,y,r), cargo: rect(state.relic.x,state.relic.y,250), eyes:[-1,1].map(side=>rect(x+fx*r*.42-fy*r*.36*side,y+fy*r*.42+fx*r*.36*side,r*.28)),
      overlays, controls:mode.controls?.touchBounds()??[], viewport:{left:box.left,right:box.right,top:box.top,bottom:box.bottom} };
  });
  const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  for (const rect of [layout.body, layout.cargo]) {
    expect(rect.left).toBeGreaterThanOrEqual(layout.viewport.left-3); expect(rect.right).toBeLessThanOrEqual(layout.viewport.right+3);
    expect(rect.top).toBeGreaterThanOrEqual(layout.viewport.top-3); expect(rect.bottom).toBeLessThanOrEqual(layout.viewport.bottom+3);
  }
  for (const rect of [...layout.eyes, layout.cargo]) for (const obstacle of [...layout.overlays,...layout.controls]) expect(overlaps(rect,obstacle),JSON.stringify({rect,obstacle,layout})).toBe(false);
}

async function earnAsteroid(page, browserName, hasTouch) {
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    await playPractice(page, input, { until: v => v.stage === 'strike' && ['ready', 'waiting'].includes(v.phase) });
  } finally { await input.close(); }
  const state = await readPractice(page);
  expect(state.passed).toBe(2);
  expect(state.me.relicCometReady).toBe(true);
  if (state.phase === 'ready') await page.getByRole('button', { name: 'Ready', exact: true }).click();
  return readPractice(page);
}

test('asteroid practice requires hooking and dragging the relic across the map before launching', async ({ page, browserName, hasTouch }) => {
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
  await expect(lesson).toContainText('drag it across the map');
  await page.screenshot({ path: test.info().outputPath('asteroid-picker.png'), scale: 'css' });
  await lesson.click();
  await expect(page.getByRole('button', { name: 'Ready', exact: true })).toBeVisible();
  const prepared = await readPractice(page);
  expect(prepared.enabled).toBe(true);
  expect(prepared.lesson).toBe('asteroid');
  expect(prepared.stage).toBe('hook');
  expect(prepared.total).toBe(3);
  expect(prepared.me.width).toBeGreaterThanOrEqual(1100);
  expect(prepared.me.relicCometReady).toBe(false);
  expect(prepared.relic.phase).toBe('available');
  expect(prepared.relic.carrierId).toBe('');
  await expect(page.getByRole('button', { name: 'Aim asteroid', exact: true })).toHaveCount(0);
  await expect(page.locator('.relic-tutorial')).toHaveCount(0);
  await page.waitForTimeout(1000);
  expect((await readPractice(page)).phase).toBe('ready');
  await page.screenshot({ path: test.info().outputPath('asteroid-prepared.png'), scale: 'css' });
  const input = await practiceInput(page, browserName, hasTouch), stages = new Set();
  let pickedUp = false, delivered = false, midHaulShown = false;
  try {
    await playPractice(page, input, { onStage: async v => {
      stages.add(v.stage);
      if (v.stage === 'tow' && ['ready', 'waiting'].includes(v.phase)) {
        expect(v.relic.phase).toBe('towed');
        expect(v.relic.carrierId).not.toBe('');
        expect(v.me.relicCometReady).toBe(false);
        await expect(page.getByRole('button', { name: 'Aim asteroid', exact: true })).toHaveCount(0);
        pickedUp = true;
        if (v.phase === 'ready') {
          // The movement held through pickup must not visually or physically move the paused scene.
          const frozen = await readPractice(page);
          await page.waitForTimeout(400);
          const paused = await readPractice(page);
          expect(paused.me.x).toBe(frozen.me.x); expect(paused.me.y).toBe(frozen.me.y);
          expect(paused.relic.x).toBe(frozen.relic.x); expect(paused.relic.y).toBe(frozen.relic.y);
          const predicted = await page.evaluate(() => {
            const mode = window.game.currentGameMode, p = mode.multiplayerManager.getLocalPlayer();
            return { x: mode.predicted.x + p.width / 2, y: mode.predicted.y + p.height / 2, facing: mode.localFacing };
          });
          expect(predicted.x).toBe(paused.me.x); expect(predicted.y).toBe(paused.me.y);
          expect(predicted.facing).toBe(paused.me.facing);
        }
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expectHaulVisible(page);
        await page.screenshot({ path: test.info().outputPath('asteroid-towing.png'), scale: 'css' });
        if (v.phase === 'waiting' && !midHaulShown) {
          const dx = v.relic.relayX - v.me.x, dy = v.relic.relayY - v.me.y, distance = Math.max(1, Math.hypot(dx,dy));
          await input.move(dx/distance,dy/distance);
          await page.waitForTimeout(6000);
          await input.stop();
          await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          await expectHaulVisible(page);
          await page.screenshot({ path: test.info().outputPath('asteroid-mid-haul.png'), scale: 'css' });
          midHaulShown = true;
        }
      }
      if (v.stage === 'strike' && ['ready', 'waiting'].includes(v.phase)) {
        expect(pickedUp).toBe(true);
        expect(v.me.relicCometReady).toBe(true);
        expect(v.passed).toBe(2);
        expect(v.room).toBe(prepared.room);
        expect(Math.hypot(v.relic.x - prepared.relic.x, v.relic.y - prepared.relic.y)).toBeGreaterThan(1500);
        expect(Math.hypot(v.relic.x - v.relic.relayX, v.relic.y - v.relic.relayY)).toBeLessThanOrEqual(125);
        delivered = true;
        await page.screenshot({ path: test.info().outputPath('asteroid-delivered.png'), scale: 'css' });
      }
      if (v.cue === 'inbound') await page.screenshot({ path: test.info().outputPath('asteroid-inbound.png'), scale: 'css' });
    } });
  } finally { await input.close(); }
  expect([...stages]).toEqual(['hook', 'tow', 'strike']);
  expect(delivered).toBe(true);
  await expect(page.locator('.practice-instruction')).toContainText(/complete/i);
  expect((await readPractice(page)).completed).toContain('asteroid');
  expect(errors).toEqual([]);
});

test('missing restores the earned asteroid without repeating the completed haul', async ({ page, browserName, hasTouch }) => {
  await openLesson(page, 'asteroid');
  const initial = await earnAsteroid(page, browserName, hasTouch);
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
  expect(retry.stage).toBe('strike');
  expect(retry.me.width).toBeGreaterThanOrEqual(1100);
  expect(retry.me.relicCometReady).toBe(true);
  expect(retry.passed).toBe(2);
  expect(retry.completed).toBe('');
  await expect(page.getByRole('button', { name: 'Aim asteroid', exact: true })).toBeVisible();
  const input = await practiceInput(page, browserName, hasTouch);
  try { await playPractice(page, input); } finally { await input.close(); }
});

test('the earned launch map supports cancel and keyboard aiming without moving the giant', async ({ page, browserName, hasTouch }) => {
  await openLesson(page, 'asteroid');
  await earnAsteroid(page, browserName, hasTouch);
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
