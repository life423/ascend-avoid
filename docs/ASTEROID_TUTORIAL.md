# Asteroid practice and live guidance

November 21, 2026. The user reports that becoming large enough still does not
teach asteroid launching. The old brief “Relic unlocked” badge omits how to claim
and deliver the relic. A tip shown only after delivery misses that discovery gap.

## Latest user correction — November 22: haul before launch

The user now explicitly requires the player to **drag the relic across the map**
in the private tutorial. This supersedes the earlier request to practice launching
with an already charged asteroid. The player still starts large enough; gathering
enough gems is not a prerequisite.

The sixth selectable lesson is **Launch an asteroid**, also the final step of
the full sequence. Its private 4200 × 4200 arena starts with 33,000 gems, physical
width above `RELIC.MIN_WIDTH`, and an uncharged asteroid. The stages are **hook →
tow → strike**. Walk into the gold relic, then drag it across the arena and walk
past the cyan relay until the trailing cargo enters the ring. Only actual shared
delivery earns the charge. **Aim asteroid** then opens the ordinary launch map
with a gold **TARGET** label. Mouse, keyboard and touch use the ordinary
`fireRelicComet` message and shared strike/damage physics. Actual strike damage to
the designated rival completes the lesson. A missed strike restores the earned
launch checkpoint rather than repeating the haul. Switching lessons clears the
relic/charge/strike; exiting returns to a fresh live session as other lessons do.

Existing lesson achievements survive. A previous launch-only asteroid completion
is retained as a historical achievement and marked updated for the new haul skill.
The separate Game Menu/How to Play replay button is removed. The automatic
size-threshold live cues remain, independently of private practice completion.
Practice setup is not evidence of naturally earned growth in the live arena.

The haul is 1,700 map units, with verified walk-past clearance for the largest
body. Carrier and cargo framing takes priority over showing a distant relay;
the existing cyan cargo arrow points toward it. Instructions and touch actions
reuse free screen space and stay put while clear of eyes, cargo and controls.
Ready freezes only this private lesson's physics and preserves real deadlines.

November 22 local validation passes: full production build/package verification,
both TypeScript checks, synced schema, full unit suite and lint with zero errors.
All 15 targeted browser cases pass across desktop Chromium, Android Chrome
emulation, iPhone WebKit portrait/landscape and iPad WebKit. Final framing
rechecks pass on those five profiles, including rendered body/cargo and eye/UI
clearance. The full six-lesson sequence passes on desktop and Android emulation;
the 320px reduced-motion phone sequence passes again after the framing fix.
Logs/results: `.tmp/haul-release-*`, `.tmp/haul-framing-*`, `.tmp/haul-sequence-*`
and `.tmp/haul-narrow-*`. The current pull request and production workflow record
final required checks and rollout; hosted verification is separate from these
local results. Physical-device, assistive-technology and on-device performance
checks remain follow-up work.

## Historical November 21 launch-only validation

Production client/server builds and package verification,
both TypeScript checks, synced-schema check, practice scenario units (including
prepared-size preservation and actual miss recovery), and progress migration
units pass. The expanded five-profile matrix plus final corrective rechecks pass
all **137 applicable browser scenarios**; eight device-inapplicable cases are
skipped. The 15 final rechecks overlap that total. Profiles: desktop Chrome,
Android Chrome emulation, iPhone WebKit portrait/landscape and iPad WebKit.
All six lessons individually and the full sequence complete; the 320px Android
sequence also passes with reduced motion. New lesson checks prove the prepared
giant/charge, successful impact, missed-strike reset, keyboard aiming, and cancel
focus. Picker, prepared giant and aiming-map screenshots were inspected.

Review corrected an iPhone cancel-focus issue by preserving the actual opening
button, an old shatter-retry assertion by checking the real target angle, and
fractional enlarged-text focus clipping with an inset scroll clearance. Logs:
`.tmp/asteroid-practice-regression.log` and `.tmp/asteroid-practice-rechecks.log`.
The current PR description/checks record required CI and production rollout.
This correction follows the user's authorization to commit, merge and deploy.

Internal design-review heuristics for the private lesson: usability 9/10,
hierarchy 9/10, consistency 9/10, responsiveness 9/10, feedback 9/10,
accessibility 8/10 and performance 8/10. Follow-ups: verify an attached keyboard
and assistive technology on an actual phone, and measure on-device input/frame
costs. Automated browser completion is not uncoached human learnability evidence.

