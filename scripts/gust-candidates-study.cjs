// Offline diagnostic only: npm run build, then node scripts/gust-candidates-study.cjs.
// No running server or production configuration is changed. Results are provisional.
const fs = require('node:fs');
const { GameState } = require('../server/dist/schema/GameState.js');
const { EXHALE } = require('../server/dist/constants/gameConstants.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { exhale, stealWeight } = require('../server/dist/systems/inhale.js');

const NOW = 100000, dt = 1 / 60;
const original = { ...EXHALE };
const variants = [
  { name: 'no gust', cast: false, speed: 560, budget: 420, drag: 12 },
  { name: 'released gust', cast: true, speed: 560, budget: 420, drag: 12 },
  { name: 'moderate candidate', cast: true, speed: 1000, budget: 560, drag: 9 },
  { name: 'stronger candidate', cast: true, speed: 1200, budget: 700, drag: 8 },
  { name: 'gust-only spacing trial', cast: true, speed: 560, budget: 420, drag: 12, rearScale: 4, rearCap: 320, rearDrag: 6 },
];
function gemsForWidth(width) {
  let lo = 0, hi = 10000000;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (creatureSize(mid) < width) lo = mid; else hi = mid;
  }
  return Math.round(hi);
}
const rows = [];
try {
  for (const v of variants) {
    Object.assign(EXHALE, { IMPULSE_RELATIVE_SPEED: v.speed, IMPULSE_RECOIL_CAP: v.budget, DRAG: v.drag,
      REAR_IMPULSE_SCALE: v.rearScale ?? 1, REAR_SPEED_CAP: v.rearCap ?? 560, REAR_DRAG: v.rearDrag ?? v.drag });
    for (const width of [60, 150, 300]) for (const ratio of [1.35, 1.75, 2.5]) for (const gap of [80, 180, 360]) {
      const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
      s.weaponsOn = s.surgesOn = s.trafficHits = false; s.setTurbines('off');
      s.update(0, NOW); s.blackHoles.clear();
      const runner = s.addPlayer('runner', 'Runner', NOW), hunter = s.addPlayer('hunter', 'Hunter', NOW);
      runner.setGems(gemsForWidth(width), 4200, 4200); hunter.setGems(gemsForWidth(width * ratio), 4200, 4200);
      runner.dropProtection(); hunter.dropProtection();
      hunter.placeAt(1800 - hunter.width / 2, 2100 - hunter.width / 2);
      runner.placeAt(1800 + (runner.width + hunter.width) / 2 + gap - runner.width / 2, 2100 - runner.width / 2);
      runner.facing = hunter.facing = 0; runner.steer(1, 0); hunter.steer(1, 0); hunter.startInhale(NOW);
      let gustHits = 0, capturedAt = null, peakPush = 0, gapAt800 = null;
      s.onEvent = (type, data) => {
        if (type !== 'gustHit') return;
        gustHits++;
      };
      if (v.cast) exhale(s, runner, NOW);
      for (let tick = 1; tick <= 180; tick++) {
        const elapsed = tick * dt, now = NOW + elapsed * 1000;
        if (tick % 15 === 0 && !hunter.inhaling) hunter.startInhale(now);
        s.update(dt, now);
        peakPush = Math.max(peakPush, Math.abs(hunter.puffVx + hunter.gustVx));
        if (runner.capturedBy || runner.state !== 'alive') { capturedAt = elapsed; break; }
        if (tick === 48) gapAt800 = runner.x - hunter.x - hunter.width;
      }
      rows.push({ variant: v.name, width, ratio, initialGap: gap, capturedAt, gustHits,
        peakPush, gapAt800, stillInPull: capturedAt === null && stealWeight(s, hunter, runner) > 0 });
    }
  }
} finally { Object.assign(EXHALE, original); }
const summary = variants.map(v => {
  const group = rows.filter(r => r.variant === v.name), valid = group.filter(r => r.gustHits > 0);
  return { variant: v.name, cases: group.length, captures: group.filter(r => r.capturedAt !== null).length,
    gustConnected: valid.length, stillInPullAt3s: group.filter(r => r.stillInPull).length };
});
fs.mkdirSync('.tmp', { recursive: true });
fs.writeFileSync('.tmp/gust-candidates-study.json', JSON.stringify({ limits: 'Synthetic straight-line healthy retreat, 3 seconds, 250ms retry decisions; no weapons, boundaries, injury or other attackers. Candidate constants are changed only inside this isolated process and restored, not in source. This version exercises the separate production rear-wind channel; the original archived report used an experimental proxy. This is not a human balance or reaction study.', variants, summary, rows }, null, 2));
console.log(JSON.stringify(summary, null, 2));
