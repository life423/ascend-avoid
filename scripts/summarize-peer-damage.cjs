// Summarize saved authoritative simulations; never change the running game.
const fs = require('node:fs');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { gunzipSync } = require('node:zlib');
const read = name => {
  const compressed=`reports/combat/${name}.json.gz`;
  return JSON.parse(fs.existsSync(compressed)?gunzipSync(fs.readFileSync(compressed)).toString('utf8'):fs.readFileSync(`reports/combat/${name}.json`, 'utf8'));
};
const median = values => values.length ? values.sort((a, b) => a - b)[Math.floor(values.length / 2)] : null;
const round = value => value === null ? null : +value.toFixed(3);
function summarize(rows) {
  const kills = rows.filter(r => r.outcome === 'defender knocked out');
  const reloads = rows.filter(r => r.firstReload);
  return {
    cases: rows.length, openingKnockouts: rows.filter(r => r.opening?.out).length,
    defenderKnockouts: kills.length, defenderCaptures: rows.filter(r => r.outcome === 'defender captured').length,
    attackerKnockouts: rows.filter(r => r.outcome === 'attacker knocked out').length,
    attackerCaptures: rows.filter(r => r.outcome === 'attacker captured').length,
    bothFreeAndAlive: rows.filter(r => r.outcome === 'survived').length,
    killsUnderFiveSeconds: kills.filter(r => r.elapsed < 5).length,
    killsCreditedToAttacker: kills.filter(r => r.finish?.byId === 'attacker').length,
    reloads: reloads.length, reloadMedianSeconds: round(median(reloads.map(r => r.firstReload.seconds))),
    capturesUnderTwoSeconds: reloads.filter(r => r.firstReload.seconds < 2).length,
    killMedianSeconds: round(median(kills.map(r => r.elapsed))),
    followupLaunches: rows.filter(r => r.firstFollowup !== null && r.firstFollowup !== undefined).length,
    secondHits: rows.filter(r => r.secondHit !== null && r.secondHit !== undefined).length,
  };
}
const fights = [];
for (const name of ['current', '33']) {
  for (const suffix of ['duels', 'retreat', 'reloads', 'reloads-retreat', 'prompt-retreat', 'prompt-weave']) {
    const label = `peer-${name}-${suffix}`, report = read(label);
    assert(report.results.every(r => r.opening), 'all fights must start with a real hit');
    fights.push({ label, mode: report.mode, share: report.share, defense: report.defense,
      firing: report.firing || 'bot', results: report.results });
  }
}
const grouped = (report, key, values) => values.map(value => ({ [key]: value,
  ...summarize(report.results.filter(r => r[key] === value)) }));
const duels = fights.filter(r => r.mode === 'duel').map(r => ({
  label: r.label, share: r.share, defense: r.defense, all: summarize(r.results),
  ratios: grouped(r, 'ratio', [.5, .75, .9, 1, 1.1, 1.19, 1.2]),
  equal: summarize(r.results.filter(v => v.ratio === 1)),
  equalByGap: grouped({results:r.results.filter(v => v.ratio === 1)}, 'gap', [80, 360, 800]),
}));
const reloads = fights.filter(r => r.mode === 'reload').map(r => ({
  label: r.label, share: r.share, defense: r.defense, firing: r.firing,
  sources: ['active', 'idle'].map(behavior => {
    const subset = {results:r.results.filter(v => v.sourceBehavior === behavior)};
    return { behavior, all:summarize(subset.results),
      bySource:grouped(subset, 'source', ['tiny', 'half', 'largest']),
      byAmmoGap:grouped(subset, 'ammoGap', [40, 240, 600]),
      byRivalGap:grouped(subset, 'gap', [80, 360, 800]),
      byWidth:grouped(subset, 'width', [100, 200, 400, 650, 900]) };
  }),
}));
const acquisition = read('peer-ammo-acquisition');
const acquisitionSummary = ['tiny', 'half', 'largest'].flatMap(source => [40, 240, 600].map(ammoGap => ({
  source, ammoGap, ...summarize(acquisition.results.filter(r => r.source === source && r.ammoGap === ammoGap)),
})));
const population = ['size-pull-after', 'peer-33'].map(label => {
  const samples = [11, 29, 73].map(seed => JSON.parse(fs.readFileSync(`reports/movement/${label}-mature-${seed}.json`, 'utf8')));
  const counts = Object.fromEntries(Object.keys(samples[0].counts).map(key => [key, samples.reduce((sum, r) => sum + r.counts[key], 0)]));
  return { label, runs:samples.length, secondsPerRun:600, counts };
});
const sources = ['server/constants/gameConstants.ts','server/game/cannon.ts','server/game/botAim.ts',
  'server/game/movement.ts','server/game/airflow.ts','server/systems/inhale.ts','server/systems/flights.ts',
  'server/schema/PlayerSchema.ts','scripts/peer-damage-study.cjs','scripts/movement-rivalry.cjs'];
