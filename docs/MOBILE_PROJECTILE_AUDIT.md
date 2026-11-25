# Off-screen projectile audit — November 25, 2026

**Later decisions:** player-bullet firing windup is explicitly rejected. The
exact-origin detection fix and bot cannon sight restriction are now local; see
[the follow-up](BOT_SHOOTING_AND_CAMERA.md). Earlier recommendations and measured
baseline failures below do not mean those two fixes remain unimplemented.

## Later timing study

[The 177-encounter counterplay study](INCOMING_WARNING_COUNTERPLAY.md) now tests
the local candidate. It confirms near-edge dodge failures and reproduces a
remaining first-receipt origin-classification defect. The visibility checks below
establish their particular tested cases, not universal warning coverage or fair
reaction time. No balance tuning or deployment is included in the timing study.

## Local visibility follow-up — not deployed

The user narrowed this pass to making the warning visible, seeing it in actual
game frames, and keeping it contextual. They accepted coral for now. After
reviewing the first screenshots they rejected an alert behind the incoming
bullet and an alert for every visible shot.

The local candidate uses the existing coral weapon-danger color (`#ff896f`), a
dark outline and a directional shape. It sits beside the threatened creature
on the approach side, normally between the creature and the incoming shot,
rather than remaining behind it at the viewport edge. Viewport/HUD/thumb
clearance remains. The surrounding projectile outline/wake stays outside eyes.
There are no persistent labels, flashing elements or new controls.

Only a predicted collision from a player flight observed outside the view, or
an unsteered missile whose reconstructed launch origin was outside it, enables
the player warning. It continues through screen entry while the actual current
trajectory remains threatening, and clears after a miss or spent/ended flight.
Ordinary visibly launched shots and clear misses do not trigger it. This is a
collision prediction, not a claim to detect every unavoidable hit. First-receipt
origin reconstruction is intentionally limited to unsteered missiles; steered
fan flights need observed off-screen motion. Fan bodies now use their real drag
in the shared human/bot predictor. Flight speeds, damage and windup are unchanged.

Validation on the local production build:

- Production build/package verification, client/server types and the complete
  `npm run test:unit` command pass (67 unit/check invocations). Scoped lint has
  zero errors and three existing non-null assertion warnings.
- All 84 applicable browser cases have passing results across the final run and
  corrected-fixture checks: desktop Chromium, Android Chrome emulation, Firefox
  phone viewport, WebKit iPhone portrait/landscape and iPad. No retry was used.
  The first run had six failures in two fixtures: the busy-main-thread delay did
  not reliably make the first painted bullet fully visible, and some fan launch
  fixtures were already visible at first receipt. The corrected test pauses only
  presentation while real flight replication continues, and places the real fan
  beyond its nozzle/body/replication clearance. All six first-receipt cases and
  all six final fan cases pass, preserving the original assertions.
- Cases cover six approach directions, actual first painted frames, alpha 1,
  canvas/thumb clearance, ordinary-visible-shot and clear-miss negatives,
  cleanup after actual impact, distant small/growing dodges and the existing
  off-screen satellite regression. Real captures/fan launches use shared physics.
- Actual coral warning screenshots were inspected on Android-sized and desktop
  frames, phone WebKit, landscape and tablet. Physical Pixel input, busy-match recognition,
  color-vision testing and hardware frame timing remain unverified.

Local evidence is under `.tmp/nov25-warning-{final,corrected,fan-final}-*`.
Preview: `http://127.0.0.1:3281/`. No commit, push, merge or deployment is made.
The remaining sections record the unchanged released baseline audit, not a new
claim that the current candidate makes the fastest short-range shots escapable.

### Open-browser follow-up

At the user's request, the local game was also opened visibly in the in-app
browser and played with ordinary keyboard movement and inhale input. In normal
play the player collected gems; random bot captures interrupted deterministic
shot preparation. A separate temporary local server on 3282 then isolated real
capture/fire encounters, using the same compiled client, server flight/collision
rules and ordinary recovery. Only fixture actors/room population were prepared;
there was no forced projectile path, frozen flight, warning overlay or speed change.

