import { test, expect } from '@playwright/test';
import { Client } from 'colyseus.js';
test.skip(process.env.E2E_TEST_HOOKS !== '1', 'local authoritative fixtures only');
async function start(page){
 await page.addInitScript(()=>{localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCalm:true})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
}
const send=(page,type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
const mine=page=>page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return{x:p.x,y:p.y,active:p.followActive,until:p.followUntil,time:m.multiplayerManager.room.state.time,inhaling:p.inhaling,width:p.width};});
async function button(page,type){await page.evaluate(type=>{
 const c=document.querySelector('canvas.game-canvas'),r=c.getBoundingClientRect();
 const dispatch=t=>{const e=new PointerEvent(t,{pointerId:88,pointerType:'touch',clientX:r.right-75,clientY:r.bottom-90,bubbles:true,cancelable:true});(t==='pointerdown'?c:window).dispatchEvent(e);};
 if(type==='tap'){dispatch('pointerdown');dispatch('pointerup');}else dispatch(type);
},type);}
test('ordinary held inhale has no shot-follow movement or activation state',async({page})=>{
 await start(page);await send(page,'test:moveTo',{x:1800,y:1800});
 await page.waitForFunction(()=>Math.abs(window.game.currentGameMode.multiplayerManager.getLocalPlayer().x-1800)<2);
 const before=await mine(page);await page.keyboard.down('Space');await expect.poll(async()=>(await mine(page)).inhaling).toBe(true);
 await page.waitForTimeout(250);const after=await mine(page);expect(Math.abs(after.x-before.x)).toBeLessThan(2);expect(after.active).toBeUndefined();expect(after.until).toBeUndefined();await page.keyboard.up('Space');
});

test('the existing tap puffs a peer away with matching recoil, preserving suction break and no damage',async({page,baseURL,hasTouch})=>{
 await start(page);const id=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id);
 const peer=await new Client(baseURL.replace(/^http/,'ws')).joinById(id,{name:'Puff peer'});peer.onMessage('*',()=>{});const puffEvents=[];peer.onMessage('exhale',data=>puffEvents.push(data));
 try{
  await send(page,'test:moveTo',{x:1800,y:1800});await send(page,'test:protect',{ms:0});await send(page,'test:face',{angle:0});
  peer.send('test:moveTo',{x:1870,y:1800});peer.send('test:protect',{ms:0});peer.send('test:face',{angle:Math.PI});await expect.poll(()=>peer.state.players.get(peer.sessionId)?.x).toBe(1870);peer.send('inhale');await page.waitForTimeout(100);
  const first=await mine(page);const targetX=peer.state.players.get(peer.sessionId).x;
  if(hasTouch){await button(page,'tap');}else await page.keyboard.press('Space');
  await expect.poll(async()=>(await mine(page)).x).toBeLessThan(first.x-5);
  await expect.poll(()=>peer.state.players.get(peer.sessionId).x).toBeGreaterThan(targetX+5);
  const details=await page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return{gems:p.gems,shield:p.launchSafeUntil-m.multiplayerManager.room.state.time,recoil:m.puffs[0]?.recoil};});
  expect(details.gems).toBe(0);expect(peer.state.players.get(peer.sessionId).inhaling).toBe(false);expect(puffEvents.some(p=>p.recoil>0)).toBe(true);
  await page.screenshot({path:test.info().outputPath('puff-separation-and-recoil.png')});
 }finally{await peer.leave();}
});
