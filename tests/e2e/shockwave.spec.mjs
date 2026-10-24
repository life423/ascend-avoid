import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local test server');

test('collect and place a Pulsar Array with a quiet HUD and visible pulses', async ({ page, hasTouch, baseURL }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0 }),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.multiplayerManager?.room?.state?.players?.size === 1);
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('intro-playing'))).toBe(false);
  await page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room;
    room.send('test:moveTo', { x: 2000, y: 2100 });
    room.send('test:pinwheel', { x: 2100, y: 2100, kind: 'pulsar' });
  });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.kind === 'pulsar' && window.game.currentGameMode.multiplayerManager.room.state.pinwheel.parts.length === 3);
  await page.screenshot({ path: test.info().outputPath('pulsar-parts-portrait.png') });
  if (hasTouch) {
    await page.setViewportSize({ width: 851, height: 393 }); await page.waitForTimeout(100);
    await page.screenshot({ path: test.info().outputPath('pulsar-parts-landscape.png') });
    await page.setViewportSize({ width: 393, height: 851 });
  }
  await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.send('test:setGems', { count: 200 }));
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 200);
  await page.evaluate(() => {
    const m = window.game.currentGameMode, room = m.multiplayerManager.room, p = m.multiplayerManager.getLocalPlayer();
    room.send('test:moveTo', { x: 1840 - p.width * .8, y: 2100 - p.height / 2 });
    room.send('test:face', { angle: 0 });
    m.localFacing = 0; m.localSpin = 0; m.facing = { x: 1, y: 0 };
  });
  await page.keyboard.down('Space');
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase === 'carried');
  await page.keyboard.up('Space');
  await expect.poll(() => page.evaluate(() => window.game.currentGameMode.notices.filter(n => n.category === 'weapon').length)).toBe(1);
  const button = page.getByRole('button', { name: 'Place weapon', exact: true });
  await expect(button).toBeVisible();
  await page.keyboard.down('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.up('ArrowDown');
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, { name: 'Wave target' });
  peer.onMessage('*', () => {});
  try {
    await expect.poll(() => peer.state.players?.size).toBe(2);
    peer.send('test:setGems', { count: 100 });
    await expect.poll(() => peer.state.players.get(peer.sessionId)?.gems).toBe(100);
    await page.screenshot({ path: test.info().outputPath('pulsar-placement.png') });
    if (hasTouch) await button.tap(); else await page.keyboard.press('e');
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.phase === 'charging');
    const position = await page.evaluate(() => {
      const w = window.game.currentGameMode.multiplayerManager.room.state.pinwheel; return { x: w.x + 150, y: w.y };
    });
    position.x -= peer.state.players.get(peer.sessionId).width / 2;
    position.y -= peer.state.players.get(peer.sessionId).height / 2;
    peer.send('test:moveTo', position); peer.send('test:protect', { ms: 0 });
    await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.room.state.pinwheel.pulseAt > 0);
    await page.waitForTimeout(250);
    await page.screenshot({ path: test.info().outputPath('pulsar-wave.png') });
    await expect.poll(() => peer.state.players.get(peer.sessionId)?.x).toBeGreaterThan(position.x + 100);
    expect(peer.state.players.get(peer.sessionId).gems).toBe(75);
    expect(await page.evaluate(() => window.game.currentGameMode.banner?.title)).toBe('Pulsar hit!');
    expect(peer.state.players.get(peer.sessionId).stunned).toBe(false);
    await expect(button).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await peer.leave(); }
});
