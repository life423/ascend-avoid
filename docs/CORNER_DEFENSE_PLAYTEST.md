# Corner escapes and defense — November 3, 2026

The released defense is mechanically working in the checked cases, but a good
puff does not consistently create a useful escape from a tracking pursuer at a
rounded corner. The first follow-up to investigate is how wall-slip is activated
while fleeing, rather than another increase in breath cost.

Tested release: `8a9f04a38a6131d68de20d164f54cada358db1c2`. No production source,
physics constants, puff cost, strength, immunity or capture rules were changed.
The original Menu box and minimap layout remain intact. This is a local study,
not a deployment or an approval to change balance.

## What was actually played and measured

- **Nine UI-directed local drills:** I selected the encounter and manually timed
  puff requests while the fixture supplied an ordinary keyboard sidestep. The
  other clients continuously steered/aimed through normal network messages. This
  is an interactive drill, not a human multiplayer match or a physical-phone test.
- **24 real-browser runs:** eight encounters each on desktop Chrome, Android
  Chrome emulation and iPhone Safari emulation. Defenders used the existing
  keyboard/thumb controls. Trackers used real game connections, with observed
  inhaling state. Every case passed the mechanical checks; that does not mean
  every defender escaped.
- **1,872 deterministic scripted cases** at the released server's 30 Hz step,
  repeated at 60 Hz as a sensitivity comparison. Both runs used the unchanged
  authoritative `GameState`, normal movement, aiming, breath and puff functions.

The exhaustive cases compare open space, a straight left wall and the top-left
curve, defender widths 60/150/300, pursuer width ratios 1/1.35/1.75/2.5, body-edge
gaps 30/100/240/400, and one/two pursuers. The other six boundaries have rotated
spot checks. Supplementary soft-hole setups include widths up to 600. Those often
end before meaningful rim navigation, so real rim-chase testing remains open.

Trackers retarget every 100 ms, obey normal turning, and restart inhale only after
recovering 25% breath. They are scripted tracking opponents, **not production bot
AI**. The defender follows the local wall tangent. The first simulation cast is
preemptive at time zero: an optimistic comparison, not a claim about human reaction
time. Retried requests occur every 100 ms and are accepted/rejected by normal breath
rules. Six-second survival is not a permanent escape.

## Findings

### 1. Wall-slip activates, but tracking often defeats the opening

The local UI drill produced one accepted puff and a confirmed wall-slip on the
curve, then capture at about **1.8 seconds**. Two pursuers captured the defender at
about **1.1 seconds**. A large defender against a 1.75×-width pursuer was captured
at about **1.4 seconds**, also after a confirmed puff and wall-slip.

The corresponding browser results were consistent across the three profiles:

| Encounter, 240-unit initial body gap | Result after one early puff |
| --- | --- |
| Straight wall, medium defender, one 1.35× pursuer | Survived the six-second run on all three profiles |
| Rounded corner, same sizes | Captured at 1.85–1.95 s |
| Rounded corner, two 1.35× pursuers | Captured at 1.10–1.14 s |
| Rounded corner, large defender, one 1.75× pursuer | Captured at 1.25–1.32 s |
| Rounded corner, two equal-size pursuers | No capture during six seconds, as required by size eligibility |

The straight-wall no-puff browser baseline ranged from capture at 3.1/4.6 seconds
to six-second survival. The UI baseline also survived six seconds. Therefore the
wall result is **not** proof that the puff alone caused every survival; network,
input and pursuit timing matter. No cross-browser balance ranking is inferred.

The paired deterministic comparison is less noisy but deliberately adversarial:

| Capture-eligible scripted cases (72 per column) | Straight wall captures by 6 s | Rounded-corner captures by 6 s |
| --- | ---: | ---: |
| No puff | 65 | 69 |
| One initial front-facing puff | 63 | 69 |
| Repeated normal puff requests, initially front-facing | 60 | 67 |
| One puff while already facing the escape direction | 65 | 69 |

Equal-size cases are excluded from this table because those pursuers cannot
capture. Twenty-five baseline cases per site ended before 250 ms; many starts are
already extremely close to the mouth. Even after excluding those, the first puff
added two six-second survivals at the wall and none at the curve. This identifies
an experiment target; it is not a live-match capture rate or proof that all other
escape paths fail.

