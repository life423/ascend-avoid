# Gameplay-loop review — November 1, local evaluation

**Later local update:** the user approved the measured
[25% rival floor and exhausted-input cue](RIVAL_DAMAGE_AND_BREATH.md). The original
review below records the prior baseline and 33% experiments; its no-change status
is historical. Standard 60-unit bullets remain, and nothing has been published.

The user selected the complete gameplay-loop review, with store preparation on
hold pending Google developer approval. They confirmed weak large-rival missile
damage is a major problem, while explicitly retaining an evaluation phase before
changing an interconnected balance rule. **No gameplay constants or running-game
damage changed in this pass.** Nothing is committed, pushed, merged or deployed.

V12 means the supplied regular/TEST icon-bundle version, already installed locally;
it is not another game edition or a required gameplay task.

## Evidence

- [36 ordinary-world runs](playtests/game-loop-2026-11-01.json): six seeds, three
  controller policies, fresh or five-minute naturally established arenas, then
  three observation minutes. That is 108 probe-minutes plus 90 warmup minutes.
  Standard field, 20 occupants, normal weapons/hazards, real movement/combat and
  respawns remain. There are no gifts, extra protection or weaker-bot rules.
- Probes have human mechanics. **Forage** gathers and retreats; **curious** also
  investigates visible parts/prey; **experienced** uses the current BotBrain.
  Simple probes make 300ms decisions inside an approximate portrait camera;
  BotBrain retains its real observation policy. These are scripted mechanical
  opportunity controls, not observed newcomers, skill rankings or retention.
- Four 150-second normal-room browser sessions, desktop Chrome and Android Chrome
  emulation, use ordinary keyboard/touch controls, without fixture commands,
  grants or teleports. Continuous-hold runs retain videos/screenshots. Later
  breath-monitoring runs also retain [raw samples/events](playtests/game-loop-browser-2026-11-01.json).
  They monitor estimated stamina, not a perfect human policy; these are not
  matched-seed comparisons. All four pass page-error, population and camera-bound
  checks. Screenshots were reviewed; recordings remain available locally.
- Two isolated real-control diagnostics confirm that exhausted inhale does not
  resume while still holding, even after breath fills. Release plus a fresh press
  works on desktop and touch. This does not establish human understanding.
- [Current damage](playtests/game-loop-followup-2026-11-01.json),
  [pure 33%](playtests/game-loop-followup-peer33-2026-11-01.json) and
  [33% floor](playtests/game-loop-followup-floor33-2026-11-01.json): **216 controlled
  fight executions**, 72 per variant. Ten unique real capture/growth/launch
  configurations also run in all three isolated research processes.

Drivers: `scripts/game-loop-review.cjs` and `scripts/game-loop-followup.cjs`.
Build the server first. The latter accepts `--peer33` or `--floor33`; default is
current damage. Full/quick loop reports use separate files. The raw report records
local source hashes and the base Git SHA, not a new commit. Browser checks require
`LOCAL_LOOP_REVIEW=1` and loopback `E2E_URL`. Logs/videos/screenshots are under
`.tmp/game-loop-browser*` and `.tmp/breath-readiness-review`; these are not automatic
live-site release tests. Fun, physical-phone feel and retention are unmeasured.

## Opening: watching and acting differ

The one/two-minute target is a design hypothesis, not an industry standard. An
**agency event** here is capture, firing a captive, a damaging credited hit/KO,
connected gust, or surviving injury after actual incoming suction. Collection and
Place are reported separately. Visibility uses camera bounding boxes; it cannot
prove attention, unobscured perception or understanding.

| Controller | Fresh: agency by 120s | Established: agency by 120s |
| --- | ---: | ---: |
| Forage | 2/6 | 3/6 |
| Curious | 5/6 | 6/6 |
| Current BotBrain | 4/6 | 5/6 |

Visible activity appears within 60s in 31/36 runs, but agency occurs by 120s in
25/36. Nine probes are knocked out before their first agency event. Curious play
finds opportunities; merely following crystals can leave someone watching rather
than discovering combat. More hazards or forced fights are not justified by this.

Peak active weapons is two or three across all 36 windows, with no four-active
sample. That is not a universal cap or proof of ideal counterplay/giant survival.
The recorded mobile probe builds/places at about 104 room-seconds; desktop does so
at 144s after a knockout. Ordinary assembly works; uncoached understanding of
matching components and ownership remains unmeasured.

