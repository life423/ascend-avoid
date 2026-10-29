# Simple missile finish rule and physical-size studies

October 29, 2026. Local review branch only; not merged or deployed. The user's latest explicit choice supersedes the earlier three-condition experiment.

**Latest revision:** [standard 60-unit living bullets](STANDARD_BULLETS.md) and immediate excess-growth capture transfer are now implemented. Current reports are [size finishes](../reports/combat/standard-bullet-size-finishes.md), [small source captives](../reports/combat/standard-bullet-small-captives.md) and [distance fights](../reports/combat/standard-bullet-distance-fights.md). The earlier variable-projectile comparisons below are historical. The 20%-wider shooter rule still applies.

## Current approved rule

**If the shooter was at least 20% wider than the target and lands a player-missile hit, the target shatters. There is no ammunition-size or impact-speed requirement for this finish.**

Compare the shooter's body width at launch with the target's pre-impact body width. Width is visible body diameter in world units, independent of camera zoom. A 300-wide shooter shatters a 250-wide target even with a newborn-sized or slow missile. A 299-wide shooter does not receive that automatic finish against the same target. The comparison uses physical width, never the ratio of gemstone counts. Twenty percent wider is approximately 44% more visible body area.

The server snapshots shooter width when firing. Later growth, damage, death or disconnection cannot change an airborne shot's size advantage. Spawn protection and existing hit immunity still apply. Turbine launches do not receive the deliberate-shot finish. Other hits retain ordinary damage, relative-energy lethality and the existing low-growth knockout. Bots and humans use the same combat rules. Lethal rewards transfer the target's remaining value once, using the existing original-shooter attribution and missing/dead-recipient rules.

## Previous variable-projectile actual-fight checks

Each report runs 30 authoritative 30 Hz fights. Only the attacker initially holds a captured-player shot; the defender starts empty. There are no assembled weapons, parts, ambient gems or hazards. Each fight begins with a real missile hit, then enables ordinary fallible bot inputs until either main fighter is knocked out or 45 seconds passes. The fired captive retains ordinary flight, shrink, landing and respawn rules without an independent third fighter's brain.

| Current report | Opening shatters | Attacker knockouts | Defender knockouts of attacker | Both alive at 45 seconds |
|---|---:|---:|---:|---:|
| [Five body scales × six width ratios](../reports/combat/simple-width-finishes.md) | 15/30 | 25/30 | 0/30 | 5/30 |
| [Same sizes with tiny ammunition](../reports/combat/simple-tiny-finishes.md) | 15/30 | 24/30 | 0/30 | 6/30 |
| [Ten body matchups × three distances](../reports/combat/simple-distance-fights.md) | 6/30 | 23/30 | 1/30 | 6/30 |

The first two reports use shooter widths 100/200/400/650/900 crossed with shooter/target width ratios 1.00/1.10/1.15/1.20/1.30/1.50. Close/medium/long body-edge gaps are 80/360/800 units, balanced across those cases. The substantial-ammunition run requests 65% of target width; the tiny run requests 10%, floored by the normal newborn body size. Both cap ammunition at what the shooter can actually capture before the ordinary growth transfer. All 15 opening hits at or above the 20% boundary shatter in both runs. Actual rounded widths, ammunition and speed are recorded per case.

The distance report includes equal-size opponents, smaller shooters against larger targets and larger shooters against smaller targets, with varied ammunition. The six opening finishes are from shooters 25% or 28.6% wider than their targets. These are selected matchups, not estimates of live shatter frequency.

These experiments intentionally guarantee the first real hit. They evaluate consequences and follow-up, not whether a human can dodge the opening projectile. They contain no latency or touchscreen model. Both alive at timeout is not a defender victory. Human satisfaction and escape fairness remain to be playtested; no most-fun ratio is claimed.

## Mechanical regressions

