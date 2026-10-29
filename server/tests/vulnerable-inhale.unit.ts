import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { exhale, syncContinuedTheft, updateInhales, steal, injuryVulnerable } from '../systems/inhale.js';
const NOW=100000;
for(const bot of [false,true]) {
 const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.time=1000;s.now=NOW;
 const a=s.addPlayer('a','A',NOW),b=s.addPlayer('b','B',NOW);a.isBot=bot;a.setGems(100,4200,4200);b.setGems(100,4200,4200);a.spawnProtected=b.spawnProtected=false;a.placeAt(1200,1200);a.facing=0;b.placeAt(1400,1200);
 a.startInhale(NOW);assert(a.inhaling);a.injure(s.time);assert(!a.inhaling&&a.breathingBlocked);a.startInhale(NOW+1);assert(!a.inhaling);
 const breath=a.stamina,cooldown=a.exhaleReadyAt;exhale(s,a,NOW+1);assert.equal(a.stamina,breath);assert.equal(a.exhaleReadyAt,cooldown);assert(!b.stunned);
 a.steer(0,1);const y=a.y;a.updateMovement(4200,4200,NOW+33,.033);assert(a.y>y,'injury preserves movement');
 s.time=a.injuredUntil;syncContinuedTheft(s,NOW+7100);assert(!a.breathingBlocked);a.startInhale(NOW+7100);assert(a.inhaling);
 a.injure(s.time);s.spawn(a,NOW+8000);assert(!a.breathingBlocked&&!injuryVulnerable(s,a));
}
{
 const s=new GameState(0);s.botFill=0;s.time=6900;s.now=NOW;const a=s.addPlayer('victim','Victim',NOW),b=s.addPlayer('thief','Thief',NOW);a.setGems(1000,4200,4200);b.setGems(40,4200,4200);a.spawnProtected=b.spawnProtected=false;
 b.placeAt(1200,1200);b.facing=0;a.placeAt(b.x+b.width*.8+150-a.width/2,b.y+(b.height-a.height)/2);a.injure(0);b.startInhale(NOW);steal(s,b,NOW,.001);assert(b.theftContinuations.has(a.sessionId));
 s.time=7100;syncContinuedTheft(s,NOW);assert(a.breathingBlocked&&a.continuedTheft);a.startInhale(NOW);updateInhales(s,NOW,.001);assert(!a.inhaling);
 b.stopInhale(NOW);syncContinuedTheft(s,NOW);assert(!a.breathingBlocked&&!a.continuedTheft);
}
console.log('Injured breathing blocked; movement, healing/continuation restoration and bot/human parity passed.');
