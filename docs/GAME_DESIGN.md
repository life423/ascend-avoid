# Ascend Avoid

## Core loop

The approved experience is the six-stage [lasting-dominance loop](GAME_LOOP.md): start small, become capable, build an advantage, become enormous, maintain a long reign, and eventually fall into another climb. The user explicitly wants giant size to feel almost untouchable and sustainable for hours through good play. The initial size-based missile/theft pass below starts supporting that goal; hours-long survival has not been established by playtesting. GAME_LOOP.md separates this implemented pass from remaining proposals.

Collect gems, grow, steal from injured creatures, capture someone smaller, aim and fire them as a living cannonball, then compete for spilled gems. The captor controls the shot; the captive's chance is escaping before launch. The world is continuous: no lobby or round wait. The background field target is 950 gems, about 25% fewer than the former 1,270; combat spills are additional, within the overall 2,000-object cap. This is a field-density reduction, not a cap of 950 total objects after fights.

## World and presentation

The finite arena is 4200 × 4200 units. The online canvas covers the entire visible browser viewport on phones, tablets, desktop and ultrawide windows, with no reserved header strip, padding, rounded corners or letterboxing. Desktop controls float over the arena; Focus view hides them without changing canvas size, and keeps mouse control and Help available. Small desktop windows retain the mouse preference in Help. Touch controls and contextual actions respect safe areas. Dynamic browser viewport changes, rotation and keyboard resizing refit the stage. Browser and operating-system chrome remain controlled by the browser.

Every screen's camera view stays inside the arena, including during knockouts and extreme zoom. The creature stays centered in open space; near a boundary the camera stops and the creature can move off-center. This latest full-viewport request supersedes the earlier wide-desktop blue-surround preference. The world does not wrap, and wider screens retain the existing view-aspect limits.

Bots fill the population to 20 and yield places to arriving humans. Crowded bots disengage for 6–8 seconds and head toward less occupied space. At most two bots pursue a given target. Traffic, bombs and floor shifts remain experimental, explicitly enabled in test worlds.

## Movement and growth

Continuous analog walking supports WASD, arrows, a touch stick or holding the mouse button. Directional speed is normalized. The mouth turns toward movement/aim with bounded angular speed and acceleration. Large creatures turn slower, with responsive acceleration.

Width is `20 * sqrt(1 + gems / 2)`, rounded to half a unit. Speed is `max(130, 320 * (20 / width)^0.3)`. This retains a small creature's speed advantage while making growth playable. Big human creatures decay gently above 300 gems; bots decay sooner and faster.

## Inhale, capture and escape

Hold Space or the touch button to inhale. Loose gems remain collectible and healthy creatures can still be pulled and captured, but their gems cannot be stolen. Only injured creatures can lose gems to suction. Draining their final gem knocks them out, credits the final thief and starts the normal two-second protected respawn. Good airflow can form a focused beam; close range, alignment and clean separation determine effectiveness.

## Injury and theft — approved October 25, 2026

Damaging player-missile hits, Pinwheel bolts, Pulsar waves, bombs and traffic hits expose a surviving target's gems for five seconds. Ordinary bumps, gusts, passive decay, loose-gem collection and turbine transport do not cause injury. Another damaging hit refreshes the five-second window; inhaling and stealing never refresh it. Healing happens automatically at the deadline. Injury itself adds no stun, speed penalty or disabled input. Existing hit-specific stun/skid behavior, spawn protection, escape protection and landing suction shields still apply.

There is no shared allowance or total theft cap per injury. Any attacker can steal, within the established breath, range, airflow and size-ratio rules. The defender can move away, fight back or spend breath on gust. The initial injury pass kept damage and growth unchanged; the later approved size-based combat pass changes missile damage and theft strength as described below. Bots pursue healthy creatures only when they can capture them, rather than farming gems they cannot steal.

Bot movement and mouth decisions share the same capture/theft eligibility, including flight and suction protection. Bots stop inhaling a healed noncapturable target and avoid starting theft chases that cannot reach the remaining injury window. An injured bot slips sideways out of incoming theft rather than trying to rob a healthy attacker back. It may prepare a gust after a 300–650ms reaction, with a 75% response choice and later retries after missed opportunities. It turns using ordinary held-inhale aim, then releases and puffs; facing cannot snap, breath still costs 35%, and cooldown/stun/capture rules still apply. Existing crowd limits, imperfect cannon aim and escape skill are unchanged. This changes bot decisions, not injury duration or damage.

