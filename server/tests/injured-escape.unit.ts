import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { retreatPull } from '../game/airflow.js';
import { moveSpeed } from '../game/movement.js';
import { creatureSize } from '../game/creatureSize.js';
import { BotBrain } from '../game/bots.js';
import { createPracticeArena } from '../practice/arena.js';
import { PracticeController } from '../practice/PracticeController.js';
import { exhale } from '../systems/inhale.js';

const NOW=100000;
function stock(width: number): number {
  let lo=0,hi=1000000;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(creatureSize(mid)<width)lo=mid+1;else hi=mid;}
  return lo;
}
for(const intent of [-1,0,.5])assert.equal(retreatPull(100,134,100,250,400,intent),100,'stationary, inward or insufficient analog retreat grants no benefit');
assert.equal(retreatPull(100,100,134,250,400,1),100,'a slower runner cannot claim a faster retreat');
assert.equal(retreatPull(100,134,100,100,400,1),100,'the entire strong mouth zone retains its existing force');
assert.equal(retreatPull(100,100,100,250,400,1),100,'equal sizes remain continuous');
assert(Math.abs(retreatPull(100,100.0001,100,250,400,1)-100)<.001,'a tiny size advantage cannot abruptly cancel suction');
const thumbThreshold=moveSpeed(134)/moveSpeed(100);
assert(Math.abs(retreatPull(100,134,100,250,400,thumbThreshold+1e-6)-100)<.001,'crossing the analog speed threshold cannot abruptly cancel suction');
const margin=moveSpeed(100)-moveSpeed(134);
assert(retreatPull(100,134,100,250,400,1)<=margin*.5+1e-8,'a full faster retreat preserves half its radial speed margin in the outer zone');

function encounter(width: number,hunterWidth: number,gap: number,reaction: number,bot=false,idle=false) {
  const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=s.trafficOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,NOW);
  const a=s.addPlayer('hunter','Hunter',NOW),p=s.addPlayer('runner','Runner',NOW);
  a.setGems(stock(hunterWidth),4200,4200);p.setGems(stock(width),4200,4200);p.isBot=bot;
  a.placeAt(1400-(a.width+p.width)/2-gap-a.width/2,2100-a.height/2);p.placeAt(1400-p.width/2,2100-p.height/2);
  a.dropProtection();p.dropProtection();p.injure(s.time);a.facing=0;
  let next=0,elapsed=0;
  for(let tick=1;tick<=255;tick++) {
    elapsed=tick*1000/30;
    if(elapsed>=next){next=elapsed+250;const dx=p.x+p.width/2-a.x-a.width/2,dy=p.y+p.height/2-a.y-a.height/2,d=Math.hypot(dx,dy)||1;a.aimAt(dx,dy);a.steer(dx/d,dy/d);if(!a.inhaling)a.startInhale(NOW+elapsed);}
    if(!idle&&elapsed>=reaction){const amount=Math.min(1,(elapsed-reaction)/200);p.steer(amount,0);}
    s.update(1/30,NOW+elapsed);
    if(p.state!=='alive'||elapsed>=7000&&!p.breathingBlocked)break;
  }
  return {s,a,p,elapsed};
}
for(const bot of [false,true]) {
  const open=encounter(100,133,360,350,bot);
  assert.equal(open.p.state,'alive');assert(!open.p.breathingBlocked,'a prompt retreat can recover in open space');
  const close=encounter(200,400,20,250,bot);
  assert.equal(close.p.state,'dead','late movement from a much larger mouth remains punishable');
  assert(close.elapsed<300);
  const idle=encounter(100,133,180,0,bot,true);
  assert.equal(idle.p.state,'dead','standing in the inhale is not protected by the escape rule');
}
{
  const {s,a,p}=encounter(100,133,360,350);
  a.placeAt(1500-a.width/2,2100-a.height/2);p.placeAt(1780-p.width/2,2100-p.height/2);
  p.injure(s.time);a.dropProtection();a.facing=0;a.startInhale(s.now);
  const random=Math.random;Math.random=()=>.5;
  try{const brain=new BotBrain();assert.equal(brain.think(p,s,s.now),'right','a faster injured bot deliberately flees away instead of choosing only a sideways crossing');}
  finally{Math.random=random;}
}

