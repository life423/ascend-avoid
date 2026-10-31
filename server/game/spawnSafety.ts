import type { GameState } from '../schema/GameState.js';
import type { PlayerSchema } from '../schema/PlayerSchema.js';
import { WORLD } from '../constants/gameConstants.js';
import { viewShort } from './camera.js';
import { randomFloorPoint } from './layouts.js';
import { clearanceAt } from '../systems/turbines.js';
export const SPAWN_RETRY_MS = 250;
const ESCAPE_DISTANCE = 180;
/** Two separated, walkable exits; clearance is measured along each route, not just at its end. */
export function hasEscapeRoutes(state: GameState, player: PlayerSchema, x: number, y: number): boolean {
  const centre = { x: x + player.width / 2, y: y + player.width / 2 }, open: number[] = [];
  for (let dir = 0; dir < 8; dir++) {
    const a = dir * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a);
    if ([.33, .67, 1].every(t => {
      const cx = centre.x + dx * ESCAPE_DISTANCE * t, cy = centre.y + dy * ESCAPE_DISTANCE * t, r = player.width / 2 + 8;
      return cx >= r && cy >= r && cx <= state.worldWidth - r && cy <= state.worldHeight - r && state.isFloorAt(cx, cy) && clearanceAt(state, cx, cy, player, null) > 24;
    }))
      open.push(dir);
  }
  return open.some(a => open.some(b => { const gap = Math.min(Math.abs(a - b), 8 - Math.abs(a - b)); return gap >= 2; }));
}
export function chooseSpawn(state: GameState, player: PlayerSchema): {
  x: number;
  y: number;
} | null {
  const size = player.width, halfView = viewShort(20) * WORLD.MAX_VIEW_ASPECT / 2 + 120;
  const mx = Math.min(halfView, (state.worldWidth - size) / 3), my = Math.min(halfView, (state.worldHeight - size) / 3), leader = state.leader();
  const candidates: {
    x: number;
    y: number;
    score: number;
  }[] = [];
  const add = (x: number, y: number) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 8 || y < 8 || x + size > state.worldWidth - 8 || y + size > state.worldHeight - 8 || !state.isFloorAt(x + size / 2, y + size / 2))
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
  return best ? { x: best.x, y: best.y } : null;
}
