import { ARENA_RULES, BLACK_HOLE, GEMS, PLAYER_STATE, RELIC, TURBINE } from '../constants/gameConstants.js';
import { arenaClearance, constrainArenaPoint } from '../game/arenaBoundary.js';
import { blackHoleHasRim, blackHoleReservesSpace, slideBlackHoleRims } from '../game/blackHole.js';
import { distanceToSegment } from '../game/geometry.js';
import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { sprayRelicCometGems } from './relicCometGems.js';

const ROUTE_MARGIN = 12;
const HAUL_DISTANCES = [1850, 1725, 1600, 1450];
const HAUL_HEADINGS = 32;
const center = (p: PlayerSchema) => ({ x: p.x + p.width / 2, y: p.y + p.height / 2 });
const giantRadius = (state: GameState) => Math.min(state.worldWidth, state.worldHeight) * GEMS.SIZE_MAX_SHARE / 2;
const routePadding = (state: GameState) => giantRadius(state) + ARENA_RULES.EDGE_MARGIN + ROUTE_MARGIN;
const towOffset = (radius: number) => radius + RELIC.RADIUS + RELIC.TOW_GAP;

/** The carrier needs room past the ring for the cargo trailing behind it. */
function haulEnd(state: GameState, x: number, y: number): { x: number; y: number } {
  const { relayX, relayY } = state.relic;
  const dx = relayX - x, dy = relayY - y, distance = Math.hypot(dx, dy);
  const past = towOffset(giantRadius(state)) / Math.max(1, distance);
  return { x: relayX + dx * past, y: relayY + dy * past };
}

export function enableRelic(state: GameState): void {
  const relic = state.relic;
  relic.relayX = state.worldWidth / 2;
  relic.relayY = state.worldHeight / 2;
  relic.phase = 'waiting';
  relic.availableAt = state.time + RELIC.FIRST_MS;
}

/** Keep the relay and the current verified haul corridor clear of newly placed hazards. */
export function relicReservesHazard(state: GameState, x: number, y: number, hazardRadius: number): boolean {
  const relic = state.relic;
  if (relic.phase === 'disabled' || (relic.phase === 'waiting' && !hasEligibleCarrier(state))) return false;
  const clearance = routePadding(state) + hazardRadius;
  if (Math.hypot(x - relic.relayX, y - relic.relayY) < clearance + RELIC.RELAY_RADIUS / 2) return true;
  if (relic.phase !== 'available' && relic.phase !== 'towed') return false;
  const end = haulEnd(state, relic.routeX, relic.routeY);
  return distanceToSegment(x, y, relic.routeX, relic.routeY, end.x, end.y) < clearance;
}

/** A straight legal route for the largest carrier, across the combined fan/hole layout. */
function routeClear(state: GameState, x: number, y: number): boolean {
  const end = haulEnd(state, x, y);
  const padding = routePadding(state);
  if (state.layout || arenaClearance(x, y, state.worldWidth, state.worldHeight) < padding ||
    arenaClearance(end.x, end.y, state.worldWidth, state.worldHeight) < padding) return false;
  return state.turbines.every(fan => distanceToSegment(fan.x, fan.y, x, y, end.x, end.y) >= padding + TURBINE.BODY_RADIUS) &&
    state.blackHoles.every(hole => !blackHoleReservesSpace(hole) ||
      distanceToSegment(hole.x, hole.y, x, y, end.x, end.y) >= padding + hole.radius + BLACK_HOLE.RIM_CLEARANCE);
}

function available(state: GameState, x: number, y: number, unclaimedMs: number = RELIC.UNCLAIMED_MS): void {
  const relic = state.relic;
  relic.x = relic.routeX = x;
  relic.y = relic.routeY = y;
  relic.phase = 'available';
  relic.carrierId = '';
  relic.availableAt = 0;
  relic.expiresAt = state.time + unclaimedMs;
  relic.pausedUnclaimedMs = 0;
}

/** Used only by the guarded private test-room fixture. */
export function placeRelicForTest(state: GameState, x: number, y: number, relayX: number, relayY: number): boolean {
  if (state.relic.phase === 'disabled' || ![x, y, relayX, relayY].every(Number.isFinite) ||
    arenaClearance(x, y, state.worldWidth, state.worldHeight) < RELIC.RADIUS ||
    arenaClearance(relayX, relayY, state.worldWidth, state.worldHeight) < RELIC.RELAY_RADIUS ||
    !state.isFloorAt(x, y) || !state.isFloorAt(relayX, relayY)) return false;
  state.relic.relayX = relayX;
  state.relic.relayY = relayY;
  available(state, x, y);
  return true;
}

