// Reproducible mechanical controls; controllers are scripted, never evidence of human fun/balance.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {GameState}=require('../server/dist/schema/GameState.js');
const {spawnWeapon,updateWeapons,deployWeapon}=require('../server/dist/systems/weapons.js');
const {weaponKinds,weaponProfile}=require('../server/dist/game/weaponKit.js');
const NOW=1000000,DT=1/30;
function empty(){const s=new GameState(0);s.botFill=0;s.fieldGemTarget=0;s.weaponsOn=true;s.surgesOn=false;s.setTurbines('off');s.update(0,NOW);s.weaponSets.clear();for(const k of ['blackHoles','obstacles','comets','balls','bombs','gems'])s[k].clear();return s;}
function add(s,id,gems,x,y){const p=s.addPlayer(id,id,NOW);p.setGems(gems,4200,4200);p.placeAt(x-p.width/2,y-p.height/2);p.spawnProtected=false;return p;}
function seeded(seed,run){const random=Math.random;let n=seed>>>0;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};try{return run();}finally{Math.random=random;}}
function usefulness(kind,gems,response,lane=null){return seeded(11,()=>{
 const s=empty(),builder=add(s,'builder',100,2100,2100),target=add(s,'target',gems,3000,2100);
 spawnWeapon(s,2100,2100,kind);const w=s.pinwheel;
 for(const part of [...w.parts]){builder.placeAt(part.x-builder.width/2,part.y-builder.height/2);updateWeapons(s,.01,NOW);}
 assert.equal(w.phase,'carried');builder.placeAt(2100-builder.width/2,2100-builder.height/2);builder.facing=0;assert(deployWeapon(s,builder));
 target.placeAt((lane?.x??w.x+250)-target.width/2,(lane?.y??w.y)-target.height/2);
 let firstHitMs=null,hits=0,damage=0,earned=0,knockouts=0,directHits=0,grazes=0;const start=s.time;
 s.onEvent=(type,d)=>{if(type==='credit'&&d.targetId===target.sessionId&&d.how===kind){hits++;damage+=d.gems||0;earned+=d.earned||0;knockouts+=d.out?1:0;if(d.glancing)grazes++;else directHits++;if(firstHitMs===null)firstHitMs=s.time-start;}};
 let maxBolts=0;
 for(let tick=1;tick<=Math.ceil((weaponProfile(kind).activeMs+2000)/1000/DT);tick++){
  const time=tick*1000/30;
  if(target.state==='alive'){
   if(response==='early-retreat'||(response==='reactive-retreat'&&firstHitMs!==null&&time>=firstHitMs+300)) {const dx=target.x+target.width/2-w.x,dy=target.y+target.height/2-w.y,d=Math.hypot(dx,dy)||1;target.steer(dx/d,dy/d);}
   else if(response==='crossing')target.steer(0,1);else target.steer(0,0);
  }
  s.update(DT,NOW+time);maxBolts=Math.max(maxBolts,w.bolts.size);if(knockouts)break;
 }
 assert.equal(damage,earned,'actual damage is credited and paid once to the builder');assert.equal(builder.weaponDamage,damage);assert.equal(builder.weaponKnockouts,knockouts);
 return {kind,gems,response,placement:lane?.sample?'seeded-placement':lane?'arena-lane':'near-build',lane,hits,directHits,grazes,damage,earned,knockouts,firstHitMs:firstHitMs===null?null:Math.round(firstHitMs),maxBolts};
});}
function race(kind,lateMs,reverse){return seeded(11,()=>{
 const s=empty(),a=add(s,'a',100,2400,2100),b=add(s,'b',100,2400,2100);spawnWeapon(s,2100,2100,kind);const w=s.pinwheel;
 if(reverse){s.players.delete('a');s.players.set('a',a);}let claimedAt=null,finishedAt=null,claimant='';
 for(let tick=1;tick<=600;tick++){
  const time=tick*1000/30;
  for(const p of [a,b]){
   if(p===b&&time<lateMs){p.steer(0,0);continue;}
   if(w.owner&&w.owner!==p.sessionId){p.steer(0,0);continue;}
   const parts=Array.from(w.parts).filter(part=>part.carriedBy!==p.sessionId);parts.sort((l,r)=>Math.hypot(l.x-p.x-p.width/2,l.y-p.y-p.width/2)-Math.hypot(r.x-p.x-p.width/2,r.y-p.y-p.width/2));
   const goal=parts[0];if(goal){const dx=goal.x-p.x-p.width/2,dy=goal.y-p.y-p.width/2,d=Math.hypot(dx,dy)||1;p.steer(dx/d,dy/d);p.facing=Math.atan2(dy,dx);}
  }
  s.update(DT,NOW+time);
  if(w.owner&&!claimant){claimant=w.owner;claimedAt=s.time;}
  if(w.phase==='carried'){finishedAt=s.time;break;}
 }
 assert(finishedAt!==null,kind+' contested race can finish');assert.equal(w.owner,claimant,'standing on reserved parts cannot take ownership');
 const winner=s.players.get(w.owner);winner.steer(0,1);const y=winner.y;assert(deployWeapon(s,winner));s.update(DT,NOW+finishedAt+1000/30);assert(winner.y>y,'moving placement retains input');
 return {kind,lateMs,reverseInsertion:reverse,claimant,claimMs:Math.round(claimedAt),finishMs:Math.round(finishedAt),placedWhileMoving:true};
});}
const races=[],utility=[];
for(const kind of weaponKinds){for(const delay of [0,150])for(const reverse of [false,true])races.push(race(kind,delay,reverse));for(const gems of [100,4000])for(const response of ['idle','early-retreat','reactive-retreat','crossing'])utility.push(usefulness(kind,gems,response));}
for(const kind of weaponKinds)for(const x of [1300,2100,2900])for(const y of [1300,2100,2900])if(x!==2100||y!==2100)utility.push(usefulness(kind,100,'idle',{x,y}));
let pointSeed=17;const randomPoint=()=>{pointSeed=(Math.imul(pointSeed,1664525)+1013904223)>>>0;return 700+pointSeed/4294967296*2800;};
const points=Array.from({length:48},()=>({x:Math.round(randomPoint()),y:Math.round(randomPoint()),sample:true}));
for(const kind of weaponKinds)for(const point of points)utility.push(usefulness(kind,100,'idle',point));
const report={method:'30Hz authoritative world, seed11. Claim races have two scripted controllers and ordinary movement/pickup. Utility begins after real collection/deployment; one stationary builder and one scripted target, no incoming attacks, loose gems, holes or traffic. Only actual weapon credits count. Seed17 also supplies 48 shared stationary target positions inside the central 2800-unit square for spatial coverage controls. No human outcomes or comparative weapon rankings are inferred.',races,utility};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2));console.log(JSON.stringify(report));
