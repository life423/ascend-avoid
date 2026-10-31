import { expect } from '@playwright/test';

export const LESSONS = ['basics', 'combat', 'defense', 'blackhole', 'weapon'];
export const readPractice = page => page.evaluate(() => {
  const mode = window.game.currentGameMode, manager = mode.multiplayerManager, state = manager.getState(), p = manager.getLocalPlayer(), v = state.practice;
  const t = state.players.get(v.targetId);
  return { ...v.toJSON(), room: manager.getRoom().id, time: state.time,
    me: { x: p.x + p.width / 2, y: p.y + p.height / 2, gems: p.gems, width: p.width, facing: p.facing, inhaling: p.inhaling, gulping: p.gulping,
      injured: p.breathingBlocked, injuryEnds: p.injuredUntil, state: p.state, stamina: mode.stamina, protected: p.spawnProtected },
    target: t ? { x: t.x + t.width / 2, y: t.y + t.height / 2, width: t.width, gems: t.gems, injured: t.breathingBlocked } : null };
});
export async function openLesson(page, lesson = 'basics', sequence = false) {
  await page.addInitScript(() => localStorage.setItem('ascend.mouseFollow', 'off'));
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer());
  await page.evaluate(() => window.drawerUI.open());
  await page.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  if (sequence) await page.getByRole('button', { name: 'Start full tutorial', exact: true }).click();
  else await page.locator(`[data-lesson="${lesson}"]`).click();
  await page.waitForFunction(id => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.lesson === id && ['ready','waiting'].includes(window.game.currentGameMode.multiplayerManager.getState().practice.phase), lesson);
  await settled(page);
  await expect(page.locator('.practice-instruction')).toBeVisible();
  // Wait for the closing menu/backdrop to release the actual play surface before a gesture starts.
  await page.locator('canvas.game-canvas').click({ position: { x: 10, y: 250 } });
}
export const settled = page => page.waitForFunction(() => {
  const m = window.game.currentGameMode;
  return m.renderView && m.practiceReset === m.multiplayerManager.getState().practice.resetSerial;
});

/** Chromium sends trusted touches; WebKit uses explicit pointer events. Neither changes game state. */
export async function practiceInput(page, browserName, hasTouch) {
  const points = new Map(), keys = new Set();
  const cdp = hasTouch && browserName === 'chromium' ? await page.context().newCDPSession(page) : null;
  let held = false;
  const touch = async (type, id, x, y) => {
    const released = points.get(id);
    if (type === 'touchEnd') points.delete(id); else points.set(id, { id, x, y, radiusX: 8, radiusY: 8 });
    if (cdp) await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' && released ? [released] : [...points.values()] });
    else await page.evaluate(({ type, id, x, y }) => {
      const kind = type === 'touchStart' ? 'pointerdown' : type === 'touchMove' ? 'pointermove' : 'pointerup';
      (kind === 'pointerdown' ? document.querySelector('canvas.game-canvas') : window).dispatchEvent(new PointerEvent(kind, { pointerType: 'touch', pointerId: id, clientX: x, clientY: y, bubbles: true, cancelable: true }));
    }, { type, id, x: type === 'touchEnd' ? released?.x ?? x : x, y: type === 'touchEnd' ? released?.y ?? y : y });
  };
  const release = async id => { if (points.has(id)) { const p = points.get(id); await touch('touchEnd', id, p.x, p.y); } };
  const move = async (dx = 0, dy = 0) => {
    if (hasTouch) {
      if (Math.hypot(dx, dy) < .1) { await release(1); return; }
      const y = page.viewportSize().height - 100;
      if (!points.has(1)) await touch('touchStart', 1, 96, y);
      await touch('touchMove', 1, 96 + dx * 56, y + dy * 56);
    } else {
      const next = new Set([dx > .2 && 'ArrowRight', dx < -.2 && 'ArrowLeft', dy > .2 && 'ArrowDown', dy < -.2 && 'ArrowUp'].filter(Boolean));
      for (const k of keys) if (!next.has(k)) { await page.keyboard.up(k); keys.delete(k); }
      for (const k of next) if (!keys.has(k)) { await page.keyboard.down(k); keys.add(k); }
    }
  };
  const releaseAction = async () => { if (hasTouch) await release(2); else if (held) await page.keyboard.up('Space'); held = false; };
  const hold = async () => {
    if (held) return;
    if (hasTouch) { const { width, height } = page.viewportSize(); await touch('touchStart', 2, width - 74, height - 80); }
    else await page.keyboard.down('Space');
    held = true;
  };
  const aim = async (dx, dy) => {
    if (!hasTouch) { await move(dx, dy); return; }
    await hold();
    const { width, height } = page.viewportSize();
    await touch('touchMove', 2, width - 74 + dx * 60, height - 80 + dy * 60);
  };
  const tap = async () => { await releaseAction(); await hold(); await page.waitForTimeout(45); await releaseAction(); };
  const stop = async () => { await move(); await releaseAction(); };
  return { move, hold, aim, tap, releaseAction, stop, touch: hasTouch, close: async () => { await stop(); if (cdp) await cdp.detach(); } };
}

