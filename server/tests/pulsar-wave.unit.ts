import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { PinwheelSchema, WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { spawnWeapon, updateWeapons } from '../systems/weapons.js';
import { SHOCKWAVE } from '../constants/gameConstants.js';
import { pulsarContact, pulsarHeading, pulsarRadius } from '../game/pulsar.js';
import { BotPulsarDodge } from '../game/botPulsar.js';

const wave = { x: 0, y: 0, facing: 0, at: 1000 }, NOW = 100000;
for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
  const w = { ...wave, facing: angle };
  const point = (off: number) => ({ x: Math.cos(angle + off) * 200, y: Math.sin(angle + off) * 200 });
  for (const off of [0, SHOCKWAVE.HALF_ARC, -SHOCKWAVE.HALF_ARC]) assert(pulsarContact(w, point(off), point(off), 0, SHOCKWAVE.WAVE_MS, 10));
  for (const off of [Math.PI, Math.PI / 2, SHOCKWAVE.HALF_ARC + .3]) assert(!pulsarContact(w, point(off), point(off), 0, SHOCKWAVE.WAVE_MS, 10), 'rear and side space remain open');
}
assert(pulsarContact(wave, {x:200,y:300}, {x:200,y:-300}, 265, 515, 10), 'a fast crossing between two outside endpoints cannot tunnel through the crescent');
assert(!pulsarContact(wave, {x:-200,y:0}, {x:200,y:0}, -1000, 0, 10), 'movement before release cannot cause a retroactive hit');
assert(!pulsarContact(wave, {x:100,y:0}, {x:500,y:0}, 899, 1900, 10), 'movement after expiry cannot cause a retroactive hit');
assert(pulsarContact(wave, {x:420,y:0}, {x:420,y:0}, 880, 920, 10), 'the last live segment counts across an expiry tick');
assert(!pulsarContact(wave, {x:421,y:0}, {x:421,y:0}, 880, 920, 10), 'nothing beyond the physical front is hit');
assert(!pulsarContact(wave, {x:-20,y:0}, {x:-20,y:0}, 0, 900, 90), 'a large core behind the emitter is not rear defense');
{
  const w = { angle: 0, pulseAt: 1000, pulseFacing: 0, beatAt: 1000 + SHOCKWAVE.BEAT_MS };
  assert.equal(pulsarHeading(w, 1100), 0, 'follow-through is locked');
  assert(pulsarHeading(w, 1800) > 0 && pulsarHeading(w, 1800) < SHOCKWAVE.TURN_STEP);
  for (let time = w.beatAt - SHOCKWAVE.WINDUP_MS; time <= w.beatAt; time += 25) assert.equal(pulsarHeading(w, time), SHOCKWAVE.TURN_STEP, 'the whole charge has one heading');
}

