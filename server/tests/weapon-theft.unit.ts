import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { spawnWeapon, updateWeapons, initializeWeaponSets } from '../systems/weapons.js';
import { stealCapturedPart } from '../systems/weaponTheft.js';
const NOW=100000;
function setup(){
 const s=new GameState(0);s.botFill=0;s.weaponsOn=true;s.time=1000;initializeWeaponSets(s,2);
 const carrier=s.addPlayer('carrier','Carrier',NOW),thief=s.addPlayer('thief','Thief',NOW);
 carrier.placeAt(2000,2000);carrier.facing=0;carrier.spawnProtected=thief.spawnProtected=false;
 spawnWeapon(s,2100,2100,'pinwheel');const w=s.pinwheel,p=w.parts[0];assert(p);
 w.owner=carrier.sessionId;w.progress=1;w.claimUntil=s.time+18000;
 for(const part of w.parts)part.owner=carrier.sessionId;p.carriedBy=carrier.sessionId;
 updateWeapons(s,.01,NOW);thief.placeAt(p.x-110,p.y-thief.height/2);thief.facing=0;
 return{s,w,p,carrier,thief};
}
{
 const{s,w,p,carrier,thief}=setup();assert.equal(carrier.injuredUntil,0);
 for(let i=0;i<30;i++)updateWeapons(s,.03,NOW+i*30);assert.equal(w.owner,carrier.sessionId,'touching does not steal cargo');
 thief.startInhale(NOW);for(let i=0;i<10;i++)updateWeapons(s,.03,NOW+i*30);
 assert.equal(w.owner,carrier.sessionId,'theft needs sustained inhale');thief.stopInhale(NOW+300);updateWeapons(s,.03,NOW+300);
 thief.startInhale(NOW+400);for(let i=0;i<23;i++)updateWeapons(s,.03,NOW+400+i*30);
 assert.equal(w.owner,thief.sessionId,'a healthy carrier can lose a piece to close inhale');assert.equal(p.carriedBy,thief.sessionId);
 assert(w.parts.every(part=>part.owner===thief.sessionId));assert(w.parts.filter(part=>part.carriedBy).length===1,'remaining cargo drops loose with new guidance');
 assert.equal(carrier.gems,0,'healthy gem immunity is unchanged');
}
{
 const{s,w,p,carrier,thief}=setup();carrier.suctionSafeUntil=NOW+4000;thief.startInhale(NOW);
 for(let i=0;i<30;i++)updateWeapons(s,.03,NOW+i*30);assert.equal(w.owner,carrier.sessionId,'recovery shields prevent cargo theft too');
 carrier.suctionSafeUntil=0;spawnWeapon(s,3000,3000,'pulsar',s.weaponSets[0]);const other=s.weaponSets[0];assert(other);other.owner=thief.sessionId;other.claimUntil=s.time+18000;
 for(let i=0;i<30;i++)updateWeapons(s,.03,NOW+i*30);assert.equal(p.carriedBy,carrier.sessionId,'one-build rule prevents hoarding');
 other.owner='';stealCapturedPart(s,thief,carrier);assert.equal(w.owner,thief.sessionId,'capture may take healthy cargo too');
}
console.log('Weapon theft passed: healthy cargo, deliberate sustained inhale, interruption, reservation transfer, drop/guidance, shields and one-build limits.');
