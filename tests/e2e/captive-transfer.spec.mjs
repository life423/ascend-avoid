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

  const snapshot = () => page.evaluate(({ captorId, captiveId }) => {
    const mode = window.game.currentGameMode, s = mode.multiplayerManager.room.state;
    const captor = s.players.get(captorId), captive = s.players.get(captiveId);
    return {
      gems: captive.gems, gained: captor.gems, width: captive.width, captorWidth: captor.width,
      capturedBy: captive.capturedBy, state: captive.state, flying: captive.flying,

      facing: captor.facing, hold: captive.captureHoldMs, ratio: captive.captureRatio, deadline: captor.gulpEndsAt, time: s.time,
      robbed: captive.robbedTotal, stolen: captor.stolenTotal,
      particles: mode.theftParticles.filter(p => p.from === captiveId && p.to === captorId).length,
    };
  }, { captorId, captiveId });
  return { peer, captorId, captiveId, snapshot, sizes, send };
}


for(const localCaptor of [true,false]) test(`healthy capture has no interior minigame (${localCaptor?'captor':'captive'})`,async({page,baseURL})=>{
 const{peer,snapshot,send,captorId}=await setup(page,baseURL,localCaptor);
 try {
  const first=await snapshot();expect(first.gems).toBe(70);expect(first.gained).toBe(280);
  await page.waitForFunction(expected=>window.game.currentGameMode.controls.action===expected,localCaptor?'FIRE':'CAPTURED');
  const fields=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return{belly:'bellyPending' in p,follow:'followUntil' in p};});expect(fields).toEqual({belly:false,follow:false});
  await page.screenshot({path:test.info().outputPath(localCaptor?'healthy-captor.png':'held-without-minigame.png')});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);await page.keyboard.up('ArrowRight');
  const later=await snapshot();expect(later.deadline).toBe(first.deadline);expect(later.gems).toBe(70);
  await send(captorId,'exhale');await send(captorId,'tap');await expect.poll(async()=>(await snapshot()).capturedBy).toBe('');
 } finally {await peer.leave();}
});
