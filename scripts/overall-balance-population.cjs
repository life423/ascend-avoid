// Observational current-rule study. Requires an existing build; never builds or patches tuning.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { fork, execFileSync } = require('node:child_process');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { initializeWeaponSets } = require('../server/dist/systems/weapons.js');
const { allWeapons } = require('../server/dist/game/weaponKit.js');
const { canCatch } = require('../server/dist/game/cannon.js');
const { chooseSpawn } = require('../server/dist/game/spawnSafety.js');
const tuning = require('../server/dist/constants/gameConstants.js');
const DT = 1 / 30, START = 1_000_000;
const ROOT = path.resolve(__dirname, '..');
const REFERENCE_RELEASE = '9344b163c1c5295a5b17435248d362c75e760995';
const CHECKOUT_HEAD = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
const OUT = path.resolve(__dirname, '../.tmp/overall-balance-population');
const round = n => Math.round(n * 100) / 100;
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const add = (bucket, key, value = 1) => { bucket[key] = (bucket[key] || 0) + value; };
const tier = width => width < 100 ? 'below100' : width < 300 ? '100to300' : width < 500 ? '300to500' : width < 1000 ? '500to1000' : '1000plus';
const centre = p => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
const tuningBefore = JSON.stringify(tuning);
assert.equal(tuning.CANNON.PEER_HIT_SHARE, .25);
assert.equal(tuning.CANNON.BULLET_SIZE, 60);
assert.equal(tuning.CANNON.SHATTER_SHOOTER_RATIO, 1.2);
assert.equal(tuning.INHALE.INJURY_MS, 7000);
assert.equal(tuning.BOTS.FILL_TO, 20);

function compiledFingerprint() {
  const files = [];
  function walk(dir) { for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(file); else if (file.endsWith('.js')) files.push(file);
  } }
  walk(path.resolve(__dirname, '../server/dist'));
  const manifest = files.sort().map(file => ({ file: path.relative(path.resolve(__dirname, '..'), file), sha256: hash(fs.readFileSync(file)) }));
  return { sha256: hash(JSON.stringify(manifest)), files: manifest };
}
function sourceFingerprint() {
  const files = [];
  for (const dir of ['constants', 'game', 'schema', 'systems', 'rooms']) {
    const root = path.join(ROOT, 'server', dir);
    for (const name of fs.readdirSync(root).filter(name => name.endsWith('.ts')).sort()) {
      const file = path.join(root, name); files.push({ file: path.relative(ROOT, file), sha256: hash(fs.readFileSync(file)) });
    }
  }
  files.sort((a, b) => a.file.localeCompare(b.file));
  return { sha256: hash(JSON.stringify(files)), files };
}
const COMPILED_AT_START = compiledFingerprint(), SOURCE_AT_START = sourceFingerprint();
const provenance = { checkoutHead: CHECKOUT_HEAD, referenceRelease: REFERENCE_RELEASE, compiledSha256: COMPILED_AT_START.sha256,
  sourceSha256: SOURCE_AT_START.sha256, tuningSha256: hash(tuningBefore), node: process.version,
  caveat: 'Git HEAD identifies the checkout. Hashes identify the actual source and existing compiled files; this driver never rebuilds or assumes that an existing build corresponds to HEAD.' };

