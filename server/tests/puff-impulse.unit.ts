import assert from 'node:assert/strict';
import { puffImpulses } from '../game/puffImpulse.js';
import { bodyMass } from '../game/creatureSize.js';
import { EXHALE } from '../constants/gameConstants.js';
import { GameState } from '../schema/GameState.js';
import { exhale, stealWeight } from '../systems/inhale.js';
const NOW=100000;
for(const [a,b] of [[20,400],[400,20],[80,80],[400,400]] as const){const p=puffImpulses(a,[{id:'b',width:b,falloff:1}]),hit=p.hits[0];assert(hit);
 assert(Math.abs(bodyMass(a)*p.recoil-bodyMass(b)*hit.velocity)<1e-6,'opposite impulse conserves physical momentum');
 assert(hit.velocity<=EXHALE.IMPULSE_ADDED_SPEED_CAP&&p.recoil<=EXHALE.IMPULSE_RECOIL_CAP);
 if(a===b)assert.equal(hit.velocity,p.recoil);else if(a<b)assert(p.recoil>hit.velocity*10);else assert(hit.velocity>p.recoil*10);
}
{
 const p=puffImpulses(20,Array.from({length:20},(_,i)=>({id:String(i),width:400,falloff:1})));
 assert(p.recoil<=EXHALE.IMPULSE_RECOIL_CAP+1e-9);assert(Math.abs(p.hits.reduce((n,h)=>n+h.impulse,0)-bodyMass(20)*p.recoil)<1e-6);
 assert.deepEqual(puffImpulses(20,[]),{recoil:0,hits:[]},'empty puff cannot become a dash');
}
{
 const s=new GameState(0);s.botFill=0;s.weaponsOn=false;s.surgesOn=false;s.setTurbines('off');s.time=1000;
 const a=s.addPlayer('a','A',NOW),b=s.addPlayer('b','B',NOW);a.placeAt(8,1000);a.facing=0;a.spawnProtected=b.spawnProtected=false;
 b.placeAt(80,1000);b.facing=Math.PI;b.startInhale(NOW);assert(stealWeight(s,b,a)>0);
 const stamina=a.stamina;exhale(s,a,NOW);assert.equal(a.stamina,stamina-EXHALE.BREATH_COST);assert(a.velocity().x<0&&b.velocity().x>0);
 assert(a.suctionSafeUntil===0&&!b.stunned&&!b.sliding,'air drift grants neither suction shield nor movement lock');
 a.updateMovement(4200,4200,NOW+100,.1);assert(a.x>=8,'boundary collisions clamp recoil');assert.equal(a.gems+b.gems,0,'puff does no damage');
 const before=a.velocity().x;exhale(s,a,NOW+1);assert.equal(a.velocity().x,before,'cooldown cannot multiply recoil');
}
console.log('Puff impulses passed: small/large/equal masses, conservation, multi-hit budget, speed caps, empty puff, boundaries, brief inhale interruption, no stun/shield and unchanged cost.');
