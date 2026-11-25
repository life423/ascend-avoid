import { CANNON } from '../constants/gameConstants.js';

interface ViewBounds { x: number; y: number; width: number; height: number }
interface FlightPoint { x: number; y: number; radius: number }
interface FlightRecord {
  origin?: FlightPoint;
  shooter?: FlightPoint;
  surprise?: boolean;
  receivedAt: number;
  observed: boolean;
  age: number;
}

function outside(view: ViewBounds, p: FlightPoint): boolean {
  const dx = Math.max(0, Math.abs(p.x - view.x) - view.width / 2);
  const dy = Math.max(0, Math.abs(p.y - view.y) - view.height / 2);
  return dx * dx + dy * dy > p.radius * p.radius;
}

function surpriseOrigin(view: ViewBounds, bullet: FlightPoint, shooter?: FlightPoint): boolean {
  if (outside(view, bullet)) return true;
  const clipsEdge = Math.abs(bullet.x - view.x) + bullet.radius > view.width / 2 ||
    Math.abs(bullet.y - view.y) + bullet.radius > view.height / 2;
  return clipsEdge && !!shooter && outside(view, shooter);
}

/** Public launch provenance. First-step age/velocity cannot reliably reconstruct the muzzle position. */
export class LaunchVisibility {
  private readonly flights = new Map<string, FlightRecord>();

  noteLaunch(data: { id?: unknown; x?: unknown; y?: unknown }, view: ViewBounds | null | undefined, now: number, shooter?: FlightPoint, warnedBeforeLaunch = false): void {
    if (typeof data.id !== 'string' || !data.id || typeof data.x !== 'number' || typeof data.y !== 'number'
      || !Number.isFinite(data.x) || !Number.isFinite(data.y)) return;
    const radius = CANNON.BULLET_SIZE / 2;
    // The existing public event gives the launched body's top-left, not its center.
    const origin = { x: data.x + radius, y: data.y + radius, radius };
    this.flights.set(data.id, { origin, shooter, surprise: warnedBeforeLaunch ? true : view ? surpriseOrigin(view, origin, shooter) : undefined, receivedAt: now, observed: false, age: 0 });
  }

  observe(id: string, age: number, point: FlightPoint, view: ViewBounds, now: number): boolean {
    let flight = this.flights.get(id);
    if (flight?.observed && age < flight.age) flight = undefined;
    flight ??= { receivedAt: now, observed: false, age };
    // If the view was not ready when the event arrived, retain its real origin until it is.
    flight.surprise ??= flight.origin ? surpriseOrigin(view, flight.origin, flight.shooter) : false;
    // Use the physical trajectory here; the sprite can still interpolate from its old captive pose.
    flight.surprise ||= outside(view, point);
    flight.observed = true; flight.age = age;
    this.flights.set(id, flight);
    return flight.surprise;
  }

  prune(live: ReadonlySet<string>, now: number): void {
    for (const [id, flight] of this.flights) {
      // A launch event can arrive a frame before the flying state. Do not discard that pending origin.
      if (flight.observed && !live.has(id) || now - flight.receivedAt > CANNON.FLIGHT_MS + 1000) this.flights.delete(id);
    }
  }

  clear(): void { this.flights.clear(); }
}
