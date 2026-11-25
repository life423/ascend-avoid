# Bot cannon sight and camera audit — November 25, 2026

This follow-up is local on `codex/mobile-bullet-warning-audit`. Nothing has been
committed, pushed, merged or deployed. The user approved preventing bots from
shooting unseen targets and measuring misses. Player-bullet firing windup was
explicitly rejected; speed/range comparisons remain isolated experiments.

## Implemented sight restriction

Previously, ordinary cannon selection scanned every server player within an
edge-to-edge distance of 1,100 world units. Only the brief leader preference had
a view check. Thus delayed, imperfect aiming still used unseen exact positions.

`botShotView` now gives shot planning a square view sized by the existing
`viewShort` camera rule, contained by the same rounded-arena camera constraint.
Bots have no device aspect ratio, so this is a documented logical camera, not a
claim that they literally have a phone display. Any visible portion of a physical
body counts; circular intersection handles view corners correctly.

Ordinary targets, leader opportunities and black-hole shots must be in that view.
Leaving it cancels the current aim immediately, including between observations
and just before firing. Re-entry starts normal reacquisition/reaction/settling.
Loaded-shot repositioning also stops reading an out-of-view target's position.
The existing firing-range limit remains an additional limit, not a sight grant.
Already released bullets continue normally; this does not guarantee that a small
defender sees a larger shooter. Autonomous assembled weapons keep their shared
human/bot behavior.

The black-hole validity check also needed `ArraySchema.at(index)` instead of
bracket indexing. Its existing lifecycle test exposed the failed lookup. The
fixture now places that hole inside the bounded view; inactive/closing/relocated
target rejection remains covered.

## Current aim behavior

- Actual captured ammunition and the same fire, turning, bullet and damage rules
  as people. No perfect velocity-intercept targeting or instant body rotation.
- At least 1.4 seconds of AI planning after capture. First observation takes
  250ms; further observations are 450ms apart.
- A new target adds 400–650ms of reaction and one persistent signed aim error of
  0.12–0.24 radians (about 7–14 degrees). It aims at sampled current position.
- Facing must stay within 0.18 radians of that biased aim for 450ms. This tolerance
  and physical turn timing can occasionally reduce the effective final error.

These are decision limits, not guaranteed misses. A large nearby body can cover
the entire error cone, and movement can cross into an imperfect shot.

## Measured misses, rather than an invented miss probability

[Raw cohorts and individual outcomes](playtests/bot-shot-accuracy-2026-11-25.json)
contain **5,400 seeded encounters**: shooter widths 101.5/301, target widths
20/101.5/301, initial body-edge gaps 100/300/600, still/sideways/650ms-reversing
movement and 100 seeds per cohort. Real capture and the full bot controller feed
normal turning, fire, movement, flight and swept collision at 30Hz. Starting
facing varies. Bullets are the standard 60 units. No other opponents, field loot,
cover, weapons or traffic affect these isolated encounters.

For a **300-unit starting body-edge gap**, equal-sized matchups were:

| Shooter and target width | Stationary target | Moving sideways | Reversing every 650ms |
| --- | ---: | ---: | ---: |
| 101.5 | 34 misses / 100 shots | 39 / 99 (39.4%) | 43 / 100 |
| 301 | 0 misses / 100 shots | 30 / 100 | 4 / 100 |

The missing medium-sideways attempt never fired. Across the whole deliberately
balanced sample, 3,547 shots were fired and 1,333 missed (37.6%); 1,853 attempts
did not fire. **None of the 3,547 releases targeted an unseen body.** No-fire
attempts are not counted as misses. These constructed cohorts are not the live
match mixture, human skill, a population probability or proof of fun. The large
stationary result confirms why an existing aim error alone cannot make all hits
avoidable. No aim-error or other balance constant was changed to force misses.

Reproduce after `npm run build:server` with `node scripts/bot-shot-study.cjs`.
The report includes source hashes and every attempt. Randomness is seeded only
within the study process and restored after each trial.

## Camera contribution, still unchanged

The camera safety horizon is based on inhale danger from a creature 1.5 times as
wide, not projectile arrival speed. The aspect clamp plus full-viewport fill also
crops some nominal short-side coverage on narrow portrait phones. In open space,
a width-20 creature's nominal short side is about 708 world units; a 412×839 view
shows about 580×1181, roughly 18% less horizontal coverage. Large creatures see
farther. A large shooter can legitimately see a small defender while remaining
outside that defender's view, even after the bot knowledge fix.

Zooming out could expose more approach, but also makes small creatures harder to
read and steer. Camera coverage/readability needs its own comparison. It has not
been retuned, and showing every possible arena threat is not an acceptance rule.

## Isolated speed/range comparison

[576 mechanical comparisons](playtests/bullet-speed-range-study-2026-11-25.json)
retain real firing, flight, movement and damage formulas, scaling launch velocity
only inside disposable simulations. They reuse measured phone geometries and
give the predictor ideal immediate presentation, followed by chosen response/RTT
delays. They are optimistic bounds, not mobile/human playtests or bot accuracy.

