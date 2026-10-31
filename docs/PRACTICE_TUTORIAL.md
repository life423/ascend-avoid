# Optional practice tutorial

## Reading and feedback release

October 31, on `codex/tutorial-reading-feedback`, based on deployed main
`f10fc82`. The user requested fixes for early weapon placement, reading before
aiming, puff feedback and teaching messages, followed by another mobile pass.
The user subsequently approved committing this batch, merging it into main and
deploying it. GitHub's pull request and production workflow identify the final
published revision and rollout result. The checks below record the reviewed
implementation before release.

- The first aiming attempt waits at Ready. Private preparation preserves the
  actual captive, its remaining hold budget and all earned growth. Inherited
  steering/inhale intent stops; input is gated, touch controls dim and the shot
  countdown stays hidden while reading. Ready resumes the ordinary remaining
  budget. Retries stay immediate, and the existing room inactivity limit applies.
- Assembly advances immediately to the placement checkpoint. A real owned weapon
  already charging certifies placement, including an action made during the old
  success transition. The controller does not ask for another press or record a
  false failure. Completion still requires real attributed weapon damage.
- Aim, injury, approach and theft explanations carry into the next actionable
  cue. These intermediate checkpoints advance without flashing a 50ms message or
  spending the real injury window on a presentation delay. A continuous skilled
  mouth finish retains its final success feedback.
- Holding instead of tapping during rear-cover practice produces immediate
  coaching. The learner can release and puff in the same attempt; a real puff
  clears that coaching. The shared 180ms tap threshold, breath, cooldown, rear
  wall and success checks are unchanged.
- Escape injury details are short and available before Ready. Active escape uses
  the concise instruction and INJURED control state, keeping long text away from
  the touch controls while the chase runs. Combat details focus on theft/finishing.

All five lessons, unlocked selection, linear progression, skip/exit, version-2
saved mastery and the actual-captive handoff remain. Normal matches retain their
existing rules; the separate 33% damage/loading trials stay disabled.

Focused checks cover long reading pauses, genuine hold expiry after Ready, a
moving capture's handoff, immediate real placement, same-attempt puff correction
and readable subsequent cues. Browser verification uses an isolated production
preview; physical-device and uncoached human learnability remain follow-up work.

### Local verification results

The production preview is <http://127.0.0.1:3180/>. All five lessons completed
individually and as a continuous sequence on Android Chromium, iPhone WebKit
portrait and landscape, iPad WebKit and desktop Chromium. A separate 320px phone
completed the sequence with reduced motion. Retained touch aim and injured-target
framing regressions also pass. Screenshots were inspected at narrow phone,
ordinary phone, landscape, tablet and desktop sizes; the revised prompts and
active injury state leave the play controls clear.

There are **58 distinct passing browser cases** across the final checks:
43 lesson/sequence/aim/framing cases, 12 reading/placement/puff/message cases and
three injury-disclosure cases. Seven profile-specific cases are intentionally
skipped. The first matrix had 42 passes and one desktop driver timeout: the trace
showed an E press before the Place control rendered. The driver now waits for the
visible, enabled control, then uses E on desktop or a touch tap. Its clean desktop
rerun passes all six applicable cases. This changed test synchronization, not
the game's placement rules. Evidence is in `.tmp/tutorial-feedback-mobile-final`,
`.tmp/tutorial-feedback-desktop-final`, `.tmp/tutorial-feedback-regressions-final`
and `.tmp/tutorial-feedback-injury-help-final`, with corresponding `.log` files.

The production build, client/server type checks, generated-type check, 40 server
unit suites plus saved-progress checks and 18 ordinary multiplayer scenarios pass.
The final inherited-steering fix was additionally checked by the practice suite
and final browser runs. Lint has zero errors and 185 existing warnings.

Conservative internal review, not a usability measurement: hierarchy,
consistency, responsiveness and feedback are 9/10; usability, accessibility and
performance remain 8/10. Priorities are uncoached newcomer observation, enlarged
text/screen-reader review, then frame/input timing on physical phones. Chromium
uses trusted multi-touch; WebKit uses pointer holds and DOM taps. These are
emulated profiles, not physical-device playtests. These are local pre-release
results; the production rollout also requires hosted client/server verification.

