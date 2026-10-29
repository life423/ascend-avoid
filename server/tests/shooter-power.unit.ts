import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CANNON } from '../constants/gameConstants.js';
import { bodyMass } from '../game/creatureSize.js';
import { impactGems, launchSpeed, shooterMassContribution } from '../game/cannon.js';
import { fireCaptive, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
const NOW=100000;
const table=[80,200,800].map(shooter=>({shooterWidth:shooter,ammoWidth:60,targetWidth:200,targetGems:1000,speed:1250,bonusMass:shooterMassContribution(shooter,60),damage:impactGems(1000,1250,60,200,shooterMassContribution(shooter,60))}));
assert(table[0].damage<table[1].damage&&table[1].damage<table[2].damage);
const ammoTable=[20,60,160].map(ammo=>({shooterWidth:400,ammoWidth:ammo,targetWidth:200,targetGems:1000,speed:1250,damage:impactGems(1000,1250,ammo,200,shooterMassContribution(400,ammo))}));
assert(ammoTable[0].damage<ammoTable[1].damage&&ammoTable[1].damage<ammoTable[2].damage);
console.log(JSON.stringify({sameAmmo:table,sameShooter:ammoTable}));
for(const shooter of [20,80,400,100000])for(const ammo of [20,60,160,1000]){
 const bonus=shooterMassContribution(shooter,ammo);assert(bonus<=bodyMass(ammo)*CANNON.SHOOTER_MASS_CAP);
 assert(impactGems(1000,1250,ammo,400,bonus)<=impactGems(1000,1250,ammo,200,bonus),'physical target mass resists');
 assert(impactGems(1000,2000,ammo,20,bonus)<=850,'existing ceiling is preserved');
 assert.equal(impactGems(1000,1250,ammo,200),impactGems(1000,1250,ammo,200,0),'zero bonus preserves old impact rules');
}
assert(impactGems(10000,1250,20,1000,shooterMassContribution(100000,20))<30,'even a giant shooter cannot turn tiny ammunition into a giant killer');
function fired(){
 const s=new GameState(0);s.botFill=0;s.fieldGemTarget=0;s.weaponsOn=false;s.surgesOn=false;s.setTurbines('off');s.update(0,NOW);
 const a=s.addPlayer('shooter','Shooter',NOW),b=s.addPlayer('ammo','Ammo',NOW);
 a.setGems(250,4200,4200);b.setGems(100,4200,4200);a.placeAt(1000,1000);a.facing=0;a.spawnProtected=b.spawnProtected=false;
 b.placeAt(a.x+a.width*.8-b.width/2+1,a.y+(a.height-b.height)/2);a.startInhale(NOW);updateInhales(s,NOW,.01);
 assert.equal(b.gems,32);assert.equal(a.gems,318,'capture transfers only excess above the standard bullet body, once before firing');
 assert(!fireCaptive(s,a,NOW));a.captureNeedsRelease=false;
 const expected=shooterMassContribution(a.width,b.width),speed=launchSpeed(a.width,b.width), shooterWidth=a.width;
 assert(fireCaptive(s,a,NOW));assert.equal(b.shotMassBonus,expected);assert.equal(Math.hypot(b.flightVx,b.flightVy),speed,'new power adds no launch speed');
 assert.equal(b.shotShooterWidth,shooterWidth,'launch snapshots the real visible shooter width');
 return {s,a,b,expected,shooterWidth};
}
for(const change of ['grow','shrink','death','disconnect'] as const){
 const {s,a,b,expected,shooterWidth}=fired();
 if(change==='grow')a.setGems(100000,4200,4200);if(change==='shrink')a.setGems(0,4200,4200);if(change==='death')a.knockOut(NOW+1);if(change==='disconnect')s.removePlayer(a.sessionId);
 assert.equal(b.shotMassBonus,expected,'launcher changes cannot change an airborne snapshot');
 assert.equal(b.shotShooterWidth,shooterWidth,'size-based lethality uses launch width even after growth, damage, death or disconnect');
 const target=s.addPlayer('target','Target',NOW);target.setGems(1000,4200,4200);target.spawnProtected=false;
 const cx=b.x+b.width/2+180,cy=b.y+b.height/2;target.placeAt(cx-target.width/2,cy-target.height/2);
 const speed=Math.hypot(b.flightVx,b.flightVy)*Math.exp(-CANNON.DRAG*.1),expectedLost=impactGems(1000,speed,b.width,target.width,expected);
 const events:Record<string,unknown>[]=[];s.onEvent=(type,data)=>{if(type==='credit')events.push(data);};
 updateFlights(s,NOW+100,.1);assert.equal(target.gems,1000-expectedLost);
 assert(events.some(e=>e.byId==='shooter'&&e.targetId===target.sessionId&&e.how==='cannon'),'original shooter keeps attribution');
}
for(const immunity of ['spawn','impact'] as const){
 const{s,b}=fired();const target=s.addPlayer('target','Target',NOW);target.setGems(1000,4200,4200);target.placeAt(b.x+b.width/2+100-target.width/2,b.y+b.height/2-target.height/2);
 target.spawnProtected=immunity==='spawn';if(immunity==='impact')target.impactImmuneUntil=NOW+1000;
 updateFlights(s,NOW+100,.1);assert.equal(target.gems,1000);
}
{
 const{s,b}=fired();b.land();assert.equal(b.shotMassBonus,0);assert.equal(b.shotShooterWidth,0);
 b.shotMassBonus=100;b.shotShooterWidth=1000;b.launch(NOW,900,0,'',1000,.35,'turbine');assert.equal(b.shotMassBonus,0,'turbines cannot inherit an old cannon bonus');assert.equal(b.shotShooterWidth,0);
 b.shotMassBonus=100;b.knockOut(NOW);assert.equal(b.shotMassBonus,0);s.spawn(b,NOW+2000);assert.equal(b.shotMassBonus,0);
 b.shotMassBonus=100;s.removePlayer(b.sessionId);assert.equal(b.shotMassBonus,0);
}
console.log('Shooter power passed: bounded physical contribution, ammo importance, target resistance/ceilings, firing snapshots, original attribution, immunity, lifecycle cleanup and instant capture transfer/fire compatibility.');
