import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local test server only');
const send = (page, type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
async function prepare(page, baseURL) {
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCalm: true }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  await send(page, 'test:setGems', { count: 5000 });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems >= 4990);
  const width = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().width);
  await send(page, 'test:moveTo', { x: 1600 - width / 2, y: 2100 - width / 2 });
  await send(page, 'test:protect', { ms: 0 });
  const id = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const builder = await new Client(baseURL.replace(/^http/, 'ws')).joinById(id, { name: 'Fairness builder' }); builder.onMessage('*', () => {});
  builder.send('test:setGems', { count: 1000 });
  await expect.poll(() => builder.state.players.get(builder.sessionId)?.gems).toBe(1000);
  let bw = builder.state.players.get(builder.sessionId).width;
  builder.send('test:moveTo', { x: 3000 - bw / 2, y: 2100 - bw / 2 });
  builder.send('test:pinwheel', { x: 3000, y: 2100, kind: 'pulsar' });
  await expect.poll(() => builder.state.pinwheel.phase).toBe('carried');
  bw = builder.state.players.get(builder.sessionId).width;
  builder.send('test:moveTo', { x: 2100 - bw / 2, y: 2100 - bw / 2 });
  builder.send('test:face', { angle: Math.PI }); builder.send('placeWeapon');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase === 'charging');
  return builder;
}
async function walkLeft(page, hasTouch) {
  if (!hasTouch) return page.keyboard.down('ArrowLeft');
  await page.evaluate(() => {
    const c = document.querySelector('canvas'), r = c.getBoundingClientRect(), x = r.left + r.width * .25, y = r.top + r.height * .65;
    c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
    window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x - 80, clientY: y, bubbles: true }));
  });
}

test('a large player can retreat on the Pulsar warning using ordinary keyboard or joystick speed', async ({ page, baseURL, hasTouch }) => {
  const builder = await prepare(page, baseURL);
  try {
    await walkLeft(page, hasTouch);
    await page.waitForTimeout(3100);
    if (hasTouch) await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true })));
    else await page.keyboard.up('ArrowLeft');
    const result = await page.evaluate(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return { gems: p.gems, injury: p.injuredUntil, center: p.x + p.width / 2 }; });
    expect(result.injury).toBe(0); expect(result.gems).toBeGreaterThan(4950); expect(result.center).toBeLessThan(1250);
    expect(builder.state.players.get(builder.sessionId).weaponDamage).toBe(0);
    await page.screenshot({ path: test.info().outputPath('giant-pulsar-retreat.png') });
  } finally { await builder.leave(); }
});

test('staying in the Pulsar core still injures and displays the brief weapon-only guard without a new panel', async ({ page, baseURL }) => {
  const builder = await prepare(page, baseURL);
  try {
    await page.waitForFunction(() => {
      const m = window.game.currentGameMode, s = m.multiplayerManager.room.state, p = m.multiplayerManager.getLocalPlayer();
      return p.injuredUntil > s.time && p.weaponSafeUntil > s.time;
    });
    await page.screenshot({ path: test.info().outputPath('giant-weapon-guard.png') });
    expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems)).toBeLessThan(4300);
    expect(builder.state.players.get(builder.sessionId).weaponDamage).toBeGreaterThan(740);
    await expect(page.locator('.weapon-place-button')).toBeHidden();
  } finally { await builder.leave(); }
});
