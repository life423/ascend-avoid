# Rounded arena corners — November 3, 2026

Implemented on `codex/rounded-arena-corners`, based on released main `5ca85fb`.
After local playtesting the user reported that it feels good and authorized
commit, merge, push and deployment on November 3. The protected
[production workflow](https://github.com/life423/ascend-avoid/actions/workflows/deploy.yml)
records the exact published merge and rollout result. This batch also saves the
updated TODO and its preserved request history.

## Shape and movement

`ARENA_RULES.CORNER_RADIUS = 700` world units on the 4200-square arena. Practice
and smaller arenas use the lesser of 700 and one quarter of the shorter side.
The first 900-unit layout cut too much space from the largest body's route near
the upper black holes; the 700-unit candidate retains the existing landmarks.
The user accepted this shape after local play; broader human/group testing is
still needed before calling the remaining pinning problem solved.

`server/game/arenaBoundary.ts` supplies signed wall clearance, whole circular-body
containment, projection and swept first wall contact. Body radius plus the existing
8-unit margin offsets the visible outline. Walking and steerable air drift remove
only outward velocity; tangent movement remains available without an extra speed
bonus. Growth/shrink, nudges, impact skids, hopping, safe spawn routes and black-hole
rim routing use the same constraint. Wall-puff redirection follows the curved
normal/tangent within the existing recoil budget; empty puffs gain no movement.

Player-cannonball and turbine flights resolve their straight path only up to the
first physical wall contact. The existing flight-ending/mass/recovery rules run
there; a glancing shot does not slide or bend around the new corner. Safe captive
release chooses a valid open side, and launch placement remains inside the wall.

The arena drawing, clipping and minimap use exact circular arcs with the same
radius. Cut-off corners are dark space, not playable floor. Spawn candidates,
field gems, fan placement, loose/carried parts and deployed weapons stay reachable
inside that outline. Existing growth, ordinary speed, damage, injury, 75% breath
cost, puff reach/strength and input controls are unchanged.

## Verification

- Production build, types and synced-schema checks pass. Lint has zero errors
  and 161 existing warnings.
- All 48 unit suites plus practice-progress checks pass. The new suite includes
  3,840 walking steps across four corners, two tangent directions and widths
  20/100/600/1260. An independent circumference/outline oracle checks the whole
  body, along with speed bounds, rest without jitter, inward release and seams.
- Coverage includes growth/shrink, recoil/drift, hops, bot/human parity, first
  flight wall contact, timeout ejection, outward firing, safe spawns and reachable
  field gems/three-part sets. Actual fixed black-hole layouts retain stable giant
  corner positions and an open retreat route.
- All 60 browser cases pass across desktop Chrome, emulated Android Chrome and
  emulated iPhone Safari: all four corners at small/large/maximum sizes, movement,
  release, inward retreat, server/prediction containment and existing wall puffs.
  The isolated boundary cases disable holes via a non-production test hook;
  separate unit integration controls retain the actual fixed holes.
- Short hands-on local giant movement: up along the top-left curve moved from
  x=26.2/y=26.2 to x=50.8/y=11.0, with about 0.5 world-unit prediction error in that
  observation. This is a mechanical spot check, not a human chase-balance study.
- All 18 real-network multiplayer scenarios pass on the final compiled code.
- Three full five-lesson tutorial runs pass across desktop Chrome, emulated
  Android Chrome and emulated iPhone Safari. Combined browser total: 63 passing
  cases. No physical device or Firefox runtime pass is claimed.

Browser emulation does not establish physical-phone performance or Firefox
compatibility. Further real chase/obstacle/large-player feel tests remain open.

## Local testing

Normal game: <http://localhost:3001/>. Rounded corners are enabled in ordinary
play; no feature toggle is required. The disposable local developer drill at
<http://localhost:3001/rounded-corners.html> lets a tester select a corner and body
size without farming gems; it uses the same authoritative movement and leaves
black holes active. WASD/arrows and the normal touch stick remain available.
The drill files are ignored build output and disappear on the next client build;
they are not part of the game or a production feature gate.
