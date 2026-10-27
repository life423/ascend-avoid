import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

test('animated starfield has bounded drawing work without per-frame blur or cache allocation', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('ascend.guideSeen', 'true'));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const sample = await page.evaluate(() => {
    const g = window.game, ctx = g.ctx, proto = CanvasRenderingContext2D.prototype;
    const shadow = Object.getOwnPropertyDescriptor(proto, 'shadowBlur');
    const image = proto.drawImage, gradient = proto.createLinearGradient, create = Document.prototype.createElement;
    let blurs = 0, gradients = 0, allocations = 0, draws = 0;
    const sources = new Set(), times = [];
    Object.defineProperty(proto, 'shadowBlur', { ...shadow, set(value) { if (this === ctx && value > 0) blurs++; shadow.set.call(this, value); } });
    proto.drawImage = function(source, ...args) { if (this === ctx) { draws++; sources.add(source); } return image.call(this, source, ...args); };
    proto.createLinearGradient = function(...args) { if (this === ctx) gradients++; return gradient.apply(this, args); };
    Document.prototype.createElement = function(tag, ...args) { if (tag === 'canvas') allocations++; return create.call(this, tag, ...args); };
    try {
      const at = performance.now();
      for (let i = 0; i < 30; i++) { const start = performance.now(); g.background.update(at + i * 1000 / 60); times.push(performance.now() - start); }
      // Same-size resize events must not rebuild or randomize the background.
      const cache = g.background.atlas, stars = g.background.stars;
      g.background.resize();
      return { blurs, gradients, allocations, perFrameDraws: draws / 30, sources: sources.size, cacheReused: cache === g.background.atlas && stars === g.background.stars,
        meanMs: times.reduce((a,b) => a+b, 0) / times.length, p95Ms: times.sort((a,b) => a-b)[28], opacity: ctx.globalAlpha };
    } finally {
      Object.defineProperty(proto, 'shadowBlur', shadow); proto.drawImage = image; proto.createLinearGradient = gradient; Document.prototype.createElement = create;
    }
  });
  expect(sample.blurs).toBe(0); expect(sample.gradients).toBe(0); expect(sample.allocations).toBe(0);
  expect(sample.perFrameDraws).toBeGreaterThan(0); expect(sample.perFrameDraws).toBeLessThanOrEqual(400);
  expect(sample.sources).toBe(1); expect(sample.cacheReused).toBe(true); expect(sample.opacity).toBe(1);
  // Timings are evidence, not a pretend Android FPS guarantee on a shared CI runner.
  const path = test.info().outputPath('background-render.json');
  await writeFile(path, JSON.stringify(sample, null, 2));
  await test.info().attach('background-render-sample', { path, contentType: 'application/json' });
});
