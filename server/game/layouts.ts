import { SHIFT, WORLD } from "../constants/gameConstants.js";

/** Which tiles of the SHIFT.GRID x SHIFT.GRID arena are floor, row by row */
export type Layout = boolean[];

const N = SHIFT.GRID;
/** The size of a tile, in world units */
export const TILE = WORLD.WIDTH / N;

/** Hand-made shapes ('#' is floor). Each is also used turned and mirrored. */
const PREMADE: Record<string, readonly string[]> = {
  plus: [
    "...####...",
    "...####...",
    "...####...",
    ".########.",
    ".########.",
    ".########.",
    ".########.",
    "...####...",
    "...####...",
    "...####...",
  ],
  ring: [
    "..........",
    ".########.",
    ".########.",
    ".##....##.",
    ".##....##.",
    ".##....##.",
    ".##....##.",
    ".########.",
    ".########.",
    "..........",
  ],
  twinIslands: [
    "..........",
    ".###..###.",
    ".###..###.",
    ".########.",
    ".###..###.",
    ".###..###.",
    ".########.",
    ".###..###.",
    ".###..###.",
    "..........",
  ],
  hourglass: [
    ".########.",
    ".########.",
    "..######..",
    "...####...",
    "....##....",
    "....##....",
    "...####...",
    "..######..",
    ".########.",
    ".########.",
  ],
  hBeam: [
    "..........",
    ".##....##.",
    ".##....##.",
    ".##....##.",
    ".########.",
    ".########.",
    ".##....##.",
    ".##....##.",
    ".##....##.",
    "..........",
  ],
};

const randomInt = (n: number) => Math.floor(Math.random() * n);

function parse(rows: readonly string[]): Layout {
  return rows.join("").split("").map((cell) => cell === "#");
}

function count(layout: Layout): number {
  return layout.filter(Boolean).length;
}

/** A quarter turn clockwise */
function turn(layout: Layout): Layout {
  const out: Layout = new Array(N * N).fill(false);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) out[c * N + (N - 1 - r)] = layout[r * N + c];
  return out;
}

/** Flipped left to right */
function flip(layout: Layout): Layout {
  const out: Layout = new Array(N * N).fill(false);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) out[r * N + (N - 1 - c)] = layout[r * N + c];
  return out;
}

/** A random blob of 2x2 blocks grown from near the middle, often mirrored so it looks designed */
function generate(share: number): Layout {
  let layout: Layout = new Array(N * N).fill(false);
  const stamp = (r: number, c: number) => {
    for (let dr = 0; dr < 2; dr++) for (let dc = 0; dc < 2; dc++) layout[(r + dr) * N + c + dc] = true;
  };
  /** Whether a 2x2 block at (r, c) would join the floor so far (sharing an edge, not just a corner) */
  const joins = (r: number, c: number) => {
    for (let rr = r - 1; rr <= r + 2; rr++) {
      for (let cc = c - 1; cc <= c + 2; cc++) {
        const corner = (rr === r - 1 || rr === r + 2) && (cc === c - 1 || cc === c + 2);
        if (!corner && rr >= 0 && rr < N && cc >= 0 && cc < N && layout[rr * N + cc]) return true;
      }
    }
    return false;
  };
  const symmetric = Math.random() < 0.5;
  // A mirrored shape is grown to about half its size first, then joined with its reflection
  const goal = Math.round(share * N * N * (symmetric ? 0.6 : 1));
  stamp(3 + randomInt(3), 3 + randomInt(3));
  for (let tries = 0; tries < 2000 && count(layout) < goal; tries++) {
    const r = randomInt(N - 1);
    const c = randomInt(N - 1);
    if (joins(r, c)) stamp(r, c);
  }
  if (symmetric) {
    const reflection = Math.random() < 0.5 ? flip(layout) : turn(turn(layout));
    layout = layout.map((floor, i) => floor || reflection[i]);
  }
  return layout;
}

