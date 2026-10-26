# Balance validation — October 26, 2026

Status: growth-only revision selected for release after the user clarified the playtest feedback. PR #45 tracks final CI, merge and deployment. The October 25 sleep checkpoint was commit 5f3cea3. No claim of ideal rarity, hours-long human survival or proven fun is made.

## Current rules

Bots and humans share growth, upkeep, movement, breath, damage, capture/escape, shields, component pickup, claims and weapon access. Bot decisions retain delayed reactions, fallible escape input and imperfect committed aim. Bots gather at every size and assemble/carry/place both recipes through shared systems.

A new arena starts with 950 background crystals. Subsequent replenishment is limited to 30/second arena-wide, with at most one second of stored credit, safe spacing and no live pickup-box fallback. Combat spills are outside this refill budget and conserve value. Scores remain uncapped. Shared upkeep remains the former gentle human rate: 0.1%/second of gems above 300, with no bot-only tax.

The user tried the 3190 preview and reported growth was too quick and the climb too safe. The first 3192 trial used growth mass 0.75. The user found it still too quick and corrected the “too punishing” option as an accidental selection. The latest growth-only revision uses mass 0.5 per banked gem: one-third less than 3192, half the historical original. Combat consequences and recovery remain unchanged. The scale-600, exponent-0.8 later curve preserves useful size differences, and extreme body diameter approaches 30% of the shorter map side. One/40/100/300/1000 gems currently produce width 22.5/66.5/101.5/171.5/301. Currency and score are unchanged.

Missile damage retains the relative physical mass curve, adds bounded energy of 80*r/(r+1) before the bounded speed modifier, and caps damage at 85% of current target gems. Equal-ammunition reference cases finish initially 40/100/300-gem targets in one/two/three clean hits without recovery. Actual swept two/three-hit tests verify the latter cases, value conservation and knockout behavior. Tiny fan/player shots still chip giants and open five-second injury; the controlled small-shot/two-thief case preserves at least 95% of 1000-gem target progress.

Ordinary owners wait three seconds before reclaiming their own damage spill. Player-fired ammunition waits six seconds for its own spent-mass spill, outlasting landing suction protection. Rivals retain the ordinary 350ms pickup opportunity, value is conserved and the delay expires. The 90% missile width cost uses the inverse growth curve. Spawn/escape/landing shields, gust, 600ms daze, loading and two-second respawn were not shortened or removed. Suction recovery is not projectile immunity; the 1.2-second hit grace is shorter than capture loading.

## Findings and limits

The pre-feedback capped economy performed much better than unlimited replenishment: one-hour seed 11 ended with two width-500+ creatures and a 2222-second uninterrupted lead. A separate one-hour seed 29 tracked two creatures at width 500+ for about 55 minutes, plus a third that reached that tier and was later knocked out. These are AI runs, not human skill/feel measurements.

The user's live feedback still found that build too quick and forgiving. The earlier 0.75 combat trial had mixed results (historical comparison, not current growth results):

| Run | Target knockouts before → current | Spent-ammunition knockouts before → current | Current final width-500+ count |
| --- | ---: | ---: | ---: |
| 20 min, seed 29 | 35 → 60 | 159 → 147 | 2 |
| 20 min, seed 73 | 33 → 53 | 124 → 127 | 3 |
| 60 min, seed 11 | 143 → 130 | 477 → 452 | 5 |

That earlier hour-long 0.75 run left five giants, with roughly 47–55-minute giant streaks and no observed giant knockout. Its five largest final widths are about 859/856/798/760/655, followed by 178. This is a clear useful size hierarchy, but the initial two/three-giant target is not consistently achieved. It is never a hard role quota. Do not cherry-pick the two shorter runs or treat giant survival as proof of immortality. A fixed width threshold also changes meaning with growth tuning; judge distributions and decisions as well as counts. The changed physical curve makes cross-build deaths-by-width counts unsuitable as a standalone comparison.

Low target lethality and rapid owner spill recovery were concrete issues: the earlier 100/300-gem reference cases required five/six constant-ammunition hits without any recovery, and owners could reclaim after 1.5 seconds. Most observed deaths were spent ammunition, which obscured actual target mortality. The latest tests distinguish those causes. Minimap markers also exaggerated giant prevalence by reaching maximum radius at roughly 100 gems; their current 2–8px scale spans the whole bounded physical size range.

## Verification

