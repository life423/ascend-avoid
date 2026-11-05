# Current-rule combat study — November 4, 2026

A very weak player or turbine hit can open the full injury window and enable a
much larger loss through ordinary, close-range theft. This is the strongest
controlled finding. A separate late-growth issue makes lost gem amounts an
increasingly poor proxy for physical impact as body width approaches its cap.
Neither finding was fixed or retuned in this study.

The reference is main commit
`9344b163c1c5295a5b17435248d362c75e760995`. The approved, already compiled server
was used throughout. No build, deployment, tuning/profile override or RNG
substitution was performed. The compact historical results are in
[overall-combat-2026-11-04.json](overall-combat-2026-11-04.json); full local
timelines remain in ignored `.tmp` files.

## Two issues that need separate decisions

**A cheap trigger opens a strong injury state.** Nonlethal player-cannon and
turbine impacts currently call `injure` for any positive gem loss. They do not use
the assembled-weapon injury accumulator. The full seven-second breathing block
therefore starts after a hit that barely changes the victim's size. The damage
itself can be modest while the subsequent opportunity is decisive.

**Banked gems and physical mass diverge late in growth.** The assembled-weapon
gate converts accepted damage at 0.5 mass per lost gem, then compares that credit
with 5% of the pre-hit body mass. Score is uncapped, while physical width tapers
and eventually rounds to 1470. Damage based on score can exceed the nominal mass
threshold without a meaningful change in the actual body. Applying this same
gate to every projectile would address some weak hits, but would not resolve the
late-stock mismatch by itself.

These concern injury qualification and growth accounting. This study provides no
evidence that ordinary walking speed, puff strength, the seven-second duration or
the theft rate should be changed first.

## Weak projectiles and controlled follow-up

The driver performs actual legal capture and `fireCaptive` for small shooters,
including a 26.5px shooter capturing a newborn. The existing flight shell is 60px.
It also sends a real 40px player through a still turbine; the fan's existing 25%
transfer leaves a 36px, nine-gem pilot in flight. The fan hit is unowned and is
observed through the authoritative impact event, rather than inventing player
credit for it.

At the chosen 350-unit initial shot gap, these were the direct hits:

| Victim stock / width | 80px shooter: loss | Fan pilot: loss | Initial visible width loss | Same losses earn assembled injury? |
| --- | ---: | ---: | --- | --- |
| 20,000 / 1049px | 48 | 5 | Cannon: 0.5px; fan: 0px | Neither |
| 50,000 / 1279px | 81 | 9 | Cannon: 0.5px; fan: 0px | Neither |
| 100,000 / 1386px | 138 | 16 | Cannon: 0.5px; fan: 0px | Neither |
| 1,000,000 / 1469.5px | 1228 | 138 | Both: 0px | Cannon only |

Every hit above gave the full **7000ms injury** and **450ms stun**. A deliberate
cannon hit also gave **1500ms suction recovery**, including the stun. The turbine
hit gave **no equivalent suction-recovery interval**. In the fan fixtures,
ordinary theft could begin while the victim was still stunned.

For follow-up, independent healthy 60px hunters start 100 units outside the
victim's surface at rear-diagonal flanks, clear of the shot line. They begin normal
pursuit/aim updates 250ms after impact, at 250ms decision intervals. The victim
either stays idle or begins outward movement 300ms after impact; existing stun
still prevents movement until it ends. Nobody teleports after setup. Collision,
breath, protection, theft ramp, group pressure, growth, spills, upkeep and respawn
remain normal.

With **one hunter and outward retreat**, the selected reference run produced:

| Victim stock | Cannon follow-up | Fan follow-up |
| --- | --- | --- |
| 20,000 | Recovered; 10,494 gems siphoned | Run ended at 7.10s; 13,126 siphoned before the finish |
| 50,000 | Recovered; 34,315 siphoned | Run ended at 6.50s; 36,211 siphoned before the finish |
| 100,000 | Run ended at 7.17s; 79,745 siphoned before the finish | Run ended at 6.13s; 79,973 siphoned before the finish |
| 1,000,000 | Run ended at 7.07s; 969,758 siphoned before the finish | Run ended at 6.00s; 970,702 siphoned before the finish |

