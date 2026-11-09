import {test,expect} from '@playwright/test';
import { enterGame } from './helpers/enter-game.mjs';
import {Client} from 'colyseus.js';
import {practiceInput} from './helpers/practice.mjs';

test.skip(process.env.E2E_TEST_HOOKS!=='1','isolated local player-projectile checks');
test.afterEach(async({page},info)=>{
  if(info.status!==info.expectedStatus){const data=await page.evaluate(()=>({warnings:window.playerWarnings,first:window.warningTelemetry?.slice(0,3),last:window.warningTelemetry?.slice(-3)}));console.log('Warning diagnostic',JSON.stringify(data));await info.attach('warning-diagnostic',{body:JSON.stringify(data,null,2),contentType:'application/json'});}
});
async function scene(page,baseURL,stock=0){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
    localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');
    window.playerWarnings={edges:[],halos:0};
    window.warningTelemetry=[];
    setInterval(()=>{const m=window.game?.currentGameMode,s=m?.multiplayerManager?.getState(),me=m?.multiplayerManager?.getLocalPlayer();
      if(!s||!me)return;s.players.forEach(p=>{if(p.flying&&p.flightKind==='missile'&&window.warningTelemetry.length<200)window.warningTelemetry.push({
        me:{x:me.x,y:me.y,state:me.state,protected:me.spawnProtected,vx:me.movementVx,vy:me.movementVy},
        shot:{x:p.x,y:p.y,vx:p.flightVx,vy:p.flightVy,age:p.flightAgeMs,left:p.flightRemainingMs,hit:p.flightHit,by:p.launchedBy},
        view:m.renderView,local:m.multiplayerManager.localSessionId});});},30);
    const move=CanvasRenderingContext2D.prototype.moveTo,arc=CanvasRenderingContext2D.prototype.arc;
    CanvasRenderingContext2D.prototype.moveTo=function(x,y){
      if(x===12&&y===0&&this.fillStyle==='#ffd47d'){
        const m=window.game?.currentGameMode,s=m?.multiplayerManager?.getState(),me=m?.multiplayerManager?.getLocalPlayer();
        const p=s&&[...s.players.values()].find(p=>p.flying&&p.flightKind==='missile');
        if(p&&me){const t=this.getTransform(),r=this.canvas.getBoundingClientRect();
          window.playerWarnings.edges.push({at:performance.now(),x:r.left+t.e*r.width/this.canvas.width,y:r.top+t.f*r.height/this.canvas.height,
            distance:Math.hypot(p.x+p.width/2-me.x-me.width/2,p.y+p.height/2-me.y-me.height/2),speed:Math.hypot(p.flightVx,p.flightVy)});}
      }
      return move.call(this,x,y);
    };
    CanvasRenderingContext2D.prototype.arc=function(...args){
      if(this.strokeStyle==='#07131f'&&this.lineWidth===6&&args[0]===0&&args[1]===0&&args[3]===-2.5)window.playerWarnings.halos++;
      return arc.apply(this,args);
    };
  });
  await page.route('**/matchmake/joinOrCreate/game_room',route=>route.continue({url:route.request().url().replace('/joinOrCreate/','/create/'),
    postData:JSON.stringify({...route.request().postDataJSON(),testBots:0,testFieldGems:0,testCores:0,testCalm:true})}));
  await enterGame(page);await page.waitForFunction(()=>{const m=window.game?.currentGameMode;return m?.lastView&&m.multiplayerManager?.getLocalPlayer()&&!m.introPlaying&&!document.body.classList.contains('intro-playing');});
  await page.evaluate(stock=>window.game.currentGameMode.multiplayerManager.room.send('test:setGems',{count:stock}),stock);
  await expect.poll(()=>page.evaluate(()=>window.game.currentGameMode.multiplayerManager.getLocalPlayer().gems)).toBe(stock);
  await page.evaluate(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer(),r=m.multiplayerManager.room;r.send('test:protect',{ms:0});r.send('test:moveTo',{x:2100-p.width/2,y:2100-p.height/2});});
  await expect.poll(()=>page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return Math.abs(p.x+p.width/2-2100);})).toBeLessThan(1);
  await page.waitForFunction(()=>{const m=window.game.currentGameMode,p=m.multiplayerManager.getLocalPlayer();return !p.spawnProtected&&m.renderView&&Math.abs(m.renderView.x-2100)<30&&Math.abs(m.renderView.y-2100)<30;});
  const room=await page.evaluate(()=>window.game.currentGameMode.multiplayerManager.room.id),client=new Client(baseURL.replace(/^http/,'ws'));
  const shooter=await client.joinById(room,{name:'Shooter'}),ammo=await client.joinById(room,{name:'Ammo'});
  shooter.onMessage('*',()=>{});ammo.onMessage('*',()=>{});
  shooter.send('test:setGems',{count:1000});ammo.send('test:setGems',{count:100});
  await expect.poll(()=>shooter.state.players.get(shooter.sessionId)?.gems).toBe(1000);
  await expect.poll(()=>ammo.state.players.get(ammo.sessionId)?.gems).toBe(100);
  const w=shooter.state.players.get(shooter.sessionId).width,aw=ammo.state.players.get(ammo.sessionId).width;
  const horizontal=page.viewportSize().width<=page.viewportSize().height,dx=horizontal?1:0,dy=horizontal?0:1;
  // A wider body needs more physical clearance time. This is a distant-shot
  // warning test, not a claim that a cue makes every shorter launch escapable.
  const distance=stock?1750:1550,x=2100-dx*distance,y=2100-dy*distance;
  shooter.send('test:protect',{ms:0});ammo.send('test:protect',{ms:0});
  shooter.send('test:moveTo',{x:x-w/2,y:y-w/2});shooter.send('test:face',{angle:Math.atan2(dy,dx)});
  ammo.send('test:moveTo',{x:x+dx*(w*.3+1)-aw/2,y:y+dy*(w*.3+1)-aw/2});
  await expect.poll(()=>Math.abs(shooter.state.players.get(shooter.sessionId)?.x-(x-w/2))).toBeLessThan(100);
  shooter.send('inhale');await expect.poll(()=>shooter.state.players.get(shooter.sessionId)?.gulping).toBe(ammo.sessionId);
  shooter.send('exhale');await page.waitForTimeout(80);
  const fire=async()=>{
    const target=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return{x:p.x+p.width/2,y:p.y+p.height/2};});
    const a=shooter.state.players.get(shooter.sessionId),angle=Math.atan2(target.y-a.y-a.height/2,target.x-a.x-a.width/2);
    shooter.send('test:face',{angle});await expect.poll(()=>Math.abs(shooter.state.players.get(shooter.sessionId).facing-angle)).toBeLessThan(.01);
    shooter.send('tap');
  };
  return {errors,shooter,ammo,horizontal,fire,close:async()=>{await ammo.leave();await shooter.leave();}};
}

