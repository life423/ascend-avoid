# Peer missile damage — October 30 headless experiment

The user requested testing roughly 33% damage between similarly sized players together with smooth walking, slower large-body rotation and gradual suction resistance. They specifically asked for different sizes/distances and for ammunition acquisition not to make defeating a peer too easy.

**Decision: keep this candidate disabled.** A meaningful first hit works, but the current capture/reload loop can turn that opening into a very fast finish. This pass measures the problem; it does not declare the balance fun, enable new live damage, merge or deploy.

## Candidate and unchanged rules

Only deliberate player-fired captive missiles use the experimental formula:

```text
damage = round(currentTargetGems * min(0.85, 0.33 * (shooterLaunchWidth / currentTargetWidth)^2))
```

The ratio uses **physical widths**, including the shooter's immutable launch snapshot. At equal width the target loses about 33% of current gems, not 33% of diameter. Half-width shooters remove about 8.25%; 0.75× shooters 18.56%; 0.9× shooters 26.73%; 1.1× shooters 39.93%. The existing lethal checks are separate, including the user-approved **20%-wider-at-launch finish**. That finish overrides nonlethal percentage damage. Existing relative-energy lethality also remains; this experiment does not silently remove it.

Fixed 60-unit living bullets, immediate excess-growth transfer on capture, nonlethal spills, five-second injury, blocked injured breathing, theft, existing impact/suction recovery, hold deadlines, decay and respawn protection remain. Fan transport keeps its existing damage. Both humans and bots use the same collision formula; bot opportunity evaluation uses the candidate too. The normal constant `CANNON.PEER_HIT_SHARE` is **0**, preserving old damage. Only isolated headless processes set it to 0.33; there is no client or running-server switch.

The movement/resistance baseline is the local work in `5da6964` / `cf774a7`, documented in [SIZE_SPEED.md](SIZE_SPEED.md) and [SIZE_SUCTION.md](SIZE_SUCTION.md). These balance changes remain separate from published main `1873710`.

## Method

The [driver](../scripts/peer-damage-study.cjs) ran **7,668 fight executions**: 3,834 matched situations per damage rule, using actual `GameState`, capture, firing, flight collision, movement, suction and bot code. Three repetitions vary seeded bot decisions. Another 405 runs isolate earning ammo, and 15 measure growth on capture. Three staged twenty-bot, ten-minute population runs per rule provide a broader check; the current-damage population results reuse the saved, identical smooth-suction baseline.

- Attacker widths: **100, 200, 400, 650 and 900**. Shooter/target width ratios: **0.5, 0.75, 0.9, 1, 1.1, 1.19 and 1.2**, omitting targets wider than 1,200. Starting fighter edge gaps: **80, 360 and 800** units. A target rounded just over the exact 1.2 boundary is rounded down for that control, so the intended instant-finish case is actually tested.
- Each fight starts with one genuinely captured/fired 32-gem, 60-unit bullet and a **guaranteed actual opening hit**. The defender starts unarmed. This conditions on landing a shot and cannot establish first-shot hit frequency or dodge fairness. Normal spill value remains; the spent initial captive is removed only after its knockout to prevent an idle respawn becoming free spare ammunition.
- No assembled weapons, hazards or ambient field gems. Fighters can collect combat spills, steal, finish at the mouth or capture. A run ends at the first primary knockout/capture, or after 30 seconds. Captures and knockouts are counted separately.
- Reload cases add one initially healthy ammo source, present before firing, at an initial edge gap of **40, 240 or 600**. Source widths are newborn/tiny (20), half the hunter, or the largest legally capturable body. **Active sources use ordinary bot brains. Idle sources are separate cheap-ammo stress controls.** There are no injected replacement captives or replenished breath.
- The focused ammo hunter uses normal movement, aiming and breath at 250ms input intervals. It knows which source and rival to pursue, so these are committed-hunter tests, not estimates of random encounter availability. Stand-alone acquisition also varies front, side and rear orientations over a 20-second budget.
- Ordinary bot firing retains fallible observation, aim offset and planning time. A separate **prompt firing** control releases the capture input, waits for a fresh action, aims through the real rotation cap and fires when aligned. It has precise sampled aim and no bot-only planning delay; it is a stress policy, not a measured human player.
- Defenders use ordinary brains, outward retreat after 250ms, or a diagonal outward/sideways weave alternating every 1.25 seconds at the same 250ms input cadence. Existing stun and injury still apply. Retreat includes boundary avoidance; it is not unlimited off-map flight. These are repeatable input policies, not latency or physical-device validation.

