# Balance validation — October 26, 2026

Status: local trial on feature/equal-player-rules, draft PR #45. Main/hosted release remain unchanged while the user evaluates the revised feel. The October 25 sleep checkpoint was commit 5f3cea3. No claim of ideal rarity, hours-long human survival or proven fun is made.

## Current rules

Bots and humans share growth, upkeep, movement, breath, damage, capture/escape, shields, component pickup, claims and weapon access. Bot decisions retain delayed reactions, fallible escape input and imperfect committed aim. Bots gather at every size and assemble/carry/place both recipes through shared systems.

A new arena starts with 950 background crystals. Subsequent replenishment is limited to 30/second arena-wide, with at most one second of stored credit, safe spacing and no live pickup-box fallback. Combat spills are outside this refill budget and conserve value. Scores remain uncapped. Shared upkeep remains the former gentle human rate: 0.1%/second of gems above 300, with no bot-only tax.

The user tried the 3190 preview and reported growth was too quick and the climb too safe. The revised 3192 trial converts each banked gem to 25% less physical growth mass. The scale-600, exponent-0.8 later curve preserves useful size differences, and extreme body diameter approaches 30% of the shorter map side. One/40/100/300/1000 gems currently produce width 23.5/80/123.5/209.5/368. Currency and score are unchanged.

Missile damage retains the relative physical mass curve, adds bounded energy of 80*r/(r+1) before the bounded speed modifier, and caps damage at 85% of current target gems. Equal-ammunition reference cases finish initially 40/100/300-gem targets in one/two/three clean hits without recovery. Actual swept two/three-hit tests verify the latter cases, value conservation and knockout behavior. Tiny fan/player shots still chip giants and open five-second injury; the controlled small-shot/two-thief case preserves at least 95% of 1000-gem target progress.

Ordinary owners wait three seconds before reclaiming their own damage spill. Player-fired ammunition waits six seconds for its own spent-mass spill, outlasting landing suction protection. Rivals retain the ordinary 350ms pickup opportunity, value is conserved and the delay expires. The 90% missile width cost uses the inverse growth curve. Spawn/escape/landing shields, gust, 600ms daze, loading and two-second respawn were not shortened or removed. Suction recovery is not projectile immunity; the 1.2-second hit grace is shorter than capture loading.

## Findings and limits

The pre-feedback capped economy performed much better than unlimited replenishment: one-hour seed 11 ended with two width-500+ creatures and a 2222-second uninterrupted lead. A separate one-hour seed 29 tracked two creatures at width 500+ for about 55 minutes, plus a third that reached that tier and was later knocked out. These are AI runs, not human skill/feel measurements.

The user's live feedback still found that build too quick and forgiving. The current revised trial has mixed results:

| Run | Target knockouts before → current | Spent-ammunition knockouts before → current | Current final width-500+ count |
| --- | ---: | ---: | ---: |
| 20 min, seed 29 | 35 → 60 | 159 → 147 | 2 |
| 20 min, seed 73 | 33 → 53 | 124 → 127 | 3 |
| 60 min, seed 11 | 143 → 130 | 477 → 452 | 5 |

The hour-long current run still leaves five giants, with roughly 47–55-minute giant streaks and no observed giant knockout. Its five largest final widths are about 859/856/798/760/655, followed by 178. This is a clear useful size hierarchy, but the initial two/three-giant target is not consistently achieved. It is never a hard role quota. Do not cherry-pick the two shorter runs or treat giant survival as proof of immortality. A fixed width threshold also changes meaning with growth tuning; judge distributions and decisions as well as counts. The changed physical curve makes cross-build deaths-by-width counts unsuitable as a standalone comparison.

Low target lethality and rapid owner spill recovery were concrete issues: the earlier 100/300-gem reference cases required five/six constant-ammunition hits without any recovery, and owners could reclaim after 1.5 seconds. Most observed deaths were spent ammunition, which obscured actual target mortality. The latest tests distinguish those causes. Minimap markers also exaggerated giant prevalence by reaching maximum radius at roughly 100 gems; their current 2–8px scale spans the whole bounded physical size range.

## Verification

- Current production client/server builds, both type checks, schema synchronization and all ten unit suites pass.
- All 13 real-network multiplayer scenarios pass.
- All 105 affected browser cases pass without retries across Chromium/WebKit desktop, iPhone portrait/landscape, Android phone, iPad and Android tablet.
- Same-input, same-seed human/bot role-flip results are identical, including lifetimes. The same game systems process damage, shields, resources and deployment.
- Added regression coverage verifies ten seconds of actual world-loop replenishment, no stored idle refill burst, conserved spills outside the refill budget, finite owner recovery delays, protected respawn and real swept midgame finishing hits through suction recovery.
- Rendered phone capture, tablet/desktop extreme growth, markers, scores, injury/healing, weapon cargo/place, knockout/respawn and fan states were inspected. Faces remain clear and tested camera/canvas states stay inside the full viewport/map.
- Lint has zero errors and 164 existing warnings. Firefox cannot launch on this Windows host. Physical devices, assistive technology and fresh production Core Web Vitals remain unmeasured.

Raw logs/JSON/screenshots are in C:/Users/aiand/Documents/Codex/2026-10-24/lets/work with resume-* (before user feedback) and climb-* (current trial) prefixes. The combined report is outputs/ascend-avoid-balance-evidence.json in the chat workspace. Historical rare-giants-*, selected-* and progression-* experiments are rejected/superseded measurements, not evidence for this trial. Reproduce with npm run build:server, then scripts/balance-playtest.cjs: arena seconds=3600 seed=11 or seconds=1200 seeds=29,73; controls and same-seed human-giant/bot-giant modes are separate. This uses the actual GameState at 30Hz with a seeded clock/random source and the existing fallible AI for every controller.

## Next decision

The user is evaluating http://localhost:3192/?playtest=climb-combat; 3190 contains the prior rules. Verify that the smaller physical gains, more decisive hits and delayed spill recovery feel better before calling balance settled. Keep rare, durable giants, meaningful midgame setbacks and comeback opportunities as the goal. No new pinned messages, hidden bot handicaps, forced giant turnover or pressure mechanics.

Further work: assess approach-to-giant mortality and purposeful rival/weapon fights, especially where a few giants monopolize resources; review repeated Pulsar exposure and recovery; use several real humans to judge enjoyment and replay/friend appeal. Existing anti-chain recovery is not blanket invulnerability. Black holes and new weapons remain later design work. Final green CI is required before any merge, followed by deployment and hosted phone/desktop verification; latest user feedback must remain part of that decision.

## UI critique

Conservative internal heuristics, not measured quality ratings: hierarchy 8, usability 8, accessibility 7, consistency 8, responsiveness 8, feedback 8, performance 7 out of 10. Corrected compressed names, oversized dots and extreme-score overflow. Remaining priorities: real touch/keyboard/assistive-technology play; reduce competing transient effects in dense battles and check labels at extreme zoom; measure production responsiveness. Preserve the space theme and arena-first layout rather than adding overlays to chase scores.
