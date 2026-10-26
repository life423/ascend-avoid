import { test, expect } from '@playwright/test';

test('mobile action labels are centered as a block with a consistent gap', async ({ page, hasTouch }) => {
  test.skip(!hasTouch, 'touch button layout');
  await page.addInitScript(() => localStorage.setItem('ascend.guideSeen', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing'));
  await page.evaluate(() => document.fonts.ready);
  const layouts = await page.evaluate(() => {
    const controls = window.game.currentGameMode.controls;
    const output = [], saved = [controls.action, controls.puffCooldown, controls.puffNeedsBreath];
    const canvas = document.createElement('canvas'); canvas.width = controls.canvas.width; canvas.height = controls.canvas.height;
    const ctx = canvas.getContext('2d'), original = ctx.fillText.bind(ctx);
    let boxes = [];
    ctx.fillText = function(text, x, y) {
      const m = this.measureText(text);
      boxes.push({ text, left: x - m.actualBoundingBoxLeft, right: x + m.actualBoundingBoxRight, top: y - m.actualBoundingBoxAscent, bottom: y + m.actualBoundingBoxDescent });
      original(text, x, y);
    };
    const r = Math.max(28, 50 * Math.min(1, (canvas.width - controls.insets.left - controls.insets.right) / 320));
    const cx = canvas.width - controls.insets.right - r - 24, cy = canvas.height - controls.insets.bottom - r - 30;
    for (const [action, cooldown, needs] of [['INHALE', 0, false], ['INHALE', 2.4, false], ['INHALE', 0, true], ['FIRE', 0, false], ['LOADING', 0, false], ['QUEUED', 0, false], ['SPIT', 0, false]]) {
      controls.action = action; controls.puffCooldown = cooldown; controls.puffNeedsBreath = needs; boxes = [];
      controls.draw(ctx, performance.now(), { phase: 'ready' });
      output.push({ boxes, cx, cy, r });
    }
    [controls.action, controls.puffCooldown, controls.puffNeedsBreath] = saved;
    return output;
  });
  for (const { boxes, cx, cy, r } of layouts) {
    expect(boxes.length).toBeGreaterThanOrEqual(1);
    for (const b of boxes) {
      expect(Math.abs((b.left + b.right) / 2 - cx)).toBeLessThan(.1);
      expect(b.left).toBeGreaterThan(cx - r + 10); expect(b.right).toBeLessThan(cx + r - 10);
    }
    expect(Math.abs((boxes[0].top + boxes.at(-1).bottom) / 2 - cy)).toBeLessThan(.1);
    if (boxes.length === 2) expect(boxes[1].top - boxes[0].bottom).toBeCloseTo(8, 1);
  }
  await page.screenshot({ path: test.info().outputPath('mobile-button-centered.png') });
});
