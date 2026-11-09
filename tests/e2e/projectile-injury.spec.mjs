import { test, expect } from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import { Client } from 'colyseus.js';
import { practiceInput } from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS !== '1', 'isolated local projectile encounter');
const send = (page, type, data) => page.evaluate(({type, data}) => window.game.currentGameMode.multiplayerManager.room.send(type, data), {type, data});
const read = page => page.evaluate(() => {
  const m = window.game.currentGameMode, p = m.multiplayerManager.getLocalPlayer(), s = m.multiplayerManager.room.state;
  return {id:p.sessionId,gems:p.gems,width:p.width,injury:p.injuredUntil,blocked:p.breathingBlocked,stunned:p.stunned,
    inhaling:p.inhaling,state:p.state,time:s.time,stamina:m.stamina,sliding:p.sliding,recovering:p.recovering,
    capturedBy:p.capturedBy,gulping:p.gulping,flying:p.flying};
});
async function start(page) {
  await page.addInitScript(() => { localStorage.setItem('ascend.guideSeen','true'); localStorage.setItem('ascend.mouseFollow','off'); });
  await page.route('**/matchmake/joinOrCreate/game_room', route => route.continue({
    url:route.request().url().replace('/joinOrCreate/','/create/'),
    postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'}),
  }));
  await enterGame(page);
  await page.waitForFunction(() => window.game?.currentGameMode?.lastView && !document.body.classList.contains('intro-playing'));
  await send(page,'test:clearHoles');
  await page.evaluate(() => {
    window.projectileImpacts = []; window.projectilePuffs = []; window.projectilePostImpactStun = false;
    const r = window.game.currentGameMode.multiplayerManager.room;
    r.onMessage('impact', event => { if(event.targetId === r.sessionId) window.projectileImpacts.push({...event,time:r.state.time}); });
    r.onMessage('exhale', event => { if(event.id === r.sessionId) window.projectilePuffs.push(event); });
    // Impact messages precede their state patch. Latch the real post-hit stun,
    // so a pre-hit stunned=false cannot be mistaken for completed recovery.
    r.onStateChange(state => {
      if(window.projectileImpacts.length && state.players.get(r.sessionId)?.stunned) window.projectilePostImpactStun = true;
    });
  });
  return page.evaluate(() => { const r=window.game.currentGameMode.multiplayerManager.room;return {room:r.id,id:r.sessionId}; });
}
async function positionTarget(page, gems) {
  await send(page,'test:setGems',{count:gems});
  await expect.poll(async () => (await read(page)).gems).toBeGreaterThan(gems * .995);
  const p = await read(page);
  await send(page,'test:moveTo',{x:2100-p.width/2,y:2100-p.width/2});
  await send(page,'test:protect',{ms:0});
}
async function fireCaptured(shooter, ammo, gems) {
  shooter.send('test:setGems',{count:gems}); ammo.send('test:setGems',{count:12});
  await expect.poll(() => shooter.state.players.get(shooter.sessionId)?.gems).toBe(gems);
  await expect.poll(() => ammo.state.players.get(ammo.sessionId)?.width).toBe(40);
  const w=shooter.state.players.get(shooter.sessionId).width;
  shooter.send('test:moveTo',{x:950-w/2,y:2100-w/2}); shooter.send('test:face',{angle:0});
  ammo.send('test:moveTo',{x:950+w*.3+1-20,y:2080});
  shooter.send('test:protect',{ms:0}); ammo.send('test:protect',{ms:0});
  shooter.send('inhale');
  await expect.poll(() => shooter.state.players.get(shooter.sessionId)?.gulping).toBe(ammo.sessionId);
  expect(ammo.state.players.get(ammo.sessionId).flying).toBe(false);
  shooter.send('exhale'); shooter.send('tap');
}

