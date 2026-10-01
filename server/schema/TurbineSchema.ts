import * as schema from "@colyseus/schema";
const { Schema, type } = schema;
import { GAME_CONSTANTS } from "../constants/serverConstants.js";

const { TURBINE } = GAME_CONSTANTS;

/**
 * A turbine (see GameState.updateTurbines): where it stands, where its intake points (it never
 * turns), when its exhaust's sweep began (browsers work out where it points from that; see
 * game/turbine.ts), and its stage: "warning" (shown before it switches on), "active", or "ending"
 * (powering down).
 */
export class TurbineSchema extends Schema {
  id: string;
  x: number;
  y: number;
  intake: number;
  sweepFrom: number;
  phase: string;
  phaseEndsAt: number;
  /** Server-only (test worlds): the exhaust holds still, pointing straight back */
  still = false;

  constructor(id: string, x: number, y: number, intake: number, time: number) {
    super();
    this.id = id;
    this.x = Math.round(x);
    this.y = Math.round(y);
    this.intake = Math.round(intake * 1000) / 1000;
    this.phase = "warning";
    this.phaseEndsAt = time + TURBINE.WARNING_MS;
    this.sweepFrom = this.phaseEndsAt;
  }
}

type("string")(TurbineSchema.prototype, "id");
type("number")(TurbineSchema.prototype, "x");
type("number")(TurbineSchema.prototype, "y");
type("number")(TurbineSchema.prototype, "intake");
type("number")(TurbineSchema.prototype, "sweepFrom");
type("string")(TurbineSchema.prototype, "phase");
type("number")(TurbineSchema.prototype, "phaseEndsAt");

/**
 * A gem on its way through a turbine (see GameState.addFlight): which turbine, who it came from (a
 * player's id, or "" for a gem off the ground), where it left from, its value, and the world times
 * it left, reaches the intake and fires out of the exhaust. Every browser draws it from these.
 */
export class TurbineFlightSchema extends Schema {
  turbine: string;
  victim: string;
  fromX: number;
  fromY: number;
  value: number;
  startAt: number;
  arriveAt: number;
  fireAt: number;
  /** Server-only: it was a field gem, and stays one (so the field isn't refilled for it) */
  counted = false;

  constructor(turbine: string, victim: string, fromX: number, fromY: number, value: number, startAt: number, arriveAt: number, fireAt: number) {
    super();
    this.turbine = turbine;
    this.victim = victim;
    this.fromX = Math.round(fromX);
    this.fromY = Math.round(fromY);
    this.value = value;
    this.startAt = Math.round(startAt);
    this.arriveAt = Math.round(arriveAt);
    this.fireAt = Math.round(fireAt);
  }
}

type("string")(TurbineFlightSchema.prototype, "turbine");
type("string")(TurbineFlightSchema.prototype, "victim");
type("number")(TurbineFlightSchema.prototype, "fromX");
type("number")(TurbineFlightSchema.prototype, "fromY");
type("number")(TurbineFlightSchema.prototype, "value");
type("number")(TurbineFlightSchema.prototype, "startAt");
type("number")(TurbineFlightSchema.prototype, "arriveAt");
type("number")(TurbineFlightSchema.prototype, "fireAt");
