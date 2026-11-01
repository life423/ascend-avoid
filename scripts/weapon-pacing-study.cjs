// Build first. Seeded full-world bot decisions, not a proof of human fun or an activation cap.
const fs=require('node:fs');
const {GameState}=require('../server/dist/schema/GameState.js');
const {initializeWeaponSets}=require('../server/dist/systems/weapons.js');
const {allWeapons}=require('../server/dist/game/weaponKit.js');
const {WEAPON_FLEET,PINWHEEL}=require('../server/dist/constants/gameConstants.js');
function run(seed,interval,seconds){
  const originalRandom=Math.random,originalInterval=WEAPON_FLEET.PARTS_INTERVAL_MS;
  let n=seed>>>0;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};
  WEAPON_FLEET.PARTS_INTERVAL_MS=interval;
  try{
    const s=new GameState();s.weaponsOn=true;s.botFill=20;
    let now=1e9;s.addPlayer('observer','Observer',now).protectFor(1e12,now);
    initializeWeaponSets(s);
    if(!interval)allWeapons(s).forEach((w,i)=>w.at=PINWHEEL.FIRST_MS+i*150);
    let peakActive=0,activeSeconds=0,crowdedSeconds=0,peakComponents=0,peakBolts=0;
    const releases=[],activations=[],previous=allWeapons(s).map(w=>w.phase),frameMs=1000/30;
    for(let tick=0;tick<seconds*30;tick++){
      now+=frameMs;s.update(1/30,now);
      const builds=allWeapons(s),active=builds.filter(w=>w.phase==='active').length;
      peakActive=Math.max(peakActive,active);activeSeconds+=active/30;if(active>=4)crowdedSeconds+=1/30;
      peakComponents=Math.max(peakComponents,builds.reduce((sum,w)=>sum+w.parts.length,0));
      peakBolts=Math.max(peakBolts,builds.reduce((sum,w)=>sum+w.bolts.size,0));
      builds.forEach((w,i)=>{
        if(w.phase==='parts'&&previous[i]==='waiting')releases.push({slot:i,kind:w.kind,second:+(s.time/1000).toFixed(2)});
        if(w.phase==='active'&&previous[i]!=='active')activations.push({slot:i,kind:w.kind,second:+(s.time/1000).toFixed(2)});
        previous[i]=w.phase;
      });
    }
    const clustered=activations.filter((a,i)=>i&&a.second-activations[i-1].second<.5).length;
    return{seed,interval,seconds,peakActive,meanActive:+(activeSeconds/seconds).toFixed(2),fourPlusSeconds:+crowdedSeconds.toFixed(1),peakComponents,peakBolts,clustersWithinHalfSecond:clustered,releases,activations};
  }finally{Math.random=originalRandom;WEAPON_FLEET.PARTS_INTERVAL_MS=originalInterval;}
}
if(process.argv[2]==='--case') {
  console.log(JSON.stringify(run(Number(process.argv[3]),Number(process.argv[4]),Number(process.argv[5]))));
} else (async()=>{
  const {fork}=require('node:child_process');
  const cases=process.argv.includes('--long')
    ? [180,600].flatMap(seconds=>[11,73,218].flatMap(seed=>[0,8000,12000,16000].map(interval=>({seed,interval,seconds}))))
    : [{seed:11,interval:0,seconds:180},{seed:11,interval:8000,seconds:180},{seed:11,interval:12000,seconds:180},
      {seed:11,interval:16000,seconds:180},{seed:73,interval:0,seconds:180},{seed:73,interval:12000,seconds:180}];
  const rows=[];let next=0;
  await Promise.all(Array.from({length:3},async()=>{
    while(next<cases.length){
      const job=cases[next++];
      const row=await new Promise((resolve,reject)=>{
        const child=fork(__filename,['--case',String(job.seed),String(job.interval),String(job.seconds)],{silent:true,windowsHide:true});
        let out='',err='';child.stdout.on('data',data=>out+=data);child.stderr.on('data',data=>err+=data);
        child.on('error',reject);child.on('exit',code=>{if(code)reject(Error(err||`Study worker failed: ${code}`));else try{resolve(JSON.parse(out));}catch(error){reject(error);}});
      });
      rows.push(row);console.error(`seed=${row.seed} interval=${row.interval} duration=${row.seconds}: peak=${row.peakActive}, mean=${row.meanActive}`);
    }
  }));
  rows.sort((a,b)=>a.seconds-b.seconds||a.seed-b.seed||a.interval-b.interval);
  const summary=[];
  for(const seconds of [...new Set(rows.map(r=>r.seconds))])for(const interval of [0,8000,12000,16000]){
    const group=rows.filter(r=>r.seconds===seconds&&r.interval===interval);if(!group.length)continue;
    summary.push({seconds,interval,runs:group.length,peakActive:group.map(r=>r.peakActive),meanActive:group.map(r=>r.meanActive),fourPlusSeconds:group.map(r=>r.fourPlusSeconds),peakComponents:group.map(r=>r.peakComponents),peakBolts:group.map(r=>r.peakBolts),clusters:group.map(r=>r.clustersWithinHalfSecond)});
  }
  const result={date:'2026-11-01',scope:`${rows.length} seeded full-world runs: protected observer plus 19 ordinary bots in a 20-occupant room; nine builds/six recipes, real collection/deployment/combat/respawn and standard field/arena hazards. Baseline retains original 150ms opening releases with no shared release gate. Candidates pace component availability, without actor handicaps or a deployment cap. Diverging RNG streams make later fights non-paired. Not proof of human fun, universal peak limits or giant-loop balance. --long runs the separate 24-case 3/10-minute study.`,selectedInterval:12000,summary,rows};
  const file=process.argv.includes('--long')?'weapon-pacing-2026-11-01.json':'weapon-pacing-quick-2026-11-01.json';
  fs.writeFileSync(`docs/playtests/${file}`,JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(summary,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
