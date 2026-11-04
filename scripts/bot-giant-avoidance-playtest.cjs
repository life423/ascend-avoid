// Reproducible local AI comparison; no runtime tuning mutations or production hooks.
const fs=require('node:fs');
const {GameState}=require('../server/dist/schema/GameState.js');
const {BotBrain}=require('../server/dist/game/bots.js');
const {GemSchema}=require('../server/dist/schema/GemSchema.js');
const {creatureSize}=require('../server/dist/game/creatureSize.js');
const {arenaContains}=require('../server/dist/game/arenaBoundary.js');
const {BOTS,INHALE,ARENA_RULES,EXHALE}=require('../server/dist/constants/gameConstants.js');
function stock(w){let lo=0,hi=1e8;while(lo<hi){const m=Math.floor((lo+hi)/2);if(creatureSize(m)<w)lo=m+1;else hi=m;}return lo;}
function seeded(n){return()=>{n+=0x6d2b79f5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};}
const rows=[],originalRandom=Math.random,NOW=100000,DT=1/30;
try{for(const width of [300,600,1000])for(const small of [20,60,150])for(const facing of [0,Math.PI/2,Math.PI,3*Math.PI/2])for(let seed=1;seed<=8;seed++){
 Math.random=seeded(seed);const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=s.trafficOn=s.trafficHits=false;s.setTurbines('off');s.update(0,NOW);s.blackHoles.clear();s.obstacles.clear();s.balls.clear();s.comets.clear();
 const giant=s.addPlayer('giant','Giant',NOW),bot=s.addPlayer('runner','Runner',NOW);giant.setGems(stock(width),4200,4200);bot.setGems(stock(small),4200,4200);bot.isBot=true;
 const fx=Math.cos(facing),fy=Math.sin(facing),reach=INHALE.REACH+giant.width*INHALE.REACH_PER_SIZE,d=giant.width*.3+reach*.85+bot.width/2;
 const gx=2100-fx*d/2,gy=2100-fy*d/2,bx=2100+fx*d/2,by=2100+fy*d/2;
 giant.placeAt(gx-giant.width/2,gy-giant.height/2);bot.placeAt(bx-bot.width/2,by-bot.height/2);giant.facing=facing;bot.facing=facing+Math.PI;giant.dropProtection();bot.dropProtection();
 const brain=new BotBrain();s.brains.set(bot.sessionId,brain);s.botFill=2;
 s.gems.set('bait',new GemSchema(bx-fx*500,by-fy*500));
 let earlyRetreat=false,capturedAt=null,bounds=true,afterCalmGap=null,decisions=0,lastThink=0;
 for(let tick=1;tick<=180;tick++){
  const now=NOW+tick*1000/30;
  if(tick===91)giant.startInhale(now);
  if(tick>90){const dx=bot.x+bot.width/2-giant.x-giant.width/2,dy=bot.y+bot.height/2-giant.y-giant.height/2,l=Math.hypot(dx,dy)||1;giant.aimAt(dx,dy);giant.steer(dx/l,dy/l);}
  s.update(DT,now);bounds&&=arenaContains(bot,4200,4200)&&arenaContains(giant,4200,4200);
  if(brain.nextThinkAt!==lastThink){decisions++;lastThink=brain.nextThinkAt;}
  if(tick<=30){const move=bot.steering();earlyRetreat ||=move.x*fx+move.y*fy>.5;}
  const gap=Math.hypot(bot.x+bot.width/2-giant.x-giant.width/2,bot.y+bot.height/2-giant.y-giant.height/2)-(bot.width+giant.width)/2;
  if(tick===90)afterCalmGap=gap;
  if(bot.capturedBy){capturedAt=tick/30;break;}
 }
 rows.push({width,small,facing,seed,earlyRetreat,afterCalmGap,capturedAt,bounds,decisions});
}}finally{Math.random=originalRandom;}
const summary={cases:rows.length,earlyRetreats:rows.filter(r=>r.earlyRetreat).length,captured:rows.filter(r=>r.capturedAt!==null).length,boundaryViolations:rows.filter(r=>!r.bounds).length,meanGapBeforeInhale:rows.reduce((n,r)=>n+(r.afterCalmGap??0),0)/rows.length};
const name=process.argv[2]||'candidate';if(!/^[a-z-]+$/.test(name))throw Error('use a simple report label');
fs.mkdirSync('.tmp',{recursive:true});fs.writeFileSync(`.tmp/bot-giant-avoidance-${name}.json`,JSON.stringify({label:name,method:'288 seeded real-GameState scenarios: stationary healthy giant faces smaller bot for3s, then ordinary 3s aimed inhale pursuit. A gem500units toward the giant competes for attention. Actual bot AI, random mistakes, normal turning, movement, puff, breath and capture. Cardinal orientations and real legal sizes. Not human balance.',tuning:{BOTS,INHALE,ARENA_RULES,EXHALE},summary,rows},null,2));console.log(JSON.stringify(summary,null,2));
