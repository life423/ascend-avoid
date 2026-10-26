import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local server only');
for (const [gems, length] of [[16, 3], [60, 4], [1000, 5]]) test(`joystick escapes a ${length}-arrow capture with diagonal error and no recentering`, async ({ page, baseURL, hasTouch }) => {
  test.skip(!hasTouch, 'touch joystick');
  await page.addInitScript(() => localStorage.setItem('ascend.guideSeen', 'true'));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, { name: 'Joystick captor' });
  peer.onMessage('*', () => {});
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  const mine = () => page.evaluate(() => {
    const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
    return { capturedBy: p.capturedBy, step: p.escapeStep, keys: p.escapeKeys, flying: p.flying, missed: p.escapeMissAt, time: m.multiplayerManager.room.state.time, dazed: p.dazedUntil };
  });
  try {
    peer.send('test:setGems', { count: gems });
    await send('test:setGems', { count: 4 });
    await expect.poll(() => peer.state.players?.get(peer.sessionId)?.gems).toBe(gems);
    const captorSize = peer.state.players.get(peer.sessionId).width;
    peer.send('test:moveTo', { x: 1500, y: 1500 }); peer.send('test:face', { angle: 0 });
    await send('test:moveTo', { x: 1500 + captorSize, y: 1500 + (captorSize - 28.5) / 2 });
    await send('test:protect', { ms: 0 });
    await page.waitForTimeout(100); peer.send('inhale');
    await page.waitForFunction(() => !!window.game.currentGameMode.multiplayerManager.getLocalPlayer().capturedBy);
    peer.send('tap'); // the real earliest firing deadline still applies
    const initial = await mine(); expect(initial.keys).toHaveLength(length);
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas'), r = canvas.getBoundingClientRect();
      const x = r.left + r.width * .25, y = r.top + r.height - 100;
      window.joystickEscapeMove = (key, error = 55) => {
        const angle = ({ U: -90, R: 0, D: 90, L: 180 }[key] + error) * Math.PI / 180;
        window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 91, pointerType: 'touch', clientX: x + Math.cos(angle) * 45, clientY: y + Math.sin(angle) * 45, bubbles: true }));
      };
      canvas.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 91, pointerType: 'touch', clientX: x, clientY: y, bubbles: true }));
    });
    await page.evaluate(key => window.joystickEscapeMove(key), initial.keys[0]);
    await expect.poll(async () => (await mine()).step, { intervals: [50, 100] }).toBe(1);
    await page.waitForTimeout(650); // realistic reading time; holding a diagonal must not auto-solve
    expect((await mine()).step).toBe(1);
    await page.screenshot({ path: test.info().outputPath('joystick-escape-in-progress.png') });
    for (let i = 1; i < initial.keys.length; i++) {
      await page.evaluate(key => window.joystickEscapeMove(key), initial.keys[i]);
      await expect.poll(async () => { const p = await mine(); return !p.capturedBy || p.step >= i + 1; }, { intervals: [50, 100] }).toBe(true);
      if (i < initial.keys.length - 1) await page.waitForTimeout(100);
    }
    await expect.poll(async () => (await mine()).capturedBy).toBe('');
    expect((await mine()).flying).toBe(false); expect((await mine()).missed).toBe(0);
    await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 91, pointerType: 'touch', bubbles: true })));
    await page.screenshot({ path: test.info().outputPath('joystick-escaped.png') });
  } finally { await peer.leave(); }
});
