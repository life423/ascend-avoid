# Optional practice tutorial

The October 29 tutorial request supersedes the earlier decision against adding a tutorial. Implementation starts from main `9be662dbe2c3763822b63cab9766b8365346da72` on `codex/practice-tutorial`. The user reviewed the local preview and authorized committing, merging to main and deploying this release batch. GitHub's pull request and production workflow identify the published revision.

## Experience

Normal play starts immediately. The first-visit offer has **Play tutorial** and **Not now**, expires after eight seconds and does not take focus. Play tutorial starts the complete sequence directly. Menu → **Practice / Tutorials** offers **Start full tutorial** and all four individually unlocked lessons. The full sequence automatically loads each next lesson after success. An old `ascend.guideSeen` flag suppresses the new automatic offer without completing any lessons. The previous four-second starter guide is removed.

Every lesson is unlocked. Actions must succeed to advance within the selected lesson. A failed attempt restores its target, captive, breath or assembled weapon as needed, retaining earlier passed steps. Two misses reveal a clearer contextual hint. Skip lesson leaves unfinished work unfinished; Exit tutorial and Play now create a clean live session. Completed lessons can be replayed.

- **Grow, capture & finish:** four nearby ten-gem pickups; capture a healthy 12-gem rival (no instant reward because it is smaller than the standard bullet); release and fire the standard 60-unit shot into a larger, approximately 89-unit stationary rival; steal from its real injury, grow, and finish at the mouth under the ordinary 1.3× size/contact rules. A forceful body bump can interrupt inhale under normal rules; contextual text explains releasing and holding again. Letting theft work before charging avoids this interruption.
- **Build a weapon:** exactly three Pulsar components, normal contact/inhale collection, automatic assembly, E or the existing touch Place weapon control, then actual automatic Pulsar damage against a staged rival. No invented assembly or firing button.
- **Black-hole shot:** first capture a healthy 100-gem rival using ordinary inhale. The actual captive carries into a shot toward a hole 520 units from the starting player center (formerly 260). Capture transfers 68 growth immediately, leaving 32 gems in the standard bullet. Release, aim and fire; a missed shot restores only this already-reached shot step. A successful core elimination credits the remaining 32 once. Larger, outlined gem diamonds visibly spiral into the hole and arc back to the shooter over 2.2 seconds; the scene stays intact for 2.4 seconds before completion. Reduced motion uses a stationary arrival ring. Arena geometry keeps the learner away from the rim; damage and immunity rules are unchanged.
- **Defensive burst:** an equal-sized, empty-mouth learner faces a stationary attacker; 1.4 seconds of warning, then ordinary suction. Only an actual parry of that attacker completes the step. A premature puff, lost connection or missed window restores the attempt.

Essential instructions are contextual; optional injury text explains breathing restrictions, unchanged movement, already-held firing after release, and the seven-second window with eligible continuous-theft extension. The instruction panel respects touch controls and safe areas and includes a sound toggle. The black-hole camera frames both ends of the shot; that private lesson uses a 1600×2000 arena so even narrow portrait views stay inside the map. Other lessons retain their 1600×1600 arena and existing framing. Normal live camera behavior is unchanged. Highlights are static, including with reduced motion.

October 30 follow-up, local preview on `codex/black-hole-tutorial`: **Practice / Tutorials** is the first action inside Game Menu, with settings directly below. Reopening the menu resets its scroll position so a long activity feed cannot hide these actions. Mobile sound stays in the drawer as requested; desktop also has a sound button alongside its controls. Sound preferences persist and remain synchronized across the menu, desktop toolbar and lesson controls. The mobile Menu action is labeled and separate from the minimap; the player count is removed entirely from the arena HUD after the user questioned its value. The leaderboard contracts to its actual rows. The user approved committing, merging and deploying this follow-up on October 30; GitHub’s pull request and production workflow record release completion.

## Server and connection boundaries

`TutorialRoom` reuses `GameRoom` inputs, simulation and events. It is explicitly created as `tutorial_room`, private, locked to one human and authenticated with a random 256-bit capability bound to the initial authorized session. It never joins public matchmaking. NPCs have normal creature state and mechanics but no roaming bot brains. Scenario configuration is internal, deterministic and independent of UI copy; arbitrary client world options and test commands are unavailable in tutorial rooms, including development.

