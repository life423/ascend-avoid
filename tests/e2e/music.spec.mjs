import { test, expect } from '@playwright/test';
import { enterGame, playFromEntry } from './helpers/enter-game.mjs';

test.skip(!process.env.PRACTICE_E2E, 'explicit local audio and interface checks');

// Observe actual Web Audio output rather than the music implementation's fields.
// Effects start muted so the first audible context can only be background music.
test.beforeEach(async ({ page }) => {
  test.skip(await page.evaluate(() => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)), 'iPhone and iPad intentionally have no game audio; covered by ios-silent.spec.mjs');
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');
    localStorage.setItem('ascend.muted', 'true');

    const contexts = [];
    const intervals = new Set();
    const setIntervalOriginal = window.setInterval.bind(window);
    const clearIntervalOriginal = window.clearInterval.bind(window);
    window.setInterval = (...args) => {
      const id = setIntervalOriginal(...args);
      intervals.add(id);
      return id;
    };
    window.clearInterval = id => { intervals.delete(id); clearIntervalOriginal(id); };

    const NativeContext = window.AudioContext || window.webkitAudioContext;
    if (!NativeContext) {
      window.__audioProbe = { supported: false };
      return;
    }
    const connectOriginal = AudioNode.prototype.connect;
    class ProbedAudioContext extends NativeContext {
      constructor(options) {
        super(options);
        const analyser = this.createAnalyser(), sink = this.createGain();
        analyser.fftSize = 2048;
        sink.gain.value = 0;
        // The passive mirror cannot change the game's audible route or volume.
        connectOriginal.call(analyser, sink);
        connectOriginal.call(sink, this.destination);
        contexts.push({ context: this, analyser, sink, samples: new Float32Array(2048), rms: 0, peak: 0, maxPeak: 0 });
      }
    }
    if (window.AudioContext) window.AudioContext = ProbedAudioContext;
    if (window.webkitAudioContext) window.webkitAudioContext = ProbedAudioContext;
    AudioNode.prototype.connect = function(destination, ...args) {
      const result = connectOriginal.call(this, destination, ...args);
      const record = contexts.find(entry => entry.context === this.context);
      if (record && destination === record.context.destination && this !== record.sink) {
        connectOriginal.call(this, record.analyser, args[0] || 0, 0);
      }
      return result;
    };
    const measure = () => {
      for (const record of contexts) {
        record.rms = 0; record.peak = 0;
        if (record.context.state !== 'running') continue;
        record.analyser.getFloatTimeDomainData(record.samples);
        let energy = 0;
        for (const sample of record.samples) {
          energy += sample * sample;
          record.peak = Math.max(record.peak, Math.abs(sample));
        }
        record.rms = Math.sqrt(energy / record.samples.length);
        record.maxPeak = Math.max(record.maxPeak, record.peak);
      }
    };
    const sampleFrame = () => { measure(); requestAnimationFrame(sampleFrame); };
    requestAnimationFrame(sampleFrame);
    window.__audioProbe = {
      supported: true,
      read() {
        measure();
        return { contexts: contexts.map(entry => ({ state: entry.context.state, currentTime: entry.context.currentTime, rms: entry.rms, peak: entry.peak, maxPeak: entry.maxPeak })), intervals: intervals.size };
      },
      resetPeaks() { for (const entry of contexts) entry.maxPeak = 0; },
    };
  });
});

async function startGame(page, browserName, requireAudio = true) {
  await enterGame(page);
  await page.waitForFunction(() => !!window.game?.currentGameMode?.multiplayerManager?.getLocalPlayer() && !document.body.classList.contains('intro-playing'));
  if (!requireAudio) return;
  const supported = await page.evaluate(() => window.__audioProbe?.supported);
  // The Windows Playwright WebKit build omits Web Audio entirely. Do not count
  // its unavailable native output as passing an audio assertion; the separate
  // unavailable-API case below still exercises UI and saved choices there.
  test.skip(browserName === 'webkit' && !supported, 'Native Web Audio is unavailable in this Playwright WebKit build; audio output is unverified');
  expect(supported, 'Chromium and Firefox audio-output coverage requires native Web Audio').toBe(true);
}