For the strong shooter and a 250ms response without added RTT, distant sidesteps
improved from 6/9 to 9/9 with 10% slower launch. Near-edge results stayed 0/9 at
normal, 10% and 20% slower, and only reached 2/9 at 30% slower. Unobstructed range
for that shooter fell from about 3,134 units to 2,820/2,507/2,194 respectively,
because lifetime and drag were retained. Slowing also changes impact energy and
black-hole reach; the dataset retains actual impact outcomes. No candidate is
activated. A modest slowdown alone does not solve the nearest surprise shots.

## Verification and remaining limits

The full 63-suite unit command plus its progress/ownership/visual checks passes.
Client/server types, production build and scoped lint pass (existing warnings,
no errors). All 19 multiplayer scenarios and the final 96 warning browser cases
pass, without retries, across desktop Chrome, Android Chrome emulation, Firefox
phone viewport, iPhone/iPad WebKit and landscape. Phone, tablet and desktop
warning frames were inspected. Earlier stalled-frame failures were test-fixture
timing/halo assertions: the final case uses a settled diagonal entry and waits
for the outline to clear chrome rather than requiring it on the first frame.
No runtime warning rule was relaxed to pass that test.

Sight regressions cover partial bodies, diagonal misses, rounded-map
views, unseen selection, loss/re-entry, normal turning, hold expiry and hole
lifecycle. The accuracy study checks visibility at every release.

The separate exact-origin warning fix now warns before impact in all 27 measured
near-edge idle encounters; that establishes detection, not enough dodge time.
The physical Pixel camera comparison below follows this audit. Crowded-match
accuracy, human recognition and final shared speed/range selection remain open.

Scoped UI review heuristics, not measured quality: usability 7, hierarchy 9,
accessibility 8, consistency 9, responsiveness 9, feedback 8, performance 8.
Prioritized follow-ups below 9: obtain adequate short-shot counterplay lead;
test recognition/multiple threats/color-independent reading with people; profile
the actual Pixel under crowded load. A detection fix does not close those gaps.

## Mobile zoom trial on the Pixel 10 Pro XL

Keep the current mobile camera. Showing 10% or 20% more world in each dimension
produced the same dodge outcome at every matched distance in this local study.
The starting creature was already small at the current zoom.

| Pixel shot, muzzle center to defender center | Current view | 10% wider | 20% wider |
| --- | ---: | ---: | ---: |
| 350 units, from the side | 0/1 dodged | 0/1 | 0/1 |
| 650 units, along the tall axis | 0/1 | 0/1 | 0/1 |
| 850 units, from the side | 0/1 | 0/1 | 0/1 |
| 1,020 units, from the side | 3/3 | 3/3 | 3/3 |
| 1,500 units, diagonal | 1/1 | 1/1 | 1/1 |
| Starting creature diameter in CSS pixels | 14.8 | 13.5 | 12.4 |

At 350 units, the shooter was outside all three views. On the idle controls the
baseline showed the coral warning. Both wider views suppressed it because part
of the launched body was already in frame. From the first warning or visible
bullet center to impact, the phone measured 131, 90 and 114 ms respectively.
The entire interval from receiving the launch event to receiving the impact
event was just 180–201 ms. Even an immediate cue at launch would precede the
250 ms scripted response by too little in this particular encounter.

The Pixel showed about 605, 665 and 725 world units across. At the widest setting
that adds only 60 units on each side. In a separate populated 20-player room the
controls stayed easy to locate, and individual crystal colors and silhouettes
remained distinguishable. The starting creature's eyes and name were harder to
pick out at 20%. Compare the [current Pixel view](playtests/mobile-camera-2026-11-25/pixel-current.png),
[10% wider](playtests/mobile-camera-2026-11-25/pixel-10-percent-wider.png) and
[20% wider](playtests/mobile-camera-2026-11-25/pixel-20-percent-wider.png).

### How the encounters were tested

- Android Chrome on the physical Pixel in portrait ran 36 encounters. Touch Chrome
  emulation ran another 48 in portrait and 48 in landscape with 20- and
  101.5-unit defenders. All 63 stationary controls were hit. Both emulations
  reproduced the same near, middle and far outcome at all three zooms.
- The larger shooter captured ammunition and fired the standard 60-unit player
  bullet through the game's ordinary input path. Only the camera changed inside
  the test tab. Absolute launch positions were checked within two world units.
  The defender started still in open space with a thumb already on the joystick.
- The sidestep began after a 250 ms allowance from the earlier of the drawn warning
  or the bullet center entering the rendered view. Actual Pixel touch events
  arrived 271–290 ms after that cue. First silhouette overlap was also recorded.
  Pixel timing used the client's rendered frames and received room events.
- Each distance and direction is a controlled example. Only the 1,020-unit
  sidestep got three repeats per zoom, with zoom order rotated. Human recognition,
  divided attention, wall escapes, prior evasive movement, ordinary bot accuracy
  and mobile network conditions need separate evidence.

