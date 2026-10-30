# Capture-to-fire timing with 33% damage

October 30, 2026. The user requested several short delays between capturing ammunition and firing, applied equally to bots and players. During the study they clarified: **“we want total knockouts. those are fun.”** Knockout volume is therefore a positive result. Lower knockout counts, longer survival or slower kills are not success criteria by themselves. Preserve rewarding fights while giving capture and firing a readable sequence.

**Recommendation: one shared second as the next playable-trial candidate.** It preserves both total and non-flight knockout volume in the sampled populations, while placing a meaningful minimum between acquiring ammo and firing. This is a headless/network study, not a completed human feel test. Normal defaults remain `PEER_HIT_SHARE=0` and `CAPTURE_FIRE_DELAY_MS=0`; nothing is merged or deployed by this study.

## The shared rule

The authoritative `fireCaptive` function rejects firing before `captureStartedAt + CAPTURE_FIRE_DELAY_MS`. Both human message paths (`tap` and loaded `inhale`) and bot shooting use that function. There is no actor-specific exemption or weaker-bot damage. Bots retain their existing fallible observation, aiming and planning decisions, which can take longer than the shared minimum.

The delay starts at **capture**, runs concurrently with moving/turning/aiming, and has already elapsed for a captive held long enough. It is not an extra wait after finishing aim or after the previous shot. Growth transfers immediately as approved. Damage remains the width-based 33% candidate, with the existing 20%-wider launch-size finish, standard 60-unit bullet, spills, injury/theft, breath, hold deadlines and respawn rules.

Early attempts preserve the captive, growth, aim, movement and hold deadline. They do not queue an automatic future shot: a fresh action is still required. A new captive starts its own clock. Injury still allows firing an already-held captive; death, disconnect, explicit cleanup and hold expiry still release it normally.

**Documentation correction:** actual injury is **seven seconds**, set by `INHALE.INJURY_MS=7000`. The previous damage study mistakenly described five seconds, but its simulations ran the actual seven-second code. This pass corrects that description and leaves the actual injury rule unchanged.

## Matched comparisons

Tested waits: **0, 250, 500, 750, 1,000, 1,500 and 2,000ms**. There are **21,870 fight executions**, using three repetitions across:

- Five equal starting widths: 100, 200, 400, 650 and 900; fighter edge gaps 80, 360 and 800.
- Ammo source gaps 40, 240 and 600, with tiny, half-width or largest-legally-capturable prey. Active sources use ordinary bot brains; explicitly idle sources remain separate cheap-ammo controls.
- Prompt input with side ammo against outward retreat and outward/sideways weaving; prompt input with forward-diagonal ammo (45°) against weaving. All seven waits are tested in those groups. Rear-diagonal ammo (135°) and ordinary bot aiming/defense also compare 0/1,000/2,000ms.

Each fight begins with a **guaranteed real hit** from genuinely captured ammunition. The opening captive is held for the same three simulated seconds in every candidate, then initial fighter sizes/positions are staged identically. This isolates reload timing instead of allowing a longer first-shot wait to change the encounter before impact. A new zero-delay control uses the same preparation; compare these matched controls rather than mixing absolute counts from the previous study's staging.

Ordinary movement, rotation, suction, collisions, combat pickups and actor state transitions run at 30Hz. Focused hunters know which source/rival to pursue. Prompt firing releases the input, aims through the real turn cap and retries at its normal 250ms decision cadence; its sampled aim is precise. Defenders react after 250ms. Weaving alternates an outward/sideways input every 1.25s; retreat avoids arena boundaries. These are repeatable input policies, not measurements of human aim, mobile latency or first-shot hit accuracy.

A run stops at first primary capture/knockout or thirty seconds. Primary knockout totals count both attacker and defender; healthy captures remain separate. Full per-case summaries are compressed under `reports/combat/load-*.json.gz`; grouped results and exact case timings are in [capture-fire-delay-summary.json](../reports/combat/capture-fire-delay-summary.json), with readable [tables](../reports/combat/capture-fire-delay-summary.md).

## Outcomes and choice

With **active ammo sources**, the primary knockout totals are:

| Wait | Side ammo, weaving defense | Side ammo, retreating defense | Forward ammo, weaving defense |
|---:|---:|---:|---:|
| None | 120/405 | 137/405 | 150/405 |
| 0.25s | 120/405 | 137/405 | 150/405 |
| 0.5s | 119/405 | 138/405 | 150/405 |
| 0.75s | 120/405 | 139/405 | 147/405 |
| **1s** | **120/405** | **139/405** | **138/405** |
| 1.5s | 117/405 | 149/405 | 141/405 |
| 2s | 117/405 | 149/405 | 134/405 |

Short waits often overlap normal release/turning/aiming. The 250ms minimum changes none of these tested outcomes; this does not prove it never matters to faster inputs. A longer wait does not monotonically reduce knockouts: positioning, pickups, launch-time size and shot timing all continue changing. More knockouts are welcome under the user's clarified objective; a quick finish is a timing observation, not automatically a balance failure.

