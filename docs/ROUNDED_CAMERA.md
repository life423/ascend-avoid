# Rounded-arena camera framing

Implemented on `codex/rounded-arena-camera`, based on released main `d27fd45`.
The user reviewed the local game and approved commit, merge and deployment.
The production GitHub Actions workflow for main records the release status.
The menu experiment was reverted at the user's request:
the original top-right Menu button and minimap below it remain unchanged.

The old camera clamped to the rectangular world bounds, exposing the empty area
outside the circular corners. `constrainArenaView` now keeps all four viewport
corners inside the physical rounded arena. Convexity then keeps the entire view
inside. The same helper handles portrait, landscape, held knockout views, growth
and respawn. Optional camera shake is constrained again afterward.

The camera first shifts inward at its ordinary zoom. It only increases zoom when
that rectangle cannot fit while keeping a visible region around the local player.
The corner projection is analytic; a bounded 32-step search finds the minimum
necessary zoom when needed. Interior framing, movement, collisions and balance
constants are unchanged.

At a curved wall, a giant's circular body can fit inside the arena while its
axis-aligned bounding square cannot. Keeping the whole body in a rectangular view
without showing any exterior is then impossible. The camera retains the center
and a substantial body region instead of pushing the giant offscreen. Its outer
edge can be cropped against the viewport. The guaranteed central region comes
from a same-aspect rectangle inside 95% of the center's physical wall-clearance
circle; the full body margins are retained when space allows. Corner zoom and
HUD overlap still deserve longer device playtests; the user's local approval and
automated checks do not validate every camera/combat balance scenario.

## Verification

- A new independent geometric test checks 26,208 size/corner/aspect combinations
  across three arena sizes, all four corners and angles along each arc. It checks
  the entire viewport, retained player core, continuous framing, extreme zoom and
  unchanged ordinary interior views.
- All 50 server unit scripts pass, along with practice progress and the ownership
  lifecycle/contrast check.
- Desktop Chrome, Android Chrome emulation and iPhone Safari emulation pass the
  corner-camera checks for small, large and maximum-size bodies, real keyboard or
  thumb movement, portrait/landscape rotation, sudden growth/shrinking, knockout
  hold and respawn. Existing rounded-wall movement/collision checks also pass.
- Types, ESLint (zero errors; existing warnings remain), the production build and
  production package verification pass. No Ubuntu browser matrix or physical-phone
  performance validation was claimed.

Logs and screenshots are ignored under `.tmp/rounded-camera-*` and
`.tmp/camera-menu-*`. Run the normal game at `http://localhost:3001/`.