Bot follow-up validation: seven unit suites, 13 isolated multiplayer scenarios, production builds, type/schema checks and lint pass (zero errors, 164 existing warnings). Tests cover shared target eligibility, healed and protected targets, healthy capture, reachable injury windows, sideways escape, delayed/missed gust responses, real-world-loop defense, breath cost, turning and cooldown. A 90-second simulation with 19 bots recorded four captures, two launches, 415-unit mean nearest-neighbor distance and no sampled mutual-inhale pairs. This single simulation is a smoke check, not a before/after balance measurement.

The creature squashes briefly on impact; warm, branching fractures open along its rear shell rim, away from the eyes and puffed cheeks. They close near the end of the injury, with a brief sealing shimmer. Reduced motion keeps the readable fracture shape without the impact squash, ripple or shimmer. This is distinct from dizzy stun effects and the mint suction-protection ring. There is no injury banner, countdown, health bar or new control. Help stays concise and explains injury theft and gust defense.

Validation: all six unit suites and all 13 isolated multiplayer scenarios pass. Browser coverage across seven Chromium/WebKit profiles passed 91 cases with 14 device-specific skips; the final fracture artwork then passed all 21 injury checks. Coverage includes healthy immunity, real-peer drain knockout/credit/protected respawn, automatic healing, movement, reduced motion, keyboard/touch capture and aiming, weapons, gust stun, fans and short Help. Rendered phone, tablet, desktop and landscape injury/healed/knockout states were inspected. Help is 125 source words. Lint has zero errors and 164 existing warnings. Physical-device readability and longer-term growth/knockout balance still need playtesting; this is not a claim of measured perfect balance or full accessibility conformance.

A creature at least 1.3 times wider can capture a smaller one at its mouth. Captives remain alive. After a 600ms daze, they enter a directional escape sequence: three inputs below a 2x captor width advantage, four at 2x, five at 4x or greater. A wrong input resets progress. Keyboard edges are transmitted explicitly; touch flicks return to neutral between inputs, and their edges are processed on message arrival.

Loading takes 2.8, 3.1 or 3.4 seconds for those respective sequences. After the 600ms daze, this leaves 2.2, 2.5 or 2.8 usable seconds before the earliest shot. Tapping FIRE early queues a shot for the end of loading. Releasing the original inhale simply stops inhaling. The captor can keep aiming. A hold ends after 4.5 seconds, or sooner when the captive escapes or the captor is incapacitated/leaves. Focus loss clears input and cancels a queued shot.

Bots take 500ms to read after the daze, attempt an input every 450ms, and choose correctly 65% of the time. These values deliberately give the captor a usable shot window.

## Flights and hits

The captor's facing alone determines launch direction. Captive input cannot change the launch angle or steer a player-fired missile, including its bounce. Turbine throws retain their separate steering behavior. Swept collision checks prevent tunneling. A hit spills gems, stuns briefly, and bounces a surviving projectile. Impact events identify the launcher, flier and target. The capture badge sits below the body so faces remain readable.

Current loading is 2.8/3.1/3.4 seconds for three/four/five inputs. Earlier 1.8/2.1/2.4-second tuning still left too little human reaction time after the 600ms daze. Early FIRE still queues, and slow, imperfect bot escape attempts remain unchanged.

## Pulsar Array and shared weapon assembly

The first weapon recipe is the Pulsar Array, made from a plasma cell, field coil and emitter. The minimap marks C/F/E. Its angular three-fin reactor replaces the earlier Drum theme. It shares contact/inhale pickup, persistent carrying, the 18-second builder claim, gust disruption and explicit E/Place weapon placement with the Pinwheel. Only one recipe is on the map at a time. When a build expires or finishes, the next set alternates between Pulsar and Pinwheel after the existing 20-second wait.

