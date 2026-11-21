import { expect, test } from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'private relic room');

const send = (page, type, data) => page.evaluate(({ type, data }) => {
  window.game.currentGameMode.multiplayerManager.room.send(type, data);
}, { type, data });
const read = page => page.evaluate(() => {
  const manager = window.game.currentGameMode.multiplayerManager;
  const state = manager.getState(), me = manager.getLocalPlayer();
  return {
    relic: state.relic.toJSON(),
    strike: state.relicComet.toJSON(),
    time: state.time,
    ready: me.relicCometReady,
    gems: me.gems,
    width: me.width,
    injury: me.injuredUntil,
    puffReadyAt: me.puffReadyAt,
    center: { x: me.x + me.width / 2, y: me.y + me.height / 2 },
  };
});

async function join(page, roomId) {
  await page.addInitScript(() => {
    localStorage.setItem('ascend.mouseFollow', 'off');
    window.cometNotices = [];
    window.relicUnlockFrames = 0;
    window.relicTowCueVisible = false;
    const fillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      if (text === 'Relic unlocked') window.relicUnlockFrames++;
      if (/^Tow relic · \d+s$/.test(text)) window.relicTowCueVisible = true;
      if (/comet inbound/i.test(text)) {
        const messages = window.cometNotices;
        if (messages.at(-1) !== text) messages.push(text);
      }
      return fillText.call(this, text, ...args);
    };
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: roomId
      ? route.request().url().replace('/joinOrCreate/game_room', '/joinById/' + roomId)
      : route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({
      ...route.request().postDataJSON(), testRelic: true, testBots: 0, testFieldGems: 0,
      testCalm: true, testCores: 0, testTurbines: false,
    }),
  }));
  await enterGame(page);
}

async function stagePlayer(page, center, gems, minimumWidth) {
  await send(page, 'test:setGems', { count: gems });
  const width = await page.waitForFunction(minimum => {
    const player = window.game.currentGameMode.multiplayerManager.getLocalPlayer();
    return player.width >= minimum && player.width;
  }, minimumWidth).then(handle => handle.jsonValue());
  await send(page, 'test:moveTo', { x: center.x - width / 2, y: center.y - width / 2 });
  await send(page, 'test:protect', { ms: 0 });
}

function mapPosition(box, x, y) {
  const size = Math.min(box.width, box.height);
  return {
    x: (box.width - size) / 2 + size * x / 4200,
    y: (box.height - size) / 2 + size * y / 4200,
  };
}

async function expectClearTutorial(page) {
  await expect.poll(() => page.evaluate(() => {
    const panel = document.querySelector('.relic-tutorial');
    const box = panel.getBoundingClientRect();
    const mode = window.game.currentGameMode;
    const overlaps = other => box.left < other.right && box.right > other.left && box.top < other.bottom && box.bottom > other.top;
    const controls = mode.controls.touchBounds();
    const me = mode.multiplayerManager.getLocalPlayer(), position = mode.predicted ?? me;
    const canvas = document.querySelector('canvas.game-canvas').getBoundingClientRect();
    const view = mode.lastView, scale = view.scale / mode.cssScale, radius = me.width * scale / 2;
    const x = canvas.left + canvas.width / 2 + (position.x + me.width / 2 - view.x) * scale;
    const y = canvas.top + canvas.height / 2 + (position.y + me.width / 2 - view.y) * scale;
    const fx = Math.cos(mode.localFacing), fy = Math.sin(mode.localFacing);
    for (const side of [-1, 1]) {
      const ex = x + fx * radius * .42 - fy * radius * .36 * side;
      const ey = y + fy * radius * .42 + fx * radius * .36 * side;
      const r = radius * .28;
      controls.push({ left: ex - r, right: ex + r, top: ey - r, bottom: ey + r });
    }
    for (const selector of ['.relic-comet-ready:not([hidden])', '.weapon-place-button:not([hidden])', '.app-header', '.bar-tab']) {
      const r = document.querySelector(selector)?.getBoundingClientRect();
      if (r?.width && r.height) controls.push(r);
    }
    return box.width >= 240 && box.left >= 0 && box.top >= 0 && box.right <= innerWidth + 1 &&
      box.bottom <= innerHeight + 1 && !controls.some(overlaps) && panel.scrollWidth <= panel.clientWidth + 1;
  })).toBe(true);
}