## Previous release and review record

The user approved committing, merging and deploying this reviewed batch on
October 31. GitHub's pull request and production workflow record the published
revision and release result. The local-review status below predates that
authorization; automated browser evidence does not replace human/device review.

October 31: the approved [five-lesson remodel](TUTORIAL_REMODEL_PLAN.md) is
implemented locally on `codex/wrap-wave-shell-spawns`, based on deployed main
`939a97a`. It teaches the new rear escape wave, split-shell injury, soft contact
and ordinary safer respawns. This branch is not merged or deployed. The older
release/review sections below are historical where they describe four lessons.

## Experience

Normal play starts immediately. The first-visit offer has **Play tutorial** and **Not now**, expires after eight seconds and does not take focus. Play tutorial starts the complete sequence directly. Menu → **Practice / Tutorials** offers **Start full tutorial** and all five individually unlocked lessons. The full sequence automatically loads each next lesson after success. An old `ascend.guideSeen` flag suppresses the automatic offer without completing any lessons. The previous four-second starter guide remains removed.

Every lesson is unlocked. Actions must succeed to advance within the selected lesson. A failed attempt restores its target, captive, breath or assembled weapon as needed, retaining earlier passed steps. Two misses reveal a clearer contextual hint. Skip lesson leaves unfinished work unfinished; Exit tutorial and Play now create a clean live session. Completed lessons can be replayed.

1. **Move, grow & capture:** gather four real ten-gem pickups and capture a healthy smaller rival. A nearby soft body demonstrates sliding contact without an obsolete bump stun. The full sequence carries this actual captive into the next lesson. Direct selection supplies normal practice ammunition without granting capture completion.
2. **Aim, hit & finish:** deliberately aim diagonally through an outlined rival before firing; land a real shot while over 20% wider to shatter it. A second, larger rival survives its hit. Separate approach, theft and mouth-finish stages teach its exposed gems and the ordinary 1.3× width/contact finish. Missing restores the current target/ammunition, with the proven aim retained on a shatter retry. Draining a rival before mouth contact is acknowledged accurately and restores only the mouth-finish attempt.
3. **Escape & recover:** the first attempt of each timed stage waits for **Ready**. Flee a pursuer behind you, tap without turning back, let the ordinary 220ms wave form, and move beyond its fixed rear wall after it interrupts real suction. A front puff alone does not certify this skill. Then escape while genuinely injured until the normal seven-second injury expires; inhale and puff remain blocked. A real knockout goes through normal safe spawning and protection before restoring this checkpoint.
4. **Black-hole shot:** first capture a healthy 100-gem rival using ordinary inhale. The actual captive carries into a shot toward a hole 520 units from the starting player center. Capture transfers 68 growth immediately, leaving 32 gems in the standard bullet. A missed shot restores only the shot step. Core elimination credits the remaining 32 once; visible diamonds spiral into the hole and arc to the shooter over 2.2 seconds, with 2.4 seconds before completion. Reduced motion uses a stationary arrival ring.
5. **Build a weapon:** collect three matching Pulsar components, assemble automatically, deploy with E or the existing touch Place weapon control, then watch actual automatic damage against the marked rival. No invented assembly or firing control.

Essential instructions are contextual. Failure reasons survive the immediate attempt restoration, and two misses add a clearer hint. The 44px **About injury** disclosure explains breathing restrictions, unchanged movement, held firing after release and eligible continuous-theft extension. Combat/defense framing keeps both creatures visible; combat and black-hole arenas are 1600×2000, defense is 2400×2400 for the real escape duration, and basics/weapon are 1600×1600. Ordinary live camera rules are unchanged.

The lesson panel includes Sound and, on desktop, the shared **Mouse On/Off** switch. The user's report that mouse controls could not be toggled inside practice is fixed here, without reopening the hidden live toolbar. Preference changes persist across lessons and returning to play; clicking or keyboard-activating the switch cancels held gameplay input without firing a captive. Touch keeps its existing joystick/aim controls. Fresh scenario inventories do not generate pickup celebrations; actual earned growth still does.

