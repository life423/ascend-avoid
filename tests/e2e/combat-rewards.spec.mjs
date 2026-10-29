import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';
test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated server only');
async function setup(page, baseURL, hole) {
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.addInitScript(() => {
    const proto = CanvasRenderingContext2D.prototype;
    const begin = proto.beginPath, move = proto.moveTo, line = proto.lineTo, fill = proto.fill;
    proto.beginPath = function(...args) { this.__points = []; return begin.apply(this, args); };
    proto.moveTo = function(x, y) { this.__points?.push({ x, y }); return move.call(this, x, y); };
    proto.lineTo = function(x, y) { this.__points?.push({ x, y }); return line.call(this, x, y); };
    proto.fill = function(...args) {
      const p = this.__points;
      if (this.fillStyle === '#ffd166' && p?.length === 4 && p[0].x === p[2].x && p[1].y === p[3].y && p[0].y < p[2].y) {
        window.__rewardDiamonds ??= [];
        window.__rewardDiamonds.push({ x: p[0].x, y: p[1].y });
        if (window.__rewardDiamonds.length > 64) window.__rewardDiamonds.shift();
      }
      return fill.apply(this, args);
    };
  });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({ url: route.request().url().replace('/joinOrCreate/', '/create/'), postData: JSON.stringify({ ...route.request().postDataJSON(), testBots: 0, testFieldGems: 0, testCalm: true }) }));
  await page.goto('/'); await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  const roomId = await page.evaluate(() => window.game.currentGameMode.multiplayerManager.room.id);
  const peer = await new Client(baseURL.replace(/^http/, 'ws')).joinById(roomId, { name: 'Reward target' }); peer.onMessage('*', () => {});
  const send = (type, data) => page.evaluate(({ type, data }) => window.game.currentGameMode.multiplayerManager.room.send(type, data), { type, data });
  await send('test:setGems', { count: 250 }); peer.send('test:setGems', { count: 100 });
  await page.waitForFunction(id => { const s = window.game.currentGameMode.multiplayerManager.room.state; return s.players.get(id)?.gems === 100 && window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems === 250; }, peer.sessionId);
  const widths = await page.evaluate(id => { const m = window.game.currentGameMode; return { a: m.multiplayerManager.getLocalPlayer().width, b: m.multiplayerManager.room.state.players.get(id).width }; }, peer.sessionId);
  const cx = hole ? 650 : 1800, cy = hole ? 1260 : 1800;
  await send('test:moveTo', { x: cx - widths.a / 2, y: cy - widths.a / 2 }); await send('test:face', { angle: 0 }); await send('test:protect', { ms: 0 });
  peer.send('test:moveTo', { x: cx + widths.a * .3 + 1 - widths.b / 2, y: cy - widths.b / 2 }); peer.send('test:protect', { ms: 0 });
  await page.waitForFunction(id => !window.game.currentGameMode.multiplayerManager.room.state.players.get(id).spawnProtected, peer.sessionId);
  if (!hole) { peer.send('test:injure'); await page.waitForFunction(id => window.game.currentGameMode.multiplayerManager.room.state.players.get(id).breathingBlocked, peer.sessionId); }
  return { peer, send };
}
for (const hole of [false, true]) test(`${hole ? 'black-hole spiral' : 'mouth shatter'} returns conserved gems to the shooter`, async ({ page, baseURL }) => {
  const { peer, send } = await setup(page, baseURL, hole);
  try {
    await send('inhale');
    if (hole) {
      await page.waitForFunction(id => window.game.currentGameMode.multiplayerManager.room.state.players.get(id).capturedBy !== '', peer.sessionId);
      await send('exhale'); await send('tap');
    }
    await page.waitForFunction(how => window.game.currentGameMode.rewardEffects.some(e => e.how === how), hole ? 'blackhole' : 'mouth');
    await expect.poll(()=>page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems)).toBe(350);
    const reward = await page.evaluate(() => { const m = window.game.currentGameMode; return { earned: m.rewardEffects.at(-1).earned, gems: m.multiplayerManager.getLocalPlayer().gems, drops: m.multiplayerManager.room.state.gems.size }; });
    expect(reward.earned).toBe(hole ? 70 : 100); expect(reward.gems).toBe(350); expect(reward.drops).toBe(0);
    await page.screenshot({ path: test.info().outputPath(hole ? 'black-hole-reward-spiral.png' : 'mouth-finish-shatter.png') });
    if (hole) await page.evaluate(() => {
      // Inspect a deterministic phase of the real received effect; server credit is already verified.
      const effects = window.game.currentGameMode.rewardEffects;
      window.__rewardDiamonds = [];
      window.__holdRewardPhase = true;
      const hold = () => {
        if (!window.__holdRewardPhase) return;
        for (const effect of effects) effect.at = performance.now() - 1100;
        requestAnimationFrame(hold);
      };
      hold();
    });
    if (hole) await expect.poll(() => page.evaluate(() => window.__rewardDiamonds?.length ?? 0)).toBeGreaterThanOrEqual(8);
    if (hole) {
      const path = await page.evaluate(() => {
        const m = window.game.currentGameMode, effect = m.rewardEffects.at(-1), owner = m.multiplayerManager.getLocalPlayer();
        return { points: window.__rewardDiamonds.slice(-8), source: effect.holeX, destination: m.centerOf(owner.sessionId, owner).x };
      });
      for (const point of path.points) expect(point.x).toBeLessThan(path.source);
      for (const point of path.points) expect(point.x).toBeGreaterThan(path.destination);
    }
    await page.screenshot({ path: test.info().outputPath(hole ? 'black-hole-reward-return.png' : 'mouth-finish-reward.png') });
    await page.evaluate(() => { window.__holdRewardPhase = false; });
    expect(await page.evaluate(() => window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems)).toBe(350);
  } finally { await peer.leave(); }
});
