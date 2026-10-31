import { test, expect } from '@playwright/test';

// Runs against a local production server: no test commands, state injection or fake success.
test.skip(!process.env.PRACTICE_E2E, 'explicit local practice release checks');
const pageErrors = new WeakMap();
test.beforeEach(({ page }) => { const errors = []; pageErrors.set(page, errors); page.on('pageerror', error => errors.push(error.message)); });
test.afterEach(({ page }) => { expect(pageErrors.get(page)).toEqual([]); });
const read = page => page.evaluate(() => {
  const m = window.game.currentGameMode.multiplayerManager, s = m.getState(), p = m.getLocalPlayer(), v = s.practice;
  const t = s.players.get(v.targetId);
  return { ...v.toJSON(), room: m.getRoom().id, me: { x: p.x + p.width / 2, y: p.y + p.height / 2, gems: p.gems, width: p.width, facing: p.facing, inhaling: p.inhaling, gulping: p.gulping, injured: p.breathingBlocked }, target: t ? { x: t.x + t.width / 2, y: t.y + t.height / 2, width: t.width, gems: t.gems } : null };
});
async function start(page, lesson, sequence = false) {
  await page.addInitScript(() => { localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await page.evaluate(() => window.drawerUI.open());
  await page.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  const names = { basics: 'Move, grow & capture', combat: 'Aim, hit & finish', defense: 'Escape & recover', blackhole: 'Black-hole shot', weapon: 'Build a weapon' };
  if (sequence) await page.getByRole('button', { name: 'Start full tutorial', exact: true }).click();
  else await page.locator(`[data-lesson="${lesson}"]`).click();
  await page.waitForFunction(id => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.lesson === id, lesson);
  await expect(page.locator('.practice-heading')).toContainText(names[lesson]);
  await expect(page.locator('.practice-instruction')).toBeVisible();
  // DOM button focus must not swallow subsequent gameplay keys.
  await page.locator('canvas').first().click({ position: { x: 10, y: 250 } });
}
async function walk(page, x, y, stop = 8) {
  let held = [];
  for (let i = 0; i < 120; i++) {
    const { me } = await read(page); const dx = x - me.x, dy = y - me.y;
    if (Math.hypot(dx, dy) < stop) break;
    const next = [Math.abs(dx) > stop / 2 && (dx > 0 ? 'ArrowRight' : 'ArrowLeft'), Math.abs(dy) > stop / 2 && (dy > 0 ? 'ArrowDown' : 'ArrowUp')].filter(Boolean);
    for (const k of held.filter(k => !next.includes(k))) await page.keyboard.up(k);
    for (const k of next.filter(k => !held.includes(k))) await page.keyboard.down(k);
    held = next; await page.waitForTimeout(50);
  }
  for (const k of held) await page.keyboard.up(k);
}
async function shot(page) { await page.keyboard.press('Space'); }
async function captureForBlackHole(page) {
  const initial = await read(page); expect(initial.stage).toBe('capture'); expect(initial.me.gulping).toBeFalsy();
  await page.keyboard.down('Space');
  await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'shoot');
  await page.keyboard.up('Space');
}
async function screenshot(page, file) { await page.screenshot({ path: test.info().outputPath(file), scale: 'css' }); }
async function objectiveVisible(page) {
  await expect.poll(() => page.evaluate(() => {
    const mode = window.game.currentGameMode, s = mode.multiplayerManager.getState(), o = s.practice, v = mode.lastView, c = window.game.canvas;
    if (!v || !o.objectiveKind || o.objectiveKind === 'placement') return true;
    const t = s.players.get(o.targetId), x = t ? t.x + t.width / 2 : o.objectiveX, y = t ? t.y + t.height / 2 : o.objectiveY;
    const r = t ? t.width / 2 + 14 : o.objectiveKind === 'hole' ? 80 : 24;
    const px = (x - v.x) * v.scale + c.width / 2, py = (y - v.y) * v.scale + c.height / 2;
    return px - r * v.scale >= 0 && px + r * v.scale <= c.width && py - r * v.scale >= 0 && py + r * v.scale <= c.height;
  })).toBe(true);
}


test('weapon lesson: real collection, automatic assembly, E/touch placement and actual Pulsar damage', async ({ page, hasTouch }) => {
  await start(page, 'weapon');
  await screenshot(page, 'weapon-parts.png');
  for (let i = 0; i < 3; i++) {
    const point = await page.evaluate(() => {
      const m = window.game.currentGameMode.multiplayerManager, w = m.getState().pinwheel;
      const part = w.parts.find(p => p.carriedBy !== m.localSessionId); return part ? { x: part.x, y: part.y } : null;
    });
    if (!point) break; await walk(page, point.x, point.y, 18);
  }
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'place');
  if (hasTouch) await page.getByRole('button', { name: /Place weapon/ }).click(); else await page.keyboard.press('e');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'effect');
  await screenshot(page, 'weapon-placed.png');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  expect((await read(page)).me.injured).toBe(false);
});

