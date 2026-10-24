// Runs the real server world headless and measures how the bots spread out: nearest-neighbour distance, the
// worst clump (bots within 300 of one bot), how many bots are after the same creature, and how many pairs are
// inhaling head-on at each other, plus captures and launches. Handy when tuning BOTS. Run with: npm run sim:crowd [seconds]
const { GameState } = require("../server/dist/schema/GameState.js");
const SECONDS = Number(process.argv[2] || 180);
const state = new GameState();
let now = 1e9;
const host = state.addPlayer('host', 'Host', now);
host.protectFor(1e15, now);
host.placeAt(20, 20);
let samples = 0, nnSum = 0, clumpMax = 0, clumpSum = 0, sharedSum = 0, huntingSum = 0, mutualSum = 0;
let captures = 0, launches = 0;
const wasCaptured = new Map(), wasFlying = new Map();
const dist = (a, b) => Math.hypot(a.x + a.width / 2 - b.x - b.width / 2, a.y + a.height / 2 - b.y - b.height / 2);
for (let i = 0; i < SECONDS * 30; i++) {
  now += 1000 / 30;
  state.update(1 / 30, now);
  state.players.forEach((p, id) => {
    if (p.capturedBy && !wasCaptured.get(id)) captures++;
    wasCaptured.set(id, Boolean(p.capturedBy));
    if (p.flying && !wasFlying.get(id)) launches++;
    wasFlying.set(id, p.flying);
  });
  if (i % 15 !== 0 || i < 30 * 20) continue;
  const bots = [];
  state.players.forEach((p) => { if (p.isBot && p.state === 'alive') bots.push(p); });
  if (bots.length < 2) continue;
  let nn = 0, worst = 0;
  for (const a of bots) {
    let best = Infinity, c = 0;
    for (const b of bots) {
      if (b === a) continue;
      const d = dist(a, b);
      best = Math.min(best, d);
      if (d < 300) c++;
    }
    nn += best;
    worst = Math.max(worst, c);
  }
  nnSum += nn / bots.length;
  clumpSum += worst;
  clumpMax = Math.max(clumpMax, worst);
  const victims = new Map();
  let hunting = 0;
  state.brains.forEach((brain) => {
    if (!brain.victim) return;
    hunting++;
    victims.set(brain.victim.sessionId, (victims.get(brain.victim.sessionId) || 0) + 1);
  });
  let shared = 0;
  victims.forEach((n) => { if (n > 1) shared += n; });
  sharedSum += shared;
  huntingSum += hunting;
  let mutual = 0;
  state.players.forEach((a) => {
    if (!a.inhaling) return;
    for (const id of a.robbing.split(',')) {
      const b = state.players.get(id);
      if (b && b.inhaling && b.robbing.split(',').includes(a.sessionId)) mutual++;
    }
  });
  mutualSum += mutual / 2;
  samples++;
}
console.log(JSON.stringify({ seconds: SECONDS, bots: state.brains.size, meanNearestNeighbour: Math.round(nnSum / samples), meanWorstClumpWithin300: (clumpSum / samples).toFixed(1), maxClump: clumpMax, meanBotsHunting: (huntingSum / samples).toFixed(1), meanBotsSharingAVictim: (sharedSum / samples).toFixed(1), mutualInhalePairs: (mutualSum / samples).toFixed(2), captures, launches }));
