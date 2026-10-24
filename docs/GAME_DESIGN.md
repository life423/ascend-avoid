# Ascend Avoid

## Core loop

Collect gems, grow, steal from other creatures, capture someone smaller, aim and fire them as a living cannonball, then compete for spilled gems. The captor controls the shot; the captive's chance is escaping before launch. The world is continuous: no lobby or round wait. The background field target is 950 gems, about 25% fewer than the former 1,270; combat spills are additional, within the overall 2,000-object cap. This is a field-density reduction, not a cap of 950 total objects after fights.

## World and presentation

The finite arena is 4200 × 4200 units. On wide desktops the camera stays pinned to the creature, including at boundaries, with a thin blue edge and lighter blue surround. On compact screens the view stays inside the arena, including during knockouts, rotation and extreme zoom, so empty exterior never fills the play area. The creature stays centered away from boundaries; near a compact screen's map edge the camera stops and the creature can move off-center. The world does not wrap.

Bots fill the population to 20 and yield places to arriving humans. Crowded bots disengage for 6–8 seconds and head toward less occupied space. At most two bots pursue a given target. Traffic, bombs and floor shifts remain experimental, explicitly enabled in test worlds.

## Movement and growth

Continuous analog walking supports WASD, arrows, a touch stick or holding the mouse button. Directional speed is normalized. The mouth turns toward movement/aim with bounded angular speed and acceleration. Large creatures turn slower, with responsive acceleration.

Width is `20 * sqrt(1 + gems / 2)`, rounded to half a unit. Speed is `max(130, 320 * (20 / width)^0.3)`. This retains a small creature's speed advantage while making growth playable. Big human creatures decay gently above 300 gems; bots decay sooner and faster.

## Inhale, capture and escape

Hold Space or the touch button to inhale. A cone pulls gems and steals weight, preserving the victim's last gem. Good airflow can form a focused beam; close range, alignment and clean separation determine effectiveness.

A creature at least 1.3 times wider can capture a smaller one at its mouth. Captives remain alive. After a 600ms daze, they enter a directional escape sequence: three inputs below a 2x captor width advantage, four at 2x, five at 4x or greater. A wrong input resets progress. Keyboard edges are transmitted explicitly; touch flicks return to neutral between inputs, and their edges are processed on message arrival.

Loading takes 2.8, 3.1 or 3.4 seconds for those respective sequences. After the 600ms daze, this leaves 2.2, 2.5 or 2.8 usable seconds before the earliest shot. Tapping FIRE early queues a shot for the end of loading. Releasing the original inhale simply stops inhaling. The captor can keep aiming. A hold ends after 4.5 seconds, or sooner when the captive escapes or the captor is incapacitated/leaves. Focus loss clears input and cancels a queued shot.

Bots take 500ms to read after the daze, attempt an input every 450ms, and choose correctly 65% of the time. These values deliberately give the captor a usable shot window.

## Flights and hits

The captor's facing alone determines launch direction. Captive input cannot change the launch angle or steer a player-fired missile, including its bounce. Turbine throws retain their separate steering behavior. Swept collision checks prevent tunneling. A hit spills gems, stuns briefly, and bounces a surviving projectile. Impact events identify the launcher, flier and target. The capture badge sits below the body so faces remain readable.

Current loading is 2.8/3.1/3.4 seconds for three/four/five inputs. Earlier 1.8/2.1/2.4-second tuning still left too little human reaction time after the 600ms daze. Early FIRE still queues, and slow, imperfect bot escape attempts remain unchanged.

## Pulsar Array and shared weapon assembly

The first weapon recipe is the Pulsar Array, made from a plasma cell, field coil and emitter. The minimap marks C/F/E. Its angular three-fin reactor replaces the earlier Drum theme. It shares contact/inhale pickup, persistent carrying, the 18-second builder claim, gust disruption and explicit E/Place weapon placement with the Pinwheel. Only one recipe is on the map at a time. When a build expires or finishes, the next set alternates between Pulsar and Pinwheel after the existing 20-second wait.

After placement the Array charges for 1.2 seconds. Each pulse has a 700ms inward-charging warning. Four plasma waves launch 2.2 seconds apart over an 8.3-second active lifetime, expanding from radius 44 to 404 over 900ms. The faint outer boundary previews their reach. Each wave hits a rival once, spending 25% of their gems (rounded up, minimum six, never more than they have). Below three gems after damage means knockout and normal respawn. All lost gems spill with the usual pickup lock. Survivors get a mass-scaled shove with base distance 420 and a 220-unit floor, twice the earlier Drum tuning. The wave does not stun. Builder attribution, impact flash/sound and knockout feedback identify the hit. The owner, spawn-protected, captured, flying and dead players are excluded. Swept wave checks cover crossing players and the final segment. Disconnect removes the deployed weapon.

There is no persistent weapon banner, progress pill, waiting countdown or duplicate completed-weapon label on any screen. Minimap markers and physical carried parts provide continuous state. A local pickup or completed assembly gets one coalesced notice that expires after 3.5 seconds; other players' collection does not show it. The contextual Place weapon button appears only while carrying a complete weapon. Help contains the instructions. Starter tips close automatically after four seconds and can be replayed from Help.

## Defensive gust

