import {test,expect} from '@playwright/test';
import {Client} from 'colyseus.js';
import {writeFileSync} from 'node:fs';
import {creatureSize} from '../../server/dist/game/creatureSize.js';
import {arenaContains} from '../../server/dist/game/arenaBoundary.js';
import {practiceInput} from './helpers/practice.mjs';
test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local chase study only');
const cases=[
 {name:'wall baseline',site:'wall',ratio:1.35,n:1,gems:221,puff:false},
 {name:'wall front puff',site:'wall',ratio:1.35,n:1,gems:221,puff:true},
 {name:'corner front puff',site:'corner',ratio:1.35,n:1,gems:221,puff:true},
 {name:'corner running puff',site:'corner',ratio:1.35,n:1,gems:221,puff:true,running:true},
 {name:'corner stronger tracker',site:'corner',ratio:1.75,n:1,gems:221,puff:true},
 {name:'corner two trackers',site:'corner',ratio:1.35,n:2,gems:221,puff:true},
 {name:'large corner tracker',site:'corner',ratio:1.75,n:1,gems:1000,puff:true},
 {name:'wall confirmed rear hit',site:'wall',ratio:1.35,n:1,gems:221,puff:true,running:true,rear:true},
 {name:'corner confirmed rear hit',site:'corner',ratio:1.35,n:1,gems:221,puff:true,running:true,rear:true},
 {name:'large corner confirmed rear hit',site:'corner',ratio:1.35,n:1,gems:1000,puff:true,running:true,rear:true,gap:240},
 {name:'equal-size two trackers',site:'corner',ratio:1,n:2,gems:221,puff:true},
];
function stock(width){let lo=0,hi=1e9;while(lo<hi){const m=Math.floor((lo+hi)/2);if(creatureSize(m)<width)lo=m+1;else hi=m;}return lo;}
for(const scene of cases)test(`${scene.name}: record live tracking, defensive input and escape outcome`,async({page,baseURL,browserName,hasTouch})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');});
 await page.route('**/matchmake/joinOrCreate/game_room',r=>r.continue({url:r.request().url().replace('/joinOrCreate/','/create/'),postData:JSON.stringify({...r.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'})}));
 await page.goto('/');await page.waitForFunction(()=>window.game?.currentGameMode?.lastView&&!document.body.classList.contains('intro-playing'));
 const send=(type,data)=>page.evaluate(({type,data})=>window.game.currentGameMode.multiplayerManager.room.send(type,data),{type,data});
 const read=()=>page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return{x:p.x,y:p.y,width:p.width,height:p.height,captured:!!p.capturedBy,state:p.state,inhaling:p.inhaling,stunned:p.stunned,sliding:p.sliding,breath:m.stamina};});
 await send('test:clearHoles');await send('test:setGems',{count:scene.gems});await page.waitForFunction(gems=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems===gems,scene.gems);
 const size=(await read()).width,roomId=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id),peers=[];
 const input=await practiceInput(page,browserName,hasTouch);let timer;
 try{
  for(let i=0;i<scene.n;i++){const p=await new Client(baseURL.replace(/^http/,'ws')).joinById(roomId,{name:'Tracking pursuer '+i});p.onMessage('*',()=>{});p.send('test:setGems',{count:stock(size*scene.ratio)});peers.push(p);await expect.poll(()=>p.state.players.get(p.sessionId)?.gems).toBe(stock(size*scene.ratio));}
  const nx=scene.site==='corner'?Math.SQRT1_2:1,ny=scene.site==='corner'?Math.SQRT1_2:0,inner=700-size/2-8;
  const x=scene.site==='corner'?700-nx*inner:size/2+8,y=scene.site==='corner'?700-ny*inner:2100;
  await send('test:moveTo',{x:x-size/2,y:y-size/2});await send('test:face',{angle:scene.running?Math.atan2(nx,-ny):Math.atan2(ny,nx)});await send('test:protect',{ms:0});
  for(const [i,p]of peers.entries()){const h=p.state.players.get(p.sessionId),a=scene.n===1?0:(i===0?-.45:.45),hx=(scene.rear?ny:nx)*Math.cos(a)-(scene.rear?-nx:ny)*Math.sin(a),hy=(scene.rear?-nx:ny)*Math.cos(a)+(scene.rear?ny:nx)*Math.sin(a),d=(size+h.width)/2+(scene.rear?(scene.gap??80):240);p.send('test:moveTo',{x:x+hx*d-h.width/2,y:y+hy*d-h.height/2});p.send('test:face',{angle:Math.atan2(-hy,-hx)});p.send('test:protect',{ms:0});}
  await page.waitForFunction(({x,y,size})=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return Math.hypot(p.x+size/2-x,p.y+size/2-y)<1&&Math.hypot(m.predicted.x-p.x,m.predicted.y-p.y)<3;},{x,y,size});
  await page.evaluate(()=>{const r=window.game.currentGameMode.multiplayerManager.room;window.chasePuffs=[];window.chaseRearHits=0;window.chaseSlips=[];r.onMessage('exhale',e=>{if(e.id===r.sessionId)window.chasePuffs.push({...e,receivedAt:performance.now()});});r.onMessage('wallSlip',e=>{if(e.id===r.sessionId)window.chaseSlips.push(e);});r.onMessage('gustHit',e=>{if(e.id===r.sessionId)window.chaseRearHits++;});});
  const began=Date.now();let hunterInhaleObserved=false;
  const track=async()=>{const p=await read();for(const peer of peers){const h=peer.state.players.get(peer.sessionId);if(!h)continue;hunterInhaleObserved ||=h.inhaling;peer.trackState??={was:false,rearmAt:0};const t=peer.trackState,now=Date.now();if(t.was&&!h.inhaling)t.rearmAt=now+750;if(!h.inhaling&&now>=t.rearmAt){peer.send('inhale');t.rearmAt=now+1000;}t.was=h.inhaling;const dx=p.x+p.width/2-h.x-h.width/2,dy=p.y+p.height/2-h.y-h.height/2,d=Math.hypot(dx,dy)||1;peer.send('steer',{x:dx/d,y:dy/d});peer.send('aim',{x:dx,y:dy});}};
  let tracking=false;timer=setInterval(()=>{if(tracking)return;tracking=true;track().finally(()=>tracking=false);},100);
  await input.move(-ny,nx);if(scene.puff)await input.tap();
  let airflowCue=false, cueSaved=false;const samples=[];let capturedAt=null;
  while(Date.now()-began<6000){await page.waitForTimeout(100);const p=await read();samples.push(p);airflowCue ||=await page.evaluate(()=>window.game.currentGameMode.puffs.some(p=>p.slideOnly&&Math.hypot(p.slideX,p.slideY)>0));if(airflowCue&&!cueSaved){await page.screenshot({path:test.info().outputPath('rear-wall-slip-cue.png'),scale:'css'});cueSaved=true;}expect(arenaContains(p,4200,4200)).toBe(true);if(p.captured||p.state!=='alive'){capturedAt=(Date.now()-began)/1000;break;}expect(p.stunned).toBe(false);expect(p.sliding).toBe(false);}
  clearInterval(timer);await input.stop();
  const events=await page.evaluate(()=>({puffs:window.chasePuffs,rearHits:window.chaseRearHits,slips:window.chaseSlips}));
  const report={scene,airflowCue,input:hasTouch?'thumb controls':'keyboard',capturedAt,survivedSixSeconds:capturedAt===null,hunterInhaleObserved,events,samples};
  writeFileSync(test.info().outputPath('chase.json'),JSON.stringify(report,null,2));
  expect(hunterInhaleObserved).toBe(true);if(scene.puff){expect(events.puffs.length).toBe(1);expect(events.puffs[0].breathLeft).toBeCloseTo(.25,2);}else expect(events.puffs.length).toBe(0);
  if(scene.rear){expect(events.rearHits).toBeGreaterThan(0);expect(events.slips.length).toBeGreaterThan(0);expect(airflowCue).toBe(true);expect(events.puffs[0].recoil).toBe(0);}
  await page.screenshot({path:test.info().outputPath('chase-result.png'),scale:'css'});expect(errors).toEqual([]);
 }finally{clearInterval(timer);await input.close();for(const p of peers)await p.leave();}
});