`PracticeController` owns lesson/stage/attempt IDs, exact target identities, passed steps, success and reset transitions. Capture, part collection, assembly and placement have narrow server events. Completion is derived from real events, never a client assertion. Duplicate/stale events and skip attempts cannot advance unrelated work. New attempt restoration cancels held inputs; carrying a newly captured opponent into the shooting step preserves the ordinary release-before-fire requirement.

Transient reconnects retain the authorized private session (ten-second reconnection window). Late or timed-out connection results are immediately left. Expired reconnects may create only the currently selected private lesson, never a public fallback. Finished/choosing rooms close after one minute; an inactive lesson closes after ten minutes. A server-closed practice session requires an explicit lesson selection to restart, avoiding an automatic room-creation loop. Consented departure disposes the room. Unclaimed creation expires after 30 seconds.

Practice high-score, global activity and weapon-record updates are suppressed. Practice rewards remain real within the private arena; gems, size, cargo and weapons never migrate to live play. The browser build uses narrow Colyseus transport/storage boundaries: native browser WebSocket arguments, and optional auth-token storage with a memory fallback. Node/server clients use the unmodified installed package.

## Progress

`ascend.practice.v1` stores version 1, whether the offer was acknowledged, an overall status and per-lesson `not-started`, `in-progress`, `skipped` or `completed`. Only server-confirmed completion writes completed. Skipping never grants completion or erases an earlier verified completion. Storage errors retain in-memory progress for this page; persistence across reloads is unavailable when browser storage is blocked. No account, database or cross-device sync is added. Passed steps are checkpoints within the private room; reopening a lesson in a new session is a replay rather than account-level step restoration.

## Verification commands

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
npx playwright test tests/e2e/practice.spec.mjs
```

The network script defaults to `ws://127.0.0.1:3004`; `PRACTICE_URL` overrides it. The mechanics and storage unit tests run in `test:unit`. Browser tests explicitly exercise local production rooms without test hooks. The trusted multi-touch sequence applies to Chromium touch profiles; other profiles exercise actual keyboard and placement inputs plus touch-shaped layout. Playwright emulation does not certify physical-device feel or full nonvisual accessibility. CI's disabled browser matrix remains unchanged; browser evidence must be run explicitly.

Release verification includes the complete unit suite, 18 real multiplayer scenarios, the isolated production tutorial-network script and explicitly run local browser checks. The standard-bullet verification covers the affected grow/capture/hit/finish lesson, black-hole reward and full trusted-touch sequence. [STANDARD_BULLETS.md](STANDARD_BULLETS.md) records that pass and the limits of browser emulation. The final pre-release full tutorial matrix is recorded with the release evidence.

### October 30 local follow-up verification

Production builds, client/server types, generated schema verification and the full unit suite (33 server suites plus progress checks) pass; the updated capture/checkpoint/portrait-arena tests also pass after the scenario adjustment. All 18 multiplayer scenarios and the production private-room isolation/reconnect script pass. Lint reports zero errors and 186 existing warnings.

Final focused browser runs pass 26 cases: eight menu/sound cases across desktop Chromium, Android-shaped Chromium, iPhone WebKit and iPad WebKit; nine capture/long-shot/retry cases including the complete trusted multi-touch tutorial sequence; and nine small-phone (320×812), landscape and reduced-motion cases. Three full-touch profile skips are intentional. Checks exercise real captures and shots, once-only rewards, retained capture checkpoints, reachable controls, sound persistence/synchronization and prevention of accidental inhale during keyboard activation. Menu tests wait for the drawer transition; live-return assertions permit legitimate field pickups after a clean spawn.

Desktop, phone and tablet arena/menu renderings and the gem-return effect were inspected. Keyboard focus trapping, Escape dismissal and absence of page errors also passed in fresh browser contexts. These are automated browser profiles, not physical-device or human-fun validation. Normal live camera rules are unchanged. Transient gain/name overlap remains a separate low-priority polish item. The reviewed local preview is `http://127.0.0.1:3007/`. The user authorized release after this review; use the GitHub PR and production workflow for the published revision.
