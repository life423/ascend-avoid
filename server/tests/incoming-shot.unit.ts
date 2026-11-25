import assert from 'node:assert/strict';
import { firstImpact, playerFlightShot, PLAYER_SHOT_WARNING_S, type IncomingShot } from '../game/incomingShot.js';
import { CANNON, TURBINE } from '../constants/gameConstants.js';
import { LaunchVisibility } from '../game/launchVisibility.js';
import { BotProjectileDodge } from '../game/botProjectiles.js';
import { AimWarning } from '../game/aimWarning.js';
import { BlackHoleSchema } from '../schema/BlackHoleSchema.js';
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
 const shot=playerFlightShot(p,'ammo','defender')!;
 const hit=firstImpact(target,[shot],PLAYER_SHOT_WARNING_S,true);
 assert(hit&&hit.seconds>.85&&hit.seconds<1,'a slowing live bullet warns well before the old half-second limit');
 const expected=-Math.log(1-.35*(1300-50)/1600)/.35;
 assert(Math.abs(hit.seconds-expected)<.02,'prediction follows the actual decelerating flight, not permanent launch velocity');
 assert.equal(firstImpact(target,[shot],.5,true),null);
 assert.equal(firstImpact(target,[{...shot,visible:true}],PLAYER_SHOT_WARNING_S),null,'weapon-style visibility filtering remains the default');
 assert(firstImpact(target,[{...shot,visible:true}],PLAYER_SHOT_WARNING_S,true),'living-bullet warnings persist through on-screen entry');
 assert.equal(firstImpact(target,[{...shot,y:51}],PLAYER_SHOT_WARNING_S,true),null,'clear near misses do not create player warnings');
 assert.equal(firstImpact(target,[{...shot,remaining:.2}],PLAYER_SHOT_WARNING_S,true),null,'landing before arrival is not a threat');
 assert.equal(playerFlightShot({...p,flightHit:true},'ammo','defender'),null,'spent bounces cannot warn about another damaging hit');
 assert.equal(playerFlightShot({...p,flightVx:-100},'ammo','defender'),null,'below-stop-speed flights do not warn');
 assert.equal(playerFlightShot({...p,flightAgeMs:0},'ammo','shooter'),null,'the launcher grace does not warn the shooter about its own fresh shot');
 assert(playerFlightShot(p,'ammo','shooter'),'launcher immunity does not last beyond the actual shared grace');
 const fan = playerFlightShot({...p,x:470,flightKind:'turbine',flightVx:-1150,flightRemainingMs:1400},'ammo','defender');
 assert(fan && fan.drag === TURBINE.PLAYER_DRAG, 'fan-launched bodies use their actual drag for the same warning');
 assert(firstImpact(target,[fan],PLAYER_SHOT_WARNING_S,true),'a damaging fan flight can warn');
 const ledFan = playerFlightShot({...p,x:470,flightKind:'turbine',flightVx:-1150,flightRemainingMs:1400},'ammo','defender',.1);
 assert(ledFan && Math.abs(ledFan.vx + 1150 * Math.exp(-TURBINE.PLAYER_DRAG * .1)) < 1e-9);
 assert.equal(playerFlightShot({...p,flightKind:'unknown'},'ammo','defender'),null);
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
{
 const view={x:2100,y:2100,width:579.840283433968,height:1180.7912567987844};
 const history=new LaunchVisibility();
 // Real failing trace: the launch center was 1449.60, but age/velocity inferred a partly visible origin.
 history.noteLaunch({id:'ammo',x:2070,y:1419.604371600608},view,0);
 history.prune(new Set(),16);
 assert(history.observe('ammo',29,{x:2100,y:1535.00706146816,radius:30},view,32),
  'a real off-screen launch warns even when its first flying state is already visible');
 assert(history.observe('ammo',76,{x:2100,y:1619.016369077384,radius:30},view,80),'provenance persists through entry');
 history.prune(new Set(),100);
 assert.equal(history.observe('ammo',0,{x:2100,y:1700,radius:30},view,110),false,'ended flights cannot leave stale warnings');
 history.noteLaunch({id:'ammo',x:2070,y:1670},view,120);
 assert.equal(history.observe('ammo',29,{x:2100,y:1760,radius:30},view,150),false,'a reused body launched visibly stays quiet');
}
{
 const view={x:2100,y:2100,width:600,height:900},history=new LaunchVisibility();
 history.noteLaunch({id:'ammo',x:1500,y:2070},null,0);
 assert(history.observe('ammo',200,{x:2000,y:2100,radius:30},view,200),'pre-view events keep their exact origin');
 history.clear();
 assert.equal(history.observe('fan',0,{x:2100,y:2100,radius:20},view,210),false,'unknown on-screen flights do not always alert');
 assert(history.observe('fan',20,{x:1700,y:2100,radius:20},view,230),'observed off-screen fan flights qualify');
 assert(history.observe('fan',40,{x:1900,y:2100,radius:20},view,250));
 assert.equal(history.observe('fan',0,{x:2100,y:2100,radius:20},view,260),false,'a new unannounced flight does not inherit an old origin');
 history.noteLaunch({id:'pending',x:1500,y:2070},view,300);
 history.prune(new Set(),300+CANNON.FLIGHT_MS+1001);
 assert.equal(history.observe('pending',0,{x:2100,y:2100,radius:30},view,4000),false,'expired pending events are bounded');
 history.noteLaunch({id:'bad',x:NaN,y:0},view,4001);
 assert.equal(history.observe('bad',0,{x:2100,y:2100,radius:30},view,4002),false,'invalid telemetry creates no invented origin');
}
{
 const view={x:0,y:0,width:600,height:900};
 const hidden={x:-500,y:0,radius:100}, visible={x:-390,y:0,radius:100};
 const sample={x:-180,y:0,radius:30};
 function eligible(x:number,y:number,shooter?:typeof hidden,lateView=false){
   const history=new LaunchVisibility();
   history.noteLaunch({id:'ammo',x:x-CANNON.BULLET_SIZE/2,y:y-CANNON.BULLET_SIZE/2},lateView?null:view,0,shooter);
   return history.observe('ammo',40,sample,view,40);
 }
 assert(eligible(-320,0,hidden),'a sliver entering from a hidden shooter qualifies');
 assert(eligible(-285,0,hidden,true),'a partly clipped origin survives deferred view initialization');
 assert.equal(eligible(-285,0,visible),false,'a shooter visibly overlapping the edge does not get the new cue');
 assert.equal(eligible(-270,0,hidden),false,'a fully framed projectile stays quiet');
 assert.equal(eligible(-285,0),false,'a missing shooter does not make a clipped launch a surprise');
 assert(eligible(-325,-475),'a circle beyond the viewport corner is fully offscreen');
}
console.log('Player warning passed: exact launch history, hidden edge launches, first-receipt entry, event/state ordering, lifecycle, visible negatives, real fan drag and delayed ordinary bot decisions.');

