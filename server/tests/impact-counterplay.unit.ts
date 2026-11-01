import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { CANNON } from '../constants/gameConstants.js';
import { updateInhales, updateHolds, fireCaptive } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';

const now = 100000;
function setup() {
  const s = new GameState(0); s.botFill = 0; s.weaponsOn = s.surgesOn = false; s.setTurbines('off'); s.blackHoles.clear(); s.update(0,now);
  const shooter = s.addPlayer('shooter','Shooter',now), defender = s.addPlayer('defender','Defender',now), held = s.addPlayer('held','Held',now), projectile = s.addPlayer('projectile','Projectile',now);
  shooter.setGems(1000,4200,4200); defender.setGems(1000,4200,4200); held.setGems(100,4200,4200); projectile.setGems(20,4200,4200);
  for (const p of [shooter,defender,held,projectile]) p.dropProtection();
  shooter.placeAt(100,100); defender.placeAt(1600,1600); defender.facing = 0;
  held.placeAt(defender.x+defender.width*.8-held.width/2+1,defender.y+(defender.height-held.height)/2);
  defender.startInhale(now); updateInhales(s,now,.001); assert.equal(defender.gulping,held.sessionId);
  defender.stopInhale(now); defender.captureNeedsRelease = false;
  projectile.placeAt(defender.x-projectile.width-80,defender.y+(defender.height-projectile.height)/2);
  projectile.launch(now,1250,0,shooter.sessionId,CANNON.FLIGHT_MS);
  updateFlights(s,now+100,.1); assert(projectile.flightHit); assert(defender.stunned); assert(defender.breathingBlocked);
  updateHolds(s,now+100);
  return {s,defender,held};
}
{
  const {s,defender,held}=setup();
  assert.equal(defender.gulping,held.sessionId,'ordinary missile daze preserves prepared ammunition');
  assert(!fireCaptive(s,defender,now+101),'stun still blocks firing until recovery');
  assert.equal(defender.suctionSafeUntil,now+100+CANNON.IMPACT_SUCTION_SAFE_MS);
  defender.updateMovement(4200,4200,now+100+CANNON.IMPACT_STUN_MS,.45);
  assert(!defender.stunned); assert(defender.breathingBlocked,'injury breathing lock remains');
  assert(fireCaptive(s,defender,now+100+CANNON.IMPACT_STUN_MS),'an injured survivor can use its previously prepared shot after the daze');
}
{
  const {s,defender,held}=setup();
  defender.stun(now+600,400); updateHolds(s,now+600);
  assert.equal(defender.gulping,''); assert.equal(held.capturedBy,'','other hard stuns still free the captive');
}
{
  const {s,defender,held}=setup(); defender.knockOut(now+110); updateHolds(s,now+110);
  assert.equal(held.capturedBy,'','knockout always releases the captive');
  s.spawn(defender,now+3000); assert(!defender.holdThroughStun,'respawn clears the brief-daze exception');
}
console.log('Impact counterplay: prepared shots survive only brief missile daze; injury/stun firing limits, suction recovery, hard-stun release, knockout and respawn remain correct.');
