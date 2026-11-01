import { test, expect } from '@playwright/test';
import { build } from 'esbuild';

let renderer;
test.beforeAll(async () => {
  const result = await build({
    stdin: { contents: "export { drawCreature } from './src/render/creatures'; export { drawCombatRewards } from './src/render/combatRewards'; export { drawInjury, shellPlate, SHELL_PIECES } from './src/render/injury';", resolveDir: process.cwd(), loader: 'ts' },
    bundle: true, write: false, format: 'iife', globalName: 'injuryArt', platform: 'browser',
  });
  renderer = result.outputFiles[0].text;
});

async function prepare(page) {
  await page.goto('about:blank');
  await page.setContent('<style>body{margin:0;background:#071321;color:#dbe9ef;font:14px system-ui}canvas{display:block;width:100%}</style><canvas></canvas>');
  await page.addScriptTag({ content: renderer });
}

test('injured shells stay legible around the rear and sides with clear pupils at eight facings', async ({ page }) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    const sizes = [24, 36, 64, 108], colors = ['#ffffff', '#ff9900', '#72d9d0'];
    const canvas = document.querySelector('canvas'), width = innerWidth, cell = width < 600 ? width / 2 : width / 6;
    const columns = Math.round(width / cell), count = sizes.length * 8, rows = Math.ceil(count / columns), height = rows * 164 + 52;
    const ratio = devicePixelRatio;
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio); canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d'); ctx.scale(ratio, ratio);
    ctx.fillStyle = '#dbe9ef'; ctx.font = '600 15px system-ui'; ctx.fillText('Injury · rear and side shell fractures', 16, 26);
    let rearMinimum = Infinity, sideMinimum = Infinity, eyes = 0;
    for (let row = 0; row < sizes.length; row++) for (let facing = 0; facing < 8; facing++) {
      const size = sizes[row], angle = facing * Math.PI / 4, index = row * 8 + facing;
      const x = (index % columns + .5) * cell, y = 52 + Math.floor(index / columns) * 164 + 72;
      const visual = { age: 1000, remaining: 6000, reduced: true, pixelRatio: ratio };
      injuryArt.drawCreature(ctx, x, y, size, colors[row % colors.length], angle, 1000, '', false, 0, false, visual);
      ctx.fillStyle = '#a8bccb'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(size + 'px · ' + facing * 45 + '°', x, y + 74);
      // Compare actual pixels to a healthy render, in body-local coordinates.
      const clean = document.createElement('canvas'), hurt = document.createElement('canvas');
      clean.width = clean.height = hurt.width = hurt.height = 160;
      const a = clean.getContext('2d'), b = hurt.getContext('2d');
      injuryArt.drawCreature(a, 80, 80, size, colors[row % colors.length], angle, 1000);
      injuryArt.drawCreature(b, 80, 80, size, colors[row % colors.length], angle, 1000, '', false, 0, false, { ...visual, pixelRatio: 1 });
      const healthy = a.getImageData(0, 0, 160, 160).data, injured = b.getImageData(0, 0, 160, 160).data;
      let rear = 0, side = 0;
      for (let yy = 0; yy < 160; yy++) for (let xx = 0; xx < 160; xx++) {
        const dx = (xx - 80) / (size / 2), dy = (yy - 80) / (size / 2);
        const localX = dx * Math.cos(angle) + dy * Math.sin(angle), localY = -dx * Math.sin(angle) + dy * Math.cos(angle);
        const p = (yy * 160 + xx) * 4;
        const delta = Math.abs(injured[p] - healthy[p]) + Math.abs(injured[p + 1] - healthy[p + 1]) + Math.abs(injured[p + 2] - healthy[p + 2]);
        if (delta > 70 && dx * dx + dy * dy < 1) {
          if (localX < -.45) rear++;
          if (Math.abs(localY) > .7) side++;
        }
      }
      rearMinimum = Math.min(rearMinimum, rear); sideMinimum = Math.min(sideMinimum, side);
      for (const side of [-1, 1]) {
        const ex = Math.round(80 + (Math.cos(angle) * .42 - Math.sin(angle) * .36 * side) * size / 2);
        const ey = Math.round(80 + (Math.sin(angle) * .42 + Math.cos(angle) * .36 * side) * size / 2);
        // A tiny pupil can lie between pixel centers. Compare its darkest nearby pixel
        // with the healthy eye instead of assuming the rounded center is opaque black.
        let healthyDark = Infinity, injuredDark = Infinity;
        for (let yy = ey - 1; yy <= ey + 1; yy++) for (let xx = ex - 1; xx <= ex + 1; xx++) {
          const p = (yy * 160 + xx) * 4;
          healthyDark = Math.min(healthyDark, healthy[p] + healthy[p + 1] + healthy[p + 2]);
          injuredDark = Math.min(injuredDark, injured[p] + injured[p + 1] + injured[p + 2]);
        }
        if (injuredDark < 120 && Math.abs(healthyDark - injuredDark) < 12) eyes++;
      }
    }
    return { rearMinimum, sideMinimum, eyes };
  });
  expect(result.rearMinimum).toBeGreaterThan(8); expect(result.sideMinimum).toBeGreaterThan(4);
  expect(result.eyes).toBe(64);
  await page.screenshot({ path: test.info().outputPath('injury-size-and-rotation-review.png'), fullPage: true, scale: 'css' });
});