After placement the Array charges for 1.2 seconds. Each pulse has a 700ms inward-charging warning. Four plasma waves launch 2.2 seconds apart over an 8.3-second active lifetime, expanding from radius 44 to 404 over 900ms. The faint outer boundary previews their reach. Each wave hits a rival once, spending 25% of their gems (rounded up, minimum six, never more than they have). Below eight gems after damage means knockout and normal respawn. All lost gems spill with the usual pickup lock. Survivors get a mass-scaled shove with base distance 420 and a 220-unit floor, twice the earlier Drum tuning. The wave does not stun. Builder attribution, impact flash/sound and knockout feedback identify the hit. The owner, spawn-protected, captured, flying and dead players are excluded. Swept wave checks cover crossing players and the final segment. Disconnect removes the deployed weapon.

There is no persistent weapon banner, progress pill, waiting countdown or duplicate completed-weapon label on any screen. Minimap markers and physical carried parts provide continuous state. A local pickup or completed assembly gets one coalesced notice that expires after 3.5 seconds; other players' collection does not show it. The contextual Place weapon button appears only while carrying a complete weapon. Help contains the instructions. Starter tips close automatically after four seconds and can be replayed from Help.

## Defensive gust

Each gust spends 35 percentage points of the full breath meter, after elapsed recharge. At least 35% breath is required; declined gusts spend neither breath nor cooldown. The server acknowledges remaining breath so desktop and phone meters show the cost.

Tap with an empty mouth to puff in a 110-degree cone. Knockback scales gently by mass: base shove 400 units, capped at 500. A successful puff into an incoming inhale creates at least 200 units of intended separation, clears that suction connection, and protects its user from suction for one second. The puff cooldown is 1.8 seconds. Protection ends when a creature inhales, puffs or fires.

A gust hit stuns its target for 800ms: no steering or inhaling, while knockback still carries it away. Spiral pupils, a slight wobble and orbiting sparks show the stun. Existing 1.2-second immunity after a stun prevents repeated extensions. Spawn protection still blocks gust hits.

A surviving flight ends with three seconds of protection from incoming suction, inhale drain and recapture by any player or turbine. This applies after an impact, hitting the arena edge or simply landing, and starts after the flight finishes so the full window is usable. Knocked-out missiles instead use normal respawn protection. The creature can move and act; a draining mint ring shows the window. Normal collision damage still applies.

## Impact and collision tuning

Target missile damage now follows pre-impact projectile mass relative to target mass, with a bounded speed modifier; the old 75–85% loss floor is removed. A target left below 12 gems is knocked out and respawns protected at newborn size. The missile separately retains about 10% of its former width after hitting another player or an arena edge. If its retained growth rounds down to zero gems, it is knocked out too; a larger survivor receives the post-flight suction shield. Spent mass spills as gems, and a bounce cannot charge it twice. Large unimpacted misses land without consuming growth; very small player-cannon misses follow the burnup rule below. The two-second respawn and 1.5-second spawn protection remain.

### Size-based combat — approved October 25, 2026

The user approved starting with missile damage and theft so getting huge feels worthwhile while small players can fight back. Initial tuning uses total body mass (gems plus the two-gem newborn base), reconstructed from the projectile's width before its own impact shrink. If `r` is projectile mass / target mass, the damage fraction is `min(0.85, 0.85 * r^0.8 / (r^0.8 + 3^0.8) * clamp(speed / 1250, 0.65, 1.15))`. Positive hits remove at least one gem, rounded to an integer and bounded by available gems. This applies to player-cannon and fan projectiles; fan fit, flight opportunity, stun, credit, spill value, landing protection and missile-player shrink/burnup rules remain intact. Captor size influences launch speed through its existing bounded rule, not the projectile mass used for damage.

At 1250 units/s against a 1000-gem target, 4/20/250/1000/4000-gem projectiles remove 6/16/103/249/473 gems respectively. These are formula measurements, not guaranteed battle outcomes or lethal thresholds. Larger ammunition can still eliminate a smaller or weakened target. A tiny fan launch remains a way to cause damage and open the five-second injury window without stripping most of a giant's progress.

