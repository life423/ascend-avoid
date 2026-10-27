# Contested weapon assembly — October 27, 2026

Developed on `fix/contested-weapon-assembly` from released main `3b3dddc`, and approved for release. Main, the associated pull request and production workflow identify the published revision and rollout status. Enabled in the normal localhost:3001 game. This addresses the mechanical portion of the selected contested-weapon playtest; actual human-match feel remains open.

## Findings and fixes

- **Near-mouth theft dead zone:** an equal-sized inhaler can pull the carrier close enough that cargo lies behind the mouth point but still touches the inhaler's physical body. The point cone then repeatedly cancels theft. Contact now uses the existing loose-part contact distance (body radius + part radius), still requiring held inhale and the existing maximum 240-unit mouth-to-cargo reach. Outside contact the original aim cone still applies. Touching alone cannot steal; shields and the one-unfinished-build rule still apply. Both fleeing actors can keep moving.
- **Interrupted progress:** a dropped, puffed-away, captured, dead or disconnected carrier previously left partial theft progress on the part. Those paths now reset it, as do aim/range loss, release, protection, invalid thief states and a different attacker. Each new uninterrupted attempt needs the full existing 650ms. Shot-follow consumes the inhale action, so it cannot also inhale loose parts or steal carried cargo; ordinary contact pickup remains available.
- **Readable theft:** the part's synchronized theft owner and elapsed time drive a small amber progress arc. Releasing/breaking contact removes it; the existing mint ownership pulse confirms transfer. No words, panel, button or new sound was added to the playfield. New wire fields are appended after existing component fields. Help describes the interaction.
- **Moving Sentinel aim:** the satellite previously froze an angle, moved its muzzle before firing, and could miss a stationary target. It now records a fixed world point when locking and compensates for platform motion throughout that warning. The victim's later position never updates the point; bolts do not home. Temporary damage cooldowns no longer prevent selecting a future aim point, while actual hit immunity remains enforced. Spawn/retirement clear the point. Comet's stationary launch behavior, damage, range, projectile speed and cadence are unchanged.

No weapon damage coefficients, player movement, recipe/set counts, three-satellite density, injury/capture rules or group-pressure settings were retuned.

## Scripted controls

`node scripts/weapon-contest-playtest.cjs report.json` runs the authoritative game at 30Hz. Twenty-four two-actor claim races exercise six recipes, a 150ms arrival delay and reversed actor insertion. All complete in 3.33–3.47s from the controlled starting location and deploy while retaining movement. Reservation prevents a rival from taking an uncarried sibling. Exact simultaneous contacts still use the server's existing deterministic order.

The 384 utility controls include two target sizes with idle, early-retreat, reactive-retreat and crossing behavior; eight fixed lanes; and 48 shared seed-17 stationary positions per recipe. Each weapon is collected and deployed through its normal systems before its actual attacks run. Credit and rewards match actual damage once. These controls omit opponents attacking the builder, loose pickups, holes and traffic. They establish behavior and spatial coverage, not weapon rankings or human outcomes.

For a 100-gem target initially 250 units ahead of placement, Sentinel's idle credited damage changes from 0 to 31. Early retreat still takes 0; retreat after a first hit takes 16. These are one controlled geometry and lifetime, not guaranteed match damage. Against a 4000-gem target the existing graze/resistance/shared-guard rules remain active.

The shared stationary-position sample records hits at 21/48 positions for Pinwheel, 2/48 Pulsar, 40/48 Sentinel, 17/48 Ricochet, 2/48 Ion and 39/48 Comet. The deployment location strongly favors some coverage patterns; this is not a damage or balance leaderboard. Pulsar protects a short local area, while Ion covers portions of its orbital lane. Ion's value near a central builder and Comet's punishment of stationary targets especially need human feedback. No damage buff follows from these measurements.

## Verification and remaining human play

Twenty-nine unit suites, eighteen real-network scenarios, types, schema synchronization and production builds pass. Eighty browser cases cover the amber cue, input release/reset, healthy takeover, all six stolen builds, moving placement and ordinary fleet behavior across ten desktop/phone/tablet Chromium, Gecko and WebKit profiles. One initial tablet navigation hit a transient local 404 during a simultaneous rebuild; its isolated rerun after the build verifies that case. Lint reports zero errors and 186 warnings. Phone/desktop cue screenshots were inspected. Ubuntu browser CI remains deferred.

Try a real match with several people: find and claim a set, defend or steal its carried component, finish the new owner's build, and deploy while steering. Check whether the amber arc explains the hold, whether a fleeing player can respond, and whether choosing a deployment location matters for every recipe. Human balance, discoverability and physical-device performance are not established by these automated controls.

Recorded summary: `docs/playtests/weapon-contest-2026-10-27.json`; reproducible raw controls remain under `.tmp/contested-weapons/` locally.
