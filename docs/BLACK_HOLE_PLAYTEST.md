# Black holes and integrated combat playtest — October 26, 2026

Release batch: `feat/black-holes-balance-playtest`, based on `5bb717e`. The user authorized committing, merging and deploying this batch after the local verification below. GitHub pull-request and production Actions records identify the published commit and deployment status. Normal play includes the feature; [localhost:3001](http://localhost:3001/) remains available for local testing. No opt-in mode or extra button.

## Black-hole rules

Three stationary cores at (1050,1260), (3150,1260), (2100,3108); provisional core radius 64 and visual ring radius 96 world units. A 2.5-second warning runs when the arena opens. Violet broken rings, an accretion ellipse, a small shot glyph and matching minimap symbols identify them without a permanent panel. Reduced motion stops the ring animation.

Only a player-fired captive entering a core while in flight is knocked out. Collision sweeps the projectile center, so fast shots cannot skip over a core and a giant's outer body does not make it easier to hit. A player struck before the core takes the ordinary shot first. Walking, suction, puff recoil, shot-follow and turbine flights are safe. There is no solid rim or outer gravity to obstruct giant movement.

Normal gem spills, original-shooter attribution, pending belly reward discard, two-second respawn and four-second spawn protection apply. Bots use the same hit rules and can choose a core through their existing fallible aim. No growth, walking, damage, injury-rate, puff, shot-follow or launch-speed constants changed.

One integration defect was corrected: capture now snapshots continued-theft vulnerability before clearing theft state. A victim still vulnerable after the base seven seconds keeps the agreed injured-captive finisher if subsequently captured and fired. The base timer remains unchanged.

## Method and evidence

Seven seeded arena runs used the actual compiled server at 30Hz: three 20-minute seeds (11/29/73) each with and without holes, then one 60-minute run with holes (seed 11). All 20 actors use the existing AI; the human-schema probe is also AI-controlled. These are automated playtests, not human feel validation. All nine production weapon sets across six recipes are initialized and counted. The old script used only one set; its earlier measurements should not be compared as if the fleet were identical.

[Recorded data](playtests/black-hole-balance-2026-10-26.json) includes a source fingerprint, settings, per-minute samples, controlled capture/theft/weapon results and verification counts. Full raw reports remain under `.tmp/black-hole-playtest/` locally. A width of 500 is only the analysis threshold for a giant, never a game quota. Paired seeds diverge after different decisions; three seeds do not establish statistical significance.

| Seed / duration | Holes | Actual defeats | Peak / final giants | Giant defeats | Hole knockouts |
| --- | --- | ---: | --- | ---: | ---: |
| 11 / 20 min | Off | 294 | 4 / 1 | 2 | 0 |
| 11 / 20 min | On | 294 | 4 / 1 | 0 | 11 |
| 29 / 20 min | Off | 270 | 2 / 2 | 1 | 0 |
| 29 / 20 min | On | 273 | 3 / 1 | 1 | 9 |
| 73 / 20 min | Off | 253 | 2 / 1 | 0 | 0 |
| 73 / 20 min | On | 241 | 3 / 2 | 1 | 5 |
| 11 / 60 min | On | 789 | 4 / 3 | 9 | 34 |

The paired 20-minute totals are 817 defeats without holes and 808 with holes, including 25 hole knockouts. In these samples the hazard adds a positional knockout opportunity without increasing overall defeat volume substantially. This is a limited observation, not a causal balance guarantee. The same 20-minute seed 11 is the opening of the hour run and is not an independent additional sample.

The hour run averaged 1.39 giants and ended with three; its longest continuous giant streak was 950 seconds (15m50s). Longest score-leader tenure was 931 seconds (15m31s). There were 63 leader changes after scores exceeded 100. Sustainable hours-long reigns remain unvalidated. Six of the 20 opening lives reached 100 gems before their first defeat (55–110 seconds among those six); this is survivorship-conditioned bot evidence, not an average human opening time. Across the hour, 705 defeats occurred below width 150, 75 at widths 150–499, and nine at 500 or above. Small-player setback frequency needs human observation before further growth tuning.

All six recipes were deployed by the AI. Of 789 hour-run defeats, 402 were in the legacy `spent-missile` event category, which includes fired-captive finishers and spent-ammunition deaths; 127 were cannonball target deaths and 23 injury drains. Do not present the 402 as deaths caused exclusively by healthy ammunition expenditure. Captures numbered 544, observed firing exits 535, injured fired exits 137 and alive non-firing releases nine. Belly bonuses paid 56 gems and discarded 320; quick AI firing leaves little salvage time. These state-transition counters can miss capture-and-fire within one tick and do not model human choices.

## Capture and combat findings

Controlled actual-server capture/hold/fire paths use a 100-gem captive and physical pre-transfer ratios at or just above 1.3×, 2× and 4×. Hold deadlines are 5/8/12 seconds. Each capture moves exactly 30 gems once; a living return with all six bonus gems has 76 gems. A fired injured captive ends at zero with pending rewards discarded. Timeout ejection stays alive with approximately four seconds of suction protection, regardless of injury. Control flight-return cases advance to expiry without a target; real swept shot/core/player hits are covered separately by unit and network browser tests.

An ideal full-stick collector obtains all six interior gems in about 3.817 seconds, even in the minimum hold. Consequently an unhurried 12-second capture can leave about 8.2 seconds with no remaining collectibles. This is a concrete pacing concern to assess with a person. No extra reward spawns, escape mechanic or hold-time change was added to hide it.

Ideal uninterrupted stationary-peer theft removes roughly 24–25% in the first second and finishes in 3.7–3.83 seconds. Two peers finish a 1000-gem target in 1.93 seconds; three in 1.33 seconds. A four-gem thief needs about 6.27 seconds against that target. These controls maintain valid contact, do not allow capture or escape, and are upper-pressure cases. Group pressure combined with the continued-theft vulnerability/capture block remains the clearest balance concern; group diminishing returns is still an unselected design option.

The existing shooter contribution remains bounded: at common speed 1250, 60-width ammunition against a 200-width, 1000-gem target causes 42/49/63 damage from shooters of width 80/200/800. A width-800 shooter using 20-width ammunition causes eight damage in that comparison. No coefficient was adjusted.

The existing giant/assembled-weapon concern remains visible. In the open-arena Pulsar control, a stationary 5000-gem, width-612 target takes three waves (2881 gross damage); moving radially away from the start of the warning still takes one wave (1248). A 100-gem target can avoid every wave with that early response. At the boundary, the large target takes all four waves when its chosen retreat direction is blocked by the wall. Passive decay also runs during these controls, so final gems are not simply initial minus credited damage. Glancing damage/shared hit protection remain decisions for a subsequent pass; no weapon tuning was changed here.

## Verification

- 25 unit suites pass, including swept cores, giant near misses, ordinary-motion safety, original-shooter credit, ordering, protected states, reward conservation/discard and respawn. The capture-finisher suite now covers continued vulnerability after base expiry.
- 18 isolated multiplayer scenarios pass.
- 90 focused browser cases pass across ten desktop/phone/landscape/tablet profiles: real healthy capture and fresh fire into a hole, keyboard/joystick walking across cores, belly controls, immediate-fire edges, puff/follow and vulnerable inhale. Chromium, Gecko and WebKit run locally on this Mac; Ubuntu CI remains deferred. Viewport/touch emulation is not an actual Android/iOS run.
- Types, synced-schema check and production client/server builds pass. Lint: zero errors, 169 warnings. One initial browser assertion read the credit message before the state patch; it now waits for both authoritative death and credit. Gameplay was not changed for that fixture.

## Human playtest route

1. Walk across a violet core, including as a large creature: movement should stay open and safe.
2. Capture a healthy rival, release, aim and tap FIRE toward a core. Compare a direct entry with a near miss outside the core. Check the shooter's credit and protected respawn.
3. While captive, move the interior avatar using the existing controls. Assess whether six gems remain worthwhile and how dull the remaining hold feels after collecting them.
4. Land a shot, use a fresh held inhale to follow, and release to cancel. On arrival aim normally; assess whether an injured peer can still defend with puff or retreat.
5. Try one attacker and then coordinated attackers against a large injured player. Observe reaction time, rather than assuming the ideal-contact knockout times describe ordinary play.
6. Build each recipe while moving, contest spills, and compare Pulsar escape as small and large players. Record growth time, meaningful setbacks and giant tenure in a group session.

Next balance decisions should follow this human feedback. This pass does not claim subjective fun, actual-phone Firefox performance, final values or the hours-long dominance goal has been validated.