The separate requested live automatic-unlock test passed November 21 through
normal inputs and actual combat. Player `0q1A77tFK` in production room `jpPHoB-zA`
reached width 1158 with 29,661 gems; an independent spectator confirmed that size
while the automatic first cue was visibly rendered. Practice was disabled and
manual tutorial requests were zero. Evidence: local
`D:/CodexTemp/ascend-avoid-live-unlock/public-result.json` and `public-success.png`.
Private practice setup and guarded threshold fixtures do not count as that result.

## Automatic live guidance

The live arena now teaches three steps from authoritative player/relic state:

1. At the actual `RELIC.MIN_WIDTH` physical-size threshold, explain the gold
   relic/radar marker and automatic pickup by walking into it. If no relic has
   appeared, or a rival has it, explain that state instead.
2. After real pickup, explain the cyan relay, walking past it so trailing cargo
   enters the ring, and the existing 60-second tow budget.
3. After actual delivery, explain the asteroid strike and opponent warning. The
   existing **Aim relic comet** action appears inside this cue and opens the same
   normal aiming map. When the cue expires/dismisses, the ordinary contextual
   launcher returns. Aim/fire controls and server authorization are unchanged.

Each cue closes after 12 seconds of visible reading time. Hidden tabs, menus,
injury, capture, flight, active inhaling/held ammunition and inbound-comet warnings
defer coaching. Keyboard focus and scrolling allow more reading time. **Dismiss**
stops the tutorial, with per-device saved progress; blocked storage falls back to
the current session. These cues coach the current live run; the separate sixth
private practice lesson provides repeatable launch practice. The automatic cues
do not certify private skill mastery.

The rendered panel avoids full joystick/aim footprints, score/leaderboard space,
radar, visible placement/launch actions, desktop chrome and the local creature's
eyes. It stays put while those clearances hold. Short landscape uses a shallow
layout; enlarged text can scroll in a fitting free area with keyboard-reachable
actions. A viewport with no usable free area defers the cue rather than obscuring
play. There is no automatic dialog, focus steal, world pause or balance change.
The existing compact unlock badge remains for repeat runs without duplicate
coaching. Help's existing instructions are not lengthened.

## Historical live-guide validation and limitations

The full production build/package verification, final client rebuild and both
TypeScript checks pass. Targeted lint reports zero errors and 23 existing
GameModes warnings; diff whitespace checks pass. The five-profile sweep passes
all **30 browser cases** (desktop Chrome, Android Chrome emulation, iPhone WebKit
portrait/landscape and iPad WebKit). After the final scroll-focus/keyboard and
disconnect cleanup, all **five enlarged-text rechecks** pass; they overlap the
same 30 scenarios. Screenshots were inspected in all five profiles and with
enlarged text. Logs: `.tmp/asteroid-tutorial-browser.log` and
`.tmp/asteroid-tutorial-final-accessibility.log`. Preview:
<http://127.0.0.1:3197/>. No fresh physical-device, Firefox, screen-reader or
uncoached-human result is claimed.

Browser checks
use the production client build and an isolated local server with guarded setup
hooks. Growth/position setup uses those hooks; towing, tutorial advancement,
aiming and firing use the ordinary shared rules and actual keyboard/touch inputs.

Review found and corrected short-iPhone launch clearance, score overlap,
landscape face occlusion, and a test assertion that incorrectly disallowed normal
passive upkeep during replay. Automatic storage writes and live-region text
updates occur on changes, not on every render frame.

Internal design-review heuristics, not measured quality: usability 8/10,
hierarchy 9/10, accessibility 8/10, consistency 9/10, responsiveness 9/10,
feedback 9/10, performance 8/10. Prioritized follow-up: observe an uncoached
newcomer finding/delivering a relic; check an actual Pixel and screen reader,
including the scroll fallback; measure on-device input/frame costs during
coaching. Browser emulation and successful automated completion do not establish
human learnability, physical-device feel or Core Web Vitals.

The user approved committing, merging to main and deploying this change on
November 21. The pull request and production workflow record the merged revision
and rollout result; physical-device and newcomer checks remain follow-up work.
