import {test,expect} from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import {writeFileSync} from 'node:fs';
import {creatureSize} from '../../server/dist/game/creatureSize.js';
import {arenaContains} from '../../server/dist/game/arenaBoundary.js';
import {INHALE} from '../../server/dist/constants/gameConstants.js';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local AI scenarios only');
function stock(width){let lo=0,hi=1e8;while(lo<hi){const m=Math.floor((lo+hi)/2);if(creatureSize(m)<width)lo=m+1;else hi=m;}return lo;}
for(const width of [300,600])test(`a real bot avoids an idle ${width}-wide giant beyond the former flee distance`,async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',r=>r.continue({url:r.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...r.request().postDataJSON(),testBots:2,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'})}));
 await enterGame(page);await page.waitForFunction(()=>{const m=window.game?.currentGameMode;return m?.lastView&&!m.introPlaying&&[...m.multiplayerManager.getState().players.values()].some(p=>p.isBot);});
 const send=(type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
 await send('test:clearHoles');await send('test:setGems',{count:stock(width)});
 await page.waitForFunction(w=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().width>=w,width);
 const read=()=>page.evaluate(()=>{const m=window.game.currentGameMode,me=m.multiplayerManager.getLocalPlayer(),b=[...m.multiplayerManager.getState().players.values()].find(p=>p.isBot);const copy=p=>({id:p.sessionId,x:p.x,y:p.y,width:p.width,height:p.height,facing:p.facing,inhaling:p.inhaling,captured:p.capturedBy,stunned:p.stunned,state:p.state});return{me:copy(me),bot:copy(b)};});
 const start=await read(),bx=start.bot.x+start.bot.width/2,by=start.bot.y+start.bot.height/2,reach=INHALE.REACH+start.me.width*INHALE.REACH_PER_SIZE,d=start.me.width*.3+reach*.85+start.bot.width/2;
 const options=[[1,0],[-1,0],[0,1],[0,-1]].map(([fx,fy])=>({fx,fy,x:bx-fx*d-start.me.width/2,y:by-fy*d-start.me.height/2,width:start.me.width,height:start.me.height}));
 const setup=options.find(p=>arenaContains(p,4200,4200));expect(setup).toBeTruthy();
 await send('test:moveTo',{x:setup.x,y:setup.y});await send('test:face',{angle:Math.atan2(setup.fy,setup.fx)});await send('test:protect',{ms:0});
 await page.waitForFunction(({x,y})=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return Math.hypot(p.x-x,p.y-y)<2;},setup);
 const initial=await read(),origin={x:initial.bot.x+initial.bot.width/2,y:initial.bot.y+initial.bot.height/2},samples=[];
 const initialBodyGap=Math.hypot(origin.x-initial.me.x-initial.me.width/2,origin.y-initial.me.y-initial.me.height/2)-initial.me.width/2;
 expect(initialBodyGap).toBeGreaterThan(420);
 const deadline=Date.now()+1800;let maxOutward=0;
 while(Date.now()<deadline){await page.waitForTimeout(75);const r=await read();expect(arenaContains(r.bot,4200,4200)).toBe(true);expect(r.me.inhaling).toBe(false);expect(r.bot.captured).toBe('');expect(r.bot.stunned).toBe(false);const outward=(r.bot.x+r.bot.width/2-origin.x)*setup.fx+(r.bot.y+r.bot.height/2-origin.y)*setup.fy;maxOutward=Math.max(maxOutward,outward);samples.push({...r,outward});}
 writeFileSync(info.outputPath('bot-avoidance.json'),JSON.stringify({width,setup,initialBodyGap,maxOutward,samples},null,2));
 await page.screenshot({path:info.outputPath('bot-keeps-clear.png'),scale:'css'});
 expect(maxOutward).toBeGreaterThan(60);expect(errors).toEqual([]);
});
