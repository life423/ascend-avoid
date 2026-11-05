// Current compiled-main rules only. Controlled setup and scripted inputs; no balance overrides.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const path = require('node:path'), { execFileSync } = require('node:child_process');
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
const { WeaponBoltSchema } = require('../server/dist/schema/PinwheelSchema.js');
const { creatureSize, bodyMass } = require('../server/dist/game/creatureSize.js');
const { moveSpeed } = require('../server/dist/game/movement.js');
const { arenaClearance } = require('../server/dist/game/arenaBoundary.js');
const cannon = require('../server/dist/game/cannon.js');
const { updateInhales, fireCaptive, exhale } = require('../server/dist/systems/inhale.js');
const { weaponDamage } = require('../server/dist/systems/weaponDamage.js');
const { spawnWeapon, updateWeapons } = require('../server/dist/systems/weapons.js');
const { weaponKinds, weaponProfile } = require('../server/dist/game/weaponKit.js');
const constants = require('../server/dist/constants/gameConstants.js');
const { CANNON, INHALE, EXHALE, GEMS, WEAPON_INJURY, WEAPON_FAIRNESS, SHOCKWAVE, ARENA_RULES } = constants;
const baseline = JSON.stringify(constants), profiles = JSON.stringify(weaponKinds.map(k => [k, weaponProfile(k)]));
const NOW = 1e6, DT = 1 / 30, W = 4200;
const r = n => Math.round(n * 1e4) / 1e4;
function stock(width) { if (width > 1470)
    return null; let lo = 0, hi = 1e9; while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (creatureSize(mid) < width)
        lo = mid + 1;
    else
        hi = mid;
} return lo; }
function world() { const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.weaponsOn = s.surgesOn = s.trafficOn = s.trafficHits = s.shiftsOn = false; s.setTurbines('off'); s.update(0, NOW); s.blackHoles.clear(); s.obstacles.clear(); s.balls.clear(); s.comets.clear(); return s; }
function add(s, id, gems, bot = false) { const p = s.addPlayer(id, id, NOW); p.setGems(gems, W, W); p.isBot = bot; p.dropProtection(); return p; }
function addWidth(s, id, width) { return add(s, id, stock(Math.min(1470, width))); }
function at(p, x, y) { p.placeAt(x - p.width / 2, y - p.height / 2); }
function total(s) { return [...s.players.values()].reduce((n, p) => n + p.gems, 0) + [...s.gems.values()].reduce((n, g) => n + g.value, 0); }
function touchesWall(p) { return arenaClearance(p.x + p.width / 2, p.y + p.height / 2, W, W) <= p.width / 2 + ARENA_RULES.EDGE_MARGIN + 1; }
function follow(a, t, now) { const dx = t.x + t.width / 2 - a.x - a.width / 2, dy = t.y + t.height / 2 - a.y - a.height / 2, d = Math.hypot(dx, dy) || 1; a.aimAt(dx, dy); a.steer(dx / d, dy / d); if (!a.inhaling && !a.gulping)
    a.startInhale(now); }