test('teaches automatically at the size threshold, expires, and stays dismissed', async ({ page, hasTouch }) => {
  await page.addInitScript(() => {
    window.relicTutorialWrites = 0;
    const set = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ascend.relicTutorial.v1') window.relicTutorialWrites++;
      return set.call(this, key, value);
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await join(page);
  const tutorial = page.getByRole('complementary', { name: 'Asteroid launch tutorial' });
  await expect(tutorial).toBeHidden();
  await send(page, 'test:setGems', { count: 100 });
  await expect.poll(async () => (await read(page)).gems).toBe(100);
  await expect(tutorial).toBeHidden();
  await stagePlayer(page, { x: 2100, y: 2100 }, 33_000, 1100);
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toHaveAttribute('data-step', 'find');
  await tutorial.evaluate(panel => {
    window.relicTutorialTextUpdates = 0;
    new MutationObserver(records => { window.relicTutorialTextUpdates += records.length; })
      .observe(panel.querySelector('[role="status"]'), { childList: true, subtree: true, characterData: true });
  });
  await expectClearTutorial(page);
  await page.screenshot({ path: test.info().outputPath('tutorial-unlock.png') });
  await expect(tutorial).toBeHidden({ timeout: 15_000 });
  expect(await page.evaluate(() => window.relicTutorialTextUpdates)).toBeLessThan(4);
  expect(await page.evaluate(() => window.relicTutorialWrites)).toBeLessThan(5);
  await send(page, 'test:setGems', { count: 0 });
  await expect.poll(async () => (await read(page)).gems).toBe(0);
  await send(page, 'test:setGems', { count: 33_000 });
  await expect.poll(async () => (await read(page)).width).toBeGreaterThanOrEqual(1100);
  await expect(tutorial).toBeHidden();
  expect(errors).toEqual([]);
});

test('defers unread coaching during injury and menus, including when tutorial storage is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function (key) {
      if (key === 'ascend.relicTutorial.v1') throw new DOMException('Blocked', 'SecurityError');
      return get.call(this, key);
    };
    Storage.prototype.setItem = function (key, value) {
      if (key === 'ascend.relicTutorial.v1') throw new DOMException('Blocked', 'SecurityError');
      return set.call(this, key, value);
    };
  });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await join(page);
  await send(page, 'test:protect', { ms: 0 });
  await send(page, 'test:injure');
  await expect.poll(async () => (await read(page)).injury - (await read(page)).time).toBeGreaterThan(0);
  await stagePlayer(page, { x: 2100, y: 2100 }, 33_000, 1100);
  const tutorial = page.getByRole('complementary', { name: 'Asteroid launch tutorial' });
  await expect(tutorial).toBeHidden();
  await page.evaluate(() => window.drawerUI.open());
  await expect.poll(async () => (await read(page)).time - (await read(page)).injury, { timeout: 10_000 }).toBeGreaterThanOrEqual(0);
  await expect(tutorial).toBeHidden();
  await page.getByRole('dialog', { name: 'Game Menu' }).getByRole('button', { name: 'Close', exact: true }).click();
  await expect(tutorial).toBeVisible();
  await expectClearTutorial(page);
  await tutorial.getByRole('button', { name: 'Dismiss asteroid tutorial' }).click();
  await expect(tutorial).toBeHidden();
  expect(errors).toEqual([]);
});

test('keeps enlarged tutorial text and actions reachable on a narrow reduced-motion phone', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await join(page);
  await stagePlayer(page, { x: 2100, y: 2100 }, 33_000, 1100);
  const tutorial = page.getByRole('complementary', { name: 'Asteroid launch tutorial' });
  await expect(tutorial).toBeVisible();
  await tutorial.evaluate(panel => {
    panel.style.fontSize = '28px';
    panel.querySelector('strong').style.fontSize = '28px';
    panel.querySelectorAll('button').forEach(button => button.style.fontSize = '28px');
  });
  await expectClearTutorial(page);
  const dismiss = tutorial.getByRole('button', { name: 'Dismiss asteroid tutorial' });
  await dismiss.focus();
  await expect(dismiss).toBeInViewport({ ratio: 1 });
  const before = (await read(page)).center;
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.up('ArrowDown');
  const after = (await read(page)).center;
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(1);
  await page.screenshot({ path: test.info().outputPath('tutorial-enlarged.png') });
  await page.keyboard.press('Enter');
  await expect(tutorial).toBeHidden();
});

