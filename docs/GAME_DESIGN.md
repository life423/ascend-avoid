# Ascend Avoid

## October 31 release authorization

The user approved committing, merging to main and deploying the defense/contact/
spawn changes and five-lesson tutorial remodel after local review, including the
desktop tutorial Mouse On/Off switch. The release starts from deployed main
`939a97a` on `codex/wrap-wave-shell-spawns`. GitHub's pull request and production
workflow identify the final published revision and rollout status. The local
implementation notes below describe the reviewed batch; physical-device and
uncoached human review remain follow-up work. Damage/loading trials remain off.

## October 31 five-lesson tutorial remodel — local

The approved [tutorial remodel](PRACTICE_TUTORIAL.md) is implemented locally on
`codex/wrap-wave-shell-spawns`: move/grow/capture; aim/hit/finish; escape/recover;
black-hole shot; and weapon building. It teaches actual shared rear-wall
interruption and injury recovery, with Ready before timed threats and immediate
checkpoint retries. The full sequence carries real ammunition into combat;
individual lessons stay unlocked. Revision-aware saved progress preserves old
achievements without granting new mastery. Desktop practice includes the shared
Mouse On/Off switch beside Sound. The implementation is not merged or deployed;
physical-device and uncoached human review remain. The separate damage/loading
trials stay off.

## October 31 defense, contact and spawn follow-up — local

The approved [escape-wave and shell follow-up](DEFENSE_CONTACT_RESPAWN.md) is
implemented on `codex/wrap-wave-shell-spawns`: a front-origin puff wraps into
fixed rear cover, vulnerable bodies split into plates with worried eyes,
respawns require clearance and two exits, and ordinary contact squishes/slides
without bump stun or shove. The duplicate arena surge banner is removed while
its world marker and side activity remain. Bots and humans share the rules.
This batch is not deployed; the separate 33% damage/loading trial stays off.

## October 30 integration and release authorization

