import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated test server only');
async function start(page) {
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off');
    window.crackStrokes = 0; window.injuryRipples = 0;
    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function(...args) {
      if (this.strokeStyle === '#ffbd77') window.crackStrokes++;
      if (String(this.strokeStyle).startsWith('rgba(255, 189, 119,')) window.injuryRipples++;
      return stroke.apply(this, args);
    };
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
}
const send = (page, type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
const mine = page => page.evaluate(() => { const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(); return { gems: p.gems, injury: p.injuredUntil, time: m.multiplayerManager.room.state.time, state: p.state, x: p.x }; });

test('damage cracks the rear shell, permits movement and visibly heals on time', async ({ page }) => {
  await start(page);
  await send(page, 'test:setGems', { count: 300 }); await send(page, 'test:moveTo', { x: 2100, y: 2100 }); await send(page, 'test:protect', { ms: 0 });
  await page.waitForFunction(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return p.gems === 300 && !p.spawnProtected; });
  await send(page, 'test:hit');
  await expect.poll(async () => (await mine(page)).injury).toBeGreaterThan(0);
  const deadline = (await mine(page)).injury;
  await expect.poll(() => page.evaluate(() => window.crackStrokes)).toBeGreaterThan(0);
  await page.waitForFunction(() => !window.game.currentGameMode.multiplayerManager.getLocalPlayer().recovering);
  await page.screenshot({ path: test.info().outputPath('injured-shell.png') });
  const before = await mine(page); await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await mine(page)).x).toBeGreaterThan(before.x + 10); await page.keyboard.up('ArrowRight');
  expect((await mine(page)).injury).toBe(deadline);
  await expect.poll(async () => (await mine(page)).time, { timeout: 6000 }).toBeGreaterThan(deadline + 250);
  const strokes = await page.evaluate(() => window.crackStrokes); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.crackStrokes)).toBe(strokes);
  await page.screenshot({ path: test.info().outputPath('healed-shell.png') });
  await expect(page.locator('.weapon-place-button')).toBeHidden();
});

test('a real thief cannot drain a healthy peer, but can finish an injured one with a protected respawn', async ({ page, baseURL }) => {
  await start(page);
  const room = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const thief = await new Client(baseURL.replace(/^http/, 'ws')).joinById(room, { name: 'Drain regression' }); thief.onMessage('*', () => {});
  try {
    thief.send('test:setGems', { count: 0 }); thief.send('test:moveTo', { x: 800, y: 1000 }); thief.send('test:face', { angle: 0 }); thief.send('test:protect', { ms: 0 });
    await send(page, 'test:setGems', { count: 2 }); await send(page, 'test:moveTo', { x: 840, y: 1000 }); await send(page, 'test:protect', { ms: 0 });
    await page.waitForTimeout(100); thief.send('inhale'); await page.waitForTimeout(400);
    expect((await mine(page)).gems).toBe(2);
    await send(page, 'test:injure');
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().state === 'dead' && window.game.currentGameMode.knockoutCause?.how === 'drain');
    await page.screenshot({ path: test.info().outputPath('drained-knockout.png') });
    await page.waitForFunction(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return p.state === 'alive' && p.spawnProtected; });
    expect((await mine(page)).injury).toBe(0);
  } finally { await thief.leave(); }
});

test('reduced motion keeps the injury shape readable without an impact ripple', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await start(page);
  await send(page, 'test:setGems', { count: 200 }); await send(page, 'test:protect', { ms: 0 });
  await page.waitForFunction(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return p.gems === 200 && !p.spawnProtected; });
  await send(page, 'test:injure');
  await page.waitForFunction(() => { const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(); return p.injuredUntil > m.multiplayerManager.room.state.time; });
  await expect.poll(() => page.evaluate(() => window.crackStrokes)).toBeGreaterThan(0);
  await page.screenshot({ path: test.info().outputPath('injury-reduced-motion.png') });
  expect(await page.evaluate(() => window.injuryRipples)).toBe(0);
});

test('a real small shot wounds a giant while retaining earned size and a clear viewport', async ({ page, baseURL }) => {
  await start(page);
  const id = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const client = new Client(baseURL.replace(/^http/, 'ws'));
  const captor = await client.joinById(id, { name: 'Shot regression' }); captor.onMessage('*', () => {});
  const missile = await client.joinById(id, { name: 'Small ammunition' }); missile.onMessage('*', () => {});
  try {
    await send(page, 'test:setGems', { count: 1000 });
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems >= 995);
    const initialWidth = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().width);
    await send(page, 'test:moveTo', { x: 1776, y: 1776 }); await send(page, 'test:protect', { ms: 0 });
    captor.send('test:setGems', { count: 16 }); captor.send('test:moveTo', { x: 1200, y: 1970 }); captor.send('test:face', { angle: 0 }); captor.send('test:protect', { ms: 0 });
    missile.send('test:setGems', { count: 4 }); missile.send('test:moveTo', { x: 1260, y: 1982.75 }); missile.send('test:protect', { ms: 0 });
    await expect.poll(() => !!captor.state.players.get(missile.sessionId) && captor.state.players.get(missile.sessionId).gems === 4 && !captor.state.players.get(missile.sessionId).spawnProtected).toBe(true);
    captor.send('inhale');
    await expect.poll(() => missile.state.players.get(missile.sessionId)?.capturedBy).toBe(captor.sessionId);
    captor.send('tap');
    await page.waitForFunction(() => { const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(); return p.injuredUntil > m.multiplayerManager.room.state.time; });
    const result = await page.evaluate(() => {
      const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(), v = m.lastView, s = m.multiplayerManager.room.state;
      const rect = document.querySelector('canvas').getBoundingClientRect();
      return { gems: p.gems, state: p.state, width: p.width, cracks: window.crackStrokes, outside: Math.max(0, v.width / 2 - v.x, v.height / 2 - v.y, v.x + v.width / 2 - s.worldWidth, v.y + v.height / 2 - s.worldHeight), gap: Math.max(Math.abs(rect.left), Math.abs(rect.top), Math.abs(rect.width - visualViewport.width), Math.abs(rect.height - visualViewport.height)) };
    });
    expect(result.state).toBe('alive'); expect(result.gems).toBeGreaterThanOrEqual(970); expect(result.gems).toBeLessThan(1000);
    expect(result.width).toBeGreaterThan(initialWidth * .98); expect(result.outside).toBeLessThan(.1); expect(result.gap).toBeLessThan(.5);
    await expect.poll(() => page.evaluate(() => window.crackStrokes)).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath('giant-after-small-shot.png') });
    const desktopHelp = page.getByRole('button', { name: /Help & settings/ });
    if (await desktopHelp.isVisible()) await desktopHelp.click();
    else await page.getByRole('button', { name: 'Toggle menu', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.locator('.instructions')).toContainText('Bigger ammunition hits harder');
    expect((await page.locator('.instructions').innerText()).trim().split(/\s+/).length).toBeLessThanOrEqual(129);
    await page.getByRole('button', { name: 'Close', exact: true }).click();
  } finally { await missile.leave(); await captor.leave(); }
});
