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
      bellyX: captive.bellyX, bellyY: captive.bellyY, pending: captive.bellyPending, collected: captive.bellyCollected,
      facing: captor.facing, hold: captive.captureHoldMs, ratio: captive.captureRatio, deadline: captor.gulpEndsAt, time: s.time,
      robbed: captive.robbedTotal, stolen: captor.stolenTotal,
      particles: mode.theftParticles.filter(p => p.from === captiveId && p.to === captorId).length,
    };
  }, { captorId, captiveId });
  return { peer, captorId, captiveId, snapshot, sizes, send };
}


for (const localCaptor of [true, false]) test(`capture transfers once and has no loading or escape panel (${localCaptor ? 'captor' : 'captive'})`, async ({ page, baseURL }) => {
 const { peer, snapshot, sizes, send, captorId } = await setup(page, baseURL, localCaptor);
 try {
  const first = await snapshot(); expect(first.gems).toBe(70); expect(first.gained).toBe(280);
  expect(first.ratio).toBeCloseTo(sizes.captor / sizes.captive, 5);
  expect(first.width).toBeLessThan(sizes.captive); expect(first.captorWidth).toBeGreaterThan(sizes.captor);
  await send(captorId, 'inhale'); await page.waitForTimeout(150);
  expect((await snapshot()).capturedBy).toBe(captorId); expect((await snapshot()).flying).toBe(false);
  const control = await page.evaluate(() => window.game.currentGameMode.controls.action);
  expect(control).toBe(localCaptor ? 'FIRE' : 'SALVAGE');
  await page.screenshot({ path: test.info().outputPath(localCaptor ? 'immediate-fire-captor.png' : 'translucent-belly-salvage.png') });
  await page.waitForTimeout(400);const during = await snapshot(); expect(during.gems).toBe(70);expect(during.deadline).toBe(first.deadline);
  await expect.poll(async () => (await snapshot()).capturedBy, { timeout: 13000 }).toBe('');
  const after=await snapshot(); expect(after.gems).toBe(70);expect(after.gained).toBe(280);expect(after.state).toBe('alive');expect(after.pending).toBe(0);
 } finally { await peer.leave(); }
});

test('keyboard and existing mobile joystick move only the interior avatar; safe ejection pays pending gems once', async ({ page, baseURL, hasTouch }) => {
 const { peer, snapshot } = await setup(page, baseURL, false);
 try {
  const first=await snapshot();
  if (hasTouch) await page.evaluate(() => {
   const canvas=document.querySelector('canvas.game-canvas'),r=canvas.getBoundingClientRect();
   const x=r.left+r.width*.23,y=r.top+r.height*.7;
   canvas.dispatchEvent(new PointerEvent('pointerdown',{pointerId:99,pointerType:'touch',clientX:x,clientY:y,bubbles:true}));
   window.dispatchEvent(new PointerEvent('pointermove',{pointerId:99,pointerType:'touch',clientX:x+70,clientY:y,bubbles:true}));
  }); else await page.keyboard.down('ArrowRight');
  await expect.poll(async () => (await snapshot()).pending, {timeout:2000,intervals:[50,75]}).toBeGreaterThan(0);
  if (hasTouch) await page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup',{pointerId:99,pointerType:'touch',bubbles:true})));
  else await page.keyboard.up('ArrowRight');
  const active=await snapshot();expect(active.bellyX).toBeGreaterThan(.4);expect(active.gems).toBe(70);expect(active.width).toBe(first.width);expect(active.facing).toBe(first.facing);expect(active.deadline).toBe(first.deadline);
  await page.screenshot({path:test.info().outputPath('belly-collected-pending.png')});
  await expect.poll(async () => (await snapshot()).capturedBy,{timeout:13000}).toBe('');
  const returned=await snapshot();expect(returned.gems).toBe(70+active.pending);expect(returned.pending).toBe(0);
  await page.waitForTimeout(250);expect((await snapshot()).gems).toBe(returned.gems);
  expect(await page.evaluate(() => window.game.currentGameMode.controls.action)).toBe('INHALE');
 } finally {await peer.leave();}
});

test('the existing desktop or mobile action fires immediately after a release, without auto-firing from held capture input', async ({page,baseURL,hasTouch})=>{
 const {peer,snapshot,send,captorId}=await setup(page,baseURL,true);
 try{
  await page.waitForTimeout(300);expect((await snapshot()).flying).toBe(false);
  await send(captorId,'exhale');
  if(hasTouch)await page.evaluate(()=>{
   const canvas=document.querySelector('canvas.game-canvas'),r=canvas.getBoundingClientRect(),b={x:r.width-75,y:r.height-90};
   const event=type=>new PointerEvent(type,{pointerId:77,pointerType:'touch',clientX:r.left+b.x,clientY:r.top+b.y,bubbles:true});
   canvas.dispatchEvent(event('pointerdown'));window.dispatchEvent(event('pointerup'));
  });else await page.keyboard.press('Space',{delay:35});
  await expect.poll(async()=>(await snapshot()).flying,{timeout:1500,intervals:[25,50]}).toBe(true);
  expect((await snapshot()).capturedBy).toBe('');expect((await snapshot()).gems).toBe(70);
 }finally{await peer.leave();}
});
