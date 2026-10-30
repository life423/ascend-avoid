// Compare saved delay trials; knockout volume is a positive outcome, per the user's clarification.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { gunzipSync } = require('node:zlib');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const timings = [0,250,500,750,1000,1500,2000];
const read = file => JSON.parse(file.endsWith('.gz') ? gunzipSync(fs.readFileSync(file)).toString('utf8') : fs.readFileSync(file,'utf8'));
const median = values => values.length ? +values.sort((a,b)=>a-b)[Math.floor(values.length/2)].toFixed(3) : null;
function summarize(rows) {
  const kills=rows.filter(r=>r.outcome==='defender knocked out'||r.outcome==='attacker knocked out');
  const ages=rows.flatMap(r=>r.launchAgesMs);
  return {
    cases:rows.length, primaryKnockouts:kills.length,
    defenderKnockouts:rows.filter(r=>r.outcome==='defender knocked out').length,
    attackerKnockouts:rows.filter(r=>r.outcome==='attacker knocked out').length,
    captures:rows.filter(r=>r.outcome==='defender captured'||r.outcome==='attacker captured').length,
    freeAlive:rows.filter(r=>r.outcome==='survived').length,
    knockoutsUnderFiveSeconds:kills.filter(r=>r.elapsed<5).length,
    medianKnockoutSeconds:median(kills.map(r=>r.elapsed)),
    sourceReloads:rows.filter(r=>r.firstReload).length,
    followupLaunches:rows.filter(r=>r.firstFollowup!==null).length,
    secondHits:rows.filter(r=>r.secondHit!==null).length,
    minimumCaptureToLaunchMs:ages.length?Math.min(...ages):null,
    medianCaptureToLaunchMs:median(ages),
    casesWithEarlyRejection:rows.filter(r=>r.counts.earlyFireRejections>0).length,
    earlyRejectedAttempts:rows.reduce((sum,r)=>sum+r.counts.earlyFireRejections,0),
  };
}
const groups=[['prompt-weave',timings],['prompt-retreat',timings],['front-weave',timings],['rear-weave',[0,1000,2000]],['bot',[0,1000,2000]]];
const trials=[];
for(const [policy,delays] of groups)for(const delay of delays){
  const label=`load-${delay}-${policy}`,raw=read(`reports/combat/${label}.json.gz`);
  assert.equal(raw.share,.33);assert.equal(raw.loadMs,delay);assert.equal(raw.preparationMs,3000);
  assert.equal(raw.results.length,810);
  assert(raw.results.every(r=>r.opening),'every fight starts with a real hit');
  assert(raw.results.every(r=>r.launchAgesMs.every(age=>age+.001>=delay)),'shared minimum holds for every recorded launch');
  const by=(rows,key,values)=>values.map(value=>({[key]:value,...summarize(rows.filter(r=>r[key]===value))}));
  trials.push({label,policy,delayMs:delay,ammoAngle:raw.ammoAngleDegrees??90,
    sources:['active','idle'].map(sourceBehavior=>{
      const rows=raw.results.filter(r=>r.sourceBehavior===sourceBehavior);
      return {sourceBehavior,summary:summarize(rows),byWidth:by(rows,'width',[100,200,400,650,900]),
        byRivalGap:by(rows,'gap',[80,360,800]),byAmmoGap:by(rows,'ammoGap',[40,240,600]),bySource:by(rows,'source',['tiny','half','largest'])};
    }),exampleCase547:raw.results[546]});
}
const populations=[0,1000,1500,2000].map(delayMs=>{
  const runs=[11,29,73].map(seed=>read(`reports/movement/load-${delayMs}-mature-${seed}.json`));
  for(const run of runs){assert.equal(run.damage.peerHitShare,.33);assert.equal(run.captureFireDelayMs,delayMs);
    assert.equal(run.counts.bodyKnockouts+run.counts.flightKnockouts,run.counts.knockouts);}
  const counts=Object.fromEntries(Object.keys(runs[0].counts).map(key=>[key,runs.reduce((sum,r)=>sum+r.counts[key],0)]));
  return {delayMs,minutes:30,counts,totalKnockoutsPerMinute:+(counts.knockouts/30).toFixed(3),
    perSeed:runs.map(r=>({seed:r.seed,counts:r.counts}))};
});
const sources=['server/constants/gameConstants.ts','server/systems/inhale.ts','server/game/botAim.ts',
  'scripts/peer-damage-study.cjs','scripts/movement-rivalry.cjs','scripts/capture-fire-delay-network.mjs'];
