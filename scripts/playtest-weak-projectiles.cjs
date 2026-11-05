const fs = require('node:fs'), assert = require('node:assert/strict');
const path = require('node:path'), crypto = require('node:crypto'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
process.chdir(root);
const REFERENCE = { revision: '9344b163c1c5295a5b17435248d362c75e760995', compiledTreeSha256: 'd81e3d31942fbfef6eff1e8cd307751e0e672a350999833ddccc3d1630d2d6e1', compiledCannonSha256: '5c4417d7b03067a11bc6dace8d9dec91cea6db73fe6ddad3db64f8aa37bb2f8a' };
function executionInfo() {
    const walk = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? walk(path.join(dir, entry.name)) : entry.name.endsWith('.js') ? [path.join(dir, entry.name)] : []);
    const files = walk('server/dist').sort(), hash = crypto.createHash('sha256');
    for (const file of files) {
        hash.update(path.relative('server/dist', file).split(path.sep).join('/'));
        hash.update('\0');
        hash.update(fs.readFileSync(file));
        hash.update('\0');
    }
    const compiledTreeSha256 = hash.digest('hex');
    const git = args => { try {
        return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    }
    catch {
        return null;
    } };
    return { at: new Date().toISOString(), sourceRevision: git(['rev-parse', 'HEAD']), coreSourceStatus: git(['status', '--porcelain', '--untracked-files=all', '--', 'server', 'src']), compiledTreeSha256, compiledJavaScriptFiles: files.length, matchesReferenceBuild: compiledTreeSha256 === REFERENCE.compiledTreeSha256, note: 'The compiled tree, not Git HEAD alone, determines which mechanics ran. No build is invoked.' };
}
const execution = executionInfo();
fs.mkdirSync('.tmp', { recursive: true });
if (process.argv.includes('--metadata-only')) {
    console.log(JSON.stringify({ reference: REFERENCE, execution }, null, 2));
    process.exit(0);
}
const { GameState } = require('../server/dist/schema/GameState.js');
const { TurbineSchema } = require('../server/dist/schema/TurbineSchema.js');
const { runTurbine } = require('../server/dist/systems/turbines.js');
const { creatureSize, bodyMass } = require('../server/dist/game/creatureSize.js');
const { updateInhales, fireCaptive } = require('../server/dist/systems/inhale.js');
const { weaponDamage } = require('../server/dist/systems/weaponDamage.js');
const { arenaClearance } = require('../server/dist/game/arenaBoundary.js');
const constants = require('../server/dist/constants/gameConstants.js');
const { CANNON, INHALE, GEMS, WEAPON_INJURY, TURBINE, ARENA_RULES } = constants;
const beforeRules = JSON.stringify(constants), NOW = 1e6, DT = 1 / 30, W = 4200;
function stock(width) { let lo = 0, hi = 1e9; while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (creatureSize(mid) < width)
        lo = mid + 1;
    else
        hi = mid;
} return lo; }
function scene() { const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = s.surgesOn = s.trafficOn = s.trafficHits = s.shiftsOn = false; s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear(); s.obstacles.clear(); s.balls.clear(); s.comets.clear(); return s; }
function add(s, id, gems) { const p = s.addPlayer(id, id, NOW); p.setGems(gems, W, W); p.dropProtection(); return p; }
function at(p, x, y) { p.placeAt(x - p.width / 2, y - p.width / 2); }
function follow(a, t, now) { const dx = t.x + t.width / 2 - a.x - a.width / 2, dy = t.y + t.height / 2 - a.y - a.height / 2, d = Math.hypot(dx, dy) || 1; a.aimAt(dx, dy); a.steer(dx / d, dy / d); if (!a.inhaling && !a.gulping)
    a.startInhale(now); }
