/** First entry into a circle along a swept segment, including starts inside; null for a miss. */
export function circleEntry(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, radius: number): number | null {
  const x = ax - cx, y = ay - cy, dx = bx - ax, dy = by - ay;
  const c = x * x + y * y - radius * radius;
  if (c <= 0) return 0;
  const a = dx * dx + dy * dy;
  if (a < 1e-9) return null;
  const b = x * dx + y * dy, discriminant = b * b - a * c;
  if (discriminant <= 0) return null; // A tangent does not enter the core.
  const t = (-b - Math.sqrt(discriminant)) / a;
  return t >= 0 && t <= 1 ? t : null;
}
