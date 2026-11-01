# Injured escape — November 1 local first pass

The user asked to improve escape after the input fixes. The initial 20-case
tutorial probe was reproduced: a one-second late retreat could die, and a pure
sideways run failed. Reducing suction or slowing inhale turning alone did not
resolve those lesson outcomes, so those broad changes were not retained.

The user's explicit requirement is **identical active physics in the game and
tutorial**. Both use GameState/PlayerSchema and the same movement, suction, damage,
breath, injury and recovery functions. A regression now drives matching normal and
tutorial arenas with identical inputs and compares those outcomes every tick.
Lesson starting conditions and NPC decisions are scenario design, not private
movement/suction multipliers. Preparation can pause safely before an active attempt.

## Shared rule

Outer suction could erase the modest speed advantage of a smaller, faster runner.
The local `retreatPull` cap lets deliberate outward movement preserve part of that
advantage. Default `INHALE.RETREAT_SPEED_KEEP` is **0.5**. It reduces incoming body
pull, without increasing walking speed or adding a shield, stun or new timer.

- The innermost quarter of inhale reach keeps its existing pull. The cap fades in
  smoothly toward half reach, where it takes full effect.
- Its size contribution fades smoothly from equal width to the normal 1.3 capture
  ratio. A half-unit of size does not suddenly cancel suction.
- Its input contribution fades smoothly as projected outward walking exceeds the
  pursuer's speed. Weak analog input, sideways movement, inward movement and stun
  do not automatically receive the full benefit.
- Idle prey remain vulnerable, and large mouths retain strong close-range capture.
  Existing group pressure, theft/damage, injury, finish and protection rules remain.

Bots and humans share this calculation. A faster injured bot now favors outward
retreat with a small lateral component; other bots retain crossing/puff decisions.
Escape goals stay within world bounds. Bot thought intervals and mistakes remain.

## Lesson setup

Defense uses the normal 4200-square arena size, learner center x=900 and a
**600-unit center gap** for injured escape, replacing 480. Both actors start fully
inside the map, with room for diagonal travel. The pursuer makes ordinary movement
and aim decisions every **250ms**, consistent with the normal bots' 200–320ms
range, while its physics and abilities remain shared. Reading/countdown protection,
held movement, stage-only retries, Skip/Exit and unlocked lessons are preserved.

The existing instruction now says to move away and clear the inhale to recover;
the pursuer's existing outline uses a danger accent. No new pinned panel is added.
The seven-second injury deadline is unchanged. Existing continuous theft can keep
breathing blocked beyond that deadline until the connection breaks; the lesson
does not falsely promise that simply waiting restores breathing.

The Android browser check exposed a test-driver error: its 56px thumb gesture
produced about 96% input on the real 68px stick. The driver now reaches full throw
and asserts the public control output. The product's joystick curve was not
changed or given a tutorial-only adjustment; it remains shared with normal play.

## Measurement

Build, then run `node scripts/injured-escape-study.cjs`.
The [21,536 recorded executions](playtests/injured-escape-2026-11-01.json) include:
widths 40/100/200/300; hunter width ratios .75/1/1.1/1.33/1.6/2; shell gaps
60/180/360; reactions 0/350/700ms plus 0/150ms input delay; a 200ms analog ramp;
outward/diagonal/sidestep-then-outward movement; healthy controls; and identical-input
bot/human physics repeats. Four retained-speed settings are compared (0/25/50/75%).
The lesson cases play the real preceding puff exercise and then vary scene setup.

| Injured arena outcome, 1,296 cases per setting | Original | Selected 50% |
| --- | ---: | ---: |
| Fully recovered by cutoff | 164 | 191 |
| Knocked out | 972 | 914 |
| Alive but still vulnerable at 8.5s | 160 | 191 |
| Closest starts knocked out / 432 | 432 | 432 |
| Widest starts knocked out / 432 | 140 | 106 |
| Healthy control captures / 1,296 | 457 | 440 |

The selected setting is a conservative first pass. The 75% alternative yielded
216 full recoveries and 894 knockouts; that does not establish better human feel.
Alive-but-still-vulnerable cases are **not** counted as successful escapes.

With the original lesson setup/rules, direct retreat recovered in 5/10 delayed
input cases and diagonal retreat in 4/10. The selected setup/rules recover 10/10
direct and 9/10 diagonal cases, including up to 1,400ms combined delay plus the
analog ramp. One diagonal case remains vulnerable at cutoff. Pure sideways still
fails in some cases, and moving into the pursuer loses all ten controls.

These are isolated, scripted, pre-injured chases. They omit the initial hit's
damage/daze/knockback, multiple attackers, pickups and fans; they are not a replay
of every missile matchup or a population knockout-rate estimate. Close encounters
are intentionally overrepresented. The 20%-wider missile shatter remains intact.
Human feel, variable networking, real Pixel play and long-term giant survival
remain open; these counts do not prove final fun or universal escape fairness.

## Verification

The final local candidate passes the client/server build and type checks,
43 server unit scripts plus tutorial progress checks, and 18 multiplayer
scenarios. Lint reports zero errors and 187 warnings. The added normal/tutorial
tick-parity regression also passes after its final addition.

The corrected delayed-input browser test passes in Android Chrome, iPhone Safari
portrait and landscape, iPad Safari and desktop Chrome profiles. All five real
lessons pass with ordinary touch controls in the Android browser profile. A
separate 320px reduced-motion case also passes. These are browser-emulated device
profiles, not physical-phone gameplay or performance measurements.

Final screenshots were inspected at Android phone, 320px phone, iPad and desktop
dimensions: both actors remain visible in the delayed-retreat scene, text stays
within the viewport and the tutorial action bar clears the thumb controls.
The existing injury artwork is still a separate unresolved request.

## Review

Internal design heuristics, not measured quality: usability 8, hierarchy 8,
accessibility 8, consistency 9, responsiveness 9, feedback 8, performance 7.
Prioritized remaining checks: real thumb/reaction play, clear recovery feedback
during a continuing connection, and physical-phone frame timing. The separately
requested injury-art overhaul remains on TODO; this pass does not claim to fix it.
All work remains local, with publishing paused.