function playerShot(s, t, width) {
    const a = add(s, 'shooter', stock(width));
    at(a, 800, 2100);
    a.facing = 0;
    const ammoWidth = a.width >= 78 ? 60 : a.width >= 52 ? 40 : 20, ammo = add(s, 'projectile', stock(ammoWidth));
    at(ammo, 800 + (a.width + ammo.width) / 2 + 1, 2100);
    a.startInhale(NOW);
    updateInhales(s, NOW, .001);
    assert.equal(a.gulping, ammo.sessionId);
    a.stopInhale(NOW);
    a.captureNeedsRelease = false;
    at(t, 800 + (a.width + t.width) / 2 + 350, 2100);
    assert(fireCaptive(s, a, NOW));
    assert.equal(ammo.width, 60);
    return { projectile: ammo, shooter: a, fixture: { kind: 'cannon', requestedShooterWidth: width, shooterWidth: a.width, ammoNaturalWidth: ammoWidth, flightWidth: ammo.width, speed: Math.hypot(ammo.flightVx, ammo.flightVy), shotMassBonus: ammo.shotMassBonus, shotShooterWidth: ammo.shotShooterWidth } };
}
function fanShot(s, t) {
    const p = add(s, 'projectile', stock(40)), fan = new TurbineSchema('controlled-fan', 900, 2100, Math.PI, 0);
    fan.phase = 'active';
    fan.still = true;
    at(p, fan.x - TURBINE.BODY_RADIUS - p.width / 2 - 4, 2100);
    runTurbine(s, fan, NOW, .01);
    assert(p.flying && p.flightKind === 'turbine');
    const speed = Math.hypot(p.flightVx, p.flightVy), ux = p.flightVx / speed, uy = p.flightVy / speed;
    assert(ux > .99, 'still exhaust should point into open arena');
    at(t, p.x + p.width / 2 + ux * ((t.width + p.width) / 2 + 350), p.y + p.width / 2 + uy * ((t.width + p.width) / 2 + 350));
    return { projectile: p, shooter: null, fixture: { kind: 'fan', pilotBeforeWidth: 40, pilotBeforeGems: stock(40), pilotFlightWidth: p.width, pilotRetainedGems: p.gems, speed, launchedBy: p.launchedBy, shotOwner: p.shotOwner } };
}
function weaponGate(gems, loss) { const s = scene(), p = add(s, 'comparison', gems), o = add(s, 'builder', 0), width = p.width, result = weaponDamage(s, p, o.sessionId, loss, NOW); return { lost: result.lost, injured: p.breathingBlocked, thresholdGems: bodyMass(width) * WEAPON_INJURY.MASS_SHARE / GEMS.GROWTH_MASS_PER_GEM, nominalMassShare: loss * GEMS.GROWTH_MASS_PER_GEM / bodyMass(width), visibleMassLossShare: 1 - bodyMass(p.width) / bodyMass(width), widthBefore: width, widthAfter: p.width }; }
function encounter(gems, kind, attackerCount, response, shooterWidth = 80, stationaryInhale = false) {
    const s = scene(), t = add(s, 'victim', gems), initialWidth = t.width;
    let eventHit = null, impactState = null, finish = null, firstTheft = null, edge = false, next = 0;
    const { projectile, shooter, fixture } = kind === 'fan' ? fanShot(s, t) : playerShot(s, t, shooterWidth);
    const cx = t.x + t.width / 2, cy = t.y + t.width / 2;
    const attackers = Array.from({ length: attackerCount }, (_, i) => { const p = add(s, 'hunter' + i, stock(60)), a = i === 0 ? Math.PI * 1.25 : Math.PI * .75, d = (p.width + t.width) / 2 + 100; at(p, cx + Math.cos(a) * d, cy + Math.sin(a) * d); p.facing = Math.atan2(cy - p.y - p.width / 2, cx - p.x - p.width / 2); return p; });
    const startAttackerStock = attackers.map(p => p.gems);
    let confound = false;
    s.onEvent = (type, d) => { if (d.targetId !== t.sessionId)
        return; if (type === 'impact' && d.projectileId === projectile.sessionId && !eventHit)
        eventHit = { at: s.time, gems: d.gems, out: !!d.out, byId: d.byId, how: d.kind, targetGemsBefore: t.gems + d.gems, targetWidthBefore: d.size }; if (type === 'credit' && d.out && !finish)
        finish = { at: s.time, how: d.how, byId: d.byId, remainingGemReward: d.gems ?? 0 }; };
    const timeline = [];
    let elapsed = 0, ended = 'no-impact';
    for (let tick = 1; tick <= 360; tick++) {
        elapsed = tick * 1000 / 30;
        const now = NOW + elapsed;
        if (eventHit && s.time >= eventHit.at + 250 && s.time >= next) {
            next = s.time + 250;
            attackers.forEach(p => follow(p, t, now));
            if (stationaryInhale && shooter && !shooter.inhaling)
                shooter.startInhale(now);
        }
        if (eventHit && response === 'retreat' && s.time >= eventHit.at + 300)
            t.steer(1, 0);
        s.update(DT, now);
        if (eventHit && !impactState)
            impactState = { at: s.time, gems: t.gems, width: t.width, injuredUntil: t.injuredUntil, injuryRemaining: t.injuredUntil - s.time, breathingBlocked: t.breathingBlocked, stunned: t.stunned, stunRemaining: t.stunEndsAt - now, suctionRecoveryRemaining: Math.max(0, t.suctionSafeUntil - now), shooterGems: shooter?.gems ?? null, shooterStolen: shooter?.stolenTotal ?? null };
        edge ||= arenaClearance(t.x + t.width / 2, t.y + t.width / 2, W, W) <= t.width / 2 + ARENA_RULES.EDGE_MARGIN + 1;
        for (const p of attackers)
            if (p.gulping && p.gulping !== t.sessionId)
                confound = true;
        if (!firstTheft) {
            const a = attackers.find(p => p.stolenTotal > 0);
            if (a) {
                const mouth = { x: a.x + a.width / 2 + Math.cos(a.facing) * a.width * .3, y: a.y + a.width / 2 + Math.sin(a.facing) * a.width * .3 };
                firstTheft = { at: s.time, by: a.sessionId, attackerWidth: a.width, mouthToTargetEdge: Math.max(0, Math.hypot(t.x + t.width / 2 - mouth.x, t.y + t.width / 2 - mouth.y) - t.width / 2), reach: INHALE.REACH + a.width * INHALE.REACH_PER_SIZE, stealingFrom: a.stealingFrom, stolen: a.stolenTotal };
            }
        }
        if (eventHit && tick % 15 === 0)
            timeline.push({ at: s.time, targetGems: t.gems, targetWidth: t.width, robbed: t.robbedTotal, x: t.x + t.width / 2, attackers: attackers.map(p => ({ id: p.sessionId, width: p.width, gems: p.gems, stolen: p.stolenTotal, inhaling: p.inhaling, stealingFrom: p.stealingFrom, holding: p.gulping })), shooterStock: shooter?.gems ?? null, shooterStolen: shooter?.stolenTotal ?? null });
        if (finish || t.state !== 'alive') {
            ended = 'knocked-out';
            break;
        }
        if (eventHit && s.time >= eventHit.at + 7000 && !t.breathingBlocked) {
            ended = 'recovered';
            break;
        }
    }
    assert(eventHit, 'controlled tiny shot must actually hit');
    const gate = weaponGate(eventHit.targetGemsBefore, eventHit.gems);
    return { gems, kind, attackerCount, response, stationaryInhale, fixture, initialWidth, eventHit, impactState, assembledGateForSameLoss: gate, firstTheft, finish, ended, elapsed, edge, confound, finalTargetGems: t.gems, finalTargetWidth: t.width, robbed: t.robbedTotal, ordinaryTheft: t.robbedTotal - (finish?.how === 'mouth' ? finish.remainingGemReward : 0), attackerGains: attackers.map((p, i) => p.gems - startAttackerStock[i]), shooterStolen: shooter?.stolenTotal ?? null, shooterGems: shooter?.gems ?? null, timeline };
}
const rows = [];
for (const gems of [20000, 50000, 100000, 1000000]) {
    for (const width of [26, 60, 80])
        rows.push(encounter(gems, 'cannon', 0, 'idle', width, false));
    rows.push(encounter(gems, 'fan', 0, 'idle', 0, false));
    rows.push(encounter(gems, 'cannon', 0, 'idle', 80, true));
    for (const kind of ['cannon', 'fan'])
        for (const count of [1, 2])
            for (const response of ['idle', 'retreat'])
                rows.push(encounter(gems, kind, count, response, 80, false));
}
const repetitions = [];
for (let trial = 1; trial <= 5; trial++)
    for (const gems of [50000, 100000])
        for (const kind of ['cannon', 'fan'])
            repetitions.push({ trial, ...encounter(gems, kind, 1, 'retreat', 80, false) });
