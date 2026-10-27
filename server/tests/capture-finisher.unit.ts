import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { updateInhales, updateHolds, fireCaptive, steal } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { CANNON } from '../constants/gameConstants.js';
const NOW=100000;
function capture(injured=true) {
 const s=new GameState(0);s.botFill=0;s.surgesOn=false;s.weaponsOn=false;s.setTurbines('off');s.time=10000;
 const a=s.addPlayer('captor','Captor',NOW),b=s.addPlayer('prey','Prey',NOW);
 a.setGems(100000,4200,4200);b.setGems(1000,4200,4200);a.placeAt(1100,1100);a.facing=0;a.spawnProtected=b.spawnProtected=false;
 b.placeAt(a.x+a.width*.8-b.width/2+10,a.y+(a.height-b.height)/2);
 if(injured)b.injure(s.time-6000);
 a.startInhale(NOW);updateInhales(s,NOW,.01);assert.equal(b.capturedBy,a.sessionId);
 const ms=2000; a.captureNeedsRelease=false;
 return {s,a,b,ms};
}
for(const ending of ['expiry','wall','impact'] as const) {
 const {s,a,b,ms}=capture();b.bellyPending=6;s.time+=ms;assert(b.injuredUntil<s.time,'injury can expire while captured');
 const credits:Record<string,unknown>[]=[];s.onEvent=(type,data)=>{if(type==='credit')credits.push(data);};
 assert(fireCaptive(s,a,NOW+ms));assert(b.fatalMissile&&b.state==='alive','the run ends on landing, not while still airborne');
 if(ending==='impact') {const target=s.addPlayer('target','Target',NOW);target.setGems(1000,4200,4200);target.placeAt(b.x+b.width+250,b.y);target.spawnProtected=false;updateFlights(s,NOW+ms+300,.3);}
 else if(ending==='wall') {b.placeAt(4200-b.width-9,b.y);updateFlights(s,NOW+ms+100,.1);}
 else updateFlights(s,NOW+ms+CANNON.FLIGHT_MS+1,0);
 assert.equal(b.state,'dead',`${ending} finishes an injured captive`);assert.equal(b.gems,0);assert.equal(b.bellyPending,0,'salvage cannot prevent a lethal outcome');assert(!b.flying);
 assert.equal(credits.filter(c=>c.targetId===b.sessionId&&c.byId===a.sessionId&&c.finisher===true).length,1,'one launcher credit');
 s.spawn(b,b.respawnAt);assert.equal(b.state,'alive');assert(b.spawnProtected&&!b.fatalMissile);
}
{
 const {s,a,b,ms}=capture(false);s.time+=ms;assert(fireCaptive(s,a,NOW+ms));assert(!b.fatalMissile);
 updateFlights(s,NOW+ms+CANNON.FLIGHT_MS+1,0);assert.equal(b.state,'alive','healthy captures retain normal flight survival');
}
{
 const {s,a,b}=capture();s.time=a.gulpEndsAt;updateHolds(s,NOW+b.captureHoldMs);
 assert.equal(b.capturedBy,'');assert.equal(a.gulping,'');assert(!b.capturedInjured&&b.state==='alive','timeout ejection cancels the finisher');
 b.launch(NOW+1000,200,0,'turbine',100,1,'turbine');updateFlights(s,NOW+1200,0);assert.equal(b.state,'alive','turbines do not execute injured players');
}

// Continued theft is the same vulnerability: snapshot it BEFORE capture clears the connection.
{
 const s=new GameState(0);s.botFill=0;s.surgesOn=s.weaponsOn=false;s.setTurbines('off');s.time=6900;
 const thief=s.addPlayer('thief','Thief',NOW),prey=s.addPlayer('continued','Prey',NOW);
 thief.setGems(40,4200,4200);prey.setGems(1000,4200,4200);thief.placeAt(1200,1600);thief.facing=0;
 prey.placeAt(thief.x+thief.width*.8+200-prey.width/2,thief.y+(thief.height-prey.height)/2);
 thief.spawnProtected=prey.spawnProtected=false;prey.injure(0);thief.startInhale(NOW);steal(s,thief,NOW,.01);
 assert(thief.theftContinuations.has(prey.sessionId));s.time=7100;
 const captor=s.addPlayer('new-captor','Captor',NOW);captor.setGems(100000,4200,4200);captor.spawnProtected=false;captor.facing=0;
 captor.placeAt(prey.x+prey.width/2-captor.width*.8-10,prey.y+(prey.height-captor.height)/2);
 captor.startInhale(NOW);updateInhales(s,NOW+200,.001);
 assert.equal(prey.capturedBy,captor.sessionId);assert(prey.capturedInjured,'continued vulnerability is snapshotted before cleanup');
 captor.captureNeedsRelease=false;assert(fireCaptive(s,captor,NOW+201));assert(prey.fatalMissile);
 updateFlights(s,NOW+201+CANNON.FLIGHT_MS+1,0);assert.equal(prey.state,'dead');
}

console.log('Capture finishers passed: injury snapshot, impact/wall/expiry KO, launcher credit, escape, healthy capture, turbines and protected respawn.');
