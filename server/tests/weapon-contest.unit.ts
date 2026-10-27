import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { spawnWeapon, updateWeapons, puffWeaponParts, deployWeapon } from '../systems/weapons.js';
import { weaponKinds } from '../game/weaponKit.js';
import { PinwheelSchema } from '../schema/PinwheelSchema.js';
import { exhale } from '../systems/inhale.js';
import { PINWHEEL } from '../constants/gameConstants.js';
const NOW=100000;
function setup() {
 const s=new GameState(0);s.botFill=0;s.weaponsOn=true;s.time=1000;
 const carrier=s.addPlayer('carrier','Carrier',NOW),thief=s.addPlayer('thief','Thief',NOW);
 carrier.placeAt(2000,2000);carrier.facing=0;carrier.spawnProtected=thief.spawnProtected=false;
 spawnWeapon(s,2100,2100,'pinwheel');const w=s.pinwheel,p=w.parts[0]!;
 w.owner=carrier.sessionId;w.progress=1;w.claimUntil=s.time+18000;
 for(const part of w.parts)part.owner=carrier.sessionId;p.carriedBy=carrier.sessionId;
 updateWeapons(s,.01,NOW);thief.placeAt(p.x-110,p.y-thief.height/2);thief.facing=0;thief.startInhale(NOW);
 for(let i=0;i<10;i++)updateWeapons(s,.03,NOW+i*30);
 assert.equal(p.theftBy,thief.sessionId);assert.equal(p.theftMs,300);
 return{s,w,p,carrier,thief};
}
for(const interruption of ['drop','puff','capture','death','disconnect'] as const) {
 const {s,p,carrier,thief}=setup();
 if(interruption==='drop')p.carriedBy='';
 if(interruption==='puff')puffWeaponParts(s,thief);
 if(interruption==='capture')carrier.capturedBy='other';
 if(interruption==='death')carrier.state='dead';
 if(interruption==='disconnect')s.removePlayer(carrier.sessionId);
 updateWeapons(s,.01,NOW+350);
 assert.equal(p.theftMs,0,`${interruption} must discard interrupted cargo-theft progress`);
 assert.equal(p.theftBy,'',`${interruption} must clear the progress owner`);
}
for(const interruption of ['aim','range','release','protection','stun','follow','other-build','different-thief'] as const) {
 const {s,w,p,carrier,thief}=setup();
 if(interruption==='aim')thief.facing=Math.PI;
 if(interruption==='range')thief.placeAt(100,100);
 if(interruption==='release')thief.stopInhale(NOW+300);
 if(interruption==='protection')carrier.protectFor(1000,NOW+300);
 if(interruption==='stun')thief.stunned=true;
 if(interruption==='follow')thief.followActive=true;
 if(interruption==='other-build') { const other = new PinwheelSchema(); other.owner=thief.sessionId;other.phase='carried';s.weaponSets.push(other); }
 if(interruption==='different-thief') {
  const rival=s.addPlayer('rival','Rival',NOW);rival.placeAt(thief.x+10,thief.y);rival.facing=0;rival.startInhale(NOW);thief.stopInhale(NOW);
 }
 updateWeapons(s,.01,NOW+350);
 assert.equal(w.owner,carrier.sessionId);
 if(interruption==='different-thief') {assert.equal(p.theftBy,'rival');assert.equal(p.theftMs,10,'a new attacker starts from zero');}
 else {assert.equal(p.theftMs,0,interruption+' clears progress');assert.equal(p.theftBy,'');}
}
for(const kind of weaponKinds)for(const bot of [false,true]) {
 const {s,w,p,carrier,thief}=setup();w.kind=kind;carrier.isBot=thief.isBot=bot;
 // A loose reserved sibling remains locked, even when a rival stands on it.
 thief.stopInhale(NOW);const sibling=w.parts[1]!;thief.placeAt(sibling.x-thief.width/2,sibling.y-thief.height/2);updateWeapons(s,.01,NOW+310);
 assert.equal(sibling.carriedBy,'');assert.equal(w.owner,carrier.sessionId);
 thief.placeAt(p.x-110,p.y-thief.height/2);thief.facing=0;thief.startInhale(NOW+320);
 updateWeapons(s,(PINWHEEL.PART_THEFT_MS-1)/1000,NOW+969);assert.equal(w.owner,carrier.sessionId,'a fresh attempt cannot use old progress');
 updateWeapons(s,.001,NOW+970);assert.equal(w.owner,thief.sessionId);assert.equal(p.carriedBy,thief.sessionId);assert.equal(w.progress,1);
 assert(w.parts.every(part=>part.owner===thief.sessionId && part.theftMs===0 && !part.theftBy));
 thief.stopInhale(NOW+980);carrier.placeAt(100,100);
 for(const part of [...w.parts]) {assert(part);if(part.carriedBy)continue;thief.placeAt(part.x-thief.width/2,part.y-thief.height/2);updateWeapons(s,.01,NOW+1000);}
 assert.equal(w.phase,'carried',kind+' finishes after contested takeover');
 thief.steer(0,1);const y=thief.y;assert(deployWeapon(s,thief));thief.updateMovement(4200,4200,NOW+1100,1/30);
 assert(thief.y>y,'deployment retains steering');assert.equal(w.owner,thief.sessionId);assert.equal(w.phase,'charging');
 assert.equal(carrier.injuredUntil,0);assert.equal(carrier.gems,0,'cargo theft never drains healthy gems');
}
{
 const {s,w,carrier,thief}=setup();w.kind='sentinel';w.phase='active';w.owner=carrier.sessionId;w.originX=w.x=2100;w.originY=w.y=2100;w.activatedAt=s.time;w.at=s.time+16000;w.nextShotAt=s.time+850;w.nextAimAt=0;
 thief.setGems(100,4200,4200);thief.stopInhale(NOW);thief.placeAt(2350-thief.width/2,2100-thief.height/2);
 updateWeapons(s,0,NOW);const target={x:2350,y:2100};
 thief.placeAt(2350-thief.width/2,2400-thief.height/2);s.time+=800;updateWeapons(s,.8,NOW+800);
 assert(Math.abs(w.angle-Math.atan2(target.y-w.y,target.x-w.x))<1e-8,'a moving platform aims at its recorded point, without tracking a dodging victim');
 s.time+=50;updateWeapons(s,.05,NOW+850);const bolt=[...w.bolts.values()][0];assert(bolt);
 assert(Math.abs(bolt.angle-Math.atan2(target.y-w.y,target.x-w.x))<1e-8,'launch uses the same fixed aim point as its warning');
}


