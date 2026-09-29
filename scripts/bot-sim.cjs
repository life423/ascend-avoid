// Runs the real server world for a few simulated minutes (in a second or two) and reports how
// the bots fare: how often they get hit, and how many gems they gather, next to a player who
// stands still. Handy when tuning BOTS. Run with: npm run sim:bots [seconds]
const { GameState } = require('../server/dist/schema/GameState.js');
const SECONDS = Number(process.argv[2] || 300);
const state = new GameState();
let now = 1e9;
const host = state.addPlayer('host', 'Host', now); // a person must be present for bots to fill in
host.protectFor(1e15, now);
host.placeAt(20, 20);
const idle = state.addPlayer('idle', 'Idle', now); // stands still the whole time, for comparison
const stats = new Map();
const last = new Map();
for (let i = 0; i < SECONDS * 30; i++) {
  now += 1000 / 30;
  state.update(1 / 30, now);
  state.players.forEach((p, id) => {
    if (id === 'host') return;
    const s = stats.get(id) || { name: p.name + (p.isBot ? '' : ' (idle)'), hits: 0, knockouts: 0, shiftHits: 0, mostGems: 0, gems: 0 };
    const hit = (p.recovering && !(last.get(id) || {}).recovering) || (p.state !== 'alive' && (last.get(id) || { alive: true }).alive);
    if (hit && state.shiftPhase === 'shift') s.shiftHits++;
    const b = last.get(id) || { alive: true, recovering: false };
    if (p.recovering && !b.recovering) s.hits++;
    if (p.state !== 'alive' && b.alive) s.knockouts++;
    s.mostGems = Math.max(s.mostGems, p.gems);
    s.gems = p.gems;
    stats.set(id, s);
    last.set(id, { alive: p.state === 'alive', recovering: p.recovering });
  });
}
const perMin = (n) => (n / (SECONDS / 60)).toFixed(1).padStart(4);
const shiftSeconds = Math.max(1, Math.floor((SECONDS - 98) / 203) + (SECONDS > 98 ? 1 : 0)) * 45;
for (const s of stats.values()) {
  const normalPerMin = ((s.hits + s.knockouts - s.shiftHits) / ((SECONDS - shiftSeconds) / 60)).toFixed(1).padStart(4);
  const shiftPerMin = (s.shiftHits / (shiftSeconds / 60)).toFixed(1).padStart(4);
  console.log(`${s.name.padEnd(12)} hits/min normally ${normalPerMin}, during shifts ${shiftPerMin}  most gems ${String(s.mostGems).padStart(3)}  at the end ${s.gems}`);
}