Actual browser screenshots showed the coral warning beside the defender while
the threatening bullet was still off-screen, at desktop 1280x720 and phone-sized
412x839 layouts. The cue cleared after the encounter. A clear off-screen miss
stayed quiet and the defender survived; an already-visible launch showed the
actual impact without a surprise cue. This supplements the automated negatives,
not a frame-by-frame manual proof of their entire duration. Idle strong-shot
controls knocked the small defender out; no manual successful-dodge or balanced
reaction-time claim is made. The phone-sized browser used keyboard input, not
physical touch hardware. No browser errors were observed in the inspected logs.

The test actors/server were stopped, temporary viewport overrides were reset,
and the normal 3281 game was left open. The test driver is ignored under `.tmp/`.
This follow-up adds observations only; no runtime code or deployment changed.

Scoped internal review heuristics (not measured quality): usability 7,
hierarchy 9, accessibility 8, consistency 9, responsiveness 9, feedback 8,
performance 8. Priorities below 9: first measure shared reaction/movement timing
for short shots; then check recognition and warning stability with moving players,
crossfire and color-vision conditions; then profile crowded play on physical
Android hardware. Do not tune damage or promise guaranteed dodges from this pass.

## Released baseline audit

The user reports unexpected off-screen hits everywhere, especially on mobile,
and questions whether a warning alone can make them fair. This audits the
released rules; it does not activate new combat tuning or authorize deployment.

## Release and reproduction

Local main and origin/main are `dd4e142d1fe9d437347fae5e9dff63f0254a18a1`.
Production deployment `45361067007` succeeded. Both public website hosts serve
`main-7btyuOWR.js`, byte-for-byte identical to the locally built production
client (SHA-256 is recorded with the data). Warning code is included and called
by the current renderer. This is not explained by missing production code.

The separate Android Test package still points at staging's older
`main-CNLzCq-j.js`; the user confirms the problem also occurs elsewhere. Updating
staging alone would not solve the current production behavior.

[Recorded evidence](playtests/offscreen-warning-audit-2026-11-25.json) contains
24 strict browser encounters. These use ordinary captured ammunition, actual
server flight/collision rules, a prepared larger shooter and keyboard/trusted
touch movement. Each shot's entire 60-unit body starts outside the actual view,
checked immediately before firing. Defender widths are 20 and 101.5 world units;
launches approach on the viewport's short axis, from above and diagonally. The
added reaction delay is either zero or 250ms. Screenshots do not block dodging.
The phone profile is Pixel 7 Chrome emulation at 412x839 CSS pixels, not physical
Pixel hardware. Zero added reaction still includes automation/input/network time.

| Platform | Added reaction delay | Encounters | Hits |
| --- | ---: | ---: | ---: |
| Desktop Chrome | 0ms | 6 | 3 |
| Desktop Chrome | 250ms | 6 | 6 |
| Phone Chrome emulation | 0ms | 6 | 4 |
| Phone Chrome emulation | 250ms | 6 | 6 |

These are controlled strong-shot encounters, not a random match win rate or a
measurement of human fun. The diagnostic tests completed successfully; that does
not mean their defenders escaped. An earlier closer-launch exploratory run had
some initially partially visible projectiles; the table uses only the stricter
rerun with complete initial off-screen assertions.

## Findings, ordered by impact

1. **A warning horizon does not guarantee a reaction opportunity.**
   `CANNON.LAUNCH_SPEED_MIN/MAX` are 1250/2000 units/s. `fireCaptive` launches
   immediately on an eligible fire action; there is no committed pre-fire state
   for the warning system to announce. `PLAYER_SHOT_WARNING_S = 1.2` limits
   prediction to a future collision with an already existing shot. It cannot
   warn 1.2 seconds before a newly fired short-distance impact.

   One fully off-screen phone shot hit the 20-unit defender about 171ms after
   the first warning, despite zero artificial reaction delay. The shared walking
   function needs about 196ms just to move that body 41 units sideways from rest.
   Allowing the same 250ms reaction benchmark as the old regression tests gives
   about 446ms before network delay. The 101.5-unit body needs about 454ms of
   movement alone, or 704ms with that reaction allowance. A 300-unit body needs
   substantially longer and should not be promised universal dodgeability.
   All twelve strict 250ms-response encounters hit. Increasing the predictor
   horizon or enlarging an arrow cannot create time before projectile launch.

