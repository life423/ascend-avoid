# Ascend Avoid — ordered work and idea inventory

Updated October 26, 2026. This is the durable list of the user's requests and decisions. Current code and later feedback override historical tuning. The approved injury-only theft change supersedes ordinary healthy-player stealing and the earlier theft-allowance suggestion. The fifteen archived balance options remain proposals unless separately accepted.

## Current delivery status

Release 394a93c (PR #49) is on main and live, adding shot-only black holes after 5bb717e (PR #48)'s capture/combat/mobile changes. The user explicitly deferred Ubuntu browser CI; its retained matrix is disabled while build/gameplay checks remain required. Black-hole release verification passed the production health endpoint, exact Azure image/revision with 100% traffic, the three live synced cores, and ten live browser smoke cases.

Current release follow-up: `fix/bot-aim-before-firing`. The user reported bots capturing then firing immediately without aiming during the release task. Bots now select a valid player/core, observe/turn using ordinary body controls, spend at least 1.4s planning after first seeing the capture, and maintain 450ms of continuous alignment. Target loss cancels the plan; an empty search cannot shoot blindly. Stun/recovery/capture/flight interrupts the plan. Human immediate fire and fixed hold deadlines are unchanged. GitHub pull-request and Actions records identify the published follow-up commit.

## Remaining requests and playtest decisions

1. **Large-player assembled-weapon fairness.** Choose a fix for unavoidable hits, especially Pulsar waves and overlapping weapons. Glancing hits/shared hit protection are discussed options, not selected tuning.
2. **Group inhale pressure.** Assess whether several valid thieves leave enough reaction time, especially with continued vulnerability and the 15% counter-inhale rule. Ideal three-peer contact drains a stationary target in 1.33s. Diminishing returns remain an option, not an approved rule.
3. **Belly-salvage downtime.** An ideal collector finishes six gems in 3.817s; a 12s hold can leave about 8.2s empty. Choose a pacing improvement after trying the activity. Keep the no-escape/no-aim-influence rules unless explicitly revised.
4. **Human growth/combat balance.** Measure opening setbacks, earned growth, rare giants and sustainable reigns in a group match. The hour simulation's longest giant streak was 950s; human fun and hours-long survival remain unvalidated.
5. **Tune the integrated mechanics through play.** Assess fixed 5/8/12s holds, 30% one-time transfer, six pending bonus gems, mass-relative puff, shooter contribution, shot-follow, continued theft, 15% weakened inhale and the three shot-only cores. Automated correctness is complete; values remain provisional. Bot-aim timing now also needs feel feedback.
6. **Weapon assembly and arena clutter.** Confirm collection/guidance/healthy-player part theft, deployment while moving, six-recipe value, classic availability and reduced satellite density in human matches. These mechanics are implemented; this is a playtest follow-up.
7. **Real-device mobile and discoverability review.** Confirm Android Firefox lag is resolved on the user's phone; assess touch aim, joystick, drawer scrolling, placement, capture, rotation, focus and safe respawns. Retain the joystick. Emulated profiles do not establish actual-device performance or whether new players understand the controls.
8. **Fresh production performance/accessibility review.** Recheck responsiveness, layout shifts, console/network errors, accessible Help and current page metadata after the feature batch.
9. **Deferred Ubuntu browser CI.** Repair and re-enable Chromium/Gecko/WebKit CI later, as the user requested. Do not re-enable it incidentally during another release.

Already implemented: the offscreen incoming-cannonball warning, integrated shot-follow, healthy carrier part theft, capture redesign, weakened vulnerable inhale and black holes. Historical escape sequences/loading/drain were superseded; the 80% injury movement slowdown was withdrawn. Older sections below preserve the request history and can describe superseded mechanics.

## Active fixes requested after the satellite release

Release history: 68e1674 (PR #47), followed by 5bb717e (PR #48), which shipped the completed fixes below including capture redesign and vulnerable-inhale counterplay. Ubuntu browser CI was explicitly deferred before that merge. Balance values remain provisional. The user requires cross-browser and cross-device support, and reported these issues on October 26. Keep the following requested fixes in scope:

1. **Firefox on Android is severely laggy; Chrome on the same phone works.** Profile and fix rendering, then check a Firefox phone viewport and actual-phone feedback. Star-glow caching and culling are shipped after a measured Firefox blur bottleneck; actual-phone feedback remains pending.
2. **Run browser checks in CI.** Include Chromium, Gecko and WebKit across desktop, phone/landscape and tablet layouts. Preserve the required CI gate; the browser matrix is currently deferred at the user’s request. Emulated viewports must not be mislabeled as actual Android/iOS device runs.
3. **Preserve the old weapons.** Satellites are additions, not replacements for the Pinwheel spinning machine gun or Pulsar wave machine. Verify production spawn/availability and visibility. A live check found both recipes still present; investigate why they appear missing.
4. **Make the mobile side drawer touch-scrollable.** A visible scrollbar currently does not guarantee finger scrolling. Test real touch gestures and reachable bottom actions.
5. **Credit weapon damage to its assembler.** Every bolt, pulse, beam damage tick and knockout should attribute to the builder. The user selected both a damage/knockout tally and gems awarded to the builder. Verify every recipe, conserve transferred gems and keep the owner credited at distance.
6. **Allow weapon placement while moving.** Preserve a held joystick/key while deploying with a second finger or E. Reproduce and fix input cancellation or action conflicts; movement alone must not block placement.

7. **Increase Pinwheel damage per bullet.** The user wants the spinning machine gun to hit harder. Start with a measured roughly 50% increase, preserve sublinear giant scaling, and leave other weapon damage unchanged.

8. **Keep mobile play clear of event overlays.** Remove the central surge bar, other-player hit feed and jackpot alerts from the mobile playfield. Use world/minimap indicators and drawer history. Preserve essential capture/placement controls.
9. **Make locked weapon parts unmistakable.** Rival-reserved parts need a muted icon, coral-red accent ring and bold red X; the owner's parts get a bright mint ring/checkmark. The user prefers color and symbols rather than status words.

10. **Restore gameplay focus after Help.** Closing the drawer should focus the arena so Space inhales instead of reopening the menu.
11. **Safer respawns.** Include active/charging weapons, incoming bolts, moving satellite danger, turbine intakes and nearby large bodies when choosing a spawn. Give four seconds of spawn protection to move clear.
12. **Capture redesign supersedes arrow escape and gradual captive drain.** See item 22. Keep the joystick for interior movement; remove the sequence, daze and loading prerequisites.
13. **Reduce satellites and show important weapons on the minimap.** Halve the orbital construction sets from six to three, lengthen their replenishment gap, and use distinct weapon symbols. Keep both classic recipes available.

The user then reported that even a same-sized inhaler prevents escape. Implement distance-sensitive pull caps and active retreat resistance, preserving size-based close capture and all normal movement speeds. Still pending balance discussion: outer-body glancing damage for giants and a shared assembled-weapon hit-protection interval. The user asked for options, and the recommended combination is glancing hits plus shared protection without weakening well-aimed direct hits.

14. **Decisive injured-captive shots.** If a player is injured when captured, successfully firing them ends that run on impact, an arena boundary, or flight expiry. Automatic ejection before firing remains nonlethal. Preserve healthy captures, turbine flight rules, gem conservation, launcher credit and protected respawn. Snapshot the injured capture so an expiring injury timer cannot undo a fired finisher.

15. **Weapon-piece theft from healthy carriers too.** The user explicitly clarified that injury is not required to pull a piece off another player. Use sustained close inhale, keep loose rival-reserved pieces protected, transfer ownership/guidance on successful theft, and preserve the one unfinished set per player rule. Healthy gem theft remains disabled.
16. **Clean up the upper-right HUD stack.** Put the menu button, player count and minimap in one aligned dock, with a single frame and consistent spacing. Keep score/leaderboard in a separate aligned left column so narrow screens do not overlap.

17. **Exact movement tuning.** The latest instruction sets SPEED_FALLOFF to 0.5 and retains MIN_SPEED at 130. Do not change any other balance values as part of this adjustment.

18. **Quiet incoming-cannonball warning.** Predict relative-velocity circle intersection within 0.5s for offscreen player-fired projectiles; show one stable edge arrow for the earliest impact, remove it for visible/invalid/passed threats. No sound, banners or balance changes. Test approaching shots, near misses, moving targets and disappearing threats.
19. **Per-attacker sustained injury theft.** Base injury stays seven seconds without refresh. Only a valid authoritative stealing connection established before expiry may continue afterward, and only uninterrupted for that attacker. Range/aim/airflow/protection/state failure immediately revokes it; no late joining or reconnecting without a new injury. Preserve rates and truthful injury art; clear on capture, death, respawn and disconnect. This explicitly supersedes the earlier rule that all theft stops at base expiry.
20. **Integrated shot-follow feature.** The user overrode the earlier prototype/isolation wording: implement in this branch and the same localhost:3001 game, enabled normally, without a toggle or separate build. Keep tuning/system code isolated from injury/theft/damage/growth/walking changes. The later explicit release request authorizes merging/deploying the integrated feature. Successful player-cannonball or owned comet hits open a brief fixed-impact follow opportunity. Require a fresh inhale press (already-held input cannot auto-engage), pull smoothly while held, cancel on release/arrival/timeout/invalid states, use existing collision/boundary rules, and show a small airflow cue. No victim tracking, auto-theft/capture/damage/stun or stacking acceleration. Same rules for bots/humans. Inspect attribution/input/movement first, document conservative bounds, and test misses, attribution, held inputs, cancellation, walls, movement, simultaneous hits, cleanup and desktop/mobile rendering.

21. **Mass-relative defensive puff.** Use the existing physical body mass for matching opposite impulses, share a finite impulse budget across eligible targets, cap added velocity/recoil, preserve the existing hit cone, breath/cooldown/stun and suction-break protection. Empty puffs must not dash. Initial relative-speed impulse scale 560, target added-speed cap 560 and whole-puff recoil cap 420 units/s. These are playtest values; ordinary movement, giant turning and projectile damage stay unchanged.
22. **Combined capture redesign (latest, supersedes older capture proposals).** Immediate firing after releasing the capture-causing input, captor-only aim, and no arrow sequence/loading/daze. Fix hold duration at capture from PRE-TRANSFER physical width ratio: 5s at 1.3× legal minimum, 8s at 2×, 12s at 4× or above, smooth interpolation. Proposed initial one-time transfer: 30%, rounded down, exactly conserved and using normal growth. Interior joystick/WASD/arrows move only a separate avatar in a magnified translucent belly; six finite collectibles remain pending until a living ejection or surviving flight. Proposed cap: six bonus gems per capture. Never change mass/damage/hold time with pending rewards; discard on death/disconnect/respawn and pay once. Snapshot injury at capture; firing an injured captive still ends the run at impact/boundary/flight end, while timeout ejection does not. Same rules for humans/bots. Remove obsolete handlers/UI/tests, verify immediate-fire edges, pre-transfer timing, accounting, cleanup/repeated captures and desktop/mobile routing. Timing/share/bonus cap remain provisional, not human-balance validation.

23. **Shooter physical mass contributes to captive-shot power.** Snapshot a bounded bonus at firing, independent of later launcher growth/shrink/death/disconnect. Proposed initial formula: min(0.10 × sqrt(shooter mass × ammunition mass), 0.75 × ammunition mass). Add this to current pre-impact ammunition mass only for player-fired captives, preserving target resistance, existing ceiling/immunity/KO and attribution. Re-cap the stored bonus against current ammunition mass at impact. Never change launch speed, drag, stun, injury or other weapons. Document numeric controlled comparisons and test snapshots/caps/cleanup with immediate firing and one-time capture transfer. Prototype constants are not agreed final balance.
24. **Weaken outgoing inhale and block capture while vulnerable.** INHALE.VULNERABLE_OUTGOING = 0.15, applied once each to final player-body pull and final injury-drain progress. Block the authoritative close-contact and final capture path. Use the original non-refreshing injury window plus valid uninterrupted sustained-theft continuation, with no second timer. Restore immediately when continuation eligibility ends after base expiry; calculate validity independently of player iteration order. Preserve ordinary movement, puff/stun rules, incoming protection, loose gems, cargo, bombs, breath and pre-existing captives. Draw a sparse coral flow/fragmented mouth halo at the unchanged full dotted reach. Test base/continued weakness, restoration, expiry, close catches, held captives, puff and bot parity; 15% remains provisional and sustained pressure may become too strong.

Never remove or replace the joystick. Existing fixed base injury timing, gem loss persistence, captor-only flight aiming and shared bot/human mechanics remain. Historical arrow-escape, captive-drain and loading descriptions below are superseded by item 22.

## Delivery order and next work

Released in 66adea2 (PR #46): brainstorm items 1, 3 and 7, with fixed seven-second vulnerability, rapid lethal injury theft and capped captive gem transfer. Losses persist. The suggested injury movement slowdown was withdrawn; keep movement unchanged.

The current release batch implements item 4 and addresses repeated capture: stronger immediate body pull even against healthy players, retained size resistance and sideways/gust counterplay, four-second recovery after escape or surviving flight, and release outside the entire captor body. Keep the joystick and its forgiving escape inputs unchanged. Group diminishing returns, weapon-part theft and black holes remain separate follow-ups.

The current release batch implements the user's selected distinct recipes with duplicate sets: six weapons (Pinwheel, Pulsar Array, Sentinel Satellite, Ricochet Satellite, Ion Sweeper, Comet Battery), two independent sets each. First pickup reserves the whole set for its collector, with a claim-link animation, lock markers and directional radar for missing parts. Rivals can collect another set. One unfinished set per player; holding a piece sustains ownership, dropping every piece starts an 18-second recovery window, and knockout/disconnect releases unfinished sets. Three satellites join broad arena orbits after placement. Mobile action text is centered as one measured block with consistent spacing, including breath/cooldown states. The user approved committing, merging and deploying this batch on October 26. Human playtesting and weapon balance remain follow-ups.

Mobile correction: **never remove the joystick or replace it with arrow buttons.** Escape input must be forgiving about direction. Implemented broad 60-degree acceptance, moderate pushes, harmless intermediate angles, and deliberate turns without exact recentering. Held input survives the daze, without auto-solving multiple arrows. Keep keyboard escape, sequence lengths, daze and loading unchanged. Validate on the user's real phone after automated device checks.

Guiding priority approved October 25: follow the six-stage [lasting-dominance loop](GAME_LOOP.md). Becoming enormous should feel almost untouchable and remain sustainable for hours through good play. The user then approved starting with missile damage and theft: the initial size-based pass is implemented and measured in controlled matchups (see GAME_DESIGN.md). Subsequent equal-rule tests exposed runaway growth; the user approved fixing it in this pass and refined the goal to rare, durable giants. Shared mechanical rules, safe field replenishment and progressive late physical growth are implemented. See BALANCE_VALIDATION.md for selected parameters, measurements and remaining limitations. Repeated Pulsar damage and hours-long survival still require playtesting.

1. **Finish the current controls, fairness and UI pass.** Verify mouse-follow without holding a button; retain WASD/arrows; add independent right-thumb aiming to the existing action control. Hold inhales, tap fires; aiming a loaded shot must not fire it accidentally. Keep phone controls clean and usable in both orientations.
2. **Remove persistent interruptions.** The old weapon card is already removed on main; confirm fresh production clients. Pickup notices coalesce and expire. Gem-surge notices disappear after three seconds while the event continues. No replacement pinned pill. Help is at most one quarter its former length and remains readable, keyboard accessible and touch friendly.
3. **Fill every screen with the arena.** New arrivals and respawns remain inside the map, with newborn zoom reset. The latest user request supersedes the earlier desktop blue surround: canvas covers the visible browser viewport at every size; the camera yields centering at boundaries so all screens show playable map. Desktop controls float over play and Focus view does not resize it. Preserve touch safe areas, keyboard resizing and rotation.
4. **Finish escape and bot fairness.** The current release batch gives four seconds of protection against suction, gem drain and recapture from every player after escape/release or surviving flight, with release outside the captor body. Bots read shots periodically, commit to an imperfect aim and react after loading. Keep the existing human escape window; do not shorten loading.
5. **Make the Pinwheel a lethal spinning machine gun.** Rapid straight bullets launched at rotating angles form outward spirals. Bolts can knock out weakened rivals, with credit and normal protected respawn. Damage scales less aggressively against giants; owner/spawn/capture/flight protections remain. Pulsar waves can finish weakened players too.
6. **Injured-player theft, without a shared allowance.** Released: damaging hits open a fixed seven-second theft window; healthy players keep their gems. Further hits and suction cannot extend an active window. Rapid theft uses the victim's gem count at injury start, with size and airflow modifiers, and can cause knockout/respawn. Lost gems stay lost. Captive transfer is separately capped at 20%. Injury adds no movement penalty. Rear-shell fractures close when the window ends; this does not restore gems. Bots and humans share eligibility, gust defense and protections. Continue playtesting knockout frequency, growth time and leader survival.
7. **Tune the earned climb and giant rarity.** The October 26 trial responds to the user finding growth too fast: 25% less physical mass per gem, progressively more costly later growth, bounds extreme bodies and prevents field replenishment underneath live pickup boxes. Scores remain uncapped. Bots and humans share rules and weapon access. Measure time to capability, small/medium knockouts, giant population over time and sustainable reigns; do not mark rarity/fun achieved from one simulation or an average that hides late crowding.
8. **Make a large lead rewarding and sustainable.** Initial approved missile/theft pass is implemented: projectile-to-target mass replaces the 75–85% target-loss floor, and size resistance plus a gentler contact ramp reduce giant theft losses. Small fan hits still injure and spill gems; substantial ammunition can finish smaller players. Measure leader tenure, catch-up speed, bot decay, combat spill recovery and repeated-hit losses. Giant survival for hours is a goal, not a validated result; review repeated Pulsar damage and passive decay next.
9. **Add black holes for player-fired knockouts.** Approved constraint: players must be shot into them; ordinary movement cannot accidentally kill someone, including large bodies passing nearby. Warning, placement, core collision and any outer pull still need implementation and playtesting. Check large-player navigation so the hazards do not make the arena frustrating to cross.
10. **Playtest knockout frequency across existing attacks.** Refine player missiles, Pinwheel bolts and Pulsar waves before adding more damage systems. Preserve short respawns and protection. Ordinary bumps remain crowd-control, not arbitrary touch deaths.
11. **Recheck the whole mobile workflow and desktop clarity.** Capture, aiming, flight, knockout, respawn, rotation, weapon pickup/place, menus, name saving, focus loss and safe areas. Keep eyes clear and the arena primary.
12. **Measure performance again.** Recheck PageSpeed/layout shifts, responsiveness, headings, description metadata and console/network failures after the new weapons. Historical scores do not establish current scores.
13. **Complete maintenance and documentation.** Remove obsolete whole-swallow behavior, visuals, script and tests while preserving harmless wire-field positions for compatibility. Keep current rules, this list, validation and the best-ideas archive accurate.
14. **Six-weapon playtest.** The user approved about six weapons and moving weaponized satellites. Six recipes and duplicate assembly sets are implemented; test human collection time, clutter, orbit counterplay and combat frequency before declaring balance settled.

Items 1–6, the initial parity/growth pass in 7 and the legacy cleanup in 13 are implemented. Items 7–10 retain pending balance/playtest/prototype work; no claim they are completed. Fresh performance measurement in 12 and ongoing device/accessibility review in 11 remain follow-ups.

## Established decisions and shipped requests to preserve

- Audit the code, fix confirmed issues, work on a new branch, verify before merging main; remember the plan and ten strongest ideas.
- Large movement should be slower than small movement but responsive, not painfully sluggish.
- Keep the player centered in open space, with a finite map and no Asteroids-style wrapping. The latest full-viewport request replaces the earlier desktop blue exterior: clamp every view to the map and let the player move off-center near boundaries.
- Compact/mobile screens stay filled with map, including edge knockouts and rotation.
- Improve ambiguous top-right icons with understandable labeled desktop controls. Keep Help/settings and controls usable without crowding the activity feed.
- Provide Save name plus Enter; retain the saved name and clear confirmation.
- Reduce bot clustering: separate forceful collisions, briefly stagger both bodies, let crowds slide apart, cap pursuers and let crowded bots disengage. Do not repeatedly stun continuous contact.
- Escape with WASD, arrows and touch flicks. Sequence length follows **captor's size advantage**, not the captive's own size. Wrong inputs reset progress.
- Bots should solve escape puzzles slowly and imperfectly. Humans need enough time after the daze; do not solve easy bot escapes by making shots instant.
- A player missile follows the captor's aim. The captive must neither help aim nor spoil the shot before or during flight.
- Impact should remove about 90% of the missile player's width, once per shot. No remaining growth means knockout and a fresh spawn; large survivors get landing protection. Targets also lose substantial mass and small targets can be knocked out.
- Escaped and landed players must not be immediately sucked back up and reused as ammunition.
- Strong exhale/gust, useful even against large creatures; 800ms stun blocks movement and inhale, with a readable dizzy animation and protection from repeated stun chains.
- A gust spends 35% of a full breath meter and requires that much breath; retain visible, contextual feedback.
- Preserve puffed cheeks when carrying a captive. Keep eyes unobscured; no filled black mouth/capture disc over the face.
- Remove glowing blue Core orbs completely from active play.
- Fewer background gems: 1,270 → 950, about 25% fewer. Combat spills are extra; do not misreport total objects as field density.
- Assemble weapons from visible world components. Touching **or** inhaling collects them. Keep the locally approved pickup feel.
- Parts travel as physical carried cargo; releasing inhale, moving or turning does not drop them.
- First pickup reserves all three parts of that independent set. Carrying any piece sustains the reservation; dropping all pieces leaves 18 seconds to recover them. Knockout/disconnect unlocks unfinished sets. Duplicate sets stay available to rivals.
- Do not deploy at the third piece's location automatically. Carry the assembly to a chosen spot; E or a contextual touch Place weapon button deploys it.
- Mark components on the minimap; keep physical parts recognizable without a permanent explanatory panel.
- Pinwheel: assembled rotating shooter; current follow-up upgrades it to rapid spiral fire and lethal hits.
- Shockwave Drum was chosen next, then explicitly replaced with a **space-themed Pulsar Array** whose waves strongly knock back and damage rivals.
- No permanent weapon cards, instructional banners, progress pills, floating duplicate labels or waiting countdowns. Brief coalesced notices and relevant actions only.
- Reduce Game Menu instructions to one quarter or less, and keep them current.
- Gem-surge banner disappears after **three seconds**. The event continues; do not shorten the entire surge.
- Mouse-follow on desktop requires **no held button**. Preserve keyboard movement and add clean independent touch aiming.
- Make getting huge and ruling the arena feel earned. Avoid instant growth from tiny attackers draining large players and avoid constant leader turnover.
- Preserve the user's full UI/UX working agreements in the global instructions; follow them on future changes.

## Fifteen growth and combat ideas to evaluate

These are design options, not fifteen approved implementation tasks. Start with 1–3, measure, and choose rather than applying them all.

1. Stronger size-ratio penalty for a small creature stealing from a much larger rival. **User's latest hypothesis; investigate first.**
2. Reduce how much a long uninterrupted inhale amplifies disadvantaged stealing, so lingering on a giant cannot erase the ratio penalty.
3. Lower growth per ordinary crystal modestly, e.g. test 25% less mass rather than changing movement speed.
4. Keep the opening few pickups rewarding, then progressively increase the crystal cost of each visible size increase.
5. Keep loose-crystal pickup reach responsive while separating it from the strength used to rob a player.
6. Make theft from a similarly sized rival the best routine combat growth opportunity; tiny-vs-giant theft becomes harassment.
7. Give larger creatures more effective breath reserves for sustained combat, with a cap and the same readable meter.
8. Keep giant resistance to small shots, while large projectiles remain a meaningful threat; test damage by relative mass.
9. Make cannon bolts lethal to weakened players without making a giant die in the same number of hits as a newcomer.
10. Use Pulsar waves as a finishing hazard that can be escaped, rather than a permanent stun field.
11. Keep respawn protection and short recovery windows so one hit cannot become an unavoidable chain of deaths.
12. Prevent immediate recovery of one's own combat spills from undoing an otherwise successful attack; measure the existing pickup lock first.
13. Reduce passive decay for established bot leaders if measurement shows it, rather than opponents, is causing rapid turnover.
14. Make growth feel larger through restrained creature/camera feedback, without adding pinned milestones or making controls sluggish.
15. Add temporary black holes as a positional knockout opportunity, with a warning and an escapable outer zone; this is the user's hazard proposal.

## Five cannon strengthening options discussed

Percentage/mass-sensitive damage; ability to finish weakened rivals; burst/rapid fire; faster/longer-range projectiles; small impact explosions. The selected direction is rapid rotating fire plus lethal, mass-sensitive hits. Explosions are not implemented.

## Latest approved follow-up

- Fill the entire visible browser viewport on every screen. Replace desktop reserved header/padding and blue exterior with floating controls and camera bounds. Keep mouse control/Help reachable in Focus view, preserve safe areas, resize/rotation/keyboard handling, and keep capture/placement clear. This supersedes the earlier wide-desktop surround decision.
- Small player-cannon misses burn up at flight end (initial threshold: fewer than 12 gems); keep larger landings and small fan comeback launches.
- Fan passage requires fitting through the visible 54-unit throat. Oversized creatures cannot become fan-fired weapons and can walk away from suction.
- Desktop mouse-follow gets a labeled On/Off switch, default On, with persistence and keyboard support; WASD and touch remain usable.
- Spread out crystals through spaced field replenishment, gentle separation of settled piles, fewer individual combat drops with conserved value, and wider fan exhaust scatter. Keep the 950 field target and growth per gem unchanged.
- All fifteen balance options were copied and verified in the scoped persistent instructions at the user's explicit request. They remain options, not blanket authorization. The new burnup/fan/switch requests are separate accepted requirements.

## Latest playtest priority: rare, durable giants

The user wants a rewarding opening, meaningful midgame fights, an earned climb and a sustainable reign by a few enormous players. Two or three giants per 20 is a measurement target, not an artificial cap. Evaluate the new shared-rule implementation before adding another weapon or hazard. Compare the full time series, not only match averages: too many late giants remains a defect even when the average is two or three.

Next use real matches with several people to assess whether gathering, fan comeback shots, capture/escape, valuable spills and weapon placement create memorable decisions and rivalries. Track who returns because a match was enjoyable and whether friends can easily join the same arena; a new invite interface is a separate design task. Do not use pressure mechanics or permanent prompts to substitute for a fun loop. Keep all balance recommendations subject to shared bot/human rules.

## October 26 active playtest follow-up

The user found the 3190 preview still grew too quickly and questioned whether protections made respawn too rare. The revised 3192 trial retains short anti-chain protections, adds bounded missile energy for decisive small/midgame hits, delays ordinary own-spill recovery to three seconds and spent player-missile recovery to six seconds, reduces physical growth by 25%, and fixes minimap size exaggeration. Bots/humans remain identical under equal input. All ten unit suites, 13 multiplayer scenarios and 105 Chromium/WebKit device cases pass for this trial.

Next obtain the user's feel feedback on 3192 before treating balance as settled. Two 20-minute seeds show more actual target knockouts, but the hour-long sample still ends with five giant-sized survivors and no giant knockout; do not cherry-pick the shorter results or declare the two/three-giant goal achieved. Review approach-to-giant mortality, self-spill recovery and purposeful rival/weapon fights before adding another hazard. Update the draft PR and keep release status explicit.

## Latest correction and selected growth pass

Disregard the misclicked “too punishing” response. The user clarified that poor decisions should be punished and clever play is central; growth is the remaining concern. The selected revision changes physical mass per gem from 0.75 to 0.5 only. Keep impact energy 80, three/six-second owner spill delays, gust, firing/loading and short anti-chain shields. The 3194 preview has this revision. Automated evidence and limitations are in BALANCE_VALIDATION.md; PR #45 tracks merge/deployment. Continue human/group playtesting, rival/weapon opportunities and production performance measurements after this pass rather than calling fun or hours-long survival proven.
