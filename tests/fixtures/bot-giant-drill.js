// Normal game and production bot AI, in a private development room with guarded setup controls.
(()=>{
if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
const options={testBots:12,testFieldGems:200,testCores:0,testCalm:true,testTurbines:'manual'};
const originalFetch=window.fetch.bind(window);
window.fetch=(url,opts={})=>{const path=typeof url==='string'?url:url.url;return path.includes('/matchmake/joinOrCreate/game_room')?originalFetch(path.replace('/joinOrCreate/','/create/'),{...opts,body:JSON.stringify({...JSON.parse(opts.body||'{}'),...options})}):originalFetch(url,opts);};
const open=XMLHttpRequest.prototype.open,send=XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open=function(method,url,...args){this.giantDrill=String(url).includes('/matchmake/joinOrCreate/game_room');return open.call(this,method,this.giantDrill?String(url).replace('/joinOrCreate/','/create/'):url,...args);};
XMLHttpRequest.prototype.send=function(body){return send.call(this,this.giantDrill?JSON.stringify({...JSON.parse(body||'{}'),...options}):body);};
try{localStorage.setItem('ascend.practice.v2',JSON.stringify({version:2,offered:true,lessons:{}}));localStorage.setItem('ascend.mouseFollow','off');}catch{}
window.addEventListener('load',()=>{
 const panel=document.createElement('aside');panel.style.cssText='position:fixed;z-index:99999;left:12px;bottom:180px;width:250px;padding:12px;border:1px solid #487283;border-radius:10px;background:#071726ed;color:#defbff;font:12px system-ui';
 panel.innerHTML='<strong>Local giant-awareness drill</strong><p>11 real AI bots · normal movement and puff</p><p><label>Giant width <select id="size"><option>300</option><option selected>600</option><option>1000</option></select></label> <button id="grow" disabled>Apply size</button></p><p><button id="face" disabled>Face a distant bot</button> <button id="away" disabled>Turn away</button></p><p>Set up an encounter, then use ordinary game controls to chase or inhale. Setup buttons only prepare the encounter.</p><output id="status">Connecting…</output>';
 document.body.append(panel);const $=id=>panel.querySelector('#'+id);let room,manager,targetId='',origin,fx=1,fy=0,placed=false;
 const grow=()=>{let lo=0,hi=1e8,w=Number($('size').value);while(lo<hi){const m=Math.floor((lo+hi)/2);if(GiantDrill.creatureSize(m)<w)lo=m+1;else hi=m;}room.send('test:setGems',{count:lo});};
 $('grow').onclick=()=>{grow();placed=false;};
 $('face').onclick=()=>{
  const p=manager.getLocalPlayer(),reach=GiantDrill.INHALE.REACH+p.width*GiantDrill.INHALE.REACH_PER_SIZE;
  for(const bot of manager.getState().players.values()){
   if(!bot.isBot||bot.state!=='alive'||bot.capturedBy||bot.flying||p.width<bot.width*GiantDrill.INHALE.EAT_RATIO)continue;
   const bx=bot.x+bot.width/2,by=bot.y+bot.height/2,d=p.width*.3+reach*.85+bot.width/2;
   for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){
    const at={x:bx-dx*d-p.width/2,y:by-dy*d-p.height/2,width:p.width,height:p.height};
    if(!GiantDrill.arenaContains(at,4200,4200))continue;
    room.send('cancel');room.send('test:moveTo',{x:at.x,y:at.y});room.send('test:face',{angle:Math.atan2(dy,dx)});room.send('test:protect',{ms:0});targetId=bot.sessionId;origin={x:bx,y:by};fx=dx;fy=dy;placed=true;return;
   }
  }
  $('status').textContent='No clear setup position right now. Try a smaller width or wait for bots to move.';
 };
 $('away').onclick=()=>{room.send('cancel');room.send('test:face',{angle:Math.atan2(fy,fx)+Math.PI});};
 const wait=setInterval(()=>{const m=window.game?.currentGameMode;if(!m?.lastView||m.introPlaying||!m.multiplayerManager?.getLocalPlayer())return;clearInterval(wait);manager=m.multiplayerManager;room=manager.room;room.send('test:clearHoles');grow();for(const id of ['grow','face','away'])$(id).disabled=false;$('status').textContent='Ready. Face a distant bot to see early avoidance.';
 setInterval(()=>{if(!placed)return;const b=manager.getState().players.get(targetId),p=manager.getLocalPlayer();if(!b){placed=false;$('status').textContent='Bot gone; set up another encounter.';return;}const outward=(b.x+b.width/2-origin.x)*fx+(b.y+b.height/2-origin.y)*fy,bodyGap=Math.hypot(b.x+b.width/2-p.x-p.width/2,b.y+b.height/2-p.y-p.height/2)-p.width/2;$('status').textContent=`${b.name} · ${b.capturedBy?'captured':b.state} · giant ${Math.round(p.width)} wide · body-edge distance ${Math.round(bodyGap)} · outward travel ${Math.round(outward)} · giant ${p.inhaling?'inhaling':'idle'}`;},100);
 },50);
});
})();
