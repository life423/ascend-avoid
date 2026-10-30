/* Actual, ordinary bot inputs in the 30 Hz authoritative world. No bot-only movement or combat rules.
 * Run after build: node scripts/bot-size-study.cjs [report-name] */
const fs = require('node:fs');
const path = require('node:path');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { turnStep, turnRate } = require('../server/dist/game/movement.js');
const { BOTS } = require('../server/dist/constants/gameConstants.js');
const { botSuctionThreat } = require('../server/dist/game/botTargets.js');

// Offline comparison only; no client commands or running-server tuning.
if (process.argv.includes('--baseline-body-pull')) {
  const { INHALE } = require('../server/dist/constants/gameConstants.js');
  INHALE.PEER_BODY_PULL = 1;
  require('../server/dist/game/airflow.js').innerBodyPullBoost = (attacker, target) => attacker >= target * INHALE.EAT_RATIO ? 1 : 0;
}

const pairs = [[80,100],[100,130],[100,150],[200,300],[400,600],[200,800],[500,1000]];
const gaps = [20,100,300];
const angles = [{name:'front',value:0},{name:'side',value:Math.PI/2},{name:'rear',value:Math.PI}];
const reportName = String(process.argv[2] || 'bot-size-study').replace(/[^a-zA-Z0-9_-]/g,'');
const originalRandom = Math.random;
function stock(width) {
  let lo=0,hi=1_000_000;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(creatureSize(mid)<width)lo=mid+1;else hi=mid;}
  return lo;
}
function centre(p){return {x:p.x+p.width/2,y:p.y+p.height/2};}
function gap(a,b){const x=centre(a),y=centre(b);return Math.hypot(x.x-y.x,x.y-y.y)-(a.width+b.width)/2;}
function run(smallWidth,largeWidth,initialGap,angle,injured,seed) {
  let rng=seed; Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296;};
  let now=1e9;
  const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.trafficOn=s.surgesOn=s.weaponsOn=s.shiftsOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,now);
  const small=s.addPlayer('small','Small',now),large=s.addPlayer('large','Large',now);
  small.setGems(stock(smallWidth),4200,4200);large.setGems(stock(largeWidth),4200,4200);
  large.placeAt(1900-large.width/2,2100-large.height/2);
  small.placeAt(1900+(small.width+large.width)/2+initialGap-small.width/2,2100-small.height/2);
  small.facing=Math.PI;large.facing=angle.value;
  for(const p of [small,large]){p.dropProtection();p.isBot=true;const brain=new BotBrain();brain.nextThinkAt=now+BOTS.THINK_MS_MIN+Math.random()*(BOTS.THINK_MS_MAX-BOTS.THINK_MS_MIN);s.brains.set(p.sessionId,brain);}
  if(injured)large.injure(s.time);
  const events=[];let capturedAt=null,stolen=0,puffs=0,parries=0,threatSeconds=0,towardSeconds=0,awaySeconds=0,sideSeconds=0,largeInhaleSeconds=0;
  let firstDecision=null,firstThreatAt=null,firstPuffAt=null,firstTheftAt=null,firstInhaleAt=null;
  s.onEvent=(type,d)=>{
    if(type==='capture'&&d.targetId===small.sessionId)capturedAt??=(now-1e9)/1000;
    if(type==='exhale'&&d.id===small.sessionId){puffs++;firstPuffAt??=(now-1e9)/1000;}
    if(type==='parry'&&d.id===small.sessionId)parries++;
    if(type==='credit'&&d.byId===small.sessionId&&d.targetId===large.sessionId&&(d.how==='stole'||d.how==='mouth')){stolen+=d.gems;firstTheftAt??=(now-1e9)/1000;}
    if(type==='capture'||type==='exhale'||type==='parry'||type==='credit')events.push({seconds:+((now-1e9)/1000).toFixed(3),type,...d});
  };
  let duration=0;
  for(let tick=0;tick<360;tick++){
    now+=1000/30;s.update(1/30,now);duration=(now-1e9)/1000;
    const a=centre(small),b=centre(large),dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy)||1,v=small.steering();
    if(firstDecision===null&&Math.hypot(v.x,v.y)>.1)firstDecision=(v.x*dx+v.y*dy)/d>.25?'retreat':(v.x*dx+v.y*dy)/d<-.25?'approach':'sideways';
    if(botSuctionThreat(s,small,now)){threatSeconds+=1/30;firstThreatAt??=duration;}
    if(small.inhaling)firstInhaleAt??=duration;
    const radial=(v.x*dx+v.y*dy)/d,lateral=Math.abs(v.x*dy-v.y*dx)/d;
    if(radial>.25)awaySeconds+=1/30;else if(radial<-.25)towardSeconds+=1/30;
    if(lateral>.6)sideSeconds+=1/30;
    if(large.inhaling)largeInhaleSeconds+=1/30;
    if(capturedAt!==null||small.state!=='alive'||large.state!=='alive')break;
  }
  return {smallWidth,largeWidth,ratio:largeWidth/smallWidth,initialGap,side:angle.name,initialLargeState:injured?'injured':'healthy',seed,
    captured:capturedAt!==null,capturedAt,smallOut:small.state!=='alive',largeOut:large.state!=='alive',duration:+duration.toFixed(2),
    firstDecision,firstThreatAt,firstPuffAt,firstTheftAt,firstInhaleAt,stolen,puffs,parries,
    threatSeconds:+threatSeconds.toFixed(2),towardSeconds:+towardSeconds.toFixed(2),awaySeconds:+awaySeconds.toFixed(2),sideSeconds:+sideSeconds.toFixed(2),largeInhaleSeconds:+largeInhaleSeconds.toFixed(2),
    finalGap:+gap(small,large).toFixed(1),events};
}
function summarize(cases) {
  const firsts=cases.map(c=>c.capturedAt).filter(t=>t!==null).sort((a,b)=>a-b);
  return {cases:cases.length,captured:cases.filter(c=>c.captured).length,capturedUnderHalfSecond:cases.filter(c=>c.capturedAt!==null&&c.capturedAt<.5).length,
    capturedBeforeFirstMovement:cases.filter(c=>c.captured&&c.firstDecision===null).length,
    captureMedianSeconds:firsts.length?+(firsts[Math.floor(firsts.length/2)]).toFixed(2):null,
    initiallyRetreat:cases.filter(c=>c.firstDecision==='retreat').length,initiallyApproach:cases.filter(c=>c.firstDecision==='approach').length,
    usedPuff:cases.filter(c=>c.puffs>0).length,parried:cases.filter(c=>c.parries>0).length,
    theftOrFinishCredit:cases.filter(c=>c.stolen>0).length,largerKnockedOut:cases.filter(c=>c.largeOut).length,
    endedClear:cases.filter(c=>!c.captured&&!c.smallOut&&!c.largeOut&&c.finalGap>=c.initialGap+100).length};
}
function turnTime(width,inhaling,angle) {
  let facing=0,spin=0;
  for(let tick=1;tick<=1800;tick++){
    ({facing,spin}=turnStep(facing,spin,angle,width,inhaling,1/120));
    if(Math.abs(Math.atan2(Math.sin(angle-facing),Math.cos(angle-facing)))<.01)return +(tick/120).toFixed(3);
  }
  return null;
}
try {
  const dir=path.join('.tmp','bot-size-study',reportName);
  // Recount stored encounter events without rerunning a historical AI revision.
  const cases=process.argv.includes('--recount')?JSON.parse(fs.readFileSync(path.join(dir,'encounters.json'),'utf8')):[];
  if(!process.argv.includes('--recount'))for(const [a,b] of pairs)for(const spacing of gaps)for(const angle of angles)for(const injured of [false,true])for(let seed=1;seed<=5;seed++)cases.push(run(a,b,spacing,angle,injured,20191+seed*73));
  for(const c of cases){
    const receipts=c.events.filter(e=>e.type==='credit'&&e.byId==='small'&&e.targetId==='large'&&(e.how==='stole'||e.how==='mouth'));
    c.stolen=receipts.reduce((sum,e)=>sum+e.gems,0);c.firstTheftAt=receipts[0]?.seconds??null;
  }
  const groups=pairs.flatMap(([a,b])=>gaps.flatMap(spacing=>[false,true].map(injured=>({smallWidth:a,largeWidth:b,gap:spacing,state:injured?'injured':'healthy',...summarize(cases.filter(c=>c.smallWidth===a&&c.largeWidth===b&&c.initialGap===spacing&&c.initialLargeState===(injured?'injured':'healthy')))}))));
  const turning=[80,100,200,400,600,800,1000].map(width=>({width,turnCapDegreesPerSecond:+(turnRate(width,true)*180/Math.PI).toFixed(1),inhale90Seconds:turnTime(width,true,Math.PI/2),inhale180Seconds:turnTime(width,true,Math.PI),normal180Seconds:turnTime(width,false,Math.PI)}));
  const report={createdAt:new Date().toISOString(),method:'630 seeded encounters in the authoritative 30 Hz world, seven physical size pairs × three body-edge gaps × front/side/rear orientation × healthy/injured larger opponent × five seeds. Both are ordinary bot brains with their usual delayed decisions, imperfect defense, movement, breath and turning. Neither starts with a captive or assembled weapon; no ambient gems or hazards. Stop at first small-player capture, either knockout or 12 seconds. Injury heals normally, after seven seconds. A separate shared-turnStep measurement isolates 90/180-degree turns; no bot-specific turn changes.',
    healthy:summarize(cases.filter(c=>c.initialLargeState==='healthy')),injured:summarize(cases.filter(c=>c.initialLargeState==='injured')),turning,groups};
  fs.mkdirSync(dir,{recursive:true});fs.mkdirSync('reports/combat',{recursive:true});
  fs.writeFileSync(path.join(dir,'encounters.json'),JSON.stringify(cases,null,2));
  fs.writeFileSync(path.join('reports','combat',reportName+'.json'),JSON.stringify(report,null,2));
  const lines=['# Smaller bots around larger bots','',report.method,'','These are behavioral observations, not a human fairness or fun score. Capture ends the measured encounter; it is not a knockout. Injured means initially injured, not permanently unable to breathe. Theft/finish counts are emitted credits, so ongoing transfers without an end event are not counted. Finished clear means both are alive and body separation grew by at least 100 units.','','| Small / large width | Body gap | Larger starts | Captured / 15 | First move retreats | First move approaches | Puffed | Theft/finish credit | Finished clear |','|---|---|---|---:|---:|---:|---:|---:|---:|',
    ...groups.map(g=>`| ${g.smallWidth} / ${g.largeWidth} | ${g.gap} | ${g.state} | ${g.captured} | ${g.initiallyRetreat} | ${g.initiallyApproach} | ${g.usedPuff} | ${g.theftOrFinishCredit} | ${g.endedClear} |`),'','## Shared turning, while inhaling','','| Body width | Maximum degrees/s | 90-degree turn | 180-degree turn |','|---|---:|---:|---:|',...turning.map(t=>`| ${t.width} | ${t.turnCapDegreesPerSecond} | ${t.inhale90Seconds}s | ${t.inhale180Seconds}s |`),'','```json',JSON.stringify({healthy:report.healthy,injured:report.injured},null,2),'```',''];
  fs.writeFileSync(path.join('reports','combat',reportName+'.md'),lines.join('\n'));
  console.log(JSON.stringify({healthy:report.healthy,injured:report.injured,turning},null,2));
} finally {Math.random=originalRandom;}
