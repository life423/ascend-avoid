# Rival hits and exhausted input — November 1 local candidate

The user approved working on stronger large-rival hits, their connected balance
effects, and clearer exhausted-input feedback. They explicitly retained the
standard **60-unit player bullet** and reminded us that larger targets are easier
to hit. Everything stays local: no commit, push, merge or deployment.

## Local starting choice: 25%, preserving stronger early hits

`CANNON.PEER_HIT_SHARE` is now **0.25** in this local branch. It is an initial
playable candidate, not a claim of final balance. Deliberate player-missile damage
uses the greater of the previous mass-based damage and:

```text
round(targetGems * min(0.85, 0.25 * (shooterLaunchWidth / targetImpactWidth)^2))
```

The ratio is physical width, not score. The stored shooter width is immutable
after firing; target width is evaluated at impact. The fixed projectile body,
launch speed/drag, existing injury, ordinary spill/owner recovery, immunity,
capture growth and 20%-wider shatter rules remain. Fan transport and assembled
weapons do not inherit this floor. Humans, bots and tutorials use the same damage;
bot opportunity scoring already calls that shared function. There is no new
capture-to-fire wait: the separate loading experiment remains disabled.

Why start below 33%: stronger loss also shrinks the defender, changes speed and
suction resistance, and changes the next shot's physical-size comparison. Nearby
ammo and immediate capture growth can amplify it further. Pure 33% would also
soften existing small/early impacts; taking the greater damage avoids that nerf.

Equal-size launch-speed examples, before further pickups/decay or flight drag:

| Width | Previous loss | Local loss | Defender width afterward | Original shooter 20% wider afterward? |
| ---: | ---: | ---: | ---: | :--- |
| 100 | 56.7% | 56.7% | 68 | Yes, already true with previous damage |
| 200 | 11.8% | 25.1% | 174 | No |
| 300 | 5.3% | 25.0% | 263 | No |
| 500 | 2.1% | 25.0% | 440.5 | No |
| 900 | Below the new floor | 25.0% | 830.5 | No |

Inventory loss is not diameter loss. The first landed rival shot should be
rewarding; this is not a universal two-shot-kill rule. A follow-up inhale can
finish, another earned shot can matter, and retreat/recovery remain useful.
The old instant growth from large legal ammo still can push a former peer over
the 20% shatter threshold before firing; this pass does not silently remove it.

## Consequence checks

### Reload pressure: 2,160 executions

[Comparison](playtests/rival-reload-comparison-2026-11-01.json), with compressed
per-case reports in `reports/combat/nov1-*.json.gz`. Five attacker widths
100/200/400/650/900, initial fighter gaps 80/360/800, spare-ammo gaps 40/240/600,
tiny/half/largest-legal sources, active and separately labelled idle sources,
retreating/weaving defense, and baseline/25%/30%/33% damage floors.

Every case begins with a real guaranteed opening hit and only one pre-existing
spare source. Prompt hunter input uses actual rotation, release and fresh firing,
with precise sampled aim at 250ms. The defender starts empty. No replacement ammo,
free breath or bot-only weakness. This is a committed-hunter stress control,
not a human hit-rate or encounter-frequency estimate.

| Floor | Defender KOs / 270 active-ammo cases | Those KOs within 5s | Retreat KOs / 135 | Weave KOs / 135 |
| ---: | ---: | ---: | ---: | ---: |
| Previous damage | 22 | 5 | 8 | 14 |
| **25%** | **74** | **28** | **39** | **35** |
| 30% | 86 | 34 | 48 | 38 |
| 33% | 96 | 34 | 54 | 42 |

Idle sources are retained separately in the raw report rather than presented as
normal opponents. More knockouts are welcome, but the sharp increase with easy
spare ammo supports the conservative starting point. It does not establish that
74 is an ideal rate, or that precise repeated fire is equally easy for humans.

### Shots that can miss: 450 actual launches

[Accuracy controls](playtests/rival-shot-accuracy-2026-11-01.json) use genuine
capture/fire/flight and standard bullets, widths 100/200/400/650/900, shooter
ratios .75/1, edge gaps 100/350/800, initial aim errors -8/-4/0/4/8 degrees, and
idle or sideways/weaving input 300ms after visible/incoming-warning notice.

