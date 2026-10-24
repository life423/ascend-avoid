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

A 30-second real-world simulation with 19 bots reported mean nearest-neighbor distance 459 units, mean worst clump within 300 units of 1.6 others, and a maximum clump of three others. This is one random sample, not a controlled comparison or guarantee about play sessions.
