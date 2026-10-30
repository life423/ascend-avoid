# Size-based walking — October 30 local trial

The user requested distinct maximum walking speeds for distinct physical sizes, with a real escape benefit after shrinking. They also want strong missile damage between similarly sized players, based on the shooter's and victim's visible widths, without making ammunition collection and repeated rival knockouts too easy. This page records the walking-only trial at `5da6964`. The later [rotation and suction follow-up](SIZE_SUCTION.md) adds immediate rotation-limit enforcement and smoother size-dependent body resistance; its measurements are separate. The discussed 30–33% peer-hit damage remains a proposal; the fixed 60-unit bullets, capture transfer, injury, theft, shot speed and 20%-wider explosive finish retain their existing rules.

This work originated on `codex/smooth-size-movement`, based on main `1873710`. On October 30 the user authorized merging and pushing it with `codex/capture-fire-delay-study`; GitHub's PR and main deployment workflow identify the published revision. The walking rule is included in that release batch; the later 33% damage and one-second loading settings remain disabled. The walking-only measurements below remain provisional evidence, not a claim of settled human balance.

## Shared rule

`speed = 320 * (20 / bodyWidth) ** 0.25`, for normal legal body widths of at least 20 units. The exponent is a tuning value, not a claim of optimal fun.

The old square-root curve reached a hard 130-unit/s floor at about 121 units wide. The new quarter-power curve has no plateau. Every larger legal half-unit width has a lower maximum walking speed, with no integer rounding. Different gem totals can still produce the same physical width and therefore the same speed. Throttle input, acceleration, collisions, stuns, gusts and flight still affect actual motion.

Half-width prey have an approximately 18.9% speed advantage at every scale. Prey just small enough for the shared 1.3× capture rule have a 6.8% speed advantage. The largest legal normal-world body is 1,260 units, where walking remains about 113.6 units/s. A hard minimum is unnecessary over that bounded range.

Simply removing the floor while retaining the old square-root exponent would slow the largest legal creature to about 40 units/s. A soft lower bound can avoid that, but makes the difference between large rivals progressively tiny. The quarter-power trial instead preserves the relative speed advantage across scales while retaining useful giant travel. Its trade-off is substantially faster small/medium creatures: a 100-wide body moves about 50% faster than before. The measurements below assess that trade-off; it is not a free balance improvement.

| Body width | Previous units/s | Trial units/s |
|---:|---:|---:|
| 20 | 320.0 | 320.0 |
| 100 | 143.1 | 214.0 |
| 200 | 130.0 | 179.9 |
| 400 | 130.0 | 151.3 |
| 600 | 130.0 | 136.7 |
| 900 | 130.0 | 123.6 |
| 1,200 | 130.0 | 115.0 |

For an illustrative shrink from 600 to about 505 wide, maximum speed rises from 136.7 to 142.8. Actual unobstructed walking opens over 40 extra units in seven seconds, compared with no advantage on the previous plateau. This is a movement measurement; no new missile damage was applied, and it does not guarantee escape from suction, a boundary or a prepared shot.

The browser's prediction and authoritative server both call `server/game/movement.ts::walk`. Humans and bots share that function. Suction speed caps and escape normalization, turbine intake, bot arrival estimates and camera threat framing already use the same `moveSpeed` helper. They follow the new curve together. Turning, acceleration, breath costs and bot reaction/aim errors were unchanged in these walking-only measurements. The later rotation/suction follow-up is documented separately.

## Before/after observations

The same [630 encounter procedure](../scripts/bot-size-study.cjs) ran on released main and on the movement trial: seven physical width pairs, three body-edge gaps, three orientations, healthy/injured larger opponent and five seeds. Ordinary bot brains and shared mechanics run at 30 Hz for at most 12 seconds. There are no field gems, weapons or hazards; neither creature starts loaded. Capture ends an encounter and is not itself a knockout. The initially injured larger creature heals normally if it escapes continued theft.

| Outcome | Previous | Trial |
|---|---:|---:|
| Healthy smaller player captured | 169/315 | 169/315 |
| Captured within half a second | 41/315 | 41/315 |
| Median capture time | 1.33s | 1.43s |
| Healthy encounters ending at least 100 units farther apart | 119/315 | 119/315 |
| Initially injured larger player knocked out | 225/315 | 249/315 |

