import type { GameState } from "../schema/GameState.js";
import { PlayerSchema } from "../schema/PlayerSchema.js";
import { GemSchema } from "../schema/GemSchema.js";
import { GAME_CONSTANTS } from "../constants/serverConstants.js";
import { randomFloorPoint } from '../game/layouts.js';

const { GEMS, PLAYER_STATE, SHIFT } = GAME_CONSTANTS;

/**
 * The jackpot goes to whoever stands on it alone for JACKPOT_CLAIM_MS. A shove starts their
 * claim over, and while two or more are on it, nobody's claim moves.
 */
export function updateJackpot(state: GameState, deltaTime: number) : void {
  if (!state.jackpotOn || state.time < state.jackpotLandsAt) return;
  const on: PlayerSchema[] = [];
  state.players.forEach((player) => {
    if (player.state !== PLAYER_STATE.ALIVE || player.capturedBy || player.flying || player.stunned || player.sliding) return;
    const box = player.hitBox();
    const dx = Math.max(box.x - state.jackpotX, 0, state.jackpotX - (box.x + box.width));
    const dy = Math.max(box.y - state.jackpotY, 0, state.jackpotY - (box.y + box.height));
    if (Math.hypot(dx, dy) <= SHIFT.JACKPOT_RADIUS) on.push(player);
  });
  if (on.length === 0) {
    if (state.jackpotHolder) state.jackpotHolder = "";
    if (state.jackpotProgress) state.jackpotProgress = 0;
    return;
  }
  if (on.length > 1) return;
  const claimant = on[0];
  if (claimant.sessionId !== state.jackpotHolder || claimant.sliding) {
    state.jackpotHolder = claimant.sessionId;
    state.jackpotProgress = 0;
    if (claimant.sliding) return;
  }
  state.jackpotProgress = Math.min(1, state.jackpotProgress + (deltaTime * 1000) / SHIFT.JACKPOT_CLAIM_MS);
  if (state.jackpotProgress < 1) return;
  claimant.setGems(claimant.gems + SHIFT.JACKPOT_VALUE, state.worldWidth, state.worldHeight);
  state.jackpotOn = false;
  state.onEvent?.("jackpot", { byId: claimant.sessionId, by: claimant.name, value: SHIFT.JACKPOT_VALUE });
}

/** Replenish outside every live pickup box, so a stationary giant cannot farm fresh spawns underneath it. */
export function topUpField(state: GameState, initial = false) : void {
  const elapsed = Math.max(0, state.time - state.fieldReplenishAt) / 1000;
  state.fieldReplenishAt = state.time;
  state.fieldReplenishCredit = Math.min(GEMS.FIELD_REPLENISH_PER_S, state.fieldReplenishCredit + elapsed * GEMS.FIELD_REPLENISH_PER_S);
  if (state.fieldGems >= state.fieldGemTarget || state.gems.size >= GEMS.MAX_GEMS) return;
  if (!initial && state.fieldReplenishCredit < 1) return;
  const spacing = GEMS.FIELD_SPACING, grid = new Map<string, Point[]>();
  const bodies = [...state.players.values()].filter(p => p.state === PLAYER_STATE.ALIVE && !p.capturedBy);
  for (const gem of state.gems.values()) addPoint(grid, gem, spacing);
  while (state.fieldGems < state.fieldGemTarget && state.gems.size < GEMS.MAX_GEMS && (initial || state.fieldReplenishCredit >= 1)) {
    let best: Point | null = null, clearance = -1;
    for (let attempt = 0; attempt < 64; attempt++) {
      const p = state.shiftPhase === 'shift' && state.layout ? randomFloorPoint(state.layout) : { x: 40 + Math.random() * (state.worldWidth - 80), y: 40 + Math.random() * (state.worldHeight - 80) };
      const padding = GEMS.RADIUS + 8;
      if (bodies.some(body => p.x > body.x - padding && p.x < body.x + body.width + padding && p.y > body.y - padding && p.y < body.y + body.height + padding)) continue;
      const distance = Math.min(spacing, ...nearPoints(grid, p, spacing).map(q => Math.hypot(p.x - q.x, p.y - q.y)));
      if (distance > clearance) { best = p; clearance = distance; }
      if (distance >= spacing) break;
    }
    // A crowded map may temporarily have fewer field gems; never fall back inside a pickup box.
    if (!best) break;
    state.addGem(best.x, best.y); addPoint(grid, best, spacing);
    if (!initial) state.fieldReplenishCredit--;
  }
  if (initial && state.fieldGems > 0) state.fieldReplenishCredit = 0;
}