function scene(bot = false, gems = 100) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = true; s.surgesOn = false; s.setTurbines('off'); s.time = 1000;
  const owner = s.addPlayer('owner','Owner',NOW), p = s.addPlayer('target','Target',NOW);
  owner.placeAt(100,100); owner.dropProtection(); p.setGems(gems,4200,4200); p.dropProtection(); p.isBot = bot;
  spawnWeapon(s,2100,2100,'pulsar'); const w=s.pinwheel;
  w.owner=owner.sessionId; w.phase='active'; w.at=20000; w.beatAt=s.time; w.angle=0;
  p.placeAt(2280-p.width/2,2100-p.height/2);
  return {s,w,p,owner};
}
for(const bot of [false,true]) {
  const {s,w,p,owner}=scene(bot);
  updateWeapons(s,0,NOW); s.time+=400;updateWeapons(s,.4,NOW+400);
  assert.equal(p.gems,85);assert.equal(owner.gems,15);assert(p.injuredUntil>s.time);
  assert(!p.stunned&&!p.sliding&&p.puffVx>0,'a landed hit retains control');
  const y=p.y,heading=p.facing; p.steer(0,1);p.updateMovement(4200,4200,NOW+417,.017);
  assert(p.y>y&&p.facing!==heading,'steering and rotation work during the pulse push');
  const headingAtRelease=w.pulseFacing;
  s.time=1800;updateWeapons(s,.4,NOW+800);
  assert(w.angle>headingAtRelease);assert.equal(w.pulseFacing,headingAtRelease,'emitter rotation cannot steer the wave');
}
{
  const {s,w,p}=scene(false,0);const a=58*Math.PI/180;
  p.placeAt(2100+Math.cos(a)*380-p.width/2,2100+Math.sin(a)*380-p.height/2);
  updateWeapons(s,0,NOW);w.x+=200;s.time+=840;updateWeapons(s,.84,NOW+840);
  assert.equal(w.pulseX,2100);assert.equal(w.pulseFacing,0);assert(w.angle>0);
  assert.equal(p.state,'alive','a moving/rotating emitter cannot swing the released wave into a flank');
}
{
  const {s,w,owner,p}=scene();p.placeAt(100,400);
  owner.placeAt(2050-owner.width/2,2100-owner.height/2);
  const enemy=new PinwheelSchema();enemy.kind='pinwheel';enemy.phase='active';enemy.owner=p.sessionId;enemy.at=10000;enemy.nextShotAt=Infinity;
  const bolt=new WeaponBoltSchema();bolt.x=2460;bolt.y=2100;bolt.angle=Math.PI;bolt.bornAt=-3000;enemy.bolts.set('incoming',bolt);s.weaponSets.push(enemy);
  updateWeapons(s,0,NOW);s.time+=1000;updateWeapons(s,1,NOW+1000);
  assert.equal(owner.state,'dead','a hostile shot can pass through the outgoing crescent and hit the builder');
  assert.equal(enemy.bolts.size,0);assert.equal(w.pulseHits.has(owner.sessionId),false,'own-wave immunity is not protection against a rival');
}
{
  const {s,w,p,owner}=scene(false,0);w.beatAt=s.time+SHOCKWAVE.WINDUP_MS;
  const brain=new BotPulsarDodge(()=>0);
  assert.equal(brain.move(p,s,NOW),undefined);assert.equal(brain.move(p,s,NOW+249),undefined,'bots wait before responding');
  const move=brain.move(p,s,NOW+250);assert(move==='up'||move==='down'||move==='left'||move==='right','a visible locked charge can prompt ordinary steering');
  const own=new BotPulsarDodge(()=>0);assert.equal(own.move(owner,s,NOW+500),undefined);
}

// Independent dense-time oracle checks the analytic sweep across moving targets and varied radii.
let seed=73;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let c=0;c<200;c++) {
  const from={x:random()*1000-500,y:random()*1000-500},to={x:random()*1000-500,y:random()*1000-500};
  const start=random()*700-150,end=start+100+random()*700,body=10+random()*80;
  let closest=Infinity;
  for(let i=0;i<=2000;i++) {
    const t=i/2000,age=start+(end-start)*t;if(age<0||age>SHOCKWAVE.WAVE_MS)continue;
    const x=from.x+(to.x-from.x)*t,y=from.y+(to.y-from.y)*t;if(x<0)continue;
    const a=Math.max(-SHOCKWAVE.HALF_ARC,Math.min(SHOCKWAVE.HALF_ARC,Math.atan2(y,x))),r=pulsarRadius(age);
    closest=Math.min(closest,Math.hypot(x-r*Math.cos(a),y-r*Math.sin(a)));
  }
  const hit=pulsarContact(wave,from,to,start,end,body),limit=body+SHOCKWAVE.FRONT_HALF_WIDTH;
  if(closest<=limit-.01)assert(hit,'analytic sweep cannot miss a sampled contact');
  if(hit)assert(closest<=limit+2,'analytic sweep cannot hit far outside the visible arc');
}
console.log('Pulsar crescents passed: locked recovery/charge, finite front-only sweeps, high-speed/expiry crossings, no steering lock, shared damage, builder exposure, bot reactions and independent collision oracle.');
