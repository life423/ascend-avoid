import { BLACK_HOLE } from '../constants/gameConstants.js';
import * as schema from '@colyseus/schema';
const { Schema, type } = schema;

/** Fixed arena landmark. Only a player-fired captive's center can enter its lethal core. */
export class BlackHoleSchema extends Schema {
  x: number;
  y: number;
  radius: number;
  activeAt: number;
  constructor(x = 0, y = 0, radius = BLACK_HOLE.CORE_RADIUS, activeAt = 0) {
    super(); this.x = x; this.y = y; this.radius = radius; this.activeAt = activeAt;
  }
}
type("number")(BlackHoleSchema.prototype, "x");
type("number")(BlackHoleSchema.prototype, "y");
type("number")(BlackHoleSchema.prototype, "radius");
type("number")(BlackHoleSchema.prototype, "activeAt");
