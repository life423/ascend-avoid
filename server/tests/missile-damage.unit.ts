import assert from 'node:assert/strict';
import { impactGems, lethalPlayerImpact, shooterMassContribution, captureGrowthTransfer } from '../game/cannon.js';
import { creatureSize } from '../game/creatureSize.js';
import { CANNON } from '../constants/gameConstants.js';
import { GameState } from '../schema/GameState.js';
import { fireCaptive, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';

assert.equal(impactGems(1000, 1250, 100, 100), 436, 'equal physical mass deals about 44% before any shooter bonus');
assert.equal(impactGems(1000, 1250, 100, 100, 0, 'turbine'), 290, 'turbine transport keeps its earlier damage');
assert(lethalPlayerImpact(1250, 110, 100), 'a sufficiently fast substantial round can now shatter this matchup');
assert(!lethalPlayerImpact(1250, 109, 100)); assert(!lethalPlayerImpact(1000, 110, 100), 'speed still matters');
for (const target of [40, 100, 1000, 10000]) for (const ammo of [4, 20, 100, 1000]) {
  const w = creatureSize(ammo), t = creatureSize(target), bonus = shooterMassContribution(t, w);
  const shot = impactGems(target, 1250, w, t, bonus), old = impactGems(target, 1250, w, t, bonus, 'turbine');
  assert(shot >= old, 'the missile change never reduces contact damage');
  assert(shot <= Math.ceil(target * .85), 'the existing spill ceiling remains a ceiling');
}
const giant = creatureSize(10000), tiny = creatureSize(20);
assert(impactGems(10000,1250,tiny,giant,shooterMassContribution(giant,tiny)) < 100, 'tiny ammunition still chips less than 1% of an established giant');
for (const targetWidth of [60, 120, 300, 600, 1000]) {
  const shooterWidth = targetWidth * CANNON.SHATTER_SHOOTER_RATIO;
  for (const speed of [1, 125, 500, 1250, 2000]) for (const ammoWidth of [20, targetWidth * .1, targetWidth * .6]) {
    assert(lethalPlayerImpact(speed, ammoWidth, targetWidth, 0, shooterWidth), 'any landed missile from a 20%-wider shooter shatters at every body scale');
    assert(!lethalPlayerImpact(speed, ammoWidth, targetWidth, 0, shooterWidth - .01), 'below 20%, these otherwise nonlethal shots still wound');
  }
  assert(lethalPlayerImpact(1, 20, targetWidth, 0, targetWidth * 10), 'tiny slow shots also shatter when the shooter has the size advantage');
  assert(!lethalPlayerImpact(125, 20, targetWidth, 0), 'turbines and launches without a deliberate shooter snapshot cannot inherit size advantage');
}
assert(!lethalPlayerImpact(1250,60,100,0,Infinity));
assert(!lethalPlayerImpact(1250,60,100,0,NaN));

function stockForWidth(width: number): number {
  let lo=0,hi=1_000_000;
  while(lo<hi){const mid=Math.floor((lo+hi)/2);if(creatureSize(mid)<width)lo=mid+1;else hi=mid;}
  return lo;
}
function actualShot(shooterWidth: number, ammunition = 100, speed?: number) {
  const now=100_000,s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,now);
  const shooter=s.addPlayer('shooter','Shooter',now),ammo=s.addPlayer('ammo','Ammo',now),target=s.addPlayer('target','Target',now);
  shooter.setGems(stockForWidth(shooterWidth)-captureGrowthTransfer(ammunition),4200,4200);
  ammo.setGems(ammunition,4200,4200);target.setGems(stockForWidth(250),4200,4200);
  shooter.placeAt(1000,1500);shooter.facing=0;target.placeAt(3000,3000);
  for(const p of [shooter,ammo,target])p.dropProtection();
  ammo.placeAt(shooter.x+shooter.width*.8+1-ammo.width/2,shooter.y+(shooter.height-ammo.height)/2);
  shooter.startInhale(now);updateInhales(s,now,.001);assert.equal(shooter.gulping,ammo.sessionId,'this ammunition must be captured through ordinary mechanics');
  shooter.stopInhale(now);shooter.captureNeedsRelease=false;assert(fireCaptive(s,shooter,now));
  assert.equal(shooter.width,shooterWidth);assert.equal(target.width,250);assert.equal(ammo.width,CANNON.BULLET_SIZE);
  if(speed!==undefined)ammo.flightVx=speed;
  const gap = speed===undefined ? 80 : 1;
  target.placeAt(ammo.x+ammo.width/2+(ammo.width+target.width)/2+gap-target.width/2,ammo.y+(ammo.height-target.height)/2);
  const rewards: Record<string,unknown>[]=[];s.onEvent=(type,data)=>{if(type==='combatReward'&&data.targetId===target.sessionId)rewards.push(data);};
  return {s,now,shooter,ammo,target,rewards};
}
for(const speed of [60, 500, 1250]) {
  const {s,now,target,rewards}=actualShot(300,20,speed);
  updateFlights(s,now+100,.1);
  assert.equal(target.state,'dead','a real tiny missile shatters at low or high impact speed when its shooter is 20% wider');
  assert.equal(rewards.length,1);
}
for(const change of ['unchanged','grow','shrink','death','disconnect'] as const){
  const {s,now,shooter,ammo,target,rewards}=actualShot(300),value=target.gems;
  if(change==='grow')shooter.setGems(stockForWidth(900),4200,4200);
  if(change==='shrink')shooter.setGems(0,4200,4200);
  if(change==='death')shooter.knockOut(now+1);
  if(change==='disconnect')s.removePlayer(shooter.sessionId);
  const before=shooter.gems;
  assert.equal(ammo.shotShooterWidth,300);
  updateFlights(s,now+100,.1);assert.equal(target.state,'dead','a real 300-wide launch shatters a 250-wide target');
  assert.equal(rewards.length,1);assert.equal(rewards[0].byId,'shooter');assert.equal(rewards[0].gems,value);
  if(change==='death')assert.equal(shooter.pendingCombatGems,value);
  else if(change!=='disconnect')assert.equal(shooter.gems,before+value,'all remaining value transfers once');
  else assert.equal(rewards[0].earned,0,'a disconnected recipient cannot receive a duplicate or phantom balance');
  updateFlights(s,now+200,.1);assert.equal(rewards.length,1,'the same flight cannot reward the target twice');
}
{
  const {s,now,shooter,ammo,target,rewards}=actualShot(299);
  shooter.setGems(stockForWidth(900),4200,4200);assert.equal(ammo.shotShooterWidth,299);
  updateFlights(s,now+100,.1);assert.equal(target.state,'alive','growing after a below-threshold launch cannot unlock a mid-flight finish');
  assert.equal(rewards.length,0);assert(target.breathingBlocked,'a nonlethal hit still wounds');
}
console.log('Missile damage: 20%-wider shooters shatter with tiny/large and slow/fast shots; real launches, immutable snapshots, once-only rewards, subthreshold damage and turbine transport passed.');
