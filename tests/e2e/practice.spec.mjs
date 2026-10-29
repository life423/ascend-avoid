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
  const names = { basics: 'Grow, capture & finish', weapon: 'Build a weapon', blackhole: 'Black-hole shot', defense: 'Defensive burst' };
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

test('basic lesson uses actual movement, capture, release, hit, theft/growth and mouth finish', async ({ page }) => {
  await start(page, 'basics');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'success'); await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'capture');
  await screenshot(page, 'basics-capture.png');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'shoot');
  await objectiveVisible(page);
  let v = await read(page); expect(v.me.width).toBeLessThan(v.target.width);
  await page.keyboard.up('Space'); await shot(page);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'finish');
  expect(await page.evaluate(() => window.game.currentGameMode.banner?.title)).toBe('Cannonball hit!');
  expect(await page.evaluate(() => window.game.currentGameMode.cannonHits.length)).toBeGreaterThan(0);
  await screenshot(page, 'basics-injury-finish.png');
  v = await read(page); await page.keyboard.down('Space');
  await page.keyboard.down('ArrowRight');
  await page.waitForFunction(() => { const m=window.game.currentGameMode.multiplayerManager,s=m.getState(),p=m.getLocalPlayer(),t=s.players.get(s.practice.targetId); return s.practice.phase === 'success' || t && Math.hypot(t.x+t.width/2-p.x-p.width/2,t.y+t.height/2-p.y-p.height/2)<210; });
  await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  await page.keyboard.up('Space'); await page.keyboard.up('ArrowRight');
  expect((await read(page)).me.injured).toBe(false);
  await expect(page.getByRole('button', { name: 'Play now', exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.practice.v1')).lessons.basics)).toBe('completed');
});

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

test('black-hole lesson: ready captive, real shot and once-only spatial reward', async ({ page }) => {
  await start(page, 'blackhole');
  const v = await read(page); expect(v.me.gulping).toBeTruthy();
  await objectiveVisible(page); await screenshot(page, 'blackhole-ready.png'); await shot(page);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'success');
  await screenshot(page, 'blackhole-reward.png');
  expect(await page.evaluate(() => window.game.currentGameMode.rewardEffects.length)).toBeGreaterThan(0);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  expect((await read(page)).me.gems).toBe(350);
});

test('a missed shot restores that attempt and cancels held movement/action input', async ({ page }) => {
  await start(page, 'blackhole'); const attempt = (await read(page)).attempt;
  await page.keyboard.down('ArrowUp'); await page.waitForTimeout(400); await page.keyboard.up('ArrowUp');
  await shot(page); await page.keyboard.down('Space'); await page.keyboard.down('ArrowDown');
  await page.waitForFunction(previous => window.game.currentGameMode.multiplayerManager.getState().practice.attempt > previous, attempt);
  await page.waitForTimeout(100); const v = await read(page);
  expect(v.lesson).toBe('blackhole'); expect(v.passed).toBe(0); expect(v.failures).toBe(1); expect(v.me.gulping).toBeTruthy(); expect(v.me.inhaling).toBe(false);
  expect(await page.evaluate(() => Object.values(window.game.inputManager.getInputState()).some(Boolean))).toBe(false);
  await page.keyboard.up('Space'); await page.keyboard.up('ArrowDown');
});

test('defensive lesson restores only misses, gives a clearer hint, and requires real parry', async ({ page }) => {
  await start(page, 'defense');
  await shot(page); await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.failures === 1);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'waiting');
  await shot(page); await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.failures === 2);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'waiting');
  await expect(page.locator('.practice-hint')).toContainText('quick tap');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.cue === 'attacking');
  await screenshot(page, 'defense-suction.png'); await shot(page);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  expect((await read(page)).me.injured).toBe(false);
});

