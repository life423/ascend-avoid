import { test, expect } from '@playwright/test';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'local placement regression only');

async function open(page, automatic = false) {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0,
      testWeapons: automatic, testWeaponSets: automatic ? 9 : 1, testCalm: true, testTurbines: automatic ? true : 'manual' }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  return { errors, send };
}
const scene = page => page.evaluate(() => {
  const m = window.game.currentGameMode, s = m.multiplayerManager.getState(), p = m.multiplayerManager.getLocalPlayer();
  return { time: s.time, me: { id: p.sessionId, x: p.x + p.width / 2, y: p.y + p.height / 2, width: p.width },
    fans: [...s.turbines.values()].map(t => ({ id: t.id, x: t.x, y: t.y, phase: t.phase })),
    holes: [...s.blackHoles.values()].map(h => ({ x: h.x, y: h.y })),
    builds: [s.pinwheel, ...s.weaponSets.values()].map(w => ({ phase: w.phase, parts: [...w.parts.values()].map(p => ({ kind: p.kind, x: p.x, y: p.y, carriedBy: p.carriedBy })) })) };
});
function checkClear(view) {
  expect(view.holes).toHaveLength(3);
  for (const fan of view.fans) for (const hole of view.holes) expect(Math.hypot(fan.x - hole.x, fan.y - hole.y)).toBeGreaterThan(440);
  for (const build of view.builds) for (const part of build.parts) if (!part.carriedBy) {
    for (const fan of view.fans) expect(Math.hypot(part.x - fan.x, part.y - fan.y)).toBeGreaterThan(140);
    for (const hole of view.holes) expect(Math.hypot(part.x - hole.x, part.y - hole.y)).toBeGreaterThanOrEqual(168 - .01);
  }
}

test('parts relocate around a fan and remain collectible with ordinary movement and Place', async ({ page, browserName, hasTouch }) => {
  const { errors, send } = await open(page), input = await practiceInput(page, browserName, hasTouch);
  try {
    await send('test:moveTo', { x: 100, y: 100 });
    await send('test:placeTurbine', { x: 2245, y: 2100, intake: 0, still: true });
    await send('test:pinwheel', { x: 2100, y: 2100, kind: 'pinwheel' });
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getState().pinwheel.parts.length === 3);
    const initial = await scene(page); checkClear(initial);
    expect(initial.builds[0].parts.every(p => !p.carriedBy)).toBe(true);
    const target = initial.builds[0].parts.toSorted((a, b) => a.x - b.x || b.y - a.y)[0];
    await send('test:setGems', { count: 40 });
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 40);
    const width = (await scene(page)).me.width;
    await send('test:protect', { ms: 0 });
    await send('test:moveTo', { x: target.x - 130 - width / 2, y: target.y - width / 2 });
    await input.move(1, 0);
    await expect.poll(async () => (await scene(page)).builds[0].parts.find(p => p.kind === target.kind)?.carriedBy).toBe(initial.me.id);
    await input.stop();
    expect((await scene(page)).builds[0].parts.filter(p => p.carriedBy === initial.me.id)).toHaveLength(1);
    await page.screenshot({ path: test.info().outputPath('fan-and-relocated-components.png'), scale: 'css' });
    const end = Date.now() + 12000;
    while (Date.now() < end) {
      const view = await scene(page), build = view.builds[0];
      if (build.phase === 'carried') break;
      const part = build.parts.filter(p => p.carriedBy !== view.me.id).toSorted((a, b) => Math.hypot(a.x - view.me.x, a.y - view.me.y) - Math.hypot(b.x - view.me.x, b.y - view.me.y))[0];
      if (!part) break;
      const dx = part.x - view.me.x, dy = part.y - view.me.y, length = Math.hypot(dx, dy) || 1;
      await input.move(dx / length, dy / length); await page.waitForTimeout(80);
    }
    await input.stop();
    expect((await scene(page)).builds[0].phase).toBe('carried');
    const place = page.getByRole('button', { name: /Place weapon/ }); await expect(place).toBeVisible();
    if (hasTouch) await input.tapButton(place); else await page.keyboard.press('e');
    await expect.poll(async () => (await scene(page)).builds[0].phase).toBe('charging');
    expect(errors).toEqual([]);
  } finally { await input.close(); }
});

test('normal fan arrivals and replacements leave room for black holes and staggered parts', async ({ page }) => {
  const { errors, send } = await open(page, true);
  await send('test:moveTo', { x: 100, y: 100 });
  await expect.poll(async () => (await scene(page)).builds.filter(w => w.phase === 'parts').length, { timeout: 22000 }).toBeGreaterThanOrEqual(2);
  const before = await scene(page); checkClear(before);
  expect(before.fans.length).toBeGreaterThanOrEqual(3); expect(before.fans.length).toBeLessThanOrEqual(5);
  const oldIds = before.fans.map(f => f.id);
  // Advance the existing active -> ending -> replacement lifecycle, keeping the real selector.
  await send('test:endTurbines'); await page.waitForTimeout(100);
  await send('test:endTurbines'); await page.waitForTimeout(100);
  await expect.poll(async () => (await scene(page)).fans.filter(f => !oldIds.includes(f.id)).length, { timeout: 12000 }).toBeGreaterThanOrEqual(3);
  await expect.poll(async () => (await scene(page)).fans.filter(f => !oldIds.includes(f.id) && f.phase === 'active').length, { timeout: 6000 }).toBeGreaterThanOrEqual(3);
  const after = await scene(page); checkClear(after);
  const closest = after.fans.flatMap(fan => after.holes.map(hole => ({ fan, hole, distance: Math.hypot(fan.x - hole.x, fan.y - hole.y) }))).toSorted((a, b) => a.distance - b.distance)[0];
  // Frame the actual closest pair for screenshot review, without moving either landmark.
  await send('test:setGems', { count: 1000 }); await send('test:protect', { ms: 10000 });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 1000);
  const width = (await scene(page)).me.width;
  await send('test:moveTo', { x: (closest.fan.x + closest.hole.x - width) / 2, y: (closest.fan.y + closest.hole.y - width) / 2 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: test.info().outputPath('fan-and-black-hole-spacing.png'), scale: 'css' });
  expect(errors).toEqual([]);
});