const report = {
  generatedAt: new Date().toISOString(),
  baseRevision:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
  sourceHashes:Object.fromEntries(sources.map(file => [file,createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
  formula:'Nonlethal deliberate missile: round(currentTargetGems * min(.85, .33 * (shooterLaunchWidth/currentTargetWidth)^2)). Existing lethality, including 20%-wider launch-size finish, remains separate.',
  normalGamePeerShare:0, fightRuns:fights.reduce((sum,r)=>sum+r.results.length,0),
  duels, reloads, acquisition:acquisitionSummary, loading:read('peer-loading-growth').results, population,
  counterexampleCase:547,
  counterexample:fights.filter(r=>r.mode==='reload'&&r.defense==='retreat').map(r=>({label:r.label,...r.results[546]})),
  limitations:['Opening hits guaranteed; this is not first-shot accuracy.',
    'Bot and scripted input policies, not physical-device, latency or human-fun validation.',
    'Ammo hunters know the chosen source and rival location; idle sources are separate stress controls.',
    'Ordinary spills, theft, injuries, shields, decay and capture growth remain active.',
    'Three staged ten-minute populations do not establish long-term balance or durable giant survival.'],
};
assert.equal(report.fightRuns, 7668);
fs.writeFileSync('reports/combat/peer-damage-summary.json', JSON.stringify(report,null,2));
const lines = ['# 33% peer-missile experiment — October 30', '',
  'Headless comparison only. Normal game damage remains unchanged. See [method and conclusions](../../docs/PEER_DAMAGE_STUDY.md).', '',
  '7,668 fight runs compare old damage and the candidate with the same smooth walking, bounded rotation and gradual suction. Another 405 cases test earning ammunition; 15 test immediate capture growth. Each fight starts with a guaranteed real hit and an unarmed defender.', '',
  '| Equal-sized, no spare ammo | Damage | Defender KO | Defender captured | Both free/alive |',
  '|---|---|---:|---:|---:|'];
for (const r of duels) lines.push(`| ${r.defense} | ${r.share ? '33% candidate' : 'Current'} | ${r.equal.defenderKnockouts}/45 | ${r.equal.defenderCaptures}/45 | ${r.equal.bothFreeAndAlive}/45 |`);
lines.push('', '| Reload against an equal rival | Ammo source | Damage | Defender KO | KO under 5s |', '|---|---|---|---:|---:|');
for (const r of reloads) for (const s of r.sources) lines.push(`| ${r.firing} fire / ${r.defense} defense | ${s.behavior} | ${r.share?'33%':'Current'} | ${s.all.defenderKnockouts}/405 | ${s.all.killsUnderFiveSeconds}/405 |`);
lines.push('', 'Idle prey are deliberately cheap-ammo controls and must not be pooled with active prey to claim earned-capture balance.', '',
  '| Earned ammo, source initially active | Initial edge gap | Acquired within 20s | Median successful time | Acquired under 2s |', '|---|---:|---:|---:|---:|');
for (const r of acquisitionSummary) lines.push(`| ${r.source} | ${r.ammoGap} | ${r.reloads}/${r.cases} | ${r.reloadMedianSeconds}s | ${r.capturesUnderTwoSeconds}/${r.cases} |`);
lines.push('', 'Population totals: three staged twenty-bot runs of ten minutes per rule. Current results are the saved smooth-suction baseline.', '',
  '| Rule | Captures | Shots | Hits | Hits on current leader | Runner-up hits on leader | Current-leader KOs |', '|---|---:|---:|---:|---:|---:|---:|');
for (const r of population) lines.push(`| ${r.label} | ${r.counts.captures} | ${r.counts.launches} | ${r.counts.impacts} | ${r.counts.leaderImpacts} | ${r.counts.runnerHitsLeader} | ${r.counts.leaderKnockouts} |`);
lines.push('', 'Leader means rank at that tick; a former leader may lose rank before a later knockout. This is not a count of all former-leader deaths.', '',
  'Decision: do not enable the candidate yet. The stronger first hit is credible, but quick earned reloads compound injury shrink, immediate capture growth and the existing 20%-wider finish. Sideways movement improves survival without removing this failure mode.', '',
  'Raw case summaries, source hashes, grouped size/distance results and the fast-reload example are in [peer-damage-summary.json](peer-damage-summary.json).');
fs.writeFileSync('reports/combat/peer-damage-summary.md', lines.join('\n')+'\n');
const example=JSON.parse(fs.readFileSync('.tmp/peer-damage-study/peer-33-prompt-retreat/case-547.json','utf8'));
fs.writeFileSync('reports/combat/peer-fast-reload-case.json',JSON.stringify(example,null,2));
console.log(`Saved ${report.fightRuns} fight runs, ${acquisition.results.length} ammo attempts and the full fast-reload trace.`);