Theft reaches full size strength at 85% of the victim's width (about 72% of body mass), up from 35% width. Smooth interpolation from the existing 8% minimum at 10% width preserves some theft even for tiny players. Clean sustained contact ramps 1x/1.25x/1.6x/2x/2.5x/3x at 0/0.4/0.8/1.2/1.6/2 seconds; it formerly reached 8x. The same strength is used for actual transfer and opposing-inhale clashes. There is no shared theft allowance, per-injury cap or guaranteed surviving gem. Healing still occurs five seconds after the latest damaging hit, and theft cannot refresh it. Gust, movement, breath and existing shields remain counterplay.

An isolated five-second contact test with a stationary 1000-gem victim, ideal tracking and no escape or spill pickup records 8/15/71/106 gems stolen by attackers starting at 4/40/250/1000 gems, versus the former 56/245/267/265. Two tiny four-gem thieves take 16 together instead of 120. Attackers grow and the victim shrinks throughout these tests. A swept 20-gem impact followed by two perfectly tracking tiny thieves preserves at least 95% of the giant's starting gems, while both thieves gain. These controlled checks verify the intended size relationship; they do not establish long-term balance or hours of survival.

Crystal growth, movement, damage from deployed weapons and passive decay are unchanged in this pass. Repeated Pulsar hits and sustaining giant size under passive decay remain follow-ups, so the overall lasting-dominance goal is not marked complete. Help briefly explains that bigger ammunition hits harder; no pinned UI or new controls are added.

Validation: eight unit suites, 13 isolated multiplayer scenarios, type/schema checks, production builds and lint pass (zero errors, 164 existing warnings). Controlled tests exercise monotonic size/speed response, tiny and near-peer damage, actual swept impacts, combined missile/two-thief pressure, five-second healing, value conservation, lethal large ammunition, protected respawn and actual fitting fan launches. The network test waits for authoritative injury rather than mistaking passive decay for a hit. Seven Chromium/WebKit desktop/phone/tablet profiles passed 63 applicable browser cases across the release and fixture-correction runs, including capture/escape, burnup, fans, healthy immunity, theft knockout, healing, reduced motion and a real small shot into a giant. The final new shot test passed all seven profiles after opening Help through the visible desktop/mobile controls. Rendered giant-hit phone, tablet and desktop scenes were inspected; eyes remain unobscured, the creature retains size and the canvas shows no exterior/gaps. Physical devices, assistive technology, production performance and long-term leader survival remain unmeasured.

Forceful new body contact (closing speed at least 120 units/s) staggers both players for 220ms and gives a mass-scaled separating shove. The pair must separate by 18 units before rearming; existing stun immunity prevents repeated stun chains. Tangential contact grip is reduced from 80% to 15% so players can slide out of crowds. Spawn-protected, flying, captured, already stunned or skidding players do not trigger a fresh bump.

## Pinwheel Cannon prototype

One hub, rotor and barrel appear near the arena center after five seconds. Touch or inhale a part to collect it; cargo stays attached behind the creature when it releases inhale, moves or turns. Touching does not bypass another player's part claim. A meaningful pickup starts an 18-second claim for the build. Adding a new required component refreshes it; holding the same component does not. If a rival supplies the final piece, the active builder keeps ownership. Abandonment unlocks the parts when the claim expires. Gusts physically disrupt even claimed parts.

Carry all three or bring them within 72 world units to assemble. The complete weapon remains carried until its builder taps Place weapon (or presses E), allowing relocation before activation. It never auto-places on a timer. If its carrier is captured, knocked out or launched, it drops and begins charging. After placement, it spins up for 1.2 seconds, then rotates and fires a gem bolt every 140ms for eight seconds. Straight bullets form outward spiral patterns. Each bolt ignores the builder and spawn-protected/flying/captured creatures; mass-sensitive damage can knock out targets below eight remaining gems. A 500ms per-target hit cooldown prevents rapid repeated hits. Bolts expire within 900 units. See the follow-up tuning below for the exact damage formula. Parts expire after 120 seconds if unfinished; the next set arrives 20 seconds after a build expires or finishes. Assembly stops when the builder disconnects. The prototype is disabled with experimental arena shifts; bots do not pursue or claim components yet.

Individual H/R/B component markers track their real locations; nearby labels spread with short tethers to stay readable. A square marks the completed weapon. Claim rings remain attached to physical parts. Permanent progress cards, direction arrows and waiting countdowns are removed; brief local pickup notices and the contextual Place button provide feedback without covering the arena.