/** Whether all the floor is connected, stepping between tiles that share an edge */
function connected(layout: Layout): boolean {
  const start = layout.indexOf(true);
  if (start < 0) return false;
  const seen = new Set<number>([start]);
  const queue = [start];
  while (queue.length > 0) {
    const i = queue.pop()!;
    const r = Math.floor(i / N);
    const c = i % N;
    for (const [nr, nc] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]]) {
      const j = nr * N + nc;
      if (nr >= 0 && nr < N && nc >= 0 && nc < N && layout[j] && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === count(layout);
}

/**
 * Whether a shape is fair and fun: enough floor but not too much, all of it connected, some room
 * to stand around in (a 2x2 block of tiles), and close enough to everywhere that anyone can
 * reach it during the grace period
 */
export function isGoodLayout(layout: Layout): boolean {
  const share = count(layout) / (N * N);
  if (share < SHIFT.FLOOR_SHARE_MIN || share > SHIFT.FLOOR_SHARE_MAX || !connected(layout)) return false;
  let roomy = false;
  for (let r = 0; r < N - 1 && !roomy; r++) {
    for (let c = 0; c < N - 1 && !roomy; c++) {
      roomy = layout[r * N + c] && layout[r * N + c + 1] && layout[(r + 1) * N + c] && layout[(r + 1) * N + c + 1];
    }
  }
  if (!roomy) return false;
  const floorTiles = layout.flatMap((floor, i) => (floor ? [i] : []));
  for (let i = 0; i < N * N; i++) {
    const r = Math.floor(i / N);
    const c = i % N;
    const nearest = Math.min(...floorTiles.map((j) => Math.hypot(Math.floor(j / N) - r, (j % N) - c)));
    if (nearest > SHIFT.MAX_REACH_TILES) return false;
  }
  return true;
}

/** Whether a point is over floor */
export function isFloor(layout: Layout, x: number, y: number): boolean {
  const c = Math.min(N - 1, Math.max(0, Math.floor(x / TILE)));
  const r = Math.min(N - 1, Math.max(0, Math.floor(y / TILE)));
  return layout[r * N + c];
}

/** The closest point on the floor, at least `margin` inside a floor tile */
export function closestFloorPoint(layout: Layout, x: number, y: number, margin = 40): { x: number; y: number } {
  let best = { x, y };
  let bestDistance = Infinity;
  layout.forEach((floor, i) => {
    if (!floor) return;
    const left = (i % N) * TILE + margin;
    const top = Math.floor(i / N) * TILE + margin;
    const px = Math.min(Math.max(x, left), left + TILE - 2 * margin);
    const py = Math.min(Math.max(y, top), top + TILE - 2 * margin);
    const distance = Math.hypot(px - x, py - y);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = { x: px, y: py };
    }
  });
  return best;
}

/** A random point on the floor, at least `margin` inside a floor tile */
export function randomFloorPoint(layout: Layout, margin = 40): { x: number; y: number } {
  const floorTiles = layout.flatMap((floor, i) => (floor ? [i] : []));
  const i = floorTiles[randomInt(floorTiles.length)] ?? 0;
  return {
    x: (i % N) * TILE + margin + Math.random() * (TILE - 2 * margin),
    y: Math.floor(i / N) * TILE + margin + Math.random() * (TILE - 2 * margin),
  };
}

/** Where the jackpot lands: the middle of the roomiest bit of floor */
export function jackpotSpot(layout: Layout): { x: number; y: number } {
  let best = 0;
  let bestRoom = -1;
  layout.forEach((floor, i) => {
    if (!floor) return;
    const r = Math.floor(i / N);
    const c = i % N;
    let room = Math.random() * 0.5;
    for (let rr = r - 1; rr <= r + 1; rr++) {
      for (let cc = c - 1; cc <= c + 1; cc++) {
        if (rr >= 0 && rr < N && cc >= 0 && cc < N && layout[rr * N + cc]) room++;
      }
    }
    if (room > bestRoom) {
      bestRoom = room;
      best = i;
    }
  });
  return { x: (best % N) * TILE + TILE / 2, y: Math.floor(best / N) * TILE + TILE / 2 };
}

/** The layout as sent to browsers: "1" for floor, "0" for void, row by row */
export function layoutToString(layout: Layout): string {
  return layout.map((floor) => (floor ? "1" : "0")).join("");
}

/**
 * Choose the next shape: half the time hand-made (turned and mirrored at random), half the time
 * generated, trying several candidates of that kind; the best one wins. The floor grows slower than the player count, so a
 * busy arena still gets more crowded. Sometimes the winner is near everyone, sometimes it makes
 * them all cross the arena.
 */
export function pickLayout(
  people: { x: number; y: number }[],
  playerCount: number,
  lastName: string
): { layout: Layout; name: string } {
  const share = Math.min(
    SHIFT.FLOOR_SHARE_MAX,
    Math.max(SHIFT.FLOOR_SHARE_MIN, SHIFT.BASE_SHARE * Math.sqrt(Math.max(1, playerCount) / 6))
  );
  const wantedTravel = 100 + Math.random() * 700;
  const names = Object.keys(PREMADE).filter((name) => name !== lastName);
  // Half the time a hand-made shape, half the time a generated one; the best candidate of that kind wins
  const handMade = Math.random() < 0.5;
  let best: { layout: Layout; name: string } | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < SHIFT.CANDIDATES; i++) {
    let name = "generated";
    let layout: Layout;
    if (handMade) {
      name = names[randomInt(names.length)];
      layout = parse(PREMADE[name]);
      for (let turns = randomInt(4); turns > 0; turns--) layout = turn(layout);
      if (Math.random() < 0.5) layout = flip(layout);
    } else {
      layout = generate(share);
    }
    if (!isGoodLayout(layout)) continue;
    const travel =
      people.length > 0
        ? people.reduce((sum, p) => {
            const spot = closestFloorPoint(layout, p.x, p.y, 0);
            return sum + Math.hypot(spot.x - p.x, spot.y - p.y);
          }, 0) / people.length
        : wantedTravel;
    // Close enough to the wanted floor share (within 8%) costs nothing, so hand-made shapes compete
    const shareMiss = Math.max(0, Math.abs(count(layout) / (N * N) - share) - 0.08);
    const score = -Math.abs(travel - wantedTravel) - shareMiss * 1500 + Math.random() * 60;
    if (score > bestScore) {
      bestScore = score;
      best = { layout, name };
    }
  }
  return best ?? { layout: parse(PREMADE.plus), name: "plus" };
}
