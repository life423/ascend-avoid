const fs = require('node:fs');
const { GameState } = require('../server/dist/schema/GameState.js');
const { BotBrain } = require('../server/dist/game/bots.js');
const { BlackHoleSchema } = require('../server/dist/schema/BlackHoleSchema.js');
const { TurbineSchema } = require('../server/dist/schema/TurbineSchema.js');
const { creatureSize } = require('../server/dist/game/creatureSize.js');
const { moveSpeed } = require('../server/dist/game/movement.js');
const { arenaClearance, constrainArenaPoint } = require('../server/dist/game/arenaBoundary.js');
const { BLACK_HOLE, TURBINE } = require('../server/dist/constants/gameConstants.js');
const path = require('node:path');
process.chdir(path.resolve(__dirname, '..'));
fs.mkdirSync('.tmp', { recursive: true });

const W = 4200, DT = 1 / 30, BASE = 1e9;
const specifications = [20000, 50000, 100000, 1e9].map(gems => ({ gems, width: creatureSize(gems), speed: moveSpeed(creatureSize(gems)) }));
const offsets = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
const keepRandom = Math.random, keepNow = Date.now;
let clock = BASE;
function seedRandom(seed) { Math.random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; }; Date.now = () => clock; }
function layout(state, seed) {
  return { seed, seconds: state.time / 1000,
    fans: state.turbines.map(t => ({ id: t.id, x: t.x, y: t.y, intake: t.intake, sweepFrom: t.sweepFrom, phase: t.phase, phaseEndsAt: t.phaseEndsAt })),
    holes: state.blackHoles.map(h => ({ x: h.x, y: h.y, radius: h.radius, phase: h.phase, at: h.at, activeAt: h.activeAt, generation: h.generation })) };
}
function obstacles(l, width, holesOnly = false) {
  return [...l.holes.filter(h => h.phase === 'active' || h.phase === 'closing').map(h => ({ kind: 'hole', x: h.x, y: h.y, r: h.radius + width / 2 + BLACK_HOLE.RIM_CLEARANCE })),
    ...holesOnly ? [] : l.fans.filter(f => f.phase === 'active').map(f => ({ kind: 'fan', x: f.x, y: f.y, r: TURBINE.BODY_RADIUS + width / 2 }))];
}
function signature(l) { return JSON.stringify(obstacles(l, 0)); }
function distanceToSegmentSquared(cx, cy, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
  const t = length ? Math.max(0, Math.min(1, ((cx - ax) * dx + (cy - ay) * dy) / length)) : 0;
  return (ax + dx * t - cx) ** 2 + (ay + dy * t - cy) ** 2;
}
function graph(l, width, n = 100, holesOnly = false, gap = 2) {
  const circles = obstacles(l, width, holesOnly).map(o => ({ ...o, r: o.r + gap }));
  const pad = width / 2 + 8, count = n + 1, step = (W - 2 * pad) / n;
  const xs = new Float64Array(count * count), ys = new Float64Array(count * count);
  const labels = new Int32Array(count * count); labels.fill(-1);
  const clear = (x, y) => arenaClearance(x, y, W, W) >= pad - 1e-6 && circles.every(c => (x - c.x) ** 2 + (y - c.y) ** 2 >= c.r ** 2);
  const edge = (a, b) => circles.every(c => distanceToSegmentSquared(c.x, c.y, xs[a], ys[a], xs[b], ys[b]) >= c.r ** 2);
  let openCount = 0;
  for (let y = 0; y <= n; y++) for (let x = 0; x <= n; x++) {
    const id = y * count + x; xs[id] = pad + x * step; ys[id] = pad + y * step;
    if (!clear(xs[id], ys[id])) labels[id] = -2; else openCount++;
  }
  const sizes = [], queue = new Uint32Array(count * count);
  for (let start = 0; start < labels.length; start++) {
    if (labels[start] !== -1) continue;
    const label = sizes.length; labels[start] = label; queue[0] = start; let tail = 1;
    for (let head = 0; head < tail; head++) {
      const here = queue[head], x = here % count, y = Math.floor(here / count);
      for (const [ox, oy] of offsets) {
        const col = x + ox, row = y + oy;
        if (col < 0 || col > n || row < 0 || row > n) continue;
        const next = row * count + col;
        if (labels[next] !== -1 || !edge(here, next)) continue;
        labels[next] = label; queue[tail++] = next;
      }
    }
    sizes.push(tail);
  }
  const nearest = p => {
    let result = -1, best = Infinity;
    for (let id = 0; id < labels.length; id++) if (labels[id] >= 0) {
      const d = (xs[id] - p.x) ** 2 + (ys[id] - p.y) ** 2;
      if (d < best) { result = id; best = d; }
    }
    return { id: result, distance: Math.sqrt(best), component: result >= 0 ? labels[result] : -1 };
  };
  const center = nearest({ x: 2100, y: 2100 });
  const corners = [[0, 0], [W, 0], [0, W], [W, W]].map(([x, y]) => {
    const p = { x, y }; constrainArenaPoint(p, W, W, pad);
    const closest = nearest(p);
    return { ...closest, ideal: p, idealClear: clear(p.x, p.y), connectsCenter: closest.component >= 0 && closest.component === center.component };
  });
  const summary = { width, resolution: n, openCount, componentCount: sizes.length,
    substantialComponents: sizes.filter(s => s >= Math.max(4, openCount * .01)).length,
    largestComponentShare: openCount ? Math.max(...sizes) / openCount : 0,
    centerRegionShare: openCount && center.id >= 0 ? sizes[center.component] / openCount : 0,
    centerOffset: center.distance, exactCenterClear: clear(2100, 2100),
    availableExactCorners: corners.filter(c => c.idealClear).length,
    nearestCornersConnected: corners.filter(c => c.connectsCenter).length,
    corners: corners.map(({ id, ...c }) => ({ ...c, x: id >= 0 ? xs[id] : null, y: id >= 0 ? ys[id] : null })),
    componentNodes: sizes };
  const point = id => ({ x: xs[id], y: ys[id] });
  function route(start, destination) {
    if (start < 0 || destination < 0 || labels[start] !== labels[destination]) return null;
    const previous = new Int32Array(labels.length); previous.fill(-1); previous[start] = start;
    queue[0] = start; let tail = 1;
    for (let head = 0; head < tail && previous[destination] < 0; head++) {
      const here = queue[head], x = here % count, y = Math.floor(here / count);
      for (const [ox, oy] of offsets) {
        const col = x + ox, row = y + oy;
        if (col < 0 || col > n || row < 0 || row > n) continue;
        const next = row * count + col;
        if (labels[next] < 0 || previous[next] >= 0 || !edge(here, next)) continue;
        previous[next] = here; queue[tail++] = next;
      }
    }
    if (previous[destination] < 0) return null;
    const ids = []; for (let at = destination;; at = previous[at]) { ids.push(at); if (at === start) break; }
    ids.reverse();
    // String pulling keeps a legal continuous route, reducing grid zigzags and turning.
    const short = [ids[0]];
    for (let at = 0; at < ids.length - 1;) {
      let next = ids.length - 1; while (next > at + 1 && !edge(ids[at], ids[next])) next--;
      short.push(ids[next]); at = next;
    }
    return short.map(point);
  }
  return { summary, nearest, point, center, corners, labels, route };
}
function pathLength(path) { return path.slice(1).reduce((sum, p, i) => sum + Math.hypot(p.x - path[i].x, p.y - path[i].y), 0); }
function clearance(l, p) { return { wall: arenaClearance(p.x + p.width / 2, p.y + p.height / 2, W, W) - p.width / 2 - 8,
  hole: Math.min(Infinity, ...obstacles(l, p.width, true).map(c => Math.hypot(p.x + p.width / 2 - c.x, p.y + p.height / 2 - c.y) - c.r)),
  fan: Math.min(Infinity, ...obstacles(l, p.width).filter(c => c.kind === 'fan').map(c => Math.hypot(p.x + p.width / 2 - c.x, p.y + p.height / 2 - c.y) - c.r)) }; }

