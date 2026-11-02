import assert from 'node:assert/strict';
import { firstImpact, playerMissileShot, PLAYER_SHOT_WARNING_S, type IncomingShot } from '../game/incomingShot.js';
import { BotProjectileDodge } from '../game/botProjectiles.js';
const target={x:0,y:0,vx:0,vy:0,radius:20};
const shot:IncomingShot={id:'a',x:500,y:0,vx:-1000,vy:0,radius:20,visible:false};
assert.equal(firstImpact(target,[shot])?.seconds,.46,'approaching offscreen shot warns in the half-second window');
assert.equal(firstImpact(target,[{...shot,y:41}]),null,'a near miss outside collision radii stays quiet');
assert.equal(firstImpact(target,[{...shot,vx:1000}]),null,'departing shots stay quiet');
assert.equal(firstImpact(target,[{...shot,x:600}]),null,'impacts beyond half a second stay quiet');
assert(firstImpact({...target,vx:100},[shot]));assert.equal(firstImpact({...target,vx:-100},[shot]),null,'target velocity affects time to impact');
assert(firstImpact({...target,vy:100},[{...shot,x:300,y:30,vy:0}]));
assert.equal(firstImpact(target,[{...shot,visible:true}]),null,'visible projectiles lose the edge warning');
assert.equal(firstImpact(target,[]),null,'disappeared projectiles leave no stale threat');
assert.equal(firstImpact(target,[{...shot,remaining:.2}]),null,'a flight ending before collision is not a threat');
assert.equal(firstImpact(target,[shot,{...shot,id:'b',x:300}])?.id,'b','use the earliest impact');
for(const jitter of [-.001,0,.001])assert.equal(firstImpact(target,[{...shot,x:500+jitter}])?.id,'a','small position noise does not toggle a clear threat');
assert.equal(firstImpact(target,[{...shot,vx:0}]),null,'zero relative velocity cannot create a distant collision');
console.log('Incoming prediction passed: approach, near misses, both velocities, horizon, visibility, lifetime, closest impact and disappearing threats.');

// Actual server telemetry includes positional suction forces as well as walking/skids.
import { GameState } from '../schema/GameState.js';
{
 const s=new GameState(0);s.botFill=0;s.fieldGemTarget=0;s.weaponsOn=false;s.surgesOn=false;s.trafficHits=false;s.setTurbines('off');s.update(0,100000);
 const a=s.addPlayer('puller','Puller',100000),b=s.addPlayer('target','Target',100000);
 a.setGems(100,4200,4200);b.setGems(100,4200,4200);a.placeAt(1000,1000);b.placeAt(a.x+a.width*.8+150-b.width/2,a.y+(a.height-b.height)/2);
 a.spawnProtected=b.spawnProtected=false;a.facing=0;a.startInhale(100000);s.update(.03,100030);
 assert(b.movementVx<0,'incoming prediction sees body suction velocity on a stationary target');
 assert(Math.abs(b.movementVx-b.velocity().x-b.tickNudgeX/.03)<1e-6);
}

{
 const p={x:1270,y:-30,width:60,height:60,state:'alive',flying:true,flightKind:'missile',flightHit:false,
  flightAgeMs:1000,flightVx:-1600,flightVy:0,flightRemainingMs:1600,launchedBy:'shooter'};
 const shot=playerMissileShot(p,'ammo','defender')!;
 const hit=firstImpact(target,[shot],PLAYER_SHOT_WARNING_S,true);
 assert(hit&&hit.seconds>.85&&hit.seconds<1,'a slowing live bullet warns well before the old half-second limit');
 const expected=-Math.log(1-.35*(1300-50)/1600)/.35;
 assert(Math.abs(hit.seconds-expected)<.02,'prediction follows the actual decelerating flight, not permanent launch velocity');
 assert.equal(firstImpact(target,[shot],.5,true),null);
 assert.equal(firstImpact(target,[{...shot,visible:true}],PLAYER_SHOT_WARNING_S),null,'weapon-style visibility filtering remains the default');
 assert(firstImpact(target,[{...shot,visible:true}],PLAYER_SHOT_WARNING_S,true),'living-bullet warnings persist through on-screen entry');
 assert.equal(firstImpact(target,[{...shot,y:51}],PLAYER_SHOT_WARNING_S,true),null,'clear near misses do not create player warnings');
 assert.equal(firstImpact(target,[{...shot,remaining:.2}],PLAYER_SHOT_WARNING_S,true),null,'landing before arrival is not a threat');
 assert.equal(playerMissileShot({...p,flightHit:true},'ammo','defender'),null,'spent bounces cannot warn about another damaging hit');
 assert.equal(playerMissileShot({...p,flightVx:-100},'ammo','defender'),null,'below-stop-speed flights do not warn');
 assert.equal(playerMissileShot({...p,flightAgeMs:0},'ammo','shooter'),null,'the launcher grace does not warn the shooter about its own fresh shot');
 assert(playerMissileShot(p,'ammo','shooter'),'launcher immunity does not last beyond the actual shared grace');
 assert.equal(playerMissileShot({...p,flightKind:'turbine'},'ammo','defender'),null,'this warning pass does not alter turbine travel');
}
{
 const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=s.surgesOn=false;s.setTurbines('off');s.update(0,100000);
 const bot=s.addPlayer('bot','Bot',100000),ammo=s.addPlayer('ammo','Ammo',100000);
 bot.dropProtection();bot.placeAt(2000-bot.width/2,2000-bot.height/2);bot.isBot=true;
 ammo.launch(99000,-1600,0,'shooter',2600);ammo.placeAt(3300-ammo.width/2,2000-ammo.height/2);
 ammo.flightRemainingMs=1600;ammo.flightAgeMs=1000;
 const dodge=new BotProjectileDodge(()=>0);
 assert.equal(dodge.move(bot,s,100000),undefined,'bots notice the public warning before reacting');
 assert.equal(dodge.move(bot,s,100200),undefined,'no instant bot dodge');
 assert(['up','down'].includes(dodge.move(bot,s,100300)!),'bots can sidestep player missiles even when assembled weapons are disabled');
 assert.equal(bot.velocity().x,0,'choosing a dodge does not secretly move or accelerate the bot');
}
console.log('Player warning passed: longer deceleration-aware lead, visible handoff, misses/lifetime/owner/spent filtering and delayed ordinary bot decisions.');
