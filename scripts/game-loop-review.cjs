// Local research harness. Build the server first; no tuning overrides or production telemetry.
// Scripted decisions describe mechanical opportunities, never measured human fun/retention.
const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { fork, execFileSync } = require('node:child_process');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { initializeWeaponSets, deployWeapon } = require('../server/dist/systems/weapons.js');
const { fireCaptive, exhale } = require('../server/dist/systems/inhale.js');
const { botSuctionThreat } = require('../server/dist/game/botTargets.js');
const { canCatch } = require('../server/dist/game/cannon.js');
const { viewShort, constrainArenaView } = require('../server/dist/game/camera.js');
const { allWeapons } = require('../server/dist/game/weaponKit.js');
const { INHALE } = require('../server/dist/constants/gameConstants.js');
const DT = 1 / 30, START = 1000000;
const round = value => Math.round(value * 100) / 100;
const center = p => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const tier = width => width < 100 ? 'below100' : width < 300 ? '100to300' : width < 500 ? '300to500' : '500plus';
// Same input bookkeeping as GameRoom's exhale message; not a balance override.
function release(p, now) { p.releasedAt=now; p.stopInhale(now); p.captureNeedsRelease=false; }

function viewFor(s, p, aspect = 412 / 915) {
  const short = viewShort(p.width), c = center(p);
  return constrainArenaView({ ...c, width: short * Math.max(1, aspect), height: short / Math.min(1, aspect), scale: 1 }, s.worldWidth, s.worldHeight);
}
function visible(view, point, radius = 0) {
  return Math.abs(point.x - view.x) <= view.width / 2 + radius && Math.abs(point.y - view.y) <= view.height / 2 + radius;
}

/** Two intentionally simple visible-world probes, with 300ms decisions and ordinary inputs. */
function controller(policy) {
  let next = 0, holdingSince = 0, fleeSince = 0;
  return (s, p, now) => {
    if (now < next) return;
    next = now + 300;
    if (p.state !== 'alive' || p.capturedBy || p.flying) return;
    const c = center(p), view = viewFor(s, p), players = [...s.players.values()].filter(o => o !== p && o.state === 'alive' && !o.flying && !o.capturedBy && visible(view, center(o), o.width / 2));
    const move = goal => { const dx = goal.x - c.x, dy = goal.y - c.y, d = Math.hypot(dx, dy) || 1; p.steer(dx / d, dy / d); };
    const threats = players.filter(o => !o.breathingBlocked && canCatch(o.width, p.width)).sort((a,b) => distance(c, center(a)) - distance(c, center(b)));
    const threat = threats[0];
    if (threat && distance(c, center(threat)) - threat.width / 2 - p.width / 2 < 250) {
      const t = center(threat); move({ x: c.x + c.x - t.x, y: c.y + c.y - t.y });
      release(p,now);
      if (!fleeSince) fleeSince = now;
      if (policy === 'curious' && !p.breathingBlocked && now - fleeSince >= 300) exhale(s, p, now);
      return;
    }
    fleeSince = 0;
    if (p.gulping) {
      release(p,now);
      if (!holdingSince) holdingSince = now;
      const target = players.filter(o => !o.spawnProtected).sort((a,b) => distance(c, center(a)) - distance(c, center(b)))[0];
      if (target) { const t = center(target); p.aimAt(t.x - c.x, t.y - c.y); }
      if (now - holdingSince >= 600 && (!target || Math.abs(Math.atan2(Math.sin(Math.atan2(center(target).y-c.y,center(target).x-c.x)-p.facing),Math.cos(Math.atan2(center(target).y-c.y,center(target).x-c.x)-p.facing))) < .15)) fireCaptive(s, p, now);
      return;
    }
    holdingSince = 0;
    if (policy === 'curious') {
      const builds = allWeapons(s), carried = builds.find(w => w.owner === p.sessionId && w.phase === 'carried');
      if (carried) { release(p,now); deployWeapon(s, p); return; }
      const owned = builds.find(w => w.owner === p.sessionId && w.phase === 'parts');
      const pieces = (owned ? [owned] : builds.filter(w => w.phase === 'parts' && !w.owner)).flatMap(w => w.parts.filter(part => !part.carriedBy && visible(view, part, 48)));
      const piece = pieces.sort((a,b) => distance(c,a)-distance(c,b))[0];
      if (piece) { move(piece); p.aimAt(piece.x-c.x,piece.y-c.y); if (!p.inhaling) p.startInhale(now); return; }
      const prey = players.filter(o => !o.spawnProtected && (o.breathingBlocked || canCatch(p.width,o.width)) && distance(c,center(o)) < INHALE.REACH + p.width * INHALE.REACH_PER_SIZE)
        .sort((a,b) => distance(c,center(a))-distance(c,center(b)))[0];
      if (prey && !p.breathingBlocked) { const t=center(prey); move(t); p.aimAt(t.x-c.x,t.y-c.y); if (!p.inhaling) p.startInhale(now); return; }
    }
    const gems = [...s.gems.values()].filter(g => visible(view,g,12) && !g.falling && !(g.locked && g.owner === p.sessionId));
    const gem = gems.sort((a,b) => distance(c,a)-distance(c,b))[0];
    if (gem) { move(gem); p.aimAt(gem.x-c.x,gem.y-c.y); if (!p.inhaling) p.startInhale(now); }
    else { release(p,now); move({ x:s.worldWidth/2,y:s.worldHeight/2 }); }
  };
}

