import * as schema from "@colyseus/schema";
const { Schema, type } = schema;

/** A Core (see game/corePhysics): a heavy object inhales push around. Its middle, velocity and radius */
export class CoreSchema extends Schema {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Server-only: who it's touching now (it has to come away before it can stun them again) */
  touching = new Set<string>();

  constructor(id: string, x: number, y: number, radius: number) {
    super();
    this.id = id;
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.radius = radius;
  }
}
type("string")(CoreSchema.prototype, "id");
type("number")(CoreSchema.prototype, "x");
type("number")(CoreSchema.prototype, "y");
type("number")(CoreSchema.prototype, "vx");
type("number")(CoreSchema.prototype, "vy");
type("number")(CoreSchema.prototype, "radius");
