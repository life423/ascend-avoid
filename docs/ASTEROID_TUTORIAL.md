# Contextual asteroid launch tutorial

November 21, 2026. The user reports that becoming large enough still does not
teach asteroid launching. The old brief “Relic unlocked” badge omits how to claim
and deliver the relic. A tip shown only after delivery misses that discovery gap.

## Implementation

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
the current session. **How to Play → Show asteroid tutorial** replays the current
step without leaving the room, changing player identity or resetting growth.
Replaying below the threshold explains growing first. This is contextual live
coaching, not an additional private practice lesson or proof of skill mastery.

The rendered panel avoids full joystick/aim footprints, score/leaderboard space,
radar, visible placement/launch actions, desktop chrome and the local creature's
eyes. It stays put while those clearances hold. Short landscape uses a shallow
layout; enlarged text can scroll in a fitting free area with keyboard-reachable
actions. A viewport with no usable free area defers the cue rather than obscuring
play. There is no automatic dialog, focus steal, world pause or balance change.
The existing compact unlock badge remains for repeat runs without duplicate
coaching. Help's existing instructions are not lengthened.

## Validation and limitations

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
