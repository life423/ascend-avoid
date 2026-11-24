import { test, expect } from '@playwright/test';
import { playFromEntry } from './helpers/enter-game.mjs';

test.skip(!process.env.PRACTICE_E2E, 'explicit local audio policy and interface checks');

// These exercise the shipped device policy in a browser with real Web Audio.
// Device identity is emulated; audio and player state are never substituted.
const identities = [
  { name: 'iPhone', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', touches: 5, viewport: { width: 390, height: 844 } },
  { name: 'iPad', userAgent: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1', platform: 'iPad', touches: 5, viewport: { width: 810, height: 1080 } },
  { name: 'iPad with desktop identity', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15', platform: 'MacIntel', touches: 2, viewport: { width: 1366, height: 1024 } },
];

async function openMenu(page) {
  const menu = page.getByRole('dialog', { name: 'Game Menu', exact: true });
  if (!await menu.isVisible()) {
    const compact = page.getByRole('button', { name: 'Toggle menu', exact: true });
    if (await compact.isVisible()) await compact.click();
    else await page.getByRole('button', { name: /Help & settings/ }).filter({ visible: true }).first().click();
  }
  await expect(menu).toBeVisible();
  await expect.poll(() => menu.evaluate(element => element.getBoundingClientRect().left)).toBeGreaterThanOrEqual(-.1);
  await expect.poll(() => menu.evaluate(element => element.getBoundingClientRect().right - innerWidth)).toBeLessThanOrEqual(.1);
  return menu;
}

for (const identity of identities) {
  test(`${identity.name} stays silent through Play and tutorials despite saved audio opt-in`, async ({ browser, browserName }, testInfo) => {
    const context = await browser.newContext({
      baseURL: testInfo.project.use.baseURL || process.env.E2E_URL || 'https://ascendavoid.com',
      userAgent: identity.userAgent,
      viewport: identity.viewport,
      hasTouch: true,
    });
    try {
      await context.addInitScript(({ platform, touches }) => {
        Object.defineProperty(navigator, 'platform', { configurable: true, value: platform });
        Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: touches });
        localStorage.setItem('ascend.guideSeen', 'true');
        localStorage.setItem('ascend.mouseFollow', 'off');
        localStorage.setItem('ascend.music', 'true');
        localStorage.setItem('ascend.muted', 'false');
        window.__silentAudioProbe = { supported: false, created: 0, rejections: [] };
        for (const name of ['AudioContext', 'webkitAudioContext']) {
          const NativeContext = window[name];
          if (typeof NativeContext !== 'function') continue;
          window.__silentAudioProbe.supported = true;
          window[name] = new Proxy(NativeContext, {
            construct(target, args) {
              window.__silentAudioProbe.created++;
              return Reflect.construct(target, args);
            },
          });
        }
        window.addEventListener('unhandledrejection', event => window.__silentAudioProbe.rejections.push(String(event.reason)));
      }, identity);
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto('/');
      const supported = await page.evaluate(() => window.__silentAudioProbe.supported);
      test.skip(browserName === 'webkit' && !supported, 'This WebKit build has no native Web Audio; silence enforcement is verified on Chromium and Firefox');
      expect(supported, 'Silence regression must run with a native Web Audio backend available').toBe(true);
      await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.isConnected() === true);
      await playFromEntry(page);
      await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing'));
      const audioControls = page.locator('[data-action="sound"], [data-action="music"]');
      await expect(audioControls).toHaveCount(0);
      expect(await page.evaluate(() => window.__silentAudioProbe.created)).toBe(0);

      const menu = await openMenu(page);
      await expect(audioControls).toHaveCount(0);
      if (!await page.evaluate(() => matchMedia('(pointer: fine)').matches)) {
        await expect(menu.locator('.settings-row')).toBeHidden();
      }
      await page.screenshot({ path: testInfo.outputPath('silent-menu.png'), animations: 'disabled' });
      await menu.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
      const picker = page.getByRole('dialog', { name: 'Practice / Tutorials', exact: true });
      await picker.locator('[data-lesson="basics"]').click();
      await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.lesson === 'basics');
      const actions = page.getByRole('group', { name: 'Tutorial actions', exact: true });
      await expect(actions).toBeVisible();
      await expect(audioControls).toHaveCount(0);
      await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.phase === 'waiting');
      await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Space');
      await page.screenshot({ path: testInfo.outputPath('silent-tutorial.png'), animations: 'disabled' });
      await expect(audioControls).toHaveCount(0);
      expect(await page.evaluate(() => window.__silentAudioProbe.created)).toBe(0);
      expect(await page.evaluate(() => window.__silentAudioProbe.rejections)).toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}