Reading a Ready stage cannot consume gameplay actions or move the creature. Starting it preserves the prepared attempt and reset serial, so a movement gesture begun immediately after Ready is not erased by another setup. A genuine new attempt clears old inputs and aligns predicted breath with the server's restored full breath. Bots, NPCs and humans retain the same movement, turning, capture, damage, injury, puff and spawn mechanics. The separate 33% damage and one-second loading trials stay disabled.

October 30 follow-up, local preview on `codex/black-hole-tutorial`: **Practice / Tutorials** is the first action inside Game Menu, with settings directly below. Reopening the menu resets its scroll position so a long activity feed cannot hide these actions. Mobile sound stays in the drawer as requested; desktop also has a sound button alongside its controls. Sound preferences persist and remain synchronized across the menu, desktop toolbar and lesson controls. The mobile Menu action is labeled and separate from the minimap; the player count is removed entirely from the arena HUD after the user questioned its value. The leaderboard contracts to its actual rows. The user approved committing, merging and deploying this follow-up on October 30; GitHub’s pull request and production workflow record release completion.

## Server and connection boundaries

`TutorialRoom` reuses `GameRoom` inputs, simulation and events. It is explicitly created as `tutorial_room`, private, locked to one human and authenticated with a random 256-bit capability bound to the initial authorized session. It never joins public matchmaking. NPCs have normal creature state and mechanics but no roaming bot brains. Scenario configuration is internal, deterministic and independent of UI copy; arbitrary client world options and test commands are unavailable in tutorial rooms, including development.

`PracticeController` owns lesson/stage/attempt IDs, exact target identities, passed steps, success and reset transitions. Capture, part collection, assembly and placement have narrow server events. Completion is derived from real events, never a client assertion. Duplicate/stale events and skip attempts cannot advance unrelated work. New attempt restoration cancels held inputs; carrying a newly captured opponent into the shooting step preserves the ordinary release-before-fire requirement.

Transient reconnects retain the authorized private session (ten-second reconnection window). Late or timed-out connection results are immediately left. Expired reconnects may create only the currently selected private lesson, never a public fallback. Finished/choosing rooms close after one minute; an inactive lesson closes after ten minutes. A server-closed practice session requires an explicit lesson selection to restart, avoiding an automatic room-creation loop. Consented departure disposes the room. Unclaimed creation expires after 30 seconds.

Practice high-score, global activity and weapon-record updates are suppressed. Practice rewards remain real within the private arena; gems, size, cargo and weapons never migrate to live play. The browser build uses narrow Colyseus transport/storage boundaries: native browser WebSocket arguments, and optional auth-token storage with a memory fallback. Node/server clients use the unmodified installed package.

## Progress

`ascend.practice.v2` stores version 2, offer acknowledgment, overall status and each lesson's `not-started`, `in-progress`, `skipped` or `completed` status. It migrates v1 without deleting the original: applicable basics and unchanged weapon/black-hole achievements stay completed; old defense completion is retained as history and labeled **Updated — try rear cover**, while new combat mastery remains unproved. Returning players are not forced through another first-visit offer.

Only server-confirmed completion writes completed. Skipping never grants completion or erases an earlier verified completion. Storage errors retain in-memory progress for this page; persistence across reloads is unavailable when browser storage is blocked. No account, database or cross-device sync is added. Passed steps are checkpoints within the private room; reopening a lesson in a new session is a replay rather than account-level step restoration.

## Verification commands

### October 31 local remodel verification

