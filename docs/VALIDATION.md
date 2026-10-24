# Cannonball fun pass validation

Local validation on October 24, 2026:

- Production client and server builds pass.
- Client/server TypeScript checks pass.
- Generated synchronized types match; the checker accepts Windows CRLF.
- ESLint has no errors; existing warning debt remains.
- Physics, airflow, camera and gameplay unit checks pass, including capture/escape, queued firing, defensive puffs, protection, jackpot lifecycle and crowd dispersal.
- All 12 isolated network scenarios pass. Each scenario creates a fresh room. Coverage includes an actual gust stun and an attempted immediate reuse of a landed cannonball. Optional experimental hazards remain covered by activation checks and their physics tests.
- All six desktop/Pixel 7 Chromium browser checks pass: real WASD and arrow escapes, touch flick escapes, focus cancellation, exact centering at edges and during hit feedback, button/Enter name saving, labeled controls, mute persistence, and keyboard movement/inhale suppression during a stun.
- Visual review of the capture badge confirms that both eyes remain visible. Local screenshots and browser inspection reported no JavaScript or console errors.
- Puffed cheeks were reviewed at three sizes and four facing directions. Actual peer gust and flight/landing screenshots confirm spiral eyes, orbiting sparks and the mint suction-recovery ring. Deterministic regressions cover the 800ms stun deadline, repeated-stun immunity, and three seconds without incoming suction or recapture after player impact, arena-edge impact and flight timeout.

Lighthouse 12.8.2 against the local built game:

| Mode | Performance | Accessibility | Best practices | SEO | CLS | FCP | LCP | TBT |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Desktop | 100 | 100 | 100 | 100 | 0 | 0.3s | 0.4s | 0ms |
| Mobile | 99 | 100 | 100 | 100 | 0 | 1.4s | 1.9s | 0ms |

These are local laboratory results, not a new PageSpeed measurement of the deployed site. The earlier live report supplied by the user was desktop Performance 82 with CLS 0.356. Hosting, device and network conditions affect production results.

In 100 real simulation trials per captor size (300 total), no bot escaped before the gun loaded. When they escaped before the 4.5-second safety timeout, mean escape times were about 2.8s for three inputs, 3.0s for four, and 3.5s for five. This measures bot timing, not human difficulty.

A 90-second crowd simulation with 19 bots reported mean nearest-neighbor distance 392 units, mean worst clump within 300 units of 2.0 other bots, and a maximum clump of four. Random simulations are tuning evidence rather than deterministic guarantees. The deterministic crowd regression separately verifies that a deliberately packed group disengages and disperses.

Later human-playtest feedback increased loading to 1.8–2.4 seconds. A FIRE press during loading queues a shot; focus loss cancels it. A regression now checks a captive reacting 250ms after the daze and typing a direction every 250ms before a queued shot can fire.

The Pinwheel Cannon prototype implements three physical parts, an 18-second builder claim, persistent cargo, explicit placement, gust disruption, spin-up and eight seconds of rotating gem bolts. Dedicated unit checks cover claim expiry, non-renewal from holding the same part, disconnect cleanup, final-piece ownership, carrying/placement, firing, friendly-fire exclusion, bounded damage and projectile expiry. All ten desktop/phone browser checks pass, including persistent cargo after releasing/turning, mobile tapping and desktop E placement, ignoring E in a name field, landscape layout, and the visible gust breath cost. The earlier Lighthouse measurements above predate this prototype and are not remeasurements of its larger bundle.

Combat follow-up: production client/server builds, type checks, generated schema check, unit/gameplay/weapon regressions, all 12 isolated network scenarios and lint passed. Lint reports zero errors and 168 existing warnings. Tests cover 35% fixed breath cost/insufficient-breath refusal, forceful collision stagger with contact rearming, no normal Core spawning, giant target shrink, small target knockout/respawn, missile-player width loss and no second charge on a wall bounce, and retained landing protection. Test fixture rooms are private so ordinary matchmaking cannot contaminate them.

