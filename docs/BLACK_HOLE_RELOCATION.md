# Black-hole relocation

Black holes change location through authoritative server phases. These are provisional playtest values, not validated human balance. Physical core radius remains **64 world units**, the decorative outer ring is **96**, and the walking rim adds **8** to the core.

## Lifecycle

| Phase | Duration | Behavior |
| --- | --- | --- |
| Active | 90 seconds | Fixed position with the existing fired-player hazard and safe walking rim. |
| Closing | 3 seconds | The full core and rim remain present at the old position for the entire warning. Lethality does not shrink with the countdown. |
| Dormant | 1.5 seconds after closing | No visible marker, core, collision or reserved old location. Coordinates may change only while dormant. |
| Warning | 4 seconds at a new position | Visible, hollow, harmless warning; no walking displacement or lethal core. |
| Blocked retry | 1 second | Stay dormant and retry when a safe location cannot be found or a warning fails its final safety check. |

The first active periods last **90, 102 and 114 seconds**, with 12 seconds of stagger between slots. Later active periods last 90 seconds. Initial arena locations also receive the four-second opening warning. Tutorial and explicitly placed test landmarks remain static. Only one phase transition occurs per server tick, so a pause cannot silently skip an entire warning.

Immediately before opening, the server repeats placement checks. A late-arriving player, including a flying player, can invalidate the warning: the hole becomes dormant rather than opening underneath them. There is no forced relocation fallback when the arena is crowded.

## Placement and giant routes

The selector shuffles a fixed **17 × 17** grid covering normalized coordinates **0.1–0.9**. A new location must be at least **600 world units** from the last active core and from the most recent warning if it was cancelled. This minimum scales down for smaller arenas. It reserves the visible ring against rounded arena walls, fans, loose part badges and charging/active machines. Every alive player reserves their full physical body plus **120 units** beyond the visible ring, regardless of flight, bot status or spawn protection. Warning, active and closing holes reserve their future physical space; dormant holes do not.

On the current 4,200-unit arena, the maximum legal player width is **1,470**. Hole-pair spacing includes that full width, both cores, both eight-unit rims and a further **64-unit** corridor margin. A conservative 64 × 64 route search also requires all four legal corner body positions to connect to the center. Both nodes and continuous route edges are checked against expanded circular cores; an extra 24-unit routing buffer favors deferral over a narrow placement.

This is a **holes-only route proof plus fan/part/machine reservation**. It does not guarantee globally open giant paths through the existing fans, other players or optional shifting-floor layouts. Existing fan arrangements can already restrict routes. No fan-placement, player speed, damage, growth or arena-size tuning is changed by this selector.

## Visual language

World art and minimap markers use circular dark cores with broken circular violet rings. There are no tilted ellipses. Hollow gold means an upcoming harmless location; gold countdown arcs around a retained dark core mean closing while still dangerous. Dormant markers disappear. Player dots render above hole markers. Reduced motion freezes decorative world rotation, while phase progress continues to communicate hazard timing. The art uses simple canvas circles without blur or gradients.

## Verification

- [Placement tests](../server/tests/black-hole-placement.unit.ts) independently checked **144 generated layouts across 24 seeds**, with full maximum-body corner connectivity on a finer 80 × 80 grid and continuous edge checks. All 144 relocations succeeded in these empty normal-arena runs. Tests also cover bounded no-space deferral, late blockers, flying/human/bot parity, fans, parts, machines, phase reservations and smaller arenas.
- [Lifecycle tests](../server/tests/black-hole-lifecycle.unit.ts) cover phase timing and revalidation. [Giant walking tests](../server/tests/giant-hole-routes.unit.ts) exercise actual authoritative human/bot movement around the initial layout. [Visual checks](../scripts/black-hole-visual-check.mjs) cover phase geometry, truthful closing cores, hollow warnings, dormant hiding, reduced motion, scaling and rendering cost.
- Local focused placement tests, ESLint, server TypeScript and diff checks passed. This does not establish human balance or physical-phone performance.
- The complete local build, schema generation check, type checks, lint (no errors),
  **58 server unit suites** plus UI/helper checks and **18 multiplayer scenarios**
  pass. Nine [real-game browser cases](../tests/e2e/black-holes.spec.mjs) pass across
  Chrome desktop, Android Chrome emulation and Firefox phone viewport: actual
  walking/soft rims, capture/fire/core rewards/respawn and an accelerated real
  retirement/relocation cycle. Screenshot capture was repeated after waiting for
  the new warning to enter the ordinary camera view.

A local 100-search benchmark after cheap geometric rejection measured:

| Scenario | Average selector time | Maximum selector time | Deferred searches |
| --- | --- | --- | --- |
| Normal three-hole arena | 0.88 ms | 4.43 ms | 0 / 100 |
| Single-hole arena | 0.60 ms | 1.79 ms | 0 / 100 |
| Crowded 36-player, two-fan arena | 0.29 ms | 1.30 ms | 100 / 100 |

The crowded case correctly found no safe space. Exhaustively checking all 289 candidates took 8.06 ms with three holes and 55.44 ms with one hole; ordinary selection stops at the first valid result. Candidate generation, shuffling and search are bounded. These measurements are local observations, not production latency guarantees.

### Ordinary-population simulation

Three deterministic seeds (**11, 29, 73**) each ran **180 seconds at 30 Hz** with the original 60-second active period and the default field, fans, weapons, traffic and combat settings. The initial host was converted into a bot after default population fill, yielding **20 autonomous bots** without an idle or invulnerable human affecting the arena. Every run reached five simultaneous fans and at least one charging/active assembled weapon.

| Seed | Successful generation > 0 openings, by slot | No-space selector retries | Cancelled warnings | Longest dormant interval |
| --- | --- | --- | --- | --- |
| 11 | 2 / 2 / 2 | 0 | 1 | 1.5 seconds |
| 29 | 2 / 2 / 2 | 14, all on slot 2 | 4 | 15.5 seconds, still dormant at run end |
| 73 | 3 / 2 / 2 | 0 | 4 | 1.5 seconds |

All slots reopened successfully during every seed: **19 successful openings after location generation changed** in total. No run had all three slots dormant simultaneously. Seed 29 demonstrates intentional temporary deferral under ordinary population: the blocked slot remained harmless while the other two stayed active. Nine failed final warning checks cancelled opening safely. Generation counts also include warned locations that were subsequently cancelled, so they are not themselves successful-opening counts.

Observed selector maximum was **2.96 ms**; a whole update containing relocation took at most **4.30 ms**. Across all 16,200 updates, the largest overall update was **28.43 ms**, with no local tick above the 33.3 ms budget. Ordinary update means were 0.84–0.90 ms; phase-opening ticks peaked at 8.59 ms. Local CPU/JIT/garbage-collection effects and the short sample prevent treating these as production latency guarantees.

These runs check actual lifecycle progress with normal moving populations, not human balance or giant-heavy crowding: the largest observed bot width was **221.5**, well below the legal 1,470 maximum. The independent full-body route tests above cover that geometric maximum. The ignored investigation script and detailed results are `.tmp/black-hole-population-sim.cjs` and `.tmp/black-hole-population-sim.json`.