for(const stock of [0,100])test(`a ${stock?'growing':'small'} threatened player gets an early, unobscured edge cue and can sidestep with ordinary controls`,async({page,baseURL,browserName,hasTouch})=>{
  const s=await scene(page,baseURL,stock),input=await practiceInput(page,browserName,hasTouch);
  try{
    await input.prepareMovement();
    await s.fire();await expect.poll(()=>page.evaluate(()=>window.playerWarnings.edges.length),{intervals:[20,30,50]}).toBeGreaterThan(0);
    const first=await page.evaluate(()=>window.playerWarnings.edges[0]);
    expect(first.distance/first.speed).toBeGreaterThan(.65);
    expect(await page.evaluate(({x,y})=>document.elementFromPoint(x,y)?.tagName,first)).toBe('CANVAS');
    // Screenshots can block input long enough to turn a nominal 250ms response into
    // a much later one. Measure from the painted cue; capture the idle run instead.
    const elapsed=await page.evaluate(at=>performance.now()-at,first.at);
    if(elapsed<250)await page.waitForTimeout(250-elapsed);
    await input.move(s.horizontal?0:1,s.horizontal?1:0);
    await page.waitForTimeout(1450);
    const p=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return{state:p.state,injury:p.injuredUntil};});
    expect(p.state).toBe('alive');expect(p.injury).toBe(0);expect(s.errors).toEqual([]);
    await page.screenshot({path:test.info().outputPath('player-bullet-dodged.png'),scale:'css'});
  }finally{await input.close();await s.close();}
});

test('the warning hands over to the actual visible bullet and an idle control really gets hit',async({page,baseURL})=>{
  const s=await scene(page,baseURL);
  try{
    await s.fire();await expect.poll(()=>page.evaluate(()=>window.playerWarnings.edges.length),{intervals:[20,30,50]}).toBeGreaterThan(0);
    await page.screenshot({path:test.info().outputPath('player-bullet-edge.png'),scale:'css'});
    await expect.poll(()=>page.evaluate(()=>window.playerWarnings.halos),{intervals:[20,30,50]}).toBeGreaterThan(0);
    await page.screenshot({path:test.info().outputPath('player-bullet-handoff.png'),scale:'css'});
    await expect.poll(()=>page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return p.state!=='alive'||p.injuredUntil>0;})).toBe(true);
    expect(s.errors).toEqual([]);
  }finally{await s.close();}
});
