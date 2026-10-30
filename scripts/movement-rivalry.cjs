// Seeded population observations using compiled, unchanged gameplay rules.
// After building: node scripts/movement-rivalry.cjs 11 600 mature size-speed-after
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { initializeWeaponSets } = require('../server/dist/systems/weapons.js');
const { ARENA_RULES, FACING, INHALE, CANNON } = require('../server/dist/constants/gameConstants.js');
const { moveSpeed } = require('../server/dist/game/movement.js');
const seed = Number(process.argv[2] || 11);
const seconds = Number(process.argv[3] || 600);
const scenario = process.argv[4] || 'mature';
const label = process.argv[5] || 'size-speed';
const peerShare = Number(process.argv[6]?.replace(/^--peer-share=/, '') || 0);
const loadMs = Number(process.argv[7]?.replace(/^--load-ms=/, '') || 0);
assert(Number.isInteger(seed) && Number.isInteger(seconds) && seconds > 0 && seconds <= 3600);
assert(['mature', 'fresh'].includes(scenario));
assert(/^[a-zA-Z0-9_-]+$/.test(label));
assert([0, .33].includes(peerShare));
assert(Number.isInteger(loadMs) && loadMs >= 0 && loadMs <= 2000);
CANNON.PEER_HIT_SHARE = peerShare;
CANNON.CAPTURE_FIRE_DELAY_MS = loadMs;
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
let rng = seed >>> 0, clock = 1000000000;
Math.random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
Date.now = () => clock;
const s = new GameState(); s.botFill = 0; initializeWeaponSets(s);
const stocks = [4398, 4028, 2826, 2000, 1500, 1200, 900, 700, 500, 400, 300, 200, 150, 100, 80, 60, 40, 25, 12, 5];
for (let i = 0; i < 20; i++) s.addPlayer('bot' + i, 'Bot ' + i, clock);
for (let i = 0; i < 20; i++) {
  const p = s.players.get('bot' + i); p.isBot = true;
  p.setGems(scenario === 'mature' ? stocks[i] : 0, s.worldWidth, s.worldHeight);
  p.placeAt(420 + (i % 5) * 820 - p.width / 2, 500 + Math.floor(i / 5) * 1000 - p.height / 2);
  p.dropProtection(); s.brains.set(p.sessionId, new BotBrain());
}
const rows = new Map([...s.players].map(([id, p]) => [id, { id, startGems: p.gems, startWidth: p.width, minGems: p.gems, maxGems: p.gems, maxWidth: p.width, knockouts: 0, leaderSeconds: 0, missileHits: 0, missileDamage: 0, shotsAtLeader: 0, hitsOnLeader: 0, theftEvents: 0, theftGems: 0 }]));
const counts = { captures: 0, launches: 0, impacts: 0, leaderImpacts: 0, runnerHitsLeader: 0, leaderKnockouts: 0, knockouts: 0, knockoutsAt500Width: 0, leaderShots: 0 };
const ranked = () => [...s.players.values()].filter(p => p.state === 'alive' && !p.capturedBy).sort((a, b) => b.gems - a.gems);
counts.bodyKnockouts=0;counts.flightKnockouts=0;
const launchedThisTick=new Set();
let ranking = ranked(), leaderId = ranking[0]?.sessionId, previousLeader = leaderId, leaderChanges = 0;
const prev = new Map([...s.players].map(([id, p]) => [id, { state: p.state, width: p.width, flying:p.flying }]));
const impacts = [], shots = [];
s.onEvent = (type, d) => {
  if (type === 'capture') counts.captures++;
  if (type === 'launch') {
    launchedThisTick.add(d.id);
    counts.launches++;
    const targetId = s.brains.get(d.byId)?.cannonAim.targetId;
    if (targetId === leaderId) { counts.leaderShots++; rows.get(d.byId).shotsAtLeader++; }
    if (shots.length < 80) shots.push({ second: Math.round(s.time / 1000), byId: d.byId, targetId, leaderId });
  }
  if (type === 'impact' && d.kind === 'cannon') {
    counts.impacts++; const row = rows.get(d.targetId);
    if (row) { row.missileHits++; row.missileDamage += d.gems; }
    if (d.targetId === leaderId) { counts.leaderImpacts++; if (d.byId === ranking[1]?.sessionId) counts.runnerHitsLeader++; if (rows.has(d.byId)) rows.get(d.byId).hitsOnLeader++; }
    if (impacts.length < 80) impacts.push({ second: Math.round(s.time / 1000), byId: d.byId, targetId: d.targetId, targetWidth: d.size, damage: d.gems, out: d.out, leader: d.targetId === leaderId });
  }
  if (type === 'credit' && d.how === 'stole' && rows.has(d.targetId)) { const row = rows.get(d.targetId); row.theftEvents++; row.theftGems += d.gems || 0; }
};
const samples = [];
for (let tick = 1; tick <= seconds * 30; tick++) {
  clock = 1000000000 + tick * 1000 / 30;
  ranking = ranked(); leaderId = ranking[0]?.sessionId;
  launchedThisTick.clear();
  s.update(1 / 30, clock);
  for (const [id, p] of s.players) {
    const row = rows.get(id), old = prev.get(id);
    if (!row) throw Error('Unexpected population change');
    row.minGems = Math.min(row.minGems, p.gems); row.maxGems = Math.max(row.maxGems, p.gems); row.maxWidth = Math.max(row.maxWidth, p.width);
    if (id === leaderId) row.leaderSeconds += 1 / 30;
    if (old.state === 'alive' && p.state === 'dead') {
      row.knockouts++; counts.knockouts++;
      if(old.flying||launchedThisTick.has(id))counts.flightKnockouts++;
      else counts.bodyKnockouts++;
      if (old.width >= 500) counts.knockoutsAt500Width++;
      if (id === leaderId) counts.leaderKnockouts++;
    }
    prev.set(id, { state: p.state, width: p.width, flying:p.flying });
  }
  const nextLeader = ranked()[0]?.sessionId;
  if (nextLeader && nextLeader !== previousLeader) { leaderChanges++; previousLeader = nextLeader; }
  if (tick % 1800 === 0) samples.push({ seconds: tick / 30, topThree: ranked().slice(0, 3).map(p => ({ id: p.sessionId, gems: p.gems, width: p.width })), knockouts: counts.knockouts });
}
const report = { revision, movement: { exponent: ARENA_RULES.SPEED_FALLOFF, floor: ARENA_RULES.MIN_SPEED ?? null, speeds: [20, 100, 200, 400, 600, 900, 1200].map(width => ({ width, speed: moveSpeed(width) })) }, rotation: { rate: FACING.TURN_RATE, falloff: FACING.TURN_FALLOFF, accelerationFalloff: FACING.ACCEL_FALLOFF, inhaleMultiplier: FACING.INHALE_TURN }, bodyPull: { peer: INHALE.PEER_BODY_PULL ?? 1, fullRatio: INHALE.BODY_PULL_FULL_RATIO ?? null }, seed, seconds, scenario, counts, leaderChanges, rows: [...rows.values()].map(row => ({ ...row, leaderSeconds: Math.round(row.leaderSeconds), endGems: s.players.get(row.id).gems, endWidth: s.players.get(row.id).width })), samples, shots, impacts };
fs.mkdirSync(path.join('reports', 'movement'), { recursive: true });
report.damage={peerHitShare:peerShare, formula:peerShare?'round(targetGems * min(.85, peerHitShare * (shooterLaunchWidth / targetWidth)^2))':'unchanged mass/speed damage'};
report.captureFireDelayMs=loadMs;
fs.writeFileSync(path.join('reports', 'movement', `${label}-${scenario}-${seed}.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ seed, scenario, seconds, counts, leaderChanges, originalTopThree: report.rows.slice(0, 3), finalTopThree: samples.at(-1)?.topThree }, null, 2));
