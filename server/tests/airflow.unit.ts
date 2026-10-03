/**
 * Unit checks for the shared airflow and Core physics (pure functions, exact numbers): run with
 * `npm run test:unit` (part of `npm test`).
 */
import { airflowOnCore, stepCore, type CoreBody, type Inhaler } from "../game/corePhysics.js";
import { airflowQuality, breathRate, cleanAir, latchSizeFactor } from "../game/airflow.js";
import { turnRate, turnStep } from "../game/movement.js";
import { CAMERA, CORE, INHALE, LATCH } from "../constants/gameConstants.js";
import { CameraRig, lookAhead, springStep, viewShort } from "../game/camera.js";
import { dangerRadius, lethalShare, pressureBuild, scaleDrain, streamLook } from "../game/airflow.js";
import { moveSpeed } from "../game/movement.js";

let failed = 0;
function check(ok: boolean, label: string): void {
  console.log(`${ok ? "\u2713" : "\u2717"} ${label}`);
  if (!ok) failed++;
}

const newborn: Inhaler = { x: 0, y: 0, width: 20, facing: 0, inhaling: true };
const giant: Inhaler = { ...newborn, width: 143 };
const core = (x: number, y: number): CoreBody => ({ x, y, vx: 0, vy: 0, radius: CORE.RADIUS });
const pullOn = (who: Inhaler, body: CoreBody): number => {
  const { ax, ay } = airflowOnCore(who, body);
  return Math.hypot(ax, ay);
};

// Cores
const early = core(150, 0);
check(pullOn(newborn, early) > 100 && airflowOnCore(newborn, early).ax < 0, `a newborn pulls a Core hard well before the air's balance point (${pullOn(newborn, early).toFixed(0)} a second each second at 150)`);
const mouthGap = 160;
const edgeOff = (INHALE.ARC * Math.PI) / 180 + 0.6 * Math.asin(CORE.RADIUS / mouthGap);
const edgeIn = core(6 + Math.cos(edgeOff) * mouthGap, Math.sin(edgeOff) * mouthGap);
const allOut = core(6 + Math.cos(edgeOff + 0.6) * mouthGap, Math.sin(edgeOff + 0.6) * mouthGap);
check(pullOn(newborn, edgeIn) > 0 && pullOn(newborn, allOut) === 0, "radius-aware: a Core whose middle is outside the airflow but whose edge is in still feels it (and one wholly outside doesn't)");
check(pullOn(newborn, core(300, 0)) === 0 && pullOn(giant, core(300, 0)) > 0, "a giant's airflow reaches a Core a newborn's can't");
const strongest = (who: Inhaler): number => {
  let best = 0;
  for (let d = 30; d <= 900; d += 2) best = Math.max(best, pullOn(who, core(d, 0)));
  return best;
};
check(strongest(giant) > strongest(newborn) * 1.5, `a giant pulls harder (strongest pull ${strongest(giant).toFixed(0)} vs a newborn's ${strongest(newborn).toFixed(0)})`);
const fast = { ...core(0, 0), vx: 5000 };
stepCore(fast, 0, 0, 0.05, 1e6, 1e6);
check(Math.abs(Math.hypot(fast.vx, fast.vy) - CORE.MAX_SPEED) < 1e-6, "a Core's top speed is its own (whatever moved it)");
check(pullOn({ ...giant, inhaling: false }, core(150, 0)) === 0, "not inhaling, no force at all: letting go adds nothing");
let worst = 0;
let previous: number | null = null;
for (let d = 260; d >= 30; d -= 1) {
  const ax = airflowOnCore(newborn, core(d, 0)).ax;
  if (previous !== null) worst = Math.max(worst, Math.abs(ax - previous));
  previous = ax;
}
check(worst < 60, `the pull changes smoothly coming into the air's balance zone (largest change ${worst.toFixed(1)} per unit)`);
const ahead = airflowOnCore(newborn, core(70, 0));
check(Math.abs(ahead.ay) < 1e-6, "dead ahead the airflow pushes it nowhere sideways (no pull toward a preferred spot)");

