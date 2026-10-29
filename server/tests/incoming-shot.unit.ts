import assert from 'node:assert/strict';
import { firstImpact, type IncomingShot } from '../game/incomingShot.js';
const target={x:0,y:0,vx:0,vy:0,radius:20};
const shot:IncomingShot={id:'a',x:500,y:0,vx:-1000,vy:0,radius:20,visible:false};
assert.equal(firstImpact(target,[shot])?.seconds,.46,'approaching offscreen shot warns in the half-second window');
assert.equal(firstImpact(target,[{...shot,y:41}]),null,'a near miss outside collision radii stays quiet');
assert.equal(firstImpact(target,[{...shot,vx:1000}]),null,'departing shots stay quiet');
assert.equal(firstImpact(target,[{...shot,x:600}]),null,'impacts beyond half a second stay quiet');
assert(firstImpact({...target,vx:100},[shot]));assert.equal(firstImpact({...target,vx:-100},[shot]),null,'target velocity affects time to impact');
assert(firstImpact({...target,vy:100},[{...shot,x:300,y:30,vy:0}]));
assert.equal(firstImpact(target,[{...shot,visible:true}]),null,'visible projectiles lose the edge warning');
assert.equal(firstImpact(target,[]),null,'disappeared projectiles leave no stale threat');
assert.equal(firstImpact(target,[{...shot,remaining:.2}]),null,'a flight ending before collision is not a threat');
assert.equal(firstImpact(target,[shot,{...shot,id:'b',x:300}])?.id,'b','use the earliest impact');
for(const jitter of [-.001,0,.001])assert.equal(firstImpact(target,[{...shot,x:500+jitter}])?.id,'a','small position noise does not toggle a clear threat');
assert.equal(firstImpact(target,[{...shot,vx:0}]),null,'zero relative velocity cannot create a distant collision');
console.log('Incoming prediction passed: approach, near misses, both velocities, horizon, visibility, lifetime, closest impact and disappearing threats.');

// Actual server telemetry includes positional suction forces as well as walking/skids.
import { GameState } from '../schema/GameState.js';
{
 const s=new GameState(0);s.botFill=0;s.fieldGemTarget=0;s.weaponsOn=false;s.surgesOn=false;s.trafficHits=false;s.setTurbines('off');s.update(0,100000);
 const a=s.addPlayer('puller','Puller',100000),b=s.addPlayer('target','Target',100000);
 a.setGems(100,4200,4200);b.setGems(100,4200,4200);a.placeAt(1000,1000);b.placeAt(a.x+a.width*.8+150-b.width/2,a.y+(a.height-b.height)/2);
 a.spawnProtected=b.spawnProtected=false;a.facing=0;a.startInhale(100000);s.update(.03,100030);
 assert(b.movementVx<0,'incoming prediction sees body suction velocity on a stationary target');
 assert(Math.abs(b.movementVx-b.velocity().x-b.tickNudgeX/.03)<1e-6);
}
