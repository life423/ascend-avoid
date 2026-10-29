# Combat follow-up plan — October 29, 2026

Pre-release checkpoint: implemented and verified on `codex/combat-follow-up-plan`. The user authorized committing, merging to main and deploying on October 29; the GitHub pull request and production workflow record the resulting release status. The original agreed direction is preserved below, with initial implementation choices and evidence recorded separately. Baseline inspected: GitHub `main` at `508c3a2` (PR #54), fetched October 29. The user confirmed the existing purple black holes in the [live game](https://ascend.drewclark.io/).

## Agreed changes

1. **Finish injured players at the mouth.** Healthy, smaller players remain capturable as cannonball ammunition. An injured player pulled fully to the attacker's mouth shatters instead of becoming a captive, and their remaining gems transfer directly to the attacker. Entering inhale range alone is not lethal. Movement remains available to escape before reaching the mouth.
2. **Make injury unmistakable.** Replace the sparse shell lines with readable branching cracks, a warm red-orange internal glow and a slow pulse. Keep eyes readable. Cracks close on healing; a finish bursts along those same cracks. Avoid rapid blinking that could imply invincibility. Keep a readable static treatment for reduced motion.
3. **Disable breathing abilities while injured.** No inhale and no exhale/puff during the active injury state. Movement remains available. Firing an already-held captive is an unresolved decision.
4. **Give lethal player-cannonball hits a decisive payoff.** The target bursts and respawns, and their remaining gems transfer directly to the shooter instead of spilling for collection at the impact site. Not every hit is lethal. The threshold involving target size, ammunition size and impact speed remains undecided, as do nonlethal-hit rewards.
5. **Show black-hole elimination rewards traveling to the shooter.** Black holes already exist. When a player-fired captive enters one and is eliminated, show their gems returning spatially to the shooter. The discussed animation spirals into the hole, then arcs and accelerates toward the shooter. Credit once on the server; animated gems are visual only and cannot be stolen or collected twice.
6. **Remove shot-follow.** Remove its movement, activation sequence and cues, rather than retuning it. Direct reward transfer removes the need to chase a shot's payoff. Review every integration, including owned Comet Battery hits, input ownership, prediction, schema, cleanup, tests and Help.
7. **Investigate bot capture and shot visibility.** Bots already capture, aim and fire, including at black holes. Check actual encounter frequency and visibility before choosing a behavior change. Do not add a tutorial.

## Historical baseline at 508c3a2

| Area | Inspected baseline | Follow-up |
| --- | --- | --- |
| Mouth capture | Healthy and injured eligible prey enter capture; a one-time 30% gem share transfers. Injury is snapshotted so a subsequently fired injured captive dies at a flight ending. | Replace injured capture with a mouth finish. Preserve healthy ammunition capture. |
| Injury | Seven-second base vulnerability plus valid uninterrupted theft continuation. Outgoing body pull and injury drain are reduced to 15%; vulnerable captors cannot start a capture. Puff remains available. | Block breathing throughout the active injury state and align input feedback with the authoritative state. |
| Injury artwork | Rear-shell branching seams already exist, with healing and reduced-motion treatment. | Strengthen their readability, add internal glow/slow pulse, and reuse crack geometry for the finish. |
| Lethal cannonball hit | The target's remaining gems spill; a credit event identifies the launcher. | Transfer directly to the shooter once, subject to the still-open lethality decision. |
| Black hole | Existing active cores eliminate eligible player-fired captives. Ordinary bodies safely slide around soft rims; turbine flights are safe. Remaining gems spill and the original shooter receives attribution. | Add direct reward accounting and spatial return animation to this existing mechanic. |
| Shot-follow | Existing server movement/input handling and client cues; player-cannonball and owned Comet Battery hits can offer it. | Remove the feature and its integrations. |
| Bots | Existing capture eligibility and deliberate aim/fire logic, including core targets. | Measure before selecting a change. |

Relevant source: [inhale/capture](../server/systems/inhale.ts), [flights and black-hole elimination](../server/systems/flights.ts), [injury artwork](../src/render/injury.ts), [black-hole artwork](../src/render/blackHoles.ts), [shot-follow server](../server/systems/shotFollow.ts), [shot-follow cues](../src/render/shotFollow.ts), and [bot mouth/aim/fire](../server/systems/bots.ts).

Existing constants and older playtest results describe the baseline, not accepted settings for this follow-up. Preserve shared human/bot rules, existing injury timing/continuation semantics and ordinary movement unless a later decision changes them. This plan does not restore the superseded arrow-escape or loading mechanics.

## Current local implementation and initial choices

- Injured prey that satisfy the existing 1.3x capture-size rule finish at front-shell contact. The mouth-distance tolerance is `0.20 * attacker width + prey radius`, tighter than healthy capture's `0.35 * attacker width + prey radius`. Inhale range itself is not lethal. All remaining victim gems transfer once; no separate capture share is also paid.
- The existing seven-second injury and valid uninterrupted incoming theft continuation both block breathing. Damage stops an active inhale immediately; healing or interruption after base expiry restores it. Walking is unchanged. Firing an already-held captive remains allowed as the initial choice.
- Healthy capture keeps the existing one-time 30% transfer, captor-only aim, release-before-fire guard and fixed 5/8/12-second hold curve. The captive minigame is removed at the user's subsequent request: no belly lens, interior movement, collectibles, pending bank or safe-return bonuses.
- Player-fired captive impacts are lethal when the existing below-12-gem knockout rule applies, or when `(effective ammo mass / target physical mass) * clamp(speed / 1250, 0, 1.15)^2 >= 1.5`. Effective mass includes the existing bounded shooter contribution captured at firing. This is an initial measured threshold, not final human balance. Turbine shots keep their existing damage rules.
- Lethal player-cannonball and shot-only black-hole outcomes transfer remaining gems directly to the original shooter. Nonlethal cannonball hits retain the existing collectible spill as the initial choice; they do not also pay a direct reward.
- A living recipient is paid immediately; a knocked-out recipient banks the reward until the next protected spawn. If that anonymous shooter session has disconnected, remaining value falls back to an ordinary spill. Attribution still names the original shooter. Repeated resolution cannot pay again.
- Shared crack geometry drives shell damage and finishing shatter. A cached warm glow pulses slowly; reduced motion keeps static readable damage and a quiet reward-destination cue. Healing closes the cracks. Existing rapid recovery blinking is removed.
- Reward messages carry unique IDs. The client draws bounded visual-only gems at a readable size independent of world zoom: spiral into the black hole, arc outward, then accelerate to the shooter. Arrival never controls credit or creates collectible gems.
- Shot-follow server movement, input interception, client cues, schema state, hooks and its tests are removed. Owned Comet Battery hits also stop offering it. The original injured-captive flight finisher is removed because injured prey now finish at the mouth.

## Controlled results and limits

[Recorded measurements](playtests/combat-follow-up-2026-10-29.json) use actual server systems. Reproduce after `npm run build:server` with `node scripts/combat-playtest.cjs --out=report.json`.

Sixty swept-impact cases cover target banks 40/100/300/1000, ammunition 4/40/100/300/1000 and speeds 600/1250/1800, using a 4000-gem shooter's existing bounded contribution. Twenty-three cases are lethal. Examples: a 4-gem round at speed 1800 removes eight gems from a 1000-gem target, which survives; equal 300-gem ammunition at speed 600 leaves 211 gems, while speed 1800 is lethal. These controls demonstrate dependence on size and speed, not universal human balance.

Nine 2.5-second escape controls use a stationary, correctly aimed 300-gem attacker and injured 40-gem prey, starting 20/100/220 units beyond body contact. Idle prey finish at 0.133/0.667/2.067 seconds. Straight retreat survives all three trials; sideways movement survives the 100/220-unit starts, but loses at 20 units after 0.167 seconds. Near-mouth reactions can already be too late. These open-arena controls do not prove escape against tracking attackers, multiple pursuers, walls or skilled humans.

Three seeded 180-second, 20-actor arena runs record 28 bot captures and 27 bot launches, including four black-hole eliminations. An approximate observer viewport contains five captures and six launches. Most events are outside that observer's view; the data does not establish a missing bot capability or justify faster aim. No bot capture/aim timing was changed. Injured bots obey the same breathing gate. No tutorial was added.

## Implementation and validation order

1. Trace existing capture, injury, flight, black-hole and reward lifecycles. Define how immediate mouth finishes replace the injured-capture snapshot path without double-paying the current capture share. Reuse authoritative injury eligibility so base expiry and continued theft cannot produce contradictory art, breathing or finishing behavior.
2. Resolve the held-captive firing question and run controlled escape trials with injured breathing disabled. Compare straight retreat and sideways escape at different starting distances, aim offsets, body sizes and attacker counts. Include boundaries, soft black-hole rims, shields and the healing/continuation boundary. Test keyboard and touch movement. Reaching inhale range must never itself finish a target.
3. Compare candidate cannonball thresholds using actual swept impacts and pre-impact physical sizes/speed. Include weak ammunition against giants, substantial ammunition against smaller rivals, protected targets and multiple hits. Record lethal/nonlethal outcomes and remaining escape opportunities before choosing values.
4. Implement authoritative single-transfer rewards and effects together. Verify conservation against the victim's remaining bank, original shooter attribution through bounces, existing capture transfers, pending belly bonuses, repeated events, simultaneous eliminations, disconnects and shooter knockout/respawn. A credited gem must not also become a collectible spill. Animation completion must not control accounting.
5. Remove shot-follow across server/client code, activation edges, cues and documentation. Verify ordinary movement, aiming, inhale and firing with held/released keyboard and touch input, including after cannonball and Comet Battery hits.
6. Measure bot encounters over several seeds and in human-visible play: eligible prey in reach, approach attempts, successful captures, timeout ejections, valid targets, aim-settle delays, launches, hits and black-hole eliminations. Separate events outside the player's viewport from failures to act; inspect rendered encounters before adjusting behavior. Keep mechanical parity and fallible AI decisions.
7. Inspect injury, healing, mouth shatter and reward-return rendering on phone, tablet and desktop, at small/giant sizes and reduced motion. Preserve readable eyes, the arena-first layout and current performance work. Run affected unit/network/browser checks after implementation and document exactly what passed.

The thresholds above are initial local playtest choices. Human escape opportunities, reaction time, group pressure and repeated lethal-hit pacing remain to be assessed before treating balance as final. Earlier release evidence does not validate this implementation.

## Verification and next playtest

Client/server production builds, both TypeScript checks, generated schema synchronization, lint with zero errors, all 28 unit suites and all 18 real-network scenarios pass. Across the affected runs, 51 applicable browser cases pass on Chromium desktop, Chromium phone and WebKit tablet profiles. The final six injury cases were rerun after caching the glow. Real reward-event cases verify mouth/black-hole outcomes, direct balances, no duplicate collectible value and actual rendered diamond positions between hole and shooter; one screenshot holds the received visual effect at a deterministic return phase without changing server accounting.

Inspected rendered injury/healing, readable eyes, healthy captivity without the interior lens, small-shot giant survival, mouth shatter and black-hole return states. The earlier effect fixture mistakenly expected the event and replicated state patch in the same browser frame; it now waits for the authoritative bank. A Help wording regression was corrected while retaining the established ammunition sentence; current Help is 109 source words. These are emulated viewports, not physical-device or assistive-technology certification. No new production Core Web Vitals or universal 60 FPS claim is made.

Internal UI review heuristics (not measured quality): hierarchy 8, usability 8, accessibility 7, consistency 8, responsiveness 8, feedback 8, performance 8. Priorities are physical touch/keyboard/assistive-technology testing, tiny-body crack readability in crowded fights, and checking reward trails when the shooter is near the viewport edge. Keep the arena clear; do not add a tutorial or permanent explanatory UI to address these.

Next human playtest: escape before reaching the mouth at close range; compare weak/strong ammunition against small, medium and giant targets; check whether the initial lethal-energy threshold feels decisive without making ordinary hits arbitrary. Include tracking attackers, several mouths, walls, changing injury/continuation state, and a shooter being knocked out during a return. Review real bot encounters in view before changing their timing. Release is authorized after the required CI checks; human balance feedback remains a follow-up after deployment.
