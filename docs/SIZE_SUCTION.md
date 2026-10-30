# Size, rotation and suction — October 30 local trial

The user clarified three interacting rules: larger creatures should rotate more slowly; size advantage should make smaller bodies easier to inhale; and speed should help smaller players avoid the strongest suction, without granting them the body resistance of a larger opponent once caught there. The user explicitly permitted adapting or removing the old inner-zone boost because it predates the new movement rules.

This follows the walking trial at `5da6964` on `codex/smooth-size-movement`. It remains local. The proposed 33% peer-hit damage is not implemented, and this trial is not a release or proof of ideal human balance.

## Rotation follows current physical size

The existing rotation curve already decreases continuously with body width, with an additional 0.55 multiplier while inhaling. Angular acceleration also decreases with size. These nominal settings are retained.

| Physical width | Normal maximum degrees/s | Inhaling maximum degrees/s |
|---:|---:|---:|
| 20 | 315.1 | 173.3 |
| 100 | 210.7 | 115.9 |
| 200 | 177.2 | 97.5 |
| 600 | 134.6 | 74.1 |
| 1,200 | 113.2 | 62.3 |

The shared `turnStep` previously allowed an old, faster spin to decay gradually after growth or starting an inhale. A 20-to-1,200-wide growth example could still turn at about 308 degrees/s on the next frame despite its new 113-degree/s limit. The current angular speed is now bounded to the current size/state before integrating the next facing. Within that limit, acceleration, braking and reversals remain smooth. Loaded aim, human input, bot input and browser prediction all use this step; growth does not turn into an aiming bypass.

## Relative resistance and a gradual strong zone

The healthy capture threshold remains a hunter at least 1.3 times the prey's physical width. That eligibility now grants no sudden overpower bonus. The old `canCatch` switch selecting the full inner-zone boost is removed.

Body resistance uses a smooth curve of hunter/prey width. Near peers get one quarter of the earlier bodily pull; that multiplier grows smoothly to full strength at twice the prey's width. This is a provisional tuning choice, separate from capture eligibility.

| Hunter / prey width | Body-pull multiplier | Share of optional inner boost |
|---:|---:|---:|
| 1.0 | 0.250 | 0 |
| 1.1 | 0.271 | 0 |
| 1.3 | 0.412 | 0 |
| 1.5 | 0.625 | 0.198 |
| 1.8 | 0.922 | 0.802 |
| 2.0 or more | 1.000 | 1.000 |

These are multipliers, not capture probabilities or damage percentages. The inner contribution increases smoothly from zero at 1.3× to full at 2× and only applies in the existing near-mouth zone. The existing full inner cap of 1.6 times prey speed remains available to a sufficiently larger hunter. The body-resistance multiplier is applied after both ordinary and inner pull calculations, so a close-range branch cannot erase a near-sized body's resistance.

Distance, alignment, sustained aim, actual retreat/sideways motion and cone tracking still matter. The hunter walks at its lower size-based speed and turns through its lower rotation limit. Smaller prey have greater walking speed, which helps them avoid entering the inner zone; reaching that zone does not give them additional size resistance. A fast half-width player already at a larger mouth can still be captured before a 250ms response.

Gem attraction, injury theft rates, breath, capture growth transfer, standard bullet size, healthy capture eligibility, injured mouth finishes and missile lethality remain on their existing rules. Injury itself adds no body-resistance penalty. Both bots and humans use the same force calculation.

## Measurements

The before body-pull rule uses the same walking and corrected rotation as the candidate. The only comparison overrides restore the old resistance factor and binary inner boost in isolated headless processes, never a client command or running server. Reproduction after `npm run build:server`:

```text
node scripts/bot-size-study.cjs size-pull-before --baseline-body-pull
node scripts/bot-size-study.cjs size-pull-after
node scripts/size-pull-study.cjs size-pull-before --baseline-body-pull
node scripts/size-pull-study.cjs size-pull-after
```

