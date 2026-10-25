# Balance checkpoint — October 25, 2026

Status: saved at the user's request to stop for sleep. Work is on feature/equal-player-rules; this is not a shipped or fully validated balance release. Main remains the verified PR #44 release.

## Implemented on this branch

- Identical bot/human growth, upkeep, movement, breath, damage, capture, escape protection, pickup, claims and deployment rules. Bot decisions retain delayed reactions, fallible escape input and imperfect committed aim.
- Bots keep gathering beyond 30 gems, collect/carry both weapon recipes and place them using the ordinary system. They select worthwhile ammunition and shots that can threaten a target.
- Safe field replenishment excludes padded live pickup boxes and waits if no position is available. No under-body fallback. Late body size approaches 30% of the shorter map side; gem totals remain uncapped.
- First 40 pickups unchanged. Later physical growth uses scale 600 and power 0.8, preserving useful size differences between established rivals. Pre-impact physical body mass drives missile damage and missile shrinkage uses the inverse growth curve.
- Camera guards sudden growth, extreme score labels stay compact, names truncate without squeezing, minimap dots cannot hide landmarks and large pickup amounts do not queue thousands of animations. No new pinned UI.
- Latest economy trial: initial field 950; subsequent refill at most 30 crystals/second arena-wide, with one second maximum stored credit. Spills retain their value and are outside this refill budget. Shared upkeep is the original gentle human rate: 0.1%/second of gems above 300.

## Evidence so far

Production builds, type/schema checks and 13 isolated multiplayer scenarios passed before the last refill-budget edit. Ten unit suites cover parity, real AI assembly of both recipes, safe replenishment, body bounds, early reward, visible capture advantage and physical missile cost. The checkpoint unit log records the final refill-budget assertions.

Seven Chromium/WebKit profiles covered desktop, phone, tablet and landscape. The last rendered growth/injury/AI matrix passed 49/49 without retries, before the refill-budget edit. Earlier coverage also passed capture/escape, weapon contact/inhale pickup, E/touch placement, gust, fan fit, burnup and field spacing. A zero-duration test protection race was corrected in the nonproduction setup hook. Lint has zero errors and 164 existing warnings. Firefox cannot launch on this Windows host; physical devices, assistive technology and fresh Core Web Vitals were not measured.

Historical seeded tests exposed important failures: bot-only upkeep was far stronger than human upkeep; unchecked field collection/replenishment produced bodies wider than the world; a purely logarithmic growth curve compressed established rivals into nearly equal bodies. Raising shared upkeep alone either allowed late crowding or flattened the climb. Those trials are not proof of the final economy.

With power growth and unlimited refill, a one-hour seed-11 trial at 0.25% excess upkeep still ended with 15 bodies at least 500 units wide, including 13 at least 800. This failed the rarity goal despite bounded dimensions and more small/medium knockouts. The latest refill budget addresses this supply feedback directly and restores gentler upkeep. Its long arena runs were stopped for sleep; no result is claimed.

Raw JSON, logs and screenshots remain in C:/Users/aiand/Documents/Codex/2026-10-24/lets/work. Rejected trial filenames include rare-giants-*, selected-rare-giants-*, and progression-final-*. The interrupted final-budget runs are economy-final-hour and economy-final-seeds; absent JSON means incomplete. Do not present earlier trial results as current release measurements.

## Resume next

1. Read GAME_LOOP.md, GAME_DESIGN.md and TODO.md, inspect this branch and the latest unit log, and preserve the two pre-existing duplicate files that were never part of this work.
2. Build and run scripts/balance-playtest.cjs against the current compiled server: one-hour seed 11 and 20-minute seeds 29,73, then a same-input human/bot role flip and the controlled decay/weapon scenarios. Inspect full time series, not only averages or a chosen width threshold.
3. Assess population size distribution, meaningful leader size advantage, lifetime/knockouts at small and medium sizes, time to capability, weapon use, surviving progress after ordinary attacks and sustainable giant play. Two or three giants per 20 is a target, not a mechanical quota. Do not keep adding passive upkeep to compensate for unlimited resource flow.
4. Rerun final builds, types, schema, unit/network checks and affected browser checks after any changes; inspect rendered phone/tablet/desktop states. The refill-budget edit has not had its full release verification yet.
5. Update these docs with exact final parameters and honest measurements. Obtain green CI for the final commit before merging. Deployment and hosted phone/desktop smoke follow merge. No merge is authorized by a passing test on an earlier candidate.
6. Real multiplayer playtesting remains necessary to judge enjoyment, replay appeal and whether friends create memorable rivalries. Hours-long giant survival and ideal rarity remain unproven. Do not add pressure mechanics or pinned milestone UI.

## UI review at this checkpoint

Conservative internal heuristics, not measured quality scores: hierarchy 8/10, usability 8/10, accessibility 7/10, consistency 8/10, responsiveness 8/10, feedback 8/10, performance 7/10. The rendered extreme-score state keeps faces and controls visible and fixed the squeezed names/oversized minimap dots. Priorities below 9: first assess human touch/keyboard play and assistive-technology access; then reduce competing transient combat effects in crowded encounters and check world-label readability at extreme zoom; measure production responsiveness before further visual polish. Do not redesign the established space theme or add persistent instructional UI to chase these scores.
