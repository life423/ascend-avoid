// Deterministic ideal-path collection controls; no opponents, no claim contest, no human timing.
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {GameState}=require('../server/dist/schema/GameState.js');
const {spawnWeapon,deployWeapon}=require('../server/dist/systems/weapons.js');
const NOW=100000,dt=1/30,rows=[];
for(const kind of ['pinwheel','pulsar','sentinel','ricochet','ion','comet'])for(const gems of [0,100,1000])for(const inhale of [false,true]) {
 const s=new GameState(0);s.botFill=0;s.fieldGemTarget=0;s.surgesOn=false;s.weaponsOn=true;s.setTurbines('off');s.update(0,NOW);
 s.weaponSets.clear();s.blackHoles.clear();s.obstacles.clear();s.comets.clear();s.bombs.clear();s.balls.clear();s.gems.clear();
 const p=s.addPlayer('collector','Collector',NOW);p.setGems(gems,4200,4200);p.spawnProtected=false;p.placeAt(2400-p.width/2,2100-p.width/2);
 spawnWeapon(s,2100,2100,kind);const w=s.pinwheel;if(inhale)p.startInhale(NOW);
 let firstPartMs=null,completedMs=null;
 for(let tick=1;tick<=900;tick++) {
  const parts=Array.from(w.parts).filter(part=>part.carriedBy!==p.sessionId);
  parts.sort((a,b)=>Math.hypot(a.x-p.x-p.width/2,a.y-p.y-p.width/2)-Math.hypot(b.x-p.x-p.width/2,b.y-p.y-p.width/2));
  const target=parts[0];if(target){const dx=target.x-p.x-p.width/2,dy=target.y-p.y-p.width/2,d=Math.hypot(dx,dy)||1;p.steer(dx/d,dy/d);p.facing=Math.atan2(dy,dx);}
  s.update(dt,NOW+tick*1000/30);
  if(firstPartMs===null&&w.owner===p.sessionId)firstPartMs=s.time;
  if(w.phase==='carried'){completedMs=s.time;break;}
 }
 assert(completedMs!==null,`${kind}/${gems}/${inhale}: must assemble through ordinary movement`);
 const before={x:p.x,y:p.y};p.steer(0,1);assert(deployWeapon(s,p),'moving actor can deploy');s.update(dt,NOW+completedMs+1000/30);
 assert(Math.hypot(p.x-before.x,p.y-before.y)>0,'placement does not stop movement');
 rows.push({kind,gems,inhale,firstPartMs:Math.round(firstPartMs),completedMs:Math.round(completedMs),afterClaimMs:Math.round(completedMs-firstPartMs),placedWhileMoving:true});
}
const result={method:'30Hz authoritative world; ideal nearest-missing-part steering; no opposition, holes, traffic or gem pickups. Timing measures mechanics only.',rows};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