for(const reaction of [700,1400]) {
  const s=createPracticeArena();let now=NOW;s.update(0,now);
  const p=s.addPlayer('learner','Learner',now),c=new PracticeController(s);s.onEvent=(type,data)=>c.observe(type,data,now);c.attach(p.sessionId,'defense',now);
  const step=()=>{now+=17;c.beforeTick(now);s.update(.017,now);c.afterTick(now);};
  for(let tick=0;tick<1500&&!(s.practice.stage==='injured-escape'&&s.practice.phase==='ready');tick++) {
    if(s.practice.phase==='ready')c.ready(s.practice.attempt,now);p.steer(1,0);
    if(s.practice.stage==='rear-cover'&&s.practice.cue==='attacking'&&!s.gustWaves.size)exhale(s,p,now);step();
  }
  assert.equal(s.practice.stage,'injured-escape');assert.equal(s.practice.phase,'ready');
  const target=s.players.get(s.practice.targetId);assert(target);
  assert(target.x>=0&&target.y>=0&&p.x+p.width<=s.worldWidth&&p.y+p.height<=s.worldHeight,'prepared bodies are fully inside the arena');
  const start=now;c.ready(s.practice.attempt,now);
  const complete=()=>s.practice.phase==='complete';
  while(now-start<12000&&!complete()&&!s.practice.failures) {
    const elapsed=now-start-reaction;p.steer(elapsed>0?Math.min(1,elapsed/200):0,0);step();
  }
  assert.equal(s.practice.phase,'complete',`a ${reaction}ms preparation/reaction delay with an analog ramp can recover`);
  assert.equal(s.practice.failures,0);assert(!p.breathingBlocked);
}
console.log('Injured escape passed: smooth outer retreat, strong-zone/idle punishment, shared actor rules, normal bot steering and real lesson recovery after delayed analog input.');

for(const gap of [20,360]) {
  const normal=new GameState(0),tutorial=createPracticeArena();
  for(const s of [normal,tutorial]) {
    s.worldWidth=s.worldHeight=4200;s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=s.shiftsOn=s.trafficOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,NOW);
    const a=s.addPlayer('hunter','Hunter',NOW),p=s.addPlayer('runner','Runner',NOW);
    a.setGems(stock(133),4200,4200);p.setGems(stock(100),4200,4200);a.dropProtection();p.dropProtection();a.facing=0;
    a.placeAt(1400-(a.width+p.width)/2-gap-a.width/2,2100-a.height/2);p.placeAt(1400-p.width/2,2100-p.height/2);p.injure(0);
  }
  const snapshot=(s:GameState)=>[...s.players.entries()].map(([id,p])=>({id,x:p.x,y:p.y,width:p.width,gems:p.gems,facing:p.facing,stamina:p.stamina,state:p.state,inhaling:p.inhaling,blocked:p.breathingBlocked,injury:p.injuredUntil,held:p.capturedBy,holding:p.gulping,velocity:p.velocity()}));
  for(let tick=1;tick<=240;tick++) {
    const elapsed=tick*1000/30;
    for(const s of [normal,tutorial]) {
      const a=s.players.get('hunter'),p=s.players.get('runner');assert(a&&p);
      const dx=p.x+p.width/2-a.x-a.width/2,dy=p.y+p.height/2-a.y-a.height/2,d=Math.hypot(dx,dy)||1;
      a.aimAt(dx,dy);a.steer(dx/d,dy/d);if(!a.inhaling)a.startInhale(NOW+elapsed);
      p.steer(elapsed>350?1:0,0);if(tick===20)exhale(s,p,NOW+elapsed);
      s.update(1/30,NOW+elapsed);
    }
    assert.deepEqual(snapshot(normal),snapshot(tutorial),'identical active inputs must produce identical movement, suction, theft, injury, breath and finish outcomes in normal/tutorial arenas');
    if(normal.players.get('runner')?.state!=='alive')break;
  }
}
console.log('Normal/tutorial physics parity passed for identical wounded retreat, blocked puff, suction/theft and close-finish inputs.');