for(const kind of ['player','fan']) test(`a weak ${kind} projectile chips a giant without injury; ordinary desktop/touch breathing and puff recover`, async ({page,baseURL,browserName,hasTouch},info) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const meta=await start(page); await positionTarget(page,100000);
  const client=new Client(baseURL.replace(/^http/,'ws')), pilot=await client.joinById(meta.room,{name:'Small pilot'});
  pilot.onMessage('*',()=>{});
  let shooter; const input=await practiceInput(page,browserName,hasTouch);
  try {
    if(kind==='player') {
      shooter=await client.joinById(meta.room,{name:'Small shooter'}); shooter.onMessage('*',()=>{});
      await fireCaptured(shooter,pilot,60); // width80, actual legal capture, standard60 shell
    } else {
      pilot.send('test:setGems',{count:12}); await expect.poll(()=>pilot.state.players.get(pilot.sessionId)?.width).toBe(40);
      await send(page,'test:placeTurbine',{x:3200,y:2100,intake:0,still:true});
      pilot.send('test:protect',{ms:0}); pilot.send('test:moveTo',{x:3264,y:2080});
    }
    await expect.poll(()=>page.evaluate(()=>window.projectileImpacts.length),{timeout:7000,intervals:[25]}).toBe(1);
    const hit=await page.evaluate(()=>window.projectileImpacts[0]);
    expect(hit.gems).toBeGreaterThan(0); expect(hit.gems).toBeLessThan(200); expect(hit.out).toBe(false);
    await expect.poll(()=>page.evaluate(()=>window.projectilePostImpactStun),{timeout:1500,intervals:[25],message:'the authoritative post-impact patch arrives'}).toBe(true);
    const chipped=await read(page); expect(chipped.injury).toBe(0); expect(chipped.blocked).toBe(false); expect(chipped.state).toBe('alive');
    expect(chipped.time-hit.time).toBeLessThan(1500); // prove no injury, rather than merely waiting seven seconds
    await expect.poll(async()=>{
      const p=await read(page);
      return {state:p.state,stunned:p.stunned,sliding:p.sliding,recovering:p.recovering,flying:p.flying,capturedBy:p.capturedBy,gulping:p.gulping,blocked:p.blocked};
    },{timeout:1500,intervals:[25],message:'ordinary short impact recovery completes before a fresh action'}).toEqual({state:'alive',stunned:false,sliding:false,recovering:false,flying:false,capturedBy:'',gulping:'',blocked:false});
    expect((await read(page)).time-hit.time).toBeLessThan(1500);
    await page.screenshot({path:info.outputPath(`weak-${kind}-healthy-shell.png`),scale:'css'});
    await input.hold(); await expect.poll(async()=>(await read(page)).inhaling).toBe(true); await input.releaseAction();
    await expect.poll(async()=>(await read(page)).inhaling).toBe(false);
    await expect.poll(async()=>(await read(page)).stamina).toBeGreaterThan(.99);
    await input.tap(); await expect.poll(()=>page.evaluate(()=>window.projectilePuffs.length)).toBe(1);
    expect((await read(page)).injury).toBe(0); expect(errors).toEqual([]);
  } finally { await input.close(); await pilot.leave(); if(shooter)await shooter.leave(); }
});

test('a meaningful peer shot opens the same seven-second shell and breathing block, then restores ordinary controls', async ({page,baseURL,browserName,hasTouch},info) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const meta=await start(page);await positionTarget(page,414); // width200
  const client=new Client(baseURL.replace(/^http/,'ws')),shooter=await client.joinById(meta.room,{name:'Peer shooter'}),ammo=await client.joinById(meta.room,{name:'Peer ammo'});
  shooter.onMessage('*',()=>{});ammo.onMessage('*',()=>{});
  const input=await practiceInput(page,browserName,hasTouch);
  try {
    await fireCaptured(shooter,ammo,414);
    await expect.poll(()=>page.evaluate(()=>window.projectileImpacts.length),{timeout:7000}).toBe(1);
    await expect.poll(async()=>(await read(page)).blocked).toBe(true);
    const wounded=await read(page),hit=await page.evaluate(()=>window.projectileImpacts[0]);
    expect(wounded.injury-hit.time).toBeGreaterThan(6750);expect(wounded.injury-hit.time).toBeLessThanOrEqual(7100);
    // Isolate the injury block from the unchanged brief stun/skid. The hold must
    // also exceed the control's 180ms tap window to test breathing, not a puff.
    await expect.poll(async()=>{
      const p=await read(page);
      return {stunned:p.stunned,sliding:p.sliding,recovering:p.recovering,blocked:p.blocked};
    },{timeout:1500,intervals:[25],message:'the brief impact response ends while injury remains active'}).toEqual({stunned:false,sliding:false,recovering:false,blocked:true});
    await input.hold();await page.waitForTimeout(250);
    expect((await read(page)).blocked).toBe(true);expect((await read(page)).inhaling).toBe(false);await input.releaseAction();
    await page.screenshot({path:info.outputPath('meaningful-peer-injury.png'),scale:'css'});
    await page.waitForFunction(()=>!window.game.currentGameMode.multiplayerManager.getLocalPlayer().breathingBlocked,{}, {timeout:8500});
    const recovered=await read(page);expect(recovered.injury).toBe(wounded.injury);expect(recovered.time).toBeGreaterThanOrEqual(wounded.injury);
    await input.hold();await expect.poll(async()=>(await read(page)).inhaling).toBe(true);await input.releaseAction();
    expect(errors).toEqual([]);
  } finally {await input.close();await ammo.leave();await shooter.leave();}
});