The [132 trial records](playtests/mobile-camera-2026-11-25/trials.csv) use milliseconds
relative to the local receipt of the launch. Empty timing cells mean that event was
not observed. A useful next test is the narrow case where the shooter is hidden,
the launch just clips the screen and the shot is on a collision course. Measure
both warning visibility and the time a joystick dodge actually needs.

## Portrait warning and smaller, slower cannonballs

This comparison started with the original camera and standard 60-unit cannonball.
The warning now includes a projectile clipping the viewport at launch when
the shooter's drawn body is entirely outside. Collision prediction still filters
the cue. Android Chrome, iPhone Safari, iPad Safari and desktop Chrome passed
all 16 checks for the clipped hit, a normally visible hit and clear misses
from both offscreen and clipped origins. [First warning frame on the physical
Pixel](playtests/portrait-bullet-2026-11-25/pixel-warning.png).

The separate tuning experiment used standard diameters of 60 and 50 and launch
speeds of 100% and 85% of the current shooter's power. The normal speed formula
references ammunition diameter, so the trials explicitly used the 60-unit speed
reference for every variant. This holds power constant for the size comparison.
The 50-unit flight body and its collision circle shrink together. On the starting
Pixel camera the bullet body measures about 37 CSS pixels versus 44.5 today.

- [Pixel encounters](playtests/portrait-bullet-2026-11-25/pixel.csv) used a
  real Pixel 10 Pro XL in portrait, a 310-unit shooter, a 20-unit defender, a
  real capture and a scripted full-strength sideways swipe. The thumb was
  already on the stick. The response allowance was 250 ms from the first
  painted coral warning or first rendered bullet center inside the screen.
  All timing columns use receipt of the launch as zero. The actors used the
  same positions at every setting. The smaller radius moved the muzzle center
  five units back. All 16 idle controls hit. In the 32 sidestep trials, every
  variant hit at 300 and 350. At 750 the combination produced 2/3 dodges and
  each other setting produced 0/3. At 850 the two slower variants produced
  3/3 dodges each and both original-speed variants produced 0/3. These small
  samples measure differences for prepared shots and automated touch.
- [Mechanical comparisons](playtests/portrait-bullet-2026-11-25/physics.csv)
  used 192 combinations of two shooter widths, two defender widths, eight side
  distances, two bullet sizes and three launch speeds. The normal 30 Hz movement
  and swept collision rules determined the latest tick at which an immediate
  full sideways input still escaped. An empty latest-dodge cell means even
  input at launch failed. These are optimistic input deadlines measured from
  launch, before display and network delay. At a 350-unit baseline distance
  even the 50-unit, 30%-slower case gave the small defender only 100 ms to start.
- [Bot cohorts](playtests/portrait-bullet-2026-11-25/bot-cohorts.csv) replayed
  100 matched seeds across two target sizes, two starting gaps, three motion
  patterns and four tunings. Bots captured, turned and chose when to fire.
  Every release targeted a visible body. At a 300-unit initial body-edge gap,
  the big bot hit the small crossing defender on 33/99 shots today and 26/99
  with both changes. Against an equal-width crossing rival it hit 70/100 and
  65/100 respectively. Those are conditional hit counts for these situations.

Changing the standard diameter globally would also change capture rewards:
on a 100-gem captive the existing formula would transfer 79 gems immediately
at 50 units versus 68 at 60. At equal settings, smaller impact mass can also
change injury. Before adopting a smaller shell, decide separately on capture
economy and test peer damage. A slower launch with the current lifetime reduces
range and deserves a black-hole shot and gameplay feel check.

### How much speed and range to keep

In a local 30 Hz comparison with a 50-unit bullet, a 309.5-unit shooter and a
stationary 20-unit defender, the latest successful sideways input came 33 ms
after launch at 15% slower and 67 ms at 20% slower in the 350-unit setup.
At 750, the deadlines were 333 and 367 ms. These are server input deadlines.
The Pixel tests above used actual touch at 15% slower.

With the existing 2.6-second lifetime and drag, open flight from a
101.5-unit shooter covers 2,315 units today, 1,968 at 15% slower and 1,852 at
20% slower. For a 309.5-unit shooter the corresponding distances are 3,134,
2,664 and 2,507. At the launch-speed cap, the 15% variant travels 2,885.
All use the same shooter-power reference. A 2.0-second lifetime at 15% slower
would limit the 309.5-unit shot to 2,244. The server black-hole lesson reached
completion and credited the shooter in all four configurations, including the
shorter lifetime. Its straight shot traveled about 338 units to the rim with
the smaller shell.

Three four-minute, 20-bot arena runs with the 50-unit, 15%-slower bullet and
2.6-second lifetime (seeds 174, 222 and 695) produced 47 launches, 20 cannon
hits on players and two black-hole eliminations. The latest player impact
occurred at 1.23 seconds and the latest hole elimination at 0.93 seconds.
This small sample supports testing the natural speed-related range reduction
first. Human long shots and unintended hits in live matches remain unmeasured.
