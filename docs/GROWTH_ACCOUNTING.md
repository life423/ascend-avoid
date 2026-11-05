# Persistent physical growth

Implemented November 5, 2026, following the user's approval of the overflow
growth fix. After local review the user approved commit, merge, push and live
deployment of this change and the preceding player/fan injury gate. The
production workflow records the published revision and rollout result. The original discussion
is preserved in [GROWTH_OVERFLOW_PROPOSAL.md](GROWTH_OVERFLOW_PROPOSAL.md).

## Current rule

`gems` remains uncapped, transferable wealth. A private server-only
`bodyGrowthMass` holds ordinary growth above the newborn baseline. It is bounded
by the existing arena-relative size limit and retains fractional losses between
rendered half-unit width changes. Clients continue using synchronized width for
appearance, collision, camera, speed, turning, mass comparisons and inhale reach.
No schema fields or wire indices were added.

For a live accepted loss:

```text
bodyGrowthAfter = bodyGrowthBefore × gemsAfter / gemsBefore
```

An empty bank clears growth. The newborn baseline remains. The accepted gem
amount is still subtracted once and transferred or spilled under the existing
rules; physical accounting neither mints nor refunds gems.

For an accepted gain, the full existing growth curve is inverted from the
**current body**, including its late width taper. Only the newly received gems
are added to that equivalent backing, then mapped forward. Reaching the existing
physical maximum is the saturated endpoint: later receipts add wealth without
banking extra growth. Live receipts preserve subpixel precision rather than
snapping a damaged body back to the rendered cap. Keeping old overflow, waiting, injury expiry, no-op
setters, landing and spawn retries do not restore lost size. Real pickups and
earned rewards can grow the body again.

The loss ratio has no extra damage coefficient. Growth coefficients, 1,470-unit
maximum in the current arena, half-unit displayed-width rounding, gem damage,
theft rates, upkeep rates, injury duration, puff and movement settings remain
unchanged. Changed size naturally affects systems that already read size.

## Measured examples

These are exact controlled transactions without intervening upkeep, using the
compiled local candidate. Numeric results are saved in
[GROWTH_ACCOUNT_LOCAL.json](playtests/GROWTH_ACCOUNT_LOCAL.json).

| Gem bank before → after | Previous formula's width after | New width before → after |
| --- | ---: | --- |
| 40 → 30 | 58.5 | 66.5 → 58.5 |
| 1,000 → 750 | 263.5 | 301 → 260.5 |
| 100,000 → 75,000 | 1,348.5 | 1,386 → 1,200 |
| 1,000,000 → 750,000 | 1,468.5 | 1,469.5 → 1,272.5 |
| 2,000,000 → 1,500,000 | 1,470 | 1,470 → 1,273 |
| 10,000,000 → 5,000,000 | 1,470 | 1,470 → 1,039.5 |

After the two-million example, a no-op update and landing leave width at 1,273.
Receiving 1,000 genuinely new gems grows it to 1,277. Early uninterrupted earned
growth still follows the existing curve. Proportional physical loss also changes
some established-size outcomes, as the 1,000-gem example shows.

Existing upkeep now has a visible physical consequence at the cap. At ten
million gems, one minute at the unchanged 0.1%-of-excess-per-second rate leaves
9,417,654 gems and width **1,426.5**, instead of remaining at 1,470. The review page
keeps upkeep running. This consequence needs human balance review; no exemption
or compensating rate change was added.

## Capture, flight and lifecycle

`setGems` handles live deltas centrally, covering damage, theft, fan stripping,
collection, reward payouts and decay. Explicit `resetGems` recreates fresh
tutorial/test fixtures; it is never used to reconcile a live player's bank.

Capture still snapshots eligibility and hold time before its one-time conserved
transfer. `captureGems` performs the separate existing ammunition conversion:
keep at most the current 32-gem backing and clamp ordinary growth to at most the
60-unit body, preserving an already smaller body. A physically small creature
with a large retained bank still transfers excess wealth. Recapturing it cannot
pay the same wealth again.

Player missiles retain the standard 60-unit flight shell. Ordinary growth is
stored separately while flying; turbine flights and landing use that stored
body rather than reconstructing it from score. Retained impact gems are bounded
by actual inventory so the mass helper cannot fabricate a surviving bank.
Death paths clear inventory/growth together; legitimate pending rewards are
accepted once at spawn. A failed spawn/retry cannot refill old growth or repay a
pending reward. Disconnect discards the old player object.

## Local review and verification

Normal game: <http://localhost:3001/>. Controlled comparison:
<http://localhost:3001/growth-account.html>. Reset 2m, Lose 500k, No-op update,
Land cleanup and Receive 10k exercise the real server transactions. The dashed
ring marks width before the last debit. Collapse the setup panel to play with
ordinary controls. The page is disposable localhost-only testing UI, removed by
a fresh build; regenerate with `node scripts/growth-account-drill.mjs`.

The two new setup hooks (`test:changeGems`, `test:land`) remain inside the existing
non-production guard. They are not gameplay controls or production endpoints.
The land action checks lifecycle cleanup on the existing body; it does not claim
that a 1,273-unit giant can legally enter a fan.

Focused checks cover loss accumulation, uncapped banks, exact transfers, new
receipts, endpoint/early growth, capture and fixed shells, landing, protection and
injury expiry, real damage/theft, upkeep, pending rewards, retry/respawn and both
human/bot flags. See [TODO.md](TODO.md) for the completed build/type/lint,
multiplayer and desktop/emulated-mobile browser checks. Human balance is still
provisional; no physical-device session is implied by browser emulation.

Verification passed: full build and production package checks, client/server
types, unchanged generated wire types, lint (zero errors; 161 existing warnings),
60 server suites, 18 multiplayer scenarios and 38 browser cases. Browser coverage
includes the four growth-review profiles, 28 existing combat/injury cases, four
standard-bullet cases and full five-lesson runs on desktop and Android emulation.
The final helper correction was rebuilt and checked again by the full server
suite and all four growth browser profiles. A near-cap regression now verifies
that ten cycles of a 100m-gem debit and a one-gem receipt accumulate shrinkage,
rather than allowing a rounding snap to erase the loss.

The [Android-emulated transaction record](playtests/growth-account-mobile-transactions.json)
and [loss screenshot](playtests/growth-account-mobile-loss.png) retain a concrete
example with ordinary upkeep running.

## Separate follow-ups

Assembled-weapon injury still uses its nominal lost-gem mass credit, which can
depend on the bank at extreme totals. This growth change does not silently
replace that gate or change the seven-second window. The player/fan projectile
gate remains based on actual physical matchup and immutable launch power.
Combined fan/black-hole giant routing and longer human/device matches also
remain open.