assert.equal(JSON.stringify(constants), beforeRules, 'no rule/profile overrides');
const output = { reference: REFERENCE, execution, date: execution.at, method: 'Actual compiled shared engine,30Hz, no balance overrides. Controlled empty arena, actual legal tiny capture/fire or actual still-fan launch; target stocks20k/50k/100k/1m. Independent healthy60px hunters start100 units outside target surface at45-degree rear flanks, outside projectile line; normal250ms aim/pursuit decisions begin250ms after impact. Target idle or starts outward+X movement300ms after impact, preserving stun. Shooter stays at initial off-range position; optional stationary-inhale case checks no automatic remote theft. No attacker teleports after setup, no continuation/injury refresh, normal spill/collection/upkeep/respawn remain. Native RNG is not overridden; twenty repeat cells sample spill variation. Ordinary theft excludes the remaining gem transfer on a mouth finish. Fixed scripts are mechanical diagnostics, not optimal human combat or fun validation; any nonvictim capture is explicitly marked confounded.', constants: { injuryMs: INHALE.INJURY_MS, weaponThreshold: WEAPON_INJURY, puffCost: constants.EXHALE.BREATH_COST, impactStun: CANNON.IMPACT_STUN_MS, impactSuctionRecovery: CANNON.IMPACT_SUCTION_SAFE_MS }, rows, repetitions };
fs.writeFileSync('.tmp/overall-balance-weak-projectiles.json', JSON.stringify(output, null, 2));
console.log(JSON.stringify(rows.map(x => ({ gems: x.gems, kind: x.kind, width: x.fixture.shooterWidth ?? x.fixture.pilotFlightWidth, count: x.attackerCount, response: x.response, stationaryInhale: x.stationaryInhale, damage: x.eventHit.gems, injured: x.impactState.breathingBlocked, stunned: x.impactState.stunned, weaponGate: x.assembledGateForSameLoss.injured, robbed: x.robbed, outcome: x.ended, elapsed: Math.round(x.elapsed), edge: x.edge, confound: x.confound, shooterStolen: x.shooterStolen })), null, 2));