The redirect spends existing recoil, with drag 12/s and a 420-unit/s cap. Its
unobstructed extra travel is at most **35 world units**; the median recorded
redirect had an upper bound of about **26.5 units**. Walking, suction and contact
also act, so that upper bound is not measured net separation. Continued aiming
can consume this small opening quickly without an involuntary control lock.

### 2. Running-and-tapping can spend 75% without hitting the pursuer

In the corner running-puff case, all three browser profiles recorded one accepted
puff, **zero front recoil, zero wall-slip and zero rear hits**. Capture followed
at roughly 1.7–1.9 seconds. The UI running-wall case also spent the breath with
no hit or slip.

The instantaneous front cone is 110° wide; the delayed rear sweep is 140°. The
wrap is not an omnidirectional shield. A pursuer approaching from the side can
miss both usable areas; actual body width and wave timing also matter. Movement
normally turns the player toward their steering direction. Therefore a tap while
sidestepping is mechanically different from facing the hunter and then puffing.

Most importantly, **only the immediate front hit supplies caster recoil for
wall-slip**. Rear gust hits push the pursuer but do not supply that caster recoil.
The current wall-slip tests had forced a useful front facing and a stationary
pursuer; passing them did not establish that a natural fleeing tap creates an
escape opening against a moving opponent.

### 3. The anti-spam and safety mechanics held up

- Three rapid UI taps in about one second produced **one accepted puff**.
- The scripted six-second runs accepted at most three puffs, with ordinary refill.
- Each accepted browser puff spent exactly 75 percentage points, leaving 25%.
- No measured out-of-bounds bodies, unintended stun/skid locks, or illegal
  equal-size captures occurred in the scripted cases; the browser checks also
  passed movement/bounds/control-state assertions.
- Hunters retained ordinary inhale. There was no automatic pressure wipe, added
  immunity or guaranteed escape. Those remain intentional rules.

### 4. The corner camera can put the fight under the leaderboard

The captured phone views also show top-left combat beneath the score/leaderboard.
The camera keeps the viewport inside the arena, but that does not guarantee
unobstructed eyes, airflow or recoil feedback. This was a visual observation, not
an occlusion-percentage measurement. Review fight readability at corners alongside
ability activation; preserve the explicitly restored top-right Menu layout.

## Follow-up — implemented locally after this baseline study

The user subsequently authorized this experiment. See [REAR_WALL_SLIP.md](REAR_WALL_SLIP.md)
for the local implementation and comparison. The original recommendation was:

Prototype a bounded wall-slip contribution from a **confirmed rear-gust hit**,
so normal fleeing can activate the escape aid without first turning toward the
pursuer. Tie it to actual contact and one finite per-cast recoil budget; retain
75% cost, current recipient shove strength, ordinary turning/capture, and no
empty-puff dash, stun, immunity or pressure reset. Compare it with the current
release using the same tracking cases before choosing a balance change.

Separately, improve the direction/hit feedback so a flank miss is understandable.
Do not expand the damaging arc or make the animation imply full coverage without
an explicit decision. If activation improves but the opening still disappears
immediately, then compare physical slip duration/travel as its own experiment.

Longer matches with people, actual Pixel/Firefox performance, free-choice escape
paths rather than one scripted tangent, production bot behavior, and meaningful
black-hole-rim chases remain open. These checks do not validate human fun.

## Evidence and reproduction

[Compact results, browser records and UI observations](playtests/corner-defense-2026-11-03.json)
are retained with this report. Full per-case rows/logs/screenshots are ignored in
`.tmp/corner-defense-*`. No screenshot or state mutation is used to force a trial
outcome; setup hooks only prepare isolated development rooms.

```sh
npm run build
node scripts/corner-defense-playtest.cjs
CORNER_PLAYTEST_HZ=60 node scripts/corner-defense-playtest.cjs
E2E_START_SERVER=1 E2E_TEST_HOOKS=1 E2E_URL=http://127.0.0.1:3002 npx playwright test tests/e2e/corner-defense-playtest.spec.mjs --project='Chrome (desktop)' --project='Android phone (Chrome)' --project='iPhone (Safari)' --workers=2 --retries=0
```

For an interactive local drill after building, run
`node scripts/corner-defense-drill.mjs` and open
`http://localhost:3001/corner-defense.html` with the development server running.
It uses the real game, existing controls and guarded development setup hooks.
The helper page checks for a localhost origin; a fresh build removes its output.
It is never imported by the ordinary game or included by the release build.
