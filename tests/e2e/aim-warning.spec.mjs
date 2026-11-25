import { expect, test } from '@playwright/test';
import { playerBulletScene } from './helpers/player-bullet.mjs';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'requires an isolated local room');

for (const dodge of [false, true]) {
  test('a hidden shooter holds a firing line, then the player ' + (dodge ? 'sidesteps' : 'holds still'), async ({ page, baseURL, browserName, hasTouch }, info) => {
    const scene = await playerBulletScene(page, baseURL, 0, { entry: 'edge', edgeGap: 15, settleCamera: true, shooterStock: 1068, ammoStock: 0 });
    const input = await practiceInput(page, browserName, hasTouch);
    try {
      await input.prepareMovement();
      const angle = scene.horizontal ? 0 : Math.PI / 2;
      scene.shooter.send('test:face', { angle: angle + .8 });
      await page.waitForFunction(({ id, away }) => {
        const p = window.game.currentGameMode.multiplayerManager.getState().players.get(id);
        return p && Math.abs(p.facing - away) < .01;
      }, { id: scene.shooter.sessionId, away: angle + .8 });
      await page.waitForFunction(() => performance.now() - (window.playerWarnings.lastAimAt ?? 0) > 150);
      await page.evaluate(() => {
        window.playerWarnings.firstAimAt = null;
        const manager = window.game.currentGameMode.multiplayerManager;
        manager.room.onMessage('launch', () => window.launchAt = performance.now());
        manager.room.onMessage('impact', d => { if (d.targetId === manager.localSessionId) window.hitAt = performance.now(); });
      });
      await page.waitForTimeout(240);
      expect(await page.evaluate(() => window.playerWarnings.firstAimAt)).toBe(null);
      scene.shooter.send('test:face', { angle });
      await page.waitForFunction(() => window.playerWarnings.firstAimAt !== null, null, { timeout: 3000 });
      expect(await page.evaluate(() => window.playerWarnings.edges.length)).toBe(0);
      if (dodge) {
        await page.waitForTimeout(250);
        await input.move(scene.horizontal ? 0 : 1, scene.horizontal ? 1 : 0);
        await page.waitForFunction(() => performance.now() - window.playerWarnings.lastAimAt > 100);
      } else {
        await page.screenshot({ path: info.outputPath('aim-before-launch.png') });
      }
      scene.shooter.send('tap'); // keep the original facing, even if the defender moves
      await page.waitForFunction(() => !!window.launchAt);
      if (dodge) {
        await expect.poll(() => scene.ammo.state.players.get(scene.ammo.sessionId)?.flying).toBe(false);
        expect(await page.evaluate(() => window.hitAt)).toBeUndefined();
        expect(await page.evaluate(() => window.playerWarnings.edges.length)).toBe(0);
      } else {
        await page.waitForFunction(() => !!window.hitAt);
        const cue = await page.evaluate(() => ({aim:window.playerWarnings.firstAimAt, flight:window.playerWarnings.edges[0]?.at, hit:window.hitAt}));
        expect(cue.flight).toBeGreaterThan(cue.aim);
        expect(cue.hit).toBeGreaterThan(cue.flight);
      }
      expect(scene.errors).toEqual([]);
    } finally { await input.close(); await scene.close(); }
  });
}
