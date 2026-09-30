import { isFloor, TILE } from "./layouts.js";
import type { Layout } from "./layouts.js";
import type { Box } from "./movement.js";

/**
 * Tunnels: blocks of rock with passages carved through that only small players fit. Each is a
 * branching tunnel with three entrances: a main passage straight across (two main entrances) and
 * a narrow branch off its middle. Big players can't get in at all, so a tunnel is a refuge. The
 * roof is see-through, so everyone can watch who's underground. Underground you can't collect
 * gems or claim the jackpot, and the void can't reach you. During an arena shift, entrances onto
 * ground that drops away close until the arena returns; every tunnel always keeps two ways out.
 * Shared by the server and the browser, so movement prediction hits the same walls.
 */
export const TUNNEL = {
  SIZE: 420, // a tunnel block is 2 x 2 arena tiles
  MAIN: 56, // main passages fit players up to about size 55 (about 34 gems)...
  NARROW: 38, // ...narrow ones only the smallest (up to about 8 gems)
  GATE: 20, // how thick a closed entrance's seal is
  OUTSIDE: 105, // how far outside an entrance its ground is checked (half a tile)
} as const;

/** Where the tunnels are: their block in arena tiles (210 units), and how many quarter turns */
const PLACES = [
  { col: 1, row: 2, turns: 0 },
  { col: 6, row: 1, turns: 1 },
  { col: 3, row: 6, turns: 2 },
  { col: 7, row: 6, turns: 3 },
];
const TILE_SIZE = 210;

export interface Entrance {
  /** Where the seal goes when the entrance is closed (inside the block, across the mouth) */
  gate: Box;
  /** A point on the ground just outside: if it drops away in a shift, the entrance closes */
  outX: number;
  outY: number;
  tunnel: number;
}

export interface Tunnel {
  block: Box;
  passages: Box[];
  rock: Box[];
  entrances: Entrance[];
}

/** A branching tunnel before it's turned: a main passage straight across, and a narrow branch down from its middle */
function basePassages(): Box[] {
  const S = TUNNEL.SIZE;
  return [
    { x: 0, y: (S - TUNNEL.MAIN) / 2, width: S, height: TUNNEL.MAIN },
    { x: (S - TUNNEL.NARROW) / 2, y: S / 2, width: TUNNEL.NARROW, height: S / 2 },
  ];
}

/** A quarter turn clockwise within the block */
function turn(box: Box): Box {
  return { x: TUNNEL.SIZE - (box.y + box.height), y: box.x, width: box.height, height: box.width };
}

/** The rock: the block minus its passages, as a few rectangles */
function rockRects(passages: Box[]): Box[] {
  const S = TUNNEL.SIZE;
  const xs = [...new Set([0, S, ...passages.flatMap((p) => [p.x, p.x + p.width])])].sort((a, b) => a - b);
  const ys = [...new Set([0, S, ...passages.flatMap((p) => [p.y, p.y + p.height])])].sort((a, b) => a - b);
  const rects: Box[] = [];
  for (let j = 0; j < ys.length - 1; j++) {
    let run: Box | null = null;
    for (let i = 0; i < xs.length - 1; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      const open = passages.some((p) => cx > p.x && cx < p.x + p.width && cy > p.y && cy < p.y + p.height);
      if (open) {
        if (run) rects.push(run);
        run = null;
      } else if (run) {
        run.width = xs[i + 1] - run.x;
      } else {
        run = { x: xs[i], y: ys[j], width: xs[i + 1] - xs[i], height: ys[j + 1] - ys[j] };
      }
    }
    if (run) rects.push(run);
  }
  return rects;
}

