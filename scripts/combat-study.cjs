/* Thirty complete, reproducible fights in the authoritative simulation, each opened by a real missile hit.
 * No fake damage or completion events. Run after build: node scripts/combat-study.cjs [report-name]. */
const fs = require('node:fs');
const path = require('node:path');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { updateInhales, fireCaptive } = require('../server/dist/systems/inhale.js');
const { CANNON, BOTS } = require('../server/dist/constants/gameConstants.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { canCatch, lethalPlayerImpact, captureGrowthTransfer } = require('../server/dist/game/cannon.js');
// Offline balance comparison only; this never adds a client command or mutates a running server.
if (process.argv[3] && !process.argv[3].startsWith('--')) {
  const recovery = Number(process.argv[3]);
  if (![900, 1200, 1500].includes(recovery)) throw new Error('Study recovery candidate must be 900, 1200 or 1500 ms');
  CANNON.IMPACT_SUCTION_SAFE_MS = recovery;
}
const ratioOption = process.argv.find(arg => arg.startsWith('--shooter-ratio='));
if (ratioOption) {
  const ratio = Number(ratioOption.split('=')[1]);
  if (![1.1, 1.2, 1.3].includes(ratio)) throw new Error('Shooter ratio candidate must be 1.1, 1.2 or 1.3');
  CANNON.SHATTER_SHOOTER_RATIO = ratio;
}
const ammoOption = process.argv.find(arg => arg.startsWith('--source-ratio='));
const requestedAmmoRatio = ammoOption ? Number(ammoOption.split('=')[1]) : .65;
if (![.1, .45, .6, .65, .75].includes(requestedAmmoRatio)) throw new Error('Study ammunition width ratio must be .1, .45, .6, .65 or .75');
function gemsAtWidth(width, atLeast = false) {
  let lo = 0, hi = 1_000_000;
  while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (creatureSize(mid) < width || (!atLeast && creatureSize(mid) === width)) lo = mid + 1; else hi = mid; }
  return atLeast ? lo : Math.max(0, lo - 1);
}

// Construct bodies by visible width; scores are only the engine's storage for those bodies.
// Capture transfers growth before firing. Never stage ammunition that this shooter could not capture.
function legalAmmo(attacker, targetWidth, ratio = requestedAmmoRatio) {
  const desired = gemsAtWidth(targetWidth * ratio, true);
  let lo = 0, hi = desired;
  while (lo < hi) {
    const candidate = Math.ceil((lo + hi) / 2);
    const ownerBefore = attacker - captureGrowthTransfer(candidate);
    if (ownerBefore >= 0 && canCatch(creatureSize(ownerBefore), creatureSize(candidate))) lo = candidate;
    else hi = candidate - 1;
  }
  if (!canCatch(creatureSize(attacker - captureGrowthTransfer(lo)), creatureSize(lo))) throw new Error('No legal ammunition at this body size');
  return lo;
}

// Shooter width, target width, requested ammunition/target width after capture.
const matchups = [
  [100, 100, .3], [200, 200, .5], [400, 400, .6], [650, 650, .65], [900, 900, .65],
  [200, 250, .5], [500, 650, .5], [300, 240, .65], [900, 700, .65], [100, 150, .45],
];
const distances = [{ label: 'close', gap: 80 }, { label: 'medium', gap: 360 }, { label: 'long', gap: 800 }];
const outputName = String(process.argv[2] || 'latest').replace(/[^a-zA-Z0-9_-]/g, '');
const traceDir = path.join('.tmp', 'combat-study', outputName);
fs.mkdirSync(traceDir, { recursive: true }); fs.mkdirSync('reports/combat', { recursive: true });
const originalRandom = Math.random;

