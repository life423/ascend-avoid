import type { GameState } from '../schema/GameState.js';
import type { GemSchema } from '../schema/GemSchema.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { INHALE, PLAYER_STATE, WORLD } from '../constants/gameConstants.js';
import { viewShort } from './camera.js';
import { randomFloorPoint } from './layouts.js';
import { clearanceAt } from '../systems/turbines.js';
import { arenaContains } from './arenaBoundary.js';
import { airflowQuality } from './airflow.js';
import { canCatch } from './cannon.js';
export const SPAWN_RETRY_MS = 250;
const ESCAPE_DISTANCE = 180;
const OPENING = {
  GEM_RANGE: 260,
  GEM_LIMIT: 3,
  PEER_RANGE: 960,
  PATH_STEP: 120,
  CLEARANCE_TRADE: 90,
  MIN_GAIN: .05,
} as const;
interface Candidate { x: number; y: number; score: number }

/** Two separated, walkable exits; clearance is measured along each route, not just at its end. */
export function hasEscapeRoutes(state: GameState, player: PlayerSchema, x: number, y: number): boolean {
  const centre = { x: x + player.width / 2, y: y + player.width / 2 }, open: number[] = [];
  for (let dir = 0; dir < 8; dir++) {
    const a = dir * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a);
    if ([.33, .67, 1].every(t => {
      const cx = centre.x + dx * ESCAPE_DISTANCE * t, cy = centre.y + dy * ESCAPE_DISTANCE * t, r = player.width / 2 + 8;
      return cx >= r && cy >= r && cx <= state.worldWidth - r && cy <= state.worldHeight - r && arenaContains({ x: cx - player.width / 2, y: cy - player.width / 2, width: player.width, height: player.width }, state.worldWidth, state.worldHeight) && state.isFloorAt(cx, cy) && clearanceAt(state, cx, cy, player, null) > 24;
    }))
      open.push(dir);
  }
  return open.some(a => open.some(b => { const gap = Math.min(Math.abs(a - b), 8 - Math.abs(a - b)); return gap >= 2; }));
}

/** Sample a short walk to a pickup or an encounter, using the same safety checks as the exits. */
function accessible(state: GameState, player: PlayerSchema, x: number, y: number, dx: number, dy: number): boolean {
  const radius = player.width / 2;
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / OPENING.PATH_STEP));
  for (let step = 1; step <= steps; step++) {
    const cx = x + dx * step / steps, cy = y + dy * step / steps;
    if (!state.isFloorAt(cx, cy) || !arenaContains({ x: cx - radius, y: cy - radius, width: player.width, height: player.width }, state.worldWidth, state.worldHeight)
      || clearanceAt(state, cx, cy, player, null) <= 24) return false;
  }
  return true;
}

function openingQuality(state: GameState, player: PlayerSchema, candidate: Candidate, gems: GemSchema[], others: PlayerSchema[]): { score: number; risk: number } {
  const radius = player.width / 2, x = candidate.x + radius, y = candidate.y + radius;
  const nearbyGems = [];
  for (const gem of gems) {
    const dx = gem.x - x, dy = gem.y - y, square = dx * dx + dy * dy;
    if (square < OPENING.GEM_RANGE ** 2) nearbyGems.push({ dx, dy, distance: Math.sqrt(square) });
  }
  nearbyGems.sort((a, b) => a.distance - b.distance);
  let loot = 0, reached = 0;
  for (const gem of nearbyGems) {
    if (!accessible(state, player, x, y, gem.dx, gem.dy)) continue;
    loot += (1 - gem.distance / OPENING.GEM_RANGE) / OPENING.GEM_LIMIT;
    if (++reached === OPENING.GEM_LIMIT) break;
  }

  let peer = 0, risk = 0;
  for (const other of others) {
    const dx = other.x + other.width / 2 - x, dy = other.y + other.width / 2 - y;
    const distance = Math.hypot(dx, dy), gap = Math.max(0, distance - radius - other.width / 2);
    if (canCatch(other.width, player.width)) {
      if (other.breathingBlocked || other.gulping) continue;
      const reach = INHALE.REACH + (INHALE.REACH_PER_SIZE - .2) * other.width;
      const nearby = .5 * Math.max(0, 1 - 2 * gap / reach);
      const aimed = airflowQuality(state.mouthed(other), { x, y, width: player.width });
      risk = Math.max(risk, nearby, aimed > 0 ? .5 + .5 * aimed : 0);
    } else if (!other.spawnProtected && !canCatch(player.width, other.width)) {
      const quality = 1 - gap / OPENING.PEER_RANGE;
      // Reach an open spot near the rival without treating its solid body as an obstruction.
      const approach = Math.max(0, gap - 64) / Math.max(1, distance);
      if (quality > peer && accessible(state, player, x, y, dx * approach, dy * approach)) peer = quality;
    }
  }
  return { score: .6 * loot + .25 * peer - .75 * risk, risk };
}

