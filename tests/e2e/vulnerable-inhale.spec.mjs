import {test,expect} from '@playwright/test';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local server only');
async function start(page){
 await page.addInitScript(()=>{localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCalm:true})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
}
const send=(page,type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
for(const reduced of [false,true])test(`injured breathing stops, movement survives, shell heals (${reduced?'reduced':'normal'} motion)`,async({page,hasTouch})=>{
 if(reduced)await page.emulateMedia({reducedMotion:'reduce'});await start(page);
 await send(page,'test:setGems',{count:300});await send(page,'test:moveTo',{x:1800,y:1800});await send(page,'test:protect',{ms:0});
 await page.waitForFunction(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return p.gems===300&&!p.spawnProtected;});
 await page.keyboard.down('Space');await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling);
 await send(page,'test:injure');await page.waitForFunction(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return p.breathingBlocked&&!p.inhaling&&m.controls.action==='INJURED';});
 await page.keyboard.up('Space');await page.keyboard.press('Space');await page.waitForTimeout(150);
 expect(await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().inhaling)).toBe(false);
 await page.screenshot({path:test.info().outputPath(reduced?'injury-reduced-motion.png':'injury-glow-cracks.png')});
 const y=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().y);
 if(hasTouch){await page.evaluate(()=>{const c=document.querySelector('canvas.game-canvas'),r=c.getBoundingClientRect(),x=r.left+r.width*.25,y=r.top+r.height*.65;window.__movePoint={x,y};c.dispatchEvent(new PointerEvent('pointerdown',{pointerId:71,pointerType:'touch',clientX:x,clientY:y,bubbles:true}));window.dispatchEvent(new PointerEvent('pointermove',{pointerId:71,pointerType:'touch',clientX:x,clientY:y+100,bubbles:true}));});}
 else await page.keyboard.down('ArrowDown');
 await expect.poll(()=>page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().y)).toBeGreaterThan(y+8);
 if(hasTouch)await page.evaluate(()=>{const{x,y}=window.__movePoint;window.dispatchEvent(new PointerEvent('pointerup',{pointerId:71,pointerType:'touch',clientX:x,clientY:y+100,bubbles:true}));});else await page.keyboard.up('ArrowDown');
 await page.waitForFunction(()=>!window.game.currentGameMode.multiplayerManager.getLocalPlayer().breathingBlocked,{},{timeout:9000});
 await page.screenshot({path:test.info().outputPath('healed-shell.png')});
});
