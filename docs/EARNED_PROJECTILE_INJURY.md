# Earned player and fan projectile injury

Implemented November 4, 2026, after the overall combat review. The user approved
release with the growth-accounting fix on November 5. The production workflow
records the published revision and rollout result. The provisional qualification threshold is
`PROJECTILE_INJURY.MIN_POWER_SHARE = 0.08`. Human balance is not validated by
automated encounters.

## Behavior

A surviving player struck by a body projectile still takes the same accepted
gem damage, brief stun, drift and existing recovery protection. A chip hit no
longer automatically starts the full injury/breathing block. A meaningful hit
starts the same fixed, non-refreshing **seven-second** injury window. Existing
injury is neither cleared by a weak hit nor extended by another hit.

The server qualifies accepted positive-damage impacts using pre-hit physical
width, ammunition's existing impact mass and the existing launch snapshots. It
does not use the defender's gem bank or divide lost gems by a nominal gem mass.
Thus identical bodies struck by the same shot qualify identically at two million
or one hundred million gems. This does not fix capped-size shrinkage itself.

## Qualification

`projectileInjuryPower` expresses the existing proportional impact power without
its flat gem-damage term. It uses `bodyMass(width)`, the existing speed factor
(clamped to 0.65–1.15), missile/fan mass pivots and maximum impact share. Deliberate
player shots retain the existing bounded shooter-mass bonus and physical
shooter-to-target rival-share floor. Both shooter values are immutable launch
snapshots; later growth, death or disconnect cannot change them. Fans receive
neither shooter term.

In compact form, with the existing cannon constants:

```text
relativeMass = (ammoMass + boundedStoredShooterBonus) / targetMass
massPower = min(maxShare, maxShare × relativeMass / (relativeMass + pivot) × pace)
playerRivalPower = min(maxShare, peerShare × (storedShooterWidth / targetWidth)²)
power = max(massPower, playerRivalPower)  // rival term is player shots only
injury = acceptedPositiveDamage && power >= 0.08
```

Illustrative launch-state comparisons (speed 1,250, standard 60-unit player
ammunition and existing shooter bonus):

| Shooter width → target width | Normalized power | New injury |
| --- | ---: | --- |
| 150 → 300 | 0.0625 | No |
| 200 → 300 | 0.1111 | Yes |
| 300 → 300 | 0.2500 | Yes |
| 600 → 1,470 | 0.0416 | No |
| 1,470 → 1,470 | 0.2500 | Yes |

A 54-unit fan projectile striking a 1,470-unit body at speed 1,150 has power
approximately 0.00044 and remains a chip hit. A sufficiently substantial fan hit
against a small body still earns injury. The threshold is a power gate, **not a
claim that eight percent of visible physical mass is removed**. No concentrated
burst accumulator was added for body projectiles.

## Preserved scope

Damage formulas/ceilings, launch speed, drag, flight attribution, hit geometry,
spawn/impact protection, stun, fixed injury duration, walking, growth, puff,
capture controls and knockout/reward handling are unchanged by this gate. A lethal hit still
uses the existing lethal path rather than being made nonlethal by this gate.
Humans and bots share the same flight-impact path. A weak hit still has its
existing brief stun; breathing returns when that response ends if the target
has no other injury.

Assembled weapons keep their separate meaningful-hit/burst gate. Its nominal
gem-damage credit can still depend on excess banked gems at the size ceiling.
That extreme-bank injury-credit dependence remains open. Persistent physical
growth is implemented separately in [GROWTH_ACCOUNTING.md](GROWTH_ACCOUNTING.md);
it is not part of this projectile gate.

## Local verification

Normal game: <http://localhost:3001/>. Controlled review:
<http://localhost:3001/projectile-injury.html>. Select an encounter and press
Launch; the local player is the target and keeps ordinary controls. Reset starts
a fresh isolated encounter. The collapsible setup panel exists only on this
disposable local page, not in ordinary play or production. Regenerate it after a
build with `node scripts/projectile-injury-drill.mjs` while serving the local
development server. No gameplay opt-in flag is involved.

Focused server checks cover actual capture/firing and fan launches, small/peer
hits, high-bank invariance, unchanged accepted damage, stored shooter power,
non-refreshing expiry, protection, lethal credit and human/bot parity. The full
server suite and browser/network checks are recorded with the current candidate
in [TODO.md](TODO.md).

All 28 projectile/rival/injury browser cases pass across desktop Chrome, Android
Chrome emulation, iPhone WebKit and Firefox phone viewport. The four meaningful
hit cases were also rerun after strengthening their assertion: wait until the
brief stun/skid ends, then hold longer than the action's tap threshold while
injury is still active. Breathing stays blocked until the original deadline,
then a fresh press works. Weak cases observe the actual post-hit state patch
before pressing; a pre-impact `stunned=false` is not mistaken for recovery.
These are desktop engines/device emulation, not physical Android Firefox tests.

The original tiny-shot pressure driver was rerun against this compiled candidate:
72 encounters across 20k/50k/100k/1m defenders, real player/fan launches, zero to
two small pursuers and idle/retreating responses. All 72 remained non-injuring,
with no injury theft or knockout in those controlled encounters. Damage still
occurred. [Recorded outcomes](playtests/PROJECTILE_INJURY_LOCAL.json) identify the
dirty candidate's compiled-tree hash, rather than presenting the unchanged HEAD
as the tested gameplay. These scripted encounters establish the removed exploit
path, not whether the provisional threshold feels best in human matches.
