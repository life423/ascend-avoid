// Local-only UI-directed chase fixture. Uses ordinary controls and existing dev-only setup hooks.
(()=>{
if(!['localhost','127.0.0.1','[::1]'].includes(location.hostname))return;
// Disposable developer drill; served only from this local development build.
const originalFetch = window.fetch.bind(window);
window.fetch = (url, options = {}) => {
  const path = typeof url === 'string' ? url : url.url;
  if (path.includes('/matchmake/joinOrCreate/game_room')) return originalFetch(path.replace('/joinOrCreate/', '/create/'), {
    ...options, body: JSON.stringify({ ...JSON.parse(options.body || '{}'), testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' }),
  });
  return originalFetch(url, options);
};
const originalOpen = XMLHttpRequest.prototype.open, originalSend = XMLHttpRequest.prototype.send;
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  this.wallFixture = String(url).includes('/matchmake/joinOrCreate/game_room');
  return originalOpen.call(this, method, this.wallFixture ? String(url).replace('/joinOrCreate/', '/create/') : url, ...rest);
};
XMLHttpRequest.prototype.send = function(body) {
  return originalSend.call(this, this.wallFixture ? JSON.stringify({ ...JSON.parse(body || '{}'), testBots: 0, testFieldGems: 0, testCores: 0, testCalm: true, testTurbines: 'manual' }) : body);
};
try { localStorage.setItem('ascend.practice.v2', JSON.stringify({ version: 2, offered: true, lessons: {} })); localStorage.setItem('ascend.mouseFollow', 'off'); } catch {}


window.addEventListener('load',()=>{
 const params=new URLSearchParams(location.search),site=params.get('site')||'wall',count=Number(params.get('count')||1),gems=Number(params.get('gems')||221),ratio=Number(params.get('ratio')||1.75),gap=Number(params.get('gap')||240),stance=params.get('stance')||'front',approach=params.get('approach')||'inward';
 const panel=document.createElement('aside');panel.style.cssText='position:fixed;z-index:99999;left:12px;top:170px;width:276px;padding:10px;border:1px solid #487283;border-radius:10px;background:#071726ed;color:#defbff;font:12px system-ui';
 panel.innerHTML=`<strong>Corner defense drill · rear-hit wall slip</strong><div id="setup"><p><label>Site <select id="site"><option value="wall">Left wall</option><option value="corner">Top-left curve</option></select></label> <label>Hunters <select id="count"><option>1</option><option>2</option></select></label></p><p><label>Gems <select id="gems"><option value="32">Small</option><option value="221">Medium</option><option value="1000">Large</option></select></label> <label>Ratio <select id="ratio"><option>1</option><option>1.35</option><option>1.75</option><option>2.5</option></select></label></p><p><label>Gap <select id="gap"><option>80</option><option>240</option><option>400</option></select></label> <label>Facing <select id="stance"><option value="front">Pursuer</option><option value="run">Escape</option></select></label> <label>Approach <select id="approach"><option value="inward">Arena side</option><option value="rear">Behind</option></select></label></p></div><p style="margin:6px 0;display:flex;flex-wrap:wrap;gap:5px"><button id="start" disabled>Start + sidestep</button><button id="puff" disabled>Puff</button><button id="reset">Reset scenario</button><button id="configure">Configure</button></p><output id="status">Connecting…</output>`;
 document.body.append(panel);const $=id=>panel.querySelector('#'+id);for(const [id,v]of Object.entries({site,count,gems,ratio,gap,stance,approach}))$(id).value=String(v);
 let mode,room,peers=[],moving=[],active=false,started=0,accepted=0,slips=0,rears=0,attempts=0;
 const stopMovement=()=>{for(const code of moving)window.game.canvas.dispatchEvent(new KeyboardEvent('keyup',{key:code,code,bubbles:true}));moving=[];};
 const move=()=>{stopMovement();moving=site==='corner'?['ArrowLeft','ArrowDown']:['ArrowDown'];for(const code of moving)window.game.canvas.dispatchEvent(new KeyboardEvent('keydown',{key:code,code,bubbles:true}));};
 const stop=()=>{active=false;stopMovement();for(const p of peers){p.send('steer',{x:0,y:0});p.send('exhale');}window.game.canvas.focus();};
 $('reset').onclick=()=>{stop();const q=new URLSearchParams();for(const id of ['site','count','gems','ratio','gap','stance','approach'])q.set(id,$(id).value);location.href='/corner-defense.html?'+q;};
 $('configure').onclick=()=>{stop();panel.querySelector('#setup').hidden=false;};
 $('puff').onclick=()=>{attempts++;const c=window.game.canvas;c.focus();c.dispatchEvent(new KeyboardEvent('keydown',{key:' ',code:'Space',bubbles:true}));c.dispatchEvent(new KeyboardEvent('keyup',{key:' ',code:'Space',bubbles:true}));};
 $('start').onclick=()=>{active=true;started=performance.now();panel.querySelector('#setup').hidden=true;$('start').disabled=true;$('puff').disabled=false;window.game.canvas.focus();move();};
 const timer=setInterval(async()=>{
  const m=window.game?.currentGameMode;if(!m?.multiplayerManager?.room||m.introStart===null||m.introPlaying)return;clearInterval(timer);mode=m;room=m.multiplayerManager.room;window.game.canvas.tabIndex=0;
  room.send('test:clearHoles');room.send('test:setGems',{count:gems});
  for(let i=0;i<count;i++){const p=await mode.multiplayerManager.client.joinById(room.id,{name:'Tracking hunter '+(i+1)});p.onMessage('*',()=>{});peers.push(p);}
  await new Promise(r=>setTimeout(r,200));const me=mode.multiplayerManager.getLocalPlayer(),width=me.width;let lo=0,hi=1e9;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(DefenseSizes.creatureSize(mid)<width*ratio)lo=mid+1;else hi=mid;}
  for(const p of peers)p.send('test:setGems',{count:lo});await new Promise(r=>setTimeout(r,150));
  const nx=site==='corner'?Math.SQRT1_2:1,ny=site==='corner'?Math.SQRT1_2:0,inner=700-width/2-8,x=site==='corner'?700-nx*inner:width/2+8,y=site==='corner'?700-ny*inner:2100;
  room.send('test:moveTo',{x:x-width/2,y:y-width/2});room.send('test:face',{angle:stance==='front'?Math.atan2(ny,nx):Math.atan2(nx,-ny)});
  for(const [i,p]of peers.entries()){const h=p.state.players.get(p.sessionId),a=count===1?0:(i===0?-.45:.45),hx=(approach==='rear'?ny:nx)*Math.cos(a)-(approach==='rear'?-nx:ny)*Math.sin(a),hy=(approach==='rear'?-nx:ny)*Math.cos(a)+(approach==='rear'?ny:nx)*Math.sin(a),d=(width+h.width)/2+gap;p.send('test:moveTo',{x:x+hx*d-h.width/2,y:y+hy*d-h.height/2});p.send('test:face',{angle:Math.atan2(-hy,-hx)});p.send('test:protect',{ms:0});}
  room.send('test:protect',{ms:0});room.onMessage('exhale',e=>{if(e.id===room.sessionId){accepted++;if(e.wallSlideX||e.wallSlideY)slips++;}});room.onMessage('wallSlip',e=>{if(e.id===room.sessionId)slips++;});room.onMessage('gustHit',e=>{if(e.id===room.sessionId)rears++;});
  await new Promise(r=>setTimeout(r,150));$('start').disabled=false;$('status').textContent=`Ready · width ${width} · ${count} tracker(s) · 75% breath`;
  setInterval(()=>{const p=mode.multiplayerManager.getLocalPlayer();if(!active)return;const elapsed=(performance.now()-started)/1000;
   for(const peer of peers){const h=peer.state.players.get(peer.sessionId);if(!h)continue;const dx=p.x+p.width/2-h.x-h.width/2,dy=p.y+p.height/2-h.y-h.height/2,d=Math.hypot(dx,dy)||1;peer.send('steer',{x:dx/d,y:dy/d});if(!peer.defenseEstimate)peer.defenseEstimate={was:false,rearmAt:0};const estimate=peer.defenseEstimate,now=performance.now();if(estimate.was&&!h.inhaling)estimate.rearmAt=now+750;if(!h.inhaling&&now>=estimate.rearmAt){peer.send('inhale');estimate.rearmAt=now+1000;}estimate.was=h.inhaling;peer.send('aim',{x:dx,y:dy});}
   $('status').textContent=`${p.capturedBy?'CAPTURED':elapsed>=6?'Six seconds survived':'Chasing'} ${elapsed.toFixed(1)}s · breath ${Math.round(mode.stamina*100)}% · inhalers ${peers.filter(peer=>peer.state.players.get(peer.sessionId)?.inhaling).length}/${peers.length} · taps ${attempts}, puffs ${accepted}, wall slips ${slips}, rear hits ${rears}`;
   if(p.capturedBy||p.state!=='alive'||elapsed>=6){stop();$('puff').disabled=true;}
  },100);
 },50);
});

})();