function readyAmmo(s, a) { const ammo = addWidth(s, 'ammo', 60); at(ammo, a.x + a.width + (ammo.width / 2) + 1, a.y + a.width / 2); a.facing = 0; a.startInhale(NOW); updateInhales(s, NOW, .001); assert.equal(a.gulping, ammo.sessionId, 'legal ammunition fixture capture'); a.stopInhale(NOW); a.captureNeedsRelease = false; assert(fireCaptive(s, a, NOW)); assert.equal(ammo.width, 60); return ammo; }
const widths = [200, 600, 1000, 1400], maxStock = stock(1470);
const sizeTable = [20, 60, 150, ...widths, 1470].map(width => { const gems = stock(width), actual = creatureSize(gems); return { requestedWidth: width, width: actual, gems, mass: bodyMass(actual), speed: moveSpeed(actual), reach: INHALE.REACH + actual * INHALE.REACH_PER_SIZE, injuryGemsThreshold: bodyMass(actual) * WEAPON_INJURY.MASS_SHARE / GEMS.GROWTH_MASS_PER_GEM }; });
const captures = [];
for (const width of widths)
    for (const ratio of [1, 1.19, 1.2, 1.299, 1.3, 1.31, 1.5]) {
        const s = world(), a = addWidth(s, 'attacker', width * ratio), t = addWidth(s, 'target', width);
        at(a, 900, 2100);
        at(t, 900 + (a.width + t.width) / 2 + 1, 2100);
        a.facing = 0;
        const before = { aWidth: a.width, tWidth: t.width, aGems: a.gems, tGems: t.gems, total: total(s) }, eligible = cannon.canCatch(a.width, t.width);
        a.startInhale(NOW);
        updateInhales(s, NOW, .001);
        assert.equal(Boolean(a.gulping), eligible);
        assert.equal(total(s), before.total);
        captures.push({ width, requestedRatio: ratio, requestedAttackerWidth: width * ratio, physicallyReachable: width * ratio <= 1470, actualRatio: r(before.aWidth / before.tWidth), eligible, captured: !!a.gulping, transfer: a.gems - before.aGems, targetKept: t.gems, attackerWidthAfter: a.width, targetWidthAfter: t.width, holdMs: eligible ? t.captureHoldMs : null });
    }
const shotFormula = [];
for (const width of widths)
    for (const ratio of [.9, 1, 1.19, 1.2]) {
        const targetGems = stock(width), targetWidth = creatureSize(targetGems), shooterWidth = creatureSize(stock(Math.min(1470, width * ratio))), speed = cannon.launchSpeed(shooterWidth), bonus = cannon.shooterMassContribution(shooterWidth, 60), damage = cannon.impactGems(targetGems, speed, 60, targetWidth, bonus, 'missile', shooterWidth), after = creatureSize(targetGems - damage);
        shotFormula.push({ targetWidth, targetGems, requestedRatio: ratio, shooterWidth, actualRatio: r(shooterWidth / targetWidth), speed, bonus, damage, lossShare: r(damage / targetGems), afterWidth: after, widthLossShare: r(1 - after / targetWidth), speedAfter: moveSpeed(after), instantShatter: cannon.lethalPlayerImpact(speed, 60, targetWidth, bonus, shooterWidth), hypotheticalNextShotShatter: cannon.lethalPlayerImpact(speed, 60, after, bonus, shooterWidth) });
    }
