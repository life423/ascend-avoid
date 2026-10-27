import assert from 'node:assert/strict';
import { GameState } from '../schema/GameState.js';
import { WeaponBoltSchema } from '../schema/PinwheelSchema.js';
import { spawnWeapon, updateWeapons, initializeWeaponSets } from '../systems/weapons.js';
import { weaponDamage } from '../systems/weaponDamage.js';
import { allWeapons, orbitalPosition, weaponKinds, weaponProfile } from '../game/weaponKit.js';
import { PINWHEEL, WEAPON_FLEET } from '../constants/gameConstants.js';

const NOW = 100000;
function world() {
  const s=new GameState(0);s.botFill=0;s.weaponsOn=true;s.surgesOn=false;s.setTurbines('off');s.time=1000;
  const builder=s.addPlayer('builder','Builder',NOW),target=s.addPlayer('target','Target',NOW);
  builder.placeAt(100,100);target.setGems(100,s.worldWidth,s.worldHeight);
  for(const p of [builder,target])p.spawnProtected=false;
  return {s,builder,target};
}
for(const kind of weaponKinds) {
  const {s,builder,target}=world();spawnWeapon(s,2100,2100,kind);
  const w=s.pinwheel,profile=weaponProfile(kind);w.owner=builder.sessionId;w.phase='active';w.at=s.time+16000;w.nextShotAt=Infinity;
  w.activatedAt=s.time;w.originX=w.x;w.originY=w.y;w.angle=0;
  const credits: Record<string,unknown>[]=[];s.onEvent=(type,data)=>{if(type==='credit')credits.push(data);};
  if(kind==='pulsar') {
    w.beatAt=s.time;target.placeAt(w.x+150-target.width/2,w.y-target.height/2);
    updateWeapons(s,0,NOW);s.time+=500;updateWeapons(s,.5,NOW+500);
  } else if(kind==='ion') {
    s.time+=WEAPON_FLEET.ION_WARNING_MS;
    const at=orbitalPosition(w.originX,w.originY,WEAPON_FLEET.ION_WARNING_MS,s.worldWidth,s.worldHeight);
    target.placeAt(at.x+200-target.width/2,at.y-target.height/2);updateWeapons(s,0,NOW);
  } else {
    target.placeAt(2300-target.width/2,2100-target.height/2);
    const bolt=new WeaponBoltSchema();bolt.x=2140;bolt.y=2100;bolt.angle=0;bolt.bornAt=s.time;w.bolts.set('hit',bolt);
    updateWeapons(s,200/profile.speed,NOW);
  }
  const lost=100-target.gems;
  assert(lost>0,`${kind} actually damages the target`);
  assert.equal(builder.gems,lost,`${kind} pays its far-away assembler`);
  assert.equal(builder.weaponDamage,lost);assert.equal(builder.weaponKnockouts,0);
  assert.equal(s.gems.size,0,'gems cannot both reward the builder and spill');
  assert(credits.some(c=>c.byId===builder.sessionId&&c.how===kind&&c.gems===lost&&c.earned===lost),'every attack path attributes actual damage and reward');
}
{
  const {s,builder,target}=world();builder.knockOut(NOW);target.setGems(6,s.worldWidth,s.worldHeight);
  const reward=weaponDamage(s,target,builder.sessionId,2,NOW);
  assert.deepEqual(reward,{lost:6,out:true,earned:6});assert.equal(builder.pendingWeaponGems,6);
  assert.equal(builder.weaponDamage,6);assert.equal(builder.weaponKnockouts,1);assert.equal(builder.gems,0);
  s.spawn(builder,NOW+2000);assert.equal(builder.gems,6);assert.equal(builder.pendingWeaponGems,0);assert(builder.spawnProtected);
  assert.equal(builder.weaponDamage,6,'record survives respawn');
  s.spawn(builder,NOW+4000);assert.equal(builder.gems,6,'pending reward is paid only once');
}
{
  const {s,target}=world();const hit=weaponDamage(s,target,'disconnected',25,NOW);
  assert.equal(hit.earned,0);assert.equal(target.gems,75);
  assert.equal([...s.gems.values()].reduce((n,g)=>n+g.value,0),25,'unclaimable rewards still conserve value');
}
{
  const {s}=world();initializeWeaponSets(s);
  const all=allWeapons(s);assert.equal(all.filter(w=>w.kind==='pinwheel').length,2);assert.equal(all.filter(w=>w.kind==='pulsar').length,2);
  for(const w of all.filter(w=>w.kind==='pinwheel'||w.kind==='pulsar'))assert(Math.hypot(w.spawnX-s.worldWidth/2,w.spawnY-s.worldHeight/2)<450,'classic weapons retain central spawn areas');
  for(const gems of [40,100,1000,10000]) {
    const previous=Math.min(Math.ceil(gems*.3),Math.max(8,Math.ceil(Math.sqrt(gems)*1.6)));
    const current=Math.min(Math.ceil(gems*PINWHEEL.HIT_SHARE),Math.max(PINWHEEL.HIT_MIN_GEMS,Math.ceil(Math.sqrt(gems)*PINWHEEL.HIT_PER_ROOT)));
    assert(current>=previous*1.4&&current<=previous*1.6,'Pinwheel bullets strengthen about fifty percent while retaining sublinear scaling');
  }
  for(const kind of ['sentinel','ricochet','ion'])assert.equal(weaponProfile(kind).root,1.6,'the Pinwheel buff does not silently buff other weapons');
}
console.log('Weapon rewards pass: six real attack paths, assembler attribution, value conservation, KO totals, respawn banking, classic spawns and stronger Pinwheel bullets.');
