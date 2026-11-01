# Pulsar crescent — November 1 local candidate

The user approved a forward traveling crescent: rotate during recovery, stop for
charge/release, then turn independently of the released wave. No stun, steering
lock, projectile barrier or rear enclosure. The builder remains exposed.

The requested weaker first tuning is provisional: **90-degree crescent, 1,000ms
locked charge, 30-degree recovery turn, 15% central damage with six-gem minimum**.
Release interval is 2,600ms with 180ms follow-through. Four pulses fit 9,900ms active
after 1,200ms startup. Radius expands 44 to 404 over 900ms. A surviving hit applies
existing injury/reward and a short mass-aware additive shove; controls keep working.
Large outer-shell grazes remain harmless. Bots and humans share all mechanics.

## Comparison

Build the server, then run `node scripts/pulsar-balance-study.cjs`.
The [2,700 executions](playtests/pulsar-balance-2026-11-01.json) cover nine settings,
widths 20/101.5/301/612, center distances 140/260/380, reactions 250/500ms plus
0/150ms latency, idle/retreat/flank paths, actor-parity repeats and 108 actual
imperfect bot-brain encounters.

| Result | Weaker candidate | Earlier 120° / 800ms / 36° / 25% proposal |
| --- | ---: | ---: |
| Retreat cases hit / 48 | 18 | 20 |
| Retreat knockouts | 0 | 0 |
| Flank cases hit / 48 | 34 | 42 |
| Flank knockouts | 0 | 6 |
| Flank paths reaching rear / 48 | 48 | 42 |
| Actual bot encounters hit / 12 | 4 | 8 |

Both settings hit all 48 idle cases and knocked out the twelve idle newborns.
All 96 moving cases survived the weaker version. Close large flankers can still
take a hit. A separate regression knocks out the builder with a hostile bullet
through its own outgoing wave. Turn steps 24 vs 36 degrees did not separate these
fixed-path outcomes; 30 degrees is not an established optimum.

The isolated study excludes body contact, inhale, collection and rival attacks.
Reaching the builder means access, not a kill. Human feel, variable latency, walls,
multiple weapons and physical controls remain playtests, not settled fun/fairness.

## Verification

All 42 server suites plus progress checks and 18 multiplayer cases pass. The
continuous collision sweep is checked against an independent dense-time oracle.
Thirty browser cases pass on desktop Chrome, Android Chrome emulation, iPhone
portrait/landscape WebKit and iPad: direction/control, giant retreat/guard, and
real weapon/defense lessons. Phone/tablet/desktop screenshots were inspected.
The weapon lesson follows actual placed heading. No persistent HUD was added.
An additional 320px reduced-motion phone check passes with its rendered crescent
inspected: recoil is omitted while informative charge and wave travel remain.
Physical Pixel performance remains unmeasured. This work is local/unpublished.

Internal review heuristics, not measured quality: usability 8, hierarchy 8,
accessibility 7, consistency 9, responsiveness 9, feedback 8, performance 7.
Prioritized sub-9 follow-ups: test threat readability/physical input amid multiple
weapons; review whether charge conveys danger without new pinned labels; measure
frame timings on the actual phone. Avoid a cosmetic redesign loop to chase scores.