const stockShots = [20000, 50000, 100000, maxStock, 2e6, 1e7, 1e8].map(gems => { const width = creatureSize(gems), speed = cannon.launchSpeed(width), bonus = cannon.shooterMassContribution(width, 60), damage = cannon.impactGems(gems, speed, 60, width, bonus, 'missile', width), after = creatureSize(gems - damage); return { gems, width, mass: bodyMass(width), damage, afterGems: gems - damage, afterWidth: after, widthLossShare: r(1 - after / width), speedBefore: moveSpeed(width), speedAfter: moveSpeed(after), nextShotShatter: cannon.lethalPlayerImpact(speed, 60, after, bonus, width) }; });
function fight(width, ratio, gap, response, inventory = null) {
    const s = world(), a = inventory === null ? addWidth(s, 'attacker', width * ratio) : add(s, 'attacker', inventory), t = inventory === null ? addWidth(s, 'target', width) : add(s, 'target', inventory);
    at(a, 800, 2100);
    at(t, 800 + (a.width + t.width) / 2 + gap, 2100);
    a.facing = 0;
    const before = { targetWidth: t.width, attackerWidth: a.width, targetGems: t.gems, attackerGems: a.gems };
    let hit = null, finished = null, firstTheft = null, edge = false, next = 0;
    s.onEvent = (type, d) => { if (type !== 'credit' || d.targetId !== t.sessionId)
        return; if (d.how === 'cannon' && d.projectileId && !hit)
        hit = { at: s.time, lost: d.gems, out: !!d.out, targetWidthAfter: t.width, targetGemsAfter: t.gems, storedShooterWidth: ammo.shotShooterWidth }; if (d.out && !finished)
        finished = { at: s.time, how: d.how }; };
    const ammo = readyAmmo(s, a);
    const timeline = [];
    let elapsed = 0, ended = 'timeout';
    for (let tick = 1; tick <= 450; tick++) {
        elapsed = tick * 1000 / 30;
        const now = NOW + elapsed;
        if (hit && !hit.out && s.time >= hit.at + 250 && s.time >= next) {
            next = s.time + 250;
            follow(a, t, now);
        }
        if (hit && response !== 'idle' && s.time >= hit.at + 300) {
            if (response === 'retreat')
                t.steer(1, 0);
            else if (response === 'strafe')
                t.steer(0, -1);
            else
                t.steer(Math.SQRT1_2, -Math.SQRT1_2);
        }
        s.update(DT, now);
        if (t.robbedTotal > 0 && firstTheft === null)
            firstTheft = s.time;
        edge ||= touchesWall(t);
        if (tick % 30 === 0)
            timeline.push({ ms: r(s.time), targetWidth: t.width, targetGems: t.gems, attackerWidth: a.width, attackerGems: a.gems, robbed: t.robbedTotal, gap: r(Math.hypot(t.x + t.width / 2 - a.x - a.width / 2, t.y + t.height / 2 - a.y - a.height / 2) - (a.width + t.width) / 2), blocked: t.breathingBlocked });
        if (finished || t.state !== 'alive') {
            ended = 'knocked-out';
            break;
        }
        if (hit && !t.breathingBlocked && s.time >= hit.at + 1000) {
            ended = 'recovered';
            break;
        }
    }
    assert(hit, 'the controlled shot must actually hit');
    return { width, ratio, gap, response, inventory, ...before, actualRatio: r(before.attackerWidth / before.targetWidth), hit, firstTheft, finished, ended, elapsed: r(elapsed), targetGems: t.gems, targetWidth: t.width, attackerWidth: a.width, robbed: t.robbedTotal, edge, timeline };
}
const fights = [];
for (const width of widths)
    for (const ratio of [.9, 1, 1.19, 1.2])
        for (const gap of [100, 350, 650])
            for (const response of ['idle', 'retreat', 'strafe'])
                fights.push(fight(width, ratio, gap, response));
for (const inventory of [maxStock, 2e6, 1e7])
    for (const gap of [100, 350, 650])
        for (const response of ['idle', 'retreat', 'strafe'])
            fights.push(fight(1470, 1, gap, response, inventory));