Hosted rollout follow-up: PR #61 deployed main `ace5825` successfully. Its hosted
client and multiplayer bundles match the verified build byte for byte, and the
server exposes the new combat/defense stages and centered final exercise. Live
browser verification exposed a test-driver assumption: waiting a fixed 60ms
after Ready could click it again before the network acknowledgement, then wait
on the next Ready stage while the chase ran without inputs. The driver now
waits for the server to leave Ready before continuing. Both desktop and trusted
touch defense checks pass against production with this correction. This changes
test synchronization, not gameplay rules, timing or the application build.
The same acknowledgement rule covers Place weapon so a slower response cannot
make the driver re-enter a disappearing placement control.
Both complete live sequences now pass with real captures, shots, rear cover,
injury recovery and weapon placement on desktop and trusted-touch profiles.

The 40 server unit suites and progress migration checks pass. Targeted mechanics
also cover an early wave's real resolution interval, missing the defense window,
holding instead of tapping, a half-second reaction delay before wounded retreat,
and restoring proven aim after a missed shatter. Client/server types, generated
schema checks and the production build pass. Lint has zero errors and 185
existing warnings. All 18 normal multiplayer scenarios pass after the shared
input-readiness gate; the private tutorial network checks also pass, including
stale Ready rejection and movement immediately after Ready without another reset.

The five-lesson browser matrix passes **31 cases**, with four intentional skips
for the small-phone case outside its designated profile: desktop Chrome,
Android-shaped Chrome, iPhone portrait/landscape WebKit and iPad WebKit each
complete all five lessons separately and as a continuous sequence. A separate
320×812 Chromium run completes the sequence with reduced motion. The actual
captive carries from basics into combat, server-confirmed progress persists,
and Play now returns to an ordinary clean live room. No page errors occur.

An additional **50 browser regressions pass** across desktop Chrome,
Android-shaped Chrome and iPhone WebKit. They cover missed shots, retained and
replacement thumb aim, the injured rival staying in view, repeat-puff hints,
blocked injured breathing, actual knockout/safe spawning, storage migration and
blocked storage, unlocked/skipped lessons, first-visit behavior, keyboard focus,
late-connection exit and real room expiry. Ten profile/test-hook skips are
intentional; the quiet-HUD hook-only cases are not run against production mode.

Rendered desktop, 320px portrait, ordinary phone, landscape and tablet states
were inspected. The aiming rival is explicitly checked below the real panel
edge, including landscape; its earlier position behind the desktop panel was
fixed. Defense scenarios are vertically centered in their private arena so
expanded injury help can leave both subjects clear without showing exterior.
Ready closes that reading detail before the chase starts, clearing the short
landscape play area and touch controls.
The compact loaded-shot badge moves beside its owner if it would be cut
off by a short viewport, leaving the eyes clear. Desktop Mouse On/Off is visible
in practice and responds to both clicking and Space, persists and matches the
live toolbar without firing or releasing the captive.

Focused reruns after the final presentation fixes pass for combat, defense and
expanded injury details across the five profiles. The final centered defense
run also repeats the complete 320px/reduced-motion sequence successfully. Ready
is checked with injury details open: it closes them before real injured escape,
and the ordinary healing result still completes the stage. Expanded-help checks
verify 44px controls, unobscured target geometry and reachable Ready/Skip/Exit.
The local production preview is `http://127.0.0.1:3178/`.

Chromium touch profiles use trusted multi-touch events. WebKit uses pointer-event
holds with ordinary DOM taps. These are emulated browser profiles, not physical
Android/iOS devices. State is read to choose real movement/action inputs and
verify outcomes; no teleport, gem-setting or completion hooks are used. Separate
private-room network checks confirm those hooks cannot be called.

#### Design review and remaining limits

Conservative internal heuristics, not user-study measurements:

| Dimension | Review | Evidence / next check |
| --- | --- | --- |
| Usability | 8/10 | Actions and real success gates pass. Observe uncoached newcomers, especially aiming before the ordinary captive deadline; if reading causes repeated timeouts, evaluate a read-before-capture setup rather than changing live hold rules. |
| Hierarchy | 9/10 | One active instruction and one outlined target; optional detail is disclosed separately. |
| Accessibility | 8/10 | Keyboard activation/focus, 44px actions and reduced motion checked. Screen-reader navigation and enlarged-text use still need a dedicated review; full nonvisual gameplay is not certified. |
| Consistency | 9/10 | Shared controls/preferences, physics and server outcomes; no bot-only capability changes. |
| Responsiveness | 9/10 | Actual rendered phone, landscape, tablet and desktop review, including panel occlusion and narrow-screen controls. |
| Feedback | 9/10 | Readable failure reasons, clearer repeat hints, genuine injury/healing, shatter and spatial gem rewards. |
| Performance | 8/10 | No browser errors in completion runs; profile frame/input timing on physical phones, including Android Firefox, before making device-performance claims. |

