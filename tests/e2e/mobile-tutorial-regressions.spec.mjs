import { test, expect } from '@playwright/test';

test.skip(!process.env.PRACTICE_E2E, 'explicit local production tutorial checks');
test.beforeEach(async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'touch aiming and phone framing');
  await page.addInitScript(() => {
    localStorage.setItem('ascend.mouseFollow', 'off');
  });
});
const state = page => page.evaluate(() => {
  const m = window.game.currentGameMode.multiplayerManager, p = m.getLocalPlayer(), v = m.getState().practice;
  return { ...v.toJSON(), x: p.x, y: p.y, gems: p.gems, captive: p.gulping, facing: p.facing };
});
// A scenario reset deliberately cancels held controls. Start gestures after that reset is rendered.
const ready = page => page.waitForFunction(() => {
  const m = window.game.currentGameMode;
  return m.renderView && m.practiceReset === m.multiplayerManager.getState().practice.resetSerial;
});
async function controls(page, browserName) {
  const points = new Map(), cdp = browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
  const send = async (type, id, x, y) => {
    if (type === 'touchEnd') points.delete(id); else points.set(id, { id, x, y, radiusX: 7, radiusY: 7 });
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: [...points.values()] });
    else await page.evaluate(({ type, id, x, y }) => {
      const kind = type === 'touchStart' ? 'pointerdown' : type === 'touchMove' ? 'pointermove' : 'pointerup';
      (kind === 'pointerdown' ? document.querySelector('canvas.game-canvas') : window).dispatchEvent(new PointerEvent(kind, {
        pointerType: 'touch', pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true,
      }));
    }, { type, id, x, y });
  };
  const release = async id => { if (points.has(id)) { const p = points.get(id); await send('touchEnd', id, p.x, p.y); } };
  const hold = async () => { const { width, height } = page.viewportSize(); await send('touchStart', 2, width - 74, height - 80); };
  return {
    hold, release,
    tap: async () => { await hold(); await page.waitForTimeout(65); await release(2); },
    aim: async (dx, dy) => {
      const { width, height } = page.viewportSize(); await hold();
      await send('touchMove', 2, width - 74 + dx * 60, height - 80 + dy * 60);
    },
    stick: async (dx, dy) => {
      const y = page.viewportSize().height - 100;
      if (!points.has(1)) await send('touchStart', 1, 96, y);
      await send('touchMove', 1, 96 + dx * 56, y + dy * 56);
    },
  };
}
async function start(page, lesson) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play tutorial', exact: true }).tap();
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.sequence === true);
  await page.getByRole('button', { name: 'Choose any lesson', exact: true }).tap();
  await page.locator(`[data-lesson="${lesson}"]`).tap();
  await page.waitForFunction(id => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.lesson === id, lesson);
  await expect(page.locator('.practice-instruction')).toBeVisible();
  await ready(page);
}
async function capture(page, input) {
  await ready(page);
  await input.hold();
  await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'shoot');
  await input.release(2);
}
const pointingUp = async page => Math.abs((await state(page)).facing + Math.PI / 2);

test('lifted touch aim survives waiting and walking, fires that direction, and clears on retry', async ({ page, browserName }) => {
  const input = await controls(page, browserName); await start(page, 'blackhole'); await capture(page, input);
  const initial = await state(page);
  await input.aim(0, -1); await expect.poll(() => pointingUp(page)).toBeLessThan(.12);
  await input.release(2); await page.waitForTimeout(700);
  expect(await pointingUp(page)).toBeLessThan(.12);
  expect((await state(page)).captive).toBe(initial.captive, 'lifting aims without firing');
  await input.stick(1, 0); await page.waitForTimeout(350); await input.release(1);
  const moving = await state(page); expect(moving.x).toBeGreaterThan(initial.x + 8);
  expect(await pointingUp(page)).toBeLessThan(.12);
  await page.screenshot({ path: test.info().outputPath('retained-aim-while-walking.png'), scale: 'css' });
  await input.tap();
  await page.waitForFunction(previous => {
    const v = window.game.currentGameMode.multiplayerManager.getState().practice;
    return v.attempt > previous && v.phase === 'waiting';
  }, initial.attempt);
  const retry = await state(page); expect(retry.stage).toBe('shoot'); expect(retry.passed).toBe(1); expect(retry.failures).toBe(1);
  expect(retry.captive).not.toBe(initial.captive); expect(Math.abs(retry.facing)).toBeLessThan(.12);
  await ready(page);
  await input.tap(); await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  expect((await state(page)).gems).toBe(350, 'the replacement shot does not inherit old aim');
});

test('a new touch aim replaces the retained direction before firing', async ({ page, browserName }) => {
  const input = await controls(page, browserName); await start(page, 'blackhole'); await capture(page, input);
  await input.aim(0, -1); await expect.poll(() => pointingUp(page)).toBeLessThan(.12); await input.release(2);
  await input.aim(1, 0); await expect.poll(async () => Math.abs((await state(page)).facing)).toBeLessThan(.12);
  await input.release(2); await page.waitForTimeout(700);
  expect(Math.abs((await state(page)).facing)).toBeLessThan(.12);
  await input.tap(); await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'complete');
  expect((await state(page)).gems).toBe(350);
});

test('the injured rival and learner stay fully in view while the injury timer runs', async ({ page }) => {
  await start(page, 'basics');
  // Reach the real injury through supported keyboard inputs; this case isolates mobile camera geometry.
  await page.locator('canvas.game-canvas').click({ position: { x: 10, y: 250 } });
  await page.keyboard.down('ArrowRight'); await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.phase === 'success'); await page.keyboard.up('ArrowRight');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'capture');
  await page.keyboard.down('Space');
  await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().gulping);
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'shoot');
  await page.keyboard.up('Space'); await page.keyboard.press('Space');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().practice.stage === 'finish');
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(250);
    const sample = await page.evaluate(() => {
      const mode = window.game.currentGameMode, m = mode.multiplayerManager, s = m.getState(), p = m.getLocalPlayer(), t = s.players.get(s.practice.targetId), v = mode.renderView, c = window.game.canvas;
      const fits = body => {
        if (!body) return false;
        const x = (body.x + body.width / 2 - v.x) * v.scale + c.width / 2, y = (body.y + body.height / 2 - v.y) * v.scale + c.height / 2, r = (body.width / 2 + 14) * v.scale;
        return x - r >= 0 && x + r <= c.width && y - r >= 0 && y + r <= c.height;
      };
      return { player: fits(p), injured: fits(t), injuryActive: !!t?.breathingBlocked, phase: s.practice.phase,
        exterior: Math.max(0, v.width/2-v.x, v.height/2-v.y, v.x+v.width/2-s.worldWidth, v.y+v.height/2-s.worldHeight) };
    });
    expect(sample).toMatchObject({ player: true, injured: true, injuryActive: true, phase: 'waiting' });
    expect(sample.exterior).toBeLessThan(.1);
  }
  await page.screenshot({ path: test.info().outputPath('injured-rival-and-player-visible.png'), scale: 'css' });
});
