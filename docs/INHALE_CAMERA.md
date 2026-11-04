# Large-player inhale framing — local implementation

November 4, 2026. The user reviewed the local version, said it feels good, and
approved commit, main merge and deployment. The production workflow records the
published revision and result.

Large players smoothly gain forward view while actually inhaling. Release,
exhaustion or another state that stops inhale eases the framing back to normal.
The user explicitly rejected inhale-driven zoom. **Inhale never changes zoom**:
the existing size/threat-horizon camera and rounded-arena fitting retain control
of view dimensions and scale. Ordinary movement framing is unchanged.

## Behavior and tuning

The pan starts gently above physical width **240**, reaches its full requested
strength at **600**, and asks for up to **30% of the actual viewport's short
side** toward the player's facing. A smooth size transition avoids a threshold
pop. Existing `LOOK_SMOOTH = 3` easing settles about 95% of a stationary pan in
one second. These are initial local framing values, not gameplay balance changes.

The request is first constrained to a feasible camera position, then eased.
Smoothing a distant raw goal before clamping could hit a narrow phone's limit
too abruptly. The final position is constrained again as the player moves or
the screen rotates. The existing solver retains the body wherever it fits and
the visible central body at tight curved walls. The whole viewport remains
inside the arena. Small bodies retain their exact normal framing.

No panel, button or sound is added. Facing follows existing movement/aim input;
camera movement changes no aim, reach, suction, damage, movement, breath or
capture rules. Tutorial objective framing takes precedence so lesson targets
stay framed. Knockout/absent subject, shrinking to a small body and large setup
teleports clear the stored pan so it cannot carry into a new small-player view.

## Reach gained and geometric limits

In the centered 412×915 viewport calculation, a **612-wide** player has **1,304**
units of actual inhale reach beyond the mouth. This framing increases visible
forward distance from approximately **762 to 1,216 units**, with exactly the
same zoom. These are pure geometry measurements; screenshots and browser checks
also verify the normal controls activate the effect.

At the new maximum width **1,470**, reach extends **3,020** units beyond the
mouth. A portrait viewport cannot always show all of that alongside the player
without showing outside the finite arena. The pan exposes more where space
permits; it does not promise the complete cone in every direction. A direction
already showing the available map edge may gain no extra view. Arena walls and
player visibility take precedence.

## Verification

- Focused pure tests cover **1,920** size/aspect/corner/facing combinations,
  start/release easing, unchanged zoom, full-body retention when initially
  possible, central-body visibility, straight/curved containment, input toggling,
  rotation, moving along a curve, active orientation changes, shrink and reset.
- **20 browser cases** pass across desktop Chrome, Android Chrome emulation,
  iPhone Safari emulation and Firefox phone viewport. They exercise real
  keyboard/joystick/action input, measurable forward gains, identical zoom,
  release return, four corners and touch controls in both orientations.
- All **12 follow-up runs** pass: the four forward-view cases with rotation
  while holding inhale, plus eight existing giant-movement and
  growth/knockout/respawn regressions. Combined with the corner cases above,
  this covers **28 distinct browser cases**.
- All **56 server unit suites** plus practice progress/ownership checks pass.
  Build, type checking, synced-schema verification and lint pass; lint retains
  161 existing warnings and zero errors. No synchronized field changed.

Phone emulation is not physical Android Firefox performance validation. Human
feel, crowded HUD overlap and comfort with moving/turning targets still need
ordinary match review. Existing giant speed and growth settings are preserved.

## Local review

Normal local play includes the feature at <http://localhost:3001/>. The existing
<http://localhost:3001/growth-review.html> offers guarded size presets and a
Center button. Choose 5,000, 20,000 or Maximum, use normal movement to face an
open direction, hold inhale, then release. Collapse the setup panel for a clear
view. Zoom should remain stable through the inhale gesture. At a wall, check
that the player and arena remain visible while the pan reaches its bound.

Generate that disposable page after a build using
`node scripts/growth-injury-drill.mjs`. No opt-in flag gates normal gameplay.