function escape(hunterWidth, runnerWidth, reachShare, reaction, response, puff) {
    const s = world(), a = addWidth(s, 'hunter', hunterWidth), p = addWidth(s, 'runner', runnerWidth), reach = INHALE.REACH + a.width * INHALE.REACH_PER_SIZE;
    const ax = a.width / 2 + ARENA_RULES.EDGE_MARGIN + 20;
    at(a, ax, 2100);
    at(p, ax + a.width * .3 + reach * reachShare + p.width / 2, 2100);
    a.facing = 0;
    p.facing = puff === 'front' ? Math.PI : 0;
    let next = 0, fired = false, cast = null, puffHit = false, edge = false, ended = 'survived-in-reach', elapsed = 0, firstContact = null, lastContact = null, stayedClearFrom = null;
    const initial = { aX: a.x, pX: p.x, aWidth: a.width, pWidth: p.width };
    s.onEvent = (type, d) => { if (type === 'exhale' && d.id === p.sessionId) {
        cast = { at: s.time, breathLeft: d.breathLeft, recoil: d.recoil };
        if (d.recoil > 0)
            puffHit = true;
    } if (type === 'gustHit' && d.id === p.sessionId && d.targetId === a.sessionId)
        puffHit = true; };
    for (let tick = 1; tick <= 360; tick++) {
        elapsed = tick * 1000 / 30;
        const now = NOW + elapsed;
        if (elapsed >= next) {
            next = elapsed + 250;
            follow(a, p, now);
        }
        if (elapsed >= reaction) {
            if (puff !== 'none' && !fired) {
                exhale(s, p, now);
                fired = true;
            }
            const direction = response === 'away' ? [1, 0] : response === 'strafe' ? [0, -1] : [Math.SQRT1_2, -Math.SQRT1_2];
            const ramp = Math.min(1, (elapsed - reaction + DT * 1000) / 200);
            p.steer(direction[0] * ramp, direction[1] * ramp);
        }
        s.update(DT, now);
        edge ||= touchesWall(p);
        const active = !!a.lockOn.get(p.sessionId);
        if (active) {
            if (firstContact === null)
                firstContact = s.time;
            lastContact = s.time;
            stayedClearFrom = null;
        }
        else if (firstContact !== null && stayedClearFrom === null)
            stayedClearFrom = s.time;
        if (p.capturedBy) {
            ended = 'captured';
            break;
        }
        if (p.state !== 'alive') {
            ended = 'knocked-out';
            break;
        }
        if (stayedClearFrom !== null && s.time - stayedClearFrom >= 1000) {
            ended = 'escaped-cone';
            break;
        }
    }
    return { hunterWidth: a.width, runnerWidth: p.width, requestedHunterWidth: hunterWidth, requestedRunnerWidth: runnerWidth, reach, reachShare, mouthGap: reach * reachShare, initialSurfaceGap: reach * reachShare - initial.aWidth * .2, reaction, response, puff, ended, elapsed: r(elapsed), cast, puffHit, edge, firstContact, lastContact, runnerTravel: r(p.x - initial.pX), hunterTravel: r(a.x - initial.aX), finalDistance: r(Math.hypot(p.x + p.width / 2 - a.x - a.width / 2, p.y + p.height / 2 - a.y - a.height / 2)) };
}
const escapes = [];
for (const hunter of [300, 600, 1000, 1400])
    for (const runner of [60, 150])
        for (const reachShare of [.15, .3, .6, .9])
            for (const reaction of [0, 350, 700])
                for (const response of ['away', 'strafe', 'diagonal'])
                    for (const puff of ['none', 'rear', 'front'])
                        escapes.push(escape(hunter, runner, reachShare, reaction, response, puff));
function weaponAmount(kind, gems) { if (kind === 'pulsar')
    return Math.max(SHOCKWAVE.DAMAGE_MIN_GEMS, Math.ceil(gems * SHOCKWAVE.DAMAGE_SHARE)); const p = weaponProfile(kind); return Math.min(gems, Math.ceil(gems * p.share), Math.max(p.minimum, Math.ceil(Math.sqrt(gems) * p.root))); }
const inventories = [20000, 50000, 100000, maxStock, 2e6, 1e7, 1e8], budgets = [];
for (const gems of inventories)
    for (const kind of weaponKinds)
        for (const graze of [false, true])
            for (const cadence of ['shared-guard-upper-bound', 'single-kind-cadence']) {
                const s = world(), t = add(s, 'target', gems), o = add(s, 'owner', 0);
                at(t, 2500, 2100);
                at(o, 100, 100);
                s.time = 1000;
                s.now = NOW + 1000;
                const before = { width: t.width, mass: bodyMass(t.width), gems: t.gems, thresholdGems: bodyMass(t.width) * WEAPON_INJURY.MASS_SHARE / GEMS.GROWTH_MASS_PER_GEM };
                const hits = [];
                // Single-kind cadence adds arming/aim frequency only as a timing bound; emitter rotation can miss.
                const profile = weaponProfile(kind), interval = cadence === 'shared-guard-upper-bound' ? 900 : kind === 'pulsar' ? SHOCKWAVE.BEAT_MS : kind === 'ion' ? 1800 : Math.ceil(900 / profile.shotMs) * profile.shotMs;
                for (const delta of [0, interval, interval * 2]) {
                    s.time = 1000 + delta;
                    s.now = NOW + s.time;
                    const preWidth = t.width, preGems = t.gems, amount = weaponAmount(kind, t.gems), hit = kind === 'pulsar' && graze ? { lost: 0, out: false, earned: 0, outerOnly: true } : weaponDamage(s, t, o.sessionId, amount, s.now, graze);
                    hits.push({ delta, requested: amount, ...hit, preWidth, preGems, afterWidth: t.width, nominalMassShare: r(hit.lost * GEMS.GROWTH_MASS_PER_GEM / bodyMass(preWidth)), visibleMassLossShare: r(1 - bodyMass(t.width) / bodyMass(preWidth)), injured: t.breathingBlocked, deadline: t.injuredUntil });
                }
                budgets.push({ gems, kind, graze, cadence, interval, ...before, hits, firstInjuringHit: hits.findIndex(h => h.injured) + 1, ownerCredit: o.weaponDamage, ownerGems: o.gems });
            }