async function aimWithKeys(page, dialog, target) {
  await page.keyboard.press('KeyA');
  const status = dialog.getByRole('status');
  await expect(status).toContainText('Target');
  const [, across, down] = (await status.textContent()).match(/(\d+)% across, (\d+)% down/);
  const horizontal = Math.round((target.x - Number(across) * 42) / 105);
  const vertical = Math.round((target.y - Number(down) * 42) / 105);
  for (let i = 0; i < Math.abs(horizontal); i++) await page.keyboard.press(horizontal < 0 ? 'KeyA' : 'KeyD');
  for (let i = 0; i < Math.abs(vertical); i++) await page.keyboard.press(vertical < 0 ? 'KeyW' : 'KeyS');
}

async function expectVisibleReticle(map, position) {
  await expect.poll(() => map.evaluate((canvas, point) => {
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(point.x * canvas.width / rect.width);
    const y = Math.round(point.y * canvas.height / rect.height);
    const pixels = canvas.getContext('2d').getImageData(x - 2, y - 2, 5, 5).data;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i] >= 240 && pixels[i + 1] >= 215 && pixels[i + 2] >= 155) return true;
    }
    return false;
  }, position)).toBe(true);
}

async function observeImpactRipple(page) {
  await page.addInitScript(() => {
    window.cometRippleRadii = [];
    const circles = new WeakMap();
    const proto = CanvasRenderingContext2D.prototype;
    const beginPath = proto.beginPath, arc = proto.arc, stroke = proto.stroke;
    proto.beginPath = function (...args) {
      circles.delete(this);
      return beginPath.apply(this, args);
    };
    proto.arc = function (x, y, radius, ...args) {
      circles.set(this, { x, y, radius });
      return arc.call(this, x, y, radius, ...args);
    };
    proto.stroke = function (...args) {
      // Observe the bright world-space impact ring, apart from the static warning rings and minimap.
      const circle = circles.get(this);
      if (circle && this.canvas.classList.contains('game-canvas') && this.strokeStyle === '#ffd19e') {
        const strike = window.game?.currentGameMode?.multiplayerManager?.getState()?.relicComet;
        if (strike && circle.x === strike.x && circle.y === strike.y) {
          window.cometRippleRadii.push({ id: strike.id, phase: strike.phase, radius: circle.radius });
        }
      }
      return stroke.apply(this, args);
    };
  });
}

