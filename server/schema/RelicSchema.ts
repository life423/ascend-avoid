import * as schema from '@colyseus/schema';
const { Schema, type } = schema;

export class RelicSchema extends Schema {
  phase: 'disabled' | 'waiting' | 'available' | 'towed' = 'disabled';
  x = 0;
  y = 0;
  relayX = 0;
  relayY = 0;
  carrierId = '';
  availableAt = 0;
  expiresAt = 0;
  /** The unclaimed countdown pauses while a giant is hauling the relic. */
  pausedUnclaimedMs = 0;
  /** The original clear haul corridor stays reserved while the relic is carried. */
  routeX = 0;
  routeY = 0;
}
type("string")(RelicSchema.prototype, "phase");
type("number")(RelicSchema.prototype, "x");
type("number")(RelicSchema.prototype, "y");
type("number")(RelicSchema.prototype, "relayX");
type("number")(RelicSchema.prototype, "relayY");
type("string")(RelicSchema.prototype, "carrierId");
type("number")(RelicSchema.prototype, "availableAt");
type("number")(RelicSchema.prototype, "expiresAt");

export class RelicCometSchema extends Schema {
  phase: 'idle' | 'inbound' | 'impact' = 'idle';
  id = 0;
  x = 0;
  y = 0;
  impactAt = 0;
  ownerId = '';
}
type("string")(RelicCometSchema.prototype, "phase");
type("number")(RelicCometSchema.prototype, "id");
type("number")(RelicCometSchema.prototype, "x");
type("number")(RelicCometSchema.prototype, "y");
type("number")(RelicCometSchema.prototype, "impactAt");
type("string")(RelicCometSchema.prototype, "ownerId");