Raw summaries: [before](../reports/combat/size-speed-before.json), [after](../reports/combat/size-speed-after.json). Distinct speeds did not improve aggregate healthy escape success in this sample, although some matchups changed. Close-mouth captures remain dangerous. Faster smaller attackers also made initially injured larger opponents more vulnerable. This is a reason to measure the proposed damage separately.

A second procedure runs twenty ordinary bots in a normal arena for ten simulated minutes, with weapons, field replenishment and shared protections. It starts from a controlled mature population whose top three stocks match the user's screenshot (4,398/4,028/2,826), distributed across the map, and uses seeds 11/29/73. These are deliberately staged populations, not natural-growth or human matches.

| Three-run total | Previous | Trial |
|---|---:|---:|
| Healthy captures | 98 | 125 |
| Captive launches | 94 | 117 |
| Player-missile impacts | 50 | 68 |
| Impacts on the current leader | 5 | 4 |
| Deliberate shots targeting the current leader | 0 | 1 |
| Knockouts while holding first place | 0 | 0 |
| All knockouts, including spent ammunition | 210 | 289 |
| Knockouts at a pre-knockout width of at least 500 | 7 | 2 |

Reports are in [reports/movement](../reports/movement). The exact candidate procedure is [movement-rivalry.cjs](../scripts/movement-rivalry.cjs). `revision` records the checkout base; the report's movement parameters identify the actual working-tree rule. To reproduce a comparison, build the server on each revision before running the same seed/configuration. The before rule is exponent 0.5 with floor 130; the trial is exponent 0.25 without a floor.

The population procedure was added with this trial; retain a copy in `.tmp/` when checking out the earlier revision to reproduce its baseline. Its relative server imports work from either `scripts/` or `.tmp/`. The existing bot-size procedure is present in both revisions.

More captures in a populated world do not establish easier individual captures: faster travel also changes encounter frequency, trajectories and opportunities. Nevertheless, ammunition supply increased in all three samples. The movement change alone did not solve leader survival. Do not combine it with stronger missile damage and declare that the user's reload/rivalry concern is resolved.

## Verification and next decision

The new size-speed unit suite checks every legal half-unit width for a strict speed difference, useful relative escape margins, minimum giant mobility, actual analog-input prediction/server agreement, immediate slowdown after growth and measured distance after shrinking. Existing gameplay and spawn tests no longer assert the superseded flat floor. All 34 unit suites plus practice-progress checks, types, client/server builds, generated schema and lint pass (zero lint errors, 186 existing warnings). All 18 multiplayer scenarios pass.

Twelve phone aim/camera regressions pass across Android-shaped Chromium, 320px portrait Chromium, landscape Chromium and iPhone WebKit. All four tutorials complete with trusted Chromium multi-touch on Android, narrow and landscape profiles. Eight individual lesson checks pass on desktop Chromium and iPad WebKit. A separate iPhone WebKit pointer-hold/native-tap playthrough completes all four lessons, deliberately misses two shots and two defensive puffs, retries successfully and returns to live play with zero page errors. These are emulated browser profiles, not physical-device or human-fun certification.

The first landscape full-touch test stopped walking at a fixed 90-unit center gap and later waited outside mouth-finish range. The gesture driver now follows the actual instruction to continue toward body contact while inhaling, including after a real retry. The final full-touch pass succeeds on all three Chromium profiles; it uses ordinary inputs and genuine server success, with no state injection. Rendered phone, narrow portrait, landscape, tablet and desktop lesson states were inspected for visible bodies/eyes, controls and arena framing. A loaded status label can still clip at the left edge of the 320px black-hole framing; this is a presentation follow-up, not a movement or lesson-completion failure.

Before combining this movement trial with stronger damage, compare the proposed physical-width damage curve in real launches and varied-distance fights. Start one attacker loaded and the defender empty; also check a prepared defensive shot, retreat, sideways movement, warning/parry timing and touch reaction delay. Measure spill collection, when the attacker crosses the 20% finish or 1.3× mouth-finish threshold, and how often a survivor can actually break contact. The current injury theft rate uses the pre-hit balance, so increased initial loss compounds the follow-up. Keep an identical damage prediction for bot targeting and real collisions, and measure reload availability and leader exposure in population runs. No bot-only damage, growth or movement handicap is part of this work.
