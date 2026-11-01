# Ascend Avoid — ordered work and idea inventory

Updated October 31, 2026. This is the durable list of the user's requests and decisions. Current code and later feedback override historical tuning. The approved injury-only theft change supersedes ordinary healthy-player stealing and the earlier theft-allowance suggestion. The fifteen archived balance options remain proposals unless separately accepted.

## Android build and website release

November 1 checklist work: [ANDROID_TESTING_WORKFLOW.md](ANDROID_TESTING_WORKFLOW.md)
tracks five work areas. The user confirmed feature branches should be tested in
isolation and merging main should deploy the live web game everywhere, including
the regular Android app. Staging's baseline is live and passes nine browser
integration checks. The real signing-key backup passed private-key restoration;
its off-PC copy is pending. The separate Test APK and complete device playtest
remain work. The prepared staging workflow has not yet run on GitHub.

Saved user shortcut: run `npm run android:phone` in PC PowerShell from
`C:\Users\aiand\Documents\programming\ascend-avoid` to update the Pixel over Wi-Fi.
The phone needs the same Wi-Fi and Wireless debugging enabled. The user explicitly
asked to remember this command on November 1, 2026.

November 1: the user requested wireless phone installation and a local repeatable
build/test command. `android:pair`, `android:devices` and `android:phone` provide
that workflow. The signed app was paired, installed and launched on the user's
Pixel 10 Pro XL / Android 17; the actual portrait screen showed full-screen
gameplay without a browser address bar. The broader device playtest remains.
Use the current arrow icon for testing;
finalize store artwork before the Play listing/release screenshots. See
[ANDROID_RELEASE.md](ANDROID_RELEASE.md#wireless-phone-installation).

The user requested a build while Google reviews the new `drewclark.io` personal
developer account. The local Trusted Web Activity project produces a signed APK
for direct testing and a signed AAB for Play upload, preserving the existing
website, server and shared rules. [ANDROID_RELEASE.md](ANDROID_RELEASE.md) records
build/signing details and the website association. The user approved committing,
merging and deploying this batch for direct-install phone testing; GitHub's PR
and production workflow record delivery. Finish account review, test a real
phone, add Google's distribution signing
certificate, and complete the store declarations/listing and closed-test process
before production. Nothing in this preparation is uploaded to Google Play.

## Tutorial reading and feedback release

After replaying the deployed five lessons, the user requested fixes for the false
early-Place retry, reading time before aim, puff coaching and fleeting teaching
messages. These are implemented on `codex/tutorial-reading-feedback`, based on
`f10fc82`. Preparation keeps the real captive and remaining budget; real early
placement is credited, and missed-puff coaching permits correction in the same
attempt. Explanations carry into the next action, and injury details stay out of
active escape. [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md#reading-and-feedback-release)
records behavior and verification. The current task includes another complete
mobile pass, now complete on phone portrait/landscape, a 320px reduced-motion
phone and tablet, with desktop coverage. All 58 distinct browser cases pass after
fixing a desktop test-driver render race. The user approved committing, merging
and deploying this batch; GitHub's PR and production workflow record final
delivery. The local review preview is <http://127.0.0.1:3180/>. Shared live rules and the
disabled damage/loading trials are preserved. Physical-device and uncoached
learnability review remain.

## October 31 delivery authorization

The user approved committing, merging and deploying the reviewed escape-wave,
shell, contact, spawn and five-lesson tutorial batch on
`codex/wrap-wave-shell-spawns`, based on main `939a97a`. The release includes the
tutorial mouse switch, Ready/input fixes and phone framing. GitHub's PR and
production workflow record the final revision and deployment; the local-only
status notes below predate this authorization. The 33% damage/loading trials
remain disabled. Human learnability and physical-device measurements remain
follow-up work rather than claims established by automated tests.

## October 31 approved follow-up — implemented and verified locally

[DEFENSE_CONTACT_RESPAWN.md](DEFENSE_CONTACT_RESPAWN.md) records the front-to-rear
escape wave, split shell/worried eyes, safest-candidate respawns with two exits,
removal of the duplicate arena surge banner, and soft contact without bump stun
or shove. Forty server unit suites, progress checks, 18 multiplayer scenarios
and 47 focused browser cases pass, including the existing four-lesson touch
sequence and landscape regressions. Human timing and physical-device review
remain. No merge or deployment of this branch has occurred, and the separate
33% damage/one-second loading trial remains disabled.

The user approved the [five-lesson tutorial remodel](TUTORIAL_REMODEL_PLAN.md),
now implemented locally: growth/capture; deliberate aim, hit and finish; rear
cover and wounded escape; black-hole capture/shot/reward; and automatic weapon
assembly/placement. First timed attempts wait for Ready; retries preserve passed
steps and readable feedback. All lessons remain unlocked and the full sequence
advances automatically. Progress v2 preserves applicable old achievements while
requiring the new combat/rear-cover skills. Desktop practice now exposes the
shared Mouse On/Off switch beside Sound following the user's report. See
[PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md) for verification and limits.
Uncoached human touch use and physical-device performance remain to be reviewed;
this branch is not merged or deployed.

## Size-based movement and credible rival damage — local trial

Latest clarification: size should also slow rotation; a nearly comparable target should resist suction; smaller prey should use speed to stay outside the strong zone, with less body resistance if caught there. The user authorized adapting/removing the legacy inner boost. The local follow-up fixes carried-over spin and removes the binary 1.3× full-pull jump, replacing it with gradual relative-size resistance/inner strength. [SIZE_SUCTION.md](SIZE_SUCTION.md) records the implementation and controlled tests (healthy captures 166→140/315; half-width-or-smaller captures unchanged at 62/90). It is not deployed. Speed does not guarantee escape once a smaller player enters mouth range.

The user requested distinct walking speeds for distinct physical sizes and meaningful escape advantages after shrinking. The local quarter-power movement trial removes the 130-unit/s plateau; [SIZE_SPEED.md](SIZE_SPEED.md) records the shared implementation, tests and measured trade-offs. It is not deployed. In that walking-only trial, healthy capture success stayed 169/315 in the controlled encounter sample, but three mature population runs produced more captures and launches, and no first-place knockout. Movement alone has not solved easy ammunition supply or leader survival.

The user wants substantial damage between similarly sized shooters and victims, based on physical widths, and suggested about 33% loss. They requested testing short capture-to-fire waits with identical bot/player rules, then clarified that **total knockouts are fun**. Do not optimize for everyone surviving or grade a fast kill as automatically bad. [PEER_DAMAGE_STUDY.md](PEER_DAMAGE_STUDY.md) records the initial damage/ammo investigation; [CAPTURE_FIRE_DELAY_STUDY.md](CAPTURE_FIRE_DELAY_STUDY.md) records 21,870 delay fights, twelve staged population runs and six human-message network cases. The shared server gate is implemented as a default-off trial. One second is the next playtest candidate, preserving 260 total / 157 non-flight KOs in the sampled bot populations. Before enabling the candidate, add contextual readiness feedback and test touch/human feel. The 33% damage and delay remain disabled in normal games. Preserve approved immediate capture growth, the 20%-wider finish and identical actor capabilities.

## October 29 combat follow-up — verified and authorized for release

The full requirements, historical baseline, initial choices, measurements and validation are in [COMBAT_FOLLOW_UP.md](COMBAT_FOLLOW_UP.md). The local implementation removes shot-follow and the captive minigame, adds injured mouth finishes and direct lethal rewards, and blocks injured breathing. Initial choices keep already-held firing and nonlethal spills; lethality uses a measured mass/speed threshold. Older release notes below are historical where they conflict. The user authorized merge/deployment after CI; human/group balance feedback remains a follow-up.

1. Finish injured prey only when fully pulled to the mouth; transfer their remaining gems directly. Healthy smaller prey remain ammunition, and injured targets can move to escape before contact.
2. Strengthen branching injury cracks with a warm red-orange internal glow and slow pulse; preserve eyes, healing and reduced motion, and burst along the same cracks on a finish.
3. Disable inhale and exhale/puff while injured, preserving movement. Initial local choice: already-held firing remains available.
4. Transfer lethal player-cannonball rewards directly to the shooter. Playtest the initial mass/speed threshold; nonlethal rewards remain ordinary spills.
5. Add spatial gem-return animation and authoritative single-credit rewards to existing black-hole eliminations. Animated gems cannot be collected or stolen.
6. Remove shot-follow movement, activation and cues, including its other hit integrations. Remove the captive minigame and bonus payouts as subsequently requested.
7. Measure bot capture/fire frequency and visibility before changing behavior. The historical no-tutorial decision is superseded by the October 29 request for [optional private practice](PRACTICE_TUTORIAL.md); keep this separate from live bot balance.

Source baseline verified October 29: local planning branch and local `main` were synchronized to GitHub `origin/main` at `508c3a2` (PR #54). Black holes and shot-follow already exist there. The user authorized committing, merging and deploying the verified gameplay edits on October 29; use the GitHub PR and production workflow for release status. Test injured movement/sideways escape without puff, accounting and shared bot/human behavior before treating the changes as balanced.

## Current delivery status

October 30: the user authorized committing, merging and pushing `codex/capture-fire-delay-study` into `main`, including its walking/rotation/suction ancestry and the default-off research code. The release keeps `PEER_HIT_SHARE=0` and `CAPTURE_FIRE_DELAY_MS=0`. Enabling the one-second/33% playable candidate still needs contextual readiness feedback and human/touch review; it is not part of this activation. GitHub's PR and automatic main deployment workflow record the resulting published revision. Earlier local-trial descriptions and release records below are historical where they conflict with this integration status.

The aim/camera fixes are merged in `ede6558` (PR #58). During that release the user requested a compact Settings row to remove the awkward empty area beside Sound on, and removal of their own creature icon from the scoreboard. That small follow-up is on `codex/compact-settings-row`, preserving sound behavior, highlighted self text, rank and score. The user asked to continue the active release task; see GitHub's PR/workflow for the final deployed revision and [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md#menu-spacing-and-scoreboard-follow-up) for validation.

October 30 follow-up is authorized for commit, merge and deployment on `codex/black-hole-tutorial`, based on deployed main `ae6c935` (PR #56): black-hole lesson requires capture before its longer shot, reward gems have a full visible return, tutorials/settings lead the menu, mobile sound is in the drawer, and the menu/minimap layout is clarified. The user’s subsequent preview feedback removes the player count entirely from the arena HUD, including its leaderboard footer. The user explicitly preferred the mobile mute control in the drawer over another floating action. The user authorized release after reviewing the local preview; GitHub’s PR and production workflow identify the published revision. [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md) records the current behavior and verification.

The user authorized committing, merging and deploying the optional tutorial, standard 60-unit bullets, immediate excess-growth capture transfer, 20%-wider shooter finish and tested bot escape decisions after reviewing the local preview. This batch starts from the previously deployed main `9be662d` (PR #55). [STANDARD_BULLETS.md](STANDARD_BULLETS.md), [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md) and GitHub's release checks document the implementation and rollout. Older delivery notes below are historical. Assembled-weapon dodge fairness, human feel and long-run balance remain follow-up work.

The preceding deployed release is `3b3dddc` (PR #51), including assembled-weapon fairness, group-pressure diminishing returns, safe sliding black-hole rims and quieter assembly guidance. The exact Azure revision and ten successful live smoke cases were verified in the release conversation. Ubuntu browser CI remains explicitly deferred; build/gameplay CI stays enabled.

Release batch: `fix/contested-weapon-assembly`. Healthy cargo theft now survives the near-mouth contact dead zone, resets interrupted progress, shows a synchronized amber progress arc and respects shot-follow input ownership. Sentinel compensates its moving platform toward a fixed pre-shot aim point. See WEAPON_CONTEST_PLAYTEST.md. The user approved committing, merging and deploying this batch. Main, its pull request and production workflow record the published revision and rollout status.

## Remaining requests and playtest decisions

**October 30 live mobile tutorial review:** retained touch aim and paired finishing framing shipped in PR #58. The October 31 local remodel above also addresses the teaching findings: aiming before shooting, separate approach/theft/finish cues, persistent failure reasons, Ready before timed threats, no seeded-gain celebrations and a 44px injury disclosure. Screenshot review additionally found the diagonal aiming rival behind the desktop/landscape lesson panel; paired framing now reserves the panel's actual height and browser tests check the target remains unobscured. [PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md) separates current implementation from the historical review. Human learnability and physical-device feel remain open.

- **Current review: simple physical-size missile rule.** The user explicitly chose a shatter on any player-missile hit from a shooter at least 20% wider. Ammunition size and speed no longer gate that finish; visible body width is the comparison. See [COMBAT_STUDY.md](COMBAT_STUDY.md) for current verification and superseded experiments. Human feel, latency/mobile escape fairness and reasonably dodgeable assembled-weapon attacks remain unfinished; this is not a release claim.
- **Smaller-bot behavior — measured, local decision fixes.** [BOT_SIZE_STUDY.md](BOT_SIZE_STUDY.md) records 630 encounters before and after recognizing the real 1.3× capture threshold and correcting escape movement toward the mouth. Captures against healthy larger bots fell from 232/315 to 169/315. Close mouth starts remain dangerous, and injured larger players remain attackable. Turning and combat are shared with humans; no bot-only weakness was added.
- **Uniform projectile size — approved and implemented locally.** Every player-fired captive uses a 60-unit bullet body. Capture immediately transfers growth above that size, with no instant reward or free growth for bullet-sized/smaller captives. The shared growth curve conserves the underlying inventory; landing restores a survivor's retained natural body. See [STANDARD_BULLETS.md](STANDARD_BULLETS.md). This supersedes the old percentage capture reward; human feel and release review remain.

1. **Large-player assembled-weapon fairness — implemented in this release batch.** The user selected this next. This release batch adds bounded central hit areas, lighter non-injuring grazes and size-scaled shared weapon protection. Normal localhost:3001 includes it. Before/after controls and remaining human-tuning questions are in WEAPON_FAIRNESS.md. Initial settings still need human playtesting.
2. **Group inhale pressure — implemented in this release batch.** Additional valid mouths now have diminishing returns, approaching 1.6× the strongest connection for body pull and theft. Ideal two/three-peer contact takes 2.77/2.53s instead of 1.93/1.33s; solo remains 3.8s. Continued theft and outgoing injury weakness still apply. Human reaction-time validation remains.
3. **Belly-salvage downtime.** An ideal collector finishes six gems in 3.817s; a 12s hold can leave about 8.2s empty. Choose a pacing improvement after trying the activity. Keep the no-escape/no-aim-influence rules unless explicitly revised.
4. **Human growth/combat balance.** Measure opening setbacks, earned growth, rare giants and sustainable reigns in a group match. The hour simulation's longest giant streak was 950s; human fun and hours-long survival remain unvalidated.
5. **Tune the integrated mechanics through play — automated pass complete; human play remains.** The 600s seeded arena pass exercises all six recipes, captures, finishers, timeouts, belly payouts, follow and shot-only cores. Ordinary bodies now slide around safe soft rims, including giants near boundaries; fired captives can enter the core. Assess fixed 5/8/12s holds, 30% one-time transfer, six pending bonus gems, mass-relative puff, shooter contribution, shot-follow, continued theft, 15% weakened inhale and the three shot-only cores. Automated correctness is complete; values remain provisional. Bot-aim timing now also needs feel feedback.
6. **Contested weapon assembly — mechanical pass complete; human matches pending.** Tests cover healthy cargo takeover, moving carriers, reservation changes, all six recipes and deployment under held keyboard/joystick input. Fixed interrupted-theft progress and a close-contact dead zone; added an amber progress arc and corrected Sentinel's moving-platform aim. Twenty-four scripted claim races and 384 weapon controls are recorded. Confirm searching, human defenses, recipe choice, orbital-lane usefulness and fun with people. Damage, recipe counts, projectile speeds and satellite density remain unchanged. See WEAPON_CONTEST_PLAYTEST.md.

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

17. **Historical movement tuning — superseded October 30.** The earlier exponent 0.5 and 130-unit/s floor are replaced in the local size-speed trial at the user's request. See [SIZE_SPEED.md](SIZE_SPEED.md) for current trial values and validation; production remains on its verified release until a later rollout.

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