The 630 ordinary-bot encounters use seven physical width pairs, three body gaps, three orientations, initially healthy/injured larger opponents and five seeds. They stop at first capture, knockout or twelve seconds. Neither starts armed; there are no field gems or hazards. The new baseline option reproduces the previously measured before totals exactly.

| Healthy encounters | Old pull | Gradual size pull |
|---|---:|---:|
| All captures | 166/315 | 140/315 |
| Hunter less than twice as wide | 104/225 | 78/225 |
| Hunter at least twice as wide | 62/90 | 62/90 |
| Captures within half a second | 41 | 39 |
| Encounters ending at least 100 units farther apart | 125 | 139 |

Initially injured larger opponents were knocked out in 252/315 before and 195/315 afterward. Resistance therefore also improves some injured players' chances to survive, without changing theft rates. This does not establish that the pending damage change is balanced. Median time among the captures that still occurred fell from 1.40s to 1.33s; that conditional median cannot be read as easier overall capture when harder catches became escapes.

The separate [96 pursuit cases](../scripts/size-pull-study.cjs) use a walking/aiming hunter, eight physical size pairs, three body gaps, and either no response, a 250ms outward response, a 250ms committed upward response or an 800ms outward response. Each lasts one five-second breath. Captures were 21→21, 15→13, 21→20 and 20→17 out of 24 respectively. An early outward retreat helps; sideways input alone is not a guaranteed escape from an actively tracking hunter. Captured movement and breath expiration are excluded from the active-cone-break metric.

Frozen summaries: [bot encounters before](../reports/combat/size-pull-before.json), [after](../reports/combat/size-pull-after.json), [pursuits before](../reports/combat/size-pull-before-chases.json), [after](../reports/combat/size-pull-after-chases.json).

Three mature twenty-bot population runs (seeds 11/29/73, ten minutes each) compare the walking-only trial with the combined rotation/resistance trial. They are staged populations matching the earlier procedure, not natural-growth or human matches. Captures changed from 125 to 116, launches 117 to 111, all knockouts including ammunition 289 to 248, and pre-knockout widths of at least 500 accounted for 2→6 knockouts. First-place knockouts remained zero. The final procedure and raw traces are in [movement-rivalry.cjs](../scripts/movement-rivalry.cjs) and [reports/movement](../reports/movement). This comparison includes both rotation enforcement and body resistance; it does not isolate their individual effects.

The original released movement baseline had 98 captures in the same three staged runs. Faster travel still produces more total encounters and ammunition than that baseline. The combined trial has not solved leader survival or settled the safety of stronger peer damage.

## Verification

All 36 unit suites plus practice-progress checks pass. New regressions cover strict size-dependent turn limits, growth/inhale overspeed, loaded aim, prediction and actor parity, continuous onset at capture eligibility, proportion-based resistance, actual pursuits and close-mouth captures despite higher prey speed. Types, builds, generated schema and lint checks pass with zero lint errors and the existing 186 warnings.

All 18 multiplayer scenarios pass. The replicated healthy-peer test now expects a visible resistant tug instead of the superseded 90-unit drag. Twelve phone aim/camera regressions pass after the rotation fix. With the final body-pull rule, eight desktop/iPad lesson checks pass, and all four lessons complete with trusted Chromium multi-touch on Android-shaped, 320px narrow and landscape profiles. A separate iPhone WebKit pointer-hold/native-tap run completes the sequence, deliberately misses two shots and two defensive puffs, retries successfully and returns to live play with zero page errors. These are browser profiles, not physical-device or human-fun certification.

The full-touch driver waits for rendered resets and lifts native contacts on an actual retry before starting new gestures. A hold now outlasts the real 180ms tap window; the driver lets theft establish the size advantage before approaching mouth contact. The earlier retry loop could repeatedly send 150ms taps instead of holding, or walk into a peer before following the lesson's theft instruction. These updates model ordinary inputs without state injection, fake success or relaxed server progress requirements. Rendered phone, narrow, landscape, tablet and desktop lesson states were inspected; the earlier narrow loaded-label clipping remains a presentation follow-up.