function fight(index, attackerGems, defenderGems, ammoGems, spacing) {
  let random = 71237 + index * 97;
  Math.random = () => { random = (Math.imul(random, 1664525) + 1013904223) >>> 0; return random / 4294967296; };
  const state = new GameState(0); state.botFill = 0; state.trafficOn = false; state.surgesOn = state.weaponsOn = false;
  state.shiftsOn = false; state.setTurbines('off'); state.blackHoles.clear();
  let now = 1e9; state.update(0, now);
  const attacker = state.addPlayer('attacker', 'Attacker', now), defender = state.addPlayer('defender', 'Defender', now);
  attacker.setGems(attackerGems - captureGrowthTransfer(ammoGems), 4200, 4200); defender.setGems(defenderGems, 4200, 4200);
  const initial = [attacker, defender];
  const trace = []; let began = null, opening = null, armed = false;
  const counts = { captures: 0, launches: 0, pairHits: 0, counterHits: 0, theftCredits: 0, puffs: 0, parries: 0, placements: 0, weaponHits: 0 };
  state.onEvent = (type, data) => {
    if (type === 'impact' && data.byId === 'attacker' && data.targetId === 'defender' && data.projectileId && began === null) {
      began = now;
      const speed = Math.hypot(ammo.flightVx, ammo.flightVy);
      opening = { gems: data.gems, out: data.out, size: data.size, x: data.x, y: data.y,
        ammoWidth: ammo.width, shooterWidth: ammo.shotShooterWidth, speed,
        shooterRatio: ammo.shotShooterWidth / data.size, ammoRatio: ammo.width / data.size,
        energyFinish: lethalPlayerImpact(speed, ammo.width, data.size, ammo.shotMassBonus),
        advantageFinish: ammo.shotShooterWidth >= data.size * CANNON.SHATTER_SHOOTER_RATIO };
    }
    if (began === null) return;
    trace.push({ ms: Math.round(now - began), type, ...data });
    if (type === 'capture') counts.captures++;
    if (type === 'launch') counts.launches++;
    if (type === 'impact' && initial.some(p => p.sessionId === data.targetId) && data.projectileId) {
      counts.pairHits++; if (data.byId === 'defender' && data.targetId === 'attacker') counts.counterHits++;
    }
    if (type === 'exhale' && initial.some(p => p.sessionId === data.id)) counts.puffs++;
    if (type === 'parry') counts.parries++;
    if (type === 'weaponPlaced') counts.placements++;
    if (type === 'credit' && data.how === 'stole' && initial.some(p => p.sessionId === data.targetId)) counts.theftCredits++;
    if (type === 'credit' && data.how === 'pulsar' && initial.some(p => p.sessionId === data.targetId)) counts.weaponHits++;
  };
  function captive(owner, gems, id) {
    const ammo = state.addPlayer(id, id, now); ammo.setGems(gems, 4200, 4200); ammo.dropProtection();
    ammo.placeAt(owner.x + owner.width * .8 + 1 - ammo.width / 2, owner.y + (owner.height - ammo.height) / 2);
    owner.facing = 0; owner.dropProtection(); owner.startInhale(now); updateInhales(state, now, .001);
    if (owner.gulping !== id) throw new Error(`Case ${index}: ammunition must be captured under normal rules`);
    owner.stopInhale(now); owner.captureNeedsRelease = false;
    return ammo;
  }
  attacker.placeAt(1000, 2000); defender.placeAt(2600, 2000);
  const ammo = captive(attacker, ammoGems, 'opening-ammo');
  attacker.placeAt(1000 - attacker.width / 2, 2100 - attacker.height / 2);
  const separation = (attacker.width + defender.width) / 2 + spacing.gap;
  defender.placeAt(1000 + separation - defender.width / 2, 2100 - defender.height / 2);
  attacker.facing = 0; defender.facing = Math.PI; attacker.dropProtection(); defender.dropProtection();
  const start = { attacker: attacker.gems, defender: defender.gems, attackerWidth: attacker.width, defenderWidth: defender.width, ammo: ammo.gems,
    ammoWidth: CANNON.BULLET_SIZE, sourceWidth: creatureSize(ammoGems), shooterRatio: attacker.width / defender.width, ammoRatio: CANNON.BULLET_SIZE / defender.width };
  if (!fireCaptive(state, attacker, now)) throw new Error(`Case ${index}: opening launch failed`);
  let duration = 0, defenderStun = 0, defenderInjury = 0, defenderTravel = 0;
  let previous = { x: defender.x, y: defender.y };
  const actors = [attacker, defender];
  ammo.isBot = true; // The living projectile retains normal flight/landing/respawn rules, but no independent third fighter.
  for (let tick = 0; tick < (50 * 30); tick++) {
    now += 1000 / 30; state.update(1 / 30, now);
    if (began === null) { if (tick > 150) throw new Error(`Case ${index}: no actual opening hit`); continue; }
    if (!armed) {
      for (const p of actors) {
        p.isBot = true; const brain = new BotBrain();
        brain.nextThinkAt = now + BOTS.THINK_MS_MIN + Math.random() * (BOTS.THINK_MS_MAX - BOTS.THINK_MS_MIN);
        state.brains.set(p.sessionId, brain);
      }
      armed = true;
    }
    duration = now - began;
    if (defender.stunned) defenderStun += 1000 / 30;
    if (defender.breathingBlocked) defenderInjury += 1000 / 30;
    defenderTravel += Math.hypot(defender.x - previous.x, defender.y - previous.y); previous = { x: defender.x, y: defender.y };
    if (attacker.state !== 'alive' || defender.state !== 'alive' || duration >= 45_000) break;
  }
  const result = { id: index + 1, seed: 71237 + index * 97, nominal: { attacker: attackerGems, defender: defenderGems, ammo: ammoGems }, defenderStartsEmpty: true, spacing: spacing.label, initialGap: spacing.gap, start, opening,
    durationSeconds: +(duration / 1000).toFixed(2), outcome: defender.state !== 'alive' ? 'attacker wins' : attacker.state !== 'alive' ? 'defender wins' : 'unresolved',
    end: { attacker: attacker.gems, defender: defender.gems }, counts, defenderStunSeconds: +(defenderStun / 1000).toFixed(2), defenderInjurySeconds: +(defenderInjury / 1000).toFixed(2), defenderTravel: Math.round(defenderTravel),
    stolen: { attacker: attacker.stolenTotal, defender: defender.stolenTotal } };
  fs.writeFileSync(path.join(traceDir, `fight-${index + 1}.json`), JSON.stringify({ result, events: trace }, null, 2));
  return result;
}
try {
  const finishing = process.argv.includes('--finishing');
  const specs = finishing
    ? [100,200,400,650,900].flatMap((width, group) => [1,1.1,1.15,1.2,1.3,1.5].map((ratio,variant) => {
      const attacker = gemsAtWidth(width, true);
      const defender = ratio === 1 ? attacker : gemsAtWidth(creatureSize(attacker) / ratio);
      const ammo = legalAmmo(attacker, creatureSize(defender));
      return { a: attacker, d: defender, ammo, spacing: distances[(group + variant) % 3] };
    }))
    : matchups.flatMap(([aw,dw,ratio]) => {
      const a = gemsAtWidth(aw, true), d = gemsAtWidth(dw, true), ammo = legalAmmo(a, creatureSize(d), ammoOption ? requestedAmmoRatio : ratio);
      return distances.map(spacing => ({a,d,ammo,spacing}));
    });
  const fights = specs.map(({a,d,ammo,spacing}, index) => fight(index,a,d,ammo,spacing));
  const durations = fights.map(f => f.durationSeconds).sort((a,b) => a-b);
  const summary = { fights: fights.length, openingHits: fights.filter(f => f.opening).length, attackerWins: fights.filter(f => f.outcome === 'attacker wins').length,
    defenderWins: fights.filter(f => f.outcome === 'defender wins').length, unresolved: fights.filter(f => f.outcome === 'unresolved').length,
    openingShatters: fights.filter(f => f.opening.out).length, sizeAdvantageFinishes: fights.filter(f => f.opening.out && f.opening.advantageFinish && !f.opening.energyFinish).length,
    underTwoSeconds: fights.filter(f => f.durationSeconds < 2).length, medianSeconds: +((durations[14] + durations[15]) / 2).toFixed(2), counterHitFights: fights.filter(f => f.counts.counterHits > 0).length,
    theftFights: fights.filter(f => f.counts.theftCredits > 0).length, weaponHitFights: fights.filter(f => f.counts.weaponHits > 0).length };
  const report = { createdAt: new Date().toISOString(), rule: `All bullets have ${CANNON.BULLET_SIZE}-unit bodies. Capture transfers excess growth immediately. A shooter at least ${Math.round((CANNON.SHATTER_SHOOTER_RATIO - 1) * 100)}% wider shatters on any player-missile hit.`, parameters: { bulletSize: CANNON.BULLET_SIZE, captureTransfer: 'growth above bullet size, none at or below', pivot: CANNON.IMPACT_MASS_PIVOT, energy: CANNON.IMPACT_BASE_GEMS, lethalRatio: CANNON.LETHAL_ENERGY_RATIO, shooterRatio: CANNON.SHATTER_SHOOTER_RATIO, requestedSourceRatio: requestedAmmoRatio, suctionRecoveryMs: CANNON.IMPACT_SUCTION_SAFE_MS },
    method: `Authoritative 30 Hz world, ordinary capture/release/launch/hit, then fallible bot inputs; 45 seconds or first primary-fighter knockout. ${finishing ? 'Five visible shooter widths (100/200/400/650/900 world units) × six shooter/target WIDTH ratios (1/1.1/1.15/1.2/1.3/1.5), with balanced close/medium/long spacing. Ammunition is selected by visible width and capped at what the shooter can legally capture before the normal growth transfer.' : 'Ten body-size matchups × 80/360/800-unit body-edge gaps.'} Only the attacker starts with one captive; defender starts empty, no assembled weapons, parts or field gems. Scores are retained only as engine setup/debug values, not size comparisons. The living projectile retains normal rules without an independent third combat controller.`, summary, fights };
  fs.writeFileSync(path.join('reports/combat', `${outputName}.json`), JSON.stringify(report, null, 2));
  const lines = ['# Thirty actual missile-opened fights by body width', '', report.rule, '', report.method, '', 'Simulation outcomes describe combat opportunities, not measured human fun or latency fairness. Width is body diameter in world units, independent of camera zoom. A 1.20× width ratio means 20% wider, not 20% more area or score.', '', '| Fight | Shooter / target width | Width ratio | Ammo / target width | Gap | Opening shatter | Seconds | Outcome |', '|---|---|---|---|---|---|---|---|',
    ...fights.map(f => `| ${f.id} | ${f.start.attackerWidth} / ${f.start.defenderWidth} | ${f.start.shooterRatio.toFixed(3)}× | ${f.start.ammoRatio.toFixed(3)}× | ${f.spacing} (${f.initialGap}) | ${f.opening.out ? 'yes' : 'no'} | ${f.durationSeconds} | ${f.outcome} |`), '', '```json', JSON.stringify(summary,null,2), '```', ''];
  fs.writeFileSync(path.join('reports/combat', `${outputName}.md`), lines.join('\n'));
  console.log(JSON.stringify(summary,null,2));
} finally { Math.random = originalRandom; }
