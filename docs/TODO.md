# Ascend Avoid — current work and next-session handoff

Updated November 3, 2026. The defense release is live; rounded corners are now
implemented and tested on `codex/rounded-arena-corners`; the user approved
commit, merge, push and deployment after playing it. This is the active list.
The complete earlier request inventory is preserved in [TODO_HISTORY.md](TODO_HISTORY.md).
Historical studies and checklists can describe removed mechanics; do not treat
those descriptions as unfinished implementation work.

## Rounded corners — release approved November 3

The user requested actual rounded corners with matching collision/movement and
smooth large-player navigation. The local implementation uses a 700-unit radius
on the 4200-unit arena, shared by server movement, prediction, world outline and
minimap. Growth, knockback, wall-puff recoil, flights, safe spawning and reachable
pickups/parts honor the same shape. Small/large/maximum-size corner checks pass;
see [ROUNDED_ARENA.md](ROUNDED_ARENA.md) for verification and local preview links.
The user reported that it feels good and authorized release. The protected
[main deployment workflow](https://github.com/life423/ascend-avoid/actions/workflows/deploy.yml)
records the published revision and deployment result. Keep 75% breath, shove
strength, speed and unrelated tuning.

## Previous verified live release — defense

- Live main: [`5ca85fb`](https://github.com/life423/ascend-avoid/commit/5ca85fbea932c55f73657ba193898e5eb0b52b22),
  [PR #76](https://github.com/life423/ascend-avoid/pull/76).
- [Production deployment](https://github.com/life423/ascend-avoid/actions/runs/41542025055)
  succeeded. Azure revision `ascend-avoid--0000116` was healthy, with one replica
  and 100% traffic. Live health, client bundle and WebSocket puff receipt passed;
  a full-meter puff left exactly 25% breath.
- Defense now costs **75% of a full breath**, with normal refill, no fixed
  gameplay cooldown and no added refill pause. Earliest next puff from a full
  starting meter is about 1.5s later with uninterrupted idle refill; from empty,
  collecting 75% takes 2.25s. Inhale shares the meter.
- Front/rear puffs preserve the pursuer's held inhale, latch and accumulated
  pressure. Ordinary loss of range/aim still decays contact. Rear arc is **140°**;
  front cone, reach and shove strength stay unchanged. Valid-hit recoil blocked
  by a wall can redirect along movement input within its existing recoil budget.
  Empty puffs cannot dash. No gust stun, shield, solid barrier or guaranteed escape.
- The user tested 75% and said it feels good. Build, types, schema, lint,
  47 unit suites plus progress checks and 45 desktop/emulated-mobile browser cases
  passed locally. Required CI and production unit/multiplayer checks passed.
  This establishes mechanics and release health, not broad human balance.
- Audit cleanup, README/gameplay screenshot, favicon/source-bundle placement,
  itch.io embedding headers and the share QR are complete. No unfinished release
  steps remain for that earlier release.

## Suggested next session

1. Play wall/corner chases with the released 75% defense before changing tuning.
   Include equal/large pursuers, active tracking, several attackers and black-hole rims.
2. Run the physical Pixel/browser checks below, especially Android Firefox lag,
   injured escape and incoming-shot reaction time.
3. Review ordinary-match pacing, weapon assembly and long-run growth together.
   Use recordings and measurements; do not require the user to replay as a
   prerequisite to reproducible technical investigations.

## Remaining work

### Defense and cornering

- [ ] Assess 75% breath in real matches: a useful first escape, cost of misses,
  repeat pressure, and the shared choice between puff and inhale. Keep current
  shove strength and other balance unchanged until a further change is chosen.
- [ ] Evaluate wall-slip recoil at all walls/corners, with moving/tracking
  pursuers, size differences, diagonal input, several attackers and nearby holes.
  Check that movement can clear a mouth, while a failed escape can still be caught.
- [x] Implement rounded arena corners with matching server collision, movement,
  client prediction and visuals, including giant navigation. Implemented locally
  November 3; the user subsequently approved commit, merge and deployment.
- [ ] Playtest residual boundary pinning with people after the rounded-corner
  change. Rounding and wall slip do not guarantee escape from a tracking mouth
  or a crowded fight; choose further counterplay from evidence.
- [ ] Confirm real-phone puff registration, airflow readability and the remaining
  perceived-clash/control-lock complaint. Ordinary body contact and assembled
  weapon pushes are steerable; cannonball/turbine impact stun remains intentional.
  Do not restore automatic pressure cancellation or old overlapping protections.
  See [GUST_DEFENSE.md](GUST_DEFENSE.md) and [CONTROL_LOCK_AUDIT.md](CONTROL_LOCK_AUDIT.md).

### Growth, combat and the whole game loop

- [ ] Validate time to a worthwhile first capture, shot, escape or build in
  ordinary play. Earlier scripted opportunity counts were much lower for passive
  gatherers than curious players; they do not establish newcomer understanding.
  Improve discovery without forced fights, bot handicaps or invented rewards.
  Assess whether friends can readily play together; a room-specific invite system
  remains a separate design decision beyond the shipped website QR.
- [ ] Measure opening setbacks, time to capability, small/medium knockouts,
  capture/ammunition supply, spill recovery, leader turnover and late giant counts.
  Compare the full time series, not a match average that hides late crowding.
- [ ] Test the released 25% rival-hit floor alongside stronger early hits,
  standard bullets, the 20%-wider shooter finish, injury theft and mouth finishes.
  Recheck meaningful damage, follow-up choices and near-peer escape opportunities.
  The pure 33% and capture-to-fire-delay experiments are not activated.
- [ ] Assess solo/group inhale, size resistance, injured outward retreat,
  repeat-capture recovery and safe respawns in human/group matches. Same-size
  inhale should allow understandable counterplay; proximity to the mouth can
  still be decisive. Keep healthy gem theft disabled.
- [ ] Validate the rare, durable-giant goal and memorable rivalries/replayability.
  Two or three giants in a 20-player arena is an observation target, not a quota.
  Sustainable hours-long reigns and human fun have not been demonstrated.
  Meaningful knockouts are part of the desired fun; do not optimize universal
  survival or act on the withdrawn accidental “too punishing” selection.
  See [GAME_LOOP_REVIEW.md](GAME_LOOP_REVIEW.md),
  [RIVAL_DAMAGE_AND_BREATH.md](RIVAL_DAMAGE_AND_BREATH.md),
  [BALANCE_VALIDATION.md](BALANCE_VALIDATION.md) and [INJURED_ESCAPE.md](INJURED_ESCAPE.md).

### Incoming shots and assembled-weapon fairness

- [x] **Implement ownership/safety cues for all six assembled weapons locally.**
  Mint `#80FFF1` rims with a small shield, paired friendly bolt trails, matching
  beam/Pulsar accents and minimap shields identify the actual local builder.
  Opaque navy `#07131F` edging keeps essential marks readable over white bodies
  and bright loot; recipe shapes and hollow/armed cues remain distinct. One brief
  assembly reveal respects reduced motion. Owner immunity and balance are unchanged.
  Implementation and verification: [WEAPON_OWNERSHIP.md](WEAPON_OWNERSHIP.md).
- [ ] Human/device review of the ownership cues in a crowded live match, including
  the actual Pixel/Firefox, bright overlaps and color-vision/readability. Automated
  mobile emulation does not establish physical-device or full accessibility compliance.
- [x] Ownership visuals approved for commit, merge and production release after
  the user's local playtest. GitHub Actions remains the release record.

- [ ] Check the player-cannonball warning on the actual Pixel/production camera:
  offscreen and partial entry, close/distant shots, moving defenders, several
  threats, changed trajectories, latency, HUD/touch occlusion and disappearing threats.
  The current warning uses up to 1.2s of deceleration-aware prediction; the original
  0.5s-only warning is superseded. No warning can create lead time before launch.
- [ ] Assess satellite/Pinwheel tracer-versus-gem recognition, close-launch fizzle,
  charge/readability, range and real dodge opportunities. Check giant central
  hits versus grazes, repeated Pulsar damage, two-weapon pressure and wall traps.
  Keep the classic spinning machine gun and Pulsar available alongside satellites.
- [ ] Confirm staggered construction availability keeps satellite/weapon clutter
  manageable even when players save and deploy cargo together. All six recipes
  already exist; evaluate current weapons before approving more.
- [ ] Play contested three-part assembly with people: discovery, matching guidance,
  reserved-part red X/mint ownership cues, healthy-carrier piece theft, interruption,
  defenses, takeover, recipe choice and deployment while continuously steering.
  Verify builder damage/knockout tally and gem awards remain understandable.
- [ ] Assess shot-only black-hole play and giant navigation around soft rims,
  especially by boundaries and under suction/recoil. Walking must remain safe.
  See [PROJECTILE_COUNTERPLAY.md](PROJECTILE_COUNTERPLAY.md),
  [WEAPON_FAIRNESS.md](WEAPON_FAIRNESS.md), [PULSAR_CRESCENT.md](PULSAR_CRESCENT.md),
  [WEAPON_PACING.md](WEAPON_PACING.md) and [WEAPON_CONTEST_PLAYTEST.md](WEAPON_CONTEST_PLAYTEST.md).

### Tutorial learning and visual clarity

- [ ] Observe fresh, uncoached players through all five lessons and the handoff to
  ordinary play: capture, deliberate aim/hit/finish, puff-and-flee versus injured
  escape, black-hole capture/shot/reward, and assembly/place.
- [ ] On real touch hardware, verify held joystick across Ready/automatic stage
  transitions, second-thumb actions, retained aim, local retries, reading time,
  and unobscured opponent framing. Countdown/loading/arrow escape are removed;
  do not reintroduce them from historical notes. Retain the joystick permanently.
- [ ] Confirm LET GO / HOLD AGAIN feedback explains exhausted held input without
  accidental firing/puffs; review lesson text and action reach at narrow sizes.
- [ ] Review the injured shell from front/rear/sides on a physical phone, including
  clear eyes, healing, holding ammo, finish effects and reduced motion. Artwork
  is implemented; recognition, appearance and device cost still need human review.
- [ ] Low-priority polish: transient gain/name overlap remains noted in the
  tutorial review. See [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md)
  and [INJURY_ART.md](INJURY_ART.md).

### Physical device checks

- [ ] Confirm the Android Firefox rendering fix resolves the reported severe lag
  on the user's phone; compare with Chrome on the same device. Cached/cullable
  rendering shipped, but emulation is not proof of actual Firefox performance.
- [ ] Test Android Chrome/Firefox and the installed regular/Test wrappers in both
  orientations: movement/aim, puff/fire, weapon placement while steering, capture,
  flight, knockout/respawn, five lessons, sound/mute, menu finger scrolling,
  keyboard/name entry, focus restoration after Help and safe-area/browser-chrome changes.
- [ ] Test native Back, Home/resume, reconnect, repeat launch and a longer session
  for frame/input delays, heat and battery use. Record actual device/build/origin;
  keep physical results separate from desktop browser/device emulation.
- [ ] Recheck the original Pixel findings against the shipped fixes rather than
  treating their old issue text as current behavior. Trackers:
  [#66](https://github.com/life423/ascend-avoid/issues/66),
  [#69](https://github.com/life423/ascend-avoid/issues/69).

### Production performance and accessibility

- [ ] Freshly measure frame/input responsiveness, rendering under many effects,
  memory, console/network failures, PageSpeed/layout shifts and current metadata.
  Historic scores and predictor microbenchmarks are not on-phone FPS measurements.
- [ ] Review enlarged text, contrast/color-independent cues, reduced motion,
  keyboard/menu focus and screen-reader Help navigation. Full nonvisual gameplay
  has not been validated. The quiet projectile warning has no sound; any proposed
  alternative accessibility cue needs a deliberate design decision.

### Android readiness and deferred distribution

- [ ] Show both APK and web release identifiers in the menu; record actual device
  checks with the tested revision. Regular web changes arrive on a fresh load;
  native changes require an APK/Play update, with no automatic push to the phone.
- [ ] User action: copy the already restore-verified encrypted signing backup to
  secure off-computer storage and retain its full password separately. Never put
  keys/passwords into Git, images, workflow artifacts or issue attachments.
- [ ] Review both supplied V12 production/TEST icons on the Pixel launcher,
  other masks and themed icons. The source bundles, native resources and corrected
  installs are already done; do not recreate the artwork as an unstarted task.
- [ ] **Store preparation remains on hold pending Google account approval.**
  When resumed: finalize package identity, use the unmarked production listing
  icon, prepare privacy/Data safety/audience/ads/rating declarations from actual
  behavior, screenshots/feature graphic, Play signing association and an actual
  Play-installed check. Complete the applicable real-human testing requirements
  before a production application. Nothing has been published to Google Play.
- [ ] Later tooling follow-ups, not part of this release: native CI artifact
  distribution and more narrowly scoped Azure credentials/OIDC.
  See [ANDROID_TESTING_WORKFLOW.md](ANDROID_TESTING_WORKFLOW.md)
  and [ANDROID_RELEASE.md](ANDROID_RELEASE.md). Icon tracker
  [#68](https://github.com/life423/ascend-avoid/issues/68) still has stale pre-V12 text.

### Deferred CI and maintenance

- [ ] Repair the Ubuntu Chromium/Gecko/WebKit browser matrix and re-enable it
  when that deferred work is resumed. Preserve the required gameplay CI gate.
  The current Mac Firefox test-runtime failure also remains unresolved; neither
  skipped CI nor emulated Chrome/WebKit establishes Firefox coverage.
- [ ] Reconcile GitHub #66/#68/#69 with the later shipped changes when updating
  those trackers; retain their genuinely open physical-device/store/design work.
- [ ] Keep current docs separate from historical studies. Confirmed dead code/files
  and the follow-up audit cleanup are released; no known audit removal batch is
  waiting. Preserve the single-player fallback, browser networking adapters,
  neutral wire slots and intentional report/branding archives. Re-audit only
  when there is new evidence, rather than deleting required compatibility code.

## Completed or superseded requests — do not put back on the work queue

- **Shipped:** six weapon recipes, satellites plus Pinwheel/Pulsar, reserved sets
  and missing-part guidance, fewer orbital sets/staggered availability, healthy
  carried-part theft and moving deployment; builder gem rewards plus damage/KO tally.
- **Shipped:** large-body weapon fairness, readable weapon shots/charges,
  softer weapon pushes, bot deliberate aim/shared rules, group-pressure limits,
  shot-only black holes with safe soft rims, safer spawns and short recovery protection.
- **Shipped:** fixed non-refreshing seven-second injury, permanent gem losses,
  rapid injury theft and decisive mouth/cannon finishes. Sustained-theft
  continuation was later **removed**; it must not keep vulnerability alive.
- **Current capture:** healthy capture requires a captor at least 1.3× wider;
  captured prey become standard 60-unit ammunition;
  capture transfers excess growth above that bullet size, not the old 30% share.
  Hold duration uses pre-transfer sizes; input must be released before firing;
  the captor alone aims. Injury blocks inhale and puff, while ordinary movement
  and firing an already-held captive remain available. The old 15% weakened
  inhale proposal is superseded by this breathing block.
- **Removed by later decisions:** shot-follow/tether movement; belly salvage,
  interior bonus gems and pending payouts; arrow escape, captive steering,
  daze/loading prerequisites and tutorial countdowns. Belly downtime and tuning
  these removed systems are not outstanding work. Do not restore without a new request.
- **Shipped UI:** uncluttered arena notices/drawer history, symbol/color locked-part
  cues, revised menu/minimap layout with player count removed, mobile text centering,
  touch-scroll/focus/input fixes, optional five-lesson practice and exhausted-input cues.
- **Shipped maintenance:** confirmed audit cleanup, README plus actual gameplay
  image, favicon/source assets in the correct folders, itch.io embedding support,
  and the friend QR linking to https://ascend.drewclark.io/.
- **Withdrawn/superseded:** injury movement slowdown; fixed puff cooldown or refill
  pause; 35%/80% puff trials; old 0.5 speed exponent/130 minimum; automatic pressure
  reset. Current movement remains the released quarter-power size rule without a floor.

## Ideas requiring a decision

Additional boundary counterplay beyond the local rounded corners, more weapon types, run-over
power-ups, further weapon/capture pacing changes and alternate accessibility cues
are discussion items, not approved implementations. The fifteen earlier growth/
combat options and five cannon-strengthening options remain preserved in
[the historical inventory](TODO_HISTORY.md#fifteen-growth-and-combat-ideas-to-evaluate).
Do not apply them as a bundle or activate the pure-33%/one-second firing trials
without a new decision. Future tuning preserves shared human/bot mechanics,
finite non-wrapping boundaries, visible eyes, the existing joystick, safe ordinary
black-hole navigation and the user's preference for clean, contextual UI.

## Resume notes

Working copy: `/Users/andrewclark/programming/ascend-avoid` (the old Codex worktree
path is stale). Latest tested local game was served at http://localhost:3001/;
check the process before assuming it is running. Start future gameplay edits on a
feature branch, verify the changed behavior, and use the protected PR/main release
workflow when publication is authorized. Production currently uses **one replica**
for in-memory Colyseus rooms; scale-out requires deliberate shared-state/matchmaking
work. Test candidates on the separate staging/Test app when appropriate.