const report={generatedAt:new Date().toISOString(),baseRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  objective:'Preserve rewarding total knockouts and add a readable capture-to-shot beat. Lower knockout count is not the success criterion. Shorter kills are timing observations, not automatic failures.',
  defaults:{peerHitShare:0,captureFireDelayMs:0},
  recommendation:{delayMs:1000,status:'next playtest candidate; normal defaults remain unchanged',
    reason:'One shared second separates capture from fire while keeping sampled population total and body KOs unchanged. Shorter waits mostly overlap normal inputs/turning; longer waits add more friction without a consistent combat-volume benefit.'},
  knockoutClassification:'Flight category means flying in the preceding frame or launched as a captive in the death tick; body category is the remaining knockouts. Captures stay separate.',
  sourceHashes:Object.fromEntries(sources.map(file=>[file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  fightRuns:trials.length*810,trials,populations,network:read('reports/combat/capture-fire-delay-network.json'),
  limits:['Guaranteed opening hit, unarmed defender, focused hunter with known ammo/rival; conditional fights, not hit accuracy.',
    'Scripted prompt inputs and bot brains; no physical-device, latency or human-fun certification.',
    'Idle sources are cheap-ammo controls and remain separate from active sources.',
    'Three staged ten-minute population runs per timing; not an estimate of every live match.',
    'Primary fight KOs stop the case; population total KOs include players dying during missile flight, reported separately.',
    'Readiness feedback is not implemented; an early tap is rejected and requires another action.']};
assert.equal(report.fightRuns,21870);
fs.writeFileSync('reports/combat/capture-fire-delay-summary.json',JSON.stringify(report,null,2));
const lines=['# Capture-to-fire delay with 33% peer damage','',
  'User objective: keep knockouts frequent and rewarding. Survival alone is not a better result. See [method, interpretation and decision](../../docs/CAPTURE_FIRE_DELAY_STUDY.md).','',
  '21,870 conditional fight runs use the same server delay for players and bots. All timetables start at capture and overlap normal movement/aiming. Every opening shot is genuinely preloaded for the same three simulated seconds.','',
  '| Minimum wait | Side ammo / weave KOs | Side ammo / retreat KOs | Forward ammo / weave KOs | Fast side / weave KOs |',
  '|---:|---:|---:|---:|---:|'];
for(const delay of timings){
  const active=policy=>trials.find(r=>r.policy===policy&&r.delayMs===delay).sources[0].summary;
  const weave=active('prompt-weave');
  lines.push(`| ${delay}ms | ${weave.primaryKnockouts}/405 | ${active('prompt-retreat').primaryKnockouts}/405 | ${active('front-weave').primaryKnockouts}/405 | ${weave.knockoutsUnderFiveSeconds}/405 |`);
}
lines.push('','Sources in that table use ordinary active bot brains. Fast means a primary knockout within five seconds after the guaranteed opening hit; it is not a failure grade. All body sizes and initial fighter/ammo distances are pooled; grouped results remain in JSON.','',
  '| Wait | Total population KOs | Body KOs | Flight KOs | KOs/min | Captures | Shots | Hits |',
  '|---:|---:|---:|---:|---:|---:|---:|---:|');
for(const r of populations){const c=r.counts;lines.push(`| ${r.delayMs}ms | ${c.knockouts} | ${c.bodyKnockouts} | ${c.flightKnockouts} | ${r.totalKnockoutsPerMinute} | ${c.captures} | ${c.launches} | ${c.impacts} |`);}
lines.push('','Each population row combines three staged twenty-bot runs of ten minutes. Flight KOs classify actors flying in the preceding frame or launched as a captive in the death tick, including spent-missile burnup. Body KOs are the remaining deaths. These are not all giant or duel knockouts.','',
  '| Wait | Ordinary bot-policy primary KOs / 810 | Rear-ammo weaving primary KOs / 810 |', '|---:|---:|---:|');
for(const delay of [0,1000,2000]){
  const sum=policy=>trials.find(r=>r.policy===policy&&r.delayMs===delay).sources.reduce((s,r)=>s+r.summary.primaryKnockouts,0);
  lines.push(`| ${delay}ms | ${sum('bot')} | ${sum('rear-weave')} |`);
}
lines.push('','The last table pools active and explicitly idle ammo controls; use its paired timing comparison, not its absolute rate as a claim about normal earned ammo. Ordinary bot-policy primary KOs include both attacker and defender. Captures are counted separately.','',
  'See [full grouped results and source hashes](capture-fire-delay-summary.json) for size/distance breakdowns, rejection counts and matched-case 547 timing. These controlled observations do not prove human fun or settle the best delay.');
fs.writeFileSync('reports/combat/capture-fire-delay-summary.md',lines.join('\n')+'\n');
console.log(`Saved ${report.fightRuns} delay fight runs and ${populations.length*3} population runs.`);