{
 const {s,w,p,carrier,thief}=setup();
 thief.placeAt(p.x+5-thief.width/2,p.y-thief.height/2);thief.facing=0;
 updateWeapons(s,.35,NOW+650);assert.equal(w.owner,thief.sessionId,'holding inhale on touching cargo cannot lose contact behind the mouth point');
 assert.equal(carrier.injuredUntil,0);
}
{
 const {s,w,p,carrier,thief}=setup();thief.setGems(1000000,4200,4200);thief.placeAt(p.x+200-thief.width/2,p.y-thief.height/2);thief.facing=0;
 updateWeapons(s,1,NOW+1300);assert.equal(w.owner,carrier.sessionId,'a giant body cannot bypass the maximum mouth-to-cargo reach');assert.equal(p.theftMs,0);
}

for(const kind of weaponKinds)for(const bot of [false,true]) {
 const {s,w,p,carrier,thief}=setup();s.surgesOn=false;s.fieldGemTarget=0;s.setTurbines('off');
 for(const list of [s.blackHoles,s.obstacles,s.comets,s.balls,s.bombs])list.clear();s.gems.clear();s.weaponSets.clear();
 s.now=NOW;w.kind=kind;p.theftMs=0;p.theftBy='';
 carrier.steer(1,0);thief.steer(1,0);carrier.isBot=thief.isBot=bot;const start=carrier.x;
 for(let tick=1;tick<=30&&w.owner===carrier.sessionId;tick++)s.update(1/30,NOW+tick*1000/30);
 assert(carrier.x>start+40,'a fleeing carrier retains ordinary movement');
 assert.equal(w.owner,thief.sessionId,kind+' cargo can be stolen while both players move');
 assert.equal(carrier.injuredUntil,0);
}
{
 const {s,w,p,carrier}=setup();carrier.facing=Math.PI;carrier.startInhale(NOW+300);carrier.stopInhale(NOW+310);exhale(s,carrier,NOW+310);
 updateWeapons(s,.01,NOW+350);assert.equal(w.owner,carrier.sessionId);assert.equal(p.theftMs,0,'ordinary defensive puff interrupts cargo theft');
}
{
 const {s,w,carrier,thief}=setup();w.kind='sentinel';w.phase='active';w.owner=carrier.sessionId;w.originX=w.x=2100;w.originY=w.y=2100;w.activatedAt=s.time;w.at=s.time+16000;w.nextShotAt=s.time+850;w.nextAimAt=0;
 thief.stopInhale(NOW);thief.placeAt(2350-thief.width/2,2100-thief.height/2);w.hitAt.set(thief.sessionId,s.time+500);
 updateWeapons(s,0,NOW);assert(w.aimPoint,'a temporary damage cooldown cannot force the next shot to aim blindly');
 s.time=w.at;updateWeapons(s,0,NOW+16000);assert.equal(w.aimPoint,null,'retirement discards the recorded point');
}
console.log('Contested weapon cargo: interruption/lifecycle resets, fresh timing, competing thieves, one-build limit, reservation takeover, all six recipes, moving placement and human/bot parity pass.');