Width-100 targets were hit in 74/90 samples, width-200 in 82/90, and each larger
width in 90/90. Larger bodies were deliberately not given a smaller collision
area to equalize the results. Movement can carry a target into an offset shot,
so individual hit rates need not decrease monotonically with a dodge policy.
These stationary prepared aim origins and synthetic reactions are not human
accuracy or proof a giant can never evade earlier. Damage is applied after the
first collision and does not alter this first-shot geometry. This specifically
supports caution about combining larger hit areas with high percentage damage.

### Populated play: nine ten-minute worlds

[Full results](playtests/rival-damage-population-2026-11-01.json), three seeds per
floor, with normal 20 occupants, real growth, capture, targeting, weapons, hazards
and respawns. A human-flagged probe uses the ordinary BotBrain alongside 19 bots;
there is no protected observer or forced fight.

| Floor | Body KOs across 30 arena-minutes | Flight KOs | Peak width-500+ population by seed |
| ---: | ---: | ---: | --- |
| Previous damage | 80 | 126 | 2 / 0 / 2 |
| **25%** | **80** | **124** | **1 / 1 / 2** |
| 33% | 78 | 132 | 3 / 3 / 1 |

Flight deaths include spent ammunition; do not count them as rival-body victories.
Current-leader and width-500+ body KOs were zero in all nine samples. Ten-minute
worlds with few mature giants cannot establish hours-long reigns, eventual falls,
rarity or human fun. Stronger hits change targeting, pickups and future encounters;
shared seeds do not keep all later fights matched. The larger 33% giant populations
also show why stronger damage does not imply a simple global turnover outcome.

## Exhausted inhale: make the required action visible

The existing touch action changes to amber **LET GO / HOLD AGAIN** after a held
inhale stops. The short landscape button shows **LET GO**, then restores INHALE
on release. Keyboard feedback reads **SPACE release, then hold again**. The cue
persists if breath refills before release, and clears on release/new confirmed
inhale or a different action such as FIRE, CAPTURED or INJURED. An initial denied
hold gets an 800ms acknowledgement grace; a confirmed inhale stopping is noticed
immediately. Disabled movement/tutorial preparation does not show an inhale cue.

No new permanent HUD element, repeated input, automatic inhale, puff or queued
shot was added. Actual breathing limits and control geometry remain. Text padding
was corrected for the shorter landscape button; obsolete loading/queued test-only
labels were replaced by actual current actions in the layout regression.

## Verification and remaining review

- Full production build, client/server TypeScript and all 44 server unit scripts
  plus tutorial progress checks pass. Snapshot, bounds, strong early damage,
  transport separation, attribution and shared actor checks remain meaningful.
- All 18 multiplayer scenarios pass. The air-drift check now waits for actual
  synchronized input/movement within 500ms instead of assuming a 150ms network
  update. Tick-level no-stun/no-control-lock tests remain.
- 28 browser cases pass: five real-control exhaustion checks plus four touch-label
  layouts across desktop/Android/iPhone portrait/landscape/iPad profiles; six real
  rival-hit cases at widths 200/500; and 13 tutorial cases including all five
  lessons, both full sequences and a 320px reduced-motion full sequence. Two
  device-inapplicable cases are skipped. No automatic retry hid a failing case.
- Hit tests verify the broadcast before awaiting the state patch, then check
  shrinkage, injury, single impact and conserved owner-locked spill. Existing
  upkeep and collecting spent ammo's foreign gems are legitimate inventory changes;
  screenshot capture can exceed the three-second owner lock. The assertions avoid
  assuming a frozen gem total across those events.
- Rendered cue, injury/shrink feedback and labels were inspected on phone,
  landscape, tablet and desktop. Build logs/screenshots are under
  `.tmp/rival-breath-*`, `.tmp/rival-hit-final-verified` and `.tmp/rival-tutorial-browser`.
  Lint reports zero errors and 187 existing warnings.

The current local preview is `http://127.0.0.1:3215/` while its server is running.
Physical-phone input/recognition, multi-attacker pressure, long sessions and human
fun still need review. This candidate is a reviewable starting point, not final
balance, an Android distribution update or authorization to publish.
