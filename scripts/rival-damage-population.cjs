// Compare current shared-rule damage floors; no grants, protection or bot handicaps.
const fs=require('node:fs'),{fork}=require('node:child_process');
(async()=>{
  const jobs=[0,.25,.33].flatMap(share=>[11,73,218].map(seed=>({share,seed}))),rows=[];let next=0;
  await Promise.all(Array.from({length:3},async()=>{while(next<jobs.length){const j=jobs[next++];
    const row=await new Promise((resolve,reject)=>{
      const child=fork(require.resolve('./game-loop-review.cjs'),['--case',j.seed,'experienced',0,600,j.share].map(String),{silent:true,windowsHide:true});let out='',err='';
      child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);child.on('error',reject);child.on('exit',code=>{if(code)reject(Error(err));else try{resolve(JSON.parse(out));}catch(e){reject(e);}});
    });rows.push({...row,share:j.share});console.error(`${rows.length}/9 share=${j.share} seed=${j.seed}: body KOs=${row.population.bodyDeaths}, giants peak=${row.population.maxGiants}`);
  }}));
  rows.sort((a,b)=>a.share-b.share||a.seed-b.seed);
  const summary=[0,.25,.33].map(share=>{const group=rows.filter(r=>r.share===share);return{share,runs:group.length,bodyKnockouts:group.map(r=>r.population.bodyDeaths),flightKnockouts:group.map(r=>r.population.flightDeaths),leaderKnockouts:group.map(r=>r.population.leaderDeaths),giantBodyKnockouts:group.map(r=>r.population.giantBodyDeaths),peakGiants:group.map(r=>r.population.maxGiants),giantMinutes:group.map(r=>Math.round(r.population.giantSeconds/60)),shots:group.map(r=>r.world.launch||0),cannonCreditsIncludingSpentMissiles:group.map(r=>r.world['hit:cannon']||0)};});
  fs.writeFileSync('docs/playtests/rival-damage-population-2026-11-01.json',JSON.stringify({date:'2026-11-01',method:'Nine seeded10-minute normal20-occupant worlds, one human-flagged probe using ordinary BotBrain plus19 bots, all normal field/hazards/weapons and actor rules. Only process-local PEER_HIT_SHARE changes:0 legacy/.25 floor/.33 floor. Frames distinguish flying deaths from body deaths; current-leader death is rank at previous frame, not every former leader. No forced fights or guarantee of hit, no human fun or hours-long survival proof.',summary,rows},null,2)+'\n');console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