test('healing closes the fractures, reduced motion is static, and the fragments cover the original shell', async ({ page }) => {
  await prepare(page);
  const result = await page.evaluate(() => {
    const pixels = (age, remaining, reduced) => {
      const c = document.createElement('canvas'); c.width = c.height = 180; const ctx = c.getContext('2d');
      injuryArt.drawCreature(ctx, 90, 90, 120, '#ffffff', 0, 0, '', false, 0, false,
        remaining === 0 ? null : { age, remaining, reduced, pixelRatio: 1 });
      return ctx.getImageData(0, 0, 180, 180).data;
    };
    const healthy = pixels(7000, 0, true), open = pixels(1000, 6000, true), closing = pixels(6900, 100, true), later = pixels(2000, 6000, true);
    const difference = (a, b) => a.reduce((total, value, i) => total + Math.abs(value - b[i]), 0);
    const c = document.createElement('canvas'), ctx = c.getContext('2d');
    let missing = 0;
    for (let y = -48; y <= 48; y += 4) for (let x = -48; x <= 48; x += 4) {
      if ((x + .123) ** 2 + (y + .321) ** 2 > 48 ** 2) continue;
      let covered = false;
      for (let i = 0; i < injuryArt.SHELL_PIECES.length; i++) {
        injuryArt.shellPlate(ctx, i, 50); covered ||= ctx.isPointInPath(x + .123, y + .321);
      }
      if (!covered) missing++;
    }
    return { open: difference(open, healthy), closing: difference(closing, healthy), reducedChange: difference(open, later), missing };
  });
  expect(result.closing).toBeLessThan(result.open * .15); expect(result.reducedChange).toBe(0); expect(result.missing).toBe(0);
});

test('the finish breaks into the same shell plates without moving the reduced-motion fragments', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await prepare(page);
  const draw = () => page.evaluate(() => {
    const c = document.querySelector('canvas'); c.width = innerWidth; c.height = 300; c.style.height = '300px';
    const ctx = c.getContext('2d'), size = Math.min(120, innerWidth / 3);
    const mode = { cssScale: 1, rewardEffects: [{ x: innerWidth / 2, y: 150, size, facing: .2, earned: 0, how: 'mouth', at: 0, targetId: 'local' }], multiplayerManager: { localSessionId: 'local' } };
    injuryArt.drawCombatRewards(mode, ctx, { players: new Map() }, 190);
    const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
    let left = c.width, right = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) if (pixels[(y * c.width + x) * 4 + 3] > 0) {
      left = Math.min(left, x); right = Math.max(right, x);
    }
    return right - left;
  });
  const normal = await draw();
  await page.screenshot({ path: test.info().outputPath('matching-shell-shatter.png'), scale: 'css' });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await draw();
  expect(reduced).toBeLessThan(normal * .8);
  await page.screenshot({ path: test.info().outputPath('shatter-reduced-motion.png'), scale: 'css' });
});