Each gust spends 35 percentage points of the full breath meter, after elapsed recharge. At least 35% breath is required; declined gusts spend neither breath nor cooldown. The server acknowledges remaining breath so desktop and phone meters show the cost.

Tap with an empty mouth to puff in a 110-degree cone. Knockback scales gently by mass: base shove 400 units, capped at 500. A successful puff into an incoming inhale creates at least 200 units of intended separation, clears that suction connection, and protects its user from suction for one second. The puff cooldown is 1.8 seconds. Protection ends when a creature inhales, puffs or fires.

A gust hit stuns its target for 800ms: no steering or inhaling, while knockback still carries it away. Spiral pupils, a slight wobble and orbiting sparks show the stun. Existing 1.2-second immunity after a stun prevents repeated extensions. Spawn protection still blocks gust hits.

A surviving flight ends with three seconds of protection from incoming suction, inhale drain and recapture by any player or turbine. This applies after an impact, hitting the arena edge or simply landing, and starts after the flight finishes so the full window is usable. Knocked-out missiles instead use normal respawn protection. The creature can move and act; a draining mint ring shows the window. Normal collision damage still applies.

## Impact and collision tuning

Player missiles remove 75–85% of a target's mass. A target left below 12 gems is knocked out and respawns protected at newborn size. The missile separately retains about 10% of its former width after hitting another player or an arena edge. If its retained growth rounds down to zero gems, it is knocked out too; a larger survivor receives the post-flight suction shield. Spent mass spills as gems, and a bounce cannot charge it twice. Flights that time out without impact do not consume growth. The two-second respawn and 1.5-second spawn protection are unchanged; the user's concern was too few deaths, not difficult respawning.

Forceful new body contact (closing speed at least 120 units/s) staggers both players for 220ms and gives a mass-scaled separating shove. The pair must separate by 18 units before rearming; existing stun immunity prevents repeated stun chains. Tangential contact grip is reduced from 80% to 15% so players can slide out of crowds. Spawn-protected, flying, captured, already stunned or skidding players do not trigger a fresh bump.

## Pinwheel Cannon prototype

One hub, rotor and barrel appear near the arena center after five seconds. Touch or inhale a part to collect it; cargo stays attached behind the creature when it releases inhale, moves or turns. Touching does not bypass another player's part claim. A meaningful pickup starts an 18-second claim for the build. Adding a new required component refreshes it; holding the same component does not. If a rival supplies the final piece, the active builder keeps ownership. Abandonment unlocks the parts when the claim expires. Gusts physically disrupt even claimed parts.

Carry all three or bring them within 72 world units to assemble. The complete weapon remains carried until its builder taps Place weapon (or presses E), allowing relocation before activation. It never auto-places on a timer. If its carrier is captured, knocked out or launched, it drops and begins charging. After placement, it spins up for 1.2 seconds, then rotates and fires a gem bolt every 600ms for eight seconds. Each bolt hits once, ignores the builder and spawn-protected/flying/captured creatures, spills at most six gems while leaving one, and knocks back without stunning. A short per-target hit cooldown prevents rapid repeated hits. Bolts expire within 650 units. Parts expire after 120 seconds if unfinished; the next set arrives 20 seconds after a build expires or finishes. Assembly stops when the builder disconnects. The prototype is disabled with experimental arena shifts; bots do not pursue or claim components yet.

Individual H/R/B component markers track their real locations; nearby labels spread with short tethers to stay readable. A square marks the completed weapon. Claim rings remain attached to physical parts. Permanent progress cards, direction arrows and waiting countdowns are removed; brief local pickup notices and the contextual Place button provide feedback without covering the arena.

## Turbines and gem surges

Turbine intakes strip and transport gems; exhausts fling gems and creatures across the arena. Glowing blue Core orbs have been retired completely from the active game.

The first gem-surge warning starts after 30 seconds. An eight-second warning marks a location, usually near a turbine exhaust, on the minimap and HUD. For 18 seconds, bonus gems fall there every three seconds. A 40-gem jackpot appears in the final five seconds. A grounded, free creature claims it by standing there alone for 0.6 seconds; multiple claimants stop progress. After the event, there is a 60–90-second gap. Bonus gems expire, respect the global gem cap and do not disturb field-gem accounting. Experimental arena shifts own the jackpot when enabled, so the two events do not conflict.

## UI and accessibility

Desktop controls have text labels and visible keyboard shortcuts. Names save with a button, Enter or blur, and expose a confirmation. The activity feed stays below collapsed controls. Phones use canvas controls with contextual Inhale/Loading/Queued/Fire labels. First-session hints are dismissible and replayable from help. Sounds are gesture-unlocked, throttled and optional; mute is remembered.

The shell reserves the final canvas/header layout before initialization, uses local system font fallbacks, and supplies a description and semantic score labels. Local Lighthouse measurements are recorded separately from production results.

## Validation

`npm run type-check`, `npm run lint`, `node scripts/gen-synced-types.mjs --check`, `npm run build`, and `npm test` validate the branch. Browser regressions against a local test server cover keyboard/touch escapes, focus cancellation, centering, names, controls and sound settings. `scripts/capture-balance.cjs` and `scripts/bot-crowd.cjs` measure real simulation behavior for future tuning.