function run(seed, policy, age, seconds) {
  const random = Math.random, dateNow = Date.now;
  let n = seed >>> 0, clock = START;
  Math.random = () => { n = (Math.imul(n,1664525)+1013904223)>>>0; return n / 4294967296; };
  Date.now = () => clock;
  try {
    const s = new GameState(); initializeWeaponSets(s); s.update(0, clock);
    let p = s.addPlayer(age ? 'founder' : 'probe', 'Review probe', clock);
    if (age) {
      s.brains.set(p.sessionId,new BotBrain());
      for (let i=1;i<=age*30;i++) { clock=START+i*1000/30; s.update(DT,clock); }
      s.removePlayer(p.sessionId); p=s.addPlayer('probe','Review probe',clock);
    }
    assert.equal(s.players.size,20);
    assert.equal(p.isBot,false);
    if (policy === 'experienced') s.brains.set(p.sessionId,new BotBrain());
    const drive = controller(policy), joined=s.time;
    const first={}, counts={}, world={}, tiers={}, events=[], samples=[], before=new Map();
    let maxWidth=p.width,maxGems=p.gems,controlSeconds=0,captiveSeconds=0,deadSeconds=0,injury=null,previousInjured=false,previousState=p.state;
    let activeSeconds=0,crowdedSeconds=0,peakActive=0,peakBolts=0;
    const population={deaths:0,bodyDeaths:0,flightDeaths:0,giantBodyDeaths:0,leaderDeaths:0,maxGiants:0,giantSeconds:0};
    const record=(key)=>{ if(first[key]===undefined)first[key]=round((s.time-joined)/1000); };
    const add=(bucket,key)=>bucket[key]=(bucket[key]||0)+1;
    const agency=key=>{record(key);record('agency');add(counts,key);};
    s.onEvent=(type,d)=>{
      const t=round((s.time-joined)/1000), actor=d.byId||d.id, target=d.targetId;
      if(['capture','launch','weaponPlaced','weaponAssembled','parry','weaponTheft'].includes(type))add(world,type);
      if(type==='credit' && (d.gems>0||d.out)) {
        add(world,`hit:${d.how}`);
        if(d.out && (d.how!=='cannon'||d.projectileId))add(world,`creditedKO:${d.how}`);
        const a=before.get(d.byId),b=before.get(target),width=before.get(d.projectileId)?.shooterWidth||a?.width;
        if(width&&b&&(d.how!=='cannon'||d.projectileId)){const key=`${tier(width)}->${tier(b.width)}`;const row=tiers[key]??={hits:0,knockouts:0,damage:0};row.hits++;row.knockouts+=d.out?1:0;row.damage+=d.gems||0;}
        if(actor===p.sessionId && target!==p.sessionId && (d.how!=='cannon'||d.projectileId))agency(d.out?'knockoutGiven':'hitGiven');
        if(target===p.sessionId) {record('hitTaken');add(counts,`damage:${d.how}`);}
      }
      if(actor===p.sessionId) {
        if(type==='capture')agency('capture');
        if(type==='launch')agency('fired');
        if(type==='parry')agency('connectedGust');
        if(type==='partCollected'){record('part');add(counts,'parts');}
        if(type==='weaponAssembled'){record('assembly');add(counts,'assemblies');}
        if(type==='weaponPlaced'){record('placement');add(counts,'placements');}
      }
      if(type==='capture'&&target===p.sessionId){record('captured');add(counts,'captured');}
      if(['capture','launch','parry','credit','weaponPlaced','weaponTheft'].includes(type)) {
        const point=d.x!==undefined?d:before.get(target||d.id||actor);
        if(point&&visible(viewFor(s,p),point,point.width/2||0))record('seenAction');
      }
      if((actor===p.sessionId||target===p.sessionId)&&!['surge','burst'].includes(type)&&events.length<150)events.push({t,type,...d});
    };
    for(let tick=1;tick<=seconds*30;tick++) {
      clock=START+(age+tick/30)*1000;
      before.clear();s.players.forEach((o,id)=>before.set(id,{...center(o),width:o.width,state:o.state,gems:o.gems,shooterWidth:o.shotShooterWidth,flying:o.flying}));
      const leader=[...before.entries()].filter(([,o])=>o.state==='alive').sort((a,b)=>b[1].gems-a[1].gems)[0]?.[0];
      if(policy!=='experienced')drive(s,p,clock);
      s.update(DT,clock);
      let giants=0;
      s.players.forEach((o,id)=>{const pre=before.get(id);
        if(o.state==='alive'&&o.width>=500)giants++;
        if(pre?.state==='alive'&&o.state!=='alive'){
          population.deaths++;if(pre.flying)population.flightDeaths++;else population.bodyDeaths++;
          if(!pre.flying&&pre.width>=500)population.giantBodyDeaths++;
          if(id===leader)population.leaderDeaths++;
        }
      });
      population.maxGiants=Math.max(population.maxGiants,giants);population.giantSeconds+=giants*DT;
      maxWidth=Math.max(maxWidth,p.width);maxGems=Math.max(maxGems,p.gems);
      if(p.gems>0)record('positiveGems');
      if(p.gems>=25)record('25gems');
      if(p.width>=100)record('100width');
      if(p.width>=300)record('300width');
      if(p.width>=500)record('500width');
      if(p.capturedBy)captiveSeconds+=DT;
      else if(p.state!=='alive')deadSeconds+=DT;
      else if(!p.flying&&!p.stunned&&!p.sliding&&!p.recovering)controlSeconds+=DT;
      if(previousState==='alive'&&p.state!=='alive'){record('death');add(counts,'deaths');}
      if(p.breathingBlocked&&!previousInjured)injury={at:s.time,pressured:false,alive:true};
      if(injury){if(botSuctionThreat(s,p,clock))injury.pressured=true;if(p.state!=='alive'||p.capturedBy)injury.alive=false;}
      if(previousInjured&&!p.breathingBlocked&&injury){
        if(injury.alive&&p.state==='alive') {add(counts,'injuryRecoveries');if(injury.pressured)agency('pressuredRecovery');}
        else add(counts,'failedInjuries');
        injury=null;
      }
      previousInjured=p.breathingBlocked;previousState=p.state;
      if(tick%6===0){const view=viewFor(s,p);if([...s.players.values()].some(o=>o!==p&&o.state==='alive'&&visible(view,center(o),o.width/2)))record('otherCreature');}
      const builds=allWeapons(s),active=builds.filter(w=>w.phase==='active').length;
      peakActive=Math.max(peakActive,active);activeSeconds+=active*DT;if(active>=4)crowdedSeconds+=DT;
      peakBolts=Math.max(peakBolts,builds.reduce((sum,w)=>sum+w.bolts.size,0));
      if(tick%150===0)samples.push({second:round((s.time-joined)/1000),gems:p.gems,width:round(p.width),state:p.state,active,
        population:[...s.players.values()].reduce((a,o)=>{add(a,tier(o.width));return a;},{}),
        leader:Math.max(...[...s.players.values()].map(o=>o.width))});
    }
    return {seed,policy,arenaAgeSeconds:age,seconds,first,counts,world,tiers,maxWidth:round(maxWidth),maxGems,finalWidth:round(p.width),finalGems:p.gems,
      controlSeconds:round(controlSeconds),captiveSeconds:round(captiveSeconds),deadSeconds:round(deadSeconds),peakActive,meanActive:round(activeSeconds/seconds),fourPlusSeconds:round(crowdedSeconds),peakBolts,population,events,samples};
  } finally {Math.random=random;Date.now=dateNow;}
}

