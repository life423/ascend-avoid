# Injured-shell artwork — November 1 local follow-up

The user rejected the previous appearance and explicitly emphasized that an
injured creature must remain aesthetically appealing. The design keeps its
friendly face and original shell color, with damage concentrated in the shell
around the rear and sides. This is a local implementation, not a published or
user-accepted final art direction.

## Visual treatment

Five related fracture boundaries separate a broad front plate and smaller rear
and side plates. The front leaves room for the eyes; the rear now has real breaks
rather than one largely intact piece. Warm recessed seams have dark edges, a
small lit lip and a pale inner core. Their endpoints cut through the outer rim.
Line weight adapts to screen size so tiny creatures retain a readable silhouette.
The original creature color remains, including the local player's white shell.

Raised, restrained brows and slightly enlarged eye whites give a worried
expression while keeping the pupils unobscured. Existing puffed cheeks remain
when holding ammunition. There is no capture disc over the eyes and no additional
panel, label or button.

The interior texture is cached once at 128×128; there is no per-creature blur or
new asset request. The two-second pulse changes gap/highlight strength by only
four percent. It never blinks the entire creature. Reduced motion uses fixed
fractures and no expanding shatter fragments.

During the final 750ms of actual recovery, the seams close with a smooth curve,
and the brows and eye whites settle back with them. The previous eye-size snap
at recovery was removed. Existing continued-theft state still keeps the injury
visible until the connection ends; this rendering change does not grant healing.

Mouth and lethal-shot finishes break along the same five plate boundaries. The
existing reward animation/accounting remains. Normal play, bots and tutorials
all use these render functions; speed, suction, injury duration, damage and
rewards have not changed in this artwork pass.

## Review and validation

Renderer checks compare actual healthy/injured pixels at 24/36/64/108 CSS-pixel
sizes and eight facings. They require visible rear and side changes and preserve
the darkness of both pupils. At tiny sizes, the check samples the pupil's
neighborhood to account for antialiasing between pixel centers. Geometry checks
verify that the fragments cover the original shell, closing fractures approach
the healthy image, and reduced-motion frames remain static.

Integration checks exercise damage/recovery, walking while injured, real
theft/shrinkage, knockout/protected respawn, a small shot into a larger creature,
holding/firing already-prepared ammunition, mouth shattering and black-hole
reward conservation. The old Help assertion about larger ammunition was updated
to the existing uniform-bullet rule; the 129-word limit was retained.

All **61 distinct browser cases** pass across desktop Chrome, Android Chrome,
iPhone portrait/landscape Safari, iPad Safari and a separate 320px reduced-motion
profile. This comprises 55 art/injury/reward cases, four narrow/reduced-motion
cases and two real Android-profile combat/defense lessons with ordinary controls.
The first 55-case run passed 51; four 24px pupil checks assumed an opaque pixel
at a rounded center. All five profiles pass after comparing the antialiased pupil
neighborhood with its healthy counterpart. The same correction passes the narrow
case. The initial reduced-motion comparison was also made explicit about enabling
normal motion before comparing the two settings. These were test-fixture fixes,
not changes to gameplay for the tests.

The client build and client/server type checks pass. Lint has zero errors and
187 warnings. The renderer test uses the already-installed esbuild version,
now explicitly declared as a dev dependency; no production dependency was added.
Server rules were not edited in this pass.

Actual rendered phone portrait/landscape, tablet, desktop, held-ammunition and
size/rotation screenshots were inspected. A compact source-rendered preview is
saved at [injury-appearance-2026-11-01.png](playtests/injury-appearance-2026-11-01.png).
The current local review is <http://127.0.0.1:3207/>. Browser profiles are emulated;
universal visual recognition, physical-phone frame timing and human enjoyment
are not established. No commit, push, merge or hosted deployment was made.

## Internal critique

These are conservative design-review heuristics, not measured player ratings:
usability 8, hierarchy 9, accessibility 8, consistency 9, responsiveness 9,
feedback 8, performance 7. The high-impact follow-ups are checking injury versus
spawn protection on the physical phone, recognizing recovery in a crowded fight,
and profiling actual-device frame time. Aesthetic preference remains subjective;
the preview makes the chosen appearance reviewable without claiming perfection.