- Current production client/server builds, both type checks, schema synchronization and all ten unit suites pass.
- All 13 real-network multiplayer scenarios pass.
- All 105 affected browser cases are covered across the full run (98 passing) and the seven corrected placement fixtures (7/7 passing), without retries across Chromium/WebKit desktop, iPhone portrait/landscape, Android phone, iPad and Android tablet.
- Same-input, same-seed human/bot role-flip results are identical, including lifetimes. The same game systems process damage, shields, resources and deployment.
- Added regression coverage verifies ten seconds of actual world-loop replenishment, no stored idle refill burst, conserved spills outside the refill budget, finite owner recovery delays, protected respawn and real swept midgame finishing hits through suction recovery.
- Rendered phone capture, tablet/desktop extreme growth, markers, scores, injury/healing, weapon cargo/place, knockout/respawn and fan states were inspected. Faces remain clear and tested camera/canvas states stay inside the full viewport/map.
- Lint has zero errors and 164 existing warnings. Firefox cannot launch on this Windows host. Physical devices, assistive technology and fresh production Core Web Vitals remain unmeasured.

Raw logs/JSON/screenshots are in C:/Users/aiand/Documents/Codex/2026-10-24/lets/work with resume-* (before user feedback) and climb-* (current trial) prefixes. The combined report is outputs/ascend-avoid-balance-evidence.json in the chat workspace. Historical rare-giants-*, selected-* and progression-* experiments are rejected/superseded measurements, not evidence for this trial. Reproduce with npm run build:server, then scripts/balance-playtest.cjs: arena seconds=3600 seed=11 or seconds=1200 seeds=29,73; controls and same-seed human-giant/bot-giant modes are separate. This uses the actual GameState at 30Hz with a seeded clock/random source and the existing fallible AI for every controller.

## Next decision

The latest preview is http://localhost:3194/?playtest=earned-growth. Ports 3190/3192 retain earlier builds. Verify that the smaller physical gains, more decisive hits and delayed spill recovery feel better before calling balance settled. Keep rare, durable giants, meaningful midgame setbacks and comeback opportunities as the goal. No new pinned messages, hidden bot handicaps, forced giant turnover or pressure mechanics.

Further work: assess approach-to-giant mortality and purposeful rival/weapon fights, especially where a few giants monopolize resources; review repeated Pulsar exposure and recovery; use several real humans to judge enjoyment and replay/friend appeal. Existing anti-chain recovery is not blanket invulnerability. Black holes and new weapons remain later design work. Final green CI is required before any merge, followed by deployment and hosted phone/desktop verification; latest user feedback must remain part of that decision.

## UI critique

Conservative internal heuristics, not measured quality ratings: hierarchy 8, usability 8, accessibility 7, consistency 8, responsiveness 8, feedback 8, performance 7 out of 10. Corrected compressed names, oversized dots and extreme-score overflow. Remaining priorities: real touch/keyboard/assistive-technology play; reduce competing transient effects in dense battles and check labels at extreme zoom; measure production responsiveness. Preserve the space theme and arena-first layout rather than adding overlays to chase scores.

## Final growth-only comparison

The corrected user feedback explicitly supports consequential combat and clever play. Only growth mass changed from 0.75 to 0.5; damage, ownership recovery, firing/loading, movement formula and shields were not eased. Bots and humans remain mechanically identical.

| Latest fixed-seed run | Final width-500+ count | Largest count during run | Longest uninterrupted lead | Target missile knockouts |
| --- | ---: | ---: | ---: | ---: |
| 60 min, seed 11 | 1 | 3 | 3303 sec | 140 |
| 20 min, seed 29 | 3 | 3 | 282 sec | 50 |
| 20 min, seed 73 | 3 | 3 | 975 sec | 42 |

In the latest hour run, one creature reached width 500+ and was knocked out after a roughly six-minute large-size streak; the lasting giant maintained that tier for about 53 minutes. Final widths were about 997, 429, 279, 252, 231 and 186 for the six largest creatures. This supports a useful size hierarchy, risk on the climb and a durable reign in these samples. It does not prove a universal maximum of three giants, human enjoyment, optimal pacing or hours-long survival; the threshold is descriptive, not a game quota.

Current checks: ten unit suites, 13 network scenarios, production builds, both type checks, schema and lint pass (zero errors/164 existing warnings). Smaller bodies exposed old test assumptions: fixed flight positions sometimes missed, and a 200-gem stationary creature no longer reached all three weapon components at once. The fixtures now align actual body centers, wait for real swept impact and walk toward the last part while inhaling. The seven placement cases pass across all profiles; the other 98 cases passed in the full matrix. The production ability was not weakened or broadened to satisfy those fixtures.

Latest raw report prefixes: earned-growth-* and earned-* under the chat work directory. Human/group playtest feedback remains the next source of pacing decisions. The accidental “too punishing” selection must not drive future tuning.