See the [summary tables](../reports/combat/peer-damage-summary.md), [grouped JSON and source hashes](../reports/combat/peer-damage-summary.json), and gzip-compressed per-case result files in `reports/combat/peer-*.json.gz`. They contain ordinary JSON and retain all case summaries without adding thousands of report rows to code review. The summary generator reads saved results; it does not simulate success or change gameplay.

## What improved, and what failed

Without spare ammo, equal-width defenders that immediately retreat survive free and alive in **37/45** candidate cases, versus **40/45** with current damage. Seven candidate cases end in knockout and one in capture. At the 800-unit initial gap, all 15 equal-width retreat cases survive in each rule. Ordinary bot behavior is less defensive: candidate equal-width cases yield 30 knockouts, two captures and 13 free/alive survivors. Returning for a spill or pursuing a target changes the result substantially; movement alone is not a guaranteed escape.

The candidate makes rival shots meaningful. In the three population samples, hits on the current leader rise **2→11**, and runner-up hits on the leader **0→5**. Total captures rise **116→125**, launches **111→117**, and missile hits **59→80**. Current-leader knockouts remain zero; width-at-least-500 knockouts change 6→3. “Current leader” means rank at that tick: a former leader can lose rank before being knocked out. These short staged populations do not prove long-term leader safety, rarity, natural growth or satisfying human fights.

Ammo is harder to earn at a distance, but close half-width prey are still cheap. In the independent acquisition matrix, **45/45** active half-width sources at a 40-unit gap are captured, with **0.87s median** among successes; 39 are captured within two seconds. At 600 units, half-width acquisition falls to 39/45 with a 6.67s conditional median; largest-legal prey fall to 21/45 with 10.77s median. The faster tiny body escapes more often than a half-width source. A smaller body's speed helps outside the strong zone; it does not erase the intended near-mouth vulnerability.

The decisive comparison uses equal-width rivals, **active** ammo and prompt firing:

| Defense after the opening hit | Current-damage knockouts | 33% candidate knockouts | Candidate KOs under 5s |
|---|---:|---:|---:|
| Outward retreat | 35/405 | 139/405 | 58/405 |
| Sideways/outward weave | 35/405 | 124/405 | 51/405 |

For active ammo only 40 units away, prompt fire kills **64/135** retreaters and **57/135** weaving defenders under the candidate, versus 23/135 and 18/135 currently. With ammo 600 units away, those totals drop to 31/135 and 27/135; candidate sub-five-second kills are only 1/135 and 3/135. Distance and ammunition availability matter. These totals cannot be pooled with idle sources, where cheap-capture success is deliberately much higher.

**Concrete fast finish, matched case 547:** both rivals begin 650 wide, with a 360-unit body gap. A healthy 325-wide ammo source starts 40 units to the attacker's side and uses normal bot decisions. The first hit shrinks the defender to 547.5. Capture at 0.8s grows the attacker to about 698, crossing the 20% advantage. With ordinary bot firing, the follow-up kills at **2.97s**; prompt firing kills at **1.83s**, despite the defender retreating after 250ms. The equivalent current-damage cases both survive the 30-second window. The candidate prompt kill happens away from map boundaries. The full [event trace](../reports/combat/peer-fast-reload-case.json) records both impacts, capture, launch and once-only reward. The attacker ends about 813.5 wide, so the finish also supplies a significant growth swing.

## Why the combination compounds