2. **The edge warning can be absent on first receipt.**
   In `src/render/incoming.ts`, an already-fully-visible projectile with no
   previous hint returns from the edge-warning path immediately. The renderer
   draws only a small outline/wake around the moving creature. A near-edge shot
   can be born off-screen and enter before its first replicated/rendered frame.
   The strict phone run includes a hit with zero edge-arrow paint frames; the
   first-paint capture independently shows the halo rather than an edge arrow.
   This explains why a player can reasonably perceive no warning.

   First-paint screenshots also confirm that the distant-shot arrow is actually
   painted at alpha 1. There is no evidence here for a global transparency or
   missing-render-call bug. The cue is small, peripheral and gold, among similarly
   colored loot, and its appearance alone does not establish recognition time.

3. **Fan-launched player bodies have no incoming warning descriptor.**
   `playerMissileShot` explicitly rejects `flightKind === 'turbine'`. Its tests
   explicitly retain that exclusion. `drawTurbineFlights` animates gem transport;
   it is not an incoming body-shot warning. A canonical shared-server reproduction
   had both player-missile and fan-body impacts after 250ms: the missile was
   predicted, but the fan body was not. That fan hit reduced 100 gems to 55 and
   caused injury. The bot dodge helper shares the same missing descriptor.

4. **The previous tests establish a narrower result than ordinary mobile play.**
   All six existing desktop/Android warning cases still pass. They place a
   stationary defender in open space, use shooter distances 1550/1750, then react
   after the cue. They prove that the warning can render and a distant shot can
   be dodged; they do not cover newly fired edge shots. The source also selects
   one earliest threat and removes its hint as soon as exact current-velocity
   prediction finds no collision. Already-moving defenders, turning/releasing
   a stick, crossfire and warning stability need additional encounter coverage.
   Those last cases are code-review coverage gaps, not measured failures in this
   24-encounter sample.

## Recommended next work

The first design target is a believable opportunity for small and medium bodies
to react and move, while retaining rewarding hits and the size hierarchy. Do not
promise that every giant can sidestep every shot, change the accepted damage/KO
rules, add device-specific protection or weaken only bots.

- The user rejected firing windup after this audit. Compare shared speed/range
  and camera coverage using measured reaction-plus-movement margins. Check close
  visible attacks, long shots, ammo holds, black-hole launches and tutorials
  before adopting tuning. A larger warning horizon cannot supply pre-launch time.
- Keep a brief contextual danger cue readable through first receipt and screen
  entry, including when the first frame is already inside the viewport. Consider
  a nearby-body direction cue alongside the edge cue; preserve the eyes, thumb
  controls and map. Avoid permanent labels, firing lanes and extra tutorial text.
- Include damaging fan bodies using their actual drag, lifetime and public motion.
  Recheck moving defenders, crossfire, held controls, all approach directions,
  safe areas, real mobile latency and actual Pixel input/frame timing.
- Apply the selected shared timing/speed/rules to humans, bots and tutorial play.
  Keep actual physical-device and human recognition limits explicit.

No production code, combat constants, commit, merge or deployment was changed
for this audit. The diagnostic harness/logs and first-painted-frame images are
local under `.tmp/nov25-warning-*`; only evidence and project notes are saved.

## Interface review

Internal heuristics, not measured usability scores: usability 4, hierarchy 6,
accessibility 5, consistency 6, responsiveness 7, feedback 4 and performance 8.
Priorities are the actual reaction budget, readable and stable contextual cues,
consistent coverage of damaging projectiles, and physical-device input/frame
measurement. The findings do not justify an unrelated arena or menu redesign.
