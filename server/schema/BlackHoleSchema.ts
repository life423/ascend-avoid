import { BLACK_HOLE } from '../constants/gameConstants.js';
import * as schema from '@colyseus/schema';
const { Schema, type } = schema;

/** A stationary core during each active/closing phase; relocation happens only while dormant. */
export class BlackHoleSchema extends Schema {
  x: number;
  y: number;
  radius: number;
  activeAt: number;
  phase: string;
  at: number;
  /** Only ordinary arena slots cycle. Tutorial/test landmarks remain static. */
  cycling = false;
  firstStagger = 0;
  generation = 0;
  /** Server-only. A cancelled warning must not replace the last live position. */
  lastCorePosition: { x: number; y: number } | null = null;
  constructor(x = 0, y = 0, radius = BLACK_HOLE.CORE_RADIUS, activeAt = 0) {
    super(); this.x = x; this.y = y; this.radius = radius; this.activeAt = activeAt;
    this.phase = activeAt > 0 ? 'warning' : 'active'; this.at = activeAt;
  }
}
type("number")(BlackHoleSchema.prototype, "x");
type("number")(BlackHoleSchema.prototype, "y");
type("number")(BlackHoleSchema.prototype, "radius");
type("number")(BlackHoleSchema.prototype, "activeAt");
type("string")(BlackHoleSchema.prototype, "phase");
type("number")(BlackHoleSchema.prototype, "at");