The size-rule tests check the 20% boundary at five physical target scales (60/120/300/600/1000), tiny and larger projectiles, and impact speeds down to 1 unit/second in the decision function. Actual legal capture/fire/collision tests include tiny projectiles at 60/500/1250 units/second, conserved once-only rewards, a shooter that grows/shrinks/dies/disconnects during flight, and a below-threshold shooter that grows after launch. There is no hidden minimum speed or projectile width for the size-advantage finish.

Ordinary nonlethal missile damage remains stronger than main: mass pivot 1.2, bounded contact-energy term 100, relative-energy shatter threshold 1.2 and the 85% spill ceiling. Tiny shots still cause little ordinary damage to a larger target when the launcher lacks the automatic size advantage. Turbine transport retains the earlier 2.4/80 damage profile.

A surviving deliberate-hit target receives 1.5 seconds of suction recovery, including the existing 450ms daze. Movement resumes after the daze; injury still blocks inhale and empty-mouth puff. Previously held ammunition survives only that brief missile daze and can be fired after recovery. Other hard stuns still release it. The existing mint ring communicates suction recovery without new permanent instructions.

## Smaller bots and larger opponents

[The bot size study](BOT_SIZE_STUDY.md) separately measures ordinary encounters rather than guaranteed missile hits. Its 630 before/after cases exposed an obsolete 1.5× flee threshold despite a 1.3× capture rule, and an escape goal angled toward the mouth. The local fixes improve threat recognition and combine sideways escape with outward clearance. Healthy larger-player capture counts fell from 232/315 to 169/315; injured larger opponents remain attack opportunities. These are bot decision changes using the same movement, turning, breath and combat rules as humans.

## Superseded experiments

The earlier candidate required a shooter-width advantage, ammunition at least 60% of target width, and impact speed at least 937.5. **The user explicitly removed those ammunition/speed gates.** Its 210 fights remain historical evidence, not validation of the current rule:

| Historical shooter advantage | Opening shatters | Attacker knockouts by timeout | Both alive at timeout |
|---|---:|---:|---:|
| 10% | 25/30 | 26/30 | 4/30 |
| 20% | 15/30 | 22/30 | 8/30 |
| 30% | 11/30 | 20/30 | 10/30 |

Historical reports: [10%](../reports/combat/finishing110.md), [20%](../reports/combat/finishing120.md), [30%](../reports/combat/finishing130.md), [45% ammunition](../reports/combat/finishing120-small.md), [60% ammunition](../reports/combat/finishing120-medium.md), [75% ammunition](../reports/combat/finishing120-heavy.md), [old distance study](../reports/combat/size-distance-final.md). Their original parameters and results are preserved; current source reproduces the new reports below.

## Standard bullet implementation

The user approved this design. The implemented standard diameter is 60 units. Capture transfers only growth above that body size immediately; bullet-sized and smaller captives give no instant reward. The shot's physical body is always 60, while a surviving captive's landing body follows its retained growth. [STANDARD_BULLETS.md](STANDARD_BULLETS.md) records the full implementation and current verification.

## Reproduce the current rule

    npm run build:server
    node scripts/combat-study.cjs standard-bullet-size-finishes --finishing
    node scripts/combat-study.cjs standard-bullet-small-captives --finishing --source-ratio=.1
    node scripts/combat-study.cjs standard-bullet-distance-fights
    node scripts/bot-size-study.cjs standard-bullet-bot-sizes

Overrides affect only the offline study process; no live-server client commands were added. Detailed traces are in .tmp/combat-study/<report-name>/ and .tmp/bot-size-study/<report-name>/. The offline CJS harnesses are excluded by repository lint configuration; their actual simulations are executed separately. No additional rendered-browser or human-playtest result is implied by these headless studies.

Verified after the simplified rule and bot decision fixes: the complete unit command, all 18 multiplayer scenarios, client/server type checks, generated wire-type check, scoped TypeScript lint and patch whitespace checks pass. The three current missile reports cover 90 real-hit fights; the bot study records 630 encounters before and 630 after the two decision fixes. These checks do not approve merging or deploying the broader tutorial/combat branch.