Priorities are uncoached touch observation, enlarged-text/screen-reader review,
then physical-device performance measurement. Automated completion does not
prove learnability, human escape fairness or ideal balance. This batch has not
been merged or deployed.

### Commands

```powershell
npm run type-check
node scripts/gen-synced-types.mjs --check
npm run lint
npm run test:unit
npm run test:multiplayer
npm run build
```

In a separate terminal, start an isolated production preview:

```powershell
$env:NODE_ENV='production'; $env:PORT='3004'; node server/dist/index.js
```

```powershell
node scripts/practice-network.mjs
$env:PRACTICE_E2E='1'; $env:E2E_URL='http://127.0.0.1:3004'
npx playwright test tests/e2e/five-lessons.spec.mjs tests/e2e/tutorial-remodel.spec.mjs tests/e2e/practice.spec.mjs tests/e2e/mobile-tutorial-regressions.spec.mjs
```

The network script defaults to `ws://127.0.0.1:3004`; `PRACTICE_URL` overrides it. The mechanics and storage unit tests run in `test:unit`. Browser tests explicitly exercise local production rooms without test hooks. The trusted multi-touch sequence applies to Chromium touch profiles; other profiles exercise actual keyboard and placement inputs plus touch-shaped layout. Playwright emulation does not certify physical-device feel or full nonvisual accessibility. CI's disabled browser matrix remains unchanged; browser evidence must be run explicitly.

Release verification includes the complete unit suite, 18 real multiplayer scenarios, the isolated production tutorial-network script and explicitly run local browser checks. The standard-bullet verification covers the affected grow/capture/hit/finish lesson, black-hole reward and full trusted-touch sequence. [STANDARD_BULLETS.md](STANDARD_BULLETS.md) records that pass and the limits of browser emulation. The final pre-release full tutorial matrix is recorded with the release evidence.

### October 30 local follow-up verification

Production builds, client/server types, generated schema verification and the full unit suite (33 server suites plus progress checks) pass; the updated capture/checkpoint/portrait-arena tests also pass after the scenario adjustment. All 18 multiplayer scenarios and the production private-room isolation/reconnect script pass. Lint reports zero errors and 186 existing warnings.

Final focused browser runs pass 26 cases: eight menu/sound cases across desktop Chromium, Android-shaped Chromium, iPhone WebKit and iPad WebKit; nine capture/long-shot/retry cases including the complete trusted multi-touch tutorial sequence; and nine small-phone (320×812), landscape and reduced-motion cases. Three full-touch profile skips are intentional. Checks exercise real captures and shots, once-only rewards, retained capture checkpoints, reachable controls, sound persistence/synchronization and prevention of accidental inhale during keyboard activation. Menu tests wait for the drawer transition; live-return assertions permit legitimate field pickups after a clean spawn.

Desktop, phone and tablet arena/menu renderings and the gem-return effect were inspected. Keyboard focus trapping, Escape dismissal and absence of page errors also passed in fresh browser contexts. These are automated browser profiles, not physical-device or human-fun validation. Normal live camera rules are unchanged. Transient gain/name overlap remains a separate low-priority polish item. The reviewed local preview is `http://127.0.0.1:3007/`. The user authorized release after this review; use the GitHub PR and production workflow for the published revision.

## October 30 live mobile review

