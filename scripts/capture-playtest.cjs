// Controlled real-server capture paths; an ideal interior collector is not a human playtest.
// npm run build:server && node scripts/capture-playtest.cjs --out=report.json
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { GameState } = require('../server/dist/schema/GameState.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { BELLY_GEMS, canCatch, captureHoldMs, launchSpeed, shooterMassContribution, impactGems } = require('../server/dist/game/cannon.js');
const { updateInhales, updateHolds, fireCaptive } = require('../server/dist/systems/inhale.js');
const { updateFlights } = require('../server/dist/systems/flights.js');
const { CANNON, SHOT_FOLLOW, EXHALE, INHALE } = require('../server/dist/constants/gameConstants.js');
const START = 100000, dt = 1 / 60;
function gemsAtWidth(width) {
  let lo = 0, hi = 1e7;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width) lo = mid + 1; else hi = mid; }
  return lo;
}
function scenario(ratio, injured, ending) {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = s.weaponsOn = false; s.setTurbines('off'); s.blackHoles.clear(); s.time = 10000;
  const a = s.addPlayer('captor', 'Captor', START), b = s.addPlayer('captive', 'Captive', START);
  const initial = 100, builder = gemsAtWidth(creatureSize(initial) * ratio);
  a.setGems(builder,4200,4200); b.setGems(initial,4200,4200); a.placeAt(1800,1800); a.facing = 0;
  b.placeAt(a.x+a.width*.8-b.width/2+5,a.y+(a.height-b.height)/2); a.spawnProtected = b.spawnProtected = false;
  if(injured) b.injure(s.time);
  const widthRatio = a.width / b.width, expectedHold = captureHoldMs(a.width,b.width);
  a.startInhale(START); updateInhales(s,START,0);
  assert.equal(b.capturedBy,a.sessionId); assert.equal(a.gems+b.gems,builder+initial);
  assert.equal(b.gems,70); assert.equal(b.captureHoldMs,expectedHold);
  const maximum = ending === 'eject' ? Math.ceil(expectedHold/dt/1000) : Math.floor((expectedHold-100)/dt/1000);
  let collected = 0, allCollectedAt = null;
  for (let tick = 1; tick <= maximum; tick++) {
    const available = BELLY_GEMS.map((gem,i)=>({...gem,i})).filter(gem=>!(b.bellyCollected & (1<<gem.i)));
    available.sort((p,q)=>Math.hypot(p.x-b.bellyX,p.y-b.bellyY)-Math.hypot(q.x-b.bellyX,q.y-b.bellyY));
    const gem = available[0]; b.steer(gem ? gem.x-b.bellyX : 0,gem ? gem.y-b.bellyY : 0);
    // The stick normalizes a direction only if stronger than one; drive it deliberately at full strength.
    if(gem) { const x=gem.x-b.bellyX,y=gem.y-b.bellyY,d=Math.hypot(x,y); b.steer(x/d,y/d); }
    s.time = 10000+tick*dt*1000; updateHolds(s,START+tick*dt*1000,dt);
    collected = Math.max(collected,b.bellyPending);
    if(collected===CANNON.BELLY_BONUS_CAP&&allCollectedAt===null) allCollectedAt=Math.round(tick*dt*1000);
  }
  if(ending==='eject'&&b.capturedBy) {s.time=a.gulpEndsAt;updateHolds(s,START+expectedHold);}
  const pendingBeforeFlight = b.bellyPending;
  if(ending==='fire') {
    a.captureNeedsRelease=false;assert(fireCaptive(s,a,START+expectedHold-100));
    updateFlights(s,START+expectedHold+CANNON.FLIGHT_MS,0);
  }
  assert.equal(a.gems,builder+30,'capture never keeps draining');
  assert.equal(b.bellyPending,0,'one final payout or discard');
  assert.equal(b.state,injured&&ending==='fire'?'dead':'alive');
  return { requestedRatio:ratio,actualPreTransferRatio:Number(widthRatio.toFixed(4)),injured,ending,holdMs:Math.round(expectedHold),captureTransfer:30,collected,allCollectedAtMs:allCollectedAt,pendingBeforeFlight,finalCaptiveGems:b.gems,alive:b.state==='alive',protectedMs:b.state==='alive'?Math.round(b.suctionSafeUntil-(START+(ending==='eject'?expectedHold:expectedHold+CANNON.FLIGHT_MS))):0 };
}
const capture=[];for(const ratio of [1.3,2,4])for(const injured of [false,true])for(const ending of ['eject','fire'])capture.push(scenario(ratio,injured,ending));
const power=[];for(const shooter of [80,200,800])for(const ammo of [20,60,160])if(canCatch(shooter,ammo))power.push({shooterWidth:shooter,ammoWidth:ammo,targetWidth:200,targetGems:1000,launchSpeed:launchSpeed(shooter,ammo),damageAtCommonSpeed:impactGems(1000,1250,ammo,200,shooterMassContribution(shooter,ammo))});
const report={methodology:'Actual server capture/hold/fire/flight-expiry methods at 60Hz; stationary captor, healthy initial captive 100 gems or injury snapshot, ideal full-stick nearest-gem collector. Not chase performance, human ease, fun or final balance.',constants:{captureShare:CANNON.CAPTIVE_GEM_SHARE,bellyCap:CANNON.BELLY_BONUS_CAP,hold:[CANNON.HOLD_MIN_MS,CANNON.HOLD_DOUBLE_MS,CANNON.HOLD_MAX_MS],follow:SHOT_FOLLOW,puff:EXHALE,injuryMs:INHALE.INJURY_MS,vulnerableOutgoing:INHALE.VULNERABLE_OUTGOING},capture,power};
const out=process.argv.find(s=>s.startsWith('--out='));if(out)fs.writeFileSync(out.slice(6),JSON.stringify(report,null,2));
console.log(JSON.stringify({capture,power}));
