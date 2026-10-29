import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { PlayerSchema } from '../schema/PlayerSchema.js';
import { CANNON } from '../constants/gameConstants.js';
import { captureGrowthTransfer, launchSpeed } from '../game/cannon.js';
import { creatureSize } from '../game/creatureSize.js';
import { clearCapture, fireCaptive, updateHolds, updateInhales } from '../systems/inhale.js';
import { updateFlights } from '../systems/flights.js';

const NOW=100000;
function captured(gems: number, bot = false) {
  const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.surgesOn=s.weaponsOn=false;s.setTurbines('off');s.blackHoles.clear();s.update(0,NOW);
  const owner=s.addPlayer('owner','Owner',NOW),ammo=s.addPlayer('ammo','Ammo',NOW);
  // Use the same final shooter body to isolate ammunition source from projectile behavior.
  owner.setGems(4000-captureGrowthTransfer(gems),4200,4200);ammo.setGems(gems,4200,4200);
  owner.isBot=ammo.isBot=bot;owner.dropProtection();ammo.dropProtection();owner.placeAt(1400,1500);owner.facing=0;
  ammo.placeAt(owner.x+owner.width*.8+1-ammo.width/2,owner.y+(owner.height-ammo.height)/2);
  const initial=owner.gems+ammo.gems,sourceWidth=ammo.width;
  owner.startInhale(NOW);updateInhales(s,NOW,.001);assert.equal(owner.gulping,ammo.sessionId);
  owner.stopInhale(NOW);owner.captureNeedsRelease=false;
  assert.equal(owner.gems+ammo.gems,initial);assert.equal(owner.gems,4000);
  return {s,owner,ammo,initial,sourceWidth};
}

for(const bot of [false,true])for(const gems of [0,4,12,32,33,100,1000]) {
  const {s,owner,ammo,sourceWidth}=captured(gems,bot),kept=ammo.gems,deadline=owner.gulpEndsAt;
  assert.equal(kept,Math.min(gems,32));assert.equal(ammo.width,creatureSize(kept));
  if(sourceWidth<=60)assert.equal(owner.stolenTotal,0,'small captives do not grant an immediate capture reward');
  else assert.equal(owner.stolenTotal,gems-kept,'all excess growth transfers immediately');
  updateHolds(s,NOW+100);assert.equal(ammo.gems,kept);assert.equal(owner.gulpEndsAt,deadline);
  assert(fireCaptive(s,owner,NOW+101));assert.equal(ammo.width,60);assert.equal(ammo.height,60);
  assert.equal(ammo.gems,kept,'the standard shell grants no free growth');
  assert.equal(Math.hypot(ammo.flightVx,ammo.flightVy),launchSpeed(owner.width),'same shooter launches the same projectile regardless of captured size');
  const centre={x:ammo.x+30,y:ammo.y+30};ammo.land();
  assert.equal(ammo.width,creatureSize(kept));assert.equal(ammo.x+ammo.width/2,centre.x);assert.equal(ammo.y+ammo.height/2,centre.y);
}
for(const reason of ['timeout','disconnect','death'] as const) {
  const {s,owner,ammo,initial}=captured(1000);
  if(reason==='timeout'){s.time=owner.gulpEndsAt;updateHolds(s,NOW+s.time);}
  else if(reason==='disconnect')s.removePlayer(owner.sessionId);
  else{owner.knockOut(NOW+1);updateHolds(s,NOW+1);}
  assert.equal(ammo.capturedBy,'');assert.equal(ammo.gems,32);assert.equal(ammo.width,60);
  assert.equal(owner.gems+ammo.gems,initial,'release never awards or refunds a second capture transfer');
}
{
  const {s,owner,ammo}=captured(1000);clearCapture(s,owner.sessionId,NOW+1);
  ammo.dropProtection();ammo.suctionSafeUntil=ammo.recaptureAfter=0;
  ammo.placeAt(owner.x+owner.width*.8+1-ammo.width/2,owner.y+(owner.height-ammo.height)/2);
  owner.startInhale(NOW+2);updateInhales(s,NOW+2,.001);
  assert.equal(owner.gulping,ammo.sessionId);assert.equal(owner.gems,4000,'recapturing an already reduced captive cannot farm the reward again');
}
for(const gems of [0,4,12,32,1000]) {
  const {s,owner,ammo}=captured(gems);assert(fireCaptive(s,owner,NOW));
  ammo.placeAt(2200,2200);updateFlights(s,NOW+CANNON.FLIGHT_MS+1,0);
  assert(!ammo.flying);
  assert.equal(ammo.state,Math.min(gems,32)<CANNON.BURNUP_GEMS?'dead':'alive','the existing small-missile burnup rule still uses retained growth');
  assert.equal(ammo.width,creatureSize(ammo.gems));
}
for(const angle of [0,Math.PI/2,Math.PI,-Math.PI/2]) {
  const {s,owner,ammo}=captured(100);
  owner.placeAt(angle===0?4200-owner.width-8:8,angle===Math.PI/2?4200-owner.height-8:8);owner.facing=angle;
  assert(fireCaptive(s,owner,NOW));
  assert(ammo.x>=8&&ammo.y>=8&&ammo.x+ammo.width<=4192&&ammo.y+ammo.height<=4192,'a larger flight shell never appears beyond an arena edge');
  updateFlights(s,NOW+100,.1);assert.equal(ammo.state,'dead','an outward shot at the edge hits the wall instead of moving outside');
}
for(const gems of [0,1000])for(const hits of [false,true]) {
  const {s,owner,ammo}=captured(gems);assert(fireCaptive(s,owner,NOW));
  const target=s.addPlayer('target','Target',NOW);target.setGems(100,4200,4200);target.dropProtection();
  const radius=(target.width+CANNON.BULLET_SIZE)/2;
  target.placeAt(ammo.x+30+350-target.width/2,ammo.y+30+radius+(hits?-1:1)-target.height/2);
  updateFlights(s,NOW+300,.3);assert.equal(ammo.flightHit,hits,'the swept collision radius is identical for newborn and previously large ammunition');
}
{
  const p=new PlayerSchema('flight',0);p.setGems(12,1600,1600);p.placeAt(700,700);p.launch(NOW,1250,0,'owner',2600);
  p.setGems(20,1600,1600);assert.equal(p.width,60,'growth changes do not resize a flying bullet');p.land();assert.equal(p.width,creatureSize(20,1600,1600));
  p.setGems(1000,1600,1600);const natural=p.width;p.launch(NOW,900,0,'',2600,.35,'turbine');assert.equal(p.width,natural,'turbine transportation keeps its natural body');
  p.land();assert.equal(p.width,natural);
}
console.log('Standard bullets passed: conserved immediate excess growth, no small-captive reward/free growth, fixed flight geometry/speed per shooter, equal swept hits, release/recapture/landing/burnup and turbine compatibility.');
