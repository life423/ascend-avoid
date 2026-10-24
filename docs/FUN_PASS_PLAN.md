# Cannonball fun pass

Accepted October 24, 2026. Branch: `feature/cannonball-fun-pass`.

Implement the five recommendations from the local audit:

1. Reduce growth's movement penalty: speed exponent 0.3, minimum speed 130, gentler turn-rate and turn-acceleration penalties.
2. Captures use a 600ms daze, three to five inputs based on captor size advantage, 1.2–1.6s loading and a 4.5s maximum hold. Early FIRE presses queue for the end of loading. Captives steer their flight and receive hit recognition. Bots read for 500ms and attempt inputs every 450ms at 65% accuracy. Later feedback explicitly favors harder escapes over shortening loading further.
3. Add announced gem surges near turbine exhausts, with a contested jackpot and minimap guidance. First warning after 30 s, then 60–90 s between events; 8 s warning, 18 s event.
4. Give defensive puffs a one-second suction break, wider arc and substantial knockback even against giants, with a visible 1.8s cooldown and capped displacement.
5. Add restrained synthesized sounds, saved mute control, contextual Inhale/Loading/Queued/Fire labels, a dismissible first-session guide, and a capture badge below the body that keeps eyes unobscured.

Fix confirmed audit problems: clear input and cancel actions on blur/hidden/text focus; truthful help; impact effects and attribution; protection ends on offense; replace obsolete integration expectations with isolated current-rule scenarios; normalize generated-type line endings. Add fast gameplay regression coverage to CI.

Keep the centered camera and continuous shared world. Traffic, bombs and floor shifts remain opt-in experimental systems. Tune values through playtests after automated checks pass. The user subsequently authorized pushing the completed branch and merging it to main after verification; the normal main deployment workflow may then run.

Validation: production build, type checks, lint, generated schema check, physics/gameplay unit tests, isolated multiplayer scenarios, desktop and mobile browser checks, visual inspection of surge/capture/help UI.

Additional accepted requirements: preserve exact player centering during hits and launches; verify WASD/arrow escape presses in a browser; improve PageSpeed scores by removing layout shifts, correcting heading order and description metadata, and checking console/network failures. Record measured local Lighthouse results separately from the live-site report.

Later feedback: labeled Help & settings/Focus view/Show controls buttons; explicit Save name plus Enter; lighter blue decorative surround beyond thin blue boundaries; bots fill to 20, cap pursuers and disengage from dense fights. Save the ten best ideas and record weapon-piece assembly separately as an exploratory prototype.

Follow-up to PR #27: remove the filled black mouth from ordinary inhaling too. Use a small curved mouth while airflow expresses suction; keep the capture badge below the body.

Accepted capture appearance: puffed cheeks. Inflate two soft cheek bulges during the gulp, with a subtle blush and highlights. Keep both eyes fully visible; cheeks disappear when the captive escapes or is fired. Retain the below-body loading badge and existing firing delay.

Accepted combat follow-up: gust hits briefly stun (800ms) with no steering or inhaling, plus a dizzy animation. Knockback continues and repeated stuns respect the existing immunity window. After a fired creature lands, grant three seconds without incoming suction, drain or recapture by anyone, with a visible recovery ring. Keep capture loading unchanged.

Later gust tuning: increase base knockback from 300 to 400 units and minimum defensive shove from 150 to 200, capped at 500. Keep the 800ms stun, 1.8-second cooldown and range unchanged. The reported persistent black inhale circle was confirmed by the user to come from an older version in an open hosted-site tab.

After the user asked to keep going: build the Pinwheel Cannon prototype with three physical parts, the 18-second builder claim, a short rotating firing burst and visible dodgeable bolts. Separate part claims, assembly, combat and drawing into dedicated modules. Keep collision-stun brainstorming separate; ordinary body contact is unchanged. Later human feedback asks for enough time to escape: lengthen capture loading to 1.8/2.1/2.4 seconds, retaining the 600ms daze, three-to-five keys and slow bot attempts.

Further accepted playtest changes: collected parts remain carried after release/movement/turning; the user likes the current local collection feel. The complete weapon is carried to a chosen spot and explicitly placed using a visible mobile/desktop button or E, with no automatic placement deadline. Keep mobile controls clear in both orientations. Show each H/R/B part on the map with guidance to the nearest missing component. Remove Core orbs from normal play. Gusts cost 35% of the full breath meter. New forceful collisions stagger for 220ms with separation and immunity gates. Missile targets lose 75–85% mass, with small targets knocked out; the missile itself loses about 90% width (newborn floor) once on a player/wall impact and keeps its post-flight shield. Save imperfect bot aiming as a separate todo.

The user reiterated that the glowing blue atomic-looking Core orbs must go. Retire their renderer, physics, simulation and creation hooks completely, purge legacy objects, and verify the deployed build rather than only changing their default count.

Latest playtest supersedes captive steering: only the captor sets launch direction, and captive input cannot bend player-fired shots. Keep turbine steering separate. Three/four/five-arrow captures now load for 2.8/3.1/3.4 seconds, leaving 2.2/2.5/2.8 seconds after the daze. Touching or inhaling collects weapon parts without bypassing claims. Reduce background gems from 1,270 to 950 (about 25%). The user clarified that dying is too hard: impacts knock out missiles with no growth remaining and targets below 12 gems; larger missiles can survive with landing protection. Do not add longer respawn protection; the existing respawn wait was not the complaint.

Accepted next weapon: the Shockwave Drum, assembled from drum/spring/piston using the same carry/place controls. Four telegraphed expanding waves separate crowds without additional stun. Keep Pinwheel available by alternating the one active recipe. The user flagged the oversized mobile weapon panel: replace it with compact progress and retain map markers and a contextual Place button. Keep the longer instruction rewrite as a later todo.

Latest feedback replaces the Drum theme and support-only effect with the Pulsar Array (plasma cell, field coil, emitter). Four visible plasma waves double the former knockback and remove 25% of gems, minimum six, with knockout below three remaining gems. Preserve the warning and movement control. The user also reported exterior visible below the map on mobile: compact views now stop at map edges, including while knocked out or rotating, while wide desktop centering/surround remains. Near compact-screen boundaries the player may move off-center to keep the map filling the screen. Ignore the carousel screenshot: the user explicitly said it was from the wrong app.

The user rejected permanent messages, including the weapon progress panel. Remove the entire weapon overlay/pill on desktop and mobile rather than restyling it again. Keep minimap markers, cargo and the necessary contextual Place action. Local pickup feedback is one coalesced notice that expires after 3.5 seconds; starter tips expire after four seconds. Help remains available on demand. The background gem target is already 950 (about 25% fewer than 1,270); combat sprays are extra, and no further density change was requested in this follow-up.
