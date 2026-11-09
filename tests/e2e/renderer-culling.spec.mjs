import { expect, test } from '@playwright/test';
import { buildSync } from 'esbuild';
import { fileURLToPath } from 'node:url';

const fixtureURL = 'http://renderer-culling.test/';
const fixture = buildSync({
    entryPoints: [fileURLToPath(new URL('./fixtures/renderer-culling.ts', import.meta.url))],
    bundle: true, format: 'iife', globalName: 'RendererCullingFixture', platform: 'browser', write: false,
}).outputFiles[0].text;

test.use({ userAgent: 'Mozilla/5.0 (Android 16; Mobile; rv:145.0) Gecko/145.0 Firefox/145.0' });

test.beforeEach(async ({ page }) => {
    await page.route(fixtureURL, route => route.fulfill({ contentType: 'text/html', body: '<!doctype html>' }));
    await page.goto(fixtureURL);
    await page.addScriptTag({ content: fixture });
});

for (const attack of ['bolt', 'ion warning', 'ion firing', 'pulsar']) {
    test(`${attack} paints in view from an offscreen weapon`, async ({ page }) => {
        const { nearby, offscreen } = await page.evaluate(attack => ({
            nearby: window.RendererCullingFixture.renderWeapon(attack, true),
            offscreen: window.RendererCullingFixture.renderWeapon(attack, false),
        }), attack);

        expect(offscreen.androidFirefox).toBe(true);
        expect(nearby.chassisDraws).toBe(1);
        expect(offscreen.attackPixels).toBeGreaterThan(5);
        expect(offscreen.chassisDraws).toBe(0);
    });
}

test('an offscreen rival keeps interpolating before drawing again', async ({ page }) => {
    const { first, second, visible, expectedFirst, expectedSecond, expectedVisible } = await page.evaluate(
        () => window.RendererCullingFixture.renderMovingRival(),
    );

    expect(first.x).toBeCloseTo(expectedFirst);
    expect(second.x).toBeCloseTo(expectedSecond);
    expect(first.paths).toBe(0);
    expect(second.paths).toBe(0);
    expect(visible.x).toBeCloseTo(expectedVisible);
    expect(visible.paths).toBeGreaterThan(0);
});
