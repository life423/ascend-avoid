# Device and browser validation — November 4, 2026

This report separates a working device connection, automated browser checks and
actual phone gameplay. A phone-shaped desktop viewport does not reproduce Android
Firefox graphics, input latency, heat or battery behavior.

## Physical device connection

The user's intended Pixel 10 Pro XL connected to this Mac over Android wireless
debugging after the user paired it. Read-only inventory confirmed Android 17
(API 37), a 1344 × 2992 physical display, Chrome 156.0.8078.79 and Firefox
159.0.1. Android SDK Platform-Tools 37.0.1 was installed on the Mac through the
official Homebrew cask. No phone app was installed and no phone setting was changed
by this work. Device identifiers and pairing credentials are omitted.

The Chrome DevTools socket was present. Its first metadata request timed out while
the phone was dozing with the lock screen showing. Firefox was running but did not
expose its remote-debugging socket. Connection verification alone establishes
neither successful gameplay nor a fix for the historical Android Firefox lag.

Mozilla requires the phone user to enable Firefox's **Remote Debugging via USB**
setting for its supported remote-debugging path, including when ADB itself uses
Wi-Fi. This was not enabled by the assistant. Playwright's experimental Android
API supports Chrome/WebView and may install an automation driver; it is not being
used to install anything on this phone. Direct Chrome DevTools attachment can
reuse the existing browser without such an install.

