// Build first. All comparisons run in this process, with restored constants.
const fs = require('node:fs');
const { GameState } = require('../server/dist/schema/GameState.js');
const { EXHALE } = require('../server/dist/constants/gameConstants.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { exhale } = require('../server/dist/systems/inhale.js');
const original = { ...EXHALE }, NOW = 100000, dt = 1 / 60;
const profiles = [
  { name: 'released', scale: 1, cap: 560, drag: 12 },
  { name: 'conservative', scale: 3, cap: 280, drag: 7 },
  { name: 'stronger comparison', scale: 4, cap: 320, drag: 6 },
];
function stock(width) {
  let lo = 0, hi = 10000000;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width) lo = mid + 1; else hi = mid; }
  return lo;
}
const rows = [];
try {
  for (const profile of profiles) {
    Object.assign(EXHALE, { REAR_IMPULSE_SCALE: profile.scale, REAR_SPEED_CAP: profile.cap, REAR_DRAG: profile.drag });
    for (const width of [60, 150, 300]) for (const ratio of [1.35, 1.75, 2.5]) for (const gap of [20, 80, 180, 360])
      for (const attackers of [1, 2]) for (const repeat of [false, true]) {
        const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
        s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear();
        const runner = s.addPlayer('runner', 'Runner', NOW); runner.setGems(stock(width), 4200, 4200);
        runner.placeAt(2100 - runner.width / 2, 2100 - runner.width / 2); runner.dropProtection(); runner.facing = 0;
        const hunters = Array.from({ length: attackers }, (_, i) => {
          const h = s.addPlayer(`hunter${i}`, 'Hunter', NOW); h.setGems(stock(width * ratio), 4200, 4200);
          const angle = attackers === 1 ? 0 : (i === 0 ? -.8 : .8), d = (runner.width + h.width) / 2 + gap;
          h.placeAt(2100 - Math.cos(angle) * d - h.width / 2, 2100 - Math.sin(angle) * d - h.width / 2);
          h.facing = angle;
          h.dropProtection(); return h;
        });
        let capturedAt = null, casts = 0, hits = 0, peakSpeed = 0;
        s.onEvent = type => { if (type === 'exhale') casts++; if (type === 'gustHit') hits++; };
        runner.steer(1, 0);
        for (let tick = 0; tick <= 360; tick++) {
          const now = NOW + tick * dt * 1000;
          if (tick % 15 === 0) for (const h of hunters) {
            const dx = runner.x + runner.width / 2 - h.x - h.width / 2;
            const dy = runner.y + runner.height / 2 - h.y - h.height / 2, d = Math.hypot(dx, dy) || 1;
            h.steer(dx / d, dy / d); if (!h.inhaling) h.startInhale(now); h.aimAt(dx, dy);
          }
          if (tick === 0 || repeat && now >= runner.exhaleReadyAt) exhale(s, runner, now);
          if (tick > 0) s.update(dt, now);
          peakSpeed = Math.max(peakSpeed, ...hunters.map(h => Math.hypot(h.gustVx, h.gustVy)));
          if (runner.capturedBy || runner.state !== 'alive') { capturedAt = tick * dt; break; }
        }
        rows.push({ profile: profile.name, width, ratio, gap, attackers, repeat, capturedAt, casts, hits, peakSpeed,
          finalX: runner.x, finalBreath: runner.stamina });
      }
  }
} finally { Object.assign(EXHALE, original); }
const summary = profiles.map(profile => {
  const group = rows.filter(r => r.profile === profile.name);
  return { profile: profile.name, cases: group.length, captures: group.filter(r => r.capturedAt !== null).length,
    byAttackers: [1, 2].map(n => ({ attackers: n, cases: group.filter(r => r.attackers === n).length,
      captures: group.filter(r => r.attackers === n && r.capturedAt !== null).length })),
    byUse: [false, true].map(repeat => ({ repeat, captures: group.filter(r => r.repeat === repeat && r.capturedAt !== null).length })),
    peakSpeed: Math.max(...group.map(r => r.peakSpeed)), maxCasts: Math.max(...group.map(r => r.casts)) };
});
const report = { selectedProfile: 'conservative', method: '432 six-second synthetic retreats: 3 profiles x 3 physical widths x 3 pursuer ratios x 4 body-edge gaps x 1/2 attackers x once/repeated normal casts. Pursuers retarget through normal steering and aiming every 250ms, both roles use shared actor movement, turning, breath and suction; no weapons, ambient pickups or hazards. This is not human fun, final balance or a guarantee of escape.', profiles, summary, rows };
fs.mkdirSync('.tmp', { recursive: true }); fs.writeFileSync('.tmp/rear-gust-study.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(summary, null, 2));
