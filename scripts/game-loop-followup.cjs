// Current-rule mechanical context for the loop review. No gameplay constant overrides.
const assert=require('node:assert/strict'),fs=require('node:fs');
const {GameState}=require('../server/dist/schema/GameState.js');
const {creatureSize}=require('../server/dist/game/creatureSize.js');
const cannon=require('../server/dist/game/cannon.js');
const {shooterMassContribution,launchSpeed,lethalPlayerImpact,canCatch}=cannon;
const {fireCaptive,updateInhales}=require('../server/dist/systems/inhale.js');
const {moveSpeed}=require('../server/dist/game/movement.js');
const {CANNON,INHALE}=require('../server/dist/constants/gameConstants.js');
const variant=process.argv.includes('--peer33')?'peer33':process.argv.includes('--floor33')?'floor33':'current';
const originalImpact=cannon.impactGems;
// Preserve this dated baseline experiment even after the normal local tuning moves on.
CANNON.PEER_HIT_SHARE=0;
if(variant==='peer33'){
  CANNON.PEER_HIT_SHARE=.33;
  cannon.impactGems=(...args)=>{const [gems,,,,,kind='missile',shooterWidth=0]=args,targetWidth=args[3];
    if(kind==='missile'&&gems>0&&Number.isFinite(shooterWidth)&&shooterWidth>0&&targetWidth>0)
      return Math.min(gems,Math.max(1,Math.round(gems*Math.min(CANNON.IMPACT_MAX_SHARE,.33*(shooterWidth/targetWidth)**2))));
    return originalImpact(...args);
  };
}
if(variant==='floor33')cannon.impactGems=(...args)=>{
  const current=originalImpact(...args),[gems,,,,,kind='missile',shooterWidth=0]=args,targetWidth=args[3];
  if(kind!=='missile'||!(gems>0&&targetWidth>0&&Number.isFinite(shooterWidth)&&shooterWidth>0))return current;
  return Math.max(current,Math.min(gems,Math.max(1,Math.round(gems*Math.min(CANNON.IMPACT_MAX_SHARE,.33*(shooterWidth/targetWidth)**2)))));
};
const impactGems=(...args)=>cannon.impactGems(...args);
const NOW=1000000,DT=1/30;
function stock(width){let lo=0,hi=1000000;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(creatureSize(mid)<width)lo=mid+1;else hi=mid;}return lo;}
const equalDamage=[60,100,200,300,500].map(width=>{
  const gems=stock(width),actual=creatureSize(gems),bonus=shooterMassContribution(actual,CANNON.BULLET_SIZE),speed=launchSpeed(actual);
  const lost=impactGems(gems,speed,CANNON.BULLET_SIZE,actual,bonus,'missile',actual);
  const afterWidth=creatureSize(gems-lost);
  return {width:actual,gems,damage:lost,lossPercent:Math.round(lost/gems*10000)/100,lethal:lethalPlayerImpact(speed,CANNON.BULLET_SIZE,actual,bonus,actual),
    afterWidth,speedBefore:moveSpeed(actual),speedAfter:moveSpeed(afterWidth),nextShotHasShatterAdvantage:actual>=afterWidth*CANNON.SHATTER_SHOOTER_RATIO};
});
const captureGrowth=[];
for(const width of[100,200,300,500,800])for(const ratio of[.5,1/INHALE.EAT_RATIO]){
  const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,NOW);
  const a=s.addPlayer('attacker','Attacker',NOW),ammo=s.addPlayer('ammo','Ammo',NOW);
  a.setGems(stock(width),4200,4200);let ammoGems=stock(width*ratio);while(creatureSize(ammoGems)>width*ratio)ammoGems--;
  ammo.setGems(ammoGems,4200,4200);a.dropProtection();ammo.dropProtection();a.placeAt(1000,1600);a.facing=0;
  const before=a.width,ammoBefore=ammo.width,initialTotal=a.gems+ammo.gems;
  assert(canCatch(before,ammoBefore));ammo.placeAt(a.x+a.width*.8+1-ammo.width/2,a.y+(a.height-ammo.height)/2);
  a.startInhale(NOW);updateInhales(s,NOW,.001);assert.equal(a.gulping,ammo.sessionId);
  assert.equal(a.gems+ammo.gems,initialTotal,'capture must conserve the existing growth inventory');
  const after=a.width,transfer=ammoGems-ammo.gems;a.stopInhale(NOW);a.captureNeedsRelease=false;assert(fireCaptive(s,a,NOW));
  assert.equal(ammo.width,CANNON.BULLET_SIZE);
  captureGrowth.push({rivalWidth:before,ammoNaturalWidth:ammoBefore,transfer,shooterAfterCapture:after,shotShooterWidth:ammo.shotShooterWidth,
    firstHitHasShatterAdvantage:ammo.shotShooterWidth>=before*CANNON.SHATTER_SHOOTER_RATIO});
}
function fight(width,ratio,gap,response){
  const s=new GameState(0);s.botFill=0;s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.update(0,NOW);s.blackHoles.clear();
  const a=s.addPlayer('attacker','Attacker',NOW),t=s.addPlayer('target','Target',NOW),ammo=s.addPlayer('ammo','Ammo',NOW);
  for(const [p,size]of[[a,width*ratio],[t,width],[ammo,CANNON.BULLET_SIZE]]){p.setGems(stock(size),4200,4200);p.dropProtection();}
  const initial=t.gems,attackerWidth=a.width,targetWidth=t.width;
  t.placeAt(2500-t.width/2,2100-t.width/2);a.placeAt(2500-(a.width+t.width)/2-gap-a.width/2,2100-a.width/2);a.facing=0;
  a.gulping=ammo.sessionId;ammo.capturedBy=a.sessionId;a.captureNeedsRelease=false;
  assert(fireCaptive(s,a,NOW));
  let hitAt=null,directLoss=null,directOut=false,finishedAt=null,finishedHow=null,recoveredAt=null;
  const events=[];
  s.onEvent=(type,d)=>{
    if(type!=='credit'||d.targetId!==t.sessionId)return;
    events.push({time:s.time,...d});
    if(d.how==='cannon'&&d.projectileId&&hitAt===null){hitAt=s.time;directLoss=d.gems;directOut=!!d.out;}
    if(d.out&&finishedAt===null){finishedAt=s.time;finishedHow=d.how;}
  };
  for(let tick=1;tick<=450;tick++){
    const now=NOW+tick*1000/30;
    if(hitAt!==null&&!directOut&&s.time>=hitAt+250){
      const dx=t.x+t.width/2-a.x-a.width/2,dy=t.y+t.width/2-a.y-a.width/2,d=Math.hypot(dx,dy)||1;
      a.steer(dx/d,dy/d);a.aimAt(dx,dy);if(!a.inhaling)a.startInhale(now);
    }
    if(hitAt!==null&&response==='retreat300ms'&&s.time>=hitAt+300)t.steer(1,0);
    s.update(DT,now);
    if(finishedAt!==null)break;
    if(hitAt!==null&&!t.breathingBlocked&&s.time>=hitAt+1000){recoveredAt=s.time;break;}
  }
  return {targetWidth,attackerWidth,ratio:attackerWidth/targetWidth,gap,response,initialGems:initial,hitAt,directLoss,directOut,finishedAt,finishedHow,recoveredAt,targetGems:t.gems,events};
}
const fights=[];
for(const width of[100,200,300,500])for(const ratio of[.9,1,1.2])for(const gap of[100,350,650])for(const response of['idle','retreat300ms'])fights.push(fight(width,ratio,gap,response));
assert.equal(fights.length,72);assert(fights.every(r=>r.hitAt!==null),'all controlled fights must start with the actual missile hit');
const summary=[];
for(const ratio of[.9,1,1.2])for(const gap of[100,350,650])for(const response of['idle','retreat300ms']){
  const group=fights.filter(r=>Math.abs(r.ratio-ratio)<.01&&r.gap===gap&&r.response===response);
  summary.push({ratio,gap,response,cases:group.length,directKnockouts:group.filter(r=>r.directOut).length,followupKnockouts:group.filter(r=>r.finishedAt!==null&&!r.directOut).length,recoveries:group.filter(r=>r.recoveredAt!==null).length});
}
const result={date:'2026-11-01',variant,method:'72 controlled fights per variant at physical target widths100/200/300/500, shooter ratios0.9/1/1.2, edge gaps100/350/650, idle or outward retreat300ms after hit. One shooter starts with one standard captive; defender has none. Real fireCaptive/flight, damage, theft, movement and respawn,30Hz, no opponents/field/arena hazards. Shooter begins pursuit/inhale250ms after hit. No fairness/fun claim; idle and fixed-direction controls do not represent a human duel. Separate formula table is launch-speed damage before flight drag, not a promise of loss at every distance. peer33 sets the existing process-local trial to0.33; floor33 patches only this process with max(current damage, width-scaled33% damage), preserving stronger early hits. Neither edits constants/source or enables a running game. captureGrowth separately performs ten actual mouth captures and fires, with legally sized half-width/max-legal ammo; shatter flags are against a rival unchanged from the pre-capture shooter width. Second-shot flags assume unchanged shooter width and no defender recovery before the next hit.',peerHitTrial:CANNON.PEER_HIT_SHARE,captureFireDelayMs:CANNON.CAPTURE_FIRE_DELAY_MS,equalDamage,captureGrowth,summary,fights};
fs.writeFileSync(`docs/playtests/game-loop-followup-${variant==='current'?'':variant+'-'}2026-11-01.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({variant,equalDamage,summary},null,2));
