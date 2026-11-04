import {Client} from 'colyseus.js';

// Only setup is scripted; real weapons, movement, damage and injury run on the server.
if(['localhost','127.0.0.1','[::1]'].includes(location.hostname)) {
 const options={testBots:0,testFieldGems:0,testCores:0,testCalm:true,testTurbines:'manual'};
 const fetch=window.fetch.bind(window);
 window.fetch=(url,opts={})=>{
  const path=typeof url==='string'?url:url.url;
  return path.includes('/matchmake/joinOrCreate/game_room')?fetch(path.replace('/joinOrCreate/','/create/'),{...opts,body:JSON.stringify({...JSON.parse(opts.body||'{}'),...options})}):fetch(url,opts);
 };
 const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
 XMLHttpRequest.prototype.open=function(method,url,...args){this.growthDrill=String(url).includes('/matchmake/joinOrCreate/game_room');return open.call(this,method,this.growthDrill?String(url).replace('/joinOrCreate/','/create/'):url,...args);};
 XMLHttpRequest.prototype.send=function(body){return send.call(this,this.growthDrill?JSON.stringify({...JSON.parse(body||'{}'),...options}):body);};
 localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');
 window.addEventListener('load',()=>{
  const panel=document.createElement('aside');panel.setAttribute('aria-label','Local growth review');
  panel.style.cssText='position:fixed;z-index:99999;left:12px;bottom:180px;max-width:255px;padding:12px;border:1px solid #487283;border-radius:10px;background:#071726ed;color:#defbff;font:12px system-ui';
  panel.innerHTML='<details open><summary>Local growth + injury review</summary><p>Normal movement and puff. Hold inhale to lean the view forward without zooming; release to return.</p><label>Gems <select id="gems"><option>5000</option><option selected>20000</option><option>50000</option><option>100000</option><option>1000000</option><option value="1000000000">Maximum</option></select></label> <button id="grow" disabled>Apply</button><p><button id="center" disabled>Center</button> <button id="corner" disabled>Corner</button></p><p><label>Weapon <select id="kind"><option value="comet">Comet cannon</option><option value="sentinel">Sentinel</option><option value="pinwheel">Machine gun</option><option value="ricochet">Ricochet</option><option value="ion">Ion</option><option value="pulsar">Gravity wave</option></select></label></p><button id="fire" disabled>Set up enemy weapon</button><p>To repeat after injury, reload. Collapse this panel for a clear view.</p><output id="status">Connecting…</output></details>';
  document.body.append(panel);const $=id=>panel.querySelector('#'+id);
  let manager,room,builder,setup=false,hits=0,lastLoss=0;
  const wait=predicate=>new Promise((resolve,reject)=>{const end=Date.now()+10000,id=setInterval(()=>{if(predicate()){clearInterval(id);resolve();}else if(Date.now()>end){clearInterval(id);reject(Error('Setup timed out; reload to try again.'));}},30);});
  const center=()=>{const p=manager.getLocalPlayer();room.send('test:moveTo',{x:2100-p.width/2,y:2100-p.width/2});};
  $('grow').onclick=()=>room.send('test:setGems',{count:Number($('gems').value)});
  $('center').onclick=center;
  $('corner').onclick=()=>room.send('test:moveTo',{x:0,y:0});
  $('fire').onclick=async()=>{
   if(setup)return;setup=true;$('fire').disabled=true;
   try {
    if(!builder){builder=await new Client(location.origin.replace(/^http/,'ws')).joinById(room.id,{name:'Review builder'});builder.onMessage('*',()=>{});builder.onMessage('credit',d=>{if(d.targetId===manager.localSessionId){hits++;lastLoss=d.gems;}});}
    builder.send('test:setGems',{count:1000});await wait(()=>builder.state.players.get(builder.sessionId)?.gems>990);
    let w=builder.state.players.get(builder.sessionId).width;
    builder.send('test:moveTo',{x:1000-w/2,y:2100-w/2});builder.send('test:pinwheel',{x:1000,y:2100,kind:$('kind').value});
    await wait(()=>builder.state.pinwheel.phase==='carried');
    w=builder.state.players.get(builder.sessionId).width;
    builder.send('test:moveTo',{x:900-w-72,y:2100-w/2});builder.send('test:face',{angle:0});
    center();room.send('test:protect',{ms:0});builder.send('placeWeapon');hits=lastLoss=0;
   }catch(e){$('status').textContent=e.message;setup=false;$('fire').disabled=false;}
  };
  const ready=setInterval(()=>{
   const m=window.game?.currentGameMode;
   if(!m?.lastView||m.introPlaying||!m.multiplayerManager?.getLocalPlayer())return;
   clearInterval(ready);manager=m.multiplayerManager;room=manager.room;
   center();
   room.send('test:setGems',{count:Number($('gems').value)});
   for(const id of ['grow','center','corner','fire'])$(id).disabled=false;
   setInterval(()=>{const p=manager.getLocalPlayer(),s=manager.getState();$('status').textContent=`${Math.round(p.gems).toLocaleString()} gems · ${p.width} wide · ${p.injuredUntil>s.time?'INJURED '+((p.injuredUntil-s.time)/1000).toFixed(1)+'s':'healthy'} · ${hits} hits · last hit ${lastLoss} gems`;},100);
  },50);
 });
}