## Turbines and gem surges

Turbine intakes strip and transport gems; exhausts fling gems and creatures across the arena. Glowing blue Core orbs have been retired completely from the active game.

The first gem-surge warning starts after 30 seconds. An eight-second warning marks a location, usually near a turbine exhaust, on the minimap and HUD. For 18 seconds, bonus gems fall there every three seconds. A 40-gem jackpot appears in the final five seconds. A grounded, free creature claims it by standing there alone for 0.6 seconds; multiple claimants stop progress. After the event, there is a 60–90-second gap. Bonus gems expire, respect the global gem cap and do not disturb field-gem accounting. Experimental arena shifts own the jackpot when enabled, so the two events do not conflict.

## UI and accessibility

Desktop controls have text labels and visible keyboard shortcuts. Names save with a button, Enter or blur, and expose a confirmation. The activity feed stays below collapsed controls. Phones use canvas controls with contextual Inhale/Loading/Queued/Fire labels. First-session hints are dismissible and replayable from help. Sounds are gesture-unlocked, throttled and optional; mute is remembered.

The shell reserves the final canvas/header layout before initialization, uses local system font fallbacks, and supplies a description and semantic score labels. Local Lighthouse measurements are recorded separately from production results.

## Validation

`npm run type-check`, `npm run lint`, `node scripts/gen-synced-types.mjs --check`, `npm run build`, and `npm test` validate the branch. Browser regressions against a local test server cover keyboard/touch escapes, focus cancellation, centering, names, controls and sound settings. `scripts/capture-balance.cjs` and `scripts/bot-crowd.cjs` measure real simulation behavior for future tuning.

## Fair controls and lethal Pinwheel follow-up (current branch)

Escaping or being released grants two seconds of protection against incoming suction, inhale drain and recapture by any player. The existing mint ring shows the duration without adding text. Landing survivors still get three seconds. Loading and human escape windows are unchanged.

Bot cannon aim reads no sooner than 250ms, samples every 450ms during loading, and commits when loading completes. Observed aim has a signed 0.12–0.24 radian error. A bot waits another 400–650ms after loading before firing; it cannot track a last-moment dodge perfectly. Captured bots retain their slow, imperfect direction-puzzle behavior.

The Pinwheel now fires every 140ms for eight seconds, rotating at the established speed. Straight bullets launched at successive angles form outward spiral patterns; range is 900 world units. Bolt damage is the smaller of 30% of the target's gems and max(8, ceil(1.6 × sqrt(gems))), never more than the target owns. Below eight remaining gems means knockout and normal protected respawn. This removes the former six-gem cap and guaranteed last-gem survival while giving giants more staying power. Existing owner/spawn/capture/flight exclusions and 500ms per-target hit cooldown remain. Hit/knockout effects credit the builder. Pulsar waves also finish players below eight remaining gems, retaining their existing 25% loss/minimum-six damage and warning.

Desktop mouse-follow needs no held button. WASD/arrows take over until the mouse moves again. Leaving the canvas, text entry, Help and focus loss stop pointer movement. Touch retains the left movement stick and uses dragging the existing right action control for independent aim; its directional cue exists only during drag. Aiming a loaded cannon does not fire it on hold: release, then tap to fire. E and the contextual Place button are unchanged.

New spawns and respawns use an interior margin based on the centered newborn view's maximum supported aspect ratio, plus 120 world units. Traffic/player/leader clearance checks still choose the safest candidate. Respawn resets camera zoom so a previous giant's zoom does not expose exterior. Desktop boundary behavior during deliberate travel is unchanged. This addresses edge-heavy starts without wrapping the map or painting playable decoration beyond it.

Help text is reduced from 519 to no more than 129 words, with keyboard focus containment, an accessible dialog and 44px close target. Gem-surge HUD notices disappear after three seconds for each new warning/active/jackpot state; the minimap and world event continue for their original durations. No permanent weapon panel returns.

Unused whole-swallow/digestion/expel behavior, vanish visuals, unused physics helpers/tests and the obsolete escape measurement script are removed. Three inert schema slots retain field ordering for older clients; these compatibility slots have no gameplay or visual behavior.