function run(scenario, seed, seconds) {
  assert(['opening', 'giant-mix'].includes(scenario)); assert(Number.isInteger(seed));
  assert(Number.isInteger(seconds) && seconds > 0 && seconds <= 3600);
  let randomState = seed >>> 0, clock = START;
  const originalRandom = Math.random, originalNow = Date.now;
  Math.random = () => { randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0; return randomState / 4294967296; };
  Date.now = () => clock;
  try {
    const state = new GameState(); initializeWeaponSets(state); state.update(0, clock);
    const probe = state.addPlayer('probe', 'Population probe', clock);
    state.brains.set(probe.sessionId, new BotBrain());
    assert.equal(probe.isBot, false); assert.equal(state.players.size, 20);
    const seededGiants = new Map();
    if (scenario === 'giant-mix') {
      const chosen = [probe, ...[...state.players.values()].filter(p => p !== probe).slice(0, 2)];
      [100000, 50000, 20000].forEach((gems, i) => { chosen[i].setGems(gems, state.worldWidth, state.worldHeight); seededGiants.set(chosen[i].sessionId, gems); });
      // Setup only: place enlarged bodies safely, then the newborns. No simulation
      // tick occurs while actors are parked; ordinary protection/brains remain.
      for (const p of state.players.values()) p.placeAt(-5000, -5000);
      for (const p of [...state.players.values()].sort((a, b) => b.width - a.width)) {
        const spot = chooseSpawn(state, p); assert(spot, `No legal setup spawn for width ${p.width}`);
        p.placeAt(spot.x, spot.y);
      }
    }
    const initial = [...state.players.values()].map(p => ({ id: p.sessionId, bot: p.isBot, gems: p.gems, width: p.width, x: p.x, y: p.y, setupGiant: seededGiants.has(p.sessionId) }));
    const counters = {}, damage = {}, captureMatchups = {}, hitMatchups = {}, occupancySeconds = {}, holes = [];
    const events = [], deaths = [], launches = [], captures = [], lives = [], leaderChanges = [], snapshots = [], impactDetails = [], injuryTransitions = [];
    const first = {}, currentLives = new Map(), before = new Map(), tickCredits = new Map(), tickTraffic = new Set();
    let maxGems = 0, maxWidth = 20, leaderId = '', leaderSince = 0, peakBolts = 0, peakActive = 0;
    const weaponActivations = {}, weaponActiveSeconds = {}, weaponPhases = new Map();
    const captureOrigins = new Map(), injuries = new Map(), injuryOutcomes = { survived: 0, died: 0, unfinished: 0 };
    const respawnWaits = {}, currentRespawnWait = new Map();
    let currentTick = 0;
    const pSnapshot = p => ({ ...centre(p), width: p.width, gems: p.gems, state: p.state, flying: p.flying, flightKind: p.flightKind, shotOwner: p.shotOwner,
      shotShooterWidth: p.shotShooterWidth, capturedBy: p.capturedBy, injured: p.breathingBlocked, injuredUntil: p.injuredUntil,
      stunned: p.stunned, stunRemainingMs: Math.max(0, p.stunEndsAt - clock), spawnProtected: p.spawnProtected,
      movementVx: p.movementVx, movementVy: p.movementVy, flightVx: p.flightVx, flightVy: p.flightVy });
    const originalHitPlayer = state.hitPlayer;
    state.hitPlayer = function(p, ...args) { tickTraffic.add(p.sessionId); return originalHitPlayer.call(this, p, ...args); };
    state.onEvent = (type, data) => {
      const t = round(state.time / 1000), actorId = data.byId || data.id, targetId = data.targetId;
      add(counters, type);
      if (['capture', 'launch', 'impact', 'partCollected', 'weaponAssembled', 'weaponPlaced'].includes(type)) first[type] ??= t;
      if (type === 'capture') {
        const attacker = before.get(actorId), target = before.get(targetId), caught = state.players.get(targetId);
        const row = { t, by: actorId, target: targetId, attackerWidth: attacker?.width, targetWidth: target?.width, targetGems: target?.gems,
          postTransferGems: caught?.gems, ratio: caught?.captureRatio, holdMs: caught?.captureHoldMs };
        captures.push(row); captureOrigins.set(targetId, row);
        if (attacker && target) add(captureMatchups, `${tier(attacker.width)}->${tier(target.width)}`);
      }
      if (type === 'launch') {
        const p = state.players.get(data.id), captured = captureOrigins.get(data.id);
        const row = { t, by: data.byId, projectile: data.id, kind: p?.flightKind, shooterWidth: p?.shotShooterWidth, projectileWidth: p?.width,
          heldSeconds: captured ? round(t - captured.t) : null };
        launches.push(row); add(counters, `launchKind:${p?.flightKind}`);
      }
      if (type === 'impact') impactDetails.push({ t, tick: currentTick, ...data, targetBefore: before.get(targetId),
        projectileBefore: before.get(data.projectileId), launcherBefore: before.get(data.byId) || null });
      if (type === 'credit') {
        const projectile = data.projectileId && (before.get(data.projectileId) || pSnapshot(state.players.get(data.projectileId)));
        const cause = data.how === 'cannon' ? data.projectileId ? (projectile?.flightKind === 'turbine' ? 'turbine-target' : 'missile-target') : 'spent-missile' : data.how;
        add(counters, `credit:${cause}`); if (data.out) add(counters, `creditedOut:${cause}`);
        add(damage, cause, Number(data.gems) || 0);
        if (data.out) { const list = tickCredits.get(targetId) || []; list.push({ cause, by: data.byId, projectileId: data.projectileId, gems: data.gems }); tickCredits.set(targetId, list); }
        const target = before.get(targetId), attacker = before.get(data.byId);
        const shooterWidth = data.projectileId ? projectile?.shotShooterWidth || attacker?.width : attacker?.width;
        if (target && shooterWidth && cause !== 'spent-missile' && data.how !== 'stole') {
          const key = `${cause}:${tier(shooterWidth)}->${tier(target.width)}`;
          const row = hitMatchups[key] ||= { hits: 0, creditedOut: 0, gems: 0 };
          row.hits++; row.creditedOut += data.out ? 1 : 0; row.gems += Number(data.gems) || 0;
        }
      }
      if (['capture', 'launch', 'impact', 'credit', 'combatReward', 'weaponAssembled', 'weaponPlaced', 'weaponTheft', 'exhale', 'gustHit', 'wallSlip'].includes(type)) {
        // No real names or external identifiers: only stable local simulation actor IDs.
        const clean = { ...data }; delete clean.by; delete clean.target;
        events.push({ t, tick: currentTick, type, ...clean });
      }
    };
    for (const [index, h] of state.blackHoles.entries()) holes.push({ index, retries: 0, abortedWarnings: 0, generation: h.generation, transitions: [], phaseSeconds: {}, dormantSince: null, dormantDelaysSeconds: [] });
    function sample(second) {
      const population = [...state.players.values()].map(p => ({ id: p.sessionId, gems: p.gems, width: p.width, x: round(p.x), y: round(p.y), state: p.state,
        captured: !!p.capturedBy, flying: p.flying, injured: p.breathingBlocked, holding: !!p.gulping }));
      const phases = {}, builds = allWeapons(state); for (const w of builds) add(phases, w.phase);
      const ordinary = [...state.players.values()].filter(p => p.state === 'alive' && !p.flying && !p.capturedBy);
      let sizeEligiblePairs = 0, nearbySizeEligiblePairs = 0;
      for (const a of ordinary) for (const b of ordinary) if (a !== b && !a.breathingBlocked && !b.breathingBlocked && canCatch(a.width, b.width)) {
        sizeEligiblePairs++;
        const ac = centre(a), bc = centre(b), reach = tuning.INHALE.REACH + a.width * tuning.INHALE.REACH_PER_SIZE;
        if (Math.hypot(ac.x - bc.x, ac.y - bc.y) <= reach + a.width * .3 + b.width / 2) nearbySizeEligiblePairs++;
      }
      snapshots.push({ second, population, leader: state.leader()?.sessionId, leaderGems: Math.max(...population.map(p => p.gems)),
        fieldCrystals: state.fieldGems, worldCrystals: state.gems.size, worldGemValue: [...state.gems.values()].reduce((sum, g) => sum + g.value, 0),
        totalPlayerGems: population.reduce((sum, p) => sum + p.gems, 0), loadedPlayers: population.filter(p => p.holding).length,
        sizeEligiblePairs, nearbySizeEligiblePairs, weaponPhases: phases, activeKinds: builds.filter(w => w.phase === 'active').map(w => w.kind),
        freeParts: builds.filter(w => w.phase === 'parts' && !w.owner).reduce((n, w) => n + w.parts.filter(p => !p.carriedBy).length, 0),
        holes: state.blackHoles.map(h => ({ phase: h.phase, generation: h.generation, x: h.x, y: h.y, nextAtSeconds: round(h.at / 1000) })),
        cumulative: { deaths: deaths.length, captures: captures.length, launches: launches.length } });
    }
    sample(0);
    for (let tick = 1; tick <= seconds * 30; tick++) {
      currentTick = tick; clock = START + tick * 1000 / 30; before.clear(); tickCredits.clear(); tickTraffic.clear();
      state.players.forEach((p, id) => before.set(id, pSnapshot(p)));
      const oldLeader = state.leader()?.sessionId;
      const oldHoles = state.blackHoles.map(h => ({ phase: h.phase, at: h.at, generation: h.generation, x: h.x, y: h.y }));
      state.update(DT, clock);
      assert.equal(state.players.size, 20);
      for (const [id, p] of state.players) {
        const prev = before.get(id), t = tick / 30;
        assert(Number.isFinite(p.gems) && p.gems >= 0 && Number.isFinite(p.width), 'finite nonnegative population');
        let life = currentLives.get(id);
        if (!life || prev.state !== 'alive' && p.state === 'alive') {
          life = { id, index: lives.filter(l => l.id === id).length, start: round(tick === 1 ? 0 : t), initialGems: tick === 1 ? initial.find(r => r.id === id).gems : p.gems,
            seeded: tick === 1 && seededGiants.has(id), maxGems: p.gems, maxWidth: p.width, milestones: {}, tierSeconds: {} };
          currentLives.set(id, life);
        }
        if (p.state === 'alive') {
          maxGems = Math.max(maxGems, p.gems); maxWidth = Math.max(maxWidth, p.width);
          life.maxGems = Math.max(life.maxGems, p.gems); life.maxWidth = Math.max(life.maxWidth, p.width);
          for (const width of [100, 300, 500, 800, 1000, 1200]) if (p.width >= width && life.milestones[`width${width}`] === undefined) {
            life.milestones[`width${width}`] = round(t - life.start); first[`width${width}`] ??= round(t);
          }
          for (const gems of [100, 1000, 5000, 10000, 20000, 50000, 100000]) if (p.gems >= gems && life.milestones[`gems${gems}`] === undefined) life.milestones[`gems${gems}`] = round(t - life.start);
          add(life.tierSeconds, tier(p.width), DT);
          if (p.flying) add(occupancySeconds, `flight:${p.flightKind}`, DT);
          else if (p.capturedBy) add(occupancySeconds, 'captured', DT);
          else add(occupancySeconds, `body:${tier(p.width)}`, DT);
          if (p.gulping) add(occupancySeconds, 'loaded', DT);
          if (p.breathingBlocked) add(occupancySeconds, 'injured', DT);
        } else add(occupancySeconds, 'dead', DT);
        if (!prev.flying && p.flying) add(counters, `flightStart:${p.flightKind}`);
        if (p.state !== 'alive' && clock >= p.respawnAt) {
          const wait = (currentRespawnWait.get(id) || 0) + DT; currentRespawnWait.set(id, wait);
          const record = respawnWaits[id] ||= { totalSeconds: 0, maxContinuousSeconds: 0 };
          record.totalSeconds += DT; record.maxContinuousSeconds = Math.max(record.maxContinuousSeconds, wait);
        } else currentRespawnWait.delete(id);
        if (!prev.injured && p.breathingBlocked) { injuries.set(id, { t, width: prev.width }); injuryTransitions.push({ t: round(t), id, before: prev, after: pSnapshot(p) }); }
        if (prev.injured && !p.breathingBlocked && injuries.has(id)) { injuryOutcomes[p.state === 'alive' ? 'survived' : 'died']++; injuries.delete(id); }
        if (prev.capturedBy && !p.capturedBy) {
          add(counters, p.flying ? 'captureRelease:fired' : p.state === 'alive' ? 'captureRelease:alive-not-flight' : 'captureRelease:death');
        }
        if (prev.state === 'alive' && p.state !== 'alive') {
          const credited = tickCredits.get(id) || [];
          const cause = credited.at(-1)?.cause || (tickTraffic.has(id) ? 'uncredited-traffic' : 'uncredited-other');
          const death = { t: round(t), id, width: prev.width, gems: prev.gems, flying: prev.flying, flightKind: prev.flightKind, captured: !!prev.capturedBy,
            cause, credits: credited, wasLeader: oldLeader === id, seededGiant: life.seeded, lifeIndex: life.index };
          deaths.push(death); add(counters, `actualDeath:${cause}`);
          first.death ??= round(t);
          if (injuries.has(id)) { injuryOutcomes.died++; injuries.delete(id); }
          life.end = round(t); life.cause = cause; lives.push(life);
        }
      }
      for (let i = impactDetails.length - 1; i >= 0 && impactDetails[i].tick === tick; i--) {
        const target = state.players.get(impactDetails[i].targetId);
        impactDetails[i].targetAfterTick = target ? pSnapshot(target) : null;
      }
      const lead = state.leader(), newLeader = lead && lead.gems >= 100 ? lead.sessionId : '';
      if (newLeader !== leaderId) {
        if (leaderId) leaderChanges.at(-1).tenureSeconds = round(tick / 30 - leaderSince);
        if (newLeader) leaderChanges.push({ t: round(tick / 30), id: newLeader, gems: lead.gems, width: lead.width });
        leaderId = newLeader; leaderSince = tick / 30;
      }
      for (const [index, w] of allWeapons(state).entries()) {
        if (w.phase === 'active') { add(weaponActiveSeconds, w.kind, DT); if (weaponPhases.get(index) !== 'active') add(weaponActivations, w.kind); }
        weaponPhases.set(index, w.phase);
      }
      const builds = allWeapons(state); peakActive = Math.max(peakActive, builds.filter(w => w.phase === 'active').length);
      peakBolts = Math.max(peakBolts, builds.reduce((n, w) => n + w.bolts.size, 0));
      for (const [index, hole] of state.blackHoles.entries()) {
        const prev = oldHoles[index], row = holes[index]; add(row.phaseSeconds, hole.phase, DT);
        if (prev.phase === 'dormant' && hole.phase === 'dormant' && hole.at > prev.at) row.retries++;
        if (prev.phase === 'warning' && hole.phase === 'dormant') row.abortedWarnings++;
        if (prev.phase !== hole.phase) {
          row.transitions.push({ t: round(tick / 30), from: prev.phase, to: hole.phase, generation: hole.generation, x: hole.x, y: hole.y });
          if (hole.phase === 'dormant') row.dormantSince = tick / 30;
          if (prev.phase === 'dormant' && hole.phase === 'warning' && row.dormantSince !== null) row.dormantDelaysSeconds.push(round(tick / 30 - row.dormantSince));
        }
        row.generation = hole.generation;
      }
      if (tick % 150 === 0) sample(round(tick / 30));
    }
    if (leaderId) leaderChanges.at(-1).tenureSeconds = round(seconds - leaderSince);
    for (const [id, life] of currentLives) if (state.players.get(id).state === 'alive') { life.end = seconds; life.cause = null; lives.push(life); }
    injuryOutcomes.unfinished = injuries.size;
    assert.equal(JSON.stringify(tuning), tuningBefore, 'study must not mutate tuning');
    const report = { release: CHECKOUT_HEAD, provenance, instrumentationVersion: 2, scenario, seed, seconds, tickHz: 30, initial, first, maxGems, maxWidth, counters, damage,
      captureMatchups, hitMatchups, occupancySeconds, injuryOutcomes, respawnWaits, weaponActivations, weaponActiveSeconds, peakActive, peakBolts,
      deaths, captures, launches, leaderChanges, lives, holes, snapshots, events, impactDetails, injuryTransitions };
    report.signature = hash(JSON.stringify(report));
    return report;
  } finally { Math.random = originalRandom; Date.now = originalNow; }
}