function frozenWorld(l, spec, start, protectedBody = false) {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0; s.gems.clear(); s.weaponsOn = s.surgesOn = s.trafficOn = s.trafficHits = false;
  s.setTurbines('off'); s.blackHoles.clear();
  for (const h of l.holes) { const hole = new BlackHoleSchema(h.x, h.y, h.radius, h.phase === 'warning' ? 1e12 : 0); hole.phase = h.phase; s.blackHoles.push(hole); }
  for (const f of l.fans) { const fan = new TurbineSchema(f.id, f.x, f.y, f.intake, l.seconds * 1000); fan.phase = f.phase; fan.phaseEndsAt = 1e12; fan.sweepFrom = f.sweepFrom; s.turbines.push(fan); }
  const now = BASE + l.seconds * 1000; s.startedAt = BASE;
  const p = s.addPlayer('walker', 'Walker', now); p.setGems(spec.gems, W, W); p.placeAt(start.x - p.width / 2, start.y - p.height / 2);
  if (protectedBody) p.protectFor(1e12, now); else p.dropProtection();
  s.onEvent = () => {};
  return { s, p, now };
}
function steerRoute(l, spec, path, options = {}) {
  const { s, p, now } = frozenWorld(l, spec, path[0], options.protectedBody), points = [path[0]];
  const startGems = p.gems, startWidth = p.width, initialClearance = clearance(l, p), minimum = { ...initialClearance };
  let waypoint = 1, tick = 0, travel = 0, last = path[0], maxTickMove = 0;
  const timeout = options.timeout ?? Math.max(45, pathLength(path) / spec.speed * 2 + 10);
  while (tick < timeout * 30 && waypoint < path.length && p.state === 'alive') {
    const x = p.x + p.width / 2, y = p.y + p.height / 2, target = path[waypoint], d = Math.hypot(target.x - x, target.y - y);
    if (d <= 8) { waypoint++; continue; }
    p.steer((target.x - x) / d, (target.y - y) / d);
    tick++; clock = now + tick * 1000 / 30; s.update(DT, clock);
    const here = { x: p.x + p.width / 2, y: p.y + p.height / 2 }, moved = Math.hypot(here.x - last.x, here.y - last.y);
    travel += moved; maxTickMove = Math.max(maxTickMove, moved); last = here;
    const c = clearance(l, p); for (const key of Object.keys(c)) minimum[key] = Math.min(minimum[key], c[key]);
    if (tick % 15 === 0) points.push(here);
  }
  const end = { x: p.x + p.width / 2, y: p.y + p.height / 2 };
  return { arrived: waypoint >= path.length, seconds: tick / 30, routeLength: pathLength(path), traveled: travel,
    straightDistance: Math.hypot(path.at(-1).x - path[0].x, path.at(-1).y - path[0].y), maxTickMove,
    startGems, endGems: p.gems, startWidth, endWidth: p.width, initialClearance, minimumClearance: minimum,
    state: p.state, end, remainingDistance: Math.hypot(path.at(-1).x - end.x, path.at(-1).y - end.y), track: points };
}

