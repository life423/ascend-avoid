# Exploratory ideas

## Assemble an arena weapon by inhaling its pieces

Raised by the user October 24, 2026. This is a brainstorm, not part of the current implementation.

Two or three visually distinct components float in the arena. Inhaling moves them; bringing the required components close together causes them to snap into an assembly, charge visibly, and activate a weapon. A gust could disrupt an unfinished assembly or another player could steal a component.

First prototype: one three-piece environmental weapon, one shot per assembly, with clear shape/color matching and no inventory menu. Try it as a rare contested event, then measure whether players understand the assembly and whether it creates good fights alongside captures and gem surges.

Ownership preference from the user: inhaling a piece establishes an **18-second builder claim**. The completed weapon inherits the active assembly's builder claim, including when another player supplies the last piece. Meaningful progress, such as adding a new required component, refreshes the 18-second timer; an abandoned assembly becomes available after it expires. This should protect a builder from someone taking the weapon by contributing only the final piece. Gusts can still move pieces and disrupt assembly.

Open design questions: what the weapon fires, how aim is decided, whether pieces snap at a fixed assembly site or wherever they meet, and how it resets after use. Validate that first-touch claims cannot lock all pieces away indefinitely.