Reviewed the hosted release `9ebec923d415b79c90503845d96f4315def0ce75`, client `main-D3joYISn.js`, using ordinary private tutorial rooms. Completed the full four-lesson sequence in 412×839 Android-shaped Chromium, 320×812 Chromium, 844×390 landscape Chromium and 390×664 iPhone WebKit profiles. Chromium used trusted multi-touch through CDP; WebKit holds used pointer-event emulation, with normal DOM taps. These are browser profiles, not physical devices. No gameplay test hooks or client-reported completion were used; live game state was read to confirm the effects of actual inputs.

All four profiles completed all lessons. Separate replays verified two missed shots, two premature defensive puffs, clearer hints, successful retry and a clean return to live play. To test retries independently of the aiming issue below, the iPhone replay deliberately aimed its misses with the movement stick. No page errors were recorded. Initial harness runs that released before the hold threshold or moved and lifted within one frame were discarded as evidence of game failures. Completion times are automation timings, not human learnability measurements.

### Fix first

1. **Touch aim does not survive lifting.** In a stationary, loaded black-hole attempt, dragging up and holding 700ms aimed the server creature to −86.7° in Chromium and −86.6° in WebKit. After lifting and waiting 700ms, Chromium was facing 0° again and WebKit was at −7.8°, still turning back toward the previous walking direction. The subsequent tap completed the rightward black-hole shot despite the chosen upward aim. The client drops `controls.aimVector()` on release and falls back to the unchanged walking-facing vector in `moveLocalPlayer`. This directly contradicts the hint to aim, lift and tap. Retain the chosen shot direction between lift and fire while preserving deliberate new aim, movement/input semantics and reset handling. Evidence: `.tmp/mobile-tutorial-audit/{android,iphone}-aim-repro/report.json`, plus paired held/lifted screenshots and videos.
2. **The injured finishing target disappears offscreen on narrow portrait.** With a 320px viewport, the first hit left the live, injured rival at approximately world x=974 while the learner remained at x=560. Its screen center was x≈371: entirely beyond the right edge. It stayed there after another 1.5 seconds without input, while the ordinary injury timer continued. The 412px profile also put the rival's center past its right edge (x≈424). The black-hole lesson's framing correctly shows both ends, but the player-objective framing in the first lesson remains centered symmetrically on the learner and reaches the map zoom limit. Pan/fit both creatures together within the map when needed. Evidence: `.tmp/mobile-tutorial-audit/narrow-goal-repro/finish-still-offscreen.png` and `report.json`.

### Teaching and feedback improvements

- **Show how to aim before the first shot.** Initial mobile copy says to aim but does not explain the right-thumb drag. The useful drag/lift/tap explanation appears only after two misses, and staged straight-ahead targets allow the entire successful sequence to pass without learning that gesture. Fix aim retention first, then teach and require a deliberate aim adjustment.
- **Separate theft and the mouth finish.** The first lesson's final instruction combines aiming, holding, injury/theft, growing and approaching. Use distinct short guidance for stealing and then moving in to finish. Preserve shared combat rules and successful earlier steps.
- **Make failure recovery explain itself.** The reset state lasts about 100ms and its copy says only that the attempt is being restored. Preserve a concise reason on the restored attempt, such as an early puff, a missed shot or an injury that healed. Keep retries immediate.
- **Give the first defensive attempt reading time.** Its attack begins 1.4 seconds after setup, while the learner is reading the new instructions; the label still says INHALE, with PUFF as secondary copy. Add a clear first-attempt readiness moment or a more readable cue, while keeping later retries quick. The actual defensive puff works.
- **Separate seeded growth from earned feedback.** Scenario setup can produce a +318 gain flash even though 250 gems were staged and only 68 came from capture; the final 32-gem black-hole reward is accounted correctly. Suppress setup/reset gains and emphasize real +68 capture and +32 elimination feedback. The narrow shot view can also clip the left edge of the temporary captive badge.
- **Keep the lesson panel concise.** The finishing instruction occupies about a quarter of the 320×812 screen before extra hints; the failed iPhone diagnostic state showed a third of its viewport occupied once a hint was added. About injury has a 32px hit area; enlarge it to the user's 44px touch target preference. Other reviewed actions meet the 44px target, and no horizontal overflow was observed.

