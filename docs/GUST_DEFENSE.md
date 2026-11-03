# Rear gust follow-up — November 2, 2026

## Release-approved follow-up — confirmed rear-hit wall slip, November 3

The user authorized a bounded wall slip from actual rear-gust hits, keeping 75%
breath and recipient shove unchanged. It is implemented and tested locally; see
[REAR_WALL_SLIP.md](REAR_WALL_SLIP.md) for budget rules, checks and limitations.
The user reviewed the local trial, said it feels good, and authorized commit,
merge and deployment. The main deployment workflow records the release result.
The release history below refers to the earlier front-hit wall slip.

## Released defense update: push without cancelling pressure

Released November 2, 2026 in [PR #76](https://github.com/life423/ascend-avoid/pull/76),
main `5ca85fbea932c55f73657ba193898e5eb0b52b22`.
[Production workflow 41542025055](https://github.com/life423/ascend-avoid/actions/runs/41542025055)
succeeded; Azure revision `ascend-avoid--0000116` was healthy with one replica and
100% traffic. The live client includes 75% cost and an actual production WebSocket
puff left 25% breath. Required CI and production multiplayer checks passed.
The user reported that 75% feels good. Remaining playtests are in [TODO.md](TODO.md).

The released build keeps incoming inhale, latch and accumulated pressure intact
when a front or rear puff hits. Physical separation can still break range or aim;
the ordinary latch grace and pressure-decay rules then apply. No automatic parry,
restart delay or pressure wipe is applied. The rear sweep and its wrap artwork
now span 140 degrees (70 degrees to either side of the rear heading). All shove
impulses, mass resistance, speed caps and reach retain their released values.
The instantaneous forward puff still uses its existing 110-degree hit cone.

The released resource-only tuning costs 75% of a full breath per accepted puff,
with normal idle refill (three seconds from empty), no fixed gameplay cooldown
and no added refill pause. One full-meter puff leaves 25%; the earliest second
is about 1.5 seconds later and subsequent empty-meter puffs need about 2.25 seconds.
The user requested this 75% comparison after the initial 80% trial.
Normal inhale still shares this meter. This supersedes the earlier 35%-cost,
1.5-second refill-pause trial and the rejected four-second cooldown proposal.
Button and help percentages derive from the same tuning constant.

The approved wall-slip prototype redirects the part of valid-hit recoil that
would otherwise be lost at a boundary, toward deliberate movement along that
boundary. It uses the ordinary recoil's existing drag and total travel to find
that blocked portion, preserves any portion that fits before the wall, and
never increases recoil magnitude. At a corner it selects a viable boundary
tangent, not a path through a wall. Empty/invalid hits, no tangent input, and
recoil that fits in open space do not gain movement. No stun, suction shield,
pressure wipe or capture exception is added. Humans and bots use the same rule.
Two brief airflow wisps show the redirected movement. Rounded corners and their
camera framing subsequently shipped in PRs #77/#80. The newer tracking study is
in [CORNER_DEFENSE_PLAYTEST.md](CORNER_DEFENSE_PLAYTEST.md); this original study
does not establish escape success against a pursuing opponent.

After local testing, the user reported that the 75% trial feels good and
authorized committing, merging and deployment on November 2, 2026. The wider
140-degree rear arc, pressure retention and wall slip are included, with unchanged
shove strength. This feedback does not establish broad human balance. The earlier
release and its measurements below are historical.

The 75% local comparison passes the production build, type checks, all 47 unit
suites plus practice-progress checks, and 45 browser cases across desktop Chrome,
emulated Android Chrome and emulated iPhone Safari. Checks include exact 75%
spending, repeat-request rejection, 1.5-second first refill availability, normal
refill, pressure retention, wall recoil and keyboard/touch routing. Short manual
local drills also confirmed one puff from rapid taps and working wall slip.
These checks do not establish physical-phone feel or human chase balance.
Network results below belong to earlier runs, not a fresh 75% network run.

PR #72 shipped fixed injury recovery, player-bullet warnings and tutorial fixes.
It did not strengthen the gust. The user expected that work to ship too; this
follow-up completes it while retaining the requested no-stun/no-barrier rules.

The initial 135-case study only compared isolated candidates. Its most promising
proxy prevented two additional captures in 27 straight retreats, but had not
checked multiple opponents or repeated use. It is preserved as historical
evidence, not a claim that a stronger gust was already live.

## Selected behavior

The front puff, gem/part movement and caster recoil retain their existing values.
The rear sweep uses three times the previous mass-based impulse, capped at 280
world units/s across all overlapping rear gusts. Its independent drift decays at
7/s: at the cap it travels under 40 units without walking or other forces, falls
to about 17 units/s after 400ms, and ends below 1 unit/s in about 0.8s. Large
pursuers retain mass resistance, and every cast has one shared impulse budget
across all recipients. Front hits consume the same fraction of that rear budget
and exclude the same creature from a second rear hit.

Recipients keep walking and turning. There is no stun, solid collision wall,
damage, ammunition ejection, suction immunity or repeated parry from fading art.
The 220ms front-to-back wrap, 140ms rear hit opportunity, 350ms inhale restart,
35% breath cost and 1.8s cooldown are unchanged. The existing wind animation stays.
Bot, human and tutorial actors use the same movement and ability rules.

Rear wind has its own replicated velocity and prediction path. Weapon-hit pushes
and front recoil continue to decay at 12/s. Several gusts cannot multiply rear
speed beyond the cap. Wind decays to zero; map edges, knockouts, respawns,
teleports and launches clear the appropriate motion. Empty puffs still provide
no free dash.

## Comparison and limits

[Raw comparison](playtests/rear-gust-2026-11-02.json): 432 six-second synthetic
retreats, 144 per profile. Each uses widths 60/150/300, hunter width ratios
1.35/1.75/2.5, body-edge gaps 20/80/180/360, one or two pursuers and either one
cast or repeated normal casts. Hunters retarget every 250ms through the shared
movement/turn/aim system. Hazards, weapons and field pickups are absent.

| Profile | Rear scale / speed cap / drag | Captures, all 144 | One pursuer, 72 | Two pursuers, 72 | Repeated-cast captures, 72 |
| --- | --- | ---: | ---: | ---: | ---: |
| PR #72 gust | 1 / 560 / 12 | 68 | 31 | 37 | 32 |
| Selected conservative improvement | 3 / 280 / 7 | 57 | 27 | 30 | 25 |
| Stronger comparison | 4 / 320 / 6 | 54 | 25 | 29 | 25 |

The conservative profile was selected because it improved spacing and survival
while the stronger profile saved only three more one-cast cases and no more
repeated-cast cases. Close mistakes still produce captures. This does not prove
final human balance, universal escape or fun; actual phone feel remains open.

Reproduce after building with `node scripts/rear-gust-study.cjs`. The comparison
temporarily changes constants only in its own process, restores them afterward
and writes `.tmp/rear-gust-study.json`. The older candidate script now exercises
the real separate drift channel instead of modifying a weapon-push proxy.

## Verification

The dedicated rear-gust suite checks shared budgets, large-body resistance,
overlapping-caster limits, independent weapon decay, steering during separation,
cooldown, fade, cleanup, map bounds, prediction and bot/human parity. Existing
gust and front-puff momentum suites remain in the normal unit command.

Types, generated schema, production build, lint (zero errors; 187 existing
warnings), all 45 unit scripts plus progress checks, and all 18 multiplayer
scenarios pass. All 30 browser cases pass without retries across desktop Chrome,
Android Chrome, iPhone Safari portrait/landscape and iPad Safari: the real defense
lesson, full five-lesson sequences, caster/recipient gust control, soft body
contact and real weapon-hit steering. Phone portrait/landscape and tablet renders
were inspected; the existing air arc keeps eyes visible and touch controls clear.
These are emulations, not a physical Pixel playtest.

Internal review heuristics, not measured quality: usability 8, hierarchy 9,
accessibility 8, consistency 9, responsiveness 9, feedback 8 and performance 8.
The remaining priorities are physical-phone feel, newcomer recognition of the
short wind opening and on-device frame/input measurements, rather than further
untested strength increases. This release does not claim final combat balance.
