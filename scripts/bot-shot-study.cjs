/* Local, seeded cannon accuracy study. Build the server first; never alters tuning. */
const fs = require('node:fs');
const crypto = require('node:crypto');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { botShotView, botShotVisible } = require('../server/dist/game/botAim.js');
const { updateInhales } = require('../server/dist/systems/inhale.js');

const NOW = 100000, dt = 1 / 30, repeats = Number(process.env.BOT_SHOT_REPEATS || 100);
function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6d2b79f5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function trial(shooterGems, targetGems, gap, motion, seed) {
  const previousRandom = Math.random;
  Math.random = rng(seed);
  try {
    const s = new GameState(0);
    s.botFill = s.fieldGemTarget = 0;
    s.weaponsOn = s.surgesOn = s.trafficOn = s.trafficHits = s.shiftsOn = s.jackpotOn = false;
    s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear(); s.gems.clear();
    const bot = s.addPlayer('bot', 'Shooter', NOW), ammo = s.addPlayer('ammo', 'Ammo', NOW), target = s.addPlayer('target', 'Target', NOW);
    bot.resetGems(shooterGems, 4200, 4200); ammo.resetGems(32, 4200, 4200); target.resetGems(targetGems, 4200, 4200);
    bot.placeAt(1400 - bot.width / 2, 2100 - bot.height / 2); bot.facing = 0;
    ammo.placeAt(bot.x + bot.width, bot.y + (bot.height - ammo.height) / 2);
    target.placeAt(1400 + (bot.width + target.width) / 2 + gap - target.width / 2, 2100 - target.height / 2);
    for (const p of [bot, ammo, target]) p.dropProtection();
    bot.startInhale(NOW); updateInhales(s, NOW, dt);
    if (ammo.capturedBy !== bot.sessionId) throw Error('Study failed to capture real ammunition');
    const widths = { shooterWidth: bot.width, targetWidth: target.width, bulletWidth: ammo.width };
    bot.facing = Math.random() * Math.PI * 2 - Math.PI;
    bot.isBot = true; s.brains.set(bot.sessionId, new BotBrain());
    let launch = null, hit = false, impact = null, timeout = false;
    s.onEvent = (type, data) => {
      if (type === 'launch' && data.byId === bot.sessionId) {
        const dx = target.x + target.width / 2 - bot.x - bot.width / 2;
        const dy = target.y + target.height / 2 - bot.y - bot.height / 2;
        const aimErrorDeg = Math.abs(Math.atan2(Math.sin(bot.facing - Math.atan2(dy, dx)), Math.cos(bot.facing - Math.atan2(dy, dx)))) * 180 / Math.PI;
        launch = { at: s.time, distance: Math.hypot(dx, dy), aimErrorDeg,
          visible: botShotVisible(botShotView(s, bot), target.x + target.width / 2, target.y + target.height / 2, target.width / 2) };
      }
      if (type === 'impact' && data.targetId === target.sessionId) { hit = true; impact = { out: data.out, gems: data.gems }; }
    };
    for (let tick = 1; tick <= 240; tick++) {
      const time = tick * 1000 / 30;
      target.steer(0, motion === 'still' ? 0 : motion === 'across' ? 1 : Math.floor(time / 650) % 2 ? -1 : 1);
      s.blackHoles.clear(); s.update(dt, NOW + time);
      if (hit || launch && (!ammo.flying || ammo.flightHit) || !launch && !ammo.capturedBy) break;
      if (tick === 240) timeout = true;
    }
    return { ...widths, gap, motion, seed, fired: !!launch, hit, launch, impact, timeout };
  } finally { Math.random = previousRandom; }
}
const rows = [], summary = [];
for (const shooter of [100, 1000]) for (const target of [0, 100, 1000]) for (const gap of [100, 300, 600]) for (const motion of ['still', 'across', 'zigzag']) {
  const cohort = [];
  for (let seed = 1; seed <= repeats; seed++) cohort.push(trial(shooter, target, gap, motion, seed));
  rows.push(...cohort);
  const fired = cohort.filter(r => r.fired), hits = fired.filter(r => r.hit).length;
  const entry = { shooterWidth: cohort[0].shooterWidth, targetWidth: cohort[0].targetWidth, gap, motion,
    attempts: repeats, fired: fired.length, hits, misses: fired.length - hits, didNotFire: repeats - fired.length,
    missPercentOfFired: fired.length ? Math.round(1000 * (fired.length - hits) / fired.length) / 10 : null };
  summary.push(entry);
  process.stdout.write(JSON.stringify(entry) + '\n');
}
const hash = path => crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const report = { date: '2026-11-25', localOnly: true, repeats, attempts: rows.length,
  invalidLaunches: rows.filter(r => r.fired && !r.launch.visible).length,
  method: 'Seeded isolated 30Hz encounters with actual capture, full bot decisions, normal body turning, fire, movement, flight and swept impact. Standard 60-unit bullets; two shooter widths, three target widths, three initial body-edge gaps, still/sideways/650ms reversing movement, random starting facing. No cover, other targets, weapons, traffic, windup, tuning changes or physical-device latency. No-fire attempts are separate from misses. This deliberately balanced sample is not the live-match miss probability or a human-fun measure.',
  sourceSha256: Object.fromEntries(['server/game/botAim.ts','server/game/bots.ts','server/systems/bots.ts','server/constants/gameConstants.ts','scripts/bot-shot-study.cjs'].map(p => [p, hash(p)])),
  summary, rows };
fs.writeFileSync('docs/playtests/bot-shot-accuracy-2026-11-25.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ attempts: rows.length, invalidLaunches: report.invalidLaunches }));