The first hit reduces the defender's body, increasing both its escape speed and the attacker's relative size. At the tested widths, a 33% gem loss changes 100→83, 200→165, 400→334, 650→547.5 and 900→802.5 before recovery or further growth. Escape speed improves only about 3–5%; the injured player still cannot breathe during the five-second window. The 100/200 cases already put an unchanged shooter over the 20% finish threshold. A small pickup or a capture reward can do the same at other scales.

Loading also creates advantage **before any hit**: capturing the largest legal healthy prey grows a 200-wide hunter to 241.5 and a 400-wide hunter to 484. Those shooters can instantly finish their former equal on the next landed shot even with current damage. Largest prey are not always easy to catch, but excluding this growth from a damage test would hide a real interaction. All 15 pre/post capture cases are saved in [peer-loading-growth.json](../reports/combat/peer-loading-growth.json).

Thus 33% cannot be judged as an isolated percentage. It combines with immediate loading growth, collected spills, injury theft, disabled defensive breath and the existing 20% rule. A second missile is often a finish rather than another 33% chip. Landing two shots is still required; this experiment does not say the opener always wins or that every fast kill is unavoidable.

The next balance experiment should keep 33% as the damage candidate and measure a **shared capture-to-fire commitment** before choosing a release. Its duration and presentation are undecided, and no such rule is implemented here. Preserve immediate capture growth, the approved 20% finish and identical actor capabilities while evaluating that trade-off. Human playtests should specifically check close reloads, deliberate sidesteps, visual warning and injured escape on touch controls. This study is evidence to address the reload problem, not justification to ship it unchanged.

## Verification and reproduction

All **37 unit suites plus practice-progress checks**, **18 multiplayer scenarios**, client/server type checks, server build, generated schema and lint checks pass. Lint has zero errors and the existing 186 warnings. New regressions verify default-off behavior, physical-width scaling, bot prediction, actual collision damage, immutable launch size across growth/shrink/death/disconnect, injury, one damaging hit per launch and unchanged transport damage.

This is a headless gameplay experiment with no interface changes. The hosted game is unchanged. No new phone/tablet/desktop visual verification or physical-device claim is made for this experiment; previous movement/tutorial verification is recorded in SIZE_SUCTION.md.

```text
npm run build:server
node scripts/peer-damage-study.cjs --mode=duel --share=0 --repeats=3 --label=peer-current-duels
node scripts/peer-damage-study.cjs --mode=duel --share=0.33 --repeats=3 --label=peer-33-duels
node scripts/peer-damage-study.cjs --mode=duel --share=0 --defense=retreat --repeats=3 --label=peer-current-retreat
node scripts/peer-damage-study.cjs --mode=duel --share=0.33 --defense=retreat --repeats=3 --label=peer-33-retreat
```

For each share/label prefix (`0`/`peer-current`, `0.33`/`peer-33`), run reloads with default bot firing/bot defense (`-reloads`), bot firing/retreat (`-reloads-retreat`), prompt firing/retreat (`-prompt-retreat`), and prompt firing/weave (`-prompt-weave`):

```text
node scripts/peer-damage-study.cjs --mode=reload --share=0.33 --defense=weave --firing=prompt --repeats=3 --label=peer-33-prompt-weave
node scripts/peer-damage-study.cjs --mode=acquire --share=0 --repeats=3 --label=peer-ammo-acquisition
node scripts/peer-damage-study.cjs --mode=loading --share=0 --label=peer-loading-growth
node scripts/movement-rivalry.cjs 11 600 mature peer-33 --peer-share=0.33
node scripts/movement-rivalry.cjs 29 600 mature peer-33 --peer-share=0.33
node scripts/movement-rivalry.cjs 73 600 mature peer-33 --peer-share=0.33
node scripts/summarize-peer-damage.cjs
```

The current population comparison reads the existing `size-pull-after-mature-{11,29,73}.json` baseline; it can be reproduced with the same population command and `--peer-share=0`. Reports include the source base revision and hashes, distinguishing local experiment code from a released build. Raw full per-case event traces are also written under ignored `.tmp/peer-damage-study/`; the decisive trace is copied into tracked reports for review.
