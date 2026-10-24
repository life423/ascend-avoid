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

The Pinwheel Cannon prototype implements three physical parts, an 18-second builder claim, gust disruption, spin-up and eight seconds of rotating gem bolts. Dedicated unit checks cover claim expiry, non-renewal from holding the same part, disconnect cleanup, final-piece ownership, assembly, firing, friendly-fire exclusion, bounded damage and projectile expiry. Desktop/phone browser checks assemble the real parts by holding Space and observe the weapon firing; the total browser matrix is now eight checks. The earlier Lighthouse measurements above predate this prototype and are not remeasurements of its larger bundle.