test('tow a relic, aim on the arena map, and warn another player before impact', async ({ page, context, browserName, hasTouch }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await join(page);
  const observer = await context.newPage();
  observer.on('pageerror', error => errors.push(error.message));
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const target = { x: 3350, y: 1000 };
  await join(observer, roomId);
  await stagePlayer(observer, target, 33_000, 1100);
  await page.bringToFront();
  await send(page, 'test:clearHoles');
  await stagePlayer(page, { x: 650, y: 650 }, 33_000, 1100);
  await send(page, 'test:placeRelic', { x: 1280, y: 1280, relayX: 2340, relayY: 2340 });
  await expect.poll(async () => (await read(page)).relic.phase).toBe('available');
  const tutorial = page.getByRole('complementary', { name: 'Asteroid launch tutorial' });
  await expect(tutorial).toBeVisible();
  await expect(tutorial).toHaveAttribute('data-step', 'find');
  await expect(tutorial).toContainText(/walk into/i);
  await expectClearTutorial(page);
  await page.screenshot({ path: test.info().outputPath('tutorial-find.png') });
  const aimButton = page.getByRole('button', { name: 'Aim relic comet' });
  await expect(aimButton).toBeHidden();
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    await input.move(Math.SQRT1_2, Math.SQRT1_2);
    await expect.poll(async () => (await read(page)).relic.phase).toBe('towed');
    await expect(tutorial).toHaveAttribute('data-step', 'tow');
    await expect(tutorial).toContainText('cyan RELAY');
    await expectClearTutorial(page);
    await page.screenshot({ path: test.info().outputPath('tutorial-tow.png') });
    const towing = await read(page);
    expect(towing.relic.towEndsAt - towing.time).toBeGreaterThan(50_000);
    await expect.poll(() => page.evaluate(() => window.relicTowCueVisible)).toBe(true);
    const pickup = towing.center;
    await expect.poll(async () => (await read(page)).ready, { timeout: 35_000 }).toBe(true);
    await input.stop();
    const delivery = (await read(page)).center;
    expect(Math.hypot(delivery.x - pickup.x, delivery.y - pickup.y)).toBeGreaterThan(2700);
    await expect(tutorial).toHaveAttribute('data-step', 'launch');
    await expectClearTutorial(page);
    await page.screenshot({ path: test.info().outputPath('tutorial-launch.png') });

    const menu = page.locator('.hamburger-button');
    const menuVisible = await menu.isVisible();
    await aimButton.click();
    const dialog = page.getByRole('dialog', { name: 'Relic comet' });
    const map = dialog.getByRole('group', { name: 'Arena map' });
    await expect(dialog).toBeVisible();
    await expect(tutorial).toBeHidden();
    await expect(dialog.getByRole('button', { name: 'Fire comet' })).toBeEnabled();
    if (menuVisible) await expect(menu).toBeHidden();
    if (hasTouch) {
      await input.move(-1, 0);
      await expect(dialog).toBeHidden();
      await input.stop();
    } else {
      await page.keyboard.press('KeyD');
      await expect(dialog).toBeVisible();
      await page.keyboard.press('Escape');
    }
    await expect(dialog).toBeHidden();
    if (menuVisible) await expect(menu).toBeVisible();
    expect((await read(page)).ready).toBe(true);
    expect((await read(page)).strike.phase).toBe('idle');

    const useKeyboard = !hasTouch && browserName === 'chromium';
    if (!hasTouch && !useKeyboard) {
      const steering = page.locator('button[data-action="mouse"]:visible').first();
      await steering.click();
      await expect(steering).toHaveAttribute('aria-checked', 'true');
    }
    await aimButton.click();
    await expect(map).toBeVisible();
    const box = await map.boundingBox();
    const position = mapPosition(box, target.x, target.y);
    if (hasTouch) {
      await map.tap({ position });
      await expect(dialog.getByRole('button', { name: 'Fire comet' })).toBeEnabled();
      await expectVisibleReticle(map, position);
      await page.screenshot({ path: test.info().outputPath('aim.png') });
      await dialog.getByRole('button', { name: 'Fire comet' }).tap();
    } else if (useKeyboard) {
      await aimWithKeys(page, dialog, target);
      await page.screenshot({ path: test.info().outputPath('aim.png') });
      const cancel = dialog.getByRole('button', { name: 'Cancel' });
      await cancel.focus();
      await expect(cancel).toBeFocused();
      const puffReadyAt = (await read(page)).puffReadyAt;
      await page.keyboard.press('Space');
      await expect(dialog).toBeHidden();
      expect((await read(page)).puffReadyAt).toBe(puffReadyAt);
    } else {
      await page.mouse.move(box.x + position.x, box.y + position.y);
      await expectVisibleReticle(map, position);
      await page.screenshot({ path: test.info().outputPath('aim.png') });
      await map.click({ position });
    }
    await expect(dialog).toBeHidden();
    await expect.poll(async () => (await read(observer)).strike.phase).toBe('inbound');
    const warning = await read(observer);
    expect(Math.abs(warning.strike.x - target.x)).toBeLessThan(useKeyboard ? 80 : 35);
    expect(Math.abs(warning.strike.y - target.y)).toBeLessThan(useKeyboard ? 80 : 35);
    expect(warning.strike.impactAt).toBeGreaterThan(warning.time);
    await observer.bringToFront();
    await expect.poll(() => observer.evaluate(() => window.cometNotices.length)).toBeGreaterThan(0);
    await observer.screenshot({ path: test.info().outputPath('inbound.png') });
    await expect.poll(async () => (await read(observer)).injury, { timeout: 8_000 }).toBeGreaterThan(warning.time);
    expect((await read(observer)).gems / warning.gems).toBeCloseTo(.25, 2);
    await expect(aimButton).toBeHidden();
    await expect(tutorial).toBeHidden();
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem('ascend.relicTutorial.v1')))).toEqual(expect.arrayContaining(['find', 'tow', 'launch']));
    expect(errors).toEqual([]);
  } finally {
    await input.close();
    await observer.close();
  }
});

