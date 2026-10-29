import * as schema from "@colyseus/schema";
const { Schema, type } = schema;

/** Server-owned lesson progress. Clients may choose/retry/skip; they cannot report success. */
export class PracticeSchema extends Schema {
  enabled = false;
  lesson = "";
  stage = "";
  phase = "choosing";
  attempt = 0;
  failures = 0;
  resetSerial = 0;
  sequence = false;
  passed = 0;
  total = 0;
  targetId = "";
  objectiveKind = "";
  objectiveX = 0;
  objectiveY = 0;
  cue = "";
  completed = "";
}
type("boolean")(PracticeSchema.prototype, "enabled");
type("string")(PracticeSchema.prototype, "lesson");
type("string")(PracticeSchema.prototype, "stage");
type("string")(PracticeSchema.prototype, "phase");
type("number")(PracticeSchema.prototype, "attempt");
type("number")(PracticeSchema.prototype, "failures");
type("number")(PracticeSchema.prototype, "passed");
type("number")(PracticeSchema.prototype, "total");
type("string")(PracticeSchema.prototype, "targetId");
type("string")(PracticeSchema.prototype, "objectiveKind");
type("number")(PracticeSchema.prototype, "objectiveX");
type("number")(PracticeSchema.prototype, "objectiveY");
type("string")(PracticeSchema.prototype, "cue");
type("string")(PracticeSchema.prototype, "completed");

type("number")(PracticeSchema.prototype, "resetSerial");
type("boolean")(PracticeSchema.prototype, "sequence");