if (process.argv[2] === '--case') {
  const [scenario, seed, seconds, output] = process.argv.slice(3);
  const at = process.hrtime.bigint(); const row = run(scenario, Number(seed), Number(seconds));
  assert.equal(compiledFingerprint().sha256, COMPILED_AT_START.sha256, 'compiled files must remain unchanged during case');
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(row, null, 2));
  console.log(JSON.stringify({ scenario, seed: row.seed, seconds: row.seconds, actualSeconds: round(Number(process.hrtime.bigint() - at) / 1e9),
    maxGems: row.maxGems, maxWidth: row.maxWidth, deaths: row.deaths.length, captures: row.captures.length, shots: row.launches.length, file: output, signature: row.signature }));
} else {
  (async () => {
    fs.mkdirSync(OUT, { recursive: true }); const fingerprint = compiledFingerprint();
    const jobs = ['opening', 'giant-mix'].flatMap(scenario => [11, 73, 218].map(seed => ({ scenario, seed, seconds: 600 })));
    jobs.push({ scenario: 'opening', seed: 11, seconds: 1800 });
    const rows = []; let next = 0;
    await Promise.all(Array.from({ length: 2 }, async () => { while (next < jobs.length) {
      const job = jobs[next++], file = path.join(OUT, `${job.scenario}-${job.seed}-${job.seconds}.json`);
      const row = await new Promise((resolve, reject) => {
        const child = fork(__filename, ['--case', job.scenario, job.seed, job.seconds, file].map(String), { silent: true }); let stdout = '', stderr = '';
        child.stdout.on('data', data => { stdout += data; }); child.stderr.on('data', data => { stderr += data; });
        child.on('error', reject); child.on('exit', code => { if (code) reject(Error(stderr || `case exited ${code}`)); else { try { resolve(JSON.parse(stdout)); } catch (error) { reject(error); } } });
      }); rows.push(row); console.log(JSON.stringify(row));
    } }));
    assert.equal(compiledFingerprint().sha256, fingerprint.sha256, 'compiled rules must remain unchanged during study');
    const manifest = { generatedAt: new Date().toISOString(), release: CHECKOUT_HEAD, provenance, source: SOURCE_AT_START, node: process.version,
      compiled: fingerprint, tuningSha256: hash(tuningBefore), tuning: JSON.parse(tuningBefore), rows,
      method: '30Hz in-process full authoritative GameState updates with seeded Math.random and clock. Normal 20 actors, one human-flagged actor driven by the same ordinary BotBrain plus19 bots. Every system retains production defaults: traffic/bombs/shifts remain disabled, fans/weapons/field/holes/recovery stay normal. Opening cases start newborn; separate artificial established mixes seed100k/50k/20k gems once, place all bodies with existing safe-spawn search, then leave all decisions/rules unchanged. Five-second population time series plus event/death/leader/life/hole histories retained. No networking/rendering/input latency; not human skill, fun or population-retention evidence.',
      audit: ['game-loop-followup.cjs resets PEER_HIT_SHARE=0 even for its default current case and optionally monkeypatches impactGems; not used.', 'rival-damage-population.cjs intentionally compares0/.25/.33 process-local floors; not used.', 'balance-playtest.cjs exposes growth/decay/holes overrides, uses1000-gem giant scenarios and coarser minute samples; not used.', 'game-loop-review.cjs can take a seventh floor override and visible-world policies have old fixed threat heuristics; not reused. Current ordinary BotBrain is used directly.'],
      limitations: ['Setup giants are not naturally earned progression and consume extra placement RNG; do not interpret as controlled paired comparisons.', 'Potential size-eligible nearby pairs are five-second geometry-light availability samples; they omit aim, pressure, protection and exact theft/capture eligibility and do not guarantee a catch.', 'Projectile deaths are explicitly separated from ordinary body deaths. Credit events and actual transitions are separate; cannon events without projectileId mean spent ammunition.', 'Weapon-owner matchup width is its current body size; it does not imply weapon damage scales with owner mass.', 'Death causes without a matching same-tick credit remain explicitly uncredited; hitPlayer observations identify uncredited world traffic only.', 'This is accelerated simulation, not a server load/frame benchmark.'] };
    fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2));
  })().catch(error => { console.error(error); process.exitCode = 1; });
}