test('shows a hostile comet warning, preserves the charge and draws one expanding impact ripple', async ({ page, context, hasTouch }) => {
  await observeImpactRipple(page);
  await join(page);
  const rival = await context.newPage();
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  try {
    await join(rival, roomId);
    await send(rival, 'test:clearHoles');
    const target = { x: 2900, y: 1150 };
    for (const [client, spot] of [[page, target], [rival, { x: 2900, y: 3050 }]]) {
      await stagePlayer(client, spot, 33_000, 1100);
      await send(client, 'test:face', { angle: 0 });
      await send(client, 'test:placeRelic', { x: 2100, y: spot.y, relayX: 2100, relayY: spot.y });
      await expect.poll(async () => (await read(client)).ready).toBe(true);
    }

    await page.bringToFront();
    await page.getByRole('button', { name: 'Aim relic comet' }).click();
    const dialog = page.getByRole('dialog', { name: 'Relic comet' });
    const warning = dialog.locator('.relic-comet-warning');
    await expect(dialog).toBeVisible();
    await expect(warning).toBeHidden();
    await send(rival, 'fireRelicComet', target);
    await expect(warning).toBeVisible();
    await expect(warning).toContainText('Comet inbound');
    const countdown = warning.locator('.relic-comet-warning-time');
    const initial = await countdown.textContent();
    await expect(countdown).not.toHaveText(initial);
    await page.screenshot({ path: test.info().outputPath('warning-in-aim.png') });
    if (hasTouch) await dialog.getByRole('button', { name: 'Cancel' }).tap();
    else await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    expect((await read(page)).ready).toBe(true);
    await expect.poll(() => page.evaluate(() => window.cometNotices.length)).toBeGreaterThan(0);
    const strike = (await read(page)).strike;
    const rippleFrames = () => page.evaluate(id => window.cometRippleRadii.filter(sample => sample.id === id), strike.id);
    await expect.poll(async () => Math.max(0, ...(await rippleFrames()).map(sample => sample.radius)), { timeout: 10_000 }).toBeGreaterThanOrEqual(733);
    await expect.poll(async () => (await read(page)).strike.phase).toBe('idle');
    const frames = await rippleFrames();
    expect(frames.every(frame => frame.phase === 'impact')).toBe(true);
    const radii = frames.map(frame => frame.radius);
    const reachedEdge = radii.findIndex(radius => radius >= 733);
    expect(radii.slice(0, reachedEdge).some(radius => radius < 710)).toBe(true);
    expect(radii.slice(reachedEdge).every(radius => radius >= 731 && radius <= 735)).toBe(true);
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    expect(await rippleFrames()).toEqual(frames);
  } finally {
    await rival.close();
  }
});

test('shows the gold relic cue once per run and rearms it on respawn', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ascend.relicTutorial.v1', '["find","tow","launch"]'));
  await join(page);
  await send(page, 'test:clearHoles');
  const cueFrames = () => page.evaluate(() => window.relicUnlockFrames);
  const renderFrames = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect.poll(cueFrames).toBe(0);
  await send(page, 'test:setGems', { count: 33_000 });
  await expect.poll(cueFrames).toBeGreaterThan(5);
  await page.screenshot({ path: test.info().outputPath('relic-unlocked.png') });

  await send(page, 'test:setGems', { count: 0 });
  await expect.poll(async () => (await read(page)).gems).toBe(0);
  // Wait for the existing badge to finish before checking the threshold a second time.
  await expect.poll(async () => {
    const before = await cueFrames();
    await renderFrames();
    return (await cueFrames()) === before;
  }, { timeout: 6000 }).toBe(true);
  await page.evaluate(() => { window.relicUnlockFrames = 0; });
  await send(page, 'test:setGems', { count: 33_000 });
  await expect.poll(async () => (await read(page)).width).toBeGreaterThan(1100);
  await renderFrames();
  expect(await cueFrames()).toBe(0);

  await send(page, 'test:setGems', { count: 0 });
  await send(page, 'test:protect', { ms: 0 });
  await send(page, 'test:hit');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'dead');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'alive');
  await send(page, 'test:setGems', { count: 33_000 });
  await expect.poll(cueFrames).toBeGreaterThan(0);
});
