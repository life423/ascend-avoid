# Standard living bullets

October 29, 2026 release batch. The user approved the implementation and subsequently authorized committing, merging to main and deploying. GitHub's pull request and production workflow record the published revision. The rule uses one standard bullet size and an immediate transfer of captured growth above that size.

## Rule

Every player-fired captive becomes a **60-unit-diameter bullet**. Sixty is three newborn body diameters: readable as ammunition without inheriting a giant captive's enormous collision area. It is an initial tuning choice, not a proven optimum for human fun.

| Captured player's physical body | Immediate reward | Captive's remaining growth |
|---|---|---|
| Wider than 60 | All growth above a 60-unit body goes to the captor | Enough to support at most 60 units |
| Exactly 60 | None | Kept |
| Narrower than 60 | None | Kept; no free growth is created |

The rule compares body width. The server converts that physical limit to the existing growth inventory using the shared growth curve, including rounding and map taper, rather than taking a percentage of gem totals. In the normal arena a 60-unit body corresponds to 32 gems. A 100-gem captive therefore retains 32 and immediately transfers 68; a 12-gem captive retains all 12 and transfers zero. Those numbers explain accounting, not an additional player-facing requirement.

All living bullets have the same visible body and swept collision diameter during flight. Speed and bounded shooter contribution use the standard bullet body, so the original captive's size does not change a given shooter's shot. Existing shooter-dependent launch speed remains. A bullet still follows captor aim, ignores captive steering and can enter a black-hole core. A landed hit from a shooter at least 20% wider than the target still shatters it without any projectile-size or speed gate.

## Capture and lifecycle

Healthy capture still requires a captor at least 1.3× wider. Eligibility and the fixed 5–12-second hold deadline are snapshotted before any growth transfer. An injured eligible player finishes at the mouth instead of becoming ammunition. Capturing a player again after their excess growth has already been taken awards no second reward unless they subsequently earn new growth above the bullet size.

Small captives receive a standard flight shell rather than extra growth. A surviving missed shot returns to the body size supported by its retained growth, centered at the same location. Natural expiry, existing under-12-gem burnup, spent-ammunition impact/respawn, four-second surviving-flight recovery, timeout, captor death/disconnect and release rules remain in force. Growth already transferred on capture is not refunded on release. Turbine transportation retains its natural creature body.

The central player geometry enforces the flight body, so rendering, collision, warning radii and targeting agree. Flight ignores ordinary growth/emergence scale animations that could otherwise make a small captive briefly appear smaller than its collision body. Landing restores the natural body; respawn clears flight state. Bot aim and black-hole shot clearance use the same standard diameter. An outward launch is clamped inside the arena and spends its bullet on the wall, rather than spawning outside the map.

## Verification

New regressions exercise legal captures from both human/bot roles, exact and adjacent size boundaries, zero-growth captives, immediate and conserved transfer, identical projectile geometry and speed for a fixed shooter, identical swept hits/near misses, no repeated reward, timeout/death/disconnect, landing-center preservation, small missed-shot burnup, and turbine compatibility. Existing capture, shooter-size finish, reward and tutorial tests are updated to the new rules.

The practice lesson uses an approximately 89-unit rival that survives the standard shot and provides a short real injury/theft/mouth-finish sequence. It uses ordinary damage, growth and capture rules rather than learner-specific immunity or damage modifiers.

Current simulation reports: [size thresholds](../reports/combat/standard-bullet-size-finishes.md), [smaller source captives](../reports/combat/standard-bullet-small-captives.md), [varied sizes and distance](../reports/combat/standard-bullet-distance-fights.md), [bot encounters](../reports/combat/standard-bullet-bot-sizes.md). These supersede the earlier variable-projectile studies for current behavior. They do not certify a most-fun balance or human dodge fairness.

Verification: complete unit suite passes, including the new standard-bullet and all-four-edge launch cases. All 18 multiplayer scenarios pass on the final server build. Client/server production builds, type checks, wire-type verification and scoped TypeScript lint pass. Lint retains one existing GameState explicit-any warning; browser/CJS test harnesses are excluded by repository configuration and were executed separately.

The final affected browser run passes **25 cases, with three intentional touch-only skips**, across Chrome desktop, Android-phone Chrome, iPhone Safari and iPad Safari emulation. Cases cover actual keyboard capture/release/fire, exact immediate rewards, identical authoritative/rendered bullet sizes, return to the retained body on landing, nonlethal tutorial damage/finish, black-hole and mouth-reward conservation. The Android Chrome profile also completes all four lessons through trusted multi-touch input; the desktop and WebKit profiles skip that Chromium-specific multi-touch case. These are emulated browser runs, not physical-device testing. Firefox and production performance were not tested in this pass.

Rendered phone, tablet and desktop shots were inspected. The 60-unit projectile is readable and uses the established creature/cannon artwork; the player's eyes remain readable. No permanent explanatory overlay or new combat control was added. A launch transition snaps out of the old held-mouth render position rather than animating a small body up to the standard collision size.

Internal visual-review heuristics (not measured usability scores): clarity 9/10, consistency 9/10, responsive fit 9/10, feedback/hierarchy 8/10, accessibility 7/10, performance evidence 7/10. Remaining recommendations: coalesce overlapping brief gain numbers and names during rapid growth; verify reduced-motion/nonvisual game feedback more broadly; profile a populated real-phone arena. These are existing surrounding-interface limitations, not claims of completed accessibility or performance validation. They do not justify an unrelated redesign in this change.

The 90 real-hit simulations show all at/above-20% opening hits shatter for both small and larger source captives. The 630-encounter smaller-bot rerun retains the observed healthy capture count of 169/315 and preserves injured-target attacks. None of these automated outcomes establishes ideal human fun, latency fairness or hours-long giant balance. The user reviewed the local production preview on port 3006 and authorized release; use the GitHub deployment record for rollout status.