function waitForRelic(state: GameState, delay: number): void {
  const relic = state.relic;
  relic.carrierId = '';
  relic.phase = 'waiting';
  relic.availableAt = state.time + delay;
  relic.expiresAt = 0;
  relic.pausedUnclaimedMs = 0;
}

export function dropRelic(state: GameState, carrierId: string): void {
  const relic = state.relic;
  if (relic.phase !== 'towed' || relic.carrierId !== carrierId) return;
  const drop = { x: relic.x, y: relic.y };
  if (!routeClear(state, drop.x, drop.y)) {
    // Towed cargo fits nearer the wall than the largest giant can stand. Try just inside its route inset.
    constrainArenaPoint(drop, state.worldWidth, state.worldHeight, routePadding(state) + 1);
    if (!routeClear(state, drop.x, drop.y)) {
      // The original haul corridor was reserved while this relic was carried.
      drop.x = relic.routeX;
      drop.y = relic.routeY;
      if (!routeClear(state, drop.x, drop.y)) {
        waitForRelic(state, RELIC.RESPAWN_MS);
        return;
      }
    }
  }
  available(state, drop.x, drop.y, relic.pausedUnclaimedMs);
}

function canHaul(state: GameState, player: PlayerSchema): boolean {
  return !player.isBot && !player.relicCometReady && player.width >= RELIC.MIN_WIDTH && player.state === PLAYER_STATE.ALIVE &&
    !player.spawnProtected && !player.flying && !player.capturedBy && !player.breathingBlocked && state.time >= player.injuredUntil;
}

function hasEligibleCarrier(state: GameState): boolean {
  for (const player of state.players.values()) if (canHaul(state, player)) return true;
  return false;
}

function moveCargo(state: GameState, carrier: PlayerSchema, deltaTime: number): void {
  const relic = state.relic, at = center(carrier), radius = RELIC.RADIUS, offset = towOffset(carrier.width / 2);
  const desired = { x: at.x - Math.cos(carrier.facing) * offset, y: at.y - Math.sin(carrier.facing) * offset };
  constrainArenaPoint(desired, state.worldWidth, state.worldHeight, radius);
  const dx = desired.x - relic.x, dy = desired.y - relic.y;
  const fraction = Math.min(1, RELIC.TOW_SPEED * Math.min(.1, Math.max(0, deltaTime)) / Math.max(1e-6, Math.hypot(dx, dy)));
  const next = { x: relic.x + dx * fraction - radius, y: relic.y + dy * fraction - radius, width: radius * 2, height: radius * 2 };
  const hazards = [...state.blackHoles.filter(blackHoleHasRim),
    ...state.turbines.filter(fan => fan.phase !== 'warning').map(fan => ({ x: fan.x, y: fan.y, radius: TURBINE.BODY_RADIUS }))];
  const routed = slideBlackHoleRims(next, relic.x - radius, relic.y - radius, hazards, state.worldWidth, state.worldHeight, deltaTime);
  relic.x = routed.x + radius;
  relic.y = routed.y + radius;
}

function updateHaul(state: GameState, deltaTime: number): void {
  const relic = state.relic;
  if (relic.phase === 'disabled') return;
  if (relic.phase === 'waiting') {
    if (state.time < relic.availableAt || !hasEligibleCarrier(state)) return;
    const start = Math.floor(Math.random() * HAUL_HEADINGS);
    // Rotate the search order while retaining the exact diagonals needed for the longest hauls.
    for (const distance of HAUL_DISTANCES) for (let i = 0; i < HAUL_HEADINGS; i++) {
      const direction = (start + i) * 2 * Math.PI / HAUL_HEADINGS;
      const x = Math.round(relic.relayX + Math.cos(direction) * distance);
      const y = Math.round(relic.relayY + Math.sin(direction) * distance);
      if (routeClear(state, x, y)) { available(state, x, y); return; }
    }
    relic.availableAt = state.time + RELIC.RETRY_MS;
    return;
  }
  if (relic.phase === 'available') {
    if (state.time >= relic.expiresAt) {
      waitForRelic(state, RELIC.RESPAWN_MS);
      return;
    }
    if (!state.isFloorAt(relic.x, relic.y) || !state.isFloorAt(relic.relayX, relic.relayY)) {
      waitForRelic(state, RELIC.RESPAWN_MS);
      return;
    }
    let nearest = Infinity;
    for (const player of state.players.values()) {
      if (!canHaul(state, player)) continue;
      const at = center(player), gap = Math.hypot(relic.x - at.x, relic.y - at.y) - player.width / 2;
      if (gap <= RELIC.RADIUS && gap < nearest) { nearest = gap; relic.carrierId = player.sessionId; }
    }
    if (!relic.carrierId) return;
    relic.pausedUnclaimedMs = relic.expiresAt - state.time;
    relic.expiresAt = 0;
    relic.phase = 'towed';
  }
  const carrier = state.players.get(relic.carrierId);
  if (!carrier || !canHaul(state, carrier)) { dropRelic(state, relic.carrierId); return; }
  moveCargo(state, carrier, deltaTime);
  if (state.isFloorAt(relic.relayX, relic.relayY) &&
    Math.hypot(relic.x - relic.relayX, relic.y - relic.relayY) <= RELIC.RELAY_RADIUS - RELIC.RADIUS) {
    carrier.relicCometReady = true;
    waitForRelic(state, RELIC.RESPAWN_MS);
  }
}

