// Controlled mature population, twenty ordinary bots. Counts refer to the original top two players, not permanent rank roles.
const {GameState}=require('../server/dist/schema/GameState.js');
const {BotBrain}=require('../server/dist/game/bots.js');
const {initializeWeaponSets}=require('../server/dist/systems/weapons.js');
const seed=Number(process.argv[2]||1),seconds=Number(process.argv[3]||600);let rng=seed;Math.random=()=>{rng=(Math.imul(rng,1664525)+1013904223)>>>0;return rng/4294967296};
const s=new GameState();s.botFill=0;initializeWeaponSets(s);let now=1e9;
const stocks=[12000,9000,5000,3000,2000,1200,900,700,500,400,300,200,150,100,80,60,40,25,12,5];
for(let i=0;i<20;i++)s.addPlayer('bot'+i,'Bot '+i,now);
for(let i=0;i<20;i++){const p=s.players.get('bot'+i);p.isBot=true;p.setGems(stocks[i],4200,4200);p.placeAt(120+(i%5)*820,120+Math.floor(i/5)*1000);p.dropProtection();s.brains.set(p.sessionId,new BotBrain())}
const counts={capture:0,launch:0,hits:0,leaderHits:0,runnerHitsLeader:0,leaderThefts:0,leaderKnockouts:0};let low=12000,high=12000,leaderChanges=0,lastLeader='bot0';
s.onEvent=(type,d)=>{if(type==='capture')counts.capture++;if(type==='launch')counts.launch++;if(type==='impact'&&d.projectileId){counts.hits++;if(d.targetId==='bot0'){counts.leaderHits++;if(d.byId==='bot1')counts.runnerHitsLeader++}}if(type==='credit'&&d.targetId==='bot0'){if(d.how==='stole')counts.leaderThefts++;if(d.out)counts.leaderKnockouts++}};
for(let i=0;i<seconds*30;i++){now+=1000/30;s.update(1/30,now);const p=s.players.get('bot0');low=Math.min(low,p.gems);high=Math.max(high,p.gems);if(i%30===0){const l=s.leader()?.sessionId??'';if(l!==lastLeader){leaderChanges++;lastLeader=l}}}
console.log(JSON.stringify({seed,seconds,counts,originalLeader:{start:12000,end:s.players.get('bot0').gems,low,high,width:s.players.get('bot0').width},runner:{gems:s.players.get('bot1').gems,width:s.players.get('bot1').width},leaderChanges,ranking:[...s.players.values()].sort((a,b)=>b.gems-a.gems).slice(0,5).map(p=>({id:p.sessionId,gems:p.gems,width:p.width}))},null,2));
