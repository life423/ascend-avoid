import { Schema, ArraySchema, MapSchema, type } from '@colyseus/schema';
import { PINWHEEL, type WeaponKind } from '../constants/gameConstants.js';

export class WeaponPartSchema extends Schema {
  kind = 0;
  x = 0;
  y = 0;
  owner = '';
  carriedBy = '';
  vx = 0;
  vy = 0;
  theftBy = '';
  theftMs = 0;
}
type("number")(WeaponPartSchema.prototype, "kind");
type("number")(WeaponPartSchema.prototype, "x");
type("number")(WeaponPartSchema.prototype, "y");
type("string")(WeaponPartSchema.prototype, "owner");
type("string")(WeaponPartSchema.prototype, "carriedBy");

export class WeaponBoltSchema extends Schema {
  x = 0;
  y = 0;
  angle = 0;
  bornAt = 0;
  bounces = 0;
}
type("number")(WeaponBoltSchema.prototype, "x");
type("number")(WeaponBoltSchema.prototype, "y");
type("number")(WeaponBoltSchema.prototype, "angle");
type("number")(WeaponBoltSchema.prototype, "bornAt");

/** One independent weapon set; all deadlines use the world clock. */
export class PinwheelSchema extends Schema {
  // Keep the existing schema's field order for connected clients; new weapon fields are appended below.
  phase = 'waiting';
  at: number = PINWHEEL.FIRST_MS;
  x = 0;
  y = 0;
  angle = 0;
  owner = '';
  claimUntil = 0;
  progress = 0;
  parts = new ArraySchema<WeaponPartSchema>();
  bolts = new MapSchema<WeaponBoltSchema>();
  nextShotAt = 0;
  nextBolt = 0;
  hitAt = new Map<string, number>();
  kind: WeaponKind = 'pulsar';
  beatAt = 0;
  pulseAt = 0;
  pulseHits = new Set<string>();
  pulseDistances = new Map<string, number>();
  claimedAt = 0;
  activatedAt = 0;
  originX = 0;
  originY = 0;
  fixedRecipe = false;
  nextAimAt = 0;
  spawnX = 0;
  spawnY = 0;
}
type("string")(PinwheelSchema.prototype, "phase");
type("number")(PinwheelSchema.prototype, "at");
type("number")(PinwheelSchema.prototype, "x");
type("number")(PinwheelSchema.prototype, "y");
type("number")(PinwheelSchema.prototype, "angle");
type("string")(PinwheelSchema.prototype, "owner");
type("number")(PinwheelSchema.prototype, "claimUntil");
type("number")(PinwheelSchema.prototype, "progress");
type([WeaponPartSchema])(PinwheelSchema.prototype, "parts");
type({ map: WeaponBoltSchema })(PinwheelSchema.prototype, "bolts");
type("string")(PinwheelSchema.prototype, "kind");
type("number")(PinwheelSchema.prototype, "beatAt");
type("number")(PinwheelSchema.prototype, "pulseAt");
type("number")(PinwheelSchema.prototype, "claimedAt");
type("number")(PinwheelSchema.prototype, "activatedAt");
type("number")(PinwheelSchema.prototype, "originX");
type("number")(PinwheelSchema.prototype, "originY");
