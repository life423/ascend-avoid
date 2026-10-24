import * as schema from "@colyseus/schema";
const { Schema, type } = schema;

/** Retired wire shape only. The live world never creates, draws or simulates these objects. */
export class CoreSchema extends Schema {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;

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
