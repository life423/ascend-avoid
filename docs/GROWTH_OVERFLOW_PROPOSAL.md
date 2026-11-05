# Growth overflow accounting — original proposal

**Historical design note.** The user approved implementation on November 5,
2026. Current local behavior, exact measurements and verification are recorded
in [GROWTH_ACCOUNTING.md](GROWTH_ACCOUNTING.md). The proposal below is preserved
with its original provisional examples; it is no longer the implementation status.

## Original November 4 context — superseded

**Unimplemented follow-up, November 4, 2026.** This document does not authorize a
growth or balance change. The current weak-projectile injury fix can ship
independently with its existing seven-second injury window. No source, constants
or build were changed for this proposal.

The recommended direction is to keep uncapped, transferable gem wealth and add
one bounded account for **current physical growth**. Losing a meaningful fraction
of the gems would remove a corresponding fraction of the current body's growth,
even after the gem bank has greatly exceeded useful size. Excess gems would never
be a hidden reserve that automatically rebuilds a damaged body.

## What happens now

[`creatureSize`](../server/game/creatureSize.ts) converts the entire current gem
bank through a concave growth curve, then an exponential size taper, then rounds
width to half a unit. In the 4200-unit arena, width approaches 1470. Gems themselves
are uncapped; `GEMS.MAX_GEMS` limits **world crystal objects**, not a player's bank.

[`PlayerSchema.setGems`](../server/schema/PlayerSchema.ts) correctly subtracts the
actual gems and recomputes body width from the remaining bank. The late-game
problem is the saturated conversion, not missing subtraction. For example,
10,000,000 → 5,000,000 gems leaves width **1470 → 1470**. Losing 90% of that bank
still leaves width **1469.5**. Removing width rounding alone would expose only a
tiny change in the underlying curve, not restore a meaningful size consequence.

The same conversion is used by collection, damage, theft, decay, rewards and
landing. A one-off instruction to shrink width would be undone by the next
`setGems`, `land`, turbine launch or spawn preparation. That would be automatic
regrowth from old stock, even without earning a new gem.

## Two choices

| Choice | What it means | Main tradeoff |
| --- | --- | --- |
| Bounded growth inventory; overflow becomes `runScore`/`lifetimeScore` only | Extra score is a record, no longer lootable or spendable gem wealth. Damage consumes the active growth inventory. | Simpler economy, but changes what existing excess gems mean, damage/decay/reward bases and what a defeated giant can give another player. A separate score field alone does not fix the saturated size curve. |
| Uncapped gem bank plus bounded current physical growth | Existing gems remain real transferable wealth. Current size becomes an independent, damageable state. | Preserves loot accounting and the existing uncapped bank; needs deliberate gain/loss/capture transactions and an audit of bank-based size reconstruction. |

The second choice better preserves the current game. The first is a legitimate
larger economy redesign, not a harmless renaming. If score counts gross receipts,
repeatedly transferring/recollecting the same gems can also inflate it; score
credit rules would need their own decision. Persistence across sessions is not
proposed here.

Simply clamping a growth-gem inventory at the first bank that rounds to 1470 is
insufficient: that threshold is **1,227,436 gems**, and losing 25% of it still
changes width only to **1469.5**. A score-only approach would also need a different
finite backing curve or physical-growth account to make late losses readable.

## Minimal coherent rule for a physical-growth account

Keep `gems` as the actual integer bank. Introduce a high-precision,
server-authoritative `bodyGrowthMass` for ordinary-body growth above the newborn
baseline. It is bounded by the existing physical size limit and carries **no
overflow mass reserve**. Width remains the shared geometry used by collision,
rendering and ordinary physical-mass helpers.

An illustrative loss rule, **not agreed tuning**, is:

```text
actualLoss = clamp(requestedLoss, 0, gemsBefore)
gemsAfter = gemsBefore - actualLoss
growthMassAfter = growthMassBefore × (gemsAfter / gemsBefore)
```

Handle an empty bank without division. Preserve the newborn baseline mass rather
than shrinking below its normal body. A complete loss clears growth. Do not round
away small mass debits individually; half-unit width rendering can still hide an
individual subpixel change, but losses must accumulate in the account. A tiny
fractional hit need not visibly shrink a giant by a whole pixel.

For genuine gains, use the existing growth pacing **from the current body**, not
from the overflowing bank. Conceptually, invert the full ordinary growth curve
to find the current body's equivalent backing amount, add the newly received
gems, and map forward again. At the maximum, excess receipt adds gems but no saved
mass. After damage, newly earned gems can build the body again. Merely keeping old
overflow, waiting, clearing injury, calling a setter with the same bank or landing
cannot restore any mass.

The full inverse must undo the late width taper as well as the earlier gem curve.
The existing `gemsForGrowthMass` only reverses the **pre-taper** conversion; passing
visible giant-body mass to it is not a correct inverse of `creatureSize`. Handle
the exact maximum as a saturated endpoint rather than evaluating its infinite
inverse. Keep fractional growth internally and use a stable endpoint policy.

This is simpler as centralized `gain`, `lose`, conserved `transfer` and explicit
capture/reset transactions than as special width patches in individual attacks.
The current general-purpose `setGems(total)` cannot infer all of those meanings.

### Numeric comparison

These examples use the current measured widths and the illustrative proportional
growth-mass loss above. They are accounting comparisons, not validated balance.