Core removal follow-up deletes the renderer, interpolation cache, physics module, server simulation/creation hooks, tuning constants and obsolete Core-only tests. The existing stun-immunity duration moves into the shared PUSH settings without changing behavior. The retired network array remains empty to preserve field numbering for already-connected clients, and every server tick clears any leftover entries. A regression injects an old Core object and verifies that it is purged on the next tick.

A 30-second real-world simulation with 19 bots reported mean nearest-neighbor distance 459 units, mean worst clump within 300 units of 1.6 others, and a maximum clump of three others. This is one random sample, not a controlled comparison or guarantee about play sessions.

Capture/impact playtest follow-up: player-fired missiles ignore captive input at launch and throughout flight. Regressions cover three launch angles with alternating input, accurate hits while holding sideways, retained turbine steering and normal movement after landing. Loading is 2.8/3.1/3.4 seconds; human escape checks use 650ms reading time after the daze and 500ms between directions, against an immediately queued shot. Desktop WASD/arrows and phone stick checks pass with that slower timing.

Spent missile impacts knock out a flier with zero retained growth. Wall cases at 0/297/298/1,000 starting gems, protected respawn, surviving landing shields, turbine survival, and targets below 12 retained gems are covered. Background field count is 950 (about 25% less); sprays remain unchanged. Weapon checks cover touch pickup, distance inhaling, claims blocking touch theft, expiry, persistent cargo and placement. Build, types, schema check, unit checks, 12 isolated multiplayer scenarios and 12 desktop/Android browser cases passed. Lint: zero errors, 167 existing warnings. An old browser fixture needed to hold Space until inhale started: immediate touch pickup had shortened its press into a gust. The corrected fixture passed with retries disabled. These checks verify behavior, not whether the new balance feels ideal to every player.

Shockwave Drum: production client/server builds, type checks, generated schema check, current unit/gameplay/weapon checks, all 12 isolated network scenarios and all 14 desktop/Android browser cases passed. After refining wave-center/final-segment handling and suppressing duplicate phone labels, unit checks and the two Drum browser cases passed again. Lint: zero errors, 165 existing warnings. Drum regressions cover assembly/carry/place ownership, windup, one hit per wave, four-pulse lifetime, center and final-edge hits, crossing between ticks, meaningful giant shove, no gem loss/stun, owner/protection/capture/flight exclusions, Pinwheel rotation and disconnect cleanup. Browser checks collect actual parts, move the assembly, place with E or touch, and observe a real peer pushed by a pulse without stun. Portrait/landscape screenshots were inspected for readable compact progress and clear controls. No new Lighthouse measurement is claimed.

Pulsar/mobile-edge follow-up supersedes the Drum theme and non-damaging behavior. Build, type, schema, unit, and all 12 multiplayer checks passed. The browser run passed 15 desktop/Android cases, with the phone-only rotation/knockout case skipped on desktop. Coverage includes actual 100-to-75 gem damage, strong displacement, hit attribution/banner, low-mass knockout/respawn and exact spilled-gem conservation. Wave exclusions, once-per-wave damage and Pinwheel collection/placement remain covered. Camera checks cover all four corners, desktop centering, compact extreme zoom, and a bottom-edge knockout in portrait/landscape and after respawn. Screenshots show the angular Pulsar, plasma fronts and the map filling the entire phone play area. Lint: zero errors, 165 existing warnings. These tests do not constitute a fresh production Lighthouse measurement.

Quiet HUD follow-up removes the weapon overlay function, its layout helper, minimap waiting countdown and duplicate completed-weapon labels. Brief local pickup notices expire after 3.5 seconds and coalesce instead of stacking; starter tips auto-close after four seconds, including after explicit replay. Client build, type checks and lint passed (zero errors, 165 existing warnings). The browser run passed 17 desktop/Android cases with one desktop skip for the phone-only test. After coalescing, the two Pulsar placement/hit cases passed again and assert one weapon notice. Tests also check pickup-notice expiry and starter-tip replay/expiry. Clean desktop/phone screenshots were inspected. No gameplay tuning changed; background gems remain 950 plus combat spills. Server regressions remain part of required CI.
