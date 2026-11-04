import {test,expect} from '@playwright/test';
import {practiceInput} from './helpers/practice.mjs';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local server only');
test('the new maximum can walk above a live black hole with full body clearance',async({page,browserName,hasTouch})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',r=>r.continue({url:r.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...r.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
 const send=(type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
 await send('test:setGems',{count:1e9});await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().width===1470);
 await send('test:moveTo',{x:8,y:8});await send('test:protect',{ms:0});
 await page.waitForFunction(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return Math.hypot(p.x-8,p.y-8)<2&&Math.hypot(m.predicted.x-p.x,m.predicted.y-p.y)<4;});
 const input=await practiceInput(page,browserName,hasTouch);
 const read=()=>page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),s=m.multiplayerManager.getState();return {x:p.x,y:p.y,width:p.width,state:p.state,holes:s.blackHoles.toJSON()};});
 try{
  const start=await read();expect(start.holes).toHaveLength(3);expect(start.holes[0].y).toBe(1680);
  await input.move(1,0);
  for(let i=0;i<20;i++){
   await page.waitForTimeout(200);const p=await read();expect(p.state).toBe('alive');expect(p.width).toBe(1470);
   for(const h of p.holes)expect(Math.hypot(p.x+p.width/2-h.x,p.y+p.width/2-h.y)).toBeGreaterThanOrEqual(h.radius+p.width/2+8-.1);
  }
  await input.stop();const end=await read();expect(end.x-start.x).toBeGreaterThan(350);expect(Math.abs(end.y-start.y)).toBeLessThan(2);
  await page.screenshot({path:test.info().outputPath('maximum-above-black-hole.png'),scale:'css'});expect(errors).toEqual([]);
 }finally{await input.close();}
});