interface Point { x: number; y: number }
function addPoint<T extends Point>(grid: Map<string, T[]>, p: T, cell: number): void {
  const key = `${Math.floor(p.x / cell)}:${Math.floor(p.y / cell)}`;
  const bucket = grid.get(key);
  if (bucket) bucket.push(p); else grid.set(key, [p]);
}
function nearPoints<T extends Point>(grid: Map<string, T[]>, p: Point, cell: number): T[] {
  const x = Math.floor(p.x / cell), y = Math.floor(p.y / cell), result: T[] = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) result.push(...(grid.get(`${x + dx}:${y + dy}`) ?? []));
  return result;
}

/** A cheap spatial pass gently opens up settled piles; airborne drops and live sprays retain their paths. */
export function spreadSettledGems(state: GameState): void {
  const spacing = GEMS.SETTLED_SPACING;
  const points = [...state.gems.values()].filter(g => g.settled()).map((gem, order) => ({ x: gem.x, y: gem.y, gem, order, pushX: 0, pushY: 0 }));
  const grid = new Map<string, typeof points>();
  for (const p of points) addPoint(grid, p, spacing);
  for (const p of points) for (const other of nearPoints(grid, p, spacing)) {
    if (other.order <= p.order) continue;
    const dx = p.x - other.x, dy = p.y - other.y, d = Math.hypot(dx, dy);
    if (d >= spacing) continue;
    const angle = (p.order + other.order * 7) * 2.399963;
    const ux = d > 0 ? dx / d : Math.cos(angle), uy = d > 0 ? dy / d : Math.sin(angle);
    const force = Math.min(100, Math.max(18, (spacing - d) * 4));
    p.pushX += ux * force; p.pushY += uy * force;
    other.pushX -= ux * force; other.pushY -= uy * force;
  }
  for (const p of points) {
    const speed = Math.hypot(p.pushX, p.pushY);
    if (speed > 0) p.gem.blow(Math.atan2(p.pushY, p.pushX), Math.min(120, speed));
  }
}

/** Pick up every gem the player is touching */
export function collectGems(state: GameState, player: PlayerSchema, now: number, fromX = player.x, fromY = player.y) : void {
  // Everything the player passed over this tick counts, so a skid can't skip a gem
  // (unless they were moved somewhere else entirely, like a respawn)
  const moved = Math.hypot(player.x - fromX, player.y - fromY);
  const path = moved > 300
    ? player
    : {
        x: Math.min(fromX, player.x),
        y: Math.min(fromY, player.y),
        width: player.width + Math.abs(player.x - fromX),
        height: player.height + Math.abs(player.y - fromY),
      };
  let collected = 0;
  const taken: string[] = [];
  state.gems.forEach((gem, id) => {
    if (!gem.touches(path, now, player.sessionId)) return;
    collected += gem.value;
    taken.push(id);
    if (!gem.sprayed) state.fieldGems--;
  });
  if (collected === 0) return;
  taken.forEach((id) => state.gems.delete(id));
  player.setGems(player.gems + collected, state.worldWidth, state.worldHeight);
}

/** Burst gems outward from a point, spread around the circle; big piles make bigger gems */
export function sprayGems(state: GameState, centerX: number, centerY: number, total: number, now: number, owner = "", ownerDelayMs: number = GEMS.OWNER_PICKUP_DELAY_MS) : void {
  // Browsers draw a burst for anything more than a gem or two
  if (total >= 3) state.onEvent?.("burst", { x: Math.round(centerX), y: Math.round(centerY), count: total });
  const room = Math.max(1, GEMS.MAX_GEMS - state.gems.size);
  const pieces = Math.min(total, GEMS.SPRAY_PIECES, room);
  const turn = Math.random() * Math.PI * 2;
  for (let i = 0; i < pieces; i++) {
    const value = Math.floor(total / pieces) + (i < total % pieces ? 1 : 0);
    const gem = new GemSchema(centerX, centerY, value);
    const angle = turn + (i / pieces) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
    const speed = GEMS.SPRAY_SPEED_MIN + Math.random() * (GEMS.SPRAY_SPEED_MAX - GEMS.SPRAY_SPEED_MIN);
    gem.spray(angle, speed, now, owner, ownerDelayMs);
    state.gems.set(`g${state.nextGemId++}`, gem);
  }
}