The user approved committing, merging and pushing the completed movement and research work to `main`. This batch starts from `1873710` (PR #59) and includes the shared quarter-power walking curve, current-size rotation limits, gradual body suction resistance, and reproducible damage/loading studies. Both `CANNON.PEER_HIT_SHARE` and `CANNON.CAPTURE_FIRE_DELAY_MS` remain **0** in normal games. The 33% damage plus one-second delay is a future playable-trial candidate requiring contextual readiness feedback; this merge does not activate it. GitHub's pull request and main deployment workflow identify the final published revision. The study sections below record the measurements and provisional human-feel limits, rather than claiming ideal balance.

## Shared capture-to-fire timing — October 30 local study

The user requested short delays with 33% damage and identical rules for bots/players, then clarified that **total knockouts are fun and should be preserved**. The default-off server gate now enforces the same minimum for both. [CAPTURE_FIRE_DELAY_STUDY.md](CAPTURE_FIRE_DELAY_STUDY.md) records 21,870 conditional fight runs, twelve staged population runs and six human-message network cases. One second is the next playtest candidate: population total KOs remain 260 and non-flight KOs 157, matching no delay. A lower death count is not the balance objective. The candidate still needs understandable contextual readiness feedback and human/touch feel testing before enabling it. Both experimental defaults remain zero; this study is not deployed. Actual injury remains seven seconds; the prior damage-study prose describing five seconds was incorrect.

## Peer missile damage — October 30 headless study

The user requested testing about 33% equal-width missile damage with the new walking, rotation and suction, across sizes/distances and actual ammo acquisition. [PEER_DAMAGE_STUDY.md](PEER_DAMAGE_STUDY.md) records 7,668 fight executions, 405 ammo attempts, capture-growth cases and three staged population comparisons. The candidate uses physical shooter/target width to scale loss and preserves the 20%-wider finish. Close earned reloads can finish a retreating peer in 1.83 seconds. The later timing study above interprets that observation alongside the user's positive knockout objective; it is not automatically a failure. The damage candidate remains disabled in normal games (`PEER_HIT_SHARE=0`) and is not deployed.

## Size-dependent rotation and suction — October 30 local follow-up

The user clarified that larger creatures should rotate more slowly, near-sized opponents should resist suction, and smaller players should use speed to avoid the strong zone while remaining vulnerable once caught there. Existing size-dependent turn rates are retained, with a fix preventing old faster spin from bypassing the current limit after growth or starting an inhale. The old full inner-pull jump at 1.3× width is removed: body resistance and the inner boost now rise smoothly with relative physical size, reaching full strength at 2× width. Healthy capture eligibility remains 1.3×. [SIZE_SUCTION.md](SIZE_SUCTION.md) records parameters, speed/position interactions, shared actor rules and before/after tests. This is a local trial; the later 33% experiment above remains disabled, and nothing in this follow-up is deployed.

## Smooth size-based movement — October 30 local trial

The user requested a smooth walking curve with distinct maximum speeds for distinct physical widths, so shrinking can help escape. The local trial replaces the old 130-unit/s plateau with a quarter-power curve: newborns retain 320 units/s, half-width prey gain about 19% speed, and the largest normal-world bodies retain about 114 units/s. Client prediction, server walking, bots and humans share the rule. [SIZE_SPEED.md](SIZE_SPEED.md) records exact values, before/after encounters, population results and limitations. It supersedes the older square-root/floor movement instruction. The user's stronger size-based peer-hit damage discussion remains separate; this trial does not implement the proposed 33% loss or claim that capture/reload balance is finished. It is not deployed.

## Mobile aim and finishing camera — October 30 release batch

Following the live mobile tutorial review, a loaded player-fired captive now retains its deliberately chosen right-thumb aim between lifting and tapping FIRE, including while walking. A new aim gesture replaces it; a different captive, knockout, lesson reset or control reset clears it. Movement-only aiming remains available before a right-thumb aim is chosen. The finishing step now fits the learner and injured rival together, as the black-hole shot already does, while keeping the view inside the map. The user requested these two fixes and mobile tutorial retesting. The user approved committing, merging and deploying this batch after reviewing the local preview. It starts from deployed `9ebec92`; GitHub’s PR and production workflow identify the published revision. See [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md#local-aim-and-camera-fixes-after-mobile-review) for verification. Other teaching/feedback proposals from the review remain pending.

## Tutorial and menu follow-up — October 30 release batch

The user requested an actual capture before the black-hole tutorial shot, a longer firing distance, and clearly visible gems returning to the shooter. The lesson now has capture and shoot checkpoints, a 520-unit shot instead of 260, and holds the scene while the visual reward returns. Retries preserve the completed capture; growth and final reward use the shared rules and are credited once. Tutorials lead the menu, settings follow immediately, and mobile sound stays in the drawer per the user's correction. The labeled Menu button is separated from the minimap, and the player count is removed from the arena HUD following the user’s preview feedback. Desktop also exposes sound beside its existing controls. See [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md). The user approved committing, merging and deploying this batch on October 30. It starts from deployed main `ae6c935` (PR #56); GitHub’s pull request and production workflow record the published revision.

## Standard living bullets — October 29 release batch

The user approved a fixed **60-unit player-missile diameter**. Capturing a healthy player wider than that immediately transfers all growth above a 60-unit body to the captor. Bullet-sized or smaller captives give no instant growth and receive no free growth. Every fired captive has the same physical/visible flight body; survivors return to the natural size supported by their remaining growth. This supersedes the old percentage capture transfer and variable projectile bodies. [STANDARD_BULLETS.md](STANDARD_BULLETS.md) records accounting, shared bot/human behavior, lifecycle and verification. The 20%-wider shooter finish remains. The user authorized merge/deployment after review; GitHub's release workflow identifies the published revision.

## Physical-size combat rule — October 29 release batch

The user's latest explicit rule is simple: **a landed player-fired missile shatters its target when the shooter was at least 20% wider at launch.** There is no ammunition-width or impact-speed requirement for this finish. The comparison uses visible body width, never gemstone-count ratios. Existing protection applies, and separate ordinary damage/relative-energy lethality remains for other hits. [The combat study](COMBAT_STUDY.md) records the current rule, real launches and varied-distance fights; the older three-condition candidate is superseded. Stronger ordinary missile damage and brief nonlethal-hit suction recovery are included in this release batch. Simulation outcomes do not settle human fun or dodge fairness.

Smaller-bot decisions now recognize the shared 1.3× healthy capture threshold and escape incoming suction across and away from the mouth. They can still pursue an injured larger opponent. [The bot size study](BOT_SIZE_STUDY.md) records 630 encounters before and after those decision fixes, existing turning rates and remaining close-contact danger. All actors retain shared movement, turning and combat rules.

## Optional practice — October 29 release batch

The user subsequently requested an optional, selectable tutorial, superseding the earlier no-tutorial direction. [Practice tutorial](PRACTICE_TUTORIAL.md) documents the implementation, shared mechanics, success-gated steps, unlocked lessons, full sequence, retries, progress and verification. The user authorized including it in the release after local review.

## Latest agreed combat direction — October 29, 2026

The [combat follow-up](COMBAT_FOLLOW_UP.md) is implemented and verified; the user authorized merge/deployment on October 29 (GitHub PR/workflow records identify the release): injured smaller prey finish only at the mouth; injury blocks inhale/puff while movement and already-held firing remain available; lethal player-cannonball and existing black-hole eliminations directly reward the shooter; shared branching cracks, a cached warm pulse, shatter and spatial reward returns communicate the outcome. Shot-follow and the captive minigame are removed. Healthy captures remain ammunition with the existing one-time share, hold deadline and deliberate firing. Nonlethal cannonball spills remain. The follow-up document records the provisional size/speed threshold, accounting, escape limitations and bot-visibility measurements. Its October 29 rules supersede conflicting historical descriptions below.

## Core loop

The approved experience is the six-stage [lasting-dominance loop](GAME_LOOP.md): start small, become capable, build an advantage, become enormous, maintain a long reign, and eventually fall into another climb. The user explicitly wants giant size to feel almost untouchable and sustainable for hours through good play. The initial size-based missile/theft pass below starts supporting that goal; hours-long survival has not been established by playtesting. GAME_LOOP.md separates this implemented pass from remaining proposals.

Collect gems, grow, steal from injured creatures, capture someone smaller, aim and fire them as a living cannonball, then compete for spilled gems. The captor controls the shot; healthy captives remain held ammunition until firing or automatic ejection. Injured prey finish at the mouth; lethal shot rewards transfer directly. The world is continuous: no lobby or round wait. The background field target is 950 gems, about 25% fewer than the former 1,270; combat spills are additional, within the overall 2,000-object cap. This is a field-density reduction, not a cap of 950 total objects after fights.

## Current local arena polish

Ordinary bodies safely slide around a soft black-hole rim; eligible fired captives can enter the lethal core. Body pull and injury theft from several valid attackers have diminishing returns, approaching 1.6× the strongest connection; solo behavior is unchanged. Owner guidance uses a missing-component icon and three progress sockets; compact views omit floating component names. See [GROUP_ARENA_POLISH.md](GROUP_ARENA_POLISH.md) for provisional constants, measurements and remaining human playtests.

## World and presentation

The finite arena is 4200 × 4200 units. The online canvas covers the entire visible browser viewport on phones, tablets, desktop and ultrawide windows, with no reserved header strip, padding, rounded corners or letterboxing. Desktop controls float over the arena; Focus view hides them without changing canvas size, and keeps mouse control and Help available. Small desktop windows retain the mouse preference in Help. Touch controls and contextual actions respect safe areas. Dynamic browser viewport changes, rotation and keyboard resizing refit the stage. Browser and operating-system chrome remain controlled by the browser.

Every screen's camera view stays inside the arena, including during knockouts and extreme zoom. The creature stays centered in open space; near a boundary the camera stops and the creature can move off-center. This latest full-viewport request supersedes the earlier wide-desktop blue-surround preference. The world does not wrap, and wider screens retain the existing view-aspect limits.

Bots fill the population to 20 and yield places to arriving humans. Crowded bots disengage for 6–8 seconds and head toward less occupied space. At most two bots pursue a given target. Traffic, bombs and floor shifts remain experimental, explicitly enabled in test worlds.

## Movement and growth

Continuous analog walking supports WASD, arrows and a touch stick. Desktop mouse-follow defaults on without holding a mouse button and can be switched off. Directional speed is normalized. The mouth turns toward movement/aim with bounded angular speed and acceleration. Large creatures turn slower, with responsive acceleration.

Following the October 26 playtest feedback that growth was still too quick, physical growth now uses half the original mass per banked gem, after the user found the 0.75 trial still too quick. Growth mass is `0.5 * (40 + 750 * ((1 + (gems - 40) / 600)^0.8 - 1))` above 40 gems, otherwise `0.5 * gems`. The initial reward remains visible (one gem gives width 22.5, 40 gives 66.5, 100 gives 101.5), while later gains cost progressively more. Raw width is `20 * sqrt(1 + growthMass / 2)`. Above 15% of the shorter map side, an exponential taper approaches 30% of that side; half-unit rounding never exceeds that bound. Gem totals and scores remain uncapped. Speed remains `max(130, 320 * (20 / width)^0.3)`; no additional movement sluggishness is introduced. Bots and humans share the same growth, weight and upkeep rules. The first 300 gems have no passive upkeep; above that, the selected rate and its validation are recorded in BALANCE_VALIDATION.md. Upkeep spends only the excess and never knocks a player out by itself.

## Inhale, capture and escape

### Stronger body pull and repeat-capture recovery — local October 26 follow-up

Inhale now tugs healthy and injured players toward the mouth immediately. BODY_PULL is 360 units/s before size/range/aim modifiers (formerly 110), and starts at 65% pressure rather than 25%. The base lock buildup is 650ms rather than 1500ms, still longer for wider inhalers. Distance falls off linearly rather than quadratically. Width-ratio resistance, 3x size cap, unchanged cone/reach, 90%-of-victim-speed ordinary cap and close capture overpower remain. A purposeful sideways velocity can reduce physical pull by up to 50%, preserving an active escape route. Releasing inhale stops body pull. This does not expose healthy gems or change the seven-second injury/rapid-theft rules.

Escaping or surviving a flight now grants four full seconds free from all incoming suction, theft and capture, shown by the existing mint ring. This applies to every attacker and persists through the player's own actions; ordinary projectile/weapon damage still applies. A freed captive is placed outside the captor's entire body with 24 units of clearance before the escape shove. If the facing exit is outside the arena, an open side is selected. Incapacitation, timeout and escape use this clearance; a disconnected captor has no body to clear. Defensive gust code preserves any longer suction deadline with max(), although the existing shield already blocks the parry condition while active; no normal-play shield-truncation exploit is claimed.

Controlled full-world tests move a healthy equal 100-gem target about 35 units in the first 267ms and 136 in one second, with no injury or theft. Deliberate sideways movement covers about 242 units in two seconds while under pressure. These measurements are isolated examples, not human balance guarantees. Capture size ratios, loading, escape sequence lengths, joystick input, captive gem cap and walk/turn speeds remain unchanged. This pass is local; the deployed version remains 66adea2 until a separate release.

Validation: production client/server builds, type and synced-schema checks, fourteen unit suites and eighteen isolated multiplayer scenarios pass. Eight desktop/phone/tablet profiles pass 52 applicable body-pull, clear-release, capture, joystick, Help and touch-aim browser checks; twelve desktop skips apply to touch-only cases. Local prediction follows the healthy target's server displacement. Healthy-pull and shielded-escape phone renderings were inspected. Lint has zero errors and 164 existing warnings; Help remains 129 words. Real-device feel and group combat balance remain playtest follow-ups.

Hold Space or the touch button to inhale. Loose gems remain collectible and healthy creatures can still be pulled and captured. Outside a capture, only injured creatures can lose gems to suction. Draining their final gem knocks them out, credits the final thief and starts the normal two-second protected respawn. Good airflow can form a focused beam; close range, alignment and clean separation determine effectiveness.

### Captive gem transfer — October 26, 2026

While a captive is inside, its captor gradually receives up to 20% of the gems it held at capture, rounded down to whole gems. Transfer is spread evenly across the existing 4.5-second maximum hold, based on elapsed time; it works without continued inhale and for bots and humans alike. The allowance is fixed at capture, so the captor's growth and captive's shrinking cannot increase it. Each gem lost is gained by the captor, with normal growth/shrinkage and visible gold transfer inside the body. Escape or firing ends transfer; automatic release settles only the original hold duration. Incapacitation or disconnection releases the captive without further transfer. It never takes the final gem, causes injury or knockout, or changes the already chosen escape sequence, daze or loading time. Captives with fewer than five gems transfer none because of the rounding-down rule. Losses are not refunded on release.

This checkpoint implemented item 7 of the October 26 brainstorm. The subsequent injury/theft pass below implements items 1 and 3; the current local body-pull follow-up above implements item 4. Part theft and black holes remain separate follow-ups. Movement speed is unchanged; the proposed injury movement slowdown was withdrawn.

Validation: client/server production builds, type checks, synced-schema verification, eleven unit suites and fourteen isolated multiplayer scenarios pass. Across eight Chromium/Firefox/WebKit desktop, phone and tablet profiles, all 24 new transfer cases and 21 existing capture/Help/touch-aim cases pass across the initial and corrected-fixture runs; three desktop skips apply to touch-only cases. The keyboard fixture respects the existing 60ms escape-message debounce and waits for accepted directions. Captor desktop and captive phone renderings were inspected. Help is 129 words. Lint has zero errors and 164 existing warnings. The 20% allowance and 4.5-second transfer duration still require human balance feedback. This is a local implementation, not a production deployment.

## Injury and theft — revised October 26, 2026

Damaging player-missile hits, Pinwheel bolts, Pulsar waves, bombs and traffic hits expose a surviving target's gems for a fixed seven seconds. Neither subsequent damaging hits nor inhaling/stealing extend that active window. Further hits still deal their ordinary damage. A damaging hit at or after expiry starts a new seven-second window. Expiry restores theft protection only, never lost gems or size. Ordinary bumps, gusts, passive decay, loose-gem collection and turbine transport do not cause injury. Injury adds no movement/turn penalty, stun or disabled input. Existing hit-specific stun/skid behavior, spawn protection, escape protection and landing suction shields still apply.

Theft is intentionally dangerous: its reference rate is the greater of 10 gems/second or 30%/second of gems held when the injury began, before the hit's direct loss. That basis stays fixed through shrinking, pickup and later hits in the same window. Clean pressure begins at 80% and smoothly reaches full strength; the old zero-pressure windup and 1–3x contact multiplier no longer govern theft. Range, aim, size resistance, clean airflow, sideways escape and inhale-sharing still apply. Each stolen gem transfers exactly once; batched transfers keep uncapped scores from requiring a per-gem loop. Taking the final gem credits the last thief, knocks out the victim and uses normal protected respawn. Capture, when it intervenes, uses the separate 20%-capped captive transfer above rather than lethal injury drain.

Controlled ideal-contact tests (tracking and repositioning, no capture, escape, upkeep or pickup) remove roughly 24–25% from equal 40/100/1000/10000-gem targets in the first second and finish in 3.7–3.83 seconds. Against a 1000-gem stationary target, a 4/40/250/1000-gem thief finishes in approximately 6.27/5.2/3.97/3.8 seconds; even tiny attackers can finish if given the entire opening. Two/three ideal peer attackers finish in about 1.93/1.33 seconds. These are deliberate, sustained openings, not measured human survival or guaranteed outcomes in normal play. Group diminishing returns remain a separate follow-up; current attackers add their damage normally. Stronger physical pull, weapon-part theft and black holes are not implemented by this pass.

There is no shared allowance or total theft cap per injury. Any attacker can steal, within the established breath, range, airflow and size-ratio rules. The defender can move away, fight back or spend breath on gust. The initial injury pass kept damage and growth unchanged; the later approved size-based combat pass changes missile damage and theft strength as described below. Bots pursue healthy creatures only when they can capture them, rather than farming gems they cannot steal.

Bot movement and mouth decisions share the same capture/theft eligibility, including flight and suction protection. Bots stop inhaling a healed noncapturable target and avoid starting theft chases that cannot reach the remaining injury window. An injured bot slips sideways out of incoming theft rather than trying to rob a healthy attacker back. It may prepare a gust after a 300–650ms reaction, with a 75% response choice and later retries after missed opportunities. It turns using ordinary held-inhale aim, then releases and puffs; facing cannot snap, breath still costs 35%, and cooldown/stun/capture rules still apply. Existing crowd limits, imperfect cannon aim and escape skill are unchanged. This changes bot decisions, not injury duration or damage.

Bot follow-up validation: seven unit suites, 13 isolated multiplayer scenarios, production builds, type/schema checks and lint pass (zero errors, 164 existing warnings). Tests cover shared target eligibility, healed and protected targets, healthy capture, reachable injury windows, sideways escape, delayed/missed gust responses, real-world-loop defense, breath cost, turning and cooldown. A 90-second simulation with 19 bots recorded four captures, two launches, 415-unit mean nearest-neighbor distance and no sampled mutual-inhale pairs. This single simulation is a smoke check, not a before/after balance measurement.

The creature squashes briefly on impact; warm, branching fractures open along its rear shell rim, away from the eyes and puffed cheeks. They close near the end of the injury, with a brief sealing shimmer. Reduced motion keeps the readable fracture shape without the impact squash, ripple or shimmer. This is distinct from dizzy stun effects and the mint suction-protection ring. There is no injury banner, countdown, health bar or new control. Help stays concise and explains injury theft and gust defense.

Validation: all six unit suites and all 13 isolated multiplayer scenarios pass. Browser coverage across seven Chromium/WebKit profiles passed 91 cases with 14 device-specific skips; the final fracture artwork then passed all 21 injury checks. Coverage includes healthy immunity, real-peer drain knockout/credit/protected respawn, automatic healing, movement, reduced motion, keyboard/touch capture and aiming, weapons, gust stun, fans and short Help. Rendered phone, tablet, desktop and landscape injury/healed/knockout states were inspected. Help is 125 source words. Lint has zero errors and 164 existing warnings. Physical-device readability and longer-term growth/knockout balance still need playtesting; this is not a claim of measured perfect balance or full accessibility conformance.

A creature at least 1.3 times wider can capture a smaller one at its mouth. Captives remain alive. After a 600ms daze, they enter a directional escape sequence: three inputs below a 2x captor width advantage, four at 2x, five at 4x or greater. Wrong keyboard inputs reset progress; keyboard edges are transmitted explicitly. Keep the joystick on mobile: a moderate push (40% steering strength) within 60 degrees of the requested arrow counts. Intermediate/wrong joystick angles preserve progress so the thumb can correct. Either returning to neutral or turning at least 30 degrees from the last accepted direction rearms input. Holding a diagonal or tiny jitter cannot repeatedly solve arrows. Captured pointer input is resent every 100ms so holding a direction through the daze still registers afterward. The existing joystick and action controls are retained; no directional buttons replace them.

Loading takes 2.8, 3.1 or 3.4 seconds for those respective sequences. After the 600ms daze, this leaves 2.2, 2.5 or 2.8 usable seconds before the earliest shot. Tapping FIRE early queues a shot for the end of loading. Releasing the original inhale simply stops inhaling. The captor can keep aiming. A hold ends after 4.5 seconds, or sooner when the captive escapes or the captor is incapacitated/leaves. Focus loss clears input and cancels a queued shot.

Bots take 500ms to read after the daze, attempt an input every 450ms, and choose correctly 65% of the time. These values deliberately give the captor a usable shot window.

## Flights and hits

The captor's facing alone determines launch direction. Captive input cannot change the launch angle or steer a player-fired missile, including its bounce. Turbine throws retain their separate steering behavior. Swept collision checks prevent tunneling. A hit spills gems, stuns briefly, and bounces a surviving projectile. Impact events identify the launcher, flier and target. The capture badge sits below the body so faces remain readable.

Current loading is 2.8/3.1/3.4 seconds for three/four/five inputs. Earlier 1.8/2.1/2.4-second tuning still left too little human reaction time after the 600ms daze. Early FIRE still queues, and slow, imperfect bot escape attempts remain unchanged.

## Pulsar Array and shared weapon assembly

The arena now supplies twelve independent three-part sets, two for each of six recipes: Pinwheel (hub/rotor/barrel), Pulsar Array (plasma cell/field coil/emitter), Sentinel Satellite (solar wing/tracker/laser), Ricochet Satellite (mirror/gyro/pulse gun), Ion Sweeper (ion cell/lens/sweep arm), and Comet Battery (fuel pod/chamber/rail). Sets appear across a 4×3 arena grid after five seconds, staggered 150ms, and replenish their same recipe after the existing twenty-second wait. Unfinished parts expire after two minutes.

Touching or inhaling the first part reserves every part of that specific set for the collector. Other players may collect duplicate sets; each player can carry only one unfinished or completed undeployed set, while previously deployed weapons remain independent. Holding at least one part keeps the reservation linked; after losing every part the collector has eighteen seconds to recover it. Knockout/disconnect unlocks unfinished sets immediately. Parts remain physical cargo and gusts knock them loose. Completing three pieces creates a carried assembly, which requires E or Place weapon to deploy.

The first claim sends visible links to the reserved siblings and closes lock markers around them. Local reserved parts are bright, rival locks are dim, and a small directional radar points to the nearest missing piece. The minimap highlights that player's missing parts. Reduced motion omits the claim fan-out and decorative part bobbing but retains locks and guidance. No permanent progress card is added.

Pinwheel and Pulsar retain their existing attacks. Sentinel, Ricochet and Ion move continuously from placement onto a broad ellipse at 35% arena width and 32% height from center, joining over 1.8 seconds and taking 26 seconds per circuit. Each stays active for sixteen seconds. Sentinel locks an aim ray before each 850ms targeted bolt. Ricochet launches rotating bolts every 450ms; each can reflect off two arena walls. Ion rotates a 560-unit beam, warning for 600ms, firing for 500ms and resting for 700ms per cycle; per-target damage cooldown is 900ms. Comet is a stationary battery with slower, larger aimed bolts every 1.5 seconds over twelve seconds. These weapons exclude owner, spawn-protected, captured, flying and dead targets. Bolts and beams injure and spill gems, can finish weakened players, and use normal credit/respawn rules. Damage remains provisional for human playtesting.

After placement the Array charges for 1.2 seconds. Each pulse has a 700ms inward-charging warning. Four plasma waves launch 2.2 seconds apart over an 8.3-second active lifetime, expanding from radius 44 to 404 over 900ms. The faint outer boundary previews their reach. Each wave hits a rival once, spending 25% of their gems (rounded up, minimum six, never more than they have). Below eight gems after damage means knockout and normal respawn. All lost gems spill with the usual pickup lock. Survivors get a mass-scaled shove with base distance 420 and a 220-unit floor, twice the earlier Drum tuning. The wave does not stun. Builder attribution, impact flash/sound and knockout feedback identify the hit. The owner, spawn-protected, captured, flying and dead players are excluded. Swept wave checks cover crossing players and the final segment. Disconnect removes the deployed weapon.

There is no persistent weapon banner, progress pill, waiting countdown or duplicate completed-weapon label on any screen. Minimap markers and physical carried parts provide continuous state. A local pickup or completed assembly gets one coalesced notice that expires after 3.5 seconds; other players' collection does not show it. The contextual Place weapon button appears only while carrying a complete weapon. Help contains the instructions. Starter tips close automatically after four seconds and can be replayed from Help.

## Defensive gust

Each gust spends 35 percentage points of the full breath meter, after elapsed recharge. At least 35% breath is required; declined gusts spend neither breath nor cooldown. The server acknowledges remaining breath so desktop and phone meters show the cost.

Tap with an empty mouth to puff in a 110-degree cone. Knockback scales gently by mass: base shove 400 units, capped at 500. A successful puff into an incoming inhale creates at least 200 units of intended separation, clears that suction connection, and protects its user from suction for one second. The puff cooldown is 1.8 seconds. Protection ends when a creature inhales, puffs or fires.

A gust hit stuns its target for 800ms: no steering or inhaling, while knockback still carries it away. Spiral pupils, a slight wobble and orbiting sparks show the stun. Existing 1.2-second immunity after a stun prevents repeated extensions. Spawn protection still blocks gust hits.

A surviving flight ends with four seconds of protection from incoming suction, inhale drain and recapture by any player or turbine. This applies after an impact, hitting the arena edge or simply landing, and starts after the flight finishes so the full window is usable. Escape/release uses the same four-second duration. Knocked-out missiles instead use normal respawn protection. The creature can move and act; a draining mint ring shows the window. Normal collision damage still applies.

## Impact and collision tuning

Target missile damage now follows pre-impact projectile mass relative to target mass, with a bounded speed modifier; the old 75–85% loss floor is removed. A target left below 12 gems is knocked out and respawns protected at newborn size. The missile separately retains about 10% of its former width after hitting another player or an arena edge. If its retained growth rounds down to zero gems, it is knocked out too; a larger survivor receives the post-flight suction shield. Spent mass spills as gems, and a bounce cannot charge it twice. Large unimpacted misses land without consuming growth; very small player-cannon misses follow the burnup rule below. The two-second respawn and 1.5-second spawn protection remain.

### Size-based combat — approved October 25, 2026

The user approved starting with missile damage and theft so getting huge feels worthwhile while small players can fight back. Current tuning uses physical body mass, `2 * (width / 20)^2`, for both projectile and target, before the projectile's own impact shrink. This remains consistent after later physical growth tapers. Following the October 26 feedback about overly forgiving midgame combat, let `r` be projectile mass / target mass and `v = clamp(speed / 1250, 0.65, 1.15)`. Damage in gems is `round(min(0.85 * targetGems, (targetGems * 0.85 * r / (r + 2.4) + 80 * r / (r + 1)) * v))`. The bounded energy term makes substantial ammunition decisive against small/midgame targets while its contribution fades for tiny ammunition against giants. Positive hits remove at least one gem, rounded to an integer and bounded by available gems. This applies to player-cannon and fan projectiles; fan fit, flight opportunity, stun, credit, spill value, landing protection and missile-player shrink/burnup rules remain intact. Captor size influences launch speed through its existing bounded rule, not the projectile mass used for damage.

Historical first-pass measurements, before the later physical growth curve, removed 6/16/103/249/473 gems from a 1000-gem target with 4/20/250/1000/4000-gem projectiles at 1250 units/s. Those numbers describe the earlier release, not current tuning. These are formula measurements, not guaranteed battle outcomes or lethal thresholds. Larger ammunition can still eliminate a smaller or weakened target. A tiny fan launch remains a way to cause damage and open the five-second injury window without stripping most of a giant's progress.

Theft reaches full size strength at 85% of the victim's width (about 72% of body mass), up from 35% width. Smooth interpolation from the existing 8% minimum at 10% width preserves some theft even for tiny players. Clean sustained contact ramps 1x/1.25x/1.6x/2x/2.5x/3x at 0/0.4/0.8/1.2/1.6/2 seconds; it formerly reached 8x. The same strength is used for actual transfer and opposing-inhale clashes. There is no shared theft allowance, per-injury cap or guaranteed surviving gem. Healing still occurs five seconds after the latest damaging hit, and theft cannot refresh it. Gust, movement, breath and existing shields remain counterplay.

The historical first-pass isolated five-second contact test with a stationary 1000-gem victim, ideal tracking and no escape or spill pickup recorded 8/15/71/106 gems stolen by attackers starting at 4/40/250/1000 gems, versus the former 56/245/267/265. Two tiny four-gem thieves take 16 together instead of 120. Attackers grow and the victim shrinks throughout these tests. A swept 20-gem impact followed by two perfectly tracking tiny thieves preserves at least 95% of the giant's starting gems, while both thieves gain. These controlled checks verify the intended size relationship; they do not establish long-term balance or hours of survival.

Crystal growth, movement, damage from deployed weapons and passive decay were unchanged in that first missile/theft pass; the subsequent parity/growth pass below supersedes growth and bot upkeep. Repeated Pulsar hits and sustaining giant size under passive decay remain follow-ups, so the overall lasting-dominance goal is not marked complete. Help briefly explains that bigger ammunition hits harder; no pinned UI or new controls are added.

Validation: eight unit suites, 13 isolated multiplayer scenarios, type/schema checks, production builds and lint pass (zero errors, 164 existing warnings). Controlled tests exercise monotonic size/speed response, tiny and near-peer damage, actual swept impacts, combined missile/two-thief pressure, five-second healing, value conservation, lethal large ammunition, protected respawn and actual fitting fan launches. The network test waits for authoritative injury rather than mistaking passive decay for a hit. Seven Chromium/WebKit desktop/phone/tablet profiles passed 63 applicable browser cases across the release and fixture-correction runs, including capture/escape, burnup, fans, healthy immunity, theft knockout, healing, reduced motion and a real small shot into a giant. The final new shot test passed all seven profiles after opening Help through the visible desktop/mobile controls. Rendered giant-hit phone, tablet and desktop scenes were inspected; eyes remain unobscured, the creature retains size and the canvas shows no exterior/gaps. Physical devices, assistive technology, production performance and long-term leader survival remain unmeasured.

Forceful new body contact (closing speed at least 120 units/s) staggers both players for 220ms and gives a mass-scaled separating shove. The pair must separate by 18 units before rearming; existing stun immunity prevents repeated stun chains. Tangential contact grip is reduced from 80% to 15% so players can slide out of crowds. Spawn-protected, flying, captured, already stunned or skidding players do not trigger a fresh bump.

## Pinwheel Cannon prototype

One hub, rotor and barrel appear near the arena center after five seconds. Touch or inhale a part to collect it; cargo stays attached behind the creature when it releases inhale, moves or turns. Touching does not bypass another player's part claim. A meaningful pickup starts an 18-second claim for the build. Adding a new required component refreshes it; holding the same component does not. If a rival supplies the final piece, the active builder keeps ownership. Abandonment unlocks the parts when the claim expires. Gusts physically disrupt even claimed parts.

Carry all three or bring them within 72 world units to assemble. The complete weapon remains carried until its builder taps Place weapon (or presses E), allowing relocation before activation. It never auto-places on a timer. If its carrier is captured, knocked out or launched, it drops and begins charging. After placement, it spins up for 1.2 seconds, then rotates and fires a gem bolt every 140ms for eight seconds. Straight bullets form outward spiral patterns. Each bolt ignores the builder and spawn-protected/flying/captured creatures; mass-sensitive damage can knock out targets below eight remaining gems. A 500ms per-target hit cooldown prevents rapid repeated hits. Bolts expire within 900 units. See the follow-up tuning below for the exact damage formula. Parts expire after 120 seconds if unfinished; the next set arrives 20 seconds after a build expires or finishes. Assembly stops when the builder disconnects. The prototype is disabled with experimental arena shifts. Bots can collect, claim, carry, place and use either recipe through the same rules as humans. Their controller chooses a placement spot after a 900ms read and attempts placement within four seconds; this decision deadline does not auto-place human cargo. Existing claim, incapacitation and deployment gates apply to everyone.

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

Escaping or being released now grants four seconds of protection against incoming suction, inhale drain and recapture by any player, and starts outside the captor body. The existing mint ring shows the duration without adding text. Landing survivors also get four seconds. This local follow-up supersedes the historical two/three-second recovery. Loading and human escape windows are unchanged.

Bot cannon aim reads no sooner than 250ms, samples every 450ms during loading, and commits when loading completes. Observed aim has a signed 0.12–0.24 radian error. A bot waits another 400–650ms after loading before firing; it cannot track a last-moment dodge perfectly. Captured bots retain their slow, imperfect direction-puzzle behavior.

The Pinwheel now fires every 140ms for eight seconds, rotating at the established speed. Straight bullets launched at successive angles form outward spiral patterns; range is 900 world units. Bolt damage is the smaller of 30% of the target's gems and max(8, ceil(1.6 × sqrt(gems))), never more than the target owns. Below eight remaining gems means knockout and normal protected respawn. This removes the former six-gem cap and guaranteed last-gem survival while giving giants more staying power. Existing owner/spawn/capture/flight exclusions and 500ms per-target hit cooldown remain. Hit/knockout effects credit the builder. Pulsar waves also finish players below eight remaining gems, retaining their existing 25% loss/minimum-six damage and warning.

Desktop mouse-follow needs no held button. WASD/arrows take over until the mouse moves again. Leaving the canvas, text entry, Help and focus loss stop pointer movement. Touch retains the left movement stick and uses dragging the existing right action control for independent aim; its directional cue exists only during drag. Aiming a loaded cannon does not fire it on hold: release, then tap to fire. E and the contextual Place button are unchanged.

New spawns and respawns use an interior margin based on the centered newborn view's maximum supported aspect ratio, plus 120 world units. Traffic/player/leader clearance checks still choose the safest candidate. Respawn resets camera zoom so a previous giant's zoom does not expose exterior. Desktop boundary behavior during deliberate travel is unchanged. This addresses edge-heavy starts without wrapping the map or painting playable decoration beyond it.

Help text is reduced from 519 to no more than 129 words, with keyboard focus containment, an accessible dialog and 44px close target. Gem-surge HUD notices disappear after three seconds for each new warning/active/jackpot state; the minimap and world event continue for their original durations. No permanent weapon panel returns.

Unused whole-swallow/digestion/expel behavior, vanish visuals, unused physics helpers/tests and the obsolete escape measurement script are removed. Three inert schema slots retain field ordering for older clients; these compatibility slots have no gameplay or visual behavior.

The later approved parity/growth pass below supersedes the original growth and bot-upkeep rules. Further leader durability and black holes remain follow-ups in docs/TODO.md. The later approved size-based combat pass above adjusts the existing small-to-large theft multiplier and sustained-contact ramp after baseline measurement, rather than adding a second overlapping penalty.
Compact capture UI keeps the existing creature badge and action button and omits the duplicate loading footer. Escape prompts sit above the thumb-control region. Capturing a peer resets the client's sent-aim cache so an unchanged right-thumb aim is resent after the server ends the inhale.

## Full-viewport arena follow-up

The brief starter tip yields while Place weapon is available, keeping the creature and placement scene clear. This final visual correction passed placement checks in both phone browser engines.

The canvas covers the visible browser viewport on every screen. ResizeObserver and coalesced window/visualViewport events refit it without repeated bitmap clears; fractional CSS sizes use a covering integer backing size. Desktop controls float above the map, and Focus view leaves mouse control and Help reachable without changing the canvas. Inactive controls are inert/hidden; a closed menu stays visually hidden across breakpoint changes. Phone score, minimap/player count, thumb controls and contextual placement respect safe areas. Short landscape escape prompts move above the creature; the captive does not also see the redundant captor loading badge. There are no new permanent weapon messages. Safe-area and simulated keyboard/toolbar viewport changes have browser coverage.

Client/server production builds, types, schema and all five unit suites pass. Seven Chromium/WebKit device profiles exercised sizes from 320×568 through 5120×1080 and 1440×2560, corners, growth, knockout/respawn, rotation, capture/escape, independent aiming, menus, focus, mouse preference and weapon placement. The final affected-area matrix covered 72 applicable cases (five device-specific skips) across the release run and corrective checks, plus two final toolbar/menu layering checks. WebKit's unsupported viewport-key warning was removed; two weapon tests now recognize the same narrow, known caught Colyseus socket probe as the existing loading test. Fixed-delay movement/cargo checks now await settling without loosening their limits. Two local page-load checks overlapped a rebuild and passed against the fixed build. Lint has zero errors and 164 pre-existing warnings. Firefox could not launch on this Windows host (spawn UNKNOWN). No physical-device keyboard, assistive-technology certification or new Core Web Vitals result is claimed.

## Small-missile burnup, fitting fans and crystal spacing (approved follow-up)

Player-fired missiles carrying fewer than 12 gems are knocked out when an unimpacted flight expires or slows to a stop, even if they miss everything. They still get the full flight opportunity to hit a target. Remaining growth spills once; they return after the normal two seconds with spawn protection. The warm burst respects reduced motion, and the knockout screen explains “Burned up in flight.” Larger missed shots land with the established shield. Turbine throws and already-spent surviving impact flights keep their separate landing rules. This is an initial tuning threshold, not a user-selected exact number.

Fans are a small-player comeback route. Their visible intake throat and outlet are 54 world units wide, shared with the server gate. A creature must fit at its current width to pass and become a turbine projectile (with the current growth curve, 25 gems rounds to 54 and fits; 26 rounds to 55 and is too wide). Oversized bodies remain outside the solid housing, even at its exact center. Their intake pull caps below walking speed so they can leave. Intake gem stripping still works; if a creature eventually becomes small enough, it can then fit. The normal small turbine throw survives a miss; the new player-cannon burnup rule does not apply to it.

Desktop Mouse control has a labeled keyboard-operable switch in the toolbar, default On. Off immediately clears cursor steering and retains WASD/arrows. The setting persists on the device; touch movement/aiming remains unchanged. The switch occupies reserved space in the initial page shell and has fixed width so initialization and On/Off text do not shift the header. Keyboard activation cannot also trigger inhale.

Background field target stays 950. Replenishment uses spatial buckets and prefers 72-unit spacing, with a bounded best-candidate fallback. A four-times-per-second spatial pass gives only settled, grounded gems small separating impulses within 44 units; it does not teleport them, change value/ownership/expiry or interrupt airborne/falling paths. It is disabled during experimental floor shifts. Combat spills use at most 24 separate crystals instead of 40 while preserving all spilled value. Fan gem exhaust spread widens from ±0.08 to ±0.3 radians. These changes address visual piles rather than silently changing crystal growth value. Small-to-large stealing received the later size-based combat pass above.

## Equal rules, bounded growth and rare-giant follow-up — October 25

The user rejected weaker bots and approved fixing runaway growth in the same pass. The latest loop calls for rare, durable giants, a rewarding opening and meaningful small/medium fights. The initial target is two or three enormous creatures in a 20-player arena, never a hard quota. Current measurements and remaining limitations are recorded in BALANCE_VALIDATION.md.

Bots no longer have a 20-gem upkeep threshold, 2% excess decay per second, a 30-gem gathering stop or a weapon-pickup ban. Role changes cannot change growth, upkeep, movement, turning, breath, damage, capture/escape timing, shields, claims or weapon access. Fallible observation, escape choices and imperfect committed aim remain AI decisions. Bots favor worthwhile captives and shots their ammunition can threaten rather than spending every tiny round on the largest score.

Field replenishment keeps the 950 target, but excludes padded live pickup boxes, including AABB corners. Up to 64 candidate positions are tried for each spawn. If no valid position exists it waits, rather than spawning under a body. Existing crystals remain collectible; score is uncapped. This removes a stationary collection/replenishment feedback loop which produced bodies wider than the arena.

Both roles use the same progressive physical growth above. Camera framing responds immediately enough to keep a sudden valuable pickup from filling the screen while normal zoom easing catches up. Extreme scores use compact visible numbers with exact values in DOM titles/accessibility labels. Large pickup/theft amounts coalesce instead of queueing one animation per gem. No persistent status card, milestone banner or new control is added.

The missile player still spends approximately 90% of physical width on impact: retained physical mass is converted back through the growth curve. The percentage component at equal physical mass is 25%; the later bounded energy addition makes small/midgame hits more decisive. Much smaller shots still chip giants. Injury-only theft remains five seconds, without a quota, with the 0.85 relative-width strength threshold and 3x contact ramp. A current isolated five-second contact test steals 9/18/76/107 gems from an initial 1000-gem stationary victim for attackers starting at 4/40/250/1000 gems, with ideal tracking and no pickup or escape.

The current branch keeps gentle shared upkeep at 0.1% of gems above 300 per second. This retains the former human rate and removes the bot-only 2% rate; there is no role-dependent tax. The first 300 have no upkeep, and passive shedding cannot itself knock a creature out. At 1000/5000 gems, initial upkeep is about 42/282 gems per minute. Sustaining a large lead requires gathering and valuable combat opportunities, not inactivity. This tuning is an initial measured choice; validate that defending a giant remains enjoyable in human matches.

A pure logarithmic growth trial was rejected: it compressed established rivals into nearly equal bodies and weakened the reward for a substantial lead. The selected sublinear power curve keeps the early reward, progressively increases cost, and preserves a meaningful capture advantage for a 5000-gem creature over a 2000-gem rival. The later map-relative body taper still prevents runaway dimensions. Do not declare rarity achieved from a single absolute-width threshold or short-run average.

### Historical October 25 sleep checkpoint — superseded by October 26 validation

At the user's request, work stopped before merging. The latest trial bounds background replenishment to 30 crystals per second for the entire arena, with at most one second of stored refill credit. A fresh world still starts with 950; combat spills are not charged to this budget. This addresses supply increasing without bound as collection accelerates, while keeping gentle shared upkeep. Safe spawn positions still exclude live pickup boxes. Long-run tests of this final economy trial were interrupted for the stopping point; rarity, sustainable reigns and fun are not validated. See BALANCE_VALIDATION.md for the checkpoint and restart procedure.

## October 26 playtest revision: danger during the climb

The user tried the 3190 preview and reported growth was still too fast and that too few players die on the way to becoming huge. Their protection hypothesis was investigated: escape/landing shields block suction rather than ordinary projectile damage, and the 1.2-second impact grace is shorter than capture loading. The trial therefore keeps spawn/escape/landing protection, gust, the 600ms daze, 2.8/3.1/3.4-second loading and normal respawn unchanged.

That first trial reduced physical growth mass per gem to 0.75, added the bounded missile energy term above, and gives a damaging hit a three-second contest window before its victim can reclaim its own spill (formerly 1.5 seconds). A player-fired missile waits six seconds for its own spent-mass spill, so landing suction protection cannot immediately undo the approved 90% width cost. Other players can still collect after the ordinary 350ms spill delay; all value and finite expiry are preserved. Fan-spent spills use the ordinary three-second owner delay.

At reference speed and without recovery, substantial 40/100/300-gem ammunition can finish respective initially equal targets in one/two/three hits; actual swept follow-up tests cover the two/three-hit cases, credit/value conservation and normal respawn. These are attack opportunities, not guaranteed deaths: movement, aim, gust and escaping before firing remain counterplay. Tiny shots plus theft still preserve at least 95% of a 1000-gem target in the controlled regression.

Minimap dots formerly reached their eight-pixel maximum at about 100 gems, exaggerating how many giants were present. They now scale across the full physical body range, from a small marker toward the same eight-pixel maximum. No new controls or pinned explanations were added. The 3192 preview contains that first combat trial; the latest growth-only preview is http://localhost:3194/?playtest=earned-growth. See BALANCE_VALIDATION.md for current checks, mixed long-run findings and remaining human-playtest limitations.

## Latest October 26 clarification: keep clever play consequential

The user explicitly corrected a misclicked “too punishing” answer. Their actual feedback is that growth remains too quick; risk is appropriate when a player does not act smartly, and cleverness is part of the game. Do not ease damage, shields, spill recovery or firing/loading in response to that accidental answer. The next revision changes only GROWTH_MASS_PER_GEM from 0.75 to 0.5, one-third less growth mass than the 3192 preview, with identical score/value and all the established combat settings. Test fixtures now use body-relative alignment and actual movement toward weapon components rather than assuming the old body size/reach. No weapon range or combat buff was added. See BALANCE_VALIDATION.md and PR #45 for exact evidence and rollout status.


## Mobile action label layout (local follow-up)

INHALE and its PUFF helper are measured as one vertically centered block with an eight-pixel gap. Each line is centered by its actual ink bounds and scales down to fit the circular control. Cooldown, insufficient-breath, loading, queued, fire and spit states use the same centering. The joystick remains unchanged.


## Current follow-up after release 68e1674

The user requires cross-browser/device support, including Android Firefox. Cache the background glow sprites instead of per-star live blur, include all three browser engines and touch phone/landscape/tablet layouts in the required CI gate, and keep real-device claims separate from viewport emulation. Fix the mobile drawer's global touchmove cancellation and place weapons on a second finger's press while the joystick remains held. Keep Pinwheel and Pulsar as central, recognizable recipes in addition to satellites; strengthen Pinwheel bullets about 50% while retaining other damage values.

For every assembled-weapon hit, actual lost gems transfer once to its assembler and increment session damage/knockout totals. Rewarded gems do not also spill. A deployed weapon's owner remains credited across distance and knockout; gems earned during the respawn wait are paid at the next protected spawn. The drawer contains the weapon record and recent activity, keeping mobile play clear of surge bars, event feeds and hit banners. Rival-reserved parts use a muted icon, coral-red ring and red X badge; collector-reserved parts use a bright mint ring/checkmark. Do not add status words.


## Current capture redesign (supersedes all older escape/loading/drain descriptions)

Capture eligibility still uses the existing 1.3× physical width rule. Before any transfer, snapshot injury eligibility and the width ratio. `captureHoldMs` interpolates smoothly through provisional 5,000ms at 1.3×, 8,000ms at 2× and 12,000ms at 4×, capped there. The server fixes the deadline once. Transferred growth never extends a hold or invalidates an already-captured state.

The latest approved [standard bullet](STANDARD_BULLETS.md) rule replaces the earlier percentage-share experiment: transfer all captured growth above a 60-unit body immediately, and transfer nothing for bullet-sized or smaller captives. Identical value is subtracted and credited once. There is no later captive drain.

Arrow escape, capture daze, gun loading and queued fire are removed. The action that initiated capture cannot fire the captive: release first, then make a fresh tap/hold through the existing Space/right control. This release guard is independent of firing readiness; no timer delays a deliberate shot. Captor input alone sets aim; captive input cannot turn the captor or a player-fired projectile. Bots release and make a fallible firing decision through the same mechanical rule.

The local captive sees a magnified translucent belly lens while the arena remains visible around it. Existing joystick/WASD/arrows move an independent normalized interior avatar at 0.75 radii/s. Six fixed bonus-gem locations do not respawn inside a capture. Collection sets authoritative bits and increments a pending bank up to the proposed **six-gem cap**. Neither pending gems nor interior position affect growth, physical mass, shot damage, aim, duration, escape or physical nudges. No extra button is added. Collection/view stop as soon as capture ends.

Pending bonuses pay once on automatic protected ejection or after a surviving flight ends and the player is alive in ordinary arena play. They are discarded on death, respawn and disconnect; reconnecting creates a new session without the old bank. Timeout ejection retains the four-second suction/recapture recovery and is never a finisher. Injury-at-capture remains the sole lethal-shot snapshot: a fired injured captive dies on impact, boundary contact or flight completion, regardless of timer expiry or pending bonuses. Healthy flight and projectile damage retain their existing rules.

All timing, transfer and bonus values above are provisional playtest settings. Automated conservation, lifecycle, routing and collision checks do not validate human balance. This feature is integrated into the normal local game; no opt-in or separate prototype is used. The subsequent release request authorizes merging to main and deploying through the established pipeline.

## Current puff and shot-follow integration

Defensive puff uses `bodyMass(width)`, with per-target impulse based on reduced mass × 560 × existing range falloff. Added target speed is capped at 560 units/s. The entire puff shares an impulse budget of shooter's physical mass × 420, distributed proportionally among valid hits; opposite summed recoil is capped at 420 units/s. Equal masses at the mouth receive about 280 units/s in opposite directions. Ordinary drag and collision handling apply afterward. Existing cost, cone, cooldown, stun, eligibility and brief suction break remain; an empty puff produces no recoil. These are conservative initial playtest constants.

A successful player-cannonball or owned Comet Battery hit offers shot-follow for 1,200ms at a fixed impact point. Already-held inhale remains ordinary; release and press again to engage. Active follow consumes normal inhale, preventing tether theft/capture; releasing stops it. Follow accelerates at 900 units/s² up to 360 units/s for at most 1,600ms and 480 units of travel, stopping at max(40, body radius + 16) units from the destination. The world boundary and swept obstacle checks apply. Repeated hits cannot stack, retarget or extend an existing opportunity. A gold offered cue becomes a mint airflow wake during the active pull. Same mechanical rules for humans/bots; values need human playtesting.


## Player-fired captive power and vulnerability counterplay

Only `fireCaptive` sets `shotMassBonus`, after the one-time capture transfer and using physical widths at firing. Proposed tuning: `CANNON.SHOOTER_MASS_WEIGHT = 0.10`, `CANNON.SHOOTER_MASS_CAP = 0.75`. The stored bonus is min(0.10 × sqrt(shooter physical mass × ammunition physical mass), 0.75 × ammunition physical mass). It is independent of later launcher growth, shrinking, death or disconnect. Original launcher ID remains credited even after disconnect.

At impact, preserve the existing CURRENT pre-impact projectile-body mass and add min(stored bonus, current ammunition mass × 0.75) for power calculations. This is an attack-power bonus, not physical body growth: it does not change radius, collision, recoil, projectile mass spent after impact or the existing 90% width-loss rule. Target physical mass remains in the original resistance formula and the existing 85% damage ceiling/rounding and knockout threshold remain. Turbine launches clear the snapshot; comets and assembled weapons retain their own unchanged damage paths. Landing, knockout, respawn and disconnect clear projectile state. The existing size-dependent `launchSpeed` function, drag and stun are unchanged; the new contribution itself adds no speed.

Controlled comparisons (synthetic physical sizes, fixed impact speed 1,250 units/s; target width 200 and score 1,000):

| Shooter width | Ammo width | Damage gems |
| --- | --- | --- |
| 80 | 60 | 42 |
| 200 | 60 | 49 |
| 800 | 60 | 63 |
| 400 | 20 | 8 |
| 400 | 60 | 60 |
| 400 | 160 | 248 |

These comparisons isolate physical mass from speed, which already varies with the launcher's size in normal play. They are not human balance validation. Tiny ammunition remains tiny: its bonus cannot exceed 75% of its own physical mass, regardless of the shooter's score or size.

`INHALE.VULNERABLE_OUTGOING = 0.15` is a prototype multiplier for outgoing player-body pull and outgoing injury gem-drain progress only. Body pull receives it AFTER close-range overpower, distance caps and escape resistance, preventing those paths from overriding it. Drain receives it once after existing geometry, ramp and clash eligibility. The existing clash-winner comparison is retained; no separate multiplier is applied there. Loose-gem suction, cargo theft, bomb pull, breath use, puff, movement and previously held captives are unchanged. Injury does not prevent firing an already-held captive.

The authoritative vulnerability predicate uses the original seven-second injury deadline OR an existing, still-valid incoming continuation. It validates range, aim/airflow, protection, player state and clash eligibility directly, so actor iteration order cannot permit a late counter-catch. The actual close-contact capture path and final capture commit both reject a vulnerable captor. When the original window expires, any interruption revokes continuation immediately and restores ordinary outgoing pull/drain/capture. No extra timer or refreshed injury is created. Respawn/disconnect clear the underlying injury/continuation state.

Weakened airflow is sparse and coral, with a fragmented mouth halo, while its dotted reach remains full length. Gem side streams retain their ordinary visual/mechanical flow. Applying weakness throughout continued theft intentionally makes sustained pressure stronger; this interaction needs human playtesting and may be too oppressive at the provisional 15% setting.


## Shot-only black holes — local October 26 follow-up

Three fixed black holes stand at (1050,1260), (3150,1260) and (2100,3108) in the 4200-square arena. Provisional core radius is 64 world units; the 96-unit broken violet ring, accretion ellipse and cannonball glyph identify a shot destination. A 2500ms opening warning precedes activation. They have distinct ringed minimap symbols, reduced-motion support and culled, bounded canvas paths without live blur/gradient effects.

Only an alive player-fired captive's center entering an active core during flight is lethal. The server sweeps the actual boundary-clamped flight segment and selects the earliest crossed core; a player encountered before it still receives the ordinary cannon impact first. Large ammunition does not enlarge the lethal core. Walking, ordinary suction, puff/skid, shot-follow and turbine flight never activate it. There is no outer gravity or solid rim, leaving giant navigation unchanged. Spawn protection and shift grace are respected; a core over absent shift floor is inactive.

Knockout uses normal gem spills, capture/theft/follow cleanup, pending-belly reward discard, two-second respawn and four-second spawn protection. Credit retains the original shooter through bounces and disconnects. Bots can select holes through their existing delayed, imperfect aim and normal firing path; no bot-only hit assistance is added. Mobile play gets no new central notice or action button. Help explains safe walking versus fired entry.

Capture snapshot correction: an actively continued-theft victim is still injured for the separately agreed finisher. Capture now snapshots that eligibility before clearing theft relationships, including after the base seven-second window. It does not extend the injury timer or change rates.

Growth/combat/capture measurements and unresolved human-balance questions: see BLACK_HOLE_PLAYTEST.md. No changes were made to growth, walking, injury duration/rates, puff constants, shot-follow tuning, cannon damage or existing launch speed/drag.


## Bot aiming before firing — release follow-up

Capture no longer has a loading prerequisite, so the old AI's 400–650ms reaction alone was too abrupt and its missing-target fallback could fire in the existing facing. Bots now observe after 250ms and every 450ms, choose a valid rival or active black-hole core, turn through the ordinary independent loaded-aim control, and require 450ms continuously within the existing 0.18-radian tolerance. Their first firing decision cannot occur before 1400ms from first observing that capture. These are provisional AI timing values, not human control restrictions.

A target keeps one fallible 0.12–0.24-radian aim offset across periodic observations. Lost/dead/captured/flying/protected/out-of-range targets revoke a shot immediately; a replacement requires fresh reaction and alignment. No target means normal repositioning, never a fallback shot. Stun, skid/recovery, capture or forced flight resets the plan. If no shot is established by the original hold deadline, ordinary protected ejection applies. Human immediate firing, hold durations, movement/turn physics, damage, injury, puff and shot-follow tuning are unchanged.

Verification: focused real-server tests cover acquisition, physical turn/alignment, continuous dwell, missing/lost targets, reacquisition, interruptions and timeout. The complete 25 unit suites and 18 multiplayer scenarios pass; 12 capture UI cases pass on desktop Chrome, Android-layout Chrome and iPhone-layout WebKit. The earlier long balance experiments used the faster AI; they remain historical measurements rather than proof of balance with this changed decision policy.


## Large-player assembled-weapon fairness — local follow-up

The user selected weapon fairness as the next fix. `WEAPON_FAIRNESS` bounds the central hit radius at 90 world units; smaller bodies retain their original area. Center-directed bolts/beam intersections retain the original damage. Outer grazes deal 25% without a new injury or skid; previous injury/continuation is unchanged. Forward rays and finite beam reach prevent an overlapped weapon firing away from the center from receiving a full-hit benefit. Pulsar outer-shell contact is cosmetic and damage waits for the central area.

Shared assembled-weapon protection ramps from zero at width 180 to 900ms at width 500, capped thereafter; existing local cooldowns still apply. Blocked hits do not refresh the guard or pay rewards. A broken blue rim indicates the actual window, separate from the mint suction-recovery ring. Player cannonballs, theft, capture, puff and other hazards ignore this weapon-only guard. Death/respawn clears it. Small-body damage, direct-hit profiles, ordinary movement/growth and all unrelated controls/tuning remain unchanged. See WEAPON_FAIRNESS.md and its JSON for before/after measurements and human-playtest limits. This pass is local and has not been merged or deployed.
