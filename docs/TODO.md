# Ascend Avoid — current work and next-session handoff

Updated November 9, 2026. The prior production release was `eea3b81` (PR #93).
It includes the relic comet, true-scale minimap body outlines, and the
90-second black-hole lifetime with safe relocation retries. The complete earlier
request inventory is preserved in [TODO_HISTORY.md](TODO_HISTORY.md).
Historical sections below record earlier checkpoints.

## November 9 gameplay follow-up — release approved

- Rounded camera framing keeps nearby small players visible beside a giant
  at the wall. The arena mask still covers the outside of the rounded floor.
- First spawns in established arenas favor reachable gems and similarly sized
  rivals when the existing clearance and escape checks allow it. Across 12
  paired late-join replays, first-minute captures fell from nine to four.
  Three of twelve runs assembled a weapon within three minutes in each build.
- Bots use the public comet countdown to look for an escape route. Loaded bots
  briefly favor a visible leader when their current shot could earn an injury,
  using their existing aim delay and accuracy. Four paired bot matches showed
  more qualifying target selections, with mixed injury and lead-change results.
- A comet strike opens the existing seven-second injury window only at 10%
  nominal damage or more. A graze can still cost gems and shove. The direct hit
  remains 75%. Each carrier has 60 cumulative seconds to tow a given relic.
- Fan and black-hole placement reject combinations that split previously
  connected routes for the largest bodies.
- Matched rear-puff trials found about 31 extra units of separation after half
  a second in open space and 45 near a rounded corner when a hit connected.
  The rear burst, 75% breath cost and inhale pressure rules retain their tuning.

## November 5 release — approved

The user reviewed the local result, said it feels good, and authorized commit,
merge to main, GitHub push and live deployment. The
[production workflow](https://github.com/life423/ascend-avoid/actions/workflows/deploy.yml)
records the merged revision and rollout result for this batch.

- [x] Run a current-rule overall growth/combat playtest against `9344b16`:
  fresh/established population time series, controlled shot/escape/weapon sweeps,
  full-layout giant navigation and recorded desktop/mobile browser encounters.
  Findings and limits: [OVERALL_GROWTH_COMBAT_PLAYTEST.md](OVERALL_GROWTH_COMBAT_PLAYTEST.md).
  The initial research pass was read-only; the following implementation and
  release were subsequently authorized.
- [x] Implement the requested meaningful player/fan projectile injury gate locally.
  Provisional minimum normalized power: 8%, using physical bodies and existing
  stored shooter power independently of banked gems. Weak hits retain their
  exact damage and brief stun; meaningful hits retain fixed non-refreshing 7s
  injury. See [EARNED_PROJECTILE_INJURY.md](EARNED_PROJECTILE_INJURY.md).
- [x] Complete automated desktop/mobile encounter review of the projectile gate:
  build/types/schema/lint, 59 server suites, 18 multiplayer scenarios and 28
  browser cases across desktop Chrome, Android Chrome emulation, iPhone WebKit
  and Firefox phone viewport pass. No physical-phone result is implied. The
  original pressure driver now records zero theft/knockouts in 72 weak-hit
  encounters. Root also checked normal input and weak/peer impacts in the local UI.
- [x] User reviewed the local candidate and approved release of both gameplay fixes.
- [ ] Continue ordinary human matches with the new projectile gate; the local
  controlled encounter remains at <http://localhost:3001/projectile-injury.html>.
- [ ] Review combined fan/hole placement for giant routes. A reproduced legal
  max-body layout stays compartmentalized until a fan retires; holes-only
  connectivity does not guarantee complete-layout connectivity. Keep physical
  collision and ordinary speed unchanged until a specific fix is chosen.
- [x] Implement the authorized persistent physical-growth account locally.
  Live gem losses now debit current growth proportionally; only new receipts
  regrow it. Overflow wealth, no-op updates, landing and spawn retries cannot
  restore old growth. Capture conversion, 60-unit flight shells, exact transfers
  and once-only pending rewards remain intact. No other tuning values changed.
  See [GROWTH_ACCOUNTING.md](GROWTH_ACCOUNTING.md) and its measured comparisons.
- [x] Verify build/production package, client/server types, unchanged wire schema
  and lint; all 60 server suites, 18 multiplayer scenarios and 38 browser cases
  pass. Browser coverage includes four growth-review profiles, 28 combat cases,
  plus standard bullets and the full five-lesson sequence on desktop/Android
  emulation. Independent review also caught and fixed a near-cap rounding issue;
  tiny new pickups no longer erase accumulated fractional losses.
- [ ] Continue ordinary-match review of growth loss and genuine regrowth; the controlled review is at
  <http://localhost:3001/growth-account.html> and in ordinary matches. Existing
  upkeep now physically shrinks capped players at its unchanged rate (about
  1470→1426.5 width after one minute from 10m gems without gains).
- [x] Normalize assembled-weapon injury credit by pre-hit body width in the
  local candidate. Exact gem losses and builder rewards still use the gem bank.
  See [EARNED_WEAPON_INJURY.md](EARNED_WEAPON_INJURY.md).
- [x] Give smaller bots room to forage around a giant's flank and rear, react
  to visible turns, and use their speed for outer-cone retreat. See the paired
  local results in [BOT_GIANT_AVOIDANCE.md](BOT_GIANT_AVOIDANCE.md).
- [ ] Solo review with 11 real bots at <http://localhost:3001/bot-giant.html>.
  Compare close front, close flank, and a pursuit after turning toward the bot.
- [ ] Consider fan-opening revalidation for late growth/forced-entry overlaps.
  Existing selection already reserves players; the controlled 795-unit opening
  correction is an edge case, not proof of ordinary fans spawning under giants.
- [ ] Continue newcomer and device checks. Human-versus-human matches are
  deferred until another player is available.

## Released November 4 — PR #84

The user reviewed this local candidate, said it feels good and authorized commit,
merge to main, GitHub push and live deployment. The
[production workflow](https://github.com/life423/ascend-avoid/actions/workflows/deploy.yml)
records published commit `9344b16` and its successful rollout. Required CI passed
normally; the earlier one-time override was not reused. The local main checkout
was synchronized and clean before this subsequent playtest work.

- [x] Implement periodic black-hole retirement and safe relocation, with a
  closing warning, harmless new-location warning, activation revalidation and
  bounded retries. Provisional values: 60s active, first-cycle 12s slot stagger,
  3s closing, 1.5s dormant, 4s warning, 1s blocked retry. Preserve safe ordinary
  walking, shot-only lethality and full-size routes around holes. See
  [BLACK_HOLE_RELOCATION.md](BLACK_HOLE_RELOCATION.md).
- [x] Replace tilted ellipse art with circular dark cores and broken circular
  rings in both world and minimap. Hollow gold warns; closing retains its full
  lethal core until disappearance. No new gameplay banner or sound.
- [x] Improve HUD/award text readability without changing the restored Menu
  layout. Fade overlapping glass, retain outlined text and group readable
  gain/loss counters clear of the crown/name. Clarify tutorial radar/ownership
  and Help's black-hole warnings. See [HUD_READABILITY.md](HUD_READABILITY.md).
  Human recognition still needs review.
- [x] Pair this Mac with the user's Pixel 10 Pro XL over Wi-Fi. No APK installed.
  User selected Chrome-only phone testing; physical Firefox remains pending.
  Track exact checks in [DEVICE_VALIDATION_2026-11-04.md](DEVICE_VALIDATION_2026-11-04.md).
- [x] Short actual Pixel Chrome check: approximately 60Hz animation callbacks
  over 15s, no gaps above 50ms or page/network errors. Joystick plus inhale,
  release, puff and finger-scrolling pass. Phone Chrome can open
  <http://localhost:3001/> while the paired ADB connection and Mac preview run.
  This does not establish long-session, landscape or Firefox performance.
- [x] Review later hole-size, size-tiered weapon and pre-launch fan-aim directions.
  Concrete proposals and dependencies are in
  [NEXT_GAMEPLAY_DESIGNS.md](NEXT_GAMEPLAY_DESIGNS.md); these ideas are not enabled
  or agreed balance values. At this release fan impacts injured on any spill;
  the November 5 projectile gate now requires physical impact power for injury.
  Deliberate fan aim remains a separate design decision.
- [x] Verify build, schema, client/server types and lint; 58 server suites,
  18 multiplayer scenarios and 49 browser cases across the hole, mobile,
  starfield and HUD suites pass. Three 180s/20-bot simulations recorded 19 safe
  relocated openings with no all-hole starvation. Human balance, long sessions
  and globally open routes through existing fans are not established by this.
- [x] User reviewed the local candidate and approved release.
- [ ] Continue ordinary human matches and longer device sessions after release.

## Released November 4 — PR #83

The user reviewed the local version, said it feels good, and authorized commit,
merge to main, push and live deployment. The
[production workflow](https://github.com/life423/ascend-avoid/actions/workflows/deploy.yml)
records the final published revision and deployment result.

- [x] Make all assembled weapons earn injury through a meaningful central hit or
  concentrated burst. Provisional threshold: nominal impact credit equal to 5%
  of pre-hit physical mass in a rolling 2s window. Damage, rewards, guards and
  fixed non-refreshing 7s injury are unchanged. See
  [EARNED_WEAPON_INJURY.md](EARNED_WEAPON_INJURY.md).
- [x] Measure the late growth curve and try a later taper/larger maximum on the
  **same arena with the same bot count**. Local trial starts extra taper at 840
  and approaches 1,470 width; early growth is unchanged. See
  [LATE_GROWTH_TRIAL.md](LATE_GROWTH_TRIAL.md) and its recorded comparison.
- [x] Accommodate the new maximum through initial hole placement: upper holes
  now start at 40% arena height. Full-body routes from all corners to the center
  pass authoritative human/bot checks; no reduced body/rim collision or walking
  damage. Dynamic relocation shipped separately in PR #84 above.
- [x] Measure speed, body-length travel and turns across size tiers. Current
  formula gives 109.3 units/s and a roughly 1.03s 90° turn at maximum width;
  half-width prey retain 18.9% faster walking. Clear hole-only corner-to-center
  routes take 18.7–20.7s. Keep testing whether this feels slow without becoming
  tedious; no speed/turning constants have changed in this trial.
- [x] Implement bounded large-player inhale framing locally. The view pans
  forward smoothly and returns on release; **no inhale-driven zoom** (explicit
  user preference). Preserve player visibility, rounded containment, ordinary
  movement framing and tutorial objective framing. See
  [INHALE_CAMERA.md](INHALE_CAMERA.md) for tuning and verification.
- [ ] Human playtest these provisional values in ordinary matches, especially
  first-hit breathing availability, burst injury, giant capture reach, continued
  physical growth and tighter hole/corner routes. Automated checks are not a
  claim of final balance. At extreme uncapped gem totals, existing weapon damage
  can again exceed the injury threshold in one hit; assess this dependency.
- Local normal game: <http://localhost:3001/>. Disposable controlled review:
  <http://localhost:3001/growth-review.html>. No opt-in gameplay flag. Local
  review is complete; continue the broader human/device checks below after release.

## Newly discussed design follow-ups

- [x] Implement the join modal locally over the live arena. Let players enter a name and choose
  controls before they spawn. Prefill saved choices on return. Show **Tutorial**
  and **Play now** on the first visit, then use a single **Play** action on
  later visits. Keep practice accessible from the menu.
- [ ] Human/device review of the implemented [inhale framing](INHALE_CAMERA.md):
  reading targets/shots, turning, mouth visibility, corners, crowded HUD overlap
  and motion comfort. Preserve the user's explicit **no inhale zoom** preference.
  Full-cone visibility cannot always coexist with the current portrait viewport
  and no exterior: at width 1,470 reach is 3,020 units beyond the mouth.
- [x] Implement the agreed black-hole close–warning–reopen relocation locally.
  The closing core remains lethal until gone; a shot arriving afterward receives
  no black-hole reward. New locations cannot open underneath a late entrant.
- [x] Redesign black-hole world/minimap icons as circular dark cores and broken
  circular rings; retain distinct hollow warning and retiring live states.
- [ ] Consider modest small/medium black-hole size variation after relocation.
  This is an idea, not implemented tuning. Match visible/core/rim geometry and
  minimap size cues; check giant routes and avoid closing corridors with huge holes.
- [ ] Explore size-tiered weapons as a later progression goal. Physical size
  could unlock a recipe, while rare contested parts and an exposed build process
  earn the strongest weapon. Decide shrink-before-completion, duration/ammo and
  counterplay. Do not grant an automatic leader weapon or silently add recipes.
- [ ] Discuss pre-launch self-aiming in a fan. Existing fan flight has limited
  steering; a bounded aim/loading opportunity would be separate. Preserve small
  ammunition's physical limits against giants, avoid player-shot shooter bonuses
  on fan launches, and prevent re-entry spam. No implementation is approved yet.
- Arena enlargement and additional bots are **deferred**. First assess more
  rewarding physical growth, small-player escapes and mobile performance on the
  current arena. The user does not need to know an exact score where reward fades.

## Bot giant awareness — released November 4

- [x] Use actual mouth-facing inhale reach and bot radius for proactive giant
  avoidance, retaining the existing close-body caution and normal reactions.
  Other balance constants are unchanged. With the gem-clearance fix below,
  build/types/schema/lint, 53 server unit suites, 18 multiplayer scenarios and
  nine desktop/emulated-mobile checks pass (six AI and three full gem fields).
- [x] User reviewed the local [bot giant-awareness fix](BOT_GIANT_AVOIDANCE.md),
  said it feels good, and authorized commit, merge and live deployment. The main
  deployment workflow records the published revision and result.
- [ ] Continue ordinary-match testing of giant chasing, crowded encounters and
  whether bots remain engaging; retain the unchanged balance constants.
- The 288-case comparison shows earlier retreat with unchanged tuning, but its
  three-second warning setup does not establish human balance or invincibility.

## Gem placement — released November 4

- [x] Keep initial/refilled gems, showers, surge crystals and jackpots clear of
  black-hole rings. Clear settled overlaps while preserving moving drop paths,
  normal counts, values and refill/expiry timing. See
  [GEM_BLACK_HOLE_CLEARANCE.md](GEM_BLACK_HOLE_CLEARANCE.md).
- The user reported the overlap while the bot release was pending. This fix is
  included in released PR #82; the main deployment workflow records the rollout.
- Required GitHub CI statuses stayed queued despite completed successful logs,
  including a fresh run. The user explicitly authorized a one-time admin merge
  override. Original branch protections were restored and verified unchanged.
  Treat as isolated for now; investigate GitHub Actions/check reporting if it
  recurs. Do not reuse the one-time override as standing permission.

## Rounded camera follow-up — release approved November 3

- [x] Constrain the whole camera viewport to the rounded arena, including large-player
  visibility, growth, knockout/respawn and phone rotation. Geometry and browser checks
  pass locally; see [ROUNDED_CAMERA.md](ROUNDED_CAMERA.md).
- [x] User reviewed the local camera and approved release. Continue longer device
  playtests of corner zoom, maximum-size bodies and HUD overlap. Giants retain their center/body core; their outer edge can crop at
  a curved wall because a full circular body and zero exterior cannot always fit
  in the same rectangular viewport.
- [x] Camera follow-up approved for commit, merge and production release. The
  protected main deployment workflow records the published result.
- Menu experiments were explicitly reverted. Keep the original top-right Menu box
  with the minimap underneath; no collapsed dock, hidden-menu gesture or relocated icon.

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

## Next playtests

1. Compare first-spawn pacing, lead turnover, giant routes and relic contesting
   with people in ordinary matches.
2. Compare longer physical Pixel sessions in Firefox and Chrome, including
   landscape and touch input under load. The Firefox CI and prior short physical
   results are documented in [device validation](DEVICE_VALIDATION_2026-11-04.md).
3. Review rear-puff reliability against a tracking player and decide whether its
   hit timing or strength needs a separate change.
4. Revisit [later gameplay designs](NEXT_GAMEPLAY_DESIGNS.md) when ready. Fan
   self-aim, tiered weapons and variable hole sizes are separate design work.

## Remaining work

### Defense and cornering

- [x] Local tracking playtest of released corners and 75% defense: nine UI-directed
  drills, 24 desktop/emulated-mobile input runs, and 1,872 scripted cases at the
  released 30Hz step plus a 60Hz sensitivity repeat. No gameplay tuning changed.
  See [CORNER_DEFENSE_PLAYTEST.md](CORNER_DEFENSE_PLAYTEST.md).
- [x] Add overlap-aware score/leaderboard glass fading while retaining opaque
  outlined text and the explicitly restored top-right Menu layout.
- [ ] Human review of top-left fights and face/airflow feedback with that fading.
- [x] Implement and locally test bounded wall slip from confirmed rear hits,
  sharing the existing caster recoil budget with front hits. Preserve 75% cost,
  recipient shove, ordinary capture and incoming pressure. See [REAR_WALL_SLIP.md](REAR_WALL_SLIP.md).
- [x] User reviewed rear-hit wall slip, reported that it feels good and authorized
  commit, merge and live deployment. The main deployment workflow records the
  released revision and result. Flank misses still give no slip; do not expand
  hit geometry or strengthen shove without a further decision.
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

The November 4 [current-rule playtest](OVERALL_GROWTH_COMBAT_PLAYTEST.md) now
supplies reproducible evidence for the questions below. It identifies specific
follow-ups above; it does not close broader human-match validation.

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
- [x] Fix transient gain/name/crown overlap locally with grouped gain/loss labels
  and a 12 CSS-pixel minimum at giant zoom. Preserve actual award values.
- [ ] Human/tutorial review of label recognition and newcomer comprehension. See
  [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md) and [INJURY_ART.md](INJURY_ART.md).

### Physical device checks

- [ ] Confirm the Android Firefox rendering fix resolves the reported severe lag
  in a longer live session on the user's Pixel and compare with Chrome. The
  Android Firefox renderer shipped as `47941d2`; short local Pixel runs improved
  at both ordinary and giant size. See [device validation](DEVICE_VALIDATION_2026-11-04.md#november-8-firefox-rendering-release).
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

- [ ] Restore wider Chromium and WebKit browser coverage on Linux. Preserve the
  required gameplay, desktop Firefox, and Android Firefox emulator checks.
  Physical Android performance remains a device playtest.
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
