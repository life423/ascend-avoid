import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { ObstacleSchema } from '../schema/ObstacleSchema.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { offerShotFollow, followConsumesInhale, updateShotFollow } from '../systems/shotFollow.js';
import { updateFlights } from '../systems/flights.js';
import { updateWeapons, spawnWeapon } from '../systems/weapons.js';
import { CANNON, SHOT_FOLLOW } from '../constants/gameConstants.js';
const NOW=100000;
function setup(){const s=new GameState(0);s.botFill=0;s.weaponsOn=false;s.surgesOn=false;s.setTurbines('off');s.time=1000;s.obstacles.clear();
 const p=s.addPlayer('shooter','Shooter',NOW);p.placeAt(1000,1000);p.spawnProtected=false;return {s,p};}
for(const bot of [false,true]){
 const{s,p}=setup();p.isBot=bot;p.startInhale(NOW);offerShotFollow(s,p.sessionId,1400,1010);
 assert(!followConsumesInhale(s,p),'already-held input cannot engage');const x=p.x;updateShotFollow(s,p,.1);assert.equal(p.x,x);
 p.stopInhale(NOW);p.startInhale(NOW+1);assert(followConsumesInhale(s,p));const deadline=p.followUntil;
 offerShotFollow(s,p.sessionId,2000,2200);assert.equal(p.followX,1400);assert.equal(p.followUntil,deadline,'repeated hits do not stack or extend');
 updateShotFollow(s,p,.1);assert(p.x>x&&p.x-x<=SHOT_FOLLOW.SPEED*.1);assert.equal(p.gems,0);
 p.stopInhale(NOW+100);assert(!p.followActive&&p.followUntil===0);const released=p.x;updateShotFollow(s,p,.1);assert.equal(p.x,released);
}
{
 const{s,p}=setup();offerShotFollow(s,p.sessionId,1400,1010);p.startInhale(NOW);
 for(let i=0;i<60&&p.followUntil;i++){s.time+=20;updateShotFollow(s,p,.02);}
 assert(!p.followActive);assert(p.x+10<=1400-SHOT_FOLLOW.STOP_DISTANCE+.01,'no overshoot');assert(p.x>1100);
}
{
 const{s,p}=setup();offerShotFollow(s,p.sessionId,3500,1010);p.startInhale(NOW);const x=p.x;
 for(let i=0;i<50&&p.followUntil;i++){s.time+=40;updateShotFollow(s,p,.04);}
 assert(p.x-x<=SHOT_FOLLOW.MAX_TRAVEL+.01);assert(!p.followActive,'travel/time bound ends the effect');
}
for(const wall of ['boundary','obstacle'] as const){
 const{s,p}=setup();if(wall==='boundary')p.placeAt(4150,1000);else{const o=new ObstacleSchema();o.x=1080;o.y=950;o.width=10;o.height=150;s.obstacles.push(o);}
 offerShotFollow(s,p.sessionId,wall==='boundary'?5000:1500,1010);p.startInhale(NOW);
 for(let i=0;i<30;i++){s.time+=30;updateShotFollow(s,p,.03);}
 assert(wall==='boundary'?p.x+p.width<=4192:p.hitBox().x+p.hitBox().width<1080,'follow respects swept obstacle and arena boundaries');
}
for(const clear of ['death','capture','flight','respawn','disconnect','timeout'] as const){
 const{s,p}=setup();offerShotFollow(s,p.sessionId,1500,1010);p.startInhale(NOW);followConsumesInhale(s,p);
 if(clear==='death')p.knockOut(NOW);if(clear==='capture')p.capturedBy='other';if(clear==='flight')p.launch(NOW,200,0,'other',1000);
 if(clear==='respawn')s.spawn(p,NOW);if(clear==='disconnect')s.removePlayer(p.sessionId);if(clear==='timeout')s.time=p.followUntil;
 if(clear!=='disconnect')updateShotFollow(s,p,.1);
 assert(clear==='disconnect'?!s.players.has(p.sessionId):!p.followActive&&p.followUntil===0);
}
for(const hit of [false,true]){
 const{s,p}=setup();const projectile=s.addPlayer('projectile','Projectile',NOW);projectile.placeAt(1500,1000);projectile.launch(NOW,1250,0,p.sessionId,CANNON.FLIGHT_MS);
 if(hit){const t=s.addPlayer('victim','Victim',NOW);t.setGems(1000,4200,4200);t.spawnProtected=false;t.placeAt(1700-t.width/2,1010-t.height/2);}
 updateFlights(s,NOW+100,.1);assert.equal(p.followUntil>0,hit,'only actual player-cannonball hits create opportunity');
 if(hit){const x=p.followX,y=p.followY;const t=s.players.get('victim');assert(t);t.placeAt(3000,3000);assert.equal(p.followX,x);assert.equal(p.followY,y,'destination never tracks victim');}
}
for(const kind of ['comet','pinwheel'] as const){
 const{s,p}=setup();s.weaponsOn=true;spawnWeapon(s,1800,1000,kind);const w=s.pinwheel;w.owner=p.sessionId;w.phase='active';w.nextShotAt=Infinity;w.at=999999;
 const t=s.addPlayer('victim','Victim',NOW);t.setGems(1000,4200,4200);t.spawnProtected=false;t.placeAt(1950-t.width/2,1000-t.height/2);
 const b=new WeaponBoltSchema();b.x=1850;b.y=1000;b.angle=0;b.bornAt=s.time;w.bolts.set('shot',b);updateWeapons(s,.2,NOW);
 assert.equal(p.followUntil>0,kind==='comet','owned comet attribution qualifies; other weapons do not');
}
console.log('Shot follow passed: hit/miss and cannon/comet attribution, fixed destination, fresh input, cancellation, smooth bounds, arrival, walls, repeated hits and lifecycle cleanup for humans/bots.');
