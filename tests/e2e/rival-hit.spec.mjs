import { test,expect } from '@playwright/test';
import { Client } from 'colyseus.js';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local game fixture');

for(const [width,gems]of[[200,414],[500,3125]])test(`equal-width ${width} shot visibly shrinks the defender once, with a standard bullet`,async({page},info)=>{
  expect(new URL(process.env.E2E_URL).hostname).toMatch(/^(127\.0\.0\.1|localhost)$/);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{localStorage.setItem('ascend.mouseFollow','off');localStorage.setItem('ascend.guideSeen','true');});
  await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCalm:true})}));
  await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
  const meta=await page.evaluate(()=>{const r=window.game.currentGameMode.multiplayerManager.getRoom();return{id:r.id,me:r.sessionId};});
  const client=new Client(process.env.E2E_URL.replace(/^http/,'ws')),shooter=await client.joinById(meta.id,{name:'Rival'}),ammo=await client.joinById(meta.id,{name:'Ammo'});
  shooter.onMessage('*',()=>{});ammo.onMessage('*',()=>{});
  const send=(type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.getRoom().send(type,data),{type,data});
  const victim=()=>page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return{gems:p.gems,width:p.width,injured:p.breathingBlocked,state:p.state};});
  try{
    await expect.poll(()=>shooter.state.players.size).toBe(3);
    await send('test:setGems',{count:gems});shooter.send('test:setGems',{count:gems});ammo.send('test:setGems',{count:12});
    await expect.poll(async()=>(await victim()).width).toBe(width);await expect.poll(()=>shooter.state.players.get(shooter.sessionId).width).toBe(width);
    await expect.poll(()=>ammo.state.players.get(ammo.sessionId).width).toBe(40);
    shooter.send('test:moveTo',{x:800,y:2000-width/2});shooter.send('test:face',{angle:0});
    ammo.send('test:moveTo',{x:800+width*.8+1-20,y:1980});ammo.send('test:protect',{ms:0});
    await send('test:moveTo',{x:800+width+350,y:2000-width/2});await send('test:protect',{ms:0});
    await page.evaluate(()=>{window.rivalImpacts=[];window.game.currentGameMode.multiplayerManager.getRoom().onMessage('impact',d=>window.rivalImpacts.push(d));});
    shooter.send('inhale');await expect.poll(()=>shooter.state.players.get(shooter.sessionId).gulping).toBe(ammo.sessionId);
    shooter.send('exhale');shooter.send('aim',{x:1,y:0});await page.waitForTimeout(100);shooter.send('tap');
    await expect.poll(()=>ammo.state.players.get(ammo.sessionId)?.flying).toBe(true);
    expect(ammo.state.players.get(ammo.sessionId).width).toBe(60);
    await expect.poll(()=>page.evaluate(id=>window.rivalImpacts.filter(e=>e.targetId===id).length,meta.me)).toBe(1);
    const hit=await page.evaluate(id=>window.rivalImpacts.find(e=>e.targetId===id),meta.me),damage=hit.gems;
    // The existing shared upkeep runs during room setup/flight; the event records actual loss.
    expect(damage/gems).toBeCloseTo(.25,2);
    await expect.poll(async()=>(await victim()).width).toBeLessThan(width*.9);
    const after=await victim();expect(after.width).toBeLessThan(width*.9);expect(after.injured).toBe(true);expect(after.state).toBe('alive');
    // Spent ammunition can legitimately contribute a few foreign gems, and upkeep still runs.
    // Check the actual hit/owner-spill conservation before screenshot capture can outlast its lock.
    await page.waitForTimeout(500);
    const spill=await page.evaluate(id=>[...window.game.currentGameMode.multiplayerManager.getState().gems.values()].filter(g=>g.owner===id&&g.locked).reduce((n,g)=>n+g.value,0),meta.me);
    expect(spill).toBe(damage);
    const hits=await page.evaluate(id=>window.rivalImpacts.filter(e=>e.targetId===id),meta.me);expect(hits).toHaveLength(1);expect(hits[0].gems).toBe(damage);
    await page.screenshot({path:info.outputPath(`rival-${width}-first-hit.png`),scale:'css'});
    expect(errors).toEqual([]);
  }finally{await shooter.leave();await ammo.leave();}
});
