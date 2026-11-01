# Readable weapon shots — November 1 local candidate

The user reports satellite and spinning-cannon shots looking like collectible
crystals, arriving from offscreen, firing at contact distance and leaving too
little space between consecutive bullets. Bots must keep up with the changes
without separate rules or secret aim knowledge. The user prefers a compact
pre-shot animation over an arena covered in dotted firing lanes.

This candidate is local on `codex/tutorial-countdown-layout`. Publishing remains
paused: no GitHub push, PR, main merge or hosted deployment is authorized.

## Current behavior

Bolts are elongated capsules with directional fletching, a dark outline and a
short tracer, rather than colored diamonds/loot halos. An outlined, cool launch
charge becomes a bright warm tracer after **550ms**. Contact during that launch
phase consumes the shot harmlessly; it cannot arm inside a creature. A long
simulation step judges the actual first-contact time, not only the endpoint.
This is a shared projectile rule, not a player-specific invulnerability window.
Existing landed-hit damage, graze/core rules, rewards and injury are retained.

| Weapon | Speed, old → current | Range, old → current | Shot interval, old → current |
| --- | ---: | ---: | ---: |
| Pinwheel | 620 → 420 units/s | 900 → 650 units | 140 → 320ms |
| Sentinel Satellite | 700 → 460 units/s | 1100 → 750 units | 850 → 1600ms |
| Ricochet Satellite | 580 → 420 units/s | 1500 → 800 units | 450 → 1100ms |

Sentinel and Ricochet move between shots, ease to a stop and hold for a **650ms
charge**. The barrel fills with light and a small forward flare tightens at the
muzzle. Sentinel commits its aim at charge start; movement during the charge does
not cause last-second tracking. Ricochet holds its rotating heading during its
charge. Orbit motion, client rendering and spawn-safety prediction use the same
paused/eased path. Absolute shot deadlines prevent timing drift from undermining
the settled period. There are no catch-up bursts after a long frame.

Bullet weapons have no long dotted firing rays. The decorative shared orbit path
is also removed; Ion retains its existing beam warning. No new persistent status
panel, warning label or weapon card is introduced. A brighter edge arrow appears
only for a predicted offscreen weapon collision within **1.2s**, then disappears
when the trajectory no longer threatens the player. Existing living-cannonball
warnings keep their half-second horizon. Own shots, expired shots and impacts
that would fizzle during launch do not trigger a weapon warning.

Range now uses actual accumulated travel, including ricochets, and clips a long
step at the remaining range before checking hits. Speed reduction is not allowed
to turn stale age-based expiry into shots traveling beyond their range. Comet
shares the capsule/launch rule but keeps its own existing speed, range and cadence;
Ion beam and Pulsar timing/damage remain unchanged.

## Bot decisions and shared rules

The bot brain considers public, committed projectiles and the settled satellite
charge heading. It reads nearby shots or the same imminent offscreen threat a
human receives, waits **250–450ms**, then chooses an ordinary steering direction.
It briefly holds that escape input rather than immediately abandoning a dodge
when the charge turns into a projectile. Existing thought intervals and mistakes
still apply. There is no teleport, movement bonus, altered damage, early access
to a future target position, or bot-only protection. Assembly, placement and gust
behavior remain available.

## Later control-lock correction

The [control audit](CONTROL_LOCK_AUDIT.md) found that the shared direct-hit path
still started a movement-locking skid despite `stunned=false`. Pinwheel, Sentinel,
Ricochet, Comet and Ion now use the existing steerable drift with the same initial
push and faster decay. Damage, injury, warning, range and builder reward rules
remain. The first-shot measurements below predate this push correction; they
are not a new validation of subsequent multi-hit fights.

## Measurements and limits

Run `npm run build`, then `node scripts/projectile-counterplay-study.cjs`.
[The recorded sample](playtests/projectile-counterplay-2026-11-01.json) contains
**2,196 deterministic executions**: matched bot/human physics for 1,080 first-shot
conditions, plus 36 actual bot-brain runs. Starting physical widths are roughly
20, 101.5, 301 and 612 units. Gaps are 40/160/280/440/640 units from muzzle to front
shell; responses use 250/400/550ms plus 0/100/200ms of network/input delay. This
isolates one real shot, not an entire battle or a human fun/latency study.

Among the 108 live-distance idle cases per weapon, all were hit; close launch
contacts fizzled. With a straight sidestep, Pinwheel had 30 hits (19 central),
Sentinel 29 (six central), and Ricochet 31 (six central) across the 180 response
conditions per weapon, including the close/fizzle controls. No sidestep condition
caused a knockout; the corresponding idle samples had 27 per weapon. These are
staged outcomes, not a target for suppressing knockouts or proof that all attacks
are avoidable. The deterministic bot brain was hit in 5/12 Pinwheel, 2/12 Sentinel
and 5/12 Ricochet cases: it can dodge and can still fail.

At a 300-unit radius the Pinwheel's angular opening, subtracting both bolt radii,
increases from about **70 to 177 units**. At 200/500 units it changes from 41/127
to 112/305. These are angular gaps at a fixed radius, not a guarantee that a large
body can safely stand between every pair of moving shots. Actual walking speed,
reaction, range, corners, multiple weapons and large-body grazing still matter.

All 41 server unit suites and saved-progress checks pass; all 18 real multiplayer
scenarios pass. Unit cases cover point-blank launches, contact-time boundaries,
long-step range clipping, stationary charges, live damage/accounting, owner
exclusion, warning expiry, bot reaction delays and normal movement integration.
The browser sweep passes **35/35 cases** on desktop Chrome, Android Chrome
emulation, iPhone portrait/landscape Safari and iPad Safari. It exercises compact
charges, hollow and live capsules, no long dotted bullet lanes, real offscreen
warnings, ordinary keyboard/touch sidestepping, satellite assembly/deployment,
Pulsar escape and its retained guard. The first desktop offscreen fixture used
the viewport's long axis, where the weapon was actually visible; the corrected
fixture uses the short axis for each orientation. Visible shots correctly stay
quiet. Phone/desktop screenshots of charges, capsules and arrows were inspected.
Build, types, lint and generated-schema consistency pass. Physical Pixel touch
feel, frame-time profiling, crowded crossfire and human review remain. There is
no claim of final balance or universal dodgeability.

Internal interface review heuristics: hierarchy/consistency/responsiveness 9/10;
usability/accessibility/feedback/performance 8/10. Priority follow-ups are an
uncoached physical-phone playtest of charge recognition and launch-vs-live meaning,
checking warnings under multiple-source pressure, reduced-motion comfort and
profiling real-device frame time. These scores are conservative review prompts,
not measured usability or fun ratings.

The final focused projectile sweep passes another 20 cases across the same five
profiles, including a DOM hit-test proving the warning is not hidden beneath the
desktop control bar. Warning placement reserves the actual touch-control bounds
and resolves clearance after smoothing/resizing. A cooldown collision regression
also ensures both hollow and live blocked shots are consumed without extending
protection. All 41 unit suites pass again after that server fix. The existing
35-case integration sweep and focused repeats overlap; do not sum them as unique
encounters or users. The review preview is <http://127.0.0.1:3199/>.

## Subsequent Pulsar decision

The user asked whether the ground-pounding circular weapon should be removed or
improved. Proposed direction: retracting fins/charging core, an expanding ring
with one obvious gap announced before release and fixed during travel, a brief
control-preserving shove, and readable intervals between pulses. Bots would use
the same opening. That discussion was superseded by the approved forward crescent;
see [PULSAR_CRESCENT.md](PULSAR_CRESCENT.md) for its weaker tuning and separate study.