export const TUNNELS: Tunnel[] = PLACES.map((place, index) => {
  const bx = place.col * TILE_SIZE;
  const by = place.row * TILE_SIZE;
  const S = TUNNEL.SIZE;
  const G = TUNNEL.GATE;
  const O = TUNNEL.OUTSIDE;
  let local = basePassages();
  for (let i = 0; i < place.turns; i++) local = local.map(turn);
  const entrances: Entrance[] = [];
  for (const p of local) {
    const midX = bx + p.x + p.width / 2;
    const midY = by + p.y + p.height / 2;
    if (p.x === 0) entrances.push({ gate: { x: bx, y: by + p.y, width: G, height: p.height }, outX: bx - O, outY: midY, tunnel: index });
    if (p.x + p.width === S) entrances.push({ gate: { x: bx + S - G, y: by + p.y, width: G, height: p.height }, outX: bx + S + O, outY: midY, tunnel: index });
    if (p.y === 0) entrances.push({ gate: { x: bx + p.x, y: by, width: p.width, height: G }, outX: midX, outY: by - O, tunnel: index });
    if (p.y + p.height === S) entrances.push({ gate: { x: bx + p.x, y: by + S - G, width: p.width, height: G }, outX: midX, outY: by + S + O, tunnel: index });
  }
  const shift = (b: Box): Box => ({ x: bx + b.x, y: by + b.y, width: b.width, height: b.height });
  return { block: { x: bx, y: by, width: S, height: S }, passages: local.map(shift), rock: rockRects(local).map(shift), entrances };
});

/** Every entrance, tunnel by tunnel (the order of GameState.tunnelDoors) */
export const ENTRANCES: Entrance[] = TUNNELS.flatMap((tunnel) => tunnel.entrances);

const wallsFor = new Map<string, Box[]>();

/** The walls: every tunnel's rock, plus a seal across each closed entrance ("x" in doors) */
export function tunnelWalls(doors: string): Box[] {
  let walls = wallsFor.get(doors);
  if (!walls) {
    const built = TUNNELS.flatMap((tunnel) => tunnel.rock);
    ENTRANCES.forEach((entrance, index) => {
      if (doors[index] === "x") built.push(entrance.gate);
    });
    wallsFor.set(doors, built);
    walls = built;
  }
  return walls;
}

/** Whether a point is inside a tunnel (underground, or in its rock) */
export function isUnderground(x: number, y: number): boolean {
  return TUNNELS.some(({ block: b }) => x > b.x && x < b.x + b.width && y > b.y && y < b.y + b.height);
}

/** Whether a box overlaps a tunnel at all */
export function overlapsTunnel(box: Box): boolean {
  return TUNNELS.some(({ block: b }) => box.x < b.x + b.width && box.x + box.width > b.x && box.y < b.y + b.height && box.y + box.height > b.y);
}

/** The nearest spot just outside the tunnel a point is in (the point itself when it isn't in one) */
export function outsideTunnels(point: { x: number; y: number }, margin = 14): { x: number; y: number } {
  for (const { block: b } of TUNNELS) {
    if (!(point.x > b.x && point.x < b.x + b.width && point.y > b.y && point.y < b.y + b.height)) continue;
    const toLeft = point.x - b.x;
    const toRight = b.x + b.width - point.x;
    const toTop = point.y - b.y;
    const toBottom = b.y + b.height - point.y;
    const least = Math.min(toLeft, toRight, toTop, toBottom);
    if (least === toLeft) return { x: b.x - margin, y: point.y };
    if (least === toRight) return { x: b.x + b.width + margin, y: point.y };
    if (least === toTop) return { x: point.x, y: b.y - margin };
    return { x: point.x, y: b.y + b.height + margin };
  }
  return point;
}

/**
 * The same floor, with the ground outside entrances switched back on where needed so every tunnel
 * keeps at least two ways out. Those tiles connect through the tunnel, so they're never stranded
 */
export function keepTunnelsOpen(layout: Layout): Layout {
  const across = Math.round(Math.sqrt(layout.length));
  const fixed = layout.slice();
  for (const tunnel of TUNNELS) {
    let open = tunnel.entrances.filter((entrance) => isFloor(fixed, entrance.outX, entrance.outY)).length;
    for (const entrance of tunnel.entrances) {
      if (open >= 2) break;
      if (isFloor(fixed, entrance.outX, entrance.outY)) continue;
      fixed[Math.floor(entrance.outY / TILE) * across + Math.floor(entrance.outX / TILE)] = true;
      open++;
    }
  }
  return fixed;
}

/** Whether every tunnel keeps at least two open entrances on this floor, so nobody underground is shut in */
export function tunnelsStayOpen(layout: Layout): boolean {
  return TUNNELS.every((tunnel) => tunnel.entrances.filter((entrance) => isFloor(layout, entrance.outX, entrance.outY)).length >= 2);
}
