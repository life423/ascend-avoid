/** Reproducible comparison with the released 15%/30% taper; no state mutations. */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { creatureSize, bodyMass } from '../server/dist/game/creatureSize.js';
import { moveSpeed, turnStep } from '../server/dist/game/movement.js';
import { GEMS, WORLD, INHALE, BLACK_HOLE } from '../server/dist/constants/gameConstants.js';

function released(gems) {
  const mass = (gems <= 40 ? gems : 40 + 600 / .8 * Math.expm1(.8 * Math.log1p((gems - 40) / 600))) * .5;
  const raw = 20 * Math.sqrt(1 + mass / 2);
  return Math.min(1260, Math.round((raw <= 630 ? raw : 630 - 630 * Math.expm1(-(raw - 630) / 630)) * 2) / 2);
}
assert.equal(released(10000), 794.5); assert.equal(released(100000), 1199.5);
assert.equal(WORLD.WIDTH, 4200); assert.equal(WORLD.HEIGHT, 4200);
const rows = [1000,5000,10000,20000,50000,100000,200000,1000000].map(gems => {
  const before = released(gems), after = creatureSize(gems);
  return {gems, releasedWidth:before, trialWidth:after,
    releasedDoublingGainPct:100*(released(gems*2)/before-1), trialDoublingGainPct:100*(creatureSize(gems*2)/after-1),
    trialMass:bodyMass(after), releasedWalkSpeed:moveSpeed(before), trialWalkSpeed:moveSpeed(after),
    trialOneBodySeconds:after/moveSpeed(after),trialArenaSpanSeconds:(WORLD.WIDTH-after-16)/moveSpeed(after),
    trialInhaleReach:INHALE.REACH+after*INHALE.REACH_PER_SIZE};
});
const movement=[20,301,612,1049,1279,1386,1470].map(width=>{
  let pose={facing:0,spin:0},ticks=0;
  while(Math.abs(pose.facing-Math.PI/2)>.01&&ticks<1800){pose=turnStep(pose.facing,pose.spin,Math.PI/2,width,false,1/30);ticks++;}
  assert(ticks<1800);
  return {width,speed:moveSpeed(width),oneBodySeconds:width/moveSpeed(width),ninetyDegreeTurnSeconds:ticks/30,
    halfWidthSpeedAdvantagePct:100*(moveSpeed(Math.max(20,width/2))/moveSpeed(width)-1),
    captureSizedPreySpeedAdvantagePct:100*(moveSpeed(Math.max(20,width/1.3))/moveSpeed(width)-1)};
});
// <5% width per score doubling is a declared analysis proxy, not a measured human preference.
function fades(size) {
  for(let gems=5000;gems<=1000000;gems+=1000) if(size(gems*2)/size(gems)<1.05) return gems;
  return null;
}
const report = {date:'2026-11-04', world:[WORLD.WIDTH,WORLD.HEIGHT],
  blackHolePositions:BLACK_HOLE.POSITIONS,
  trial:{softStart:GEMS.SIZE_SOFT_START_SHARE,maximum:GEMS.SIZE_MAX_SHARE},
  lessThanFivePercentPerDoubling:{released:fades(released),trial:fades(creatureSize)}, rows,movement,
  limits:'A finite arena still needs bounded physical size. These are curve measurements, not human fun validation. Larger bodies inherently change mass, reach, movement speed and capture matchups through unchanged formulas.'};
const target=process.argv[2]; if(target)writeFileSync(target,JSON.stringify(report,null,2)+'\n');
console.table(rows.map(r=>({gems:r.gems,before:r.releasedWidth,trial:r.trialWidth,oldDoublePct:r.releasedDoublingGainPct.toFixed(1),newDoublePct:r.trialDoublingGainPct.toFixed(1)})));
console.log(report.lessThanFivePercentPerDoubling);
console.table(movement.map(r=>({width:r.width,speed:r.speed.toFixed(1),bodyLengthSeconds:r.oneBodySeconds.toFixed(1),turn90Seconds:r.ninetyDegreeTurnSeconds.toFixed(2)})));