Times are measured from firing, not from impact. A mouth finish transfers the
remaining gems separately: for example, the selected 100k cannon case transferred
another 19,598 at the finish. The artifact separates ordinary theft from this
final payout; it does not describe every gem awarded at death as prior siphoning.

Twenty repeat cells used unchanged native randomness to check sensitivity to
spill variation. With outward retreat and one hunter:

- At 100k, the weak cannon case ended the run **5/5**, at 7.167–7.200s; ordinary
  theft ranged from 79,722 to 80,303. The fan case ended **5/5** at 6.133s.
- At 50k, the cannon case survived **5/5**, losing 34,268–34,336 to ordinary theft.
  The nine-gem fan hit case ended **5/5** at 6.500s.
- Those repeated cells had no wall contact or capture of a different player.
  There was no second damage source or refreshed injury window.

The zero-pursuer controls recovered at all four stocks with **zero theft**. The
small shooter also transferred **zero** while holding inhale at its original,
out-of-range position. This is a close-contact cascade, not an automatic remote
gem payout. The separately approved assembled-weapon builder rewards were not
changed or tested as a remote-theft mechanic here.

The causal combination is visible in the state trace: a small hunter receives
enough initial gems to grow, gains stronger size-relative theft, and can eventually
meet the normal mouth-finish ratio as the victim shrinks. Fan impacts offer less
initial recovery time. One hunter already suffices in the critical cells; results
with two hunters must not be interpreted as a simple doubling of theft, since
group-pressure limits and ordinary body geometry still apply.

## Size, capture and cannon context

Healthy capture still needs a **1.3× width ratio**, including contact catches. The
close-contact fixtures conserved total gems and retained the pre-transfer hold
duration. Eligible captives were reduced to the normal 32-gem/60px reserve by the
existing immediate transfer rule. Requested ratios are checked against actual
half-pixel body rounding: a requested 259.8px shooter can round to 260 and legally
capture a 200px target.

A 1400px healthy player cannot currently be captured by any healthy opponent:
the 1470px maximum cannot reach the required 1820px. That is a consequence of the
unchanged physical cap and ratio, not an added immunity. Injury theft can still
shrink that player enough for a later mouth finish.

Equal-width standard shots give a 25%-score damage floor. The formula-only launch
table, before flight drag, shows how its visible result changes:

| Target width | Gems | Equal-shot loss | Width afterward |
| ---: | ---: | ---: | ---: |
| 200 | 414 | 104 | 174 |
| 600 | 4768 | 1192 | 530 |
| 1000 | 17048 | 4262 | 905.5 |
| 1400 | 113964 | 28491 | 1366.5 |
| 1470, with 2m stock | 2000000 | 500000 | 1470 |

At two million gems, losing 25% of score changes neither physical width nor
ordinary speed. The first rounded 1470px body occurs at 1,227,436 gems; this is a
width threshold, **not a maximum gem inventory**.

The real-shot sweep uses widths 200/600/1000/1400, requested shooter ratios
0.9/1/1.19/1.2, surface gaps 100/350/650, and idle/outward/sideways responses.
There are 144 grid cells and 27 additional capped-stock cells. Outward retreat
helps in many near-peer cells, while idle victims are readily finished. The
existing 1.2× stored shooter-width shatter condition remains a sharp boundary.
Requested large ratios can be physically unavailable at the cap; the artifact
records actual widths rather than pretending a 1680px shooter exists.

These cell counts describe chosen fixtures. They are not measured player win
rates, and a second-shot shatter estimate does not grant ammunition or assume a
human could acquire and aim that next shot in time.

## Escape and weapon checks

The healthy escape sweep uses actual mouth-to-defender-edge reach, 60px/150px
runners, 300px/600px/1000px/1400px hunters, four starting reach shares, three
reaction delays, three directions, and no puff/front puff/rear puff. There are
864 cells. Reactions and events are quantized to 30Hz. The runner ramps analog
input over 200ms; the hunter tracks every 250ms. A puff still costs 75% of a full
breath and retains current impulse rules.

