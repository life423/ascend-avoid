import * as schema from '@colyseus/schema';
const { Schema, type } = schema;
export class GustWaveSchema extends Schema {
  owner = '';
  x = 0;
  y = 0;
  width = 20;
  facing = 0;
  at = 0;
  /** Server-only: one finite push budget and one response per body. */
  pushed = new Set<string>();
  parried = new Set<string>();
  remainingImpulse = 0;
}
type("string")(GustWaveSchema.prototype, "owner");
type("number")(GustWaveSchema.prototype, "x");
type("number")(GustWaveSchema.prototype, "y");
type("number")(GustWaveSchema.prototype, "width");
type("number")(GustWaveSchema.prototype, "facing");
type("number")(GustWaveSchema.prototype, "at");