{
  const state = new GameState(0);
  state.botFill = 0; // Only the explicitly placed blocker may intercept this firing line.
  const shooter = state.addPlayer('s', 'Shooter', 100000), ammo = state.addPlayer('a', 'Ammo', 100000);
  const defender = state.addPlayer('d', 'Defender', 100000);
  shooter.width = shooter.height = 150;
  shooter.placeAt(1480, 2025);
  shooter.gulping = 'a'; shooter.gulpEndsAt = ammo.captureHoldMs = 10000;
  ammo.capturedBy = 's'; shooter.facing = 0;
  const view = { x: 2100, y: 2100, width: 600, height: 1000, scale: 1 };
  const target = { x: 2100, y: 2100, vx: 0, vy: 0, radius: 15 };
  const tracker = new AimWarning();
  const read = (time: number, who = target, camera = view) => {
    state.time = time; return tracker.update(state, defender.sessionId, who, camera);
  };
  assert.equal(read(0), null); assert.equal(read(60), null); assert.equal(read(60), null);
  shooter.facing = 0.24;
  assert.equal(read(82), null, 'quick sweep through the player ends quietly');
  shooter.facing = 0;
  assert.equal(read(100), null); assert.equal(read(185), null);
  assert.equal(read(201)?.id, 'aim:s:a', 'sustained hidden firing line becomes actionable');
  assert.equal(read(201, { ...target, vy: 350 }), null, 'sidestep clears even on the same snapshot');
  assert.equal(read(202), null, 're-entering the line must qualify again');
  assert.equal(read(502), null, 'a network gap does not count toward dwell');
  assert(read(602));
  assert.equal(read(603, target, { ...view, width: 1400 }), null, 'visible shooter stays quiet');
  shooter.facing = .3; assert.equal(read(704), null); assert.equal(read(820), null, 'sustained clear miss');
  shooter.facing = 0; shooter.stunned = true; assert.equal(read(830), null); assert.equal(read(960), null);
  shooter.stunned = false; shooter.gulping = ''; assert.equal(read(970), null); assert.equal(read(1090), null);
  shooter.gulping = 'a'; const far = { ...target, x: 3000 };
  assert.equal(read(1100,far), null); assert.equal(read(1240,far), null, 'on line but too far');
  const blocker = state.addPlayer('b','Blocker',100000); blocker.placeAt(1840 - blocker.width/2,2100 - blocker.height/2);
  assert.equal(read(1250), null); assert.equal(read(1370), null, 'another player would intercept first');
  state.players.delete('b'); state.blackHoles.clear();
  state.blackHoles.push(new BlackHoleSchema(1850, 2100));
  assert.equal(read(1380), null); assert.equal(read(1500), null, 'lethal hole between shooter and defender');
  state.blackHoles.clear();
  defender.placeAt(target.x - defender.width / 2, target.y - defender.height / 2);
  defender.dropProtection();
  const bot = new BotProjectileDodge(() => 0);
  for (const t of [1550, 1600, 1650, 1700, 1750, 1800, 1850]) {
    state.time = t;
    bot.observeAim(defender, state, t);
    assert.equal(bot.move(defender, state, t), undefined, 'aim warning respects the bot reaction delay');
  }
  state.time = 1900;
  bot.observeAim(defender, state, 1900);
  assert(['up', 'down'].includes(bot.move(defender, state, 1900)!), 'bot can sidestep sustained hidden aim before release');
}
