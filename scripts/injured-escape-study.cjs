// Build first. Fixed inputs in actual shared server rules; no claim of human fun or universal escape.
const fs=require('node:fs');
const {GameState}=require('../server/dist/schema/GameState.js');
const {creatureSize}=require('../server/dist/game/creatureSize.js');
const {createPracticeArena}=require('../server/dist/practice/arena.js');
const {PracticeController}=require('../server/dist/practice/PracticeController.js');
const {exhale}=require('../server/dist/systems/inhale.js');
const {INHALE}=require('../server/dist/constants/gameConstants.js');
const {DEFENSE_LESSON}=require('../server/dist/practice/definitions.js');
const NOW=100000,DT=1/30;
function stock(width){let lo=0,hi=1000000;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(creatureSize(mid)<width)lo=mid+1;else hi=mid;}return lo;}
function field(width,ratio,gap,reaction,latency,response,injured,bot=false){
  const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=s.trafficOn=s.shiftsOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,NOW);
  const a=s.addPlayer('pursuer','Pursuer',NOW),p=s.addPlayer('runner','Runner',NOW);
  a.setGems(stock(width*ratio),4200,4200);p.setGems(stock(width),4200,4200);p.isBot=bot;
  const initialWidth=p.width,initialHunter=a.width,initialGems=p.gems;
  p.placeAt(1400-p.width/2,2100-p.height/2);a.placeAt(1400-(a.width+p.width)/2-gap-a.width/2,2100-a.height/2);
  a.dropProtection();p.dropProtection();a.facing=0;if(injured)p.injure(s.time);
  let nextDecision=0,firstLoss=null,firstContact=null,outcome='vulnerable',cause='',edge=false;
  s.onEvent=(type,data)=>{if(type==='credit'&&data.targetId===p.sessionId&&data.out)cause=data.how;};
  for(let tick=1;tick<=Math.ceil(8.5/DT);tick++){
    const ms=tick*1000*DT,now=NOW+ms;
    if(ms>=nextDecision){
      nextDecision=ms+250;const dx=p.x+p.width/2-a.x-a.width/2,dy=p.y+p.height/2-a.y-a.height/2,d=Math.hypot(dx,dy)||1;
      a.aimAt(dx,dy);a.steer(dx/d,dy/d);if(!a.inhaling)a.startInhale(now);
    }
    if(ms>=reaction+latency){
      let x=1,y=0;
      if(response==='diagonal'){x=Math.SQRT1_2;y=-Math.SQRT1_2;}
      else if(response==='sidestep-then-away'){
        if(ms<reaction+latency+600){x=0;y=-1;}
        else{const dx=p.x+p.width/2-a.x-a.width/2,dy=p.y+p.height/2-a.y-a.height/2,d=Math.hypot(dx,dy)||1;x=dx/d;y=dy/d;}
      }
      const ramp=Math.min(1,(ms-reaction-latency)/200);p.steer(x*ramp,y*ramp);
    }
    s.update(DT,now);
    if(firstLoss===null&&p.gems<initialGems)firstLoss=Math.round(ms);
    if(firstContact===null&&a.lockOn.has(p.sessionId))firstContact=Math.round(ms);
    edge ||= p.x<=4||p.y<=4||p.x+p.width>=4196||p.y+p.height>=4196;
    if(p.state!=='alive'){outcome='knocked-out';break;}
    if(p.capturedBy){outcome='captured';break;}
    if(ms>=7000&&!p.breathingBlocked){outcome=injured?'recovered':'safe';break;}
  }
  return{width:initialWidth,hunterWidth:initialHunter,outcome,cause,lost:initialGems-p.gems,firstLoss,firstContact,edge};
}
function lesson(setting,reaction,latency,response){
  const {distance,decisionMs,height,learnerX}=setting;
  Object.assign(DEFENSE_LESSON,{width:height,height,learnerX,injuredGap:distance,pursuitMs:decisionMs});
  const s=createPracticeArena();let now=NOW;s.update(0,now);
  const p=s.addPlayer('learner','Learner',now),c=new PracticeController(s);s.onEvent=(type,data)=>c.observe(type,data,now);c.attach(p.sessionId,'defense',now);s.worldHeight=height;
  const step=()=>{now+=17;c.beforeTick(now);s.update(.017,now);c.afterTick(now);};
  for(let tick=0;tick<2000&&!(s.practice.stage==='injured-escape'&&s.practice.phase==='ready');tick++){
    if(s.practice.phase==='ready')c.ready(s.practice.attempt,now);p.steer(1,0);
    if(s.practice.stage==='rear-cover'&&s.practice.cue==='attacking'&&!s.gustWaves.size)exhale(s,p,now);step();
  }
  if(s.practice.stage!=='injured-escape'||s.practice.phase!=='ready')throw Error('Actual first defense exercise failed');
  const a=s.players.get(s.practice.targetId),start=now,initial=p.gems;
  a.placeAt(p.x+p.width/2-distance-a.width/2,p.y+p.height/2-a.height/2);c.ready(s.practice.attempt,now);
  let edge=false;
  while(now-start<12000&&!s.practice.failures&&s.practice.phase!=='complete'){
    const elapsed=now-start-reaction-latency;
    if(elapsed>=0){
      let x=1,y=0;if(response==='diagonal'){x=Math.SQRT1_2;y=-Math.SQRT1_2;}else if(response==='sideways'){x=0;y=-1;}else if(response==='toward'){x=-1;y=0;}
      const ramp=Math.min(1,elapsed/200);p.steer(x*ramp,y*ramp);p.aimAt(x,y);
    }else p.steer(0,0);
    step();edge ||= p.x<=4||p.y<=4||p.x+p.width>=s.worldWidth-4||p.y+p.height>=s.worldHeight-4;
  }
  return{outcome:s.practice.phase==='complete'?'recovered':s.practice.failures?'knocked-out':'vulnerable',lost:initial-p.gems,elapsed:now-start,edge};
}
const rows=[];
const keepOriginal=INHALE.RETREAT_SPEED_KEEP;
for(const keep of[0,.25,.5,.75]) {
INHALE.RETREAT_SPEED_KEEP=keep;
for(const width of[40,100,200,300])for(const ratio of[.75,1,1.1,1.33,1.6,2])for(const gap of[60,180,360])
  for(const reaction of[0,350,700])for(const latency of[0,150])for(const response of['away','diagonal','sidestep-then-away'])for(const injured of[false,true]){
    const human=field(width,ratio,gap,reaction,latency,response,injured),bot=field(width,ratio,gap,reaction,latency,response,injured,true);
    if(JSON.stringify(human)!==JSON.stringify(bot))throw Error('Actor physics mismatch');
    rows.push({keep,ratio,gap,reaction,latency,response,injured,...human,parity:true});
  }
}
const lessons=[];
const definitionOriginal={...DEFENSE_LESSON};
for(const keep of[0,.25,.5,.75]) {
INHALE.RETREAT_SPEED_KEEP=keep;
for(const setting of[{name:'baseline',distance:480,decisionMs:0,height:2400,learnerX:660},{name:'gap-560',distance:560,decisionMs:0,height:2400,learnerX:660},
  {name:'gap-600',distance:600,decisionMs:0,height:2400,learnerX:900},{name:'gap-600-space',distance:600,decisionMs:0,height:4200,learnerX:900},
  {name:'gap-600-human-cadence',distance:600,decisionMs:250,height:4200,learnerX:900}])
  for(const reaction of[0,350,700,1000,1250])for(const latency of[0,150])for(const response of['away','diagonal','sideways','toward'])
    lessons.push({keep,...setting,reaction,latency,response,...lesson(setting,reaction,latency,response)});
}
INHALE.RETREAT_SPEED_KEEP=keepOriginal;
Object.assign(DEFENSE_LESSON,definitionOriginal);
const summarize=group=>({cases:group.length,recovered:group.filter(r=>['safe','recovered'].includes(r.outcome)).length,knockedOut:group.filter(r=>r.outcome==='knocked-out').length,captured:group.filter(r=>r.outcome==='captured').length,vulnerable:group.filter(r=>r.outcome==='vulnerable').length,edges:group.filter(r=>r.edge).length});
const summary={field:[0,.25,.5,.75].flatMap(keep=>[false,true].map(injured=>({keep,injured,...summarize(rows.filter(r=>r.keep===keep&&r.injured===injured))}))),lessons:[0,.25,.5,.75].flatMap(keep=>[...new Set(lessons.map(r=>r.name))].map(name=>({keep,name,...Object.fromEntries(['away','diagonal','sideways','toward'].map(direction=>[direction,summarize(lessons.filter(r=>r.keep===keep&&r.name===name&&r.response===direction))]))})))};
const result={date:'2026-11-01',scope:'Actual shared simulation with fixed scripted inputs, 250ms pursuer decisions, 200ms analog ramp, stated reaction/latency, isolated encounters without field pickups or extra attackers. Healthy controls use capture, injured controls use real injury/theft/finish. keep=0 reproduces original pull; positive settings preserve that fraction of a faster deliberate radial retreat advantage outside the strong zone. No speed/injury/damage/finish changes. Tutorial comparisons play the real preceding puff exercise and vary scenario distance/space/decision cadence. Not proof of human fun or universal escape fairness.',executions:rows.length*2+lessons.length,summary,rows,lessons};
fs.writeFileSync('docs/playtests/injured-escape-2026-11-01.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({executions:result.executions,summary},null,2));
