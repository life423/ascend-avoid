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
