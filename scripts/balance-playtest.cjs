// Seeded experiments against the compiled game; optional tuning overrides affect this process only.
// npm run build:server && node scripts/balance-playtest.cjs --section=all --seconds=600 --seeds=11,29,73 --out=report.json
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { GameState } = require('../server/dist/schema/GameState.js');
const { PlayerSchema } = require('../server/dist/schema/PlayerSchema.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { spawnWeapon } = require('../server/dist/systems/weapons.js');
const { CANNON, GEMS, PINWHEEL, SHOCKWAVE } = require('../server/dist/constants/gameConstants.js');

const options = Object.fromEntries(process.argv.slice(2).map(arg => { const at = arg.indexOf('='); return [arg.slice(2, at), arg.slice(at + 1)]; }));
const seconds = Number(options.seconds || 600), seeds = (options.seeds || '11,29,73').split(',').map(Number);
assert(Number.isInteger(seconds) && seconds > 0 && seconds <= 3600, 'seconds must be 1–3600');
assert(seeds.length > 0 && seeds.length <= 6 && seeds.every(Number.isInteger), 'provide 1–6 integer seeds');
const section = options.section || 'all'; assert(['all', 'controls', 'arena'].includes(section));
const scenarios = (options.scenarios || 'human-newborn,human-giant,bot-giant').split(',');
assert(scenarios.every(s => ['human-newborn', 'human-giant', 'bot-giant'].includes(s)));
const stopWidthShare = Number(options['stop-width-share'] || Infinity);
assert(stopWidthShare > 0 && !Number.isNaN(stopWidthShare));
const DT = 1 / 30, START = 1000000;
if (options['growth-scale']) { const scale = Number(options['growth-scale']); assert(Number.isFinite(scale) && scale > 0); GEMS.GROWTH_SCALE = scale; }
if (options['decay-rate']) { const rate = Number(options['decay-rate']); assert(Number.isFinite(rate) && rate >= 0 && rate <= .02); GEMS.DECAY_RATE = rate; }
function seeded(seed, run) {
  const random = Math.random, dateNow = Date.now; let clock = START, state = seed >>> 0;
  Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  Date.now = () => clock;
  try { return run(time => { clock = START + time; return clock; }); }
  finally { Math.random = random; Date.now = dateNow; }
}
function empty() {
  const s = new GameState(0); s.botFill = 0; s.surgesOn = false; s.setTurbines('off'); s.weaponsOn = false;
  s.update(0, START); return s;
}
function add(s, id, gems, cx, cy) {
  const p = s.addPlayer(id, id, START); p.setGems(gems, s.worldWidth, s.worldHeight);
  p.placeAt(cx - p.width / 2, cy - p.height / 2); p.spawnProtected = false; return p;
}

function decayControls() {
  const rows = [];
  for (const bot of [false, true]) for (const initial of [1000, 1500, 5000]) {
    const p = new PlayerSchema('decay', 0); p.isBot = bot; p.setGems(initial, 4200, 4200);
    const samples = { '0': initial }; let firstBelow75Percent = null;
    for (let tick = 1; tick <= 7200 * 30; tick++) {
      p.decay(DT, 4200, 4200);
      if (firstBelow75Percent === null && p.gems < initial * .75) firstBelow75Percent = Math.round(tick / 30);
      if ([60, 300, 900, 1800, 3600, 7200].includes(tick / 30)) samples[String(tick / 30)] = p.gems;
    }
    assert(p.gems >= GEMS.DECAY_START && p.gems <= initial);
    rows.push({ rules: bot ? 'bot' : 'human', initial, upkeepGemsPerMinuteAtStart: (initial - GEMS.DECAY_START) * GEMS.DECAY_RATE * 60, firstBelow75Percent, samples });
  }
  return rows;
}

function weaponExposure(kind, initial, location, response, recoverSpills, contestSpills = false) {
  return seeded(11, setClock => {
    const s = empty(); s.weaponsOn = true;
    const owner = add(s, 'builder', contestSpills ? 24 : 0, 500, 500);
    const wx = location === 'wall' ? 3800 : 2100, wy = 2100;
    spawnWeapon(s, wx, wy, kind); const w = s.pinwheel;
    w.owner = owner.sessionId; w.phase = 'charging'; w.at = (kind === 'pulsar' ? SHOCKWAVE.CHARGE_MS : PINWHEEL.CHARGE_MS);
    const p = add(s, 'target', initial, wx + 180, wy);
    if (location === 'wall') p.placeAt(s.worldWidth - p.width - 2, wy - p.height / 2);
    let firstHit = null, hits = 0, grossDamage = 0, death = false, minimum = initial;
    s.onEvent = (type, data) => {
      if (type === 'credit' && data.targetId === p.sessionId && data.how === kind) {
        hits++; grossDamage += data.gems; if (firstHit === null) firstHit = s.time; death ||= Boolean(data.out);
      }
    };
    for (let tick = 1; tick <= 12 * 30; tick++) {
      const time = tick * 1000 / 30, now = setClock(time);
      const dx = p.x + p.width / 2 - wx, dy = p.y + p.height / 2 - wy, distance = Math.hypot(dx, dy) || 1;
      if (response === 'warning-escape' || (firstHit !== null && time >= firstHit + 300 && response === 'radial-escape')) p.steer(dx / distance, dy / distance);
      else if (firstHit !== null && time >= firstHit + 300 && response === 'sideways-escape') p.steer(-dy / distance, dx / distance);
      else p.steer(0, 0);
      if (contestSpills) {
        const tx = p.x + p.width / 2, ty = p.y + p.height / 2;
        if (tick === 1) owner.placeAt(tx - p.width / 2 - owner.width - 25, ty - owner.height / 2);
        const ox = owner.x + owner.width / 2, oy = owner.y + owner.height / 2, gap = Math.hypot(tx - ox, ty - oy);
        owner.steer(gap > p.width / 2 + owner.width / 2 + 15 ? 1 : 0, 0);
        if (!owner.inhaling) owner.startInhale(now);
        owner.aimAt(tx - ox, ty - oy);
      }
      if (!recoverSpills) { s.gems.clear(); s.fieldGems = 0; }
      s.update(DT, now); minimum = Math.min(minimum, p.gems);
      if (death) break;
    }
    return { kind, initial, location, response, recoverSpills, contestSpills, hits, grossDamage, minimum, final: p.gems, builderFinal: owner.gems, out: death, firstHitMs: firstHit };
  });
}

function arena(seed, scenario) {
  return seeded(seed, setClock => {
    const s = new GameState(); s.update(0, START);
    const probe = s.addPlayer('probe', 'Playtest probe', START);
    const initial = scenario === 'human-newborn' ? 0 : 1000;
    probe.setGems(initial, s.worldWidth, s.worldHeight); probe.spawnProtected = false;
    probe.placeAt(2100 - probe.width / 2, 2100 - probe.height / 2);
    probe.isBot = scenario === 'bot-giant';
    // The probe uses the existing fallible AI, with either human or bot mass/decay rules.
    // Register only after population fill; no joins/disconnects occur during an experiment.
    s.brains.set(probe.sessionId, new BotBrain());
    assert.equal(s.players.size, 20);
    const deaths = {}, damage = {}, last = new Map(), milestones = {}, activeSeconds = {}, deployments = {}, samples = [];
    const lives = [], living = new Map(), deathsByWidth = { below150: 0, from150To500: 0, atLeast500: 0 };
    let previousWeaponPhase = '';
    const leaders = []; let currentLeader = '', tenure = 0, maxTenure = 0, decay = 0, giantSeconds = 0, mostGiants = 0;
    let captures = 0, launches = 0, probeLeaderSeconds = 0, above750 = 0, max = initial, firstBelow750 = null;
    const originalDecay = probe.decay;
    probe.decay = function(...args) { const before = this.gems; originalDecay.apply(this, args); decay += before - this.gems; };
    s.onEvent = (type, data) => {
      if (type !== 'credit') return;
      const cause = data.how === 'cannon' ? (data.projectileId ? 'missile-target' : 'spent-missile') : data.how;
      if (data.out) deaths[cause] = (deaths[cause] || 0) + 1;
      if (data.targetId === probe.sessionId && data.gems && data.how !== 'stole') damage[cause] = (damage[cause] || 0) + data.gems;
    };
    let probeDeaths = 0, allDeaths = 0, elapsedSeconds = 0, maxWidth = probe.width;
    for (let tick = 1; tick <= seconds * 30; tick++) {
      s.update(DT, setClock(tick * 1000 / 30));
      s.players.forEach((p, id) => {
        const was = last.get(id) || { state: 'alive', captured: false, flying: false };
        let life = living.get(id);
        if (!life || (was.state === 'dead' && p.state === 'alive')) {
          life = { id, at: s.time, first100Seconds: null, first500WidthSeconds: null, maxWidth: 0, secondsAt500Width: 0, current500Streak: 0, longest500Streak: 0 };
          living.set(id, life);
        }
        if (p.state === 'alive') {
          life.maxWidth = Math.max(life.maxWidth, p.width);
          if (p.gems >= 100 && life.first100Seconds === null) life.first100Seconds = Math.round((s.time - life.at) / 1000);
          if (p.width >= 500) {
            if (life.first500WidthSeconds === null) life.first500WidthSeconds = Math.round((s.time - life.at) / 1000);
            life.secondsAt500Width += DT; life.current500Streak += DT; life.longest500Streak = Math.max(life.longest500Streak, life.current500Streak);
          } else life.current500Streak = 0;
        }
        if (p.state === 'dead' && was.state === 'alive') {
          allDeaths++; if (id === probe.sessionId) probeDeaths++;
          deathsByWidth[was.width >= 500 ? 'atLeast500' : was.width >= 150 ? 'from150To500' : 'below150']++;
          lives.push({ ...life, seconds: Math.round((s.time - life.at) / 1000), endedByKnockout: true });
        }
        if (p.capturedBy && !was.captured) captures++;
        if (p.flying && !was.flying) launches++;
        last.set(id, { state: p.state, captured: Boolean(p.capturedBy), flying: p.flying, width: p.width });
      });
      max = Math.max(max, probe.gems);
      elapsedSeconds = tick / 30; maxWidth = Math.max(maxWidth, probe.width);
      for (const threshold of [25, 100, 300, 500, 1000]) if (probe.gems >= threshold && milestones[threshold] === undefined) milestones[threshold] = Math.round(s.time / 1000);
      if (probe.gems >= 750) above750 += DT;
      else if (initial === 1000 && firstBelow750 === null) firstBelow750 = Math.round(s.time / 1000);
      const leader = s.leader();
      if (leader?.sessionId === probe.sessionId) probeLeaderSeconds += DT;
      const leaderId = leader && leader.gems >= 100 ? leader.sessionId : '';
      if (leaderId !== currentLeader) { if (currentLeader) leaders.push({ id: currentLeader, seconds: Math.round(tenure) }); currentLeader = leaderId; tenure = 0; }
      if (currentLeader) { tenure += DT; maxTenure = Math.max(maxTenure, tenure); }
      const giants = [...s.players.values()].filter(p => p.state === 'alive' && p.width >= 500).length;
      giantSeconds += giants * DT; mostGiants = Math.max(mostGiants, giants);
      if (s.pinwheel.phase === 'active') {
        activeSeconds[s.pinwheel.kind] = (activeSeconds[s.pinwheel.kind] || 0) + DT;
        if (previousWeaponPhase !== 'active') deployments[s.pinwheel.kind] = (deployments[s.pinwheel.kind] || 0) + 1;
      }
      previousWeaponPhase = s.pinwheel.phase;
      if (tick % 1800 === 0) samples.push({ seconds: tick / 30, probe: probe.gems, leader: leader?.gems ?? 0, deaths: allDeaths, giantsAt500Width: giants, fieldCrystals: s.fieldGems, population: [...s.players.values()].map(p => ({ gems: p.gems, width: p.width, state: p.state })) });
      if (probe.width >= s.worldWidth * stopWidthShare) break;
    }
    if (currentLeader) leaders.push({ id: currentLeader, seconds: Math.round(tenure) });
    for (const [id, life] of living) if (s.players.get(id)?.state === 'alive') lives.push({ ...life, seconds: Math.round((s.time - life.at) / 1000), endedByKnockout: false });
    assert.equal(s.players.size, 20); assert(Number.isFinite(probe.gems) && probe.gems >= 0);
    return { seed, scenario, seconds: elapsedSeconds, requestedSeconds: seconds, initial, probe: { final: probe.gems, max, maxWidth, deaths: probeDeaths, decayGems: decay, stolen: probe.stolenTotal, robbed: probe.robbedTotal, incomingCreditedDamage: damage, firstBelow750, secondsAbove750: Math.round(above750), leaderSeconds: Math.round(probeLeaderSeconds), milestones }, arena: { actualDeaths: allDeaths, deathsByPreKnockoutWidth: deathsByWidth, creditedKnockouts: deaths, captures, launches, meanGiantsAt500Width: Number((giantSeconds / elapsedSeconds).toFixed(2)), mostGiantsAt500Width: mostGiants, finalGiantsAt500Width: [...s.players.values()].filter(p => p.state === 'alive' && p.width >= 500).length, finalPopulation: [...s.players.values()].map(p => ({ gems: p.gems, width: p.width })), leaderChangesAt100PlusGems: Math.max(0, leaders.length - 1), longestLeaderTenureAt100PlusGems: Math.round(maxTenure), biggestFinalPlayer: Math.max(...[...s.players.values()].map(p => p.gems)), weaponPhase: s.pinwheel.phase, deployments, weaponActiveSeconds: Object.fromEntries(Object.entries(activeSeconds).map(([kind, time]) => [kind, Math.round(time)])) }, lives: lives.map(life => ({ ...life, current500Streak: Math.round(life.current500Streak), secondsAt500Width: Math.round(life.secondsAt500Width), longest500Streak: Math.round(life.longest500Streak) })), samples };
  });
}

const report = { generatedAt: new Date().toISOString(), mechanics: options.label || 'working tree', methodology: { tickHz: 30, seededRandomAndClock: true, arenaSecondsPerRun: seconds, stopAtWidthShare: Number.isFinite(stopWidthShare) ? stopWidthShare : null, initialFieldCrystals: GEMS.FIELD_COUNT, fieldReplenishPerSecond: GEMS.FIELD_REPLENISH_PER_S, growthMassPerGem: GEMS.GROWTH_MASS_PER_GEM, missileBaseGems: CANNON.IMPACT_BASE_GEMS, ownerPickupDelayMs: GEMS.OWNER_PICKUP_DELAY_MS, missileOwnerPickupDelayMs: GEMS.MISSILE_OWNER_PICKUP_DELAY_MS, growthScale: GEMS.GROWTH_SCALE, growthExponent: GEMS.GROWTH_EXPONENT, decayStart: GEMS.DECAY_START, decayRate: GEMS.DECAY_RATE, seeds, scenarios, probeController: 'existing fallible BotBrain; roles retain their current shared gameplay rules; no human skill or subjective fun is inferred', weaponsInArena: 'ordinary recipe spawns, pickup and placement by the current AI; activation is counted', decay: 'actual PlayerSchema.decay, no combat or collecting', weaponExposure: 'actual full world update; idle/radial/sideways/warning escape, open arena/wall, with/without spilled gem recovery; contested cases add an unopposed builder following/inhaling', creditedKnockouts: 'missile-target versus spent-missile distinguished; state-transition death count is separate; missing milestones mean not reached' } };
if (section !== 'arena') {
  report.decay = decayControls(); report.weaponExposure = [];
  for (const gems of [12, 100, 1000, 5000]) for (const location of ['open', 'wall']) for (const response of ['idle', 'radial-escape', 'sideways-escape', 'warning-escape']) {
    report.weaponExposure.push(weaponExposure('pulsar', gems, location, response, true));
  }
  for (const kind of ['pulsar', 'pinwheel']) for (const gems of [100, 1000, 5000]) {
    report.weaponExposure.push(weaponExposure(kind, gems, 'open', 'idle', false));
    report.weaponExposure.push(weaponExposure(kind, gems, 'wall', 'idle', false));
  }
  for (const location of ['open', 'wall']) for (const response of ['idle', 'sideways-escape']) {
    report.weaponExposure.push(weaponExposure('pulsar', 1000, location, response, true, true));
  }
}
if (section !== 'controls') {
  report.arena = [];
  for (const scenario of scenarios) for (const seed of seeds) {
    const result = arena(seed, scenario); report.arena.push(result); console.log(JSON.stringify(result));
  }
}
if (options.out) fs.writeFileSync(path.resolve(options.out), JSON.stringify(report, null, 2));
else console.log(JSON.stringify(report, null, 2));