type FireResult = { ok: true } | { ok: false; reason: 'unavailable' | 'not-ready' | 'blocked' | 'busy' | 'invalid-target' };

export function fireRelicComet(state: GameState, player: PlayerSchema | undefined, x: unknown, y: unknown): FireResult {
  if (state.relic.phase === 'disabled') return { ok: false, reason: 'unavailable' };
  if (!player?.relicCometReady) return { ok: false, reason: 'not-ready' };
  if (player.state !== PLAYER_STATE.ALIVE || player.flying || player.capturedBy || player.stunned || player.sliding ||
    player.recovering || player.spawnProtected || state.shiftPhase === 'grace') return { ok: false, reason: 'blocked' };
  const comet = state.relicComet;
  if (comet.phase !== 'idle') return { ok: false, reason: 'busy' };
  if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y) || !state.isFloorAt(x, y)) {
    return { ok: false, reason: 'invalid-target' };
  }
  player.relicCometReady = false;
  comet.id++;
  comet.x = x;
  comet.y = y;
  comet.ownerId = player.sessionId;
  comet.impactAt = state.time + RELIC.WARNING_MS;
  comet.phase = 'inbound';
  return { ok: true };
}

function updateComet(state: GameState, now: number): void {
  const comet = state.relicComet;
  if (comet.phase === 'impact') {
    if (state.time >= comet.impactAt + RELIC.IMPACT_VISIBLE_MS) comet.phase = 'idle';
    return;
  }
  if (comet.phase !== 'inbound' || state.time < comet.impactAt) return;
  comet.phase = 'impact';
  if (state.shiftPhase === 'grace') return;
  for (const target of state.players.values()) {
    // A target recovering from traffic cannot steer out of the short warning.
    if (target.sessionId === comet.ownerId || target.state !== PLAYER_STATE.ALIVE || target.isSafe() ||
      target.flying || target.capturedBy || state.time < target.launchSafeUntil) continue;
    const { x, y } = center(target), dx = x - comet.x, dy = y - comet.y, distance = Math.hypot(dx, dy);
    if (distance > RELIC.OUTER_RADIUS || !state.isFloorAt(x, y)) continue;
    const push = RELIC.SHOVE_SPEED / Math.max(1, Math.sqrt(target.width / RELIC.MIN_WIDTH));
    if (distance < RELIC.INNER_RADIUS) {
      const share = distance <= RELIC.GRAZE_RADIUS
        ? RELIC.DAMAGE_SHARE - (RELIC.DAMAGE_SHARE - RELIC.GRAZE_DAMAGE_SHARE) *
          Math.max(0, distance - RELIC.DIRECT_RADIUS) / (RELIC.GRAZE_RADIUS - RELIC.DIRECT_RADIUS)
        : RELIC.GRAZE_DAMAGE_SHARE * (RELIC.INNER_RADIUS - distance) / (RELIC.INNER_RADIUS - RELIC.GRAZE_RADIUS);
      const lost = Math.min(target.gems - 1, Math.round(target.gems * share));
      if (lost > 0 && sprayRelicCometGems(state, target, x, y, lost, now, target.widthAfterLosingGems(lost))) {
        target.injure(state.time);
        target.setGems(target.gems - lost, state.worldWidth, state.worldHeight);
        state.credit(target, 'relicComet', now, comet.ownerId, { gems: lost, out: false, x, y, size: target.width });
      }
    }
    target.pushWithControl(distance ? dx / distance : Math.cos(target.facing), distance ? dy / distance : Math.sin(target.facing), push);
  }
}

export function updateRelic(state: GameState, now: number, deltaTime: number): void {
  updateComet(state, now);
  updateHaul(state, deltaTime);
}
