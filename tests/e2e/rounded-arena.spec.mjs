import { test, expect } from '@playwright/test';
import { practiceInput } from './helpers/practice.mjs';
test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local fixture only');
const W = 4200, R = 700, M = 8;
for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const [label, gems] of [['small', 0], ['large', 1000], ['giant', 1e9]]) {
  test(`${sx < 0 ? 'left' : 'right'}-${sy < 0 ? 'top' : 'bottom'} rounded corner: ${label} can slide and peel away`, async ({ page, browserName, hasTouch }) => {
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(() => {
      localStorage.setItem('ascend.practice.v2', JSON.stringify({ version: 2, offered: true, lessons: {} }));
      localStorage.setItem('ascend.mouseFollow', 'off');
    });
    await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
      url: route.request().url().replace('/joinOrCreate/', '/create/'),
      postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' }),
    }));
    await page.goto('/');
    await page.waitForFunction(() => {
      const m = window.game?.currentGameMode;
      return m?.lastView && m.introStart !== null && !m.introPlaying;
    });
    const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
    await send('test:clearHoles');
    await send('test:setGems', { count: gems });
    await page.waitForFunction(label => {
      const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer();
      return label === 'giant' ? p.width > 1200 : label === 'large' ? p.width > 290 && p.width < 310 : p.width === 20;
    }, label);
    const size = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().width);
    const inset = Math.max(R, M + size / 2), inner = Math.max(0, R - M - size / 2);
    const x = (sx < 0 ? inset : W - inset) + sx * inner / Math.SQRT2 - size / 2;
    const y = (sy < 0 ? inset : W - inset) + sy * inner / Math.SQRT2 - size / 2;
    await send('test:moveTo', { x, y });
    await page.waitForFunction(({ x, y }) => {
      const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
      return Math.hypot(p.x - x, p.y - y) < 1 && Math.hypot(m.predicted.x - x, m.predicted.y - y) < 3;
    }, { x, y });
    const input = await practiceInput(page, browserName, hasTouch);
    const read = () => page.evaluate(() => {
      const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
      return { x: p.x, y: p.y, width: p.width, px: m.predicted.x, py: m.predicted.y, stunned: p.stunned, sliding: p.sliding };
    });
    const fits = body => {
      for (const [cx, cy] of [[body.x + body.width / 2, body.y + body.width / 2], [body.px + body.width / 2, body.py + body.width / 2]]) {
        for (let i = 0; i < 24; i++) {
          const angle = i * Math.PI / 12, ax = cx + Math.cos(angle) * body.width / 2, ay = cy + Math.sin(angle) * body.width / 2;
          expect(ax).toBeGreaterThanOrEqual(-1); expect(ay).toBeGreaterThanOrEqual(-1);
          expect(ax).toBeLessThanOrEqual(W + 1); expect(ay).toBeLessThanOrEqual(W + 1);
          if ((ax < R || ax > W - R) && (ay < R || ay > W - R))
            expect(Math.hypot(ax - (ax < R ? R : W - R), ay - (ay < R ? R : W - R))).toBeLessThanOrEqual(R + 1);
        }
      }
      expect(Math.hypot(body.x - body.px, body.y - body.py)).toBeLessThan(35);
      expect(body.stunned).toBe(false); expect(body.sliding).toBe(false);
    };
    try {
      const start = await read(), tx = -sy / Math.SQRT2, ty = sx / Math.SQRT2;
      await input.move(tx, ty);
      for (let i = 0; i < 4; i++) { await page.waitForTimeout(120); fits(await read()); }
      const moved = await read();
      expect((moved.x - start.x) * tx + (moved.y - start.y) * ty).toBeGreaterThan(15);
      await input.stop();
      await page.waitForTimeout(450);
      const stopped = await read(); fits(stopped);
      await page.waitForTimeout(200);
      const stable = await read(); expect(Math.hypot(stable.x - stopped.x, stable.y - stopped.y)).toBeLessThan(2);
      await page.screenshot({ path: test.info().outputPath('rounded-corner.png'), scale: 'css' });
      await input.move(-sx / Math.SQRT2, -sy / Math.SQRT2);
      await page.waitForTimeout(400);
      const away = await read(); fits(away);
      expect((away.x - stable.x) * -sx + (away.y - stable.y) * -sy).toBeGreaterThan(15);
      expect(errors).toEqual([]);
    } finally { await input.close(); }
  });
}
