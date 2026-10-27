import { test, expect } from '@playwright/test';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local test server only');
test('six recipes synchronize, reserved siblings show radar, and satellites deploy and travel', async ({ page }) => {
  const errors = [];
  page.on('pageerror', e => { if (!/Wrong protocol for WebSocket/.test(e.message)) errors.push(e.message); });
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testWeaponSets: 9, testTurbines: 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  await page.evaluate(() => {
    window.weaponTexts = []; window.weaponGuidanceDots = 0;
    const arc = CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.arc = function(x,y,r,...args) { if(y===45 && r===3.5) window.weaponGuidanceDots++; return arc.call(this,x,y,r,...args); };
    const fill = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) { if (['TRACKER', 'LASER'].includes(String(text))) window.weaponTexts.push(String(text)); return fill.call(this, text, ...args); };
    window.game.currentGameMode.multiplayerManager.room.send('test:pinwheel', { kind: 'sentinel', slot: 2, x: 2100, y: 2100 });
  });
  const snapshot = () => page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room, all = [room.state.pinwheel, ...room.state.weaponSets], w = all[2];
    return { kinds: all.map(w => w.kind), phase: w.phase, parts: [...w.parts].map(p => ({ x: p.x, y: p.y, owner: p.owner, carriedBy: p.carriedBy })), x: w.x, y: w.y, owner: w.owner, id: room.sessionId };
  });
  await expect.poll(async () => (await snapshot()).parts.length).toBe(3);
  expect(new Set((await snapshot()).kinds).size).toBe(6); expect((await snapshot()).kinds.length).toBe(9);
  const moveToPart = async index => {
    const part = (await snapshot()).parts[index];
    await page.evaluate(({ x, y }) => { const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(); m.multiplayerManager.room.send('test:moveTo', { x: x - p.width / 2, y: y - p.height / 2 }); }, part);
  };
  await moveToPart(0);
  await expect.poll(async () => (await snapshot()).owner).toBe((await snapshot()).id);
  const claimed = await snapshot(); expect(claimed.parts.every(p => p.owner === claimed.id)).toBe(true);
  await expect.poll(() => page.evaluate(() => window.weaponGuidanceDots)).toBeGreaterThan(0);
  if (await page.evaluate(() => matchMedia('(max-width: 1199px)').matches)) expect(await page.evaluate(() => window.weaponTexts.length)).toBe(0);
  await page.screenshot({ path: test.info().outputPath('satellite-radar-and-locks.png') });
  await moveToPart(1); await expect.poll(async () => (await snapshot()).parts.filter(p => p.carriedBy).length).toBe(2);
  await moveToPart(2); await expect.poll(async () => (await snapshot()).phase).toBe('carried');
  await page.getByRole('button', { name: 'Place weapon', exact: true }).click();
  await expect.poll(async () => (await snapshot()).phase).toBe('active');
  const origin = await snapshot();
  await expect.poll(async () => { const w = await snapshot(); return Math.hypot(w.x - origin.x, w.y - origin.y); }).toBeGreaterThan(150);
  const orbit = await snapshot();
  await page.evaluate(({ x, y }) => window.game.currentGameMode.multiplayerManager.room.send('test:moveTo', { x, y }), orbit);
  await page.waitForTimeout(400);
  await page.screenshot({ path: test.info().outputPath('satellite-orbit.png') });
  expect(errors).toEqual([]);
});