| Bank before → after | Current width before → after | Illustrative physical-growth account after |
| --- | --- | ---: |
| 2,000,000 → 1,500,000 (user's example) | 1470 → 1470 | 1273 |
| 40 → 30 | 66.5 → 58.5 | 58.5 |
| 1,000 → 750 | 301 → 263.5 | 261 |
| 100,000 → 75,000 | 1386 → 1348.5 | 1200.5 |
| 1,000,000 → 750,000 | 1469.5 → 1468.5 | 1272.5 |
| 10,000,000 → 5,000,000 | 1470 → 1470 | 1039.5 |
| 10,000,000 → 1,000,000 | 1470 → 1469.5 | 465 |

After the 10m → 5m example, a no-op bank update would leave width 1039.5. Earning
1,000 new gems would increase it to approximately **1054.7** using the existing
curve from that current body; the 5m gems already held would not refill it. The
ordinary early-game relationship is close to the current one, but the 1000-gem
example shows that this still changes physical loss outside the final plateau.

## Capture, firing and conservation

Preserve actual gem conservation: subtract one accepted integer amount from the
victim and add that exact amount once to the recipient, or to its existing pending
reward account. Do not both pay and spill the same loss. Conservation applies to
gem value; nonlinear growth conversion does not imply equal physical mass moves
between differently sized bodies.

The current [`captureGrowthTransfer`](../server/game/cannon.ts) leaves at most
**32 gems**, the present backing for a body no wider than the 60-unit ammunition
shell. That one-time bank transfer can remain the normal capture reward. Capture
needs an explicit conversion transaction: transfer the bank above the bullet
backing once, then clamp the captive's stored ordinary growth to **at most** the
60-unit body. Do not run capture through a generic proportional damage debit and
accidentally change an ordinary captive to a newborn instead of its current
bullet backing. Do not enlarge an already smaller captive to 60 merely to store
its growth; only the existing flight shell becomes exactly 60 on firing.

An independent body introduces a previously impossible case: a small physical
body can retain a very large bank. The coherent proposed treatment is still to
transfer bank above the existing bullet backing on successful capture, even when
the ordinary body is already below 60. Otherwise the current helper's
`creatureSize(gems)` check would hide loot behind an unrelated score-derived size.
This edge-case policy needs approval with the accounting redesign.

Keep capture eligibility, injury/finish eligibility and hold duration snapshotted
from **pre-transfer physical state**. Transfer cannot invalidate the held state or
extend its timer. Preserve the existing release-before-fire edge and one-time
transfer behavior.

The fired captive's collision body and impact mass remain the existing **60-unit
shell**. Its bank or stored ordinary growth must not make that shell heavier.
Shooter contribution stays snapshotted from its actual firing width. On landing
or a turbine launch, restore the stored ordinary body, not `creatureSize(bank)`.
Keep current ammunition spending/knockout rules; any computed retained bank must
be clamped to the actual bank so an inverse helper cannot mint gems.

## Dependencies that must be explicit before implementation

* **Damage and theft:** apply the accepted gem debit and physical-growth debit
  once. Injury expiry must not restore either. Current theft rates snapshot
  `injuryGems`; this proposal does not silently replace that with mass.
* **Injury severity:** `weaponInjuryShare` currently expresses gem damage as
  `lostGems × 0.5 / preHitBodyMass`. That is a damage-credit proxy, not actual
  post-taper physical mass removed. An independent growth account makes that
  distinction more visible. Using actual mass loss for injury would be another
  deliberate balance decision; do not fold it into the current projectile fix.
* **Decay:** the same loss rule would make existing upkeep physically effective
  at the cap. At 10m gems, one minute of the current 0.1%-of-excess rate leaves
  approximately 9.418m gems. Current width stays 1470; the illustrative account
  would shrink it to about **1426.6**. That consequence requires playtesting even
  though the gem decay rate itself did not change. Exempting upkeep from physical
  loss would be a separate, explicit policy, not an accidental omission.
* **Rewards and collection:** actual pickups, theft, weapon rewards and pending
  combat rewards are accepted gains. Existing owner-pickup delays and once-only
  payout rules remain. Recovering a real spilled gem through normal play is a
  genuine receipt; automatic healing or fabrication of lost gems is not.
* **Death/respawn:** clear the spent run's physical growth with its lost inventory.
  Apply legitimate pending rewards once under their current rules. Spawn retries,
  no-op setup and protection changes must not reconstruct a giant from old stock.
* **Physical systems:** capture, cannon resistance, puff impulses, fans, movement,
  turning, inhale reach, camera and hole clearance must continue reading the
  actual body width. `PlayerSchema.weight()` is a legacy width ratio; replacing
  it with squared mass incidentally would change other systems. Keep that unit
  contract unless separately approved.
* **Wire/fallback/setup:** audit `setGems`, `land`, `launch`, absolute test/practice
  setters and any formula defaults that reconstruct size from gems. Existing
  synchronized width can remain the visual/collision truth. Setup initialization
  must be explicit and distinct from a live gain or loss.

## Follow-up scope

If this direction is approved, implement it separately and first verify conserved
transfers, fractional repeated losses, cap/no-op/expiry behavior, real earned
regrowth, capture once-only accounting, smaller-body/large-bank captures,
60-unit flight mass, landing, pending payouts and respawn cleanup. Compare normal
early growth and physical upkeep before judging late-game feel with people.
Do not change growth coefficients, the arena, injury duration, ordinary speed
settings or damage values as an incidental part of that implementation.