// Player airflow quality
const attacker = { x: 0, y: 0, width: 92, facing: 0 };
const clean = airflowQuality(attacker, { x: 92 / 2 + 15 + 40, y: 0, width: 80 });
const squished = airflowQuality(attacker, { x: 92 / 2 + 40 - 14, y: 0, width: 80 });
const deep = airflowQuality(attacker, { x: 20, y: 0, width: 80 });
check(clean > 0.8, `clean, centered, in front: airflow quality near 1 (${clean.toFixed(2)})`);
check(squished < clean && deep < LATCH.SWALLOW_MIN_QUALITY && deep < LATCH.RAMP_MIN_QUALITY, `overlap smothers the airflow: squished ${squished.toFixed(2)}, deep ${deep.toFixed(2)} (too smothered to ramp or swallow)`);
check(airflowQuality(attacker, { x: -100, y: 0, width: 80 }) === 0, "behind you, no airflow at all");
check(cleanAir({ x: 0, y: 0, width: 80 }, { x: 100, y: 0, width: 80 }) === 1 && cleanAir({ x: 0, y: 0, width: 80 }, { x: 60, y: 0, width: 80 }) > cleanAir({ x: 0, y: 0, width: 80 }, { x: 40, y: 0, width: 80 }), "the more bodies overlap, the less clear the air");

// Latch size factor
check(latchSizeFactor(400, 20) === LATCH.SIZE_MAX && latchSizeFactor(20, 400) === LATCH.SIZE_MIN && latchSizeFactor(90, 90) === 1, "size gives a latch a mild edge, within its limits");

// Breath while a beam holds
const use = 1 / INHALE.MAX_MS;
check(breathRate(0, 0.5) === -use, "a wide inhale uses breath normally");
check(breathRate(0.55, 0.5) > -use && breathRate(0.55, 0.5) < 0, "a medium beam uses less");
check(breathRate(LATCH.BEAM_NEUTRAL_AT, 0.5) === 0, "a good beam breaks even");
check(breathRate(1, 0.5) > 0 && breathRate(1, 0.5) < 1 / INHALE.REFILL_MS, "an excellent beam refills breath, slower than resting does");
check(breathRate(1, LATCH.BEAM_RECHARGE_CAP) === 0, "but never past its cap while inhaling");

// Aim assist goes through turning (never sets facing)
const step = 0.05;
const giantTurn = turnStep(0, 0, Math.PI / 2, 143, true, step);
const newbornTurn = turnStep(0, 0, Math.PI / 2, 20, true, step);
check(Math.abs(giantTurn.facing) <= turnRate(143, true) * step + 1e-9 && newbornTurn.facing > giantTurn.facing, "turning toward a latched target respects turn limits, and a giant turns slower");

// Range catches, closeness kills; pressure builds
check(lethalShare(0.3) === 1 && lethalShare(1) === 0 && lethalShare(0.75) > 0 && lethalShare(0.75) < 1, "the outer part of an inhale's reach isn't lethal: drain fades to nothing toward the tip");
check(pressureBuild(0, 20) === 0 && pressureBuild(0.35, 20) === 1 && pressureBuild(0.35, 143) < 1 && pressureBuild(0.8, 143) === 1, "an inhale's pressure builds from nothing, more slowly for a giant");

