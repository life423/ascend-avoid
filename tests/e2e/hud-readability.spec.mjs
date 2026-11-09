import { test, expect } from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local render checks');

test('giant face overlap softens HUD glass, keeps glyphs opaque and leaves readable crown-clear pickups', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');
    const proto = CanvasRenderingContext2D.prototype, begin = proto.beginPath, round = proto.roundRect, rect = proto.rect, fill = proto.fill, text = proto.fillText;
    const paths = new WeakMap();
    window.hudReadability = { panels: {}, glyphs: [], pickups: [] };
    proto.beginPath = function() { paths.delete(this); return begin.call(this); };
    if (round) proto.roundRect = function(x, y, width, height, radius) {
      paths.set(this, { x, y, width, height }); return round.call(this, x, y, width, height, radius);
    };
    proto.rect = function(x, y, width, height) {
      paths.set(this, { x, y, width, height }); return rect.call(this, x, y, width, height);
    };
    proto.fill = function(...args) {
      const rect = paths.get(this), pixel = this.canvas.width / this.canvas.getBoundingClientRect().width;
      if (rect && this.getTransform().a === 1 && this.fillStyle === 'rgba(6, 16, 30, 0.8)' && rect.x < 30 * pixel) {
        window.hudReadability.panels[rect.y < 45 * pixel ? 'score' : 'leaderboard'] = { ...rect, alpha: this.globalAlpha, at: performance.now() };
      }
      return fill.apply(this, args);
    };
    proto.fillText = function(value, x, y, ...args) {
      const transform = this.getTransform(), pixel = this.canvas.width / this.canvas.getBoundingClientRect().width, now = performance.now();
      if (transform.a === 1 && x < 160 * pixel && y < 150 * pixel) {
        window.hudReadability.glyphs = window.hudReadability.glyphs.filter(g => now - g.at < 120);
        window.hudReadability.glyphs.push({ value: String(value), alpha: this.globalAlpha, at: now });
      }
      if (/^\+\d/.test(String(value)) && this.fillStyle === '#ffd166') {
        const fontSize = parseFloat(this.font.match(/[\d.]+px/)?.[0] ?? 0);
        window.hudReadability.pickups.push({ value: String(value), x, y, alpha: this.globalAlpha, pixel: pixel / transform.a, cssFont: fontSize * transform.a / pixel, at: now });
      }
      return text.call(this, value, x, y, ...args);
    };
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), name: 'HUD reviewer', testBots: 0, testFieldGems: 0, testCalm: true }),
  }));
  await enterGame(page);
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  await send('test:setGems', { count: 200000 });
  await send('test:clearHoles', {});
  await send('test:parkTraffic', {});
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().width > 1400);

  for (const [orientation, width, height] of [['portrait', 475, 744], ['landscape', 915, 412]]) {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ reducedMotion: orientation === 'landscape' ? 'reduce' : 'no-preference' });
    await send('test:moveTo', { x: 0, y: 0 });
    await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(650);
    await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowUp');
    await expect.poll(() => page.evaluate(() => {
      const p = window.hudReadability.panels;
      return p.score?.alpha < .3 && p.leaderboard?.alpha < .3;
    })).toBe(true);
    const glyphs = await page.evaluate(() => window.hudReadability.glyphs.filter(g => performance.now() - g.at < 100));
    expect(glyphs.some(g => g.value === 'Score')).toBe(true);
    expect(glyphs.some(g => g.value.startsWith('HUD'))).toBe(true);
    expect(glyphs.every(g => g.alpha > .99)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${orientation}-giant-face.png`), scale: 'css' });

    // Ordinary inhale remains active; this changes only the glass over the face/near airflow.
    await page.keyboard.down('Space');
    await expect.poll(() => page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`${orientation}-giant-airflow.png`), scale: 'css' });
    await page.keyboard.up('Space');

    await send('test:moveTo', { x: 1400, y: 1400 });
    await expect.poll(() => page.evaluate(() => {
      const p = window.hudReadability.panels;
      return p.score?.alpha > .98 && p.leaderboard?.alpha > .98;
    })).toBe(true);
    await page.evaluate(() => {
      window.hudReadability.pickups = [];
      // Actual authoritative collection, large enough to remain visible over normal giant upkeep.
      const room = window.game.currentGameMode.multiplayerManager.room;
      for (let i = 0; i < 64; i++) room.send('test:placeGem', { dx: 0, dy: 0 });
    });
    await expect.poll(() => page.evaluate(() => window.hudReadability.pickups.some(p => performance.now() - p.at < 150 && p.alpha > .5))).toBe(true);
    const pickup = await page.evaluate(() => {
      const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
      return { label: window.hudReadability.pickups.at(-1), bodyY: (m.predicted ?? p).y };
    });
    expect(pickup.label.cssFont).toBeGreaterThanOrEqual(11.95);
    expect(pickup.bodyY - pickup.label.y).toBeGreaterThanOrEqual(64 + 8 * pickup.label.pixel - 1);
    if (orientation === 'landscape') {
      await page.waitForTimeout(120);
      const later = await page.evaluate(() => {
        const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
        return (m.predicted ?? p).y - window.hudReadability.pickups.at(-1).y;
      });
      expect(Math.abs(later - (pickup.bodyY - pickup.label.y))).toBeLessThan(.5 * pickup.label.pixel);
    }
    await page.screenshot({ path: test.info().outputPath(`${orientation}-giant-pickup.png`), scale: 'css' });
    // Let existing effects retire before the next orientation; no stale counters or auto awards.
    await expect.poll(() => page.evaluate(() => window.game.currentGameMode.pickups.length)).toBe(0);
  }
  expect(errors).toEqual([]);
});
