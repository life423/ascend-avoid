import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CANNON, INHALE } from '../constants/gameConstants.js';
import { BELLY_GEMS, captureHoldMs } from '../game/cannon.js';
import { fireCaptive, updateBelly, settleBelly, updateHolds, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
const NOW = 100000;
function capture(gems = 100, captorGems = 250, bot = false, injured = false) {
 const state = new GameState(0); state.botFill=0; state.fieldGemTarget=0; state.surgesOn=false; state.weaponsOn=false; state.setTurbines('off'); state.update(0,NOW);
 const captor=state.addPlayer('captor','Captor',NOW), captive=state.addPlayer('captive','Captive',NOW);
 captor.isBot=bot; captive.isBot=bot;
 captor.setGems(captorGems,4200,4200);captive.setGems(gems,4200,4200);
 captor.placeAt(1000,1000);captive.placeAt(captor.x+captor.width*.8-captive.width/2+1,captor.y+(captor.height-captive.height)/2);
 captor.spawnProtected=captive.spawnProtected=false;captor.facing=0;
 if(injured)captive.injure(0);
 const ratio=captor.width/captive.width, hold=captureHoldMs(captor.width,captive.width);
 captor.startInhale(NOW);updateInhales(state,NOW,.01);
 assert.equal(captive.capturedBy,captor.sessionId);
 const at=(ms:number,dt=0)=>{state.time=ms;state.now=NOW+ms;updateHolds(state,state.now,dt);};
 return {state,captor,captive,at,ratio,hold};
}
assert.equal(captureHoldMs(INHALE.EAT_RATIO*20,20),5000);
assert.equal(captureHoldMs(40,20),8000);assert.equal(captureHoldMs(80,20),12000);assert.equal(captureHoldMs(800,20),12000);
let last=0;for(let r=INHALE.EAT_RATIO;r<=5;r+=.01){const ms=captureHoldMs(r*20,20);assert(ms>=last&&ms<=12000);last=ms;}
for(const bot of [false,true]) for(const gems of [0,1,4,5,9,12,101,1000]){
 const {captor,captive,at,ratio,hold}=capture(gems,4000,bot);
 const amount=Math.floor(gems*CANNON.CAPTIVE_GEM_SHARE);
 assert.equal(captor.gems,4000+amount);assert.equal(captive.gems,gems-amount);
 assert.equal(captor.stolenTotal,amount);assert.equal(captive.robbedTotal,amount);
 assert.equal(captive.captureRatio,ratio);assert.equal(captive.captureHoldMs,hold);assert.equal(captor.gulpEndsAt,hold);
 at(hold-1);assert(captive.capturedBy);assert.equal(captive.gems,gems-amount,'no continuing drain');
 at(hold);assert.equal(captive.capturedBy,'');assert(!captive.flying&&captive.state==='alive');
 assert.equal(captive.suctionSafeUntil,NOW+hold+CANNON.ESCAPE_SAFE_MS);
 assert.equal(captor.gems+captive.gems,4000+gems);at(50000);assert.equal(captive.gems,gems-amount);
}
{
 const {state,captor,captive,at,hold}=capture();
 const deadline=captor.gulpEndsAt;
 captor.setGems(0,4200,4200);captive.setGems(100000,4200,4200);
 at(hold-1);assert(captive.capturedBy,'transferred or external growth cannot invalidate an existing capture');
 assert.equal(captor.gulpEndsAt,deadline,'later size relationships never extend the deadline');
 at(hold);assert(!captive.capturedBy);assert.equal(captive.bellyPending,0);assert.equal(state.players.size,2);
}
function collectAll(captive:ReturnType<typeof capture>['captive']){
 for(const gem of BELLY_GEMS){
  for(let tick=0;tick<50&&Math.hypot(gem.x-captive.bellyX,gem.y-captive.bellyY)>.04;tick++){
   const x=gem.x-captive.bellyX,y=gem.y-captive.bellyY,d=Math.hypot(x,y);captive.steer(x/d,y/d);updateBelly(captive,.05);
  }
 }
 captive.steer(0,0);assert.equal(captive.bellyPending,CANNON.BELLY_BONUS_CAP);
}
{
 const {state,captor,captive,at,hold}=capture();const gems=captive.gems,width=captive.width,body={x:captor.x,y:captor.y,angle:captor.facing};
 collectAll(captive);for(let i=0;i<100;i++)updateBelly(captive,.1);
 assert.equal(captive.gems,gems);assert.equal(captive.width,width);assert.deepEqual({x:captor.x,y:captor.y,angle:captor.facing},body);
 at(hold);assert.equal(captive.gems,gems+6);settleBelly(state,captive);at(hold+1);assert.equal(captive.gems,gems+6,'one payout');
}
for(const injured of [false,true]){
 const {state,captor,captive}=capture(100,250,false,injured);collectAll(captive);const gems=captive.gems,width=captive.width;
 assert(!fireCaptive(state,captor,NOW),'capture-causing input cannot fire');
 captor.captureNeedsRelease=false;assert(fireCaptive(state,captor,NOW),'fresh input can fire with no loading');
 assert.equal(captive.width,width);assert.equal(captive.gems,gems);assert.equal(captive.bellyPending,6);
 const position={x:captive.bellyX,y:captive.bellyY};updateBelly(captive,.1);assert.deepEqual({x:captive.bellyX,y:captive.bellyY},position,'collection ends on firing');
 updateFlights(state,NOW+CANNON.FLIGHT_MS,0);
 assert.equal(captive.state,injured?'dead':'alive');assert.equal(captive.gems,injured?0:gems+6);assert.equal(captive.bellyPending,0);
}
for(const ending of ['death','respawn','disconnect','captor-disconnect'] as const){
 const {state,captor,captive,at}=capture();collectAll(captive);const gems=captive.gems;
 if(ending==='death')captive.knockOut(NOW+1);
 if(ending==='respawn')state.spawn(captive,NOW+1);
 if(ending==='disconnect')state.removePlayer(captive.sessionId);
 if(ending==='captor-disconnect')state.removePlayer(captor.sessionId);
 at(200);assert.equal(captive.capturedBy,'');assert.equal(captor.gulping,'');
 assert.equal(captive.bellyPending,0);assert.equal(captive.gems,ending==='captor-disconnect'?gems+6:gems);
}
{
 const {state,captor,captive,at,hold}=capture();collectAll(captive);at(hold);
 const gems=captive.gems;state.time=hold+5000;state.now=NOW+state.time;
 captive.suctionSafeUntil=captive.recaptureAfter=0;captive.sliding=false;
 captive.placeAt(captor.x+captor.width*.8-captive.width/2+1,captor.y+(captor.height-captive.height)/2);
 captor.startInhale(state.now);updateInhales(state,state.now,.01);
 assert.equal(captive.bellyPending,0);assert.equal(captive.bellyCollected,0);
 assert.equal(captive.gems,gems-Math.floor(gems*.3),'a later capture transfers once from its own current gems');
 collectAll(captive);captive.knockOut(state.now+1);state.spawn(captive,state.now+2001);assert.equal(captive.bellyPending,0);
}
console.log('Capture redesign: smooth pre-transfer timing, exact one-time accounting, immediate-fire guard, interior isolation, capped pending rewards, safe ejection, lethal/surviving flight, repeated captures and lifecycle cleanup pass.');
