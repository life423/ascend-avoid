import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { INHALE } from '../constants/gameConstants.js';
import { GemSchema } from '../schema/GemSchema.js';
import { exhale, fireCaptive, injuryVulnerable, steal, updateHolds, updateInhales } from '../systems/inhale.js';
const NOW=100000;
function setup(injured=false,bot=false,giant=false){
 const s=new GameState(0);s.botFill=0;s.weaponsOn=false;s.surgesOn=false;s.setTurbines('off');s.now=NOW;s.time=1000;
 const a=s.addPlayer('a','A',NOW),b=s.addPlayer('b','B',NOW);a.isBot=bot;
 a.setGems(giant?10000:100,4200,4200);b.setGems(giant?4:100,4200,4200);a.placeAt(1200,1200);a.facing=0;a.spawnProtected=b.spawnProtected=false;
 b.placeAt(a.x+a.width*.8+100-b.width/2,a.y+(a.height-b.height)/2);
 if(injured)a.injure(0);a.startInhale(NOW);return{s,a,b};
}
function pull(injured:boolean){const{s,a,b}=setup(injured);const x=b.x;s.gems.set('loose',new GemSchema(a.x+a.width*.8+180,a.y+a.height/2));const gem=s.gems.get('loose');assert(gem);const gx=gem.x;
 updateInhales(s,NOW,.01);return {body:x-b.x,gem:gx-gem.x,a};}
const normal=pull(false),weak=pull(true);
assert(Math.abs(weak.body/normal.body-INHALE.VULNERABLE_OUTGOING)<1e-8,'body pull is multiplied exactly once, after close/max/escape rules');
assert.equal(weak.gem,normal.gem,'loose-gem suction remains normal');
function drain(injured:boolean){const{s,a,b}=setup(injured);b.injure(0);a.heldFor.set(b.sessionId,4);steal(s,a,NOW,.01);return a.stolenTotal+(a.stealShares.get(b.sessionId)??0);}
assert(Math.abs(drain(true)/drain(false)-.15)<1e-8,'outgoing injury drain is multiplied exactly once');
for(const bot of [false,true]){
 const{s,a,b}=setup(true,bot,true);
 const atMouth=()=>b.placeAt(a.x+a.width*.8-b.width/2+1,a.y+(a.height-b.height)/2);
 atMouth();updateInhales(s,NOW,.01);assert(!b.capturedBy&&!a.gulping,'vulnerable close-contact catches are blocked for both roles');
 const until=a.injuredUntil;a.injure(6900);assert.equal(a.injuredUntil,until,'repeat hits do not refresh');
 s.time=7000;s.now=NOW+7000;atMouth();updateInhales(s,s.now,.01);assert.equal(b.capturedBy,a.sessionId,'capture restores at injury expiry');
 a.injure(s.time);const deadline=a.gulpEndsAt;updateHolds(s,s.now+1);assert.equal(a.gulping,b.sessionId,'new injury does not eject a previously held captive');assert.equal(a.gulpEndsAt,deadline);
 a.captureNeedsRelease=false;assert(fireCaptive(s,a,s.now+1),'injury does not cancel a previously held shot');
}
{
 // Insert the giant first: continuation must block its catch even before the last attacker is iterated.
 const{s,a,b}=setup(true,false,true);const c=s.addPlayer('c','Attacker',NOW);c.setGems(40,4200,4200);c.spawnProtected=false;
 c.placeAt(a.x-120-c.width,a.y+(a.height-c.height)/2);c.facing=0;c.startInhale(NOW);
 s.time=6900;steal(s,c,NOW,.01);assert(c.theftContinuations.has(a.sessionId));
 s.time=7100;b.placeAt(a.x+a.width*.8-b.width/2+1,a.y+(a.height-b.height)/2);
 assert(injuryVulnerable(s,a,NOW),'an existing valid continuation extends weakening');updateInhales(s,NOW,.01);
 assert(a.continuedTheft&&!a.gulping&&!b.capturedBy,'continued exposure blocks close catches regardless of map order');
 b.setGems(10000,4200,4200);b.injure(s.time);b.placeAt(a.x+a.width*.8+100-b.width/2,a.y+(a.height-b.height)/2);
 a.stealShares.clear();steal(s,a,NOW,.00001);const continuedRate=a.stealShares.get(b.sessionId)??0;
 c.stopInhale(NOW);a.stealShares.clear();steal(s,a,NOW,.00001);const restoredRate=a.stealShares.get(b.sessionId)??0;
 assert(continuedRate>0&&Math.abs(continuedRate/restoredRate-.15)<1e-6,'continued exposure keeps outgoing drain at 15% until broken');
 b.setGems(4,4200,4200);
 assert(!injuryVulnerable(s,a,NOW),'connection break restores authority immediately');
 b.placeAt(a.x+a.width*.8-b.width/2+1,a.y+(a.height-b.height)/2);updateInhales(s,NOW,.01);assert.equal(a.gulping,b.sessionId);
 assert(!a.continuedTheft);
}
for(const injured of [false,true]){
 const{s,a,b}=setup(injured);a.stopInhale(NOW);b.placeAt(a.x+a.width+25,a.y+(a.height-b.height)/2);exhale(s,a,NOW);
 assert(b.stunned&&a.velocity().x<0,'defensive puff is available at full force under the existing stun rules');
}
{
 const{s,a}=setup(true);s.spawn(a,NOW+100);assert(!injuryVulnerable(s,a,NOW+100));a.spawnProtected=false;a.injure(s.time);s.removePlayer(a.sessionId);assert(!s.players.has(a.sessionId));
}
console.log('Vulnerable inhale passed: exact 15% body/drain, ordinary loose gems, close-contact capture block, fixed window/restoration, continuation/order independence, puff, pre-existing captive preservation, respawn/disconnect and human/bot parity.');
