import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');

test('gliding over a weapon part collects it without inhaling', async ({ page }) => {
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  await page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room;
    room.send('test:moveTo', { x: 2150, y: 2090 });
    room.send('test:pinwheel', { x: 2100, y: 2100 });
  });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.parts.length === 3);
  await page.keyboard.down('ArrowRight');
  try {
    await page.waitForFunction(() => {
      const room = window.game.currentGameMode.multiplayerManager.room;
      return room.state.pinwheel.parts.some(p => p.carriedBy === room.sessionId);
    });
  } finally { await page.keyboard.up('ArrowRight'); }
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
  await expect.poll(() => page.evaluate(() => window.game.currentGameMode.notices.some(n => n.text.includes('1/3 parts')))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.game.currentGameMode.notices.some(n => n.text.includes('/3 parts'))), { timeout: 5000 }).toBe(false);
  await page.screenshot({ path: test.info().outputPath('quiet-weapon-hud.png') });
});

test('collect, carry and deliberately place a pinwheel with a button or E', async ({ page, hasTouch }) => {
  const errors = [];
  // Colyseus 0.15's caught Node-style socket probe is reported by WebKit before its browser fallback.
  page.on('pageerror', e => { if (!/Wrong protocol for WebSocket '\[object Object\]'/.test(e.message)) errors.push(e.message); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  await page.evaluate(() => {
    const mode = window.game.currentGameMode, room = mode.multiplayerManager.room;
    room.send('test:setGems', { count: 200 });
  });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 200);
  await page.evaluate(() => {
    const mode = window.game.currentGameMode, room = mode.multiplayerManager.room;
    const p = mode.multiplayerManager.getLocalPlayer();
    room.send('test:moveTo', { x: 1840 - p.width * 0.8, y: 2100 - p.height / 2 });
    room.send('test:face', { angle: 0 });
    room.send('test:pinwheel', { x: 2100, y: 2100 });
    mode.localFacing = 0; mode.localSpin = 0; mode.facing = { x: 1, y: 0 };
  });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.parts.length === 3);
  await page.screenshot({ path: test.info().outputPath('pinwheel-parts.png') });
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase === 'carried', null, { timeout: 5000 });
  await page.keyboard.up('Space');
  const builder = await page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room;
    return room.state.pinwheel.owner === room.sessionId;
  });
  expect(builder).toBe(true);
  await expect(page.getByRole('button', { name: 'Place weapon', exact: true })).toBeVisible();
  const buttonBox = await page.getByRole('button', { name: 'Place weapon', exact: true }).boundingBox();
  expect(buttonBox.height).toBeGreaterThanOrEqual(48);
  const before = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.x);
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(350); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(100);
  const carried = await page.evaluate(() => {
    const w = window.game.currentGameMode.multiplayerManager.room.state.pinwheel;
    return { phase: w.phase, x: w.x, bolts: w.bolts.size };
  });
  expect(carried.phase).toBe('carried'); expect(carried.x).toBeGreaterThan(before + 15); expect(carried.bolts).toBe(0);
  await page.screenshot({ path: test.info().outputPath('pinwheel-placement.png') });
  if (hasTouch) {
    await page.setViewportSize({ width: 851, height: 393 });
    await page.waitForTimeout(150);
    const landscapeBox = await page.getByRole('button', { name: 'Place weapon', exact: true }).boundingBox();
    expect(landscapeBox.y).toBeGreaterThan(290);
    await page.screenshot({ path: test.info().outputPath('pinwheel-placement-landscape.png') });
    await page.getByRole('button', { name: 'Place weapon', exact: true }).tap();
  }
  else {
    await page.locator('.bar-name-input').focus();
    await page.keyboard.press('e');
    expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase)).toBe('carried');
    await page.locator('.bar-name-input').evaluate(element => element.blur());
    await page.keyboard.press('e');
  }
  await expect(page.getByRole('button', { name: 'Place weapon', exact: true })).toBeHidden();
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.bolts.size > 0);
  await page.screenshot({ path: test.info().outputPath('pinwheel-firing.png') });
  expect(errors).toEqual([]);
});

test('a collected part stays carried after release, movement and turning; gust spends breath', async ({ page }) => {
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.send('test:setGems', { count: 100 }));
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 100);
  await page.evaluate(() => {
    const m = window.game.currentGameMode, room = m.multiplayerManager.room, p = m.multiplayerManager.getLocalPlayer();
    room.send('test:moveTo', { x: 2210 - p.width * 0.8, y: 2100 - p.height / 2 });
    room.send('test:face', { angle: 0 }); room.send('test:pinwheel', { x: 2100, y: 2100 });
    m.localFacing = 0; m.localSpin = 0; m.facing = { x: 1, y: 0 };
  });
  await page.keyboard.down('Space');
  // Touch pickup may happen immediately; still hold long enough to inhale rather than tap a gust.
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling);
  await page.waitForFunction(() => {
    const r = window.game.currentGameMode.multiplayerManager.room;
    return r.state.pinwheel.parts.some(p => p.carriedBy === r.sessionId);
  });
  await page.keyboard.up('Space');
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(350); await page.keyboard.up('ArrowDown');
  await page.waitForTimeout(100);
  const cargoState = () => page.evaluate(() => {
    const m = window.game.currentGameMode, r = m.multiplayerManager.room, p = m.multiplayerManager.getLocalPlayer();
    const part = r.state.pinwheel.parts.find(part => part.carriedBy === r.sessionId);
    return { carried: !!part, inhaling: p.inhaling, distance: part ? Math.hypot(part.x - p.x - p.width / 2, part.y - p.y - p.height / 2) : 9999, radius: p.width / 2 };
  });
  const cargo = await cargoState();
  expect(cargo.carried).toBe(true); expect(cargo.inhaling).toBe(false);
  await expect.poll(async () => { const settled = await cargoState(); return settled.distance - settled.radius; }, { message: 'cargo settles behind the creature after turning' }).toBeLessThan(45);
  await expect(page.getByRole('button', { name: 'Place weapon', exact: true })).toBeHidden();
  await page.screenshot({ path: test.info().outputPath('carried-part.png') });
  await page.keyboard.press('Space', { delay: 30 });
  await page.waitForFunction(() => window.game.currentGameMode.puffs.length > 0 && window.game.currentGameMode.stamina < 0.85);
  const breath = await page.evaluate(() => window.game.currentGameMode.stamina);
  expect(breath).toBeLessThan(0.85);
});
