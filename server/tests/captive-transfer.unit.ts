import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CANNON, INHALE } from '../constants/gameConstants.js';
import { captureHoldMs } from '../game/cannon.js';
import { updateHolds, updateInhales } from '../systems/inhale.js';
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
 at(hold);assert(!captive.capturedBy);assert.equal(state.players.size,2);
}

console.log('Healthy capture transfer, fixed holds, timeout and shared bot/human rules passed.');