function emittedWeapon(gems, kind) {
    const s = world(), t = add(s, 'target', gems), o = add(s, 'owner', 0);
    at(o, 100, 100);
    at(t, 800 + t.width / 2 + 330, 2100);
    s.weaponsOn = true;
    spawnWeapon(s, 800, 2100, kind);
    const w = s.pinwheel, profile = weaponProfile(kind);
    w.phase = 'active';
    w.owner = o.sessionId;
    w.at = profile.activeMs;
    w.originX = w.x;
    w.originY = w.y;
    w.activatedAt = 0;
    w.nextShotAt = profile.shotMs;
    w.nextAimAt = profile.orbit ? w.nextShotAt - 650 : 0;
    w.angle = 0;
    const hits = [];
    s.onEvent = (type, d) => { if (type === 'credit' && d.targetId === t.sessionId)
        hits.push({ time: s.time, lost: d.gems, glancing: d.glancing, out: d.out, kind: d.how, injured: t.breathingBlocked, width: t.width }); };
    for (let tick = 1; tick <= 240 && t.state === 'alive'; tick++)
        s.update(DT, NOW + tick * 1000 / 30);
    return { gems, kind, initialWidth: creatureSize(gems), distance: creatureSize(gems) / 2 + 330, outcome: t.state, targetGems: t.gems, width: t.width, robbed: t.robbedTotal, injured: t.breathingBlocked, hits };
}
const emitters = [];
for (const gems of [20000, 100000, maxStock])
    for (const kind of ['pinwheel', 'sentinel', 'ricochet', 'comet', 'ion'])
        emitters.push(emittedWeapon(gems, kind));
const weaponCollisions = [];
for (const gems of inventories)
    for (const kind of ['pinwheel', 'sentinel', 'ricochet', 'comet'])
        for (const graze of [false, true]) {
            const s = world(), t = add(s, 'target', gems), o = add(s, 'owner', 0);
            at(t, 2600, 2100);
            at(o, 100, 100);
            s.weaponsOn = true;
            s.time = 2000;
            s.now = NOW + 2000;
            spawnWeapon(s, 1000, 2100, kind);
            const w = s.pinwheel, profile = weaponProfile(kind);
            w.phase = 'active';
            w.owner = o.sessionId;
            w.at = s.time + profile.activeMs;
            w.originX = w.x;
            w.originY = w.y;
            w.activatedAt = s.time;
            w.nextShotAt = w.nextAimAt = Infinity;
            const bolt = new WeaponBoltSchema();
            bolt.x = 2600 - t.width / 2 - 30;
            bolt.y = 2100 + (graze ? t.width * .35 : 0);
            bolt.angle = 0;
            bolt.bornAt = s.time - 600;
            bolt.traveled = profile.speed * .6;
            w.bolts.set('controlled', bolt);
            const before = { gems: t.gems, width: t.width };
            let hit = null;
            s.onEvent = (type, d) => { if (type === 'credit' && d.targetId === t.sessionId)
                hit = { ...d, time: s.time }; };
            for (let tick = 1; tick <= 60 && !hit; tick++) {
                s.time = 2000 + tick * 1000 / 30;
                s.now = NOW + s.time;
                updateWeapons(s, DT, s.now);
            }
            assert(hit, 'controlled armed bolt must hit');
            assert.equal(!!hit.glancing, graze);
            const nominal = weaponAmount(kind, before.gems);
            assert.equal(hit.gems, graze ? Math.max(1, Math.round(nominal * WEAPON_FAIRNESS.GRAZE_DAMAGE_SHARE)) : nominal);
            weaponCollisions.push({ gems, kind, graze, ...before, hit, afterGems: t.gems, afterWidth: t.width, injured: t.breathingBlocked });
        }
