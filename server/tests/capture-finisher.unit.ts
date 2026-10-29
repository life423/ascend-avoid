import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { updateInhales, finishWithReward, fireCaptive, updateHolds } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';
import { lethalPlayerImpact } from '../game/cannon.js';
const NOW=100000;
function setup(injured=true,bot=false,gap=1) {
 const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.time=1000;s.now=NOW;
 const a=s.addPlayer('a','Attacker',NOW),b=s.addPlayer('b','Prey',NOW);a.setGems(4000,4200,4200);b.setGems(100,4200,4200);a.placeAt(1100,1100);a.facing=0;
 b.placeAt(a.x+a.width*.8-b.width/2+gap,a.y+(a.height-b.height)/2);a.spawnProtected=b.spawnProtected=false;a.isBot=b.isBot=bot;if(injured)b.injure(0);
 const events:{type:string;data:Record<string,unknown>}[]=[];s.onEvent=(type,data)=>events.push({type,data});return{s,a,b,events};
}
for(const bot of [false,true]) {
 const{s,a,b,events}=setup(true,bot);a.startInhale(NOW);updateInhales(s,NOW,.001);
 assert.equal(b.state,'dead');assert.equal(b.capturedBy,'');assert.equal(a.gulping,'');assert.equal(a.gems,4100);assert.equal(b.gems,0);assert.equal(s.gems.size,0);
 updateInhales(s,NOW+1,.001);assert.equal(events.filter(e=>e.type==='combatReward').length,1,'one conserved reward, never both share and finish');s.spawn(b,b.respawnAt);assert(b.spawnProtected);assert.equal(b.state,'alive');
}
{const{s,a,b}=setup(true,false,190);a.startInhale(NOW);updateInhales(s,NOW,.01);assert.equal(b.state,'alive','range alone is not a mouth finish');}
{const{s,a,b}=setup(false);a.startInhale(NOW);updateInhales(s,NOW,.001);assert.equal(b.capturedBy,a.sessionId);assert.equal(a.gems+b.gems,4100);a.injure(s.time);a.captureNeedsRelease=false;assert(fireCaptive(s,a,NOW+10),'injury allows an already-held shot');assert(b.flying);updateFlights(s,NOW+3000,0);assert.equal(b.state,'alive');}
{const{s,a,b}=setup(false);a.startInhale(NOW);updateInhales(s,NOW,.001);const total=a.gems+b.gems;b.steer(1,1);s.time=a.gulpEndsAt;updateHolds(s,NOW+12000,.1);assert.equal(b.capturedBy,'');assert.equal(a.gems+b.gems,total,'no captive bonus payout');}
for(const recipient of ['alive','dead','missing']) {
 const{s,a,b,events}=setup(),original=a.gems;if(recipient==='dead')a.knockOut(NOW);if(recipient==='missing')s.removePlayer(a.sessionId);
 const earned=finishWithReward(s,b,a.sessionId,NOW,'cannon');assert.equal(earned,recipient==='missing'?0:100);
 if(recipient==='alive')assert.equal(a.gems,original+100);
 if(recipient==='dead'){assert.equal(a.pendingCombatGems,100);s.spawn(a,a.respawnAt);assert.equal(a.gems,original+100);s.spawn(a,NOW+4000);assert.equal(a.gems,original+100);}
 if(recipient==='missing')assert.equal([...s.gems.values()].reduce((n,g)=>n+g.value,0),100);
 finishWithReward(s,b,a.sessionId,NOW+1,'cannon');assert.equal(events.filter(e=>e.type==='combatReward').length,1);
}
assert(!lethalPlayerImpact(1250,20,300));assert(!lethalPlayerImpact(1250,100,100));assert(lethalPlayerImpact(1250,130,100));assert(!lethalPlayerImpact(500,130,100));assert(!lethalPlayerImpact(NaN,130,100));
console.log('Mouth finish/range, healthy captive/no minigame, reward conservation/respawn/disconnect and size-speed lethality passed.');