Growth per gem, further leader durability and black holes remain proposals in docs/TODO.md. The growth formula and passive decay remain unchanged. The later approved size-based combat pass above adjusts the existing small-to-large theft multiplier and sustained-contact ramp after baseline measurement, rather than adding a second overlapping penalty.
Compact capture UI keeps the existing creature badge and action button and omits the duplicate loading footer. Escape prompts sit above the thumb-control region. Capturing a peer resets the client's sent-aim cache so an unchanged right-thumb aim is resent after the server ends the inhale.

## Full-viewport arena follow-up

The brief starter tip yields while Place weapon is available, keeping the creature and placement scene clear. This final visual correction passed placement checks in both phone browser engines.

The canvas covers the visible browser viewport on every screen. ResizeObserver and coalesced window/visualViewport events refit it without repeated bitmap clears; fractional CSS sizes use a covering integer backing size. Desktop controls float above the map, and Focus view leaves mouse control and Help reachable without changing the canvas. Inactive controls are inert/hidden; a closed menu stays visually hidden across breakpoint changes. Phone score, minimap/player count, thumb controls and contextual placement respect safe areas. Short landscape escape prompts move above the creature; the captive does not also see the redundant captor loading badge. There are no new permanent weapon messages. Safe-area and simulated keyboard/toolbar viewport changes have browser coverage.

Client/server production builds, types, schema and all five unit suites pass. Seven Chromium/WebKit device profiles exercised sizes from 320×568 through 5120×1080 and 1440×2560, corners, growth, knockout/respawn, rotation, capture/escape, independent aiming, menus, focus, mouse preference and weapon placement. The final affected-area matrix covered 72 applicable cases (five device-specific skips) across the release run and corrective checks, plus two final toolbar/menu layering checks. WebKit's unsupported viewport-key warning was removed; two weapon tests now recognize the same narrow, known caught Colyseus socket probe as the existing loading test. Fixed-delay movement/cargo checks now await settling without loosening their limits. Two local page-load checks overlapped a rebuild and passed against the fixed build. Lint has zero errors and 164 pre-existing warnings. Firefox could not launch on this Windows host (spawn UNKNOWN). No physical-device keyboard, assistive-technology certification or new Core Web Vitals result is claimed.

## Small-missile burnup, fitting fans and crystal spacing (approved follow-up)

Player-fired missiles carrying fewer than 12 gems are knocked out when an unimpacted flight expires or slows to a stop, even if they miss everything. They still get the full flight opportunity to hit a target. Remaining growth spills once; they return after the normal two seconds with spawn protection. The warm burst respects reduced motion, and the knockout screen explains “Burned up in flight.” Larger missed shots land with the established shield. Turbine throws and already-spent surviving impact flights keep their separate landing rules. This is an initial tuning threshold, not a user-selected exact number.

Fans are a small-player comeback route. Their visible intake throat and outlet are 54 world units wide, shared with the server gate. A creature must fit at its current width to pass and become a turbine projectile (currently up to 12 gems at rounded size 53; 13 gems rounds to 55 and is too wide). Oversized bodies remain outside the solid housing, even at its exact center. Their intake pull caps below walking speed so they can leave. Intake gem stripping still works; if a creature eventually becomes small enough, it can then fit. The normal small turbine throw survives a miss; the new player-cannon burnup rule does not apply to it.

Desktop Mouse control has a labeled keyboard-operable switch in the toolbar, default On. Off immediately clears cursor steering and retains WASD/arrows. The setting persists on the device; touch movement/aiming remains unchanged. The switch occupies reserved space in the initial page shell and has fixed width so initialization and On/Off text do not shift the header. Keyboard activation cannot also trigger inhale.

Background field target stays 950. Replenishment uses spatial buckets and prefers 72-unit spacing, with a bounded best-candidate fallback. A four-times-per-second spatial pass gives only settled, grounded gems small separating impulses within 44 units; it does not teleport them, change value/ownership/expiry or interrupt airborne/falling paths. It is disabled during experimental floor shifts. Combat spills use at most 24 separate crystals instead of 40 while preserving all spilled value. Fan gem exhaust spread widens from ±0.08 to ±0.3 radians. These changes address visual piles rather than silently changing crystal growth value. Small-to-large stealing received the later size-based combat pass above.
