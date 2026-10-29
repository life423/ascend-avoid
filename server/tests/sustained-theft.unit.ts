import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { steal, updateInhales, knockOutWithGems } from '../systems/inhale.js';
import { INHALE } from '../constants/gameConstants.js';
const NOW=100000;
function setup(){const s=new GameState(0);s.botFill=0;s.weaponsOn=false;s.surgesOn=false;s.setTurbines('off');s.time=6900;
 const a=s.addPlayer('a','A',NOW),b=s.addPlayer('b','B',NOW);a.setGems(40,4200,4200);b.setGems(1000,4200,4200);a.placeAt(1200,1600);a.facing=0;
 b.placeAt(a.x+a.width*.8+200-b.width/2,a.y+(a.height-b.height)/2);a.spawnProtected=b.spawnProtected=false;b.injure(0);a.startInhale(NOW);
 return{s,a,b,x:b.x,y:b.y};}
function established(){const v=setup();steal(v.s,v.a,NOW,.1);assert.equal(v.a.theftContinuations.get(v.b.sessionId),7000);v.s.time=7100;return v;}
{
 const{s,a,b}=established(),before=b.gems;steal(s,a,NOW+200,.5);assert(b.gems<before&&b.continuedTheft);assert.equal(b.injuredUntil,7000);
 const c=s.addPlayer('c','Late',NOW);c.setGems(40,4200,4200);c.spawnProtected=false;c.placeAt(a.x,a.y);c.facing=0;c.startInhale(NOW);
 steal(s,c,NOW+200,.5);assert.equal(c.gems,40,'another attacker cannot join after expiry');assert.equal(c.theftContinuations.size,0);
 b.injure(s.time);steal(s,c,NOW+201,.1);assert(c.theftContinuations.has(b.sessionId),'a genuinely new injury allows a new connection');
}
for(const loss of ['range','aim','stop','protection','flight','death'] as const){
 const{s,a,b,x,y}=established();
 if(loss==='range')b.placeAt(4000,4000);if(loss==='aim')a.facing=Math.PI;if(loss==='stop')a.stopInhale(NOW);
 if(loss==='protection')b.protectFor(1000,NOW);if(loss==='flight')b.launch(NOW,200,0,'x',1000);if(loss==='death')knockOutWithGems(s,b,NOW);
 const before=a.gems;updateInhales(s,NOW+200,.1);assert(!a.theftContinuations.has(b.sessionId),`${loss} breaks continuation`);assert(!b.continuedTheft);
 if(b.state==='dead')continue;
 b.spawnProtected=false;b.land();b.placeAt(x,y);a.facing=0;a.startInhale(NOW+300);steal(s,a,NOW+300,.3);assert.equal(a.gems,before,'reconnecting after expiry cannot restart');
}
{
 const{s,a,b}=setup();b.placeAt(4000,4000);steal(s,a,NOW,.1);assert.equal(a.theftContinuations.size,0);
 s.time=7100;b.placeAt(a.x+a.width*.8+200-b.width/2,a.y+(a.height-b.height)/2);steal(s,a,NOW+200,.2);assert.equal(a.theftContinuations.size,0,'holding inhale out of range never qualifies');
}
{
 const{s,a,b}=setup(),reach=INHALE.REACH+a.width*INHALE.REACH_PER_SIZE;
 b.placeAt(a.x+a.width*.8+reach,a.y+(a.height-b.height)/2);steal(s,a,NOW,.1);assert.equal(a.theftContinuations.size,0,'zero-drain outer airflow does not qualify');
}
for(const clear of ['capture','respawn','disconnect'] as const){
 const{s,a,b}=established();steal(s,a,NOW+200,.1);
 if(clear==='capture'){a.setGems(100000,4200,4200);a.placeAt(1200,1600);b.placeAt(a.x+a.width*.8-b.width/2+10,a.y+(a.height-b.height)/2);updateInhales(s,NOW+300,.01);assert.equal(b.state,'dead','continued injury finishes at the mouth instead of capture');}
 if(clear==='respawn')s.spawn(b,NOW+300);if(clear==='disconnect')s.removePlayer(a.sessionId);
 assert.equal(a.theftContinuations.size,0);assert(!b.continuedTheft,`${clear} clears the truthful vulnerability flag`);
}
console.log('Sustained theft passed: fixed base timer, real connection, continuation, interruption, no late joins/reconnects, new injury and lifecycle cleanup.');
