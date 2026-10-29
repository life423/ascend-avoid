// Actual server rules and fallible BotBrain decisions. Automated evidence, not human balance validation.
const fs = require('node:fs');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { viewShort } = require('../server/dist/game/camera.js');
const { lethalPlayerImpact, shooterMassContribution, impactGems } = require('../server/dist/game/cannon.js');
const { updateFlights } = require('../server/dist/systems/flights.js');
const NOW = 1e9, DT = 1 / 30;
function rng(seed) { let x = seed; return () => { x = (x * 1664525 + 1013904223) >>> 0; return x / 4294967296; }; }
function arena() { const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = s.surgesOn = false; s.setTurbines('off'); s.update(0, NOW); return s; }
const impacts = [];
for (const targetGems of [40, 100, 300, 1000]) for (const ammoGems of [4, 40, 100, 300, 1000]) for (const speed of [600, 1250, 1800]) {
  const s = arena(), owner = s.addPlayer('owner', 'Shooter', NOW), ammo = s.addPlayer('ammo', 'Ammo', NOW), target = s.addPlayer('target', 'Target', NOW);
  owner.placeAt(300, 300); ammo.setGems(ammoGems, 4200, 4200); target.setGems(targetGems, 4200, 4200);
  for (const p of [owner, ammo, target]) p.spawnProtected = false;
  const aw = ammo.width, tw = target.width, bonus = shooterMassContribution(creatureSize(4000), aw);
  ammo.placeAt(1500 - aw / 2, 1600 - aw / 2); target.placeAt(1500 + (aw + tw) / 2 + 10 - tw / 2, 1600 - tw / 2);
  ammo.launch(NOW, speed, 0, owner.sessionId, 2600, 0); ammo.shotMassBonus = bonus;
  const expectedDamage = impactGems(targetGems, speed, aw, tw, bonus);
  updateFlights(s, NOW + 100, .1);
  impacts.push({ targetGems, ammoGems, speed, expectedDamage, energyLethal: lethalPlayerImpact(speed, aw, tw, bonus), out: target.state === 'dead', earned: owner.gems, remaining: target.gems });
}
const escapes = [];
for (const gap of [20, 100, 220]) for (const direction of ['idle', 'away', 'sideways']) {
  const s = arena(), a = s.addPlayer('attacker', 'Attacker', NOW), b = s.addPlayer('victim', 'Victim', NOW);
  a.setGems(300, 4200, 4200); b.setGems(40, 4200, 4200); a.spawnProtected = b.spawnProtected = false;
  a.placeAt(1500, 1500); a.facing = 0;
  b.placeAt(a.x + a.width + gap, a.y + (a.height - b.height) / 2);
  b.injure(0); a.startInhale(NOW); b.steer(direction === 'away' ? 1 : 0, direction === 'sideways' ? 1 : 0);
  const x = b.x, y = b.y; let elapsed = 0;
  for (let i = 1; i <= 75 && b.state === 'alive'; i++) { elapsed = i * DT; s.update(DT, NOW + i * DT * 1000); }
  escapes.push({ gap, direction, out: b.state === 'dead', seconds: +elapsed.toFixed(3), travel: +Math.hypot(b.x - x, b.y - y).toFixed(1) });
}
const botRuns = [];
for (const seed of [11, 29, 73]) {
  const previous = Math.random; Math.random = rng(seed);
  try {
    const s = new GameState(0); s.update(0, NOW); const observer = s.addPlayer('observer', 'Observer', NOW); s.brains.set(observer.sessionId, new BotBrain());
    let captures = 0, launches = 0, visibleCaptures = 0, visibleLaunches = 0, holeKnockouts = 0, mouthFinishes = 0, eligibleSamples = 0;
    const last = new Map();
    const visible = (x, y) => { const short = viewShort(observer.width); return Math.abs(x - observer.x - observer.width / 2) <= short * 1.6 / 2 && Math.abs(y - observer.y - observer.height / 2) <= short / 2; };
    s.onEvent = (type, data) => {
      if (type === 'launch' && s.players.get(data.byId)?.isBot) { launches++; if (visible(data.x, data.y)) visibleLaunches++; }
      if (type === 'credit' && data.how === 'blackhole') holeKnockouts++;
      if (type === 'credit' && data.how === 'mouth') mouthFinishes++;
    };
    for (let i = 1; i <= 180 * 30; i++) {
      s.update(DT, NOW + i * DT * 1000);
      for (const p of s.players.values()) {
        if (p.capturedBy && !last.get(p.sessionId) && s.players.get(p.capturedBy)?.isBot) { captures++; if (visible(p.x + p.width / 2, p.y + p.height / 2)) visibleCaptures++; }
        last.set(p.sessionId, p.capturedBy);
        if (i % 30 === 0 && p.isBot && p.state === 'alive' && !p.capturedBy && !p.flying && !p.breathingBlocked) {
          for (const prey of s.players.values()) if (prey !== p && prey.state === 'alive' && !prey.spawnProtected && !prey.capturedBy && !prey.flying && prey.width * 1.3 <= p.width && Math.hypot(prey.x - p.x, prey.y - p.y) < 80 + p.width * 2) eligibleSamples++;
        }
      }
    }
    botRuns.push({ seed, seconds: 180, captures, launches, visibleCaptures, visibleLaunches, holeKnockouts, mouthFinishes, eligiblePairSeconds: eligibleSamples });
  } finally { Math.random = previous; }
}
const report = { methodology: 'Actual 30Hz server; deterministic seeds for bots; controlled impacts and 2.5s movement trials. Visibility uses an approximate 1.6-aspect observer viewport, not rendered human observation. No human feel/performance claim.', impacts, escapes, botRuns };
const out = process.argv.find(a => a.startsWith('--out='))?.slice(6);
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ escapes, botRuns, lethalCases: impacts.filter(p => p.out).length, totalImpactCases: impacts.length }, null, 2));
