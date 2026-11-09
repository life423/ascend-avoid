import { test, expect } from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import { Client } from 'colyseus.js';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local fixtures only');
const W = 4200, M = 8;
const walls = [
  { name: 'left', normal: { x: 1, y: 0 }, tangent: { x: 0, y: 1 }, facing: 0 },
  { name: 'right', normal: { x: -1, y: 0 }, tangent: { x: 0, y: 1 }, facing: Math.PI },
  { name: 'top', normal: { x: 0, y: 1 }, tangent: { x: 1, y: 0 }, facing: Math.PI / 2 },
  { name: 'bottom', normal: { x: 0, y: -1 }, tangent: { x: 1, y: 0 }, facing: -Math.PI / 2 },
];

async function scene(page, baseURL) {
  await page.addInitScript(() => {
    localStorage.setItem('ascend.practice.v2', JSON.stringify({ version: 2, offered: true, lessons: {} }));
    localStorage.setItem('ascend.mouseFollow', 'off');
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url: route.request().url().replace('/joinOrCreate/', '/create/'),
    postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' }),
  }));
  await enterGame(page);
  await page.waitForFunction(() => {
    const m = window.game?.currentGameMode;
    return m?.lastView && !m.introPlaying;
  });
  const id = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(id, { name: 'Pursuer' });
  peer.onMessage('*', () => {});
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  await send('test:setGems', { count: 100 }); peer.send('test:setGems', { count: 100 });
  await page.waitForFunction(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 100);
  await expect.poll(() => peer.state.players.get(peer.sessionId)?.gems).toBe(100);
  await page.evaluate(() => {
    const room = window.game.currentGameMode.multiplayerManager.room; window.wallPuffs = [];
    room.onMessage('exhale', data => { if (data.id === room.sessionId) window.wallPuffs.push(data); });
  });
  return { peer, send };
}

for (const wall of walls) for (const direction of [-1, 1]) {
  test(`${wall.name} wall: input chooses ${direction < 0 ? 'negative' : 'positive'} tangent without losing inhale`, async ({ page, baseURL, browserName, hasTouch }) => {
    const { peer, send } = await scene(page, baseURL), input = await practiceInput(page, browserName, hasTouch);
    try {
      const width = peer.state.players.get(peer.sessionId).width;
      const x = wall.name === 'left' ? M : wall.name === 'right' ? W - M - width : 2100;
      const y = wall.name === 'top' ? M : wall.name === 'bottom' ? W - M - width : 2100;
      await send('test:moveTo', { x, y }); await send('test:protect', { ms: 0 });
      peer.send('test:moveTo', { x: x + wall.normal.x * (width + 80), y: y + wall.normal.y * (width + 80) });
      peer.send('test:face', { angle: wall.facing + Math.PI }); peer.send('test:protect', { ms: 0 });
      await page.waitForFunction(({ x, y }) => {
        const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
        return Math.abs(p.x - x) < 1 && Math.abs(p.y - y) < 1 && Math.abs(m.predicted.x - x) < 2 && Math.abs(m.predicted.y - y) < 2;
      }, { x, y });
      const intent = { x: wall.tangent.x * direction, y: wall.tangent.y * direction };
      await input.move(intent.x, intent.y);
      await expect.poll(() => page.evaluate(({ x, y }) => {
        const p = window.game.currentGameMode.multiplayerManager.getLocalPlayer();
        return p.movementVx * x + p.movementVy * y;
      }, intent)).toBeGreaterThan(20);
      peer.send('inhale');
      await expect.poll(() => peer.state.players.get(peer.sessionId).inhaling, { intervals: [10, 20] }).toBe(true);
      // Keep the real steering input while controlling the puff's starting pose.
      // Waiting between facing and tapping lets walking turn the body out of the hit cone.
      await page.evaluate(({ x, y, angle }) => {
        const room = window.game.currentGameMode.multiplayerManager.room;
        room.send('test:moveTo', { x, y });
        room.send('test:face', { angle });
        room.send('tap');
      }, { x, y, angle: wall.facing });
      await page.waitForFunction(() => window.wallPuffs.length > 0);
      const cast = await page.evaluate(() => window.wallPuffs.at(-1));
      expect(cast.wallSlideX * wall.tangent.x * direction + cast.wallSlideY * wall.tangent.y * direction).toBeGreaterThan(0);
      expect(Math.hypot(cast.wallSlideX, cast.wallSlideY)).toBeLessThanOrEqual(cast.recoil + 1e-6);
      expect(cast.recoil).toBeLessThanOrEqual(420);
      expect(peer.state.players.get(peer.sessionId).inhaling).toBe(true);
      await page.waitForTimeout(100);
      const result = await page.evaluate(() => {
        const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer();
        return { x: p.x, y: p.y, width: p.width, height: p.height, stunned: p.stunned, sliding: p.sliding,
          cue: m.puffs.some(puff => puff.slideX || puff.slideY), error: Math.hypot(m.predicted.x - p.x, m.predicted.y - p.y) };
      });
      expect((result.x - x) * wall.tangent.x * direction + (result.y - y) * wall.tangent.y * direction).toBeGreaterThan(5);
      expect(result.x).toBeGreaterThanOrEqual(M); expect(result.y).toBeGreaterThanOrEqual(M);
      expect(result.x + result.width).toBeLessThanOrEqual(W - M); expect(result.y + result.height).toBeLessThanOrEqual(W - M);
      expect(result.stunned).toBe(false); expect(result.sliding).toBe(false);
      expect(result.cue).toBe(true); expect(result.error).toBeLessThan(35);
      await page.screenshot({ path: test.info().outputPath('wall-slip-with-airflow.png'), scale: 'css' });
    } finally { await input.close(); await peer.leave(); }
  });
}