The weapon lesson's part collection, automatic assembly, Place action and visible automatic attack work. The longer black-hole lesson now includes capture and visibly returns its reward. Automatic lesson transitions, unlocked selection, sound and skip/exit actions work; retain these while correcting the issues above.

Internal review heuristics, not measured quality scores: usability 6/10 (aim and missing target), hierarchy 7/10 (compound instructions), accessibility 8/10 (small injury disclosure target), consistency 6/10 (instructions disagree with aim retention), responsiveness 7/10 (portrait objective framing), feedback 7/10 (reset reasons and seeded gain flashes). The prioritized recommendations above address each sub-9 finding. Physical-device performance is unrated because it was not profiled; real-phone input feel, safe-area/browser chrome behavior and performance remain follow-ups. This review changes documentation only; none of these proposed fixes has been implemented or deployed.

## Local aim and camera fixes after mobile review

The user subsequently requested the two functional fixes and another mobile pass. On `codex/fix-mobile-tutorial-aim`, a loaded touch shot now retains its chosen direction between a right-thumb drag and the subsequent fire tap, including while walking and during usable post-impact knockback. A new right-thumb aim replaces it. A different captive, knockout or scenario reset clears the saved aim; cancelling controls clears it without snapping the fallback facing back to an older walking direction. Keyboard/mouse and movement-only aiming retain their existing behavior before an explicit touch-shot aim is chosen.

The first lesson's finishing step now uses the same two-subject framing as the long black-hole shot. It fits the learner and injured target within the view and retains arena-boundary constraints. On the 320px profile, the injured target's observed center moves from about x=371 (outside) to x=285 (inside). Other live camera rules and shared combat mechanics are unchanged.

The complete four-lesson sequence, two deliberately missed shots, two early defensive puffs, successful retries and return to live play were replayed against the local production build in Android-shaped Chromium, 320×812 Chromium, 844×390 landscape Chromium and iPhone WebKit profiles. Every sequence and replay completed with zero page errors. Chromium used trusted multi-touch; WebKit used pointer-event holds and normal taps. Evidence is in `.tmp/mobile-fix-playthrough/`. These are automated profiles, not physical-device tests. The reviewed local preview is `http://127.0.0.1:3008/`. The user subsequently approved committing, merging and deploying the patch; GitHub’s PR and production workflow record the release revision.

Twelve targeted regression cases pass across those four profiles: aim remains upward after lifting for 700ms and walking right, firing uses that retained direction, another aim gesture replaces it, a failed shot restores a fresh captive without stale aim, and both the learner and injured target remain fully visible through six samples over 1.5 seconds with zero map exterior. The camera-only case reaches the injury through supported keyboard inputs to isolate framing; the separate complete playthroughs exercise touch movement/capture/fire throughout. Two desktop keyboard lesson smoke cases also pass. Production build and client/server type checks pass; lint has zero errors and the same 186 existing warnings. Test setup waits for the rendered scenario/input reset, avoiding gestures sent into an unfinished transition. The review scores and unimplemented teaching/feedback items above describe the live baseline; only the two requested functional issues are addressed in this local patch.

## Menu spacing and scoreboard follow-up

While the aim/camera release was deploying, the user clarified that the unused space to the right of Sound on looked out of place. Settings now uses a compact row: its label on the left, controls aligned on the right, with wrapping when needed. The sound action keeps its 44px target, saved state and existing behavior; keyboard focus remains visible. Tutorials remain the first action. The user also requested removal of their own creature icon from the scoreboard. The local row now uses the same text alignment as other rows and retains its highlighted name, rank/crown and score.

This follow-up on `codex/compact-settings-row` starts from the merged aim/camera release `ede6558`. Desktop, phone, 320px portrait, landscape and tablet arena/menu renderings were inspected; focus trapping, Escape dismissal and zero page errors passed. Eight menu/sound browser checks, type checks and the client build pass. The user asked to continue the ongoing commit/merge/deploy task; the GitHub PR and production workflow identify the final revision. Other tutorial teaching/feedback proposals remain pending.