const results = process.env.ONLY_ACTUAL ? JSON.parse(fs.readFileSync('.tmp/overall-balance-routes.json', 'utf8'))
  : { commit: '9344b16', specifications, seeds: [], cases: [], actual: [], highResolution: [] };
function save() { fs.writeFileSync('.tmp/overall-balance-routes.json', JSON.stringify(results, null, 2)); }
if (require.main === module && process.argv.includes('--full')) try {
  for (const seed of process.env.ONLY_ACTUAL ? [] : [11, 29, 73]) {
    seedRandom(seed); clock = BASE;
    const s = new GameState(), host = s.addPlayer('host', 'Host', clock); host.isBot = true; s.brains.set('host', new BotBrain());
    const samples = []; let previous = '';
    for (let frame = 0; frame < 180 * 30; frame++) {
      clock = BASE + (frame + 1) * 1000 / 30; s.update(DT, clock);
      const l = layout(s, seed), sig = signature(l);
      if (sig !== previous) { samples.push(l); previous = sig; }
    }
    const row = { seed, topologySamples: samples.length, snapshots: samples, sizes: [] };
    for (const spec of specifications) {
      const intervals = [], selected = { connected: null, blocked: null };
      let worstCenter = 1, worstComponents = 0, disconnectedSeconds = 0, centerOccupiedSeconds = 0, longestBlocked = 0, runStart = null;
      for (let i = 0; i < samples.length; i++) {
        const l = samples[i], until = samples[i + 1]?.seconds ?? 180, g = graph(l, spec.width), a = g.summary;
        const isBlocked = a.nearestCornersConnected < 4;
        if (isBlocked) { disconnectedSeconds += until - l.seconds; runStart ??= l.seconds; }
        else if (runStart !== null) { longestBlocked = Math.max(longestBlocked, l.seconds - runStart); runStart = null; }
        if (!a.exactCenterClear) centerOccupiedSeconds += until - l.seconds;
        worstCenter = Math.min(worstCenter, a.centerRegionShare); worstComponents = Math.max(worstComponents, a.substantialComponents);
        intervals.push({ from: l.seconds, to: until, ...a });
        for (let corner = 0; corner < 4; corner++) {
          if (g.corners[corner].connectsCenter) {
            const path = g.route(g.corners[corner].id, g.center.id); if (!path) continue;
            const length = pathLength(path), straight = Math.hypot(path.at(-1).x - path[0].x, path.at(-1).y - path[0].y), ratio = length / Math.max(1, straight);
            if (!selected.connected || ratio > selected.connected.ratio) selected.connected = { kind: 'connected', seed, spec, l, corner, summary: a, path, ratio };
          } else if (!selected.blocked || a.centerRegionShare < selected.blocked.summary.centerRegionShare) {
            selected.blocked = { kind: 'blocked', seed, spec, l, corner, summary: a, path: [g.point(g.corners[corner].id), g.point(g.center.id)] };
          }
        }
      }
      if (runStart !== null) longestBlocked = Math.max(longestBlocked, 180 - runStart);
      row.sizes.push({ ...spec, disconnectedSeconds, centerOccupiedSeconds, longestBlocked, minimumCenterRegionShare: worstCenter, maximumSubstantialComponents: worstComponents, intervals });
      for (const c of Object.values(selected)) if (c) results.cases.push(c);
      console.log(JSON.stringify({ seed, ...spec, disconnectedSeconds, centerOccupiedSeconds, longestBlocked, worstCenter, worstComponents }));
    }
    results.seeds.push(row); save();
  }
  results.actual = []; results.highResolution = [];
  for (const c of results.cases) {
    if (c.kind === 'blocked') {
      const fine = graph(c.l, c.spec.width, 200, false, .25);
      const finer = graph(c.l, c.spec.width, 300, false, .25);
      const holesOnly = graph(c.l, c.spec.width, 100, true);
      results.highResolution.push({ seed: c.seed, gems: c.spec.gems, seconds: c.l.seconds, fine: fine.summary, finer: finer.summary,
        originalPairAt200: fine.nearest(c.path[0]).component === fine.nearest(c.path[1]).component,
        originalPairAt300: finer.nearest(c.path[0]).component === finer.nearest(c.path[1]).component,
        holesOnly: holesOnly.summary });
      // A direct attempt is deliberately a control, not proof that no clever input can pass.
      const motion = steerRoute(c.l, c.spec, c.path, { timeout: 35 });
      results.actual.push({ seed: c.seed, gems: c.spec.gems, sampleSeconds: c.l.seconds, kind: c.kind, corner: c.corner, ...motion });
    } else {
      const motion = steerRoute(c.l, c.spec, c.path);
      results.actual.push({ seed: c.seed, gems: c.spec.gems, sampleSeconds: c.l.seconds, kind: c.kind, corner: c.corner, detourRatio: c.ratio, ...motion });
    }
    save();
  }
} finally { Math.random = keepRandom; Date.now = keepNow; }
if (require.main === module && process.argv.includes('--full')) console.log('route investigation complete', JSON.stringify({ seeds: results.seeds.length, actualCases: results.actual.length, arrived: results.actual.filter(c => c.arrived).length }));
module.exports = { graph, layout, signature, clearance, obstacles, frozenWorld, steerRoute, specifications, seedRandom, pathLength };