The same 650-wide matched case from the earlier study stays decisive. It starts with a 360-unit fighter gap and a healthy 325-wide source 40 units to the side. Ammo capture takes 0.8s. With retreating defense, the finish occurs at 1.833s with no wait, 2.1s with one second, 2.633s with 1.5 seconds and 3.167s with two seconds. The stronger first hit remains rewarding, and short waits do not erase a successfully earned finish. These are outcomes of that policy/encounter, not proof that another sidestep or human defense must fail.

Twelve staged twenty-bot runs compare four timings: three fixed seeds (11/29/73), ten minutes each. These retain normal field gems, weapons and ongoing respawns, so they measure continued activity rather than just whether one opener wins.

| Shared wait | Total KOs / 30 arena-minutes | Body KOs | Flight KOs | Shots | Hits |
|---:|---:|---:|---:|---:|---:|
| None | 260 | 157 | 103 | 117 | 80 |
| **1s** | **260** | **157** | **103** | **117** | **80** |
| 1.5s | 238 | 150 | 88 | 102 | 75 |
| 2s | 270 | 157 | 113 | 126 | 99 |

Flight KOs classify actors flying in the preceding frame or launched as a captive in the death tick, including spent-missile burnup. Body KOs are the remaining deaths; this frame-based classification is not a complete cause-of-death taxonomy. The extra ten total KOs at two seconds are in the flight category; body KOs remain 157. That distinction prevents mistaking more spent ammunition for ten extra body eliminations. Captive players are real participants, so both categories still contribute to total knockouts. This is not a hard population quota or proof of ideal long-term giant balance.

One second keeps this sampled population's action unchanged and is shorter than the alternatives that noticeably postpone the shot. Ordinary bot-policy fights also have the same **283 primary KOs/810** at zero and one second; two seconds yields 254/810. Their planning already takes at least 1.4s, so an unchanged bot population at one second is expected; it does not mean the timer is bot-only or unimplemented. Prompt human-like inputs remain constrained by the same server gate.

The one-second choice trades some immediacy for a short, predictable capture beat, preserves the measured knockout volume and still permits fast prepared finishes. It is a **provisional playtest choice**, not a statistically established optimum. The first study's concern about easy ammo should now be judged alongside the positive value of knockouts, not used as a reason to make everyone survive.

## Input feedback and limits

A firing minimum creates a temporary unavailable action. Before enabling it in a playable build, make readiness understandable through existing contextual loaded controls/creature feedback and preserve chosen aim after an early tap. Avoid a new permanent banner or an unexplained dead button. No readiness UI, queued shot, mobile control change or extra progress indicator is implemented in this experiment.

Human playtests still need to decide whether one second feels responsive and whether the extra beat is readable on touch. These automated trials cannot certify fun or unfairness from a kill time or survival percentage. The damage candidate and delay remain disabled in normal games; no new rendered phone/tablet/desktop validation is claimed for this headless pass.

## Verification and reproduction

All **38 unit suites plus practice-progress checks**, **18 standard multiplayer scenarios**, type checks, server build, schema checks and lint pass (zero lint errors, existing 186 warnings). New boundary/lifecycle regressions cover both `isBot` values at every tested wait. Every simulated launch asserts the server minimum, including autonomous source bots. [The isolated network driver](../scripts/capture-fire-delay-network.mjs) also verifies both human message paths at 750/1,000/2,000ms, retention after early input, no queued automatic shot and an actual 33%-damage hit: **six network cases**. Its trial constants exist only in its child server processes.

After `npm run build:server`, repeat for each wait and matching label:

```text
node scripts/peer-damage-study.cjs --mode=reload --share=0.33 --firing=prompt --defense=weave --load-ms=1000 --repeats=3 --label=load-1000-prompt-weave
node scripts/peer-damage-study.cjs --mode=reload --share=0.33 --firing=prompt --defense=retreat --load-ms=1000 --repeats=3 --label=load-1000-prompt-retreat
node scripts/peer-damage-study.cjs --mode=reload --share=0.33 --firing=prompt --defense=weave --ammo-angle=45 --load-ms=1000 --repeats=3 --label=load-1000-front-weave
```

The rear-ammo comparison adds `--ammo-angle=135` and uses `load-{wait}-rear-weave`; the ordinary bot comparison uses `--firing=bot --defense=bot` and `load-{wait}-bot`, at waits 0/1,000/2,000. Population commands use waits 0/1,000/1,500/2,000 and seeds 11/29/73:

```text
node scripts/movement-rivalry.cjs 11 600 mature load-1000 --peer-share=0.33 --load-ms=1000
node scripts/capture-fire-delay-network.mjs
node scripts/summarize-capture-fire-delay.cjs
```

The summary records source hashes and the source-base commit. Full event traces are written under ignored `.tmp/peer-damage-study/`. Previous study results remain historical evidence; current conclusions apply the user's later knockout-focused objective.