// The stream's look comes only from the airflow numbers
const steady = { quality: 0.9, beamQuality: 0, clean: 1, mine: 0.9, theirs: 0, fraying: 0 };
check(streamLook({ ...steady, quality: 0.3 }).coherence < streamLook(steady).coherence && streamLook({ ...steady, quality: 0.3 }).turbulence > streamLook(steady).turbulence, "a weak connection looks broad and noisy; a strong one narrow and smooth");
check(streamLook({ ...steady, clean: 0.4 }).turbulence > streamLook(steady).turbulence, "overlapping bodies make the stream churn");
check(streamLook({ ...steady, fraying: 0.3 }).turbulence > streamLook(steady).turbulence, "a connection falling apart frays");
check(streamLook({ ...steady, beamQuality: 0 }).efficiency === 0 && streamLook({ ...steady, beamQuality: LATCH.BEAM_NEUTRAL_AT }).efficiency === 1 && streamLook({ ...steady, beamQuality: 0.95 }).recharging, "its density follows breath: wasteful, neutral, recharging");
check(streamLook({ ...steady, theirs: 0.9 }).boundary === 0.5 && streamLook({ ...steady, mine: 1.2, theirs: 0.4 }).boundary > 0.5 && streamLook(steady).boundary === 1, "inhaling each other, the flows meet in the middle when even, pushed toward the losing side, and an uncontested stream reaches all the way");

// Camera
let spring = { value: 0, velocity: 0 };
let overshoot = 0;
for (let i = 0; i < 120; i++) {
  spring = springStep(spring.value, spring.velocity, 100, CAMERA.FOLLOW_OMEGA, 1 / 60);
  overshoot = Math.max(overshoot, spring.value - 100);
}
check(overshoot <= 1e-9 && Math.abs(spring.value - 100) < 1, "the camera settles on a critically damped spring, never overshooting");
const running = { x: 0, y: 0, vx: 320, vy: 0, width: 20, facing: Math.PI / 2, inhaling: true };
const lead = lookAhead({ ...running, vx: 5000 }, viewShort(20));
check(Math.hypot(lead.x, lead.y) <= CAMERA.MAX_OFFSET * viewShort(20) + 1e-9, "the camera never leads you more than a small share of the view");
const leadIdle = lookAhead({ ...running, vx: 0, inhaling: false }, viewShort(20));
const leadInhaling = lookAhead({ ...running, vx: 0 }, viewShort(20));
check(leadInhaling.y > leadIdle.y && leadIdle.y > 0, "the camera gives a little room where you face, more while inhaling");
check(20 / viewShort(20) < 143 / viewShort(143) && 143 / viewShort(143) < 284 / viewShort(284), `growing, you take more of the screen (${[20, 72, 143, 284].map((w) => ((w / viewShort(w)) * 100).toFixed(1) + "%").join(", ")})`);
const sizes = [20, 40, 72, 143];
check(sizes.every((w) => viewShort(w) / 2 >= dangerRadius(w * CAMERA.THREAT_RATIO) + moveSpeed(w * CAMERA.THREAT_RATIO) * CAMERA.REACTION_S - 1e-6), "at every size the view shows a bigger creature coming before its lethal airflow could reach you");
const rig = new CameraRig();
rig.update(running, 1 / 60);
for (let i = 0; i < 30; i++) rig.update({ ...running, x: running.x + 320 * (i + 1) / 60 }, 1 / 60);
const behind = running.x + 320 * 30 / 60 - rig.x;
check(Math.abs(behind) > 1 && Math.abs(behind) < CAMERA.MAX_OFFSET * viewShort(20) + 1, `moving, you drift a little within the frame, not welded to its center (${behind.toFixed(0)} units off center)`);

// Late game: scale separation
const lateGame = 20 * Math.sqrt(1 + 1500 / 2);
check(lateGame / viewShort(lateGame) > 0.24 && (20 / lateGame) * (lateGame / viewShort(lateGame)) < 0.015, `late game, a 1500-gem giant fills about a quarter of the screen and a newborn beside it looks trivial (${((lateGame / viewShort(lateGame)) * 100).toFixed(0)}% vs ${(((20 / lateGame) * lateGame) / viewShort(lateGame) * 100).toFixed(1)}%)`);
check(scaleDrain(20, 548) === LATCH.SCALE_MIN && scaleDrain(60, 120) === 1 && scaleDrain(20, 100) > LATCH.SCALE_MIN && scaleDrain(20, 100) < 1, "a tiny attacker on a giant is a mosquito: its drain fades with the size gap");

console.log(failed ? `${failed} unit check(s) failed` : "All unit checks passed");
process.exit(failed ? 1 : 0);