async function openMenu(page) {
  const dialog = page.getByRole('dialog', { name: 'Game Menu', exact: true });
  if (!await dialog.isVisible()) {
    const compact = page.getByRole('button', { name: 'Toggle menu', exact: true });
    if (await compact.isVisible()) await compact.click();
    else await page.getByRole('button', { name: /Help & settings/ }).filter({ visible: true }).first().click();
  }
  await expect(dialog).toBeVisible();
  return dialog;
}

const probe = page => page.evaluate(() => window.__audioProbe.read());
const level = (state, index) => index === undefined
  ? Math.max(0, ...state.contexts.map(context => context.rms))
  : state.contexts[index]?.rms || 0;
const expectAudible = async (page, index) => {
  try {
    await expect.poll(async () => level(await probe(page), index), { timeout: 8000 }).toBeGreaterThan(0.00002);
  } catch (error) {
    await test.info().attach('native-audio-output', { body: JSON.stringify(await probe(page)), contentType: 'application/json' });
    throw error;
  }
};
const expectSilent = (page, index) => expect.poll(async () => level(await probe(page), index), { timeout: 5000 }).toBeLessThan(0.000001);

test('music starts off, is reachable on touch and keyboard, and actually plays only after opting in', async ({ page, browserName }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await startGame(page, browserName);
  const dialog = await openMenu(page);
  const music = dialog.getByRole('button', { name: 'Background music', exact: true });
  await expect(music).toHaveText('Music off');
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  expect((await probe(page)).contexts).toHaveLength(0);
  const bounds = await music.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThan(2);

  await music.focus();
  await page.keyboard.press('Space');
  await expect(music).toHaveText('Music on');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('ascend.music'))).toBe('true');
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
  await expectAudible(page);
  await page.screenshot({ path: test.info().outputPath('music-on-settings.png') });

  await page.keyboard.press('Space');
  await expect(music).toHaveText('Music off');
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => localStorage.getItem('ascend.music'))).toBe('false');
  await expectSilent(page);
  expect(errors).toEqual([]);
});

test('the remembered choice survives reload while playback still waits for the Play gesture', async ({ page, browserName }) => {
  await startGame(page, browserName);
  let dialog = await openMenu(page);
  await dialog.getByRole('button', { name: 'Background music', exact: true }).click();
  await expectAudible(page);
  await page.reload();
  await expect(page.getByRole('dialog', { name: 'Ascend Avoid', exact: true })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('ascend.music'))).toBe('true');
  await expectSilent(page);
  await playFromEntry(page);
  dialog = await openMenu(page);
  await expect(dialog.getByRole('button', { name: 'Background music', exact: true })).toHaveText('Music on');
  await expectAudible(page);
  await dialog.getByRole('button', { name: 'Background music', exact: true }).click();
  await expectSilent(page);
  await page.reload();
  await playFromEntry(page);
  dialog = await openMenu(page);
  await expect(dialog.getByRole('button', { name: 'Background music', exact: true })).toHaveText('Music off');
  expect((await probe(page)).contexts).toHaveLength(0);
});