test('black-hole lesson: actual capture, distant shot and visible once-only spatial reward', async ({ page }) => {
  await start(page, 'blackhole');
  await screenshot(page, 'blackhole-capture.png');
  await captureForBlackHole(page);
  const v = await read(page); expect(v.me.gulping).toBeTruthy(); expect(v.passed).toBe(1); expect(v.total).toBe(2);
  expect(v.objectiveX - v.me.x).toBeGreaterThanOrEqual(500);
  expect(v.me.gems).toBe(318);
  await objectiveVisible(page); await screenshot(page, 'blackhole-ready.png'); await shot(page);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'success');
  await expect(page.locator('.practice-instruction')).toContainText('gems return');
  await page.waitForTimeout(1000);
  expect((await read(page)).phase).toBe('success');
  await objectiveVisible(page);
  await screenshot(page, 'blackhole-reward.png');
  expect(await page.evaluate(() => window.game.currentGameMode.rewardEffects.some(e => e.how === 'blackhole' && e.earned === 32))).toBe(true);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  expect((await read(page)).me.gems).toBe(350);
});

test('a missed shot restores that attempt and cancels held movement/action input', async ({ page }) => {
  await start(page, 'blackhole'); await captureForBlackHole(page); const attempt = (await read(page)).attempt;
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('ArrowUp');
  await shot(page); await page.keyboard.down('Space'); await page.keyboard.down('ArrowDown');
  await page.waitForFunction(previous => window.game.currentGameMode.multiplayerManager.getState().practice.attempt > previous, attempt);
  await page.waitForTimeout(100); const v = await read(page);
  expect(v.lesson).toBe('blackhole'); expect(v.stage).toBe('shoot'); expect(v.passed).toBe(1); expect(v.failures).toBe(1); expect(v.me.gulping).toBeTruthy(); expect(v.me.inhaling).toBe(false);
  expect(await page.evaluate(() => Object.values(window.game.inputManager.getInputState()).some(Boolean))).toBe(false);
  await page.keyboard.up('Space'); await page.keyboard.up('ArrowDown');
});


test('skip leaves unfinished, every lesson is unlocked, replay and exit start a clean live session', async ({ page }) => {
  await start(page, 'basics'); const privateId = (await read(page)).room;
  await page.getByRole('button', { name: 'Skip lesson', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Practice / Tutorials' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-lesson="basics"]')).toContainText('Unfinished · skipped');
  for (const id of ['basics', 'combat', 'defense', 'blackhole', 'weapon']) await expect(picker.locator(`[data-lesson="${id}"]`)).toBeEnabled();
  await picker.locator('[data-lesson="blackhole"]').click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.lesson === 'blackhole');
  await page.getByRole('button', { name: 'Exit tutorial', exact: true }).click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager?.getState()?.practice?.enabled === false);
  const live = await read(page); expect(live.room).not.toBe(privateId); expect(live.me.gulping).toBeFalsy();
  // A live spawn may already collect a real field gem before the browser sees its first tick.
  expect(await page.evaluate(() => {
    const s = window.game.currentGameMode.multiplayerManager.getState();
    return s.worldWidth === 4200 && !s.practice.enabled && [...s.players.keys()].every(id => !id.startsWith('practice-'));
  })).toBe(true);
  await page.reload(); await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await expect(page.locator('.practice-offer')).toBeHidden();
});

