# Balance validation — October 26, 2026

Status: 66adea2 (PR #46) deployed fixed seven-second injury, rapid lethal theft, capped captive transfer and forgiving joystick escape. The October 26 release batch adds stronger body pull, repeat-capture recovery, six weapons with reserved duplicate sets and radar, and mobile button centering. The user approved its main deployment; the associated GitHub pull request and deployment workflow record the merged revision and rollout status. Earlier growth-only release measurements remain historical. No claim of ideal rarity, hours-long human survival or proven fun is made.

## Local body-pull follow-up

Healthy equal 100-gem players are pulled about 35 units in 267ms and 136 in one second in a controlled full-world scenario, without gem theft or injury. Deliberate sideways movement covers about 242 units in two seconds. Against a 1000-gem target over the first 267ms, a 4-gem inhaler moves it about 3 units and a peer inhaler about 33; a 4-gem target moves about 69 before capture. These cases establish immediate visible displacement and size resistance, not perfect balance.

Four-second escape/landing protection and release outside the captor body address repeat capture. Tests include large bodies at arena edges, active gust during recovery, all-attacker immunity and ordinary capture returning after expiry. The previous guard already blocked the defensive parry path during an active shield; the max() deadline update is defensive, not evidence of an exploited shield reset.

## Local six-weapon and mobile layout follow-up

Twelve independent sets provide two copies of each of six recipes. Tests cover first-pickup reservation of every sibling, rival exclusion, available duplicates, one unfinished set per collector, held claims, dropped-claim expiry, knockout/disconnect unlocking, all six real cargo assemblies and placement, AI assembly/placement for every recipe, satellite path continuity, reflected damage, aim-lock warnings and ion firing/cooldown windows. A 120-second full-world smoke simulation with twenty players activated all six kinds (Pinwheel 4, Pulsar 6, Sentinel 4, Ricochet 5, Ion 5, Comet 5), peaked at 27 live bolts and averaged about 3.17ms per server tick on this machine. This is one unseeded smoke check, not a comparative balance or device-performance guarantee.

Mobile labels use measured ink bounds, center the main/helper block and maintain an eight-pixel gap. Browser checks cover ready/cooldown/insufficient breath and loading/queued/fire/spit across phone and tablet profiles. Satellite collection, synchronized sets, lock/radar rendering and orbit traversal pass all eight browser/device profiles. Visual review includes phone portrait/landscape, claim links, guidance, mobile controls and all four new deployed weapons. Longer weapon-hit titles fit available screen width, including their initial pop animation.

Validation: fifteen unit suites and eighteen isolated multiplayer scenarios pass, along with types, synced-schema verification and production builds. Lint has zero errors and 164 existing warnings. The broad browser matrix recorded 281 passes and 36 device-specific skips; three Pulsar fixtures timed out because they assumed stationary reach to the far component. Those fixtures now walk closer, and the expected hit title matches the full recipe name. Pulsar passed all eight profiles after correction. The final production build passed all 21 applicable focused mobile-label, fleet and Pulsar browser cases (three desktop touch-only skips). A separate production-mode preview check confirmed twelve sets/six kinds and measured four frames of the longest new knockout banner inside a 390-pixel viewport. Final phone button and satellite/beam screenshots were inspected. No deployed or multiplayer balance claim follows from these checks.

## Local combat follow-up

The current reference theft rate is max(10 gems/s, 30% of the victim's gem count at injury start per second), modified by size, range, alignment, clean air, escape and a short 80–100% pressure buildup. The snapshot is taken before direct hit damage and does not change when another hit arrives during the same seven seconds. No hit or theft extends an active window; the next damaging hit after expiry can open a new one. Transfers are batched and value-conserving even at uncapped scores. Captive transfer remains a separate nonlethal 20% allowance.

Ideal tracked-contact measurements exclude physical capture, escape, gathering and upkeep. Equal 40/100/1000/10000-gem peers lose 10/25/247/2372 gems in the first second and are knocked out after 3.7/3.73/3.8/3.83 seconds. A 4/40/250-gem attacker can finish a stationary 1000-gem victim in 6.27/5.2/3.97 seconds. Two/three ideal peer attackers finish in 1.93/1.33 seconds. These deliberately serious consequences supersede the old 95%-giant-survival matchup budget. Normal matches can instead end the theft through escape, gusts or capture. Multiple attackers currently add damage normally; no group diminishing-return change is claimed.

Mobile escape retains the joystick and accepts a 60-degree directional error, moderate pushes and a deliberate turn in place of exact centering. Incorrect intermediate angles do not reset progress. Repeated held input does not advance twice, and a held direction through the daze is resent to register when input becomes eligible. Physical-device feel still requires the user's feedback.

Validation for this local pass: production client/server builds, type checks, synced-schema verification, thirteen unit suites and sixteen isolated multiplayer scenarios pass. Eight Chromium/Firefox/WebKit desktop, phone and tablet profiles pass 112 applicable injury/captive-transfer/capture/controls checks plus 15 joystick-specific cases; 25 device-specific cases are skipped. The joystick cases cover 3/4/5 arrows, 55-degree drift, continuous turns, a held direction through daze, and the earliest queued firing deadline. Phone joystick and rapid-theft renderings were inspected. Lint has zero errors and 164 existing warnings; Help is 128 words. These automated results do not establish real-device feel or long-term balance.

## Growth release baseline, before the local combat follow-up

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


## October 26 integrated local mechanics and browser verification

The current working branch integrates the capture redesign, mass-relative puff, fixed-impact shot-follow, sustained theft, bounded shooter contribution and outgoing vulnerability penalty. Earlier arrow-escape/loading/gradual captive-drain measurements above are historical and superseded. Current exact tuning and controlled shooter-size tables are in GAME_DESIGN.md; the request inventory is in TODO.md.

Capture: pre-transfer physical-width anchors are 5s at the legal 1.3× ratio, 8s at 2× and 12s at 4× or above, smoothly interpolated. Proposed initial one-time transfer is 30%; proposed pending belly bonus cap is six. Arrow sequence/daze/loading are removed. Release the capture input, then a fresh action can fire immediately. Fixed hold deadlines, conservation, pending bonus mass isolation, timeout protection, lethal injury snapshot and payout/cleanup are checked using actual server classes and input paths.

Shooter contribution: proposed weight 0.10 and cap 0.75 of ammunition physical mass. A firing snapshot adds bounded attack power while the original current-ammunition impact-mass rule remains. Target resistance, old ceiling, injury/stun, launch-speed/drag and other weapon damage rules are preserved. Physical-size comparisons, later launcher changes/disconnect, immunity, attribution and capture-transfer/fire compatibility have focused tests.

Vulnerability: prototype outgoing player pull and injury drain are 15% of normal; captures are blocked even at close-contact mouths. The seven-second base window is not refreshed. A valid ongoing incoming theft continuation keeps the same penalty active afterward; losing it restores normal outgoing behavior immediately. Loose gems/cargo/bombs, ordinary movement, puff, breath and an already-held captive are unchanged. Incoming continuation is validated before outgoing effects without relying on actor order. The existing clash-winner comparison remains; the outgoing rate multiplier is applied once after that selection. This may make sustained pressure too strong and requires human playtesting.

Verification at this stage: all 24 unit suites, production build, type checking, synced-schema check and 18 fresh-room multiplayer scenarios pass. Lint has zero errors (165 existing/style warnings). The dedicated weakened-inhale visual/close-catch test passes all ten browser profiles, checking a sparse coral flow at the same full reach. Desktop and mobile capture tests cover joystick/keyboard interior routing, pending reward payout, release-before-fire and ordinary movement/aim separation. Browser CI now includes Chromium, Firefox and WebKit with the required CI Build and Test gate waiting on every engine. Full integrated browser regression results are recorded below when complete.

Firefox profiles use desktop Gecko with touch-enabled phone/landscape viewports; Playwright does not emulate an Android Firefox binary. Chrome/Safari phone/tablet profiles are also emulation. These checks do not establish actual-phone FPS, accessibility on physical devices, subjective fun or human balance. Background tests verify a bounded 400-star atlas with no per-frame blur/gradient/canvas allocation; the previously measured desktop Firefox improvement is evidence of removed rendering cost, not a phone-performance guarantee.


Final integrated verification: 480 browser/project cases were scheduled across ten profiles. The full run passed 439, skipped 39 cases not applicable to their device/input type, and exposed two Android-tablet touch-fixture failures. The intended quick tap had used two transport calls that could exceed the tap threshold under load; extra browser setup also consumed the 1.2-second follow offer. Keeping tap edges in one synchronous browser call and setup outside that brief window corrected the fixtures without changing game timing. Both touch tests then passed twice in every profile (40/40). All 441 applicable cases were therefore verified by the full run and focused follow-up; this is not a claim that the original full invocation had zero failures. The weakened-inhale test separately passed 10/10 profiles, including unchanged dotted reach and close-contact capture prevention. Intro/readiness and scroll fixtures now respect initial rendering and Playwright's lack of mobile WebKit wheel support; Chromium uses native touch swipe, Gecko wheel plus touch-cancellation checks, and WebKit keyboard scroll plus touch-cancellation/reachability checks. Actual-phone feedback remains necessary.

Incoming-shot telemetry also includes the real boundary-clamped positional displacement from suction and shot-follow, in addition to walking/skids. It changes warning data only, not movement integration. Focused server tests verify both forced-motion sources. Latest validation: 24/24 unit suites, 18/18 multiplayer scenarios, type checks, schema check and production builds pass. Lint: zero errors, 165 style warnings. At the end of local verification the game ran at localhost:3001, before any merge or deployment. The user subsequently authorized release through GitHub pull-request checks and the existing main-branch deployment pipeline; the pull request and Actions runs record remote verification and deployment status. Browser CI uses two workers to limit contention on hosted runners.


Release CI setup: the first GitHub attempt passed gameplay, Firefox and Chromium, but WebKit spent nearly 15 minutes downloading Ubuntu libraries from a slow package mirror. Browser jobs now use the official matching `mcr.microsoft.com/playwright:v1.64.1-noble` image and verify the installed Playwright version/browser executables before testing. This removes the apt dependency-download step while preserving every required browser check. The test step also aligns the mounted home directory ownership with the container launch user, as required by Firefox; it does not alter the home environment variable or disable browser checks. The final pull-request run records release readiness.

Release decision: the user explicitly deferred Ubuntu browser compatibility work on October 26. The retained browser matrix is temporarily disabled in CI; the required gate still enforces build, types, lint, schema, unit and multiplayer checks. Local cross-browser verification above remains the browser evidence for this release. Restore the browser job condition and require browser success when Ubuntu CI is resumed. No repository branch protection was changed.