Sources: [Android wireless ADB](https://developer.android.com/tools/adb#connect-to-a-device-over-wi-fi),
[Mozilla Android debugging](https://firefox-source-docs.mozilla.org/devtools-user/about_colon_debugging/#connecting-to-android-over-wi-fi),
[Chrome remote debugging](https://developer.chrome.com/docs/devtools/remote-debugging),
[Playwright Android API](https://playwright.dev/docs/api/class-android).

## Browser regression scope

The relevant existing suites cover mobile action-label alignment, menu/canvas
focus, drawer scrolling, weapon placement while moving, unobtrusive activity
messages and bounded starfield rendering work. They run against the local
candidate using Chromium Android emulation, WebKit iPhone emulation and Gecko
phone/landscape viewports. Desktop Firefox execution is separate from Android
Firefox execution.

The starfield check measures background drawing calls, cache allocation and
microbenchmark timing. It does not measure whole-game frame rate or physical
Android GPU/input performance. The compact dock test's obsolete rectangle probe
has been updated by the HUD work to recognize the single traced arena outline.

The completed local production build was served at `http://127.0.0.1:3002` with
`NODE_ENV=test`. All **32 functional cases passed in 59.5 seconds**, with no
retries or skips: eight cases each on Android Chromium emulation, iPhone WebKit
emulation, Firefox phone viewport and Firefox landscape viewport. They cover the
action-label block, Help/Space focus restoration, dock alignment, drawer scrolling,
placement while moving, activity-history routing, reserved-part marks and healthy
carrier part theft. These are desktop-engine results, including actual Gecko
execution, rather than physical Android results.

Reproduce with the already running local test server:

```sh
E2E_URL=http://127.0.0.1:3002 E2E_TEST_HOOKS=1 npx playwright test \
  tests/e2e/mobile-fixes.spec.mjs tests/e2e/mobile-button.spec.mjs \
  --project='Android phone (Chrome)' --project='iPhone (Safari)' \
  --project='Firefox phone viewport' --project='Firefox landscape viewport' \
  --output=.tmp/device-e2e-results --workers=2
```

The test server is intentionally separate from the user's preview on port 3001.
The local results and screenshots are ignored artifacts; they contain no device
pairing credentials. The structural starfield check is reported separately below.

The starfield suite also passed all **four profiles in 13.4 seconds**, sequentially
after the other browser suites completed. Each had zero per-frame blur, gradient
creation and canvas allocation; one reused atlas; and preserved opacity. Drawing
work stayed below the 400-call limit: 172 draws/frame in Chromium Android
emulation, 129 in iPhone WebKit and 188 in each Gecko viewport. Raw timing samples
are in `.tmp/device-performance-results/*/background-render.json`; their coarse
timer resolution and background-only workload do not justify an Android FPS or
cross-engine speed claim.

## Physical Chrome result

The user subsequently kept the phone awake and authorized **Chrome only**. The
candidate was opened in a dedicated local Chrome tab through a temporary ADB
reverse route to port 3002. Direct CDP attachment reused the installed browser;
it installed no driver or APK and changed no device setting. The initial sleeping
socket responded after the ordinary browser launch. Only the test tab was
inspected and closed afterward.

The real portrait viewport was 448 × 874 CSS pixels at DPR 3 with touch controls
enabled. A visible 20-player local match produced this **15-second sample**:

| Measurement | Observed |
| --- | ---: |
| Animation callbacks | approximately 60 Hz |
| Callback gap, 95th percentile / maximum | 16.8 ms / 17.5 ms |
| Callback gaps above 50 ms | 0 |
| Full-game update/render CPU, mean / 95th percentile | 3.91 ms / 4.9 ms |
| Full-game update/render CPU, maximum | 7.3 ms |
| Page exceptions / failed network requests | 0 / 0 |

This records callback scheduling and main-thread game work, not GPU completion or
end-to-end finger latency. The local player was alive and also respawned during
the ordinary match sample. It is neither a long-session stress test nor a verdict
on combat balance.

A separate short control check used the existing local test protection and
position hooks, avoiding a respawn being mistaken for joystick motion. Native
touch events dispatched through CDP moved the alive player approximately 112
world units in half a second. Holding the action while moving produced
authoritative `inhaling=true`; release returned it to false. A tap produced the
player's visible defensive puff and updated server puff readiness. A touch opened
the menu and an actual touch swipe advanced its scroll position 256 CSS pixels;
the drawer had 2044 pixels of content in an approximately 875-pixel viewport.
The control check also recorded zero page exceptions and failed requests.

Ignored evidence is in `.tmp/phone-chrome-results/`: `results.json`, the separately
saved `frame-sample.json`, `portrait-arena.png` and `drawer.png`. A local diagnostic
selector error and a background-tab retry were corrected before these results;
neither is being reported as a game failure. The diagnostic's test tabs were
closed. These short portrait checks do not cover landscape, rotation, installed
wrappers, all lessons, sound, keyboard, resume, battery or extended play.

For ongoing phone playtesting, the temporary reverse route now points to the
user's normal local preview: open **`http://localhost:3001/` in phone Chrome**.
This requires the Mac's port-3001 preview server and the paired ADB Wi-Fi
connection to remain available; it is not a public website or deployment. The
diagnostic's Chrome debug forwards and port-3002 reverse route were removed.
Pairing was preserved and no extra browser tab was opened for this handoff.

**At the November 4 checkpoint, physical Android Firefox was deferred for Chrome-only testing.**
The old severe-lag report is still open; successful Chrome and desktop Gecko
checks do not establish that it is fixed.

## Physical gameplay still to verify

Use the same local candidate and comparable scene in each phone browser. Keep the
phone awake and record orientation, elapsed session and scene load. Check movement
and aim together, puff/fire, capture/flight/respawn, weapon placement while moving,
drawer finger scrolling, name keyboard/focus, sound, lesson controls and
background/resume/reconnect. Inspect black-hole warnings and icons at both zoom
levels and across bright overlapping effects.

For Firefox, remote debugging must be enabled by the phone user before collecting
a page profile. Otherwise report manual observations separately; Android app
frame/memory counters alone cannot establish game-canvas frame rate or input
latency. Compare a short idle scene and a busy multi-effect scene with Chrome,
then a longer session for stalls, heat and battery. No lag fix or human balance
validation should be declared from device connection or desktop tests.

At that checkpoint, the Ubuntu browser matrix was deferred. The Mac Firefox
viewport runs did not measure Android performance.

## November 8 Firefox rendering release

Firefox remote debugging worked over Wi-Fi on the Pixel. The live site initially
recorded 8.6 animation callbacks per second and 75 gaps over 50 ms in ten
seconds. Chrome on the same phone recorded 60 callbacks per second and no such
gaps. Each arena had 20 players.

The local fix reduces unnecessary Canvas work and requests the software 2D path
only on Android Firefox. In 10-second local tests on the Pixel, the animated
20-player room went from 15.8 to 74.4 animation callbacks per second at ordinary
size and from 13.2 to 44.9 at maximum size. Both samples went from 116 gaps over
50 ms to zero. These are callbacks, not compositor frame measurements or an
end-to-end input latency test.

The fix shipped in [PR #89](https://github.com/life423/ascend-avoid/pull/89) at
`47941d2`. [Azure rollout](https://github.com/life423/ascend-avoid/actions/runs/42569652826)
completed on revision `ascend-avoid--0000129` with 100% traffic. The live health
endpoint reported production healthy, the live bundle matched the tested build
byte for byte, and Firefox smoke tests joined a room on the release. The short
performance numbers above are from a real Pixel on the matching local build.
Two 30-second foreground samples on the live release gave 71.4 and 70.0
animation callbacks per second, with no gaps over 50 ms. The first included
movement and inhale in a 20-player arena. Longer sessions, landscape and
another Android device still need measurement. Desktop Firefox and Android
emulator CI cover functionality only.
