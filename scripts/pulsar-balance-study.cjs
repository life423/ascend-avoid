// Build first. Isolated real Pulsar/movement updates; fixed reactions are not human playtest evidence.
const { writeFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { pathToFileURL } = require('node:url');
const load = file => import(pathToFileURL(resolve(__dirname, '../server/dist', file)).href);
(async () => {
  const { GameState } = await load('schema/GameState.js');
  const { spawnWeapon, updateWeapons } = await load('systems/weapons.js');
  const { SHOCKWAVE } = await load('constants/gameConstants.js');
  const { BotBrain } = await load('game/bots.js');
  const original = { ...SHOCKWAVE }, NOW = 100000, START = 1000;
  const conservative = { arc:90, charge:1000, turn:30, share:.15 };
  const settings = [
    {name:'conservative',...conservative},
    {name:'earlier-proposal',arc:120,charge:800,turn:36,share:.25},
    {name:'arc-80',...conservative,arc:80}, {name:'arc-100',...conservative,arc:100},
    {name:'charge-800',...conservative,charge:800}, {name:'charge-1200',...conservative,charge:1200},
    {name:'turn-24',...conservative,turn:24}, {name:'turn-36',...conservative,turn:36},
    {name:'damage-10',...conservative,share:.10},
  ];
  function run(setting, gems, distance, reaction, latency, response, bot=false) {
    Object.assign(SHOCKWAVE, {HALF_ARC:setting.arc*Math.PI/360,WINDUP_MS:setting.charge,TURN_STEP:setting.turn*Math.PI/180,DAMAGE_SHARE:setting.share,
      ACTIVE_MS:setting.charge+3*SHOCKWAVE.BEAT_MS+SHOCKWAVE.WAVE_MS+200});
    let seed=731;const random=Math.random;Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    try {
      const s=new GameState(0);s.botFill=s.fieldGemTarget=0;s.weaponsOn=true;s.surgesOn=false;s.setTurbines('off');s.time=START;
      const owner=s.addPlayer('owner','Builder',NOW),p=s.addPlayer('target','Challenger',NOW);
      owner.setGems(100,4200,4200);owner.placeAt(1900-owner.width/2,2100-owner.height/2);owner.dropProtection();
      p.setGems(gems,4200,4200);p.placeAt(2100+distance-p.width/2,2100-p.height/2);p.dropProtection();p.isBot=bot;
      spawnWeapon(s,2100,2100,'pulsar');const w=s.pinwheel;
      w.owner=owner.sessionId;w.phase='active';w.angle=0;w.at=START+SHOCKWAVE.ACTIVE_MS;w.beatAt=START+setting.charge;w.activatedAt=START;
      const width=p.width,brain=response==='bot'?new BotBrain():null,hits=[];
      let rearEntry=false,nearestBuilder=Infinity,waypoint=0,pulses=0,lastPulse=0,stun=false;
      s.onEvent=(type,data)=>{if(type==='credit'&&data.byId===owner.sessionId)hits.push({ms:s.time-START,lost:data.gems,out:data.out});};
      const route=[{x:2100+distance*.55,y:2100-distance},{x:2010,y:2100-distance},{x:1900,y:2100}];
      for(let ms=20;ms<SHOCKWAVE.ACTIVE_MS;ms+=20) {
        s.time=START+ms;s.now=NOW+ms;
        if(brain&&s.now>=brain.nextThinkAt) {
          const axes={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]},move=brain.think(p,s,s.now);p.steer(...(axes[move]??[0,0]));
        } else if(!brain) {
          if(ms<reaction+latency||response==='idle')p.steer(0,0);
          else if(response==='retreat')p.steer(1,0);
          else {
            const target=route[waypoint],dx=target.x-(p.x+p.width/2),dy=target.y-(p.y+p.height/2),d=Math.hypot(dx,dy);
            if(d<12&&waypoint<route.length-1)waypoint++;
            p.steer(d>8?dx/d:0,d>8?dy/d:0);
          }
        }
        updateWeapons(s,.02,s.now);p.updateMovement(4200,4200,s.now,.02);
        if(w.pulseAt&&lastPulse!==w.pulseAt){pulses++;lastPulse=w.pulseAt;}
        const x=p.x+p.width/2,y=p.y+p.height/2;
        rearEntry ||= x<2060&&Math.hypot(x-2100,y-2100)<430;
        nearestBuilder=Math.min(nearestBuilder,Math.hypot(x-(owner.x+owner.width/2),y-(owner.y+owner.height/2))-(p.width+owner.width)/2);
        stun ||= p.stunned||p.sliding;
        if(p.state!=='alive')break;
      }
      return {width:+width.toFixed(1),hits:hits.length,lost:gems-p.gems,out:p.state!=='alive',rearEntry,builderEdgeGap:+nearestBuilder.toFixed(1),pulses,controlLocked:stun};
    } finally {Math.random=random;}
  }
  const rows=[],ai=[];
  try {
    for(const setting of settings) for(const gems of [0,100,1000,5000]) for(const distance of [140,260,380])
      for(const reaction of [250,500]) for(const latency of [0,150]) for(const response of ['idle','retreat','flank']) {
        const human=run(setting,gems,distance,reaction,latency,response),bot=run(setting,gems,distance,reaction,latency,response,true);
        if(JSON.stringify(human)!==JSON.stringify(bot))throw Error('Bot/human physics mismatch');
        rows.push({setting:setting.name,gems,distance,reaction,latency,response,...human,parity:true});
      }
    for(const setting of settings) for(const gems of [0,100,1000,5000]) for(const distance of [140,260,380])
      ai.push({setting:setting.name,gems,distance,...run(setting,gems,distance,0,0,'bot',true)});
  } finally {Object.assign(SHOCKWAVE,original);}
  const summarize=group=>({cases:group.length,hitCases:group.filter(r=>r.hits).length,hits:group.reduce((s,r)=>s+r.hits,0),
    knockouts:group.filter(r=>r.out).length,unhurt:group.filter(r=>!r.hits).length,rearEntries:group.filter(r=>r.rearEntry).length,
    builderReached:group.filter(r=>r.builderEdgeGap<=10).length,controlLocks:group.filter(r=>r.controlLocked).length});
  const summary=settings.map(setting=>({setting,...Object.fromEntries(['idle','retreat','flank'].map(response=>[response,summarize(rows.filter(r=>r.setting===setting.name&&r.response===response))])),bots:summarize(ai.filter(r=>r.setting===setting.name))}));
  const result={date:'2026-11-01',scope:'Four-pulse isolated encounters using real server weapons/movement and ordinary fixed input vectors. Distances are emitter-to-body-center world units. Reaction begins at visible locked charge, plus specified latency. Flank follows a fixed path to the builder. Other traffic, body contacts, collection, inhale and rival attacks are excluded; reaching the builder is access, not a claimed kill. Actual bot sample uses the normal imperfect decision brain with fixed seeds. Not human fun/fairness proof.',
    executions:rows.length*2+ai.length,selected:'conservative',summary,rows,ai};
  writeFileSync(resolve(__dirname,'../docs/playtests/pulsar-balance-2026-11-01.json'),JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify({executions:result.executions,summary},null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
