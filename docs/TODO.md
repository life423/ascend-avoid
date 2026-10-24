# Ascend Avoid — ordered work and idea inventory

Updated October 24, 2026. This is the durable list of the user's requests and decisions. Current code and later feedback override historical tuning. “Branch” means implemented locally on `feature/fair-escapes-and-cleanup`, not yet a verified production release. Proposed ideas are not silently implemented.

## Next work, in order

1. **Finish the current controls, fairness and UI pass.** Verify mouse-follow without holding a button; retain WASD/arrows; add independent right-thumb aiming to the existing action control. Hold inhales, tap fires; aiming a loaded shot must not fire it accidentally. Keep phone controls clean and usable in both orientations.
2. **Remove persistent interruptions.** The old weapon card is already removed on main; confirm fresh production clients. Pickup notices coalesce and expire. Gem-surge notices disappear after three seconds while the event continues. No replacement pinned pill. Help is at most one quarter its former length and remains readable, keyboard accessible and touch friendly.
3. **Stop spawning beside empty exterior.** Keep new arrivals and respawns far enough inside the arena for a centered newborn view. Reset the camera zoom on respawn. Preserve the established desktop blue surround when someone deliberately reaches the boundary; phones always show playable map.
4. **Finish escape and bot fairness.** Two seconds of protection against suction, gem drain and recapture from every player after escape/release. Keep the three-second landing shield. Bots read shots periodically, commit to an imperfect aim and react after loading. Keep the existing human escape window; do not shorten loading.
5. **Make the Pinwheel a lethal spinning machine gun.** Rapid straight bullets launched at rotating angles form outward spirals. Bolts can knock out weakened rivals, with credit and normal protected respawn. Damage scales less aggressively against giants; owner/spawn/capture/flight protections remain. Pulsar waves can finish weakened players too.
6. **Tune small players stealing from larger players.** Highest-priority growth experiment. The user suspects this is the main reason growth is too easy. Measure current drain across size ratios, weaken disadvantaged stealing, retain responsive loose-gem pickup, then playtest growth time and leader survival. Not implemented yet.
7. **Tune growth per crystal.** Consider smaller gains or a slower curve, only after measuring item 6. The aim is an earned climb from tiny to huge, not slow movement or tedious gathering. No growth-rate change in the current branch.
8. **Make a large lead rewarding and sustainable.** Measure leader tenure, catch-up speed, bot decay, combat spill recovery and repeated-hit losses. Big creatures should have meaningful staying power while precision attacks still threaten them. Do not confuse more knockouts with constant leader turnover.
9. **Prototype temporary black holes.** User proposal: spawn them like fans/turbines and shoot enemies into them to kill. Decide warning, safe spawn distance, outer-pull escape and lethal-core rules before implementation. A lethal center with an escapable outer pull is a recommendation, not an already accepted rule.
10. **Playtest knockout frequency across existing attacks.** Refine player missiles, Pinwheel bolts and Pulsar waves before adding more damage systems. Preserve short respawns and protection. Ordinary bumps remain crowd-control, not arbitrary touch deaths.
11. **Recheck the whole mobile workflow and desktop clarity.** Capture, aiming, flight, knockout, respawn, rotation, weapon pickup/place, menus, name saving, focus loss and safe areas. Keep eyes clear and the arena primary.
12. **Measure performance again.** Recheck PageSpeed/layout shifts, responsiveness, headings, description metadata and console/network failures after the new weapons. Historical scores do not establish current scores.
13. **Complete maintenance and documentation.** Remove obsolete whole-swallow behavior, visuals, script and tests while preserving harmless wire-field positions for compatibility. Keep current rules, this list, validation and the best-ideas archive accurate.
14. **Evaluate further assembled weapons after the core loop feels right.** The user requested five more weapon concepts; the selected Drum became the space-themed Pulsar Array. Do not add every brainstormed weapon at once.

Items 1–5 and the legacy cleanup in 13 are on the current branch. Items 6–10 contain new tuning/prototype work; no claim they are completed.

## Established decisions and shipped requests to preserve

- Audit the code, fix confirmed issues, work on a new branch, verify before merging main; remember the plan and ten strongest ideas.
- Large movement should be slower than small movement but responsive, not painfully sluggish.
- Keep the player centered like Agar.io on wide desktops. Use a finite map, no Asteroids-style wrapping. A thin blue edge with a lighter blue exterior is intentional; the user subsequently objected to seeing that exterior immediately on spawn.
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
- Claims last 18 seconds. New required pieces refresh the claim; a rival placing the final piece cannot steal another player's active build.
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