assert.equal(JSON.stringify(constants), baseline, 'no tuning constants changed');
assert.equal(JSON.stringify(weaponKinds.map(k => [k, weaponProfile(k)])), profiles, 'no weapon profiles changed');
const summarize = rows => ({ cases: rows.length, ...Object.fromEntries([...new Set(rows.map(x => x.ended))].map(key => [key, rows.filter(x => x.ended === key).length])), wallContacts: rows.filter(x => x.edge).length });
const summary = { fights: widths.map(width => ({ width, ...summarize(fights.filter(x => x.width === width)) })), stockFights: [maxStock, 2e6, 1e7].map(inventory => ({ inventory, ...summarize(fights.filter(x => x.inventory === inventory)) })), escapes: [300, 600, 1000, 1400].map(width => ({ width, ...summarize(escapes.filter(x => x.requestedHunterWidth === width)) })), firstCentralInjury: budgets.filter(x => !x.graze).map(x => ({ gems: x.gems, width: x.width, kind: x.kind, cadence: x.cadence, interval: x.interval, firstInjuringHit: x.firstInjuringHit, damage: x.hits[0].lost, nominalMassShare: x.hits[0].nominalMassShare, visibleMassLossShare: x.hits[0].visibleMassLossShare })), emitters };
const result = { reference: REFERENCE, execution, date: execution.at, method: 'Compiled main; no source/constant/profile overrides. Controlled isolated actual GameState at30Hz, no ambient bots/field/hazards, fixed scripted movement/aiming. Fights start with actual legal capture of60px ammo and fireCaptive; pursuit250ms after hit, defender response300ms after hit,15000ms bound. Escape positions use actual mouth-to-defender-edge reach, hunter tracks every250ms, runner analog ramp200ms; fixed directions are not optimal human play. Weapon budgets separately model accepted shared-guard contacts at0/900/1800ms and single-kind cadence, neither claiming real emitter landing frequency; Pulsar outer grazes correctly deal no damage. Emitter fixtures use actual8s weapon update and normal activation cadence/orbit/aim/arming/guards, stationary target. Collision fixtures supply one already-armed bolt with consistent age/traveled distance and run actual weapon swept-contact/graze/damage. Tests are mechanical diagnostics, not human fun/fairness validation.', constants: { ARENA_RULES, CANNON, INHALE, EXHALE, GEMS, WEAPON_INJURY, WEAPON_FAIRNESS }, compiledCannonSha256: crypto.createHash('sha256').update(fs.readFileSync('server/dist/game/cannon.js')).digest('hex'), maxStockMeaning: 'No gem-score cap exists; first rounded1470px width occurs at maxStock, with additional2m/10m/100m stock stress cases.', maxStock, sizeTable, captures, shotFormula, stockShots, fights, escapes, budgets, emitters, weaponCollisions, summary };
fs.writeFileSync('.tmp/overall-balance-combat.json', JSON.stringify(result, null, 2));
fs.writeFileSync('.tmp/overall-balance-combat-summary.json', JSON.stringify(summary, null, 2));
console.log(JSON.stringify({ maxStock, sizeTable, stockShots, fights: summary.fights, stockFights: summary.stockFights, escapes: summary.escapes, emitters: summary.emitters }, null, 2));
