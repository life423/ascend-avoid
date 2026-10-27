import {test,expect} from '@playwright/test';
import {Client} from 'colyseus.js';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated authoritative fixtures only');
const send=(page,type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
const weapon=page=>page.evaluate(()=>{const r=window.game.currentGameMode.multiplayerManager.room,w=r.state.pinwheel;return {id:r.sessionId,owner:w.owner,phase:w.phase,progress:w.progress,parts:[...w.parts].map(p=>({x:p.x,y:p.y,carriedBy:p.carriedBy,theftBy:p.theftBy,theftMs:p.theftMs})),x:w.x,y:w.y};});
async function start(page){
 await page.addInitScript(()=>{localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCalm:true})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
}
async function hold(page,hasTouch,down){
 if(!hasTouch)return down?page.keyboard.down('Space'):page.keyboard.up('Space');
 await page.evaluate(down=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect();(down?c:window).dispatchEvent(new PointerEvent(down?'pointerdown':'pointerup',{pointerId:88,pointerType:'touch',clientX:r.right-75,clientY:r.bottom-90,bubbles:true,cancelable:true}));},down);
}
async function carrier(page,baseURL,kind){
 await start(page);await send(page,'test:pinwheel',{kind,x:2100,y:2100});await send(page,'test:setGems',{count:40});await send(page,'test:protect',{ms:0});
 const roomId=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
 const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(roomId,{name:'Healthy collector'});peer.onMessage('*',()=>{});
 await expect.poll(()=>peer.state.players?.get(peer.sessionId)?.width).toBeGreaterThan(0);
 peer.send('test:setGems',{count:40});await expect.poll(()=>peer.state.players.get(peer.sessionId).gems).toBe(40);
 const p=peer.state.players.get(peer.sessionId);await expect.poll(async()=>(await weapon(page)).parts.length).toBe(3);
 const part=(await weapon(page)).parts[0];peer.send('test:moveTo',{x:part.x-p.width/2,y:part.y-p.width/2});peer.send('test:face',{angle:0});peer.send('test:protect',{ms:0});
 await expect.poll(async()=>(await weapon(page)).owner).toBe(peer.sessionId);
 await page.waitForTimeout(100);
 await page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),part=m.multiplayerManager.room.state.pinwheel.parts[0];m.multiplayerManager.room.send('test:moveTo',{x:part.x-100-p.width/2,y:part.y-p.width/2});m.multiplayerManager.room.send('test:face',{angle:0});m.facing={x:1,y:0};m.localFacing=0;m.localSpin=0;});
 await page.waitForTimeout(100);return peer;
}
test('healthy cargo theft shows a truthful amber progress arc and release resets it on keyboard/touch',async({page,baseURL,hasTouch})=>{
 const peer=await carrier(page,baseURL,'sentinel');
 try{
  await page.evaluate(()=>{window.theftArcs=0;const arc=CanvasRenderingContext2D.prototype.arc;CanvasRenderingContext2D.prototype.arc=function(x,y,r,a,b,...args){if(r===41&&a===-Math.PI/2&&b>a)window.theftArcs++;return arc.call(this,x,y,r,a,b,...args);};});
  await hold(page,hasTouch,true);
  await expect.poll(async()=>(await weapon(page)).parts[0].theftMs,{intervals:[20]}).toBeGreaterThan(80);
  expect((await weapon(page)).owner).toBe(peer.sessionId);
  await expect.poll(()=>page.evaluate(()=>window.theftArcs),{intervals:[20]}).toBeGreaterThan(0);
  await page.screenshot({path:test.info().outputPath('cargo-theft-amber-progress.png')});
  await hold(page,hasTouch,false);
  await expect.poll(async()=>(await weapon(page)).parts[0].theftMs,{intervals:[20]}).toBe(0);
  expect((await weapon(page)).owner).toBe(peer.sessionId);
  await page.waitForTimeout(250);expect((await weapon(page)).owner).toBe(peer.sessionId);
  await hold(page,hasTouch,true);await expect.poll(async()=>(await weapon(page)).owner).toBe((await weapon(page)).id);
  expect(peer.state.players.get(peer.sessionId).gems).toBe(40);expect(peer.state.players.get(peer.sessionId).injuredUntil).toBe(0);
 }finally{await hold(page,hasTouch,false);await peer.leave();}
});
for(const kind of ['pinwheel','pulsar','sentinel','ricochet','ion','comet'])test(`${kind}: stolen set guides its new owner, assembles and deploys while moving`,async({page,baseURL,hasTouch})=>{
 const peer=await carrier(page,baseURL,kind);
 try{
  await hold(page,hasTouch,true);await expect.poll(async()=>(await weapon(page)).owner).toBe((await weapon(page)).id);await hold(page,hasTouch,false);
  expect((await weapon(page)).progress&1).toBe(1);
  peer.send('test:moveTo',{x:500,y:500});
  for(const index of [1,2]){const current=await weapon(page);if(current.phase==='carried')break;const part=current.parts[index];if(part.carriedBy===current.id)continue;await page.evaluate(part=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();m.multiplayerManager.room.send('test:moveTo',{x:part.x-p.width/2,y:part.y-p.width/2});},part);await expect.poll(async()=>{const w=await weapon(page);return w.phase==='carried'||w.parts[index].carriedBy===w.id;}).toBe(true);}
  await expect(page.getByRole('button',{name:'Place weapon',exact:true})).toBeVisible();
  const y=()=>page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().y),before=await y();
  if(hasTouch)await page.evaluate(()=>{const c=document.querySelector('canvas'),r=c.getBoundingClientRect(),x=r.left+r.width*.2,y=r.top+r.height*.75;c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:41,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));window.dispatchEvent(new PointerEvent('pointermove',{pointerId:41,pointerType:'touch',clientX:x,clientY:y+60,bubbles:true}));});else await page.keyboard.down('ArrowDown');
  await expect.poll(y).toBeGreaterThan(before+15);const at=await y();
  if(hasTouch){await page.getByRole('button',{name:'Place weapon',exact:true}).dispatchEvent('pointerdown',{pointerId:42,pointerType:'touch',bubbles:true,cancelable:true});await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:42,pointerType:'touch',bubbles:true})));}else await page.keyboard.press('e');
  await expect.poll(async()=>(await weapon(page)).phase).toBe('charging');await expect.poll(y).toBeGreaterThan(at+15);
  if(hasTouch)await page.evaluate(()=>window.dispatchEvent(new PointerEvent('pointerup',{pointerId:41,pointerType:'touch',bubbles:true})));else await page.keyboard.up('ArrowDown');
  await expect.poll(async()=>(await weapon(page)).phase).toBe('active');expect((await weapon(page)).owner).toBe((await weapon(page)).id);
  expect(peer.state.players.get(peer.sessionId).gems).toBe(40);
 }finally{await hold(page,hasTouch,false);await page.keyboard.up('ArrowDown');await peer.leave();}
});
