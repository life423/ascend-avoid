# Group pressure and arena polish — October 26, 2026

Release batch developed on `feat/group-pressure-arena-polish`, including the previous weapon-fairness pass. GitHub main, the associated pull request and production workflow record the published revision and rollout status. The normal localhost:3001 game includes these mechanics.

## Safe black-hole rims

The user's selected behavior is a soft rim that ordinary players slide around. The shared server/prediction helper sweeps the requested movement against a circle of core radius + physical body radius + **8 units**, spending the remaining movement along the rim. Head-on contact chooses the open side; angled movement honors the player's chosen side. Moving away works immediately. No walking speed or facing change is introduced. Existing overlap caused by growth/placement recovers gently at up to **180 units/s**, including giant bodies pinched near a wall. Spawn candidates avoid rims, with a grid fallback when random candidates are all poor.

The purple rim is visible. Ordinary movement, suction, puff skid and shot-follow route safely around it; airborne players retain existing flight rules. Only eligible player-fired captives entering an active core die, with existing protection, shot attribution, gem spill and respawn handling. Turbine flight remains harmless. Core radius, activation warning and locations are unchanged.

## Group inhale pressure

For positive valid connection strengths with total S and strongest M, the permitted total is `M * (1 + 0.6 * (1 - exp(-(S/M - 1))))`. Multiply each connection by that total divided by S. A solo connection is unchanged; additional mouths approach a combined **1.6×** strongest connection. This applies once to player-body displacement and separately to valid injury-theft rates, using actual connection strengths. Loose gems, cargo collection, capture eligibility and all existing protection remain unchanged.

The authoritative theft plan freezes rates before transfers change either actor's size. Invalid range/aim/state/protection and expired newcomers do not participate or dilute valid pressure. Existing established continuations remain eligible; breaking one after expiry removes it. Outgoing vulnerable drain still receives its existing 15% multiplier once. The injury timer, solo drain rate/ramp and seven-second base window are unchanged.

Ideal tracked 1000-gem peer contact at 30Hz:

| Attackers | Previous knockout | Current knockout | Current gems lost in first second |
|---|---:|---:|---:|
| 1 | 3.80s | 3.80s | 247 |
| 2 | 1.93s | 2.77s | 340 |
| 3 | 1.33s | 2.53s | 375 |

These isolated tests exclude retreat, puff, capture, gathering and upkeep. Groups remain more dangerous. The 0.6 bonus is provisional playtest tuning.

## Assembly and clutter

The owner-only guidance arrow uses the nearest missing component's actual icon plus three small collected/uncollected sockets. Compact views omit floating component names. Mint ownership checks, red locked X marks and amber stealable-carrier cues remain. Six recipes, nine sets, three orbital satellites and collection/claim/theft mechanics are unchanged.

`node scripts/assembly-playtest.cjs report.json` runs 36 actual-world controls across six recipes, three body sizes and contact versus inhale collection. From 300 units from the set center, ideal collection takes **1.10–1.83s with inhale** and **2.07–3.63s by contact**. Every case places while moving. This does not measure searching, opponents, human aim or contested theft; no collection-speed buff follows from these controls.

## Integrated observations and remaining play

One ten-minute seed-11 arena run with twenty existing bots and all nine weapon sets recorded 114 deaths, 88 captures, 83 launches, five black-hole knockouts and deployments of every recipe. Seven timed ejections, pending belly rewards paid/discarded, 58.5 seconds of continued theft and 30.3 seconds of active follow were observed. Giant count peaked at two and ended at two. The preceding same-seed run had 105 deaths and 84 captures; these interacting runs diverge and do not establish a causal balance improvement.

Fixed 5/8/12s holds, 30% one-time capture transfer, six pending belly gems, puff mass/impulse settings, shooter contribution, shot-follow, ordinary walking, damage and bot aim timing were not retuned. Human feel, belly downtime, opening setbacks, rare sustainable giants and real Android Firefox performance still require playtesting. See playtests/group-arena-polish-2026-10-26.json for recorded controls and arena summaries.

## Verification

Twenty-eight unit suites and eighteen real-network multiplayer scenarios pass. The browser matrix covers 154 applicable cases across Chromium, Firefox and WebKit desktop, phone and tablet profiles, with six device-specific skips. The initial seven compact fleet failures expected deliberately removed text; the corrected test checks icon/progress drawing and no floating labels, then passes all ten profiles. All other matrix cases passed. Types, synced schema, production builds and diff checks pass. Lint reports zero errors and 177 warnings. Mobile rim and guidance screenshots were inspected. Normal localhost:3001 was rebuilt/restarted and its health endpoint verified. Ubuntu browser CI remains deferred. These checks were completed before the release request; production rollout verification is recorded separately in the release conversation and GitHub workflow.
