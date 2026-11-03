# Weapon ownership visuals

Implemented on `codex/weapon-ownership-visuals`, based on rounded-arena release
`c361c22`. Approved for release after local playtesting. Deployment status is
tracked by the production GitHub Actions workflow for main.

Your assembled weapon has a thin mint rim with an upright shield attached to it.
There is one 650 ms assembly/acquisition reveal, followed by a static mark; reduced
motion suppresses the expansion. Placement does not repeat the assembly animation.
The minimap uses the same shield and rim, sized in CSS pixels on phones.

Pinwheel, Sentinel, Ricochet and Comet bolts use mint accents and paired trails for
the owner. Rival fire uses coral and a single trail. Hollow launch capsules remain
hollow; armed shots remain filled. Ion warning/firing lines use mint or coral while
keeping the dashed/solid warning distinction. Pulsar's moving crescent uses the
same ownership colors, with its original violet silhouette and finite front.
Weapon silhouettes, timing, hit geometry and collision rules remain unchanged.

Ownership is derived from the nonempty authoritative weapon owner and local session
id. An unknown or missing local id never gets a friendly claim. Other players see
that same weapon's attacks as rival fire. Disconnect retirement removes the owner
and attacks through existing server rules. No new safety, immunity or balance rule
was added: each weapon already excludes its builder from damage.

## Palette and contrast

- Ownership mint: `#80FFF1`; separating edge: opaque navy `#07131F`.
- Rival attack accent: existing coral `#FF896F`.
- Solid sRGB mint contrast: 12.38:1 against housing `#16293A`, 14.66:1 against
  `#0A192F`, 12.01:1 against `#172A46`, and 15.59:1 against its navy edge.
- Mint alone is only 1.20:1 against white, so essential strokes use a navy edge
  (18.72:1 against white). The underlying edge is four CSS pixels wider than the
  accent stroke. Static ownership marks remain opaque.
- A shield and paired trails provide shape cues alongside color. No floating
  labels, repeated assembly pulses, bullet shields or permanent HUD panels were added.

These are palette measurements, not a claim of full WCAG compliance. Physical-device,
color-vision and crowded-match human readability still need review.

## Local checks

The unit suite passes all 49 server scripts, practice-progress checks and a new
client ownership/contrast/lifecycle check. A new authoritative test places an
unprotected owner and rival at the same attack location for each of the six recipes,
for humans and bots: rivals lose gems, builders remain uninjured/unpushed, real gem
rewards balance, and disconnect retires ownership and bolts.

Browser checks use the actual production drawing functions for all six weapons
against navy and white, at near and far zoom. They verify ownership versus rivals,
missing session ids, dark separating edges, hollow/armed states, reduced motion,
minimap ownership and normal assembly/placement with a second synchronized viewer.
Minimap checks include standard and 2.625 pixel-density rendering.

Related existing browser regressions cover deployed satellites, muzzle charge,
hollow/live bolt cues, offscreen shot warnings, Pulsar crescents, and keyboard/thumb
steering after a hit. Desktop Chrome, Android Chrome emulation and iPhone Safari
emulation pass all 27 ownership cases; the 21 related regression cases also pass. These are not physical phone tests;
Firefox/Ubuntu validation remains on the separate device/platform backlog.

Type checks, ESLint (zero errors; existing warnings remain), the production build
and production package verification also pass. Review artifacts/logs are ignored
under `.tmp/ownership-*`. The normal local game is at `http://localhost:3001/`.
A temporary all-six render comparison is at `/weapon-ownership.html`; it uses the
real renderers and is outside the tracked source/production package.
