// Authoritative headless experiments; no running-server commands or automatic ammunition replacement.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { gzipSync } = require('node:zlib');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { BotCannonAim } = require('../server/dist/game/botAim.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { captureGrowthTransfer, canCatch } = require('../server/dist/game/cannon.js');
const { updateInhales, fireCaptive } = require('../server/dist/systems/inhale.js');
const { CANNON, BOTS } = require('../server/dist/constants/gameConstants.js');
const options = Object.fromEntries(process.argv.slice(2).map(v => v.replace(/^--/, '').split('=')));
const share = Number(options.share || 0), mode = options.mode || 'duel', repeats = Number(options.repeats || 3);
const defense = options.defense || 'bot';
const firing = options.firing || 'bot';
assert([0, .33].includes(share)); assert(['duel', 'reload', 'acquire', 'loading'].includes(mode));
assert(['bot','retreat','weave'].includes(defense));
assert(['bot','prompt'].includes(firing));
assert(Number.isInteger(repeats) && repeats > 0 && repeats <= 10);
CANNON.PEER_HIT_SHARE = share;
const label = options.label || `peer-${Math.round(share * 100)}-${mode}`;
assert(/^[a-zA-Z0-9_-]+$/.test(label));
const traceDir = path.join('.tmp','peer-damage-study',label); fs.mkdirSync(traceDir,{recursive:true});
const widths = [100, 200, 400, 650, 900], gaps = [80, 360, 800];
const centre = p => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
function stock(width) {
  let lo = 0, hi = 1000000;
  while (lo < hi) { const m = Math.floor((lo + hi) / 2); if (creatureSize(m) < width) lo = m + 1; else hi = m; }
  return lo;
}
function largestAmmo(width, gems) {
  let lo = 0, hi = gems;
  while (lo < hi) { const m = Math.ceil((lo + hi) / 2); if (canCatch(width, creatureSize(m))) lo = m; else hi = m - 1; }
  return lo;
}
function atMost(width) {
  let lo=0,hi=1000000;
  while(lo<hi){const m=Math.ceil((lo+hi)/2);if(creatureSize(m)<=width)lo=m;else hi=m-1;}
  return lo;
}
function caseRun(spec, index) {
  let clock = 1000000000, rng = 8837 + index * 97;
  const seed = rng, random = Math.random, now = Date.now;
  Math.random = () => { rng = (Math.imul(rng,1664525)+1013904223)>>>0; return rng/4294967296; };
  Date.now = () => clock;
  try {
    const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
    s.weaponsOn = s.trafficOn = s.shiftsOn = s.surgesOn = false; s.setTurbines('off'); s.blackHoles.clear(); s.update(0,clock);
    const add = (id,gems,cx,cy) => { const p=s.addPlayer(id,id,clock);p.setGems(gems,4200,4200);p.placeAt(cx-p.width/2,cy-p.height/2);p.dropProtection();return p; };
    const a = add('attacker',stock(spec.width),900,2100);
    const d = mode === 'acquire' || mode === 'loading' ? null : add('defender',spec.ratio>=1.2?atMost(spec.width/spec.ratio):stock(spec.width/spec.ratio),3000,3000);
    const openingAmmo = mode === 'acquire' || mode === 'loading' ? null : add('opening-ammo',32,300,300);
    let source = null;
    if (mode !== 'duel') {
      const sourceGems = spec.source === 'largest' ? largestAmmo(a.width,a.gems) : spec.source === 'half' ? stock(a.width*.5) : 0;
      source = add('reload-source',sourceGems,300,300);
    }
    // All joins precede brain registration: population fill must not remove a scripted participant.
    const putAtMouth = p => p.placeAt(a.x+a.width*.8+1-p.width/2,a.y+(a.height-p.height)/2);
    const capture = p => { a.facing=0;putAtMouth(p);a.startInhale(clock);updateInhales(s,clock,.001);assert.equal(a.gulping,p.sessionId);a.stopInhale(clock);a.captureNeedsRelease=false; };
    const beforeLoad = { width:a.width,gems:a.gems };
    if (mode === 'loading') {
      const originalSource = { width:source.width,gems:source.gems };
      capture(source);
      return { ...spec,seed,sourceType:spec.source,before:beforeLoad,source:originalSource,after:{width:a.width,gems:a.gems},transferred:captureGrowthTransfer(originalSource.gems),instantFinishAgainstFormerPeer:a.width>=beforeLoad.width*CANNON.SHATTER_SHOOTER_RATIO };
    }
    if (openingAmmo) capture(openingAmmo);
    a.placeAt(900-a.width/2,2100-a.height/2); a.facing=0;
    if (d) { d.placeAt(900+(a.width+d.width)/2+spec.gap-d.width/2,2100-d.height/2);d.facing=Math.PI; }
    const start = { attackerWidth:a.width,attackerGems:a.gems,defenderWidth:d?.width,defenderGems:d?.gems,sourceWidth:source?.width,sourceGems:source?.gems };
    if (source) {
      const c=centre(a),r=(a.width+source.width)/2+(spec.ammoGap??120),angle=spec.angle??Math.PI/2;
      source.placeAt(c.x+Math.cos(angle)*r-source.width/2,c.y+Math.sin(angle)*r-source.height/2);
      source.facing=angle;
      if (spec.sourceBehavior!=='idle') { source.isBot=true;s.brains.set(source.sessionId,new BotBrain()); }
    }
    let began = mode==='acquire'?clock:null, opening = null, defenderStarted = false;
    let firstReload = null, firstFollowup = null, secondHit = null, outcome = 'survived';
    let releasedCapture = '', releasedAt = Infinity;
    let nextDecision = 0, nextBreath = clock+180, lastInhaling = false, nextAim = new BotCannonAim();
    const events = [], counts={captures:0,launches:0,pairHits:0,counterHits:0,puffs:0};
    s.onEvent=(type,e)=>{
      if(type==='impact'&&e.byId===a.sessionId&&e.targetId===d?.sessionId){
        if(began===null){began=clock;opening={...e,shooterWidth:openingAmmo.shotShooterWidth,targetGemsBefore:start.defenderGems,actualFraction:e.gems/start.defenderGems};}
        else secondHit??=(clock-began)/1000;
      }
      if(began===null)return;
      if(['capture','launch','impact','combatReward','credit','exhale'].includes(type))events.push({seconds:+((clock-began)/1000).toFixed(3),type,...e});
      if(type==='capture'&&e.byId===a.sessionId){counts.captures++;if(e.targetId===source?.sessionId)firstReload??={seconds:(clock-began)/1000,shooterWidth:a.width,targetWidth:d?.width,lethalAdvantage:d? a.width>=d.width*CANNON.SHATTER_SHOOTER_RATIO:null};}
      if(type==='launch'&&e.byId===a.sessionId){counts.launches++;firstFollowup??=(clock-began)/1000;}
      if(type==='impact'&&e.targetId===d?.sessionId)counts.pairHits++;
      if(type==='impact'&&e.byId===d?.sessionId&&e.targetId===a.sessionId)counts.counterHits++;
      if(type==='exhale')counts.puffs++;
    };
    if(openingAmmo)assert(fireCaptive(s,a,clock));
    let elapsed=0, minimumDefender=d?.gems, boundaryFrames=0;
    for(let tick=1;tick<=1050;tick++){
      clock=1000000000+tick*1000/30;
      if(began!==null&&mode!=='duel'&&clock>=nextDecision){
        nextDecision=clock+250;
        if(lastInhaling&&!a.inhaling)nextBreath=clock+500;
        if(a.gulping&&d&&d.state==='alive'){
          a.stopInhale(clock);a.captureNeedsRelease=false;
          const ac=centre(a),dc=centre(d),dx=dc.x-ac.x,dy=dc.y-ac.y,distance=Math.hypot(dx,dy)||1;
          const valid=()=>d.state==='alive'&&!d.capturedBy&&!d.flying&&!d.spawnProtected&&clock>=d.impactImmuneUntil&&distance-(a.width+d.width)/2<=BOTS.FIRE_RANGE;
          const captureKey=`${a.gulping}:${a.captureStartedAt}`, angle=Math.atan2(dy,dx);
          if(releasedCapture!==captureKey){releasedCapture=captureKey;releasedAt=clock;}
          // Prompt inputs release, aim through the real turn cap, then press again.
          // No bot-only 1.4s planning wait; this is not a measured human policy.
          const shot=firing==='prompt'?{angle,ready:valid()&&clock>=releasedAt+250&&Math.abs(Math.atan2(Math.sin(angle-a.facing),Math.cos(angle-a.facing)))<=.12}
            :nextAim.update(captureKey,a.captureStartedAt,clock,a.facing,()=>valid()?{id:d.sessionId,angle}:null,valid);
          a.aimAt(Math.cos(shot.angle),Math.sin(shot.angle));
          const standOff=Math.max((a.width+d.width)/2+80,BOTS.FIRE_RANGE*.55);
          a.steer(distance>standOff?dx/distance:0,distance>standOff?dy/distance:0);
          if(shot.ready)fireCaptive(s,a,clock);
        }else if(source&&source.state==='alive'&&!source.spawnProtected&&!source.capturedBy&&!source.flying){
          const ac=centre(a),bc=centre(source),dx=bc.x-ac.x,dy=bc.y-ac.y,distance=Math.hypot(dx,dy)||1;
          a.steer(dx/distance,dy/distance);
          if(!a.inhaling&&clock>=nextBreath){a.startInhale(clock);nextBreath=clock+500;}
          if(a.inhaling)a.aimAt(dx,dy);
        }else{a.steer(0,0);a.stopInhale(clock);}
        lastInhaling=a.inhaling;
      }
      if(d&&defense!=='bot'&&began!==null&&clock-began>=250&&clock>=d.nextStudyDecision){
        d.nextStudyDecision=clock+250;
        const ac=centre(a),dc=centre(d);let dx=dc.x-ac.x,dy=dc.y-ac.y;
        if(defense==='weave'){
          const sign=Math.floor((clock-began)/1250)%2?1:-1,ox=dx,oy=dy;
          dx=.6*ox-.8*oy*sign;dy=.6*oy+.8*ox*sign;
        }
        if(d.x<180)dx+=1000;if(d.x+d.width>4020)dx-=1000;
        if(d.y<180)dy+=1000;if(d.y+d.height>4020)dy-=1000;
        const length=Math.hypot(dx,dy)||1;d.steer(dx/length,dy/length);
      }
      s.update(1/30,clock);
      if(openingAmmo?.state==='dead'){s.players.delete(openingAmmo.sessionId);s.brains.delete(openingAmmo.sessionId);}
      if(began===null){assert(tick<150,'a real opening impact must occur');continue;}
      elapsed=(clock-began)/1000;
      if(d&&!defenderStarted&&d.state==='alive'){
        defenderStarted=true;d.nextStudyDecision=0;
        if(defense==='bot'){d.isBot=true;const brain=new BotBrain();brain.nextThinkAt=clock+250;s.brains.set(d.sessionId,brain);}
        if(mode==='duel'){a.isBot=true;const attackerBrain=new BotBrain();attackerBrain.nextThinkAt=clock+250;s.brains.set(a.sessionId,attackerBrain);}
      }
      if(d){minimumDefender=Math.min(minimumDefender,d.gems);if(d.x<10||d.y<10||d.x+d.width>4190||d.y+d.height>4190)boundaryFrames++;}
      if(a.state!=='alive'||a.capturedBy){outcome=a.state!=='alive'?'attacker knocked out':'attacker captured';break;}
      if(d&&(d.state!=='alive'||d.capturedBy)){outcome=d.state!=='alive'?'defender knocked out':'defender captured';break;}
      if(mode==='acquire'&&firstReload){outcome='ammo acquired';break;}
      if(elapsed>=(mode==='acquire'?20:30))break;
    }
    if(mode!=='acquire')assert(opening,'each fight begins with an actual missile hit');
    const finish=events.filter(e=>e.targetId===d?.sessionId&&(e.type==='combatReward'||e.type==='credit'&&e.out)).at(-1);
    const result={...spec,seed,share,defense,firing,start,opening,outcome,elapsed:+elapsed.toFixed(3),firstReload,firstFollowup,secondHit,counts,finish,
      end:{attackerGems:a.gems,attackerWidth:a.width,defenderGems:d?.gems,defenderWidth:d?.width,defenderInjured:d?.breathingBlocked},minimumDefender,boundarySeconds:+(boundaryFrames/30).toFixed(2),events};
    fs.writeFileSync(path.join(traceDir,`case-${index+1}.json`),JSON.stringify(result,null,2));
    delete result.events; return result;
  }finally{Math.random=random;Date.now=now;}
}
let specs=[];
if(mode==='duel')for(const width of widths)for(const ratio of [.5,.75,.9,1,1.1,1.19,1.2]){
  if(width/ratio>1200)continue;
  for(const gap of gaps)for(let r=0;r<repeats;r++)specs.push({width,ratio,gap,repeat:r});
}
if(mode==='reload')for(const width of widths)for(const gap of gaps)for(const ammoGap of [40,240,600])for(const source of ['tiny','half','largest'])for(const sourceBehavior of ['active','idle'])for(let r=0;r<repeats;r++)specs.push({width,ratio:1,gap,ammoGap,source,sourceBehavior,repeat:r});
if(mode==='acquire')for(const width of widths)for(const ammoGap of [40,240,600])for(const angle of [0,Math.PI/2,Math.PI])for(const source of ['tiny','half','largest'])for(let r=0;r<repeats;r++)specs.push({width,ammoGap,angle,source,sourceBehavior:'active',repeat:r});
if(mode==='loading')for(const width of widths)for(const source of ['tiny','half','largest'])specs.push({width,source});
const results=specs.map(caseRun);
const summary={cases:results.length,openingHits:results.filter(r=>r.opening).length,openingKnockouts:results.filter(r=>r.opening?.out).length,
  defenderKnockouts:results.filter(r=>r.outcome==='defender knocked out').length,defenderCaptures:results.filter(r=>r.outcome==='defender captured').length,
  attackerKnockouts:results.filter(r=>r.outcome==='attacker knocked out').length,attackerCaptures:results.filter(r=>r.outcome==='attacker captured').length,
  survivors:results.filter(r=>r.outcome==='survived').length,reloads:results.filter(r=>r.firstReload).length,followups:results.filter(r=>r.firstFollowup!==null&&r.firstFollowup!==undefined).length,
  secondHits:results.filter(r=>r.secondHit!==null&&r.secondHit!==undefined).length,underFiveSecondKills:results.filter(r=>r.outcome==='defender knocked out'&&r.elapsed<5).length};