/** Fixed capture reproduces one known temporary full-layout barrier. This is a
 * playtest instrument, not a CI balance assertion: future intentional tuning can
 * change its outcome. Hole phases are held fixed to isolate fan geometry.
 */
function fixedFixture() {
  const fixture = require('../docs/playtests/giant-navigation-fixture.json');
  const spec = fixture.body, l = { seed: fixture.seed, seconds: fixture.worldSeconds, fans: fixture.fans, holes: fixture.blackHoles };
  const runs = [];
  for (const mode of ['all-static', 'only-t1-ends', 'natural-fan-deadlines']) {
    const { s, p, now } = frozenWorld(l, spec, spec.startCenter), target = spec.goalCenter;
    if (p.width !== spec.width) throw new Error(`Fixture width ${spec.width} differs from current compiled growth width ${p.width}; regenerate the comparison explicitly.`);
    if (mode === 'only-t1-ends') s.turbines.find(f => f.id === 't1').phaseEndsAt = fixture.fans.find(f => f.id === 't1').phaseEndsAt;
    if (mode === 'natural-fan-deadlines') for (const f of s.turbines) f.phaseEndsAt = fixture.fans.find(g => g.id === f.id).phaseEndsAt;
    const originalNow = Date.now; let time = now; Date.now = () => time;
    const initial = clearance(l, p), targetClearance = clearance(l, { x: target.x - p.width / 2, y: target.y - p.width / 2, width: p.width, height: p.width });
    const minimum = { ...initial }, transitions = [], track = [];
    const initialGraph = graph(l, p.width, 200, false, .25);
    const a = initialGraph.nearest(spec.startCenter), b = initialGraph.nearest(target);
    let phase = s.turbines.map(f => `${f.id}:${f.phase}`).join('|'), arrival = null, remaining = Infinity;
    let planned = [target], waypoint = 0;
    try {
      for (let tick = 1; tick <= 100 * 30; tick++) {
        const point = { x: p.x + p.width / 2, y: p.y + p.width / 2 };
        let aim = planned[waypoint] ?? target, d = Math.hypot(aim.x - point.x, aim.y - point.y);
        if (d < 7 && waypoint < planned.length - 1) { waypoint++; aim = planned[waypoint]; d = Math.hypot(aim.x - point.x, aim.y - point.y); }
        p.steer((aim.x - point.x) / Math.max(1, d), (aim.y - point.y) / Math.max(1, d));
        time = now + tick * 1000 / 30; s.update(DT, time);
        const currentLayout = { ...l, fans: s.turbines.map(f => ({ id: f.id, x: f.x, y: f.y, intake: f.intake, phase: f.phase })) };
        const here = { x: p.x + p.width / 2, y: p.y + p.width / 2 }, cl = clearance(currentLayout, p);
        remaining = Math.hypot(here.x - target.x, here.y - target.y);
        for (const key of Object.keys(cl)) minimum[key] = Math.min(minimum[key], cl[key]);
        const current = s.turbines.map(f => `${f.id}:${f.phase}`).join('|');
        if (current !== phase) {
          const g = graph(currentLayout, p.width, 200, false, .25), start = g.nearest(here), end = g.nearest(target), route = g.route(start.id, end.id);
          transitions.push({ elapsed: tick / 30, worldSeconds: s.time / 1000, fans: current, body: here, width: p.width,
            remaining, routeExists: !!route, path: route });
          if (route) { planned = route.slice(1); planned.push(target); waypoint = 0; }
          phase = current;
        }
        if (tick % 30 === 0) track.push({ elapsed: tick / 30, worldSeconds: s.time / 1000, ...here, remaining, clearance: cl });
        if (remaining < 8) { arrival = { elapsed: tick / 30, worldSeconds: s.time / 1000, here }; break; }
      }
    } finally { Date.now = originalNow; }
    const result = { mode, initiallyConnected: a.component === b.component, initial, targetClearance,
      arrival, remaining, minimumClearance: minimum, endWidth: p.width, endGems: p.gems, transitions, track };
    runs.push(result);
    console.log(JSON.stringify({ mode, initiallyConnected: result.initiallyConnected, initial, targetClearance, arrival,
      remaining, minimumClearance: minimum, transitions: transitions.map(({ path: route, ...t }) => ({ ...t, routeNodes: route?.length })) }));
  }
  fs.writeFileSync('.tmp/giant-navigation-fixture-results.json', JSON.stringify({ fixture, runs }, null, 2));
}
function fanOpeningFixture() {
  const s = new GameState(0); s.botFill = s.fieldGemTarget = 0;
  s.weaponsOn = s.surgesOn = s.trafficOn = s.trafficHits = false;
  s.setTurbines('off'); s.gems.clear(); s.blackHoles.clear(); s.startedAt = BASE;
  const fan = new TurbineSchema('late', 2100, 2100, 0, 0); s.turbines.push(fan);
  const p = s.addPlayer('giant', 'Giant', BASE); p.setGems(1e9, W, W);
  // Enter the previously selected warning location. This deliberately tests the
  // late-entrant state, rather than bypassing/reinterpreting turbineSpot's guard.
  p.placeAt(2100 - p.width / 2, 2100 - p.height / 2); p.dropProtection();
  let previous = { x: p.x, y: p.y }, peak = { distance: 0 };
  for (let frame = 0; frame <= 91; frame++) {
    s.update(DT, BASE + frame * 1000 / 30);
    const moved = Math.hypot(p.x - previous.x, p.y - previous.y);
    if (moved > peak.distance) peak = { worldMs: s.time, phase: fan.phase, distance: moved, center: { x: p.x + p.width / 2, y: p.y + p.height / 2 } };
    previous = { x: p.x, y: p.y };
  }
  const result = { configuredWarningMs: TURBINE.WARNING_MS, width: p.width, bodyRadius: p.width / 2,
    fullHousingClearance: p.width / 2 + TURBINE.BODY_RADIUS, walkSpeed: moveSpeed(p.width), ordinaryTickTravel: moveSpeed(p.width) / 30,
    walkTravelInWarning: moveSpeed(p.width) * TURBINE.WARNING_MS / 1000, walkTravelIn2_5s: moveSpeed(p.width) * 2.5,
    requiredCenterToClearSeconds: (p.width / 2 + TURBINE.BODY_RADIUS) / moveSpeed(p.width),
    spawnCenterReservation: TURBINE.PLAYER_CLEARANCE + p.width / 2, peak };
  fs.writeFileSync('.tmp/giant-fan-opening-results.json', JSON.stringify(result, null, 2)); console.log(JSON.stringify(result));
}
if (require.main === module && process.argv.includes('--fan-opening')) fanOpeningFixture();
else if (require.main === module && !process.argv.includes('--full')) fixedFixture();