## Priority: the direct payoff of rival shots collapses with size

`CANNON.PEER_HIT_SHARE` remains **0**: the historical 33% trial was never activated.
Standard 60-unit ammunition becomes proportionally tiny against larger targets.
Equal-width launch-speed formula examples:

| Both widths | Current gem loss | Pure candidate loss | Candidate defender width after hit |
| ---: | ---: | ---: | ---: |
| 100 | 56.7% | 33.0% | 83 |
| 200 | 11.8% | 33.1% | 165 |
| 300 | 5.3% | 33.0% | 249.5 |
| 500 | 2.1% | 33.0% | 419.5 |

These percentages describe inventory, not diameter. Flight drag can reduce current
damage at distance; the candidate uses immutable physical shooter width at launch.
The user wants the **first rival hit to feel satisfying**: meaningful loss of
growth, visible shrinkage and a pursuit opportunity. They did not agree to every
equal duel requiring exactly two shots. Inhale can finish; escape, recovery and
counterattack should remain useful decisions. We are still evaluating.

### Consequences to evaluate together

1. **Pure 33% weakens early hits.** Current width-100 equal hits remove about 57%,
   and width-60 examples about 84%. The separate floor candidate takes the greater
   of current damage and width-scaled 33%, preserving stronger early hits. It is
   an experimental alternative, not a selected rule.
2. **Shrinkage helps retreat and changes lethality.** Width 200 becomes 165,
   gaining about 5% speed while putting the original shooter above the approved
   20%-wider threshold for the next hit. Width 300 also crosses it. Width 500
   becomes 419.5 and narrowly does not, assuming no other changes. Do not describe
   all equal duels as two-shot kills; pickups and the next launch snapshot matter.
3. **Ammo capture already changes rival size.** Real legal captures show width
   200 capturing 153.5 prey becomes 241.5 before firing; 300 capturing 230.5 becomes
   364; 500 capturing 384.5 becomes 602.5. Each crosses the 20% threshold against
   its former equal independently of a 33% change. Half-width prey does not do so
   in those examples. Growth is conserved and the fired body remains 60 units.
   These staged captures do not measure earning active, resisting ammunition.
4. **Injury already makes follow-up dangerous.** Controlled fights start with an
   actual hit: shooter ratios .9/1/1.2, target widths 100/200/300/500, gaps
   100/350/650, shooter pursuit at 250ms, idle or outward defender input at 300ms.
   Current equal attackers finish 3/4 retreating targets at gap 100, 2/4 at 350
   and 0/4 at 650. All idle controls lose. The 1.2× opening hits shatter as intended.
5. **Less damage can sometimes help pursuit.** Of 24 retreating controls below
   the instant-finish ratio, 14 survive current damage, 13 pure 33%, and 14 the
   floor candidate. The changed case is width-90 shooting width-100 at gap 100:
   weaker direct damage leaves a larger/slower defender and changes survival to
   a mouth finish. No KO outcome differs among the 72 floor configurations,
   despite larger inventory losses in some survivors. This small fixed-direction
   matrix cannot validate reloads, dodges, multi-attacker pressure or giant balance.
6. **Inventory and bot consequences remain open.** Review valuable spills, owner
   recovery, repeated active-ammo supply, damage-informed bot targeting, repeated
   hits, ownership/disconnect cases and long-run giant survival together. Earlier
   October 30 ammo/timing studies inform this but do not validate today's changed
   escape/gust/weapons plus a newly activated formula. The loading trial stays off.

## Improvements worth testing next

- Explain exhausted held input through the existing action control. Full breath
  can look ready while the old press is inactive. A contextual release/re-press
  cue may reduce silent failures. Do not turn this into automatic firing/puffs,
  unlimited inhale or another permanent arena panel.
- Help players recognize a worthwhile first capture, recoverable escape or nearby
  matching component. Preserve readable outcomes, smaller-player speed and earned
  giant power. This is not approval to add rewards, hazards or forced encounters.
- Give the first good shot a clear immediate impact and readable pursuit/retreat
  choice. Subsequent hits should be earned through ammo, aim and positioning.
  Larger explosions alone cannot repair negligible direct loss.

Next compare a size-based rival-damage candidate with repeated active-ammo
acquisition, close/distant follow-ups, shared bot decisions and longer populated
arenas before selecting activation. Preserve the user's desire for real knockouts;
do not optimize universal survival. The user need not replay as a prerequisite.
