# Rear gust follow-up — November 2, 2026

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
