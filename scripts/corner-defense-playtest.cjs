// Study of the current working tree: no runtime tuning mutations. Build server first, then run with Node.
const fs=require('node:fs');
const {GameState}=require('../server/dist/schema/GameState.js');
const {BlackHoleSchema}=require('../server/dist/schema/BlackHoleSchema.js');
const {creatureSize}=require('../server/dist/game/creatureSize.js');
const {arenaClearance,arenaContains}=require('../server/dist/game/arenaBoundary.js');
const {airflowQuality}=require('../server/dist/game/airflow.js');
const {exhale}=require('../server/dist/systems/inhale.js');
const {EXHALE,GAME}=require('../server/dist/constants/gameConstants.js');
const HZ=Number(process.env.CORNER_PLAYTEST_HZ)||Math.round(1000/GAME.STATE_UPDATE_RATE);
if(![30,60].includes(HZ))throw Error('Use the released 30Hz step, or 60Hz for a sensitivity comparison.');
const NOW=100000,DT=1/HZ,W=4200,SECONDS=6,CONTROL_TICKS=Math.round(.1/DT);
function stock(width){let lo=0,hi=1e9;while(lo<hi){const m=Math.floor((lo+hi)/2);if(creatureSize(m)<width)lo=m+1;else hi=m;}return lo;}
function seed(text){let n=2166136261;for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619);return()=>{n+=0x6d2b79f5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const sites=[{name:'open',n:[1,0]}, {name:'left wall',n:[1,0]}, {name:'top-left corner',n:[Math.SQRT1_2,Math.SQRT1_2]},
{name:'right wall',n:[-1,0]}, {name:'top wall',n:[0,1]}, {name:'bottom wall',n:[0,-1]},
{name:'top-right corner',n:[-Math.SQRT1_2,Math.SQRT1_2]}, {name:'bottom-left corner',n:[Math.SQRT1_2,-Math.SQRT1_2]}, {name:'bottom-right corner',n:[-Math.SQRT1_2,-Math.SQRT1_2]}];
const policies=['front-no-puff','front-one','front-retry','run-no-puff','run-one','run-retry'];
const rows=[];
function run(site,width,ratio,gap,count,policy,hole=false){
 const key=[site.name,width,ratio,gap,count,hole].join('/');Math.random=seed(key);
 const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=s.trafficOn=s.trafficHits=false;s.setTurbines('off');s.obstacles.clear();s.balls.clear();s.comets.clear();s.blackHoles.clear();s.update(0,NOW);
 const p=s.addPlayer('runner','Runner',NOW);p.setGems(stock(width),W,W);p.dropProtection();
 const [nx,ny]=site.n,t={x:-ny,y:nx};let x=2100,y=2100;
 if(site.name.includes('corner')){const inner=700-p.width/2-8;x=(nx>0?700:3500)-nx*inner;y=(ny>0?700:3500)-ny*inner;}
 else if(site.name!=='open'){if(nx)x=nx>0?p.width/2+8:W-p.width/2-8;if(ny)y=ny>0?p.width/2+8:W-p.width/2-8;}
 p.placeAt(x-p.width/2,y-p.height/2);p.facing=policy.startsWith('front')?Math.atan2(ny,nx):Math.atan2(t.y,t.x);
 if(hole)s.blackHoles.push(new BlackHoleSchema(x+nx*180+t.x*270,y+ny*180+t.y*270,72,0));
 const hunters=Array.from({length:count},(_,i)=>{const h=s.addPlayer('hunter'+i,'Tracker',NOW);h.setGems(stock(width*ratio),W,W);h.dropProtection();
 const a=count===1?0:(i===0?-.45:.45),hx=nx*Math.cos(a)-ny*Math.sin(a),hy=ny*Math.cos(a)+nx*Math.sin(a),d=(p.width+h.width)/2+gap;
 h.placeAt(x+hx*d-h.width/2,y+hy*d-h.height/2);h.facing=Math.atan2(y-h.y-h.height/2,x-h.x-h.width/2);h.startInhale(NOW);return h;});
 const defenderWidth=p.width,hunterWidths=hunters.map(h=>h.width);
 const initialGap=Math.min(...hunters.map(h=>Math.hypot(h.x+h.width/2-x,h.y+h.height/2-y)-(h.width+p.width)/2));
 const events=[],castTimes=[];let rearHits=0,wallSlips=0,frontHits=0,requests=0,capturedAt=null,pressured=0,quiet=0,minBreath=1,locked=false,boundsError=false;
 s.onEvent=(type,data)=>{if(type==='exhale'&&data.id===p.sessionId){castTimes.push((s.now-NOW)/1000);events.push({at:s.now-NOW,recoil:data.recoil,breath:data.breathLeft,wallSpeed:Math.hypot(data.wallSlideX||0,data.wallSlideY||0)});if(data.recoil>0)frontHits++;if(data.wallSlideX||data.wallSlideY)wallSlips++;}if(type==='gustHit'&&data.id===p.sessionId)rearHits++;if(type==='wallSlip'&&data.id===p.sessionId){wallSlips++;events.push({at:s.now-NOW,rear:true,wallSpeed:Math.hypot(data.wallSlideX||0,data.wallSlideY||0)});}};
 for(let tick=0;tick<SECONDS/DT;tick++){
  const now=NOW+tick*DT*1000;
  if(tick%CONTROL_TICKS===0)for(const h of hunters){const dx=p.x+p.width/2-h.x-h.width/2,dy=p.y+p.height/2-h.y-h.height/2,d=Math.hypot(dx,dy)||1;h.steer(dx/d,dy/d);if(!h.inhaling&&h.stamina>=.25)h.startInhale(now);h.aimAt(dx,dy);}
  const cx=p.x+p.width/2,cy=p.y+p.height/2;
  let sx=t.x,sy=t.y;
  if(site.name!=='open') {const gx=arenaClearance(cx+.5,cy,W,W)-arenaClearance(cx-.5,cy,W,W),gy=arenaClearance(cx,cy+.5,W,W)-arenaClearance(cx,cy-.5,W,W),d=Math.hypot(gx,gy);if(d>.001){sx=-gy/d;sy=gx/d;}}
  p.steer(sx,sy);
  if(!policy.endsWith('no-puff')&&(tick===0||policy.endsWith('retry')&&tick>0&&tick%CONTROL_TICKS===0)){requests++;exhale(s,p,now);}
  if(tick)s.update(DT,now);
  minBreath=Math.min(minBreath,p.stamina);locked ||=p.stunned||p.sliding;
  boundsError ||=!arenaContains(p,W,W);
  const pressure=hunters.some(h=>h.inhaling&&airflowQuality(s.mouthed(h),s.bodyOf(p))>0);
  if(pressure){pressured+=DT;quiet=0;}else quiet+=DT;
  if(p.capturedBy||p.state!=='alive'){capturedAt=tick*DT;break;}
 }
 const displacement=Math.hypot(p.x+p.width/2-x,p.y+p.height/2-y);
 rows.push({site:site.name,width:defenderWidth,finalWidth:p.width,requestedWidth:width,ratio:hunterWidths[0]/defenderWidth,gap,initialGap,attackers:count,policy,hole,capturedAt,alive:capturedAt===null,pressureFreeLastSecond:capturedAt===null&&quiet>=1,displacement,pressureSeconds:pressured,casts:castTimes.length,castTimes,requests,frontHits,rearHits,wallSlips,minBreath,locked,boundsError,events});
}
const random=Math.random;
try{
 for(const site of sites.slice(0,3))for(const width of [60,150,300])for(const ratio of [1,1.35,1.75,2.5])for(const gap of [30,100,240,400])for(const count of [1,2])for(const policy of policies)run(site,width,ratio,gap,count,policy);
 for(const site of sites.slice(3))for(const count of [1,2])for(const policy of policies)run(site,150,1.75,100,count,policy);
 for(const site of sites.slice(1,3))for(const width of [150,300,600])for(const count of [1,2])for(const policy of policies)run(site,width,1.75,100,count,policy,true);
}finally{Math.random=random;}
const summary=[];
for(const site of sites.slice(0,3))for(const policy of policies){const group=rows.filter(r=>r.site===site.name&&r.policy===policy&&!r.hole);summary.push({site:site.name,policy,cases:group.length,captured:group.filter(r=>!r.alive).length,pressureFree:group.filter(r=>r.pressureFreeLastSecond).length,frontHits:group.reduce((a,r)=>a+r.frontHits,0),rearHits:group.reduce((a,r)=>a+r.rearHits,0),wallSlips:group.reduce((a,r)=>a+r.wallSlips,0),maxCasts:Math.max(...group.map(r=>r.casts))});}
const report={workingTreeFeature:'confirmed rear-hit wall slip',revision:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),simulationHz:HZ,method:'Six-second deterministic scripted chases using current working-tree GameState and normal steering/aim/inhale/puff APIs. Trackers retarget every 100ms and rearm only after recovering 25% breath. Defender follows the wall tangent from the first tick. Front policies initially face the hunter; run policies initially face the escape direction. First puff at time zero is an optimistic preemptive reference, not human reaction time. Both use normal turning afterward. Retry requests every 100ms; normal server breath rules accept/reject. Open/left wall/top-left curve exhaustive, remaining boundaries rotation spots, plus soft-hole cases. No weapons, pickups or background bots. Not human fun or guaranteed escapes.',tuning:{...EXHALE},cases:rows.length,summary,rows};
fs.mkdirSync('.tmp',{recursive:true});fs.writeFileSync(`.tmp/corner-defense-playtest-${HZ}hz.json`,JSON.stringify(report,null,2));if(HZ===30)fs.writeFileSync('.tmp/corner-defense-playtest.json',JSON.stringify(report,null,2));console.log(JSON.stringify({cases:rows.length,summary,invalidBounds:rows.filter(r=>r.boundsError).length,unexpectedLocks:rows.filter(r=>r.locked).length},null,2));
