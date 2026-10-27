import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { groupPressureScale } from '../game/groupPressure.js';
import { planTheft, steal, updateInhales } from '../systems/inhale.js';
const NOW=100000;
assert.equal(groupPressureScale([]),1);assert.equal(groupPressureScale([12,0,NaN]),1);
for(const count of [2,3,10,100]) {
  const scale=groupPressureScale(Array(count).fill(10));
  assert(scale*count>1 && scale*count<=1.6+1e-12,'additional mouths help within a fixed pressure ceiling');
  assert(Math.abs(scale-groupPressureScale(Array(count).fill(30)))<1e-12,'physical strength ratios determine the cap');
}
function setup(count=2, bot=false) {
  const s=new GameState(0);s.botFill=0;s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.update(0,NOW);
  s.time=1000;s.now=NOW;
  const add=(id:string)=>{const p=s.addPlayer(id,id,NOW);p.setGems(1000,4200,4200);p.spawnProtected=false;p.isBot=bot;return p;};
  const v=add('victim');v.placeAt(2100-v.width/2,2100-v.width/2);v.injure(0);
  const thieves=Array.from({length:count},(_,i)=>{const p=add('thief'+i);const a=i*2*Math.PI/count;const d=p.width+4;p.placeAt(2100+Math.cos(a)*d-p.width/2,2100+Math.sin(a)*d-p.width/2);p.facing=a+Math.PI;p.startInhale(NOW);p.heldFor.set(v.sessionId,2);return p;});
  return {s,v,thieves};
}
for(const bot of [false,true]) {
  const {s,v,thieves:t}=setup(2,bot);
  const group=planTheft(s,NOW);const rates=t.map(p=>group.get(p)![0].rate);
  t[1].stopInhale(NOW);const solo=planTheft(s,NOW).get(t[0])![0].rate;
  assert(rates[0]+rates[1]>solo && rates[0]+rates[1]<solo*1.6);
  assert(Math.abs(rates[0]-rates[1])<1e-6,'equal connections share the same rate');
  t[1].startInhale(NOW);t[1].facing=Math.PI;assert.equal(planTheft(s,NOW).get(t[0])![0].rate,solo,'a mis-aimed mouth does not dilute valid theft');
  t[1].facing=Math.PI*2;t[1].stunned=true;assert.equal(planTheft(s,NOW).get(t[0])![0].rate,solo,'invalid state does not participate');t[1].stunned=false;
  v.spawnProtected=true;assert.equal(planTheft(s,NOW).get(t[0])!.length,0);v.spawnProtected=false;
  t[0].injure(s.time);t[1].stopInhale(NOW);
  assert(Math.abs(planTheft(s,NOW).get(t[0])![0].rate/solo-.15)<1e-8,'outgoing injury multiplier is applied once');
}
function payout(reverse:boolean) {
 const {s,v,thieves}=setup();const plan=planTheft(s,NOW);
 for(const p of reverse?[...thieves].reverse():thieves)steal(s,p,NOW,.1,plan);
 return [v.gems,...thieves.map(p=>p.gems)];
}
assert.deepEqual(payout(false),payout(true),'frozen rates avoid actor-order growth advantages');
{
 const {s,v,thieves}=setup();for(const p of thieves)p.placeAt(1800-p.width/2,2100-p.width/2);
 thieves.forEach(p=>p.facing=0);v.injuredUntil=0;
 const before=v.x;updateInhales(s,NOW,1/30);const group=before-v.x;
 const soloSetup=setup(1);soloSetup.v.injuredUntil=0;soloSetup.thieves[0].placeAt(1800-soloSetup.thieves[0].width/2,2100-soloSetup.thieves[0].width/2);soloSetup.thieves[0].facing=0;
 const start=soloSetup.v.x;updateInhales(soloSetup.s,NOW,1/30);const solo=start-soloSetup.v.x;
 assert(group>solo && group<solo*1.6,'body displacement shares the same bounded pressure rule');
}
{
 const {s,v,thieves:t}=setup(3);t[2].stopInhale(NOW);
 const before=planTheft(s,NOW);for(const p of t)steal(s,p,NOW,.001,before);
 assert(t[0].theftContinuations.has(v.sessionId)&&t[1].theftContinuations.has(v.sessionId));
 s.time=7100;s.now=NOW+6100;t[2].startInhale(s.now);
 let plan=planTheft(s,s.now);assert.equal(plan.get(t[2])!.length,0,'late newcomer cannot join expired theft');
 assert(plan.get(t[0])!.length&&plan.get(t[1])!.length,'both established connections can continue');
 t[1].placeAt(500,500);plan=planTheft(s,s.now);steal(s,t[1],s.now,.01,plan);
 assert(!t[1].theftContinuations.has(v.sessionId),'breaking range removes expired continuation');
 const alone=planTheft(s,s.now).get(t[0])![0].rate;
 t[1].placeAt(2100+Math.cos(2*Math.PI/3)*(v.width+t[1].width)/2-t[1].width/2,2100+Math.sin(2*Math.PI/3)*(v.width+t[1].width)/2-t[1].width/2);
 plan=planTheft(s,s.now);assert.equal(plan.get(t[1])!.length,0);assert.equal(plan.get(t[0])![0].rate,alone,'reconnection cannot dilute remaining valid continuation');
 v.suctionSafeUntil=s.now+1000;assert.equal(planTheft(s,s.now).get(t[0])!.length,0,'recovery protection interrupts the whole group');
}

console.log('Group pressure: bounded diminishing returns, unchanged solo, valid connections only, frozen fair rates, injury multiplier, body pulls and bot parity pass.');
