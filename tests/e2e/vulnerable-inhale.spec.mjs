import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local server only');
test('injury visibly weakens an existing inhale without shortening its reach and blocks a close-contact catch',async({page,baseURL})=>{
 await page.addInitScript(()=>{localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCalm:true})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
 const id=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
 const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(id,{name:'Counter-capture target'});peer.onMessage('*',()=>{});
 const send=(type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
 try{
  peer.send('test:setGems',{count:4});peer.send('test:moveTo',{x:3500,y:3500});peer.send('test:protect',{ms:0});
  await send('test:setGems',{count:1000});await send('test:moveTo',{x:1500,y:1500});await send('test:face',{angle:0});await send('test:protect',{ms:0});
  await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems===1000);
  await page.waitForFunction(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),draw=m.drawnSizes.get(p.sessionId);return draw&&Math.abs(draw.size-p.width)<.01&&Math.abs(draw.speed)<.01;});
  await page.evaluate(()=>{
   const mode=window.game.currentGameMode;mode.facing={x:1,y:0};mode.localFacing=0;mode.localSpin=0;
   window.healthyReach=0;window.weakReach=0;window.weakStrokes=0;
   const arc=CanvasRenderingContext2D.prototype.arc,stroke=CanvasRenderingContext2D.prototype.stroke;
   CanvasRenderingContext2D.prototype.arc=function(x,y,r,...args){this.lastRadius=r;return arc.call(this,x,y,r,...args);};
   CanvasRenderingContext2D.prototype.stroke=function(...args){const color=this.strokeStyle.replace(/\s/g,'');
    if(color.startsWith('rgba(200,240,255,0.16)'))window.healthyReach=Math.max(window.healthyReach,this.lastRadius??0);
    if(color.startsWith('rgba(255,174,148,'))window.weakReach=Math.max(window.weakReach,this.lastRadius??0);
    if(color==='#ffae94')window.weakStrokes++;return stroke.apply(this,args);};
  });
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling);
  await expect.poll(()=>page.evaluate(()=>window.healthyReach)).toBeGreaterThan(100);
  await send('test:injure');await expect.poll(()=>page.evaluate(()=>window.weakStrokes)).toBeGreaterThan(2);
  const reaches=await page.evaluate(()=>({healthy:window.healthyReach,weak:window.weakReach}));expect(reaches.weak).toBeCloseTo(reaches.healthy,0);
  const point=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return{x:p.x+p.width*.8-15+1,y:p.y+p.height/2-15};});
  peer.send('test:moveTo',point);await page.waitForTimeout(250);
  const local=await page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return{gulping:p.gulping,until:p.injuredUntil,time:m.multiplayerManager.room.state.time};});
  expect(local.until).toBeGreaterThan(local.time);expect(local.gulping).toBe('');expect(peer.state.players.get(peer.sessionId).capturedBy).toBe('');
  await page.screenshot({path:test.info().outputPath('weakened-inhale-full-reach.png')});
 }finally{await page.keyboard.up('Space');await peer.leave();}
});
