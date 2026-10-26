import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');

async function setup(page, baseURL, localCaptor) {
  await page.addInitScript(() => {
    localStorage.setItem('ascend.guideSeen', 'true');
    localStorage.setItem('ascend.mouseFollow', 'off');
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testTurbines: 'manual', testCalm: true }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => !!window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, { name: localCaptor ? 'Gem captive' : 'Gem captor' });
  peer.onMessage('*', () => {});
  const localId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.sessionId);
  const captorId = localCaptor ? localId : peer.sessionId;
  const captiveId = localCaptor ? peer.sessionId : localId;
  const send = async (id, type, data) => {
    if (id === peer.sessionId) peer.send(type, data);
    else await page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  };
  await send(captorId, 'test:setGems', { count: 250 });
  await send(captiveId, 'test:setGems', { count: 100 });
  await page.waitForFunction(({ captorId, captiveId }) => {
    const s = window.game.currentGameMode.multiplayerManager.room.state;
    return s.players.get(captorId)?.gems === 250 && s.players.get(captiveId)?.gems === 100;
  }, { captorId, captiveId });
  const sizes = await page.evaluate(({ captorId, captiveId }) => {
    const s = window.game.currentGameMode.multiplayerManager.room.state;
    return { captor: s.players.get(captorId).width, captive: s.players.get(captiveId).width };
  }, { captorId, captiveId });
  await send(captorId, 'test:moveTo', { x: 1800, y: 1800 });
  await send(captorId, 'test:face', { angle: 0 });
  await send(captiveId, 'test:moveTo', { x: 1800 + sizes.captor, y: 1800 + (sizes.captor - sizes.captive) / 2 });
  await send(captiveId, 'test:protect', { ms: 0 });
  await page.waitForFunction(({ captiveId }) => {
    const p = window.game.currentGameMode.multiplayerManager.room.state.players.get(captiveId);
    return !p.spawnProtected && p.x > 1900;
  }, { captiveId });
  await send(captorId, 'inhale');
  await page.waitForFunction(({ captorId, captiveId }) => window.game.currentGameMode.multiplayerManager.room.state.players.get(captiveId).capturedBy === captorId, { captorId, captiveId });
  await send(captorId, 'cancel');
  const snapshot = () => page.evaluate(({ captorId, captiveId }) => {
    const mode = window.game.currentGameMode, s = mode.multiplayerManager.room.state;
    const captor = s.players.get(captorId), captive = s.players.get(captiveId);
    return {
      gems: captive.gems, gained: captor.gems, width: captive.width, captorWidth: captor.width,
      capturedBy: captive.capturedBy, state: captive.state, keys: captive.escapeKeys, ready: captor.fireReadyAt,
      robbed: captive.robbedTotal, stolen: captor.stolenTotal,
      particles: mode.theftParticles.filter(p => p.from === captiveId && p.to === captorId).length,
    };
  }, { captorId, captiveId });
  return { peer, captorId, captiveId, snapshot, sizes };
}

for (const localCaptor of [true, false]) test(`captive transfer is visible to the ${localCaptor ? 'captor' : 'captive'} and stops at 20%`, async ({ page, baseURL }) => {
  const { peer, snapshot, sizes } = await setup(page, baseURL, localCaptor);
  try {
    const initial = await snapshot();
    await expect.poll(async () => (await snapshot()).gems).toBeLessThanOrEqual(94);
    const during = await snapshot();
    expect(during.capturedBy).toBeTruthy(); expect(during.gems).toBeGreaterThan(80);
    expect(during.gems + during.gained).toBe(350);
    expect(during.width).toBeLessThan(sizes.captive); expect(during.captorWidth).toBeGreaterThan(sizes.captor);
    expect(during.keys).toBe(initial.keys); expect(during.ready).toBe(initial.ready);
    await expect.poll(async () => (await snapshot()).particles, { intervals: [50, 100] }).toBeGreaterThan(0);
    await page.screenshot({ path: test.info().outputPath('captive-transfer.png') });
    await expect.poll(async () => (await snapshot()).capturedBy, { timeout: 6000 }).toBe('');
    const released = await snapshot();
    expect(released.gems).toBe(80); expect(released.gained).toBe(270);
    expect(released.robbed).toBe(20); expect(released.stolen).toBe(20); expect(released.state).toBe('alive');
    await page.waitForTimeout(250);
    expect((await snapshot()).gems).toBe(80);
  } finally { await peer.leave(); }
});

test('escaping with actual keyboard input stops captive transfer and keeps the loss', async ({ page, baseURL }) => {
  const { peer, snapshot } = await setup(page, baseURL, false);
  try {
    await expect.poll(async () => (await snapshot()).gems).toBeLessThan(100);
    await page.waitForFunction(() => {
      const m = window.game.currentGameMode;
      return m.multiplayerManager.room.state.time >= m.multiplayerManager.getLocalPlayer().dazedUntil;
    });
    const keys = (await snapshot()).keys;
    for (let i = 0; i < keys.length; i++) {
      // Real input has a 60ms escape-message debounce; wait for each accepted direction.
      await page.keyboard.press({ U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight' }[keys[i]], { delay: 80 });
      await page.waitForFunction(step => {
        const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer();
        return !p.capturedBy || p.escapeStep >= step;
      }, i + 1);
    }
    await expect.poll(async () => (await snapshot()).capturedBy).toBe('');
    const escaped = await snapshot();
    expect(escaped.gems).toBeGreaterThan(80); expect(escaped.gems).toBeLessThan(100);
    expect(escaped.gems + escaped.gained).toBe(350);
    await page.waitForTimeout(750);
    expect((await snapshot()).gems).toBe(escaped.gems);
    await page.screenshot({ path: test.info().outputPath('escaped-with-gem-loss.png') });
  } finally { await peer.leave(); }
});
