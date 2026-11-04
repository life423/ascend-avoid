# Gems stay clear of black holes — November 4, 2026

Loose gem placement now reserves the visible black-hole ring plus the gem halo,
using existing visual sizes. The normal hole's reservation is 122 world units
from its center. Integer replicated coordinates are checked after rounding.

- Initial fields and normal replenishment reject covered candidate spots before
  ranking spacing or checking pickup boxes. Existing refill rate, count target
  and anti-farming checks remain unchanged.
- Explicit field placement, falling showers, surge drops and jackpot placement
  choose a nearby clear point inside the rounded arena and any applicable floor.
  A bounded radial search checks every hole rather than moving a gem into another
  ring. A fully blocked placement has no unsafe fallback.
- Settled gems that drifted into a ring, or already rested there, are moved clear
  during the existing spacing pass, preserving their value and lifecycle flags.
  Moving combat drops, falling crystals and turbine flights retain their paths;
  the settled correction does not cancel a flight or alter spray physics.

No gem values, normal counts, refill/expiry rates, player movement, combat balance
or black-hole damage/collision rules changed. Normal-map tests preserve full
950-gem fields, refill quantities and shower totals.

Verification: the dedicated suite covers 12 complete generated fields, normal
refill and explicit placement, 300 falling drops with exact value conservation,
forced surge drops at the hole center, jackpot landing timing, settled cleanup,
unmodified active paths, integer rounding, rounded corners, neighboring holes
and bounded floor fallback. The combined release passes 53 server unit suites,
18 multiplayer scenarios, build/types/schema/lint, and nine browser checks:
six real-AI giant-awareness cases and three full-field clearance cases across
desktop Chrome, emulated Android Chrome and emulated iPhone Safari. Each browser
clearance case checks the actual replicated field before and after hole activation.

Included with the pending bot-awareness release in PR #82. The protected main
deployment workflow records the final released revision and deployment result.
