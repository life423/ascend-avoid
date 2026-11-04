import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local test server only');
const send = (page, type, data) => page.evaluate(({type, data}) => window.game.currentGameMode.multiplayerManager.room.send(type, data), {type, data});
const read = page => page.evaluate(() => {
  const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(), s = m.multiplayerManager.room.state;
  return {gems:p.gems, injury:p.injuredUntil, blocked:p.breathingBlocked, stunned:p.stunned, stamina:m.stamina, time:s.time};
});

test('weak real shots cost gems; concentrated follow-up earns fixed injury, with normal desktop/touch puff before it', async ({page, baseURL, browserName, hasTouch}) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen', 'true'); localStorage.setItem('ascend.mouseFollow', 'off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url:route.request().url().replace('/joinOrCreate/', '/create/'),
    postData:JSON.stringify({...route.request().postDataJSON(), testBots:0, testFieldGems:0, testCores:0, testCalm:true}),
  }));
  await page.goto('/');
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  await send(page, 'test:clearHoles');
  await send(page, 'test:setGems', {count:20000});
  await expect.poll(async () => (await read(page)).gems).toBeGreaterThan(19950);
  const info = await page.evaluate(() => { const m=window.game.currentGameMode.multiplayerManager,p=m.getLocalPlayer();return {room:m.room.id,id:p.sessionId,width:p.width}; });
  await send(page, 'test:moveTo', {x:3250-info.width/2,y:2100-info.width/2});
  await send(page, 'test:protect', {ms:0});
  const builder = await new Client(baseURL.replace(/^http/, 'ws')).joinById(info.room, {name:'Injury builder'});
  builder.onMessage('*', () => {});
  const hits = [];
  builder.onMessage('credit', data => { if (data.targetId === info.id && data.how === 'comet') hits.push(data); });
  const input = await practiceInput(page, browserName, hasTouch);
  try {
    builder.send('test:setGems', {count:1000});
    await expect.poll(() => builder.state.players.get(builder.sessionId)?.gems).toBeGreaterThan(995);
    let width = builder.state.players.get(builder.sessionId).width;
    builder.send('test:moveTo', {x:1000-width/2,y:2100-width/2});
    builder.send('test:pinwheel', {kind:'comet',x:1000,y:2100});
    await expect.poll(() => builder.state.pinwheel.phase).toBe('carried');
    width = builder.state.players.get(builder.sessionId).width;
    // Normal placement puts the muzzle at (2100,2100). No injected damage or bolts.
    builder.send('test:moveTo', {x:2100-width-72,y:2100-width/2});
    builder.send('test:face', {angle:0}); builder.send('placeWeapon');
    await expect.poll(() => builder.state.pinwheel.phase).toBe('charging');
    await expect.poll(() => hits.length, {timeout:10000,intervals:[25]}).toBe(1);
    await expect.poll(async () => (await read(page)).gems, {intervals:[25]}).toBeLessThan(19900);
    const first = await read(page);
    expect(hits[0].gems).toBeGreaterThan(415); expect(hits[0].glancing).toBe(false);
    expect(first.injury).toBe(0); expect(first.blocked).toBe(false); expect(first.stunned).toBe(false);
    await input.tap();
    await expect.poll(async () => (await read(page)).stamina, {intervals:[25]}).toBeLessThan(.4);
    await page.screenshot({path:test.info().outputPath('weak-hit-normal-puff.png'),scale:'css'});
    await expect.poll(async () => (await read(page)).injury, {timeout:5000,intervals:[25]}).toBeGreaterThan(0);
    const earned = await read(page);
    expect(hits.length).toBe(2); expect(hits[1].glancing).toBe(false);
    expect(earned.blocked).toBe(true); expect(earned.stunned).toBe(false);
    expect(earned.injury-earned.time).toBeGreaterThan(6500); expect(earned.injury-earned.time).toBeLessThanOrEqual(7000);
    const credited = hits.reduce((total, hit) => total + hit.gems, 0);
    await expect.poll(() => builder.state.players.get(builder.sessionId).weaponDamage).toBe(credited);
    expect(builder.state.players.get(builder.sessionId).gems).toBeGreaterThan(1000+credited-15);
    await page.screenshot({path:test.info().outputPath('earned-burst-injury.png'),scale:'css'});
    await expect.poll(() => hits.length, {timeout:5000,intervals:[25]}).toBeGreaterThan(2);
    expect((await read(page)).injury).toBe(earned.injury);
    expect(errors).toEqual([]);
  } finally { await input.close(); await builder.leave(); }
});
