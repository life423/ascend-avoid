# Exploratory ideas

## Assemble an arena weapon by inhaling its pieces

Raised by the user October 24, 2026. This is a brainstorm, not part of the current implementation.

Two or three visually distinct components float in the arena. Inhaling moves them; bringing the required components close together causes them to snap into an assembly, charge visibly, and activate a weapon. A gust could disrupt an unfinished assembly or another player could steal a component.

Initial sketch: one three-piece environmental weapon with clear shape/color matching and no inventory menu. The first sketch used one shot; the later Pinwheel Cannon proposal below explores a short firing burst instead. Try it as a rare contested event, then measure whether players understand the assembly and whether it creates good fights alongside captures and gem surges.

Ownership preference from the user: inhaling a piece establishes an **18-second builder claim**. The completed weapon inherits the active assembly's builder claim, including when another player supplies the last piece. Meaningful progress, such as adding a new required component, refreshes the 18-second timer; an abandoned assembly becomes available after it expires. This should protect a builder from someone taking the weapon by contributing only the final piece. Gusts can still move pieces and disrupt assembly.

Open design questions: what the weapon fires, how aim is decided, whether pieces snap at a fixed assembly site or wherever they meet, and how it resets after use. Validate that first-touch claims cannot lock all pieces away indefinitely.

## First weapon candidate: Pinwheel Cannon

The user proposed a spinning wheel that shoots something. Suggested first prototype: a hub, rotor and barrel that snap together into a floating pinwheel. Once assembled, it telegraphs its spin-up, then rotates and fires visible gem bolts in a predictable pattern for a short burst (starting proposal: eight seconds). Bolts knock players back and spill a small amount of gems; they do not stun or automatically target players. Keep one barrel and clear gaps between shots so rivals can dodge and circle it. Reuse arena collision and hit feedback where practical.

Retain the 18-second builder claim and inherit that active claim when the last component is added by someone else. The claim timer and the weapon's firing duration are separate. Gusts can disrupt unfinished assemblies. Following the user's request to keep going, this candidate is now implemented as a prototype on feature/pinwheel-cannon; current behavior and limits are described in GAME_DESIGN.md.

## Collision crowd control (brainstorm)

The user suggested stunning both players whenever they collide. Concern: stopping every touching pair may trap more players in a stationary cluster. Preferred direction to evaluate: stronger separation for ordinary bumps; only high-speed head-on collisions cause a short stagger, with immunity against repeated contact; bots steer away after bumping. No change to ordinary collision behavior has been implemented from this idea.
