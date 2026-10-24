# Ascend Avoid

## Core loop

Collect gems, grow, steal from other creatures, capture someone smaller, aim and fire them as a steerable living cannonball, then compete for spilled gems. The world is continuous: no lobby or round wait.

## World and presentation

The finite arena is 4200 × 4200 units. The camera is pinned to the local creature, including during hits, flights and at boundaries. The floor and entities stop at a thin blue edge. A lighter blue decorative surround fills extra screen space; the world does not wrap.

Bots fill the population to 20 and yield places to arriving humans. Crowded bots disengage for 6–8 seconds and head toward less occupied space. At most two bots pursue a given target. Traffic, bombs and floor shifts remain experimental, explicitly enabled in test worlds.

## Movement and growth

Continuous analog walking supports WASD, arrows, a touch stick or holding the mouse button. Directional speed is normalized. The mouth turns toward movement/aim with bounded angular speed and acceleration. Large creatures turn slower, with responsive acceleration.

Width is `20 * sqrt(1 + gems / 2)`, rounded to half a unit. Speed is `max(130, 320 * (20 / width)^0.3)`. This retains a small creature's speed advantage while making growth playable. Big human creatures decay gently above 300 gems; bots decay sooner and faster.

## Inhale, capture and escape

Hold Space or the touch button to inhale. A cone pulls gems and steals weight, preserving the victim's last gem. Good airflow can form a focused beam; close range, alignment and clean separation determine effectiveness.

A creature at least 1.3 times wider can capture a smaller one at its mouth. Captives remain alive. After a 600ms daze, they enter a directional escape sequence: three inputs below a 2x captor width advantage, four at 2x, five at 4x or greater. A wrong input resets progress. Keyboard edges are transmitted explicitly; touch flicks return to neutral between inputs, and their edges are processed on message arrival.

Loading takes 1.2, 1.4 or 1.6 seconds for those respective sequences. Tapping FIRE early queues a shot for the end of loading. Releasing the original inhale simply stops inhaling. The captor can keep aiming. A hold ends after 4.5 seconds, or sooner when the captive escapes or the captor is incapacitated/leaves. Focus loss clears input and cancels a queued shot.

Bots take 500ms to read after the daze, attempt an input every 450ms, and choose correctly 65% of the time. These values deliberately give the captor a usable shot window.

## Flights and hits

The captor's facing and captive's lateral input determine launch direction. Captives can steer sideways during flight. Swept collision checks prevent tunneling. A hit spills gems, stuns briefly, and bounces the projectile. The flier survives. Impact events identify the launcher, flier and target, and both launcher and flier receive recognition. The capture badge sits below the body so faces remain readable.

Current capture loading is 1.8/2.1/2.4 seconds for three/four/five directional inputs. The earlier 1.2–1.6-second tuning left too little human reaction time after the 600ms daze. Early FIRE still queues, and slow, imperfect bot escape attempts remain unchanged.

## Defensive gust

Tap with an empty mouth to puff in a 110-degree cone. Knockback scales gently by mass: base shove 400 units, capped at 500. A successful puff into an incoming inhale creates at least 200 units of intended separation, clears that suction connection, and protects its user from suction for one second. The puff cooldown is 1.8 seconds. Protection ends when a creature inhales, puffs or fires.

A gust hit stuns its target for 800ms: no steering or inhaling, while knockback still carries it away. Spiral pupils, a slight wobble and orbiting sparks show the stun. Existing 1.2-second immunity after a stun prevents repeated extensions. Spawn protection still blocks gust hits.

Every flight ends with three seconds of protection from incoming suction, inhale drain and recapture by any player or turbine. This applies after an impact, hitting the arena edge or simply landing, and starts after the flight finishes so the full window is usable. The creature can move and act; a draining mint ring shows the window. Normal collision damage still applies.

## Pinwheel Cannon prototype

One hub, rotor and barrel appear near the arena center after 20 seconds. Inhale to pull them together; nearby claimed parts continue following your mouth while you inhale. A meaningful pickup starts an 18-second claim for the build. Adding a new required component refreshes it; holding the same component does not. If a rival supplies the final piece, the active builder keeps ownership. Abandonment unlocks the parts when the claim expires. Gusts physically disrupt even claimed parts.

Bring all three within 72 world units to assemble. The wheel spins up for 1.2 seconds, then rotates and fires a gem bolt every 600ms for eight seconds. Each bolt hits once, ignores the builder and spawn-protected/flying/captured creatures, spills at most six gems while leaving one, and knocks back without stunning. A short per-target hit cooldown prevents rapid repeated hits. Bolts expire within 650 units. Parts expire after 60 seconds if unfinished; the next set arrives 45 seconds after a build expires or finishes. Assembly stops when the builder disconnects. The prototype is disabled with experimental arena shifts; bots do not pursue or claim components yet.

The HUD shows assembly progress, the builder's remaining claim, and a direction arrow. A pink minimap marker points to the event; the capture prompt takes priority over the weapon card.

## Turbines, Cores and gem surges

Turbine intakes strip and transport gems; exhausts fling gems and creatures across the arena. Cores can be swung by airflow and stun on hard impacts.

The first gem-surge warning starts after 30 seconds. An eight-second warning marks a location, usually near a turbine exhaust, on the minimap and HUD. For 18 seconds, bonus gems fall there every three seconds. A 40-gem jackpot appears in the final five seconds. A grounded, free creature claims it by standing there alone for 0.6 seconds; multiple claimants stop progress. After the event, there is a 60–90-second gap. Bonus gems expire, respect the global gem cap and do not disturb field-gem accounting. Experimental arena shifts own the jackpot when enabled, so the two events do not conflict.

## UI and accessibility

Desktop controls have text labels and visible keyboard shortcuts. Names save with a button, Enter or blur, and expose a confirmation. The activity feed stays below collapsed controls. Phones use canvas controls with contextual Inhale/Loading/Queued/Fire labels. First-session hints are dismissible and replayable from help. Sounds are gesture-unlocked, throttled and optional; mute is remembered.

The shell reserves the final canvas/header layout before initialization, uses local system font fallbacks, and supplies a description and semantic score labels. Local Lighthouse measurements are recorded separately from production results.

## Validation

`npm run type-check`, `npm run lint`, `node scripts/gen-synced-types.mjs --check`, `npm run build`, and `npm test` validate the branch. Browser regressions against a local test server cover keyboard/touch escapes, focus cancellation, centering, names, controls and sound settings. `scripts/capture-balance.cjs` and `scripts/bot-crowd.cjs` measure real simulation behavior for future tuning.