/** Read state to select human inputs; never send lesson completion, teleport or reward commands. */
export async function playPractice(page, input, { until = v => v.phase === 'complete', onStage = async () => {}, maxMs = 75000 } = {}) {
  const end = Date.now() + maxMs;
  let last = '', serial = -1, fired = '', cast = '';
  while (Date.now() < end) {
    const v = await readPractice(page);
    if (until(v)) { await input.stop(); return v; }
    if (v.resetSerial !== serial) { await input.stop(); await settled(page); serial = v.resetSerial; }
    const key = `${v.lesson}/${v.stage}/${v.attempt}`, pose = `${key}/${v.phase}`;
    if (pose !== last) { await onStage(v); last = pose; }
    if (v.phase === 'ready') {
      await input.stop();
      const readyButton = page.getByRole('button', { name: 'Ready', exact: true });
      if (input.touch) await readyButton.tap(); else await readyButton.click();
      await page.waitForFunction(attempt => {
        const view = window.game.currentGameMode.multiplayerManager.getState().practice;
        return view.attempt !== attempt || view.phase !== 'ready';
      }, v.attempt, {timeout:10000});
      continue;
    }
    if (!['waiting', 'resolving'].includes(v.phase)) { await input.stop(); await page.waitForTimeout(60); continue; }
    const dx = v.target ? v.target.x - v.me.x : 0, dy = v.target ? v.target.y - v.me.y : 0, distance = Math.max(1, Math.hypot(dx, dy));
    if (v.lesson === 'basics') {
      if (v.stage === 'grow') await input.move(1, 0);
      else { await input.move(); await input.hold(); }
    } else if (v.lesson === 'combat') {
      if (v.stage === 'aim') await input.aim(dx / distance, dy / distance);
      else if (v.stage === 'shatter' || v.stage === 'wound') {
        await input.stop();
        const error = Math.abs(Math.atan2(Math.sin(Math.atan2(dy, dx) - v.me.facing), Math.cos(Math.atan2(dy, dx) - v.me.facing)));
        if (v.me.gulping && error > .08) await input.aim(dx / distance, dy / distance);
        else if (v.me.gulping && fired !== key) { await input.stop(); await page.waitForTimeout(75); await input.tap(); fired = key; }
      } else {
        if (v.stage === 'approach') await input.releaseAction();
        else await input.hold();
        if (v.stage !== 'steal' || distance > 200) await input.move(dx / distance, dy / distance); else await input.move();
      }
    } else if (v.lesson === 'defense') {
      await input.move(1, 0);
      if (v.stage === 'rear-cover' && v.cue === 'attacking' && cast !== key) { await input.tap(); cast = key; }
    } else if (v.lesson === 'blackhole') {
      await input.move();
      if (v.stage === 'capture') await input.hold();
      else if (v.me.gulping && fired !== key) { await input.releaseAction(); await page.waitForTimeout(60); await input.tap(); fired = key; }
    } else if (v.lesson === 'weapon') {
      await input.releaseAction();
      if (v.stage === 'collect') {
        const part = await page.evaluate(() => { const m = window.game.currentGameMode.multiplayerManager, p = m.getState().pinwheel.parts.find(p => p.carriedBy !== m.localSessionId); return p ? { x: p.x, y: p.y } : null; });
        if (part) { const x = part.x - v.me.x, y = part.y - v.me.y, length = Math.max(1, Math.hypot(x, y)); await input.move(x / length, y / length); }
      } else if (v.stage === 'place') {
        await input.stop();
        const button = page.getByRole('button', { name: /Place weapon/ });
        if (await button.isVisible()) { if (input.touch) await button.tap(); else await button.click(); }
        else await page.keyboard.press('e');
        await page.waitForFunction(attempt => {
          const view = window.game.currentGameMode.multiplayerManager.getState().practice;
          return view.attempt !== attempt || view.stage !== 'place' || view.phase !== 'waiting';
        }, v.attempt, {timeout:10000});
      } else await input.move();
    }
    await page.waitForTimeout(55);
  }
  const state = await readPractice(page);
  throw Error(`Tutorial stalled: ${JSON.stringify(state)}`);
}