Smaller bodies do have a speed advantage: 60px walks at 243.15 units/s, 600px at
136.73, 1400px at 110.63 and 1470px at 109.29. Outer-range retreat against several
smaller giants escaped their cones. Starting inside the configured capture reach
often led to a catch on the first tick, before a delayed defense could occur.
At 1400px, the 2880-unit inhale reach also made the fixed arena relevant: some
outer-range runners survived all 12s but reached a wall while remaining in range.
That is not evidence that every such runner must be captured. A single puff did
not reliably turn already dangerous inner-range starts into escapes.

Weapon checks distinguish accepted damage budgets from real firing frequency:

- Accepted contacts are tested at the shared guard's 0/900/1800ms upper bound and
  at each weapon kind's cadence. Three accepted contacts are not a claim that a
  spinning gun can place three central hits. A `firstInjuringHit` of zero means
  none in those three tested contacts, not immunity for an entire match.
- Fifty-six actual swept armed-bolt fixtures confirm central/graze classification
  and damage for Pinwheel, Sentinel, Ricochet and Comet. Grazes never injured.
  Pulsar outer-only contact is correctly treated as zero damage, rather than
  incorrectly feeding a quarter-damage graze into its gate.
- Fifteen actual eight-second emitter fixtures retain normal activation cadence,
  rotation, orbital movement, aiming, arming and shared guards. A gun can miss,
  graze or consume a hollow bolt at close contact; theoretical accepted-hit
  sequences therefore overstate its opportunity to build injury pressure.

At 100k stock, a Pinwheel central hit loses 759 gems: 3.95% nominal mass credit
but about 0.14% actual body-mass loss. Two accepted hits can earn injury. At the
first rounded width cap, one 2659-gem hit earns injury: 12.31% nominal credit but
only about 0.068% physical mass loss. At two million stock, a 3395-gem central hit
can qualify while width stays exactly 1470. This is the separate late-stock
coupling issue, even though graze and protection rules work as implemented.

## Reproduce without mislabeling a future build

From the repository root, with the intended server already compiled:

```sh
node scripts/playtest-overall-combat.cjs --metadata-only
node scripts/playtest-weak-projectiles.cjs --metadata-only
node scripts/playtest-overall-combat.cjs > .tmp/overall-combat-run.log
node scripts/playtest-weak-projectiles.cjs > .tmp/weak-projectiles-run.log
```

Both drivers are self-contained and invoke no build. They report the execution's
actual Git revision, dirty `server`/`src` status and a SHA-256 over the compiled
JavaScript tree. The fixed reference revision/hash is a separate record.
`matchesReferenceBuild` becomes false for different compiled bytes; Git HEAD
alone is never presented as proof of which compiled mechanics executed.

The reference compiled tree contains 70 JavaScript files and hashes to
`d81e3d31942fbfef6eff1e8cd307751e0e672a350999833ddccc3d1630d2d6e1`.
Its compiled cannon module hashes to
`5c4417d7b03067a11bc6dace8d9dec91cea6db73fe6ddad3db64f8aa37bb2f8a`.
Drivers assert that tuning constants/profiles are unchanged before writing their
full results to `.tmp/overall-balance-combat.json` and
`.tmp/overall-balance-weak-projectiles.json`. Reruns do not overwrite the dated
historical artifact.

Do not use the older `game-loop-followup.cjs` or `injured-escape-study.cjs` as an
unchanged-rule baseline: they contain process-local coefficient/function trials.

## Limits

These are isolated server mechanics and scripted-control diagnostics. They do not
validate human balance, tutorial comprehension, network latency, crowded human
counterplay, optimal escape steering or whether the game feels fun. Hunters have
consistent decisions; defenders use deliberately simple movement. The reference
critical cells exclude walls and other damage, while the broader escape grid
explicitly records boundary contact. Native random spills cause small variations,
so exact theft totals should be read alongside the repeat ranges. No gameplay
change is authorized or validated merely because these scripts produced an
outcome.