test('music and sound effects can each remain audible when the other is muted', async ({ page, browserName }) => {
  await startGame(page, browserName);
  const dialog = await openMenu(page);
  const music = dialog.getByRole('button', { name: 'Background music', exact: true });
  const effects = dialog.getByRole('button', { name: 'Mute sound effects', exact: true });
  await expect(effects).toHaveText('Effects off');
  await music.click();
  await expectAudible(page);
  const musicIndex = (await probe(page)).contexts.findIndex(context => context.rms > 0.00002);
  expect(musicIndex).toBeGreaterThanOrEqual(0);
  await effects.click();
  await expect(effects).toHaveText('Effects on');
  await expectAudible(page, musicIndex);
  await effects.click();
  await expect(effects).toHaveText('Effects off');
  await expectAudible(page, musicIndex);
  await effects.click();
  await music.click();
  await expect(music).toHaveText('Music off');
  await expect(effects).toHaveText('Effects on');
  await expectSilent(page, musicIndex);

  // Unmuting effects plays their existing short confirmation cue.
  await effects.click();
  await page.evaluate(() => window.__audioProbe.resetPeaks());
  await effects.click();
  await expect.poll(async () => Math.max(0, ...(await probe(page)).contexts.filter((_, index) => index !== musicIndex).map(context => context.maxPeak))).toBeGreaterThan(0.00002);
  await expectSilent(page, musicIndex);
  expect(await page.evaluate(() => localStorage.getItem('ascend.music'))).toBe('false');
});

test('music stays reachable during a tutorial and synchronizes with the game menu', async ({ page, hasTouch, browserName }) => {
  await startGame(page, browserName);
  let dialog = await openMenu(page);
  await dialog.getByRole('button', { name: 'Background music', exact: true }).click();
  await expectAudible(page);
  await dialog.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  const picker = page.getByRole('dialog', { name: 'Practice / Tutorials', exact: true });
  await picker.locator('[data-lesson="basics"]').click();
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.lesson === 'basics');
  const actions = page.getByRole('group', { name: 'Tutorial actions', exact: true });
  const music = actions.getByRole('button', { name: 'Background music', exact: true });
  await expect(music).toHaveText('Music on');
  await music.scrollIntoViewIfNeeded();
  const bounds = await music.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.y).toBeGreaterThanOrEqual(0);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(page.viewportSize().width);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  if (hasTouch) {
    expect(bounds.width).toBeGreaterThanOrEqual(44);
    expect(bounds.height).toBeGreaterThanOrEqual(44);
  }
  const hit = await music.evaluate(element => {
    const box = element.getBoundingClientRect();
    const target = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return { reachable: element.contains(target), target: target?.outerHTML.slice(0, 250) };
  });
  expect(hit.reachable, JSON.stringify(hit)).toBe(true);
  await music.focus();
  await page.keyboard.press('Space');
  await expect(music).toHaveText('Music off');
  await expectSilent(page);
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
  await page.screenshot({ path: test.info().outputPath('tutorial-music-control.png') });
  await actions.getByRole('button', { name: 'Exit tutorial', exact: true }).click();
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.getState()?.practice?.enabled === false);
  dialog = await openMenu(page);
  await expect(dialog.getByRole('button', { name: 'Background music', exact: true })).toHaveText('Music off');
  await expect(dialog.getByRole('button', { name: 'Background music', exact: true })).toHaveAttribute('aria-pressed', 'false');
});

test('rapid toggles do not stack playback and a hidden page pauses an opted-in soundtrack', async ({ page, browserName }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await startGame(page, browserName);
  const dialog = await openMenu(page);
  const music = dialog.getByRole('button', { name: 'Background music', exact: true });
  const baselineIntervals = (await probe(page)).intervals;
  await music.click();
  await expectAudible(page);
  for (let cycle = 0; cycle < 6; cycle++) { await music.click(); await music.click(); }
  await expect(music).toHaveText('Music on');
  await expectAudible(page);
  expect((await probe(page)).contexts.filter(context => context.state === 'running')).toHaveLength(1);
  expect((await probe(page)).intervals).toBeLessThanOrEqual(baselineIntervals + 1);

  // Deterministic lifecycle regression: synthesize visibility, not player state.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectSilent(page);
  expect(await page.evaluate(() => localStorage.getItem('ascend.music'))).toBe('true');
  await expect(music).toHaveText('Music on');
  await expect.poll(async () => (await probe(page)).intervals).toBeLessThanOrEqual(baselineIntervals);
  await page.evaluate(() => {
    delete document.hidden;
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expectAudible(page);
  await music.click();
  await expectSilent(page);
  await expect.poll(async () => (await probe(page)).intervals).toBeLessThanOrEqual(baselineIntervals);
  expect(errors).toEqual([]);
});

test('unavailable music storage stays default-off and does not break the setting', async ({ page, browserName }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    const get = Storage.prototype.getItem, set = Storage.prototype.setItem;
    Storage.prototype.getItem = function(key) {
      if (key === 'ascend.music') throw new DOMException('Storage unavailable', 'SecurityError');
      return get.call(this, key);
    };
    Storage.prototype.setItem = function(key, value) {
      if (key === 'ascend.music') throw new DOMException('Storage unavailable', 'SecurityError');
      return set.call(this, key, value);
    };
  });
  await startGame(page, browserName);
  const dialog = await openMenu(page);
  const music = dialog.getByRole('button', { name: 'Background music', exact: true });
  await expect(music).toHaveText('Music off');
  await music.click();
  await expectAudible(page);
  await music.click();
  await expectSilent(page);
  expect(errors).toEqual([]);
});

