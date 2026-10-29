# Smaller bots around larger bots

October 29, 2026. Local review branch, not merged or deployed. The user asked whether smaller bots still avoid larger creatures because a large creature can turn and inhale them too quickly.

## What was tested

Before and after the decision fixes, run the same 630 encounters in the authoritative 30 Hz simulation:

- Physical body-width pairs: 80/100, 100/130, 100/150, 200/300, 400/600, 200/800 and 500/1000.
- Body-edge gaps: 20, 100 and 300 world units.
- The larger creature initially faces the smaller one, sideways or away.
- The larger creature starts healthy or injured; five fixed seeds cover each combination. Injury expires normally after seven seconds.
- Both use ordinary bot brains, delayed decisions, imperfect defense and shared player movement/turning/breath/capture rules. Neither starts with a captive or assembled weapon. There are no ambient gems, weapons or hazards.
- Stop on the smaller creature's first capture, either knockout or 12 seconds. Capture is not counted as death. These starts intentionally include dangerous close contact, so the results are not population-wide capture rates.

[Before](../reports/combat/bot-size-study-before.md) and [after](../reports/combat/bot-size-study-after.md) contain size, distance and initial-health breakdowns. JSON summaries accompany them. Per-encounter input/state observations and combat events are retained in `.tmp/bot-size-study/<report-name>/encounters.json`.

## Findings and local fixes

The smaller bot's flee test previously required an opponent to be 1.5× its width, although the actual shared capture rule is 1.3×. It now calls the same `canCatch` rule used by capture. The incoming-suction escape goal also contained a component toward the attacker. It now combines sideways movement with outward clearance.

Both changes improve decisions. They do not alter a creature's turning rate, movement speed, suction, capture strength, reaction delay or defensive success chance. Humans and bots still have identical capabilities. Smaller bots continue to approach an injured larger target rather than apply healthy-player avoidance unconditionally; 297 of 315 initially injured cases began with an approach in both runs.

| Healthy larger opponent | Before | After |
|---|---:|---:|
| Smaller creature captured, all starts | 232/315 | 169/315 |
| Capture from 20-unit body gap | 87/105 | 86/105 |
| Capture from 100-unit body gap | 88/105 | 61/105 |
| Capture from 300-unit body gap | 57/105 | 22/105 |
| Encounters with a defensive puff | 53/315 | 91/315 |
| Encounters with a successful suction parry | 53/315 | 87/315 |
| Both alive, separation increased by at least 100 | 68/315 | 119/315 |

The stronger improvement at 100/300 units shows that early reaction and escape direction matter. The 20-unit starts remain highly dangerous. In 24 cases the smaller bot was captured before beginning any movement; these are not evidence that reducing reaction mistakes alone can solve point-blank capture. In the current after run, 41 captures occurred within half a second. Healthy capture's reach includes some space beyond the visible shell, especially for large bodies. Human close-contact/latency fairness remains an open concern.

## Rotation

Measured with the actual shared `turnStep`, including acceleration and settling. These values are unchanged by the bot decision fixes:

| Body width | 90° while inhaling | 180° while inhaling | 180° without inhaling |
|---|---:|---:|---:|
| 100 | 0.85s | 1.625s | 1.017s |
| 400 | 1.183s | 2.283s | 1.4s |
| 600 | 1.3s | 2.517s | 1.533s |
| 1000 | 1.475s | 2.85s | 1.725s |

Large bodies turn more slowly and do not snap to a target. That does not prove a nearby smaller creature can circle outside the cone: it also needs to cover a larger orbit, and suction reduces clearance. Avoiding a healthy larger mouth is therefore rational. The tested improvement is earlier escape and real defensive counterplay, not making bots ignore danger. An injury creates a different opportunity because the larger player cannot inhale or puff while injured.

## Limits and reproduction

These are seeded automated encounters, not human playtests, network-delay simulations or proof of ideal fun. Initially injured targets are particularly vulnerable in this empty two-player setup; this study does not establish durable-giant balance in a populated arena. Credit counts in the raw summary include completed theft/mouth-finish events, and omit unfinished transfers without a final credit event.

```powershell
npm run build:server
node scripts/bot-size-study.cjs bot-size-study-after
```

`--recount` rebuilds a named report from its saved event observations without rerunning a historical AI revision. The before report was generated from the code immediately before the two decision fixes; current source reproduces the after run. Bot injury regressions cover danger recognition at the actual capture boundary, attack opportunity while the rival is injured, retreat after healing, shared breathing limits and fallible defensive timing.
