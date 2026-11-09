import {test,expect} from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import {practiceInput} from './helpers/practice.mjs';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local server only');
async function start(page){
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',r=>r.continue({url:r.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...r.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'})}));
 await enterGame(page);await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
 await send(page,'test:clearHoles');
}
const send=(page,type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
const read=page=>page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),v=m.lastView;return {v,p:{x:m.predicted?.x??p.x,y:m.predicted?.y??p.y,size:p.width,state:p.state},w:m.multiplayerManager.room.state.worldWidth,h:m.multiplayerManager.room.state.worldHeight};});
function check(s){
 const {v,p,w,h}=s,r=700;
 for(const x of [v.x-v.width/2,v.x+v.width/2])for(const y of [v.y-v.height/2,v.y+v.height/2]){
  expect(x).toBeGreaterThanOrEqual(-.01);expect(y).toBeGreaterThanOrEqual(-.01);expect(x).toBeLessThanOrEqual(w+.01);expect(y).toBeLessThanOrEqual(h+.01);
  if((x<r||x>w-r)&&(y<r||y>h-r))expect(Math.hypot(x-(x<r?r:w-r),y-(y<r?r:h-r))).toBeLessThanOrEqual(r+.01);
 }
 if(p.state==='alive')for(const d of [p.x+p.size/2-v.x+v.width/2,v.x+v.width/2-p.x-p.size/2,p.y+p.size/2-v.y+v.height/2,v.y+v.height/2-p.y-p.size/2])expect(d).toBeGreaterThanOrEqual(p.size*.1-.1);
}
for(const [label,gems]of [['small',0],['large',1000],['giant',1e9]])test(`${label}: all rounded corners keep the viewport inside and the player visible while moving`,async({page,browserName,hasTouch})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await start(page);await send(page,'test:setGems',{count:gems});
 await page.waitForFunction(label=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return label==='giant'?p.width>1200:label==='large'?p.width>290:p.width===20;},label);
 const size=(await read(page)).p.size,input=await practiceInput(page,browserName,hasTouch);
 try{
  for(const sx of [-1,1])for(const sy of [-1,1])for(const deg of [15,45,75]){
   const a=deg*Math.PI/180,inset=Math.max(700,size/2+8),inner=Math.max(0,700-size/2-8),x=(sx<0?inset:4200-inset)+sx*inner*Math.cos(a)-size/2,y=(sy<0?inset:4200-inset)+sy*inner*Math.sin(a)-size/2;
   await send(page,'test:moveTo',{x,y});
   await page.waitForFunction(({x,y})=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return Math.hypot(p.x-x,p.y-y)<18&&Math.hypot(m.predicted.x-p.x,m.predicted.y-p.y)<10;},{x,y});
   await page.waitForTimeout(35);check(await read(page));
   if(deg===45){
    await page.screenshot({path:test.info().outputPath(`${label}-${sx}-${sy}.png`),scale:'css'});
    await input.move(-sy/Math.SQRT2,sx/Math.SQRT2);
    for(let i=0;i<3;i++){await page.waitForTimeout(80);check(await read(page));}
    await input.stop();await page.waitForTimeout(150);
   }
  }
  if(hasTouch){const {width,height}=page.viewportSize();await page.setViewportSize({width:height,height:width});await page.waitForTimeout(150);check(await read(page));await page.screenshot({path:test.info().outputPath(`${label}-rotated.png`),scale:'css'});}
  expect(errors).toEqual([]);
 }finally{await input.close();}
});

test('growth, knockout hold and respawn retain curved framing',async({page})=>{
 await start(page);await send(page,'test:moveTo',{x:205,y:205});await page.waitForTimeout(150);
 await send(page,'test:setGems',{count:1e9});
 for(let i=0;i<10;i++){await page.waitForTimeout(80);check(await read(page));}
 await send(page,'test:setGems',{count:0});await page.waitForTimeout(100);check(await read(page));
 await send(page,'test:protect',{ms:0});await send(page,'test:hit');
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().state==='dead');check(await read(page));
 await page.waitForFunction(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().state==='alive');check(await read(page));
});
