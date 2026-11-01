export interface Bounds { left: number; top: number; right: number; bottom: number }

/** Maximal free rectangles; overlapping candidates are useful when a toolbar can wrap. */
export function freeAreas(view: Bounds, obstacles: Bounds[], gap = 12): Bounds[] {
  let areas = [view];
  for (const obstacle of obstacles) {
    const b = { left: obstacle.left - gap, right: obstacle.right + gap, top: obstacle.top - gap, bottom: obstacle.bottom + gap };
    areas = areas.flatMap(a => {
      if (b.left >= a.right || b.right <= a.left || b.top >= a.bottom || b.bottom <= a.top) return [a];
      return [
        { ...a, right: Math.min(a.right, b.left) },
        { ...a, left: Math.max(a.left, b.right) },
        { ...a, bottom: Math.min(a.bottom, b.top) },
        { ...a, top: Math.max(a.top, b.bottom) },
      ].filter(r => r.right > r.left && r.bottom > r.top);
    });
    areas = areas.filter((a, i) => !areas.some((b, j) => j < i && b.left <= a.left && b.top <= a.top && b.right >= a.right && b.bottom >= a.bottom));
  }
  return areas.sort((a, b) => b.bottom - a.bottom || (b.right - b.left) - (a.right - a.left));
}
