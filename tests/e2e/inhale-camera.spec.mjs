import {test,expect} from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import {practiceInput} from './helpers/practice.mjs';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local server only');
const send=(page,type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
const read=page=>page.evaluate(()=>{
 const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),v=m.lastView;
 return {v:{...v},p:{x:m.predicted.x+p.width/2,y:m.predicted.y+p.height/2,width:p.width,facing:m.localFacing,inhaling:p.inhaling,state:p.state},short:m.cameraRig.short};
});
function check(s){
 const {v,p}=s;
 for(const x of[v.x-v.width/2,v.x+v.width/2])for(const y of[v.y-v.height/2,v.y+v.height/2]){
  expect(x).toBeGreaterThanOrEqual(-.01);expect(y).toBeGreaterThanOrEqual(-.01);expect(x).toBeLessThanOrEqual(4200+.01);expect(y).toBeLessThanOrEqual(4200+.01);
 }
 for(const d of[p.x-v.x+v.width/2,v.x+v.width/2-p.x,p.y-v.y+v.height/2,v.y+v.height/2-p.y])expect(d).toBeGreaterThanOrEqual(p.width*.1-.1);
}
function forward(s){
 const {v,p}=s,fx=Math.cos(p.facing),fy=Math.sin(p.facing);
 const x=fx>1e-6?(v.x+v.width/2-p.x)/fx:fx< -1e-6?(v.x-v.width/2-p.x)/fx:Infinity;
 const y=fy>1e-6?(v.y+v.height/2-p.y)/fy:fy< -1e-6?(v.y-v.height/2-p.y)/fy:Infinity;
 return Math.min(x,y)-p.width*.3;
}
async function start(page){
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',r=>r.continue({url:r.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...r.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'})}));
 await enterGame(page);await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
 await send(page,'test:clearHoles');await send(page,'test:setGems',{count:1e9});
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().width===1470);
 await send(page,'test:protect',{ms:0});await send(page,'test:moveTo',{x:1365,y:1365});
 await expect.poll(async()=>(await read(page)).short).toBeGreaterThan(4100);
}
async function place(page,x,y){
 await send(page,'test:moveTo',{x:x-735,y:y-735});
 // Ordinary release inertia can move a few units after the setup placement.
 await page.waitForFunction(({x,y})=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return Math.hypot(p.x+p.width/2-x,p.y+p.width/2-y)<18&&Math.hypot(m.predicted.x-p.x,m.predicted.y-p.y)<5;},{x,y},{timeout:10000});
 await page.waitForTimeout(150);
}

test('giant inhale gains forward view with identical zoom, then returns; touch rotation retains controls',async({page,browserName,hasTouch})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);
 const input=await practiceInput(page,browserName,hasTouch);
 try{
  for(let orientation=0;orientation<(hasTouch?2:1);orientation++){
   if(orientation){const{width,height}=page.viewportSize();await page.setViewportSize({width:height,height:width});}
   const landscape=page.viewportSize().width>page.viewportSize().height;
   await input.move(landscape?0:1,landscape?1:0);await page.waitForTimeout(2400);await input.stop();
   await place(page,2100,2100);await page.waitForTimeout(300);
   const before=await read(page);check(before);
   expect(Math.abs(before.p.facing-(landscape?Math.PI/2:0))).toBeLessThan(.03);
   await page.screenshot({path:test.info().outputPath(`inhale-before-${orientation}.png`),scale:'css'});
   await input.hold();await expect.poll(async()=>(await read(page)).p.inhaling).toBe(true);
   let active=before;
   for(let i=0;i<12;i++){
    await page.waitForTimeout(100);active=await read(page);check(active);
    expect(Math.abs(active.v.scale-before.v.scale)).toBeLessThan(1e-6);
    expect(Math.abs(active.v.width-before.v.width)).toBeLessThan(.01);expect(Math.abs(active.v.height-before.v.height)).toBeLessThan(.01);
    expect(Math.hypot(active.v.x-before.v.x,active.v.y-before.v.y)).toBeLessThanOrEqual(Math.min(before.v.width,before.v.height)*.3+1);
   }
   expect(forward(active)-forward(before)).toBeGreaterThan(100);
   await page.screenshot({path:test.info().outputPath(`inhale-forward-${orientation}.png`),scale:'css'});
   if(hasTouch && orientation===0){
    const {width,height}=page.viewportSize();
    await page.setViewportSize({width:height,height:width});
    for(let i=0;i<3;i++){await page.waitForTimeout(100);check(await read(page));}
    await page.setViewportSize({width,height});
    for(let i=0;i<3;i++){await page.waitForTimeout(100);check(await read(page));}
   }
   await input.releaseAction();await expect.poll(async()=>(await read(page)).p.inhaling).toBe(false);
   await page.waitForTimeout(2400);const after=await read(page);check(after);
   expect(Math.hypot(after.v.x-before.v.x,after.v.y-before.v.y)).toBeLessThan(2);
   expect(Math.abs(after.v.scale-before.v.scale)).toBeLessThan(1e-6);
  }
  expect(errors).toEqual([]);
 }finally{await input.close();}
});

for(const sx of[-1,1])for(const sy of[-1,1])test(`giant ${sx},${sy} corner: held inhale and release preserve body and arena bounds`,async({page,browserName,hasTouch})=>{
 await start(page);const input=await practiceInput(page,browserName,hasTouch);
 try{
  await place(page,sx<0?743:3457,sy<0?743:3457);
  // Aim outward using normal movement into the wall, not a forced client camera state.
  await input.move(sx/Math.SQRT2,sy/Math.SQRT2);await page.waitForTimeout(2400);await input.stop();
  await place(page,sx<0?743:3457,sy<0?743:3457);
  const before=await read(page);check(before);await input.hold();
  await expect.poll(async()=>(await read(page)).p.inhaling).toBe(true);
  // Upkeep and the size spring can still move the fitted corner scale by a subpixel amount.
  for(let i=0;i<8;i++){await page.waitForTimeout(100);const s=await read(page);check(s);expect(Math.abs(s.v.scale/before.v.scale-1)).toBeLessThan(.001);}
  await page.screenshot({path:test.info().outputPath('giant-inhale-corner.png'),scale:'css'});
  await input.releaseAction();await page.waitForTimeout(800);check(await read(page));
 }finally{await input.close();}
});
