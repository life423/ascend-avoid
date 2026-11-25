import {expect} from '@playwright/test';
import {Client} from 'colyseus.js';
import {enterGame} from './enter-game.mjs';

export async function playerBulletScene(page,baseURL,stock=0,options={}){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(captureFrame=>{
    localStorage.setItem('ascend.guideSeen','true');localStorage.setItem('ascend.mouseFollow','off');
    window.playerWarnings={edges:[],halos:0,firstFrame:null,firstAimAt:null,lastAimAt:null};
    const frame=window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame=callback=>frame(function resume(timestamp){
      if(performance.now()<(window.warningFramesResumeAt??0))frame(resume);else callback(timestamp);
    });
    window.warningTelemetry=[];
    setInterval(()=>{const m=window.game?.currentGameMode,s=m?.multiplayerManager?.getState(),me=m?.multiplayerManager?.getLocalPlayer();
      if(!s||!me)return;s.players.forEach(p=>{if(p.flying&&p.flightKind==='missile'&&window.warningTelemetry.length<200)window.warningTelemetry.push({
        me:{x:me.x,y:me.y,state:me.state,protected:me.spawnProtected,vx:me.movementVx,vy:me.movementVy},
        shot:{x:p.x,y:p.y,vx:p.flightVx,vy:p.flightVy,age:p.flightAgeMs,left:p.flightRemainingMs,hit:p.flightHit,by:p.launchedBy},
        view:m.renderView,local:m.multiplayerManager.localSessionId});});},30);
    const move=CanvasRenderingContext2D.prototype.moveTo,arc=CanvasRenderingContext2D.prototype.arc,stroke=CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.moveTo=function(x,y){
      if(x===12&&y===0&&this.fillStyle==='#ff896f'){
        const m=window.game?.currentGameMode,s=m?.multiplayerManager?.getState(),me=m?.multiplayerManager?.getLocalPlayer();
        const entry=s&&[...s.players.entries()].find(([,p])=>p.flying&&['missile','turbine'].includes(p.flightKind)),p=entry?.[1];
        if(p&&me){const t=this.getTransform(),r=this.canvas.getBoundingClientRect();
          window.playerWarnings.edges.push({at:performance.now(),alpha:this.globalAlpha,x:r.left+t.e*r.width/this.canvas.width,y:r.top+t.f*r.height/this.canvas.height,
            distance:Math.hypot(p.x+p.width/2-me.x-me.width/2,p.y+p.height/2-me.y-me.height/2),speed:Math.hypot(p.flightVx,p.flightVy),
            flightAgeMs:p.flightAgeMs,trafficLead:m.trafficLead(performance.now()),
            playerX:r.left+(this.canvas.width/2+(me.x+me.width/2-m.renderView.x)*m.renderView.scale)*r.width/this.canvas.width,
            playerY:r.top+(this.canvas.height/2+(me.y+me.height/2-m.renderView.y)*m.renderView.scale)*r.height/this.canvas.height,
            sourceX:r.left+(this.canvas.width/2+(p.x+p.width/2-m.renderView.x)*m.renderView.scale)*r.width/this.canvas.width,
            sourceY:r.top+(this.canvas.height/2+(p.y+p.height/2-m.renderView.y)*m.renderView.scale)*r.height/this.canvas.height,
            sourceOnScreen:(()=>{const v=m.renderView,c=m.centerOf(entry[0],p);return c.x-p.width/2>=v.x-v.width/2&&c.x+p.width/2<=v.x+v.width/2&&c.y-p.height/2>=v.y-v.height/2&&c.y+p.height/2<=v.y+v.height/2;})()});}
        this.pendingIncomingCapture=true;
      }
      return move.call(this,x,y);
    };
    CanvasRenderingContext2D.prototype.arc=function(...args){
      if(args[0]===-6&&args[1]===0&&args[2]===16&&args[3]===-.75){
        window.playerWarnings.lastAimAt=performance.now();
        window.playerWarnings.firstAimAt??=window.playerWarnings.lastAimAt;
      }
      if(this.strokeStyle==='#07131f'&&this.lineWidth===6&&args[0]===0&&args[1]===0&&args[3]===-2.5)window.playerWarnings.halos++;
      return arc.apply(this,args);
    };
    CanvasRenderingContext2D.prototype.stroke=function(...args){
      const result=stroke.apply(this,args);
      if(captureFrame && this.pendingIncomingCapture && !window.playerWarnings.firstFrame){
        window.playerWarnings.firstFrame={at:performance.now(),alpha:this.globalAlpha,png:this.canvas.toDataURL()};
      }
      this.pendingIncomingCapture=false;return result;
    };
  },options.captureFrame===true);
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
  const shooterStock=options.shooterStock??1000,ammoStock=options.ammoStock??100;
  shooter.send('test:setGems',{count:shooterStock});ammo.send('test:setGems',{count:ammoStock});
  await expect.poll(()=>shooter.state.players.get(shooter.sessionId)?.gems).toBe(shooterStock);
  await expect.poll(()=>ammo.state.players.get(ammo.sessionId)?.gems).toBe(ammoStock);
  const w=shooter.state.players.get(shooter.sessionId).width,aw=ammo.state.players.get(ammo.sessionId).width;
  if(options.settleCamera){
    let previous,stable=0;
    await expect.poll(async()=>{
      const v=await page.evaluate(()=>{const v=window.game.currentGameMode.renderView;return {width:v.width,height:v.height};});
      stable=previous&&Math.abs(v.width-previous.width)<.1&&Math.abs(v.height-previous.height)<.1?stable+1:0;previous=v;return stable;
    },{intervals:[60],timeout:7000}).toBeGreaterThanOrEqual(3);
  }
  const horizontal=page.viewportSize().width<=page.viewportSize().height;
  const angle=options.angle??(horizontal?0:Math.PI/2),dx=Math.cos(angle),dy=Math.sin(angle);
  // A wider body needs more physical clearance time. This is a distant-shot
  // warning test, not a claim that a cue makes every shorter launch escapable.
  const extent=await page.evaluate(({dx,dy})=>{const v=window.game.currentGameMode.renderView;
    return Math.min(Math.abs(dx)>1e-6?v.width/2/Math.abs(dx):Infinity,Math.abs(dy)>1e-6?v.height/2/Math.abs(dy):Infinity);},{dx,dy});
  const bulletRadius=25,clearance=4;
  const muzzle=w/2+bulletRadius+clearance;
  const distance=options.entry==='visible'?extent-80+muzzle:options.entry==='edge'?extent+bulletRadius+(options.edgeGap??120)+muzzle:options.shotDistance?options.shotDistance+muzzle:(stock?1750:1550);
  const x=2100-dx*distance,y=2100-dy*distance;
  shooter.send('test:protect',{ms:0});ammo.send('test:protect',{ms:0});
  shooter.send('test:moveTo',{x:x-w/2,y:y-w/2});shooter.send('test:face',{angle:Math.atan2(dy,dx)});
  ammo.send('test:moveTo',{x:x+dx*(w*.3+1)-aw/2,y:y+dy*(w*.3+1)-aw/2});
  await expect.poll(()=>Math.abs(shooter.state.players.get(shooter.sessionId)?.x-(x-w/2))).toBeLessThan(100);
  shooter.send('inhale');await expect.poll(()=>shooter.state.players.get(shooter.sessionId)?.gulping).toBe(ammo.sessionId);
  shooter.send('exhale');await page.waitForTimeout(80);
  const fire=async()=>{
    const target=await page.evaluate(()=>{const p=window.game.currentGameMode.multiplayerManager.getLocalPlayer();return{x:p.x+p.width/2,y:p.y+p.height/2};});
    if(options.exactShotPlacement){
      const view=await page.evaluate(()=>({...window.game.currentGameMode.renderView}));
      const edge=Math.min(Math.abs(dx)>1e-6?view.width/2/Math.abs(dx):Infinity,Math.abs(dy)>1e-6?view.height/2/Math.abs(dy):Infinity);
      const desired=options.entry==='edge'?edge+bulletRadius+(options.edgeGap??120):options.shotDistance;
      const a=shooter.state.players.get(shooter.sessionId),out=a.width/2+bulletRadius+clearance;
      const x=target.x-dx*(desired+out)-a.width/2,y=target.y-dy*(desired+out)-a.height/2;
      shooter.send('test:moveTo',{x,y});
      await expect.poll(()=>Math.hypot(shooter.state.players.get(shooter.sessionId).x-x,shooter.state.players.get(shooter.sessionId).y-y),{intervals:[20,30]}).toBeLessThan(1);
    }
    const a=shooter.state.players.get(shooter.sessionId),angle=Math.atan2(target.y+dx*(options.miss??0)-a.y-a.height/2,target.x-dy*(options.miss??0)-a.x-a.width/2);
    shooter.send('test:face',{angle});await expect.poll(()=>Math.abs(shooter.state.players.get(shooter.sessionId).facing-angle)).toBeLessThan(.01);
    if(options.firstPaintDelay){
      // Hold presentation only; real server physics and replicated flight data keep advancing.
      await page.evaluate(ms=>window.warningFramesResumeAt=performance.now()+ms,options.firstPaintDelay);
    }
    shooter.send('tap');
  };
  return {errors,shooter,ammo,horizontal,fire,close:async()=>{await ammo.leave();await shooter.leave();}};
}
