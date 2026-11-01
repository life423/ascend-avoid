// First-shot geometry is independent of the post-hit damage floor. These shots may miss.
const fs=require('node:fs'),assert=require('node:assert/strict');
const {GameState}=require('../server/dist/schema/GameState.js');
const {creatureSize}=require('../server/dist/game/creatureSize.js');
const {viewShort}=require('../server/dist/game/camera.js');
const {updateInhales,fireCaptive}=require('../server/dist/systems/inhale.js');
const {firstImpact}=require('../server/dist/game/incomingShot.js');
function stock(w){let l=0,h=1000000;while(l<h){const m=Math.floor((l+h)/2);if(creatureSize(m)<w)l=m+1;else h=m;}return l;}
function shot(width,ratio,gap,response,error){
 const now=1000000,s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,now);
 const a=s.addPlayer('a','Shooter',now),p=s.addPlayer('p','Defender',now),ammo=s.addPlayer('ammo','Ammo',now);
 a.setGems(stock(width*ratio),4200,4200);p.setGems(stock(width),4200,4200);ammo.setGems(stock(40),4200,4200);
 for(const o of[a,p,ammo])o.dropProtection();a.placeAt(700,2100-a.width/2);a.facing=0;p.placeAt(3800,3800);
 ammo.placeAt(a.x+a.width*.8+1-ammo.width/2,a.y+(a.width-ammo.width)/2);a.startInhale(now);updateInhales(s,now,.001);assert.equal(a.gulping,ammo.sessionId);
 a.stopInhale(now);a.captureNeedsRelease=false;p.placeAt(a.x+a.width+gap,2100-p.width/2);a.facing=error*Math.PI/180;assert(fireCaptive(s,a,now));assert.equal(ammo.width,60);
 let seen=null,hit=null;
 s.onEvent=(type,d)=>{if(type==='impact'&&d.targetId==='p')hit={time:s.time,out:d.out,gems:d.gems};};
 for(let i=1;i<=90&&!hit;i++){
  const c={x:p.x+p.width/2,y:p.y+p.width/2},x=ammo.x+ammo.width/2,y=ammo.y+ammo.width/2,sight=viewShort(p.width)/2;
  const v=p.velocity();
  const visible=Math.abs(x-c.x)<=sight+30&&Math.abs(y-c.y)<=sight*915/412+30;
  const warning=ammo.flying&&firstImpact({...c,vx:v.x,vy:v.y,radius:p.width/2},[{id:'shot',x,y,vx:ammo.flightVx,vy:ammo.flightVy,radius:30,visible:false}],.5);
  if(seen===null&&ammo.flying&&(visible||warning))seen=s.time;
  if(response!=='idle'&&seen!==null&&s.time>=seen+300){const sign=response==='weave300ms'&&Math.floor((s.time-seen)/600)%2?-1:1;p.steer(0,sign);}
  s.update(1/30,now+i*1000/30);
 }
 return{targetWidth:p.width,initialWidth:width,shooterWidth:a.width,ratio,gap,response,aimErrorDegrees:error,noticedMs:seen,hit};
}
const rows=[];for(const width of[100,200,400,650,900])for(const ratio of[.75,1])for(const gap of[100,350,800])for(const response of['idle','side300ms','weave300ms'])for(const error of[-8,-4,0,4,8])rows.push(shot(width,ratio,gap,response,error));
const summary=[];for(const width of[100,200,400,650,900])for(const response of['idle','side300ms','weave300ms']){const g=rows.filter(r=>r.initialWidth===width&&r.response===response);summary.push({width,response,shots:g.length,hits:g.filter(r=>r.hit).length});}
fs.writeFileSync('docs/playtests/rival-shot-accuracy-2026-11-01.json',JSON.stringify({date:'2026-11-01',method:'450 real captured/fired standard60-unit missiles; target physical widths100/200/400/650/900, shooter ratios.75/1, gaps100/350/800, aim offsets-8/-4/0/4/8deg, idle or sideways/weave after300ms notice. Notice approximates portrait camera or existing0.5s incoming warning. Real collision/movement/flight drag, no forced opening hit or spare ammunition. Controlled stationary aim origin and synthetic defenses, not human hit rates. First-hit geometry is unchanged by damage; larger bodies are deliberately NOT normalized to equal hit probability.',summary,rows},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
