// Controlled ordinary inputs in the compiled authoritative arena; no production connections.
// Build first; run: node scripts/size-pull-study.cjs size-pull-before
const fs = require('node:fs');
const path = require('node:path');
const { GameState } = require('../server/dist/schema/GameState.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { moveSpeed } = require('../server/dist/game/movement.js');
const { INHALE } = require('../server/dist/constants/gameConstants.js');
const { stealWeight } = require('../server/dist/systems/inhale.js');
const label = process.argv[2] || 'size-pull';
if (!/^[a-zA-Z0-9_-]+$/.test(label)) throw Error('Invalid report label');
// Offline comparison only: restore both the earlier resistance and binary inner boost in this process.
const baseline = process.argv.includes('--baseline-body-pull');
if (baseline) {
  INHALE.PEER_BODY_PULL = 1;
  require('../server/dist/game/airflow.js').innerBodyPullBoost = (attacker, target) => attacker >= target * INHALE.EAT_RATIO ? 1 : 0;
}
const pairs = [[110,100],[130,100],[200,100],[260,200],[400,200],[600,400],[650,500],[1000,500]];
function stock(width) {
  let lo = 0, hi = 1000000;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width) lo = mid + 1; else hi = mid; }
  return lo;
}
const centre = p => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
function gap(a,b) { const p = centre(a), q = centre(b); return Math.hypot(p.x-q.x,p.y-q.y)-(a.width+b.width)/2; }
function run(hunterWidth,preyWidth,startGap,escape) {
  let clock = 1000000000, random = 71;
  Math.random = () => { random = (Math.imul(random,1664525)+1013904223) >>> 0; return random/4294967296; };
  Date.now = () => clock;
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.trafficOn = s.weaponsOn = s.surgesOn = s.shiftsOn = false; s.setTurbines('off'); s.blackHoles.clear(); s.update(0,clock);
  const a = s.addPlayer('hunter','Hunter',clock), b = s.addPlayer('prey','Prey',clock);
  a.setGems(stock(hunterWidth),4200,4200); b.setGems(stock(preyWidth),4200,4200);
  a.placeAt(1100-a.width/2,2100-a.height/2);
  b.placeAt(1100+(a.width+b.width)/2+startGap-b.width/2,2100-b.height/2);
  a.facing = b.facing = 0; a.dropProtection(); b.dropProtection(); a.startInhale(clock);
  const initial = centre(b); let minGap = startGap, capturedAt = null, brokeConeAt = null, connected = false;
  for (let tick = 1; tick <= 150; tick++) {
    clock = 1000000000 + tick*1000/30;
    const p = centre(a), q = centre(b), dx = q.x-p.x, dy = q.y-p.y, d = Math.hypot(dx,dy)||1;
    a.steer(dx/d,dy/d); a.aimAt(dx/d,dy/d);
    const delay = escape === 'late-away' ? 800 : 250;
    if (clock-1000000000 >= delay) {
      if (escape === 'away' || escape === 'late-away') b.steer(dx/d,dy/d);
      else if (escape === 'sideways') b.steer(0,1);
    }
    s.update(1/30,clock);
    if (b.capturedBy) { capturedAt = tick/30; break; }
    minGap = Math.min(minGap,gap(a,b));
    const inCone = stealWeight(s,a,b)>0;
    if (connected && a.inhaling && !inCone) brokeConeAt ??= tick/30;
    connected ||= inCone;
  }
  const end = centre(b);
  return { hunterWidth,preyWidth,startGap,escape,reactionMs:escape==='idle'?null:escape==='late-away'?800:250,
    hunterSpeed:moveSpeed(hunterWidth),preySpeed:moveSpeed(preyWidth),captured:capturedAt!==null,capturedAt,
    finalGap:capturedAt===null?+gap(a,b).toFixed(1):null,minGap:capturedAt===null?+minGap.toFixed(1):null,brokeConeAt,
    preyTravel:capturedAt===null?+Math.hypot(end.x-initial.x,end.y-initial.y).toFixed(1):null };
}
const savedRandom = Math.random, savedNow = Date.now;
let cases;
try { cases = pairs.flatMap(([a,b])=>[40,120,300].flatMap(g=>['idle','away','sideways','late-away'].map(e=>run(a,b,g,e)))); }
finally { Math.random = savedRandom; Date.now = savedNow; }
const summarize = rows => ({ cases:rows.length,captured:rows.filter(r=>r.captured).length,brokeCone:rows.filter(r=>r.brokeConeAt!==null).length });
const report = { method:'96 deterministic, five-second single-breath pursuits at 30 Hz: eight physical width pairs, three edge gaps, idle/250ms outward/250ms committed upward/800ms outward response. The hunter follows and aims through ordinary controls and shared turning; neither actor gets a bot-only rule. Capture does not count as leaving the cone or free travel. No field gems, hazards or weapons. No damage or injury is staged.',
  curve:{peerPull:INHALE.PEER_BODY_PULL??1,fullAdvantageRatio:baseline?null:INHALE.BODY_PULL_FULL_RATIO,innerBoost:baseline?'binary capture threshold':'smooth size advantage'},
  byResponse:Object.fromEntries(['idle','away','sideways','late-away'].map(e=>[e,summarize(cases.filter(r=>r.escape===e))])),cases };
fs.mkdirSync(path.join('reports','combat'),{recursive:true});
fs.writeFileSync(path.join('reports','combat',`${label}-chases.json`),JSON.stringify(report,null,2));
console.log(JSON.stringify(report.byResponse,null,2));