function summarize(rows) {
  const summary=[];
  for(const age of [...new Set(rows.map(r=>r.arenaAgeSeconds))])for(const policy of ['forage','curious','experienced']) {
    const group=rows.filter(r=>r.policy===policy&&r.arenaAgeSeconds===age);if(!group.length)continue;
    const values=key=>group.map(r=>r.first[key]??null);
    summary.push({age,policy,runs:group.length,agencyBy60:group.filter(r=>r.first.agency<=60).length,agencyBy120:group.filter(r=>r.first.agency<=120).length,
      agency:values('agency'),seenAction:values('seenAction'),firstDeath:values('death'),firstPart:values('part'),firstPlacement:values('placement'),
      maxWidths:group.map(r=>r.maxWidth),deaths:group.map(r=>r.counts.deaths||0),pressuredRecoveries:group.map(r=>r.counts.pressuredRecovery||0),
      peakActive:group.map(r=>r.peakActive),fourPlusSeconds:group.map(r=>r.fourPlusSeconds)});
  }
  return summary;
}
if(process.argv[2]==='--case'){
  if(process.argv[7]!==undefined){const share=Number(process.argv[7]);assert([0,.25,.30,.33].includes(share));require('../server/dist/constants/gameConstants.js').CANNON.PEER_HIT_SHARE=share;}
  console.log(JSON.stringify(run(Number(process.argv[3]),process.argv[4],Number(process.argv[5]),Number(process.argv[6]))));
}
else(async()=>{
  const quick=process.argv.includes('--quick'),seconds=quick?120:180,seeds=quick?[11,73]:[11,29,73,218,601,977];
  const jobs=[0,300].flatMap(age=>seeds.flatMap(seed=>['forage','curious','experienced'].map(policy=>({seed,policy,age}))));
  const rows=[];let next=0;
  await Promise.all(Array.from({length:2},async()=>{while(next<jobs.length){const j=jobs[next++];
    const row=await new Promise((resolve,reject)=>{const child=fork(__filename,['--case',j.seed,j.policy,j.age,seconds].map(String),{silent:true,windowsHide:true});let out='',err='';
      child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('exit',code=>{if(code)reject(Error(err||`worker exit ${code}`));else try{resolve(JSON.parse(out));}catch(error){reject(error);}});});
    rows.push(row);console.error(`${rows.length}/${jobs.length} seed=${j.seed} ${j.policy} age=${j.age}: agency=${row.first.agency??'none'}, deaths=${row.counts.deaths||0}, maxWidth=${row.maxWidth}`);
  }}));
  rows.sort((a,b)=>a.arenaAgeSeconds-b.arenaAgeSeconds||a.seed-b.seed||a.policy.localeCompare(b.policy));
  const sourceFiles=['constants','schema','game','systems'].flatMap(dir=>fs.readdirSync(`server/${dir}`).filter(f=>f.endsWith('.ts')).map(f=>`server/${dir}/${f}`));
  const hash=crypto.createHash('sha256');for(const file of sourceFiles.sort())hash.update(file).update(fs.readFileSync(file));
  const share=require('../server/dist/constants/gameConstants.js').CANNON.PEER_HIT_SHARE;
  const result={date:'2026-11-01',peerHitShare:share,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),localSimulationSourceHash:hash.digest('hex'),sourceFiles,
    method:'30Hz real current server, normal 20 occupants, all hazards/field/release clocks and shared actor rules. Six seeds, fresh or 5-minute naturally established arena, 3-minute probe window. Probe is human-flagged: forage only, visible-world curious with 300ms decisions, or current experienced BotBrain. Founding actor in warmup uses the ordinary brain, no protection/seeded growth. Probe vision approximates portrait 412/915 using shared camera limits. This is scripted opportunity measurement, not new-player observation, human fun, retention or latency fairness. Agency means capture, fire, damaging credited hit/KO, connected gust, or surviving injury after actual suction pressure; parts/Place are reported separately. Full report and quick exploratory results use different filenames.',
    summary:summarize(rows),rows};
  const file=`docs/playtests/game-loop-${quick?'quick-':''}${share>0?`floor${Math.round(share*100)}-`:''}2026-11-01.json`;fs.writeFileSync(file,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result.summary,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
