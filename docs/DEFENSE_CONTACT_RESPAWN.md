# Escape wave, vulnerable shell, soft contact and safer spawning

## November 1 local update — passing gust, no stun or barrier

The user approved keeping the mouth-origin, two-sided rear sweep while removing
the solid/shield behavior and stun. The local follow-up preserves the 220ms wrap,
allows one finite push per creature during a 140ms rear pulse, then lets the arc
open and dissolve into thin wisps over 480ms. The artwork is not a persistent
suction blocker. A connected inhale can be interrupted once for 350ms, with no
global suction-safety window. Both sides can steer and turn during the short air
drift; no gust stun or movement-locking skid is applied. Held ammunition stays
held. Cost remains 35% breath with a 1.8s cooldown, shared by bots and humans.
The defense lesson checks the actual shove and subsequent movement, and Help
no longer promises rear cover. This supersedes the historical wall description
below. Other combat effects, injury art and safe-spawn behavior are unchanged.
This follow-up is local only; no push, merge or deployment is authorized.

### Current local verification

All 40 server unit suites and saved-progress checks pass, including one-hit
front/rear accounting, no hidden skid/stun, steering and turning at small/medium/
large sizes, held ammunition, inhale restart across still-visible air, finite
budgets, cooldown/cost, protection, death/disconnect cleanup and bot/human parity.
All 18 real multiplayer scenarios pass, including actual client inputs during a
front push. The passing five-profile wrap/contact browser checks exercise desktop
Chrome, Android Chrome emulation, iPhone portrait/landscape Safari and iPad Safari.
All-lesson and visual review results are recorded alongside the tutorial notes.

Internal review scores are conservative heuristics, not measured player ratings:
usability 8, hierarchy 9, accessibility 8, consistency 9, responsiveness 9,
feedback 8 and performance 8 out of 10. The remaining high-priority validation is
an uncoached physical-Pixel escape/recapture playtest, checking whether the shorter
shove gives a readable response window. Review reduced-motion comfort and profile
frame time on the actual phone; emulation/screenshots do not establish those.
No additional persistent labels or shield-like UI were added.

Final production build, client/server type checks, lint and generated-schema
consistency pass. After refreshing the local preview, ten final rendering and
saved-progress checks pass across the same five profiles, including the renamed
escape-gust prompt and registered shove event. Desktop, tablet, phone portrait
and phone landscape screenshots were inspected. Local review is available at
<http://127.0.0.1:3199/>; no GitHub publish or hosted deployment was performed.

The user authorized committing, merging and deploying this batch together with
the five-lesson tutorial remodel on October 31. GitHub's PR and production
workflow record the resulting release; the local status below is the pre-release
review record.

October 31, 2026. Implemented locally on `codex/wrap-wave-shell-spawns`,
starting from deployed main `939a97a`. These changes are not deployed yet.
Later user feedback and current code override historical combat notes.

## Approved behavior

- An empty-mouth puff leaves the front, wraps around both sides, and settles
  into a temporary rear air wall. A fleeing creature can keep facing its escape
  direction. Bots and humans use the same authoritative exhale and wall rules.
- Vulnerability uses three separated shell plates, a warm core and worried eyes.
  Eyes remain in front of the effect; healing closes the seams. A finish breaks
  along the same plate geometry. This replaces the thin rear scratch treatment.
- Respawns choose the safest available candidate with two separated escape
  routes. If the search finds none, the player waits for a retry instead of
  appearing at a known unsafe fallback.
- Ordinary body contact compresses and slides. It no longer adds the historical
  220ms bump stun or forced shove. Gust and projectile impact effects remain.
- The arena Gem surge countdown and its duplicate floating announcement are
  removed. The world marker, event, sound and side activity entry remain.

## Initial parameters and counterplay

The wall takes **220ms** to wrap and then lasts **900ms**, fixed at its cast
position and heading. Existing puff cost (**35% breath**), cooldown (**1.8s**),
forward cone response, injury restrictions and loaded-mouth behavior remain.
The rear arc is about 120 degrees wide. It interrupts a real suction connection
crossing it; it is not a full bubble or projectile shield. Opponents can approach
around its open sides or resume pursuit after it expires. The normal 350ms
inhale interruption applies once per attacker/wall, without a new rear hard stun.
The wall's one-time, mass-aware pushes share the puff's finite impulse budget.
It is removed if its owner dies, disconnects, is captured or enters flight.

Reduced motion uses stable front/rear poses, stable injury seams and direct
contact deformation. Other clients receive the server's actual wall geometry
and timing, rather than guessing protection from a local animation.

Spawn selection scores 24 random candidates and a 5×5 interior grid against the
existing player, leader, suction and moving-hazard clearance checks. Candidates
need at least 220 units of clearance and two walkable 180-unit routes separated
by at least 90 degrees. A 7×7 expanded search uses safe boundary space if needed.
Failed searches retry every 250ms. Existing four-second spawn protection starts
when the safe spawn succeeds. Initial joins wait without a fake knockout;
knocked-out players retain their knockout state while waiting.

Soft contact preserves mass/yield separation and sideways friction. A damped
visual spring returns the area-preserving body squash to round after separation.
These changes do not enable the separate 33% damage or one-second loading trial:
`PEER_HIT_SHARE` and `CAPTURE_FIRE_DELAY_MS` both remain zero.

## Verification and limits

The 40 server unit suites, local progress checks and 18 real multiplayer scenarios
pass. Focused regressions
cover both actor flags, actual bot rear defense, rotated wall geometry, expiry,
restrictions, finite impulse, unsafe-spawn retries and retained control on contact.
The production build, generated types and TypeScript checks pass; lint has no
errors and 185 warnings elsewhere in the existing code.

The 47 focused browser cases pass (plus three intentional full-touch profile
skips). They exercise desktop Chromium, emulated Android Chrome, iPhone Safari,
iPhone landscape Safari and iPad Safari: a moving puff/rear interruption, wall expiry,
body compression and steering, injury/healing/reduced motion, and the absent
surge banner. Android's actual two-touch event sequence keeps the walking finger
down while releasing the action finger. The test driver previously released the
wrong finger; the shared tutorial drivers are corrected as well.
The existing four-lesson trusted-touch sequence also passes, together with aimed
thumb-release/replacement, injury camera and reachable Help/focus checks.
Screenshots of the shell, worried eyes, soft contact and rear wall were inspected.
Those checks preceded the tutorial remodel. The later approved five-lesson
implementation now teaches actual rear-wall interruption and expected-injury
escape instead of front parry. See [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md)
for its separate verification and remaining human-review limits.

A seed-73, two-minute natural-growth sample with 20 bots completed with 29 safe
spawns, zero retries/unsafe spawns, 34 puffs, eight captures, seven launches and
nine knockouts. No player remained in initial spawning. This is a regression
sample, not proof of ideal balance, escape fairness or long-run giant turnover.

Human timing, latency and physical phone performance still need playtesting.
In an arena with no safe candidate, waiting can last until a safe area opens;
there is deliberately no timeout that forces a dangerous spawn. The UI reports
that it is finding clear space. No claim of permanent spawn safety is made.