const report={mode,share,repeats,defense,method:'Normal 4200x4200 world, fixed 60-unit missiles, current walking/rotation/suction. No assembled weapons, hazards or ambient gems. All opening ammunition is actually captured and fired; defender starts empty. Opening hit is guaranteed to isolate follow-up risk, not estimate hit accuracy. Spent opening ammunition is removed only after its knockout, so it cannot become an idle reload dispenser. Additional ammo sources exist before launch and use ordinary bot brains, except explicitly labelled idle stress controls. Reload hunter decisions run at 250ms and shots use the ordinary fallible BotCannonAim. Retreat controls start 250ms after impact, use ordinary movement and avoid map edges; bot defense uses unchanged ordinary brains. Population, collision, shield, spill, theft and size rules are not bypassed.',summary,results};
fs.mkdirSync(path.join('reports','combat'),{recursive:true});
report.firing=firing;
if(defense==='weave')report.method+=' Weave defense alternates a diagonal outward/sideways input every 1.25s at the same 250ms decision cadence; it is an evasive input control, not a human playtest.';
if(firing==='prompt')report.method=report.method.replace('and shots use the ordinary fallible BotCannonAim.', 'and prompt firing releases then waits for a fresh action and normal bounded rotation, without bot planning delays. Aim is exact at each decision; this stress control is not a claim about human skill.');
if(mode==='loading')fs.writeFileSync(path.join('reports','combat',`${label}.json`),JSON.stringify(report,null,2));
else fs.writeFileSync(path.join('reports','combat',`${label}.json.gz`),gzipSync(JSON.stringify(report),{level:9}));
console.log(JSON.stringify(summary));