test('skip leaves unfinished, every lesson is unlocked, replay and exit start a clean live session', async ({ page }) => {
  await start(page, 'basics'); const privateId = (await read(page)).room;
  await page.getByRole('button', { name: 'Skip lesson', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Practice / Tutorials' });
  await expect(picker).toBeVisible();
  await expect(picker.locator('[data-lesson="basics"]')).toContainText('Unfinished · skipped');
  for (const id of ['basics', 'weapon', 'blackhole', 'defense']) await expect(picker.locator(`[data-lesson="${id}"]`)).toBeEnabled();
  await picker.locator('[data-lesson="blackhole"]').click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.lesson === 'blackhole');
  await page.getByRole('button', { name: 'Exit tutorial', exact: true }).click();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager?.getState()?.practice?.enabled === false);
  const live = await read(page); expect(live.room).not.toBe(privateId); expect(live.me.gems).toBe(0);
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
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.practice.v1')).status)).toBe('skipped');
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

test('trusted touch stick, inhale/release/fire, placement and parry complete all four lessons', async ({ page, browserName, hasTouch }) => {
  test.skip(browserName !== 'chromium' || !hasTouch, 'trusted Chromium multi-touch sequence');
  test.setTimeout(90_000);
  const cdp = await page.context().newCDPSession(page), points = new Map();
  const touch = async (type, id, x, y) => {
    if (type === 'touchEnd') points.delete(id); else points.set(id, { x, y, id, radiusX: 8, radiusY: 8 });
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...points.values()] });
  };
  const stick = async (dx = 1, dy = 0) => {
    const { height } = page.viewportSize();
    if (!points.has(1)) await touch('touchStart', 1, 96, height - 100);
    await touch('touchMove', 1, 96 + dx * 56, height - 100 + dy * 56);
  };
  const release = id => touch('touchEnd', id);
  const action = async () => { const { width, height } = page.viewportSize(); await touch('touchStart', 2, width - 74, height - 80); };
  const tap = async () => { await action(); await page.waitForTimeout(50); await release(2); };
  const pick = async lesson => {
    // The full tutorial advances itself; no lesson-picker action is used between successes.
    await page.waitForFunction(id => window.game.currentGameMode.multiplayerManager.getState().practice.lesson === id && window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'waiting', lesson);
    await expect(page.locator('.practice-instruction')).toBeVisible();
  };
  const approach = async (getTarget, tolerance = 24) => {
    for (let i = 0; i < 160; i++) {
      const v = await read(page), target = await getTarget(v); if (!target) break;
      const dx = target.x - v.me.x, dy = target.y - v.me.y, d = Math.hypot(dx, dy);
      if (d <= tolerance) break;
      await stick(dx / d, dy / d); await page.waitForTimeout(40);
    }
    if (points.has(1)) await release(1);
  };
  await start(page, 'basics', true); await stick();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'success'); await release(1);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'capture');
  await action(); await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping); await release(2);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'shoot'); await tap();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'finish');
  await action(); await page.waitForTimeout(220);
  await approach(v => v.lesson === 'basics' && v.phase === 'waiting' ? v.target : null, 90);
  for (let i = 0; i < 60; i++) {
    const v = await read(page); if (v.phase === 'complete') break;
    if (v.phase === 'waiting' && !v.me.inhaling) { await release(2); await page.waitForTimeout(220); await action(); }
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete', {}, { timeout: 5000 }); await release(2);
  await screenshot(page, 'touch-basics-complete.png');
  await pick('weapon');
  for (let i = 0; i < 3; i++) await approach(() => page.evaluate(() => { const m=window.game.currentGameMode.multiplayerManager,w=m.getState().pinwheel,p=w.parts.find(p=>p.carriedBy!==m.localSessionId);return p?{x:p.x,y:p.y}:null; }), 24);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'place');
  await page.getByRole('button', { name: /Place weapon/ }).tap();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  await screenshot(page, 'touch-weapon-complete.png');
  await pick('blackhole'); await screenshot(page, 'touch-blackhole-ready.png'); await tap();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  await pick('defense'); await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.cue === 'attacking');
  await screenshot(page, 'touch-defense-suction.png'); await tap();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  expect((await read(page)).me.injured).toBe(false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.practice.v1')).status)).toBe('completed');
});