test('picker and instructions fit viewport, keep focus and cancel held input on blur', async ({ page }) => {
  await start(page, 'defense');
  await page.keyboard.down('Space'); await page.waitForTimeout(220);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.keyboard.up('Space');
  await expect.poll(async () => (await read(page)).me.inhaling).toBe(false);
  await page.getByRole('button', { name: 'Choose any lesson' }).click();
  const picker = page.getByRole('dialog', { name: 'Practice / Tutorials' });
  await page.keyboard.press('Shift+Tab'); // first lesson -> close picker, all inside the dialog
  expect(await page.evaluate(() => !!document.activeElement.closest('.practice-chooser'))).toBe(true);
  await screenshot(page, 'lesson-picker.png');
  expect(await picker.evaluate(el => el.scrollWidth <= innerWidth && el.scrollHeight <= innerHeight)).toBe(true);
  await page.keyboard.press('Escape');
  const panel = page.locator('.practice-panel'); const rect = await panel.boundingBox();
  expect(rect.x).toBeGreaterThanOrEqual(0); expect(rect.x + rect.width).toBeLessThanOrEqual(page.viewportSize().width + 1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThan(2);
});

test('blocked storage still permits lessons and an old guide flag never completes them', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => { throw Error('blocked storage'); };
    Storage.prototype.setItem = () => { throw Error('blocked storage'); };
  });
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await page.evaluate(() => window.drawerUI.open());
  await page.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  await expect(page.locator('[data-lesson="weapon"]')).toContainText('Ready to try');
  await page.locator('[data-lesson="defense"]').click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager?.getState()?.practice?.enabled);
  await expect(page.locator('.practice-panel')).toBeVisible();
});

test('first visit offers Play tutorial directly and Not now dismisses without starting it', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Play tutorial', exact: true })).toBeVisible();
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getState().practice.enabled)).toBe(false);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  await expect(page.locator('.practice-offer')).toBeHidden();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.practice.v2')).status)).toBe('skipped');
  await page.reload(); await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await expect(page.locator('.practice-offer')).toBeHidden();
  await page.evaluate(() => window.drawerUI.open()); await page.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  await page.getByRole('button', { name: 'Start full tutorial', exact: true }).click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager?.getState()?.practice?.sequence === true);
});

test('first-visit Play tutorial starts the full sequence without another picker', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Play tutorial', exact: true }).click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager?.getState()?.practice?.sequence === true);
  await expect(page.getByRole('dialog', { name: 'Practice / Tutorials' })).toBeHidden();
  expect((await read(page)).lesson).toBe('basics');
});

test('exiting during a delayed private connection leaves its late room and stays in live play', async ({ page }) => {
  let created;
  await page.route('**/matchmake/create/tutorial_room', async route => {
    const response = await route.fetch(); created = await response.json();
    await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ response });
  });
  await page.goto('/'); await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await page.evaluate(() => window.drawerUI.open()); await page.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  await page.locator('[data-lesson="weapon"]').click();
  await page.getByRole('button', { name: 'Exit tutorial', exact: true }).click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager?.getState()?.practice?.enabled === false);
  await page.waitForTimeout(1000);
  expect((await read(page)).enabled).toBe(false);
  expect(created?.room?.name).toBe('tutorial_room');
});

test('finished private rooms expire without automatic room creation', async ({ page, browserName, hasTouch }) => {
  test.skip(browserName !== 'chromium' || hasTouch, 'one real expiry check'); test.setTimeout(80_000);
  let creates = 0; page.on('request', request => { if (request.url().includes('/matchmake/create/tutorial_room')) creates++; });
  await start(page, 'defense');
  await page.getByRole('button', { name: 'Skip lesson', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Practice / Tutorials' })).toBeVisible();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getRoom() === null, {}, { timeout: 65_000 });
  await expect(page.locator('.practice-panel')).toContainText('Your private session ended');
  await page.waitForTimeout(2500); expect(creates).toBe(1);
  await page.getByRole('button', { name: 'Choose lesson', exact: true }).click();
  await page.locator('[data-lesson="weapon"]').click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager?.getState()?.practice?.lesson === 'weapon');
  expect(creates).toBe(2);
});