function preferOpeningCandidate(state: GameState, player: PlayerSchema, safest: Candidate, candidates: Candidate[]): Candidate {
  const gems = [...state.gems.values()].filter(gem => !gem.sprayed && !gem.locked && gem.settled());
  const others = [...state.players.values()].filter(other => other !== player && other.state === PLAYER_STATE.ALIVE && !other.capturedBy && !other.flying);
  const baseline = openingQuality(state, player, safest, gems, others);
  // Near the existing safety floor, only trade a small amount of clearance. Beyond it,
  // additional clearance is less valuable than reachable first moves.
  const minimum = Math.max(WORLD.SPAWN_CLEARANCE, Math.min(safest.score - OPENING.CLEARANCE_TRADE, WORLD.SPAWN_CLEARANCE + OPENING.CLEARANCE_TRADE));
  let best = safest, score = baseline.score + OPENING.MIN_GAIN;
  for (const candidate of candidates) {
    if (candidate.score < minimum) break;
    if (candidate === safest) continue;
    const opening = openingQuality(state, player, candidate, gems, others);
    if (opening.risk > baseline.risk || opening.score <= score) continue;
    if (!hasEscapeRoutes(state, player, candidate.x, candidate.y)) continue;
    best = candidate; score = opening.score;
  }
  return best;
}

export function chooseSpawn(state: GameState, player: PlayerSchema, preferOpening = false): {
  x: number;
  y: number;
} | null {
  const size = player.width, halfView = viewShort(20) * WORLD.MAX_VIEW_ASPECT / 2 + 120;
  const mx = Math.min(halfView, (state.worldWidth - size) / 3), my = Math.min(halfView, (state.worldHeight - size) / 3), leader = state.leader();
  const candidates: Candidate[] = [];
  const add = (x: number, y: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (!arenaContains({ x, y, width: size, height: size }, state.worldWidth, state.worldHeight) || !state.isFloorAt(x + size / 2, y + size / 2))
      return;
    candidates.push({ x, y, score: clearanceAt(state, x + size / 2, y + size / 2, player, leader) });
  };
  for (let i = 0; i < 24; i++) {
    const floor = state.layout ? randomFloorPoint(state.layout, size / 2 + 10) : null;
    add(floor ? floor.x - size / 2 : mx + Math.random() * (state.worldWidth - size - 2 * mx), floor ? floor.y - size / 2 : my + Math.random() * (state.worldHeight - size - 2 * my));
  }
  // Always score the deterministic interior grid, even if an early random candidate looked adequate.
  for (let row = 0; row < 5; row++)
    for (let col = 0; col < 5; col++)
      add(mx + col / 4 * (state.worldWidth - size - 2 * mx), my + row / 4 * (state.worldHeight - size - 2 * my));
  const safest = () => {
    candidates.sort((a, b) => b.score - a.score);
    return candidates.find(p => p.score >= WORLD.SPAWN_CLEARANCE && hasEscapeRoutes(state, player, p.x, p.y)) ?? null;
  };
  let best = safest();
  if (!best) {
    // The camera already supports off-centre boundary views. Expand the search, keeping two exits.
    const margin = 60;
    for (let row = 0; row < 7; row++)
      for (let col = 0; col < 7; col++)
        add(margin + col / 6 * (state.worldWidth - size - 2 * margin), margin + row / 6 * (state.worldHeight - size - 2 * margin));
    best = safest();
  }
  if (best && preferOpening) best = preferOpeningCandidate(state, player, best, candidates);
  return best ? { x: best.x, y: best.y } : null;
}