test('unavailable Web Audio preserves default-off, accessible controls and saved choices without errors', async ({ page, browserName, hasTouch }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    Object.defineProperty(window, 'AudioContext', { configurable: true, writable: true, value: undefined });
    Object.defineProperty(window, 'webkitAudioContext', { configurable: true, writable: true, value: undefined });
    window.__musicUnhandled = [];
    window.addEventListener('unhandledrejection', event => window.__musicUnhandled.push(String(event.reason)));
  });
  await startGame(page, browserName, false);
  expect(await page.evaluate(() => typeof window.AudioContext)).toBe('undefined');
  let dialog = await openMenu(page);
  let music = dialog.getByRole('button', { name: 'Background music', exact: true });
  const effects = dialog.getByRole('button', { name: 'Mute sound effects', exact: true });
  await expect(music).toHaveText('Music off');
  await expect(music).toHaveAttribute('aria-pressed', 'false');
  await expect(effects).toHaveText('Effects off');
  const bounds = await music.boundingBox();
  expect(bounds.width).toBeGreaterThanOrEqual(44);
  expect(bounds.height).toBeGreaterThanOrEqual(44);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(page.viewportSize().height);
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThan(2);
  await music.focus();
  await page.keyboard.press('Space');
  await expect(music).toHaveText('Music on');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  expect(await page.evaluate(() => localStorage.getItem('ascend.music'))).toBe('true');
  await expect(effects).toHaveText('Effects off');
  expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
  await effects.click();
  await expect(effects).toHaveText('Effects on');
  await expect(music).toHaveText('Music on');
  expect(await page.evaluate(() => window.__musicUnhandled)).toEqual([]);

  await page.reload();
  await playFromEntry(page);
  dialog = await openMenu(page);
  music = dialog.getByRole('button', { name: 'Background music', exact: true });
  await expect(music).toHaveText('Music on');
  await expect(music).toHaveAttribute('aria-pressed', 'true');
  await dialog.getByRole('button', { name: 'Practice / Tutorials', exact: true }).click();
  await page.getByRole('dialog', { name: 'Practice / Tutorials', exact: true }).locator('[data-lesson="basics"]').click();
  const actions = page.getByRole('group', { name: 'Tutorial actions', exact: true });
  const practiceMusic = actions.getByRole('button', { name: 'Background music', exact: true });
  await expect(practiceMusic).toHaveText('Music on');
  await practiceMusic.scrollIntoViewIfNeeded();
  if (hasTouch) expect((await practiceMusic.boundingBox()).height).toBeGreaterThanOrEqual(44);
  await practiceMusic.click();
  await expect(practiceMusic).toHaveText('Music off');
  expect(await page.evaluate(() => localStorage.getItem('ascend.music'))).toBe('false');
  await page.screenshot({ path: test.info().outputPath('music-unavailable-controls.png') });
  expect(await page.evaluate(() => window.__musicUnhandled)).toEqual([]);
  expect(errors).toEqual([]);
});
