import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');
async function start(page) {
  await page.addInitScript(() => localStorage.setItem('ascend.guideSeen', 'true'));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCalm: true }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => {
    const s = window.game?.currentGameMode?.multiplayerManager?.room?.state;
    return s?.blackHoles?.length === 3 && s.time >= s.blackHoles[0].activeAt && !document.body.classList.contains('intro-playing');
  });
}
const send = (page, type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
const local = page => page.evaluate(() => {
  const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
  return { id: p.sessionId, x: p.x, y: p.y, width: p.width, gems: p.gems, capturedBy: p.capturedBy, flying: p.flying, state: p.state };
});

test('black holes are visible landmarks and existing keyboard/joystick movement slides around the soft rim safely', async ({ page, hasTouch }) => {
  await start(page); await send(page, 'test:setGems', { count: 40 });
  await expect.poll(async () => (await local(page)).gems).toBe(40);
  const p = await local(page);
  await send(page, 'test:moveTo', { x: 900 - p.width / 2, y: 1260 - p.width / 2 });
  await send(page, 'test:protect', { ms: 0 });
  await expect.poll(() => page.evaluate(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return Math.abs(p.x+p.width/2-900); })).toBeLessThan(2);
  await page.evaluate(() => {
    const room=window.game.currentGameMode.multiplayerManager.room; window.__rimMinimum=Infinity;
    room.onStateChange(state=>{const p=state.players.get(room.sessionId);if(p)window.__rimMinimum=Math.min(window.__rimMinimum,Math.hypot(p.x+p.width/2-1050,p.y+p.width/2-1260)-p.width/2);});
  });
  await page.screenshot({ path: test.info().outputPath('black-hole-landmark.png') });
  if (hasTouch) {
    await page.evaluate(() => {
      const c = document.querySelector('canvas'), r = c.getBoundingClientRect(), x = r.left + r.width * .25, y = r.top + r.height * .6;
      c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true }));
      window.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: x + 80, clientY: y, bubbles: true }));
    });
  } else await page.keyboard.down('ArrowRight');
  await expect.poll(async () => { const v = await local(page); return v.x + v.width / 2; }).toBeGreaterThan(1130);
  if (hasTouch) await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, bubbles: true })));
  else await page.keyboard.up('ArrowRight');
  expect((await local(page)).state).toBe('alive'); expect((await local(page)).gems).toBe(40);
  expect(await page.evaluate(()=>window.__rimMinimum)).toBeGreaterThan(69);
  expect(Math.abs((await local(page)).y+p.width/2-1260)).toBeGreaterThan(80);
});

test('an actual capture and fresh fire into a core ends a healthy run, credits the shooter and safely respawns', async ({ page, baseURL }) => {
  await start(page);
  const id = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const shooter = await new Client(baseURL.replace(/^http/, 'ws')).joinById(id, { name: 'Black-hole shooter' }); shooter.onMessage('*', () => {});
  try {
    shooter.send('test:setGems', { count: 250 });
    await expect.poll(() => shooter.state.players.get(shooter.sessionId)?.gems).toBe(250);
    const w = shooter.state.players.get(shooter.sessionId).width;
    shooter.send('test:moveTo', { x: 650 - w / 2, y: 1260 - w / 2 });
    shooter.send('test:face', { angle: 0 }); shooter.send('test:protect', { ms: 0 });
    await send(page, 'test:setGems', { count: 100 }); await expect.poll(async () => (await local(page)).gems).toBe(100);
    const p = await local(page);
    await send(page, 'test:moveTo', { x: 650 + w * .3 + 8 - p.width / 2, y: 1260 - p.width / 2 });
    await send(page, 'test:protect', { ms: 0 }); shooter.send('inhale');
    await expect.poll(async () => (await local(page)).capturedBy).toBe(shooter.sessionId);
    expect((await local(page)).gems).toBe(70);
    shooter.send('exhale'); shooter.send('tap');
    await page.waitForFunction(() => { const m = window.game.currentGameMode; return m.knockoutCause?.how === 'blackhole' && m.multiplayerManager.getLocalPlayer().state === 'dead'; });
    expect((await local(page)).state).toBe('dead');
    await page.screenshot({ path: test.info().outputPath('black-hole-knockout.png') });
    await page.waitForFunction(() => { const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer(); return p.state === 'alive' && p.spawnProtected && !p.flying; });
    expect((await local(page)).gems).toBe(0);
  } finally { await shooter.leave(); }
});
