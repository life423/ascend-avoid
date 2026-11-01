# Assembled weapons and large-player counterplay — October 26, 2026

November 1 local follow-up: [PROJECTILE_COUNTERPLAY.md](PROJECTILE_COUNTERPLAY.md)
supersedes the unchanged bolt speed/range/cadence statements in this historical
record. The direct/graze damage and shared guard described here remain intact.
The later approved [Pulsar crescent](PULSAR_CRESCENT.md) supersedes the full-ring
and 25%-share pulse statements below: 90-degree front, 1s locked charge, 30-degree
recovery turn, 15% central hit, no stun/steering lock. Shell grazes, guards and
once-only rewards remain. The newer candidates are not merged or deployed.

Developed from live/main `fcd7bf6` on `fix/large-player-weapon-fairness` and included in the `feat/group-pressure-arena-polish` release batch. GitHub main and the associated production workflow identify the published revision. Normal [localhost:3001](http://localhost:3001/) includes the change. These initial settings require human playtesting.

## What changed

Small bodies keep their full existing damaging hit area. For larger bodies, central weapon-hit radius stops growing at **90 world units**. Physical width determines every rule; raw gem score and bot/human identity do not select protection.

- Bolts still collide visibly with the body. A shot aimed through the central area deals the existing full damage at first surface contact, rather than passing through the body before counting. An outer-body graze deals **25%** of its ordinary damage, rounded to at least one gem, with no new injury or movement-locking skid. Existing injury and continued theft are neither cleared nor refreshed. Rays firing away from an overlapped player, and beam tips that cannot reach the central area, count as grazes.
- Pulsar waves must cross the smaller central area to damage or shove. Merely brushing a large outer body gives one quiet deflection flash, with no damage, injury or reward. A stationary or poorly positioned player can still take the original full 25%-share pulse hit. Early warning and wave speed/range are unchanged.
- Independent assembled weapons share a brief hit guard. It ramps linearly from **0ms at width 180** to **900ms at width 500**, then caps. Existing per-weapon cooldowns still apply. Actual hits and grazes can start it; blocked hits cannot extend it. Blocked bolts are consumed on body contact, preventing lingering shots inside giant bodies.
- A broken light-blue outer rim shows the remaining guard without covering the eyes or adding a panel. Small graze sparks have no full-hit sound, screen shake or banner. Builder tally/gems use actual lost value once; blocked/cosmetic contacts award nothing.

The guard affects assembled weapons only. Player-fired cannonballs, injury theft, capture, puff, black holes and normal incoming protections retain their rules. It clears on death and respawn. Ordinary movement/turning, growth, seven-second non-refreshing injury duration, sustained theft, capture controls, shot-follow, weapon bullet profiles/speeds, the Pinwheel per-bullet buff and spawn/escape rules are unchanged. The intentional injury-trigger distinction applies only to assembled-weapon grazes; direct hits still expose gems normally.

## Matched before/after controls

The same actual full-world test places a Pulsar 180 units from an isolated target's center. `warning-escape` moves away from the start of charge at ordinary movement speed; `idle` supplies no movement input. Passive decay runs, so the table reports credited weapon damage rather than treating every lost gem as damage. Small-body controls are unchanged. Data and the separate nine-set arena smoke are in [the recorded JSON](playtests/weapon-fairness-2026-10-26.json).

| Starting gems | Response | Damage before | Damage after |
| ---: | --- | ---: | ---: |
| 100 | Idle | 44 | 44 |
| 100 | Early retreat | 0 | 0 |
| 1000 | Idle | 437 | 437 |
| 1000 | Early retreat | 250 | 0 |
| 5000 | Idle | 2881 | 2182 |
| 5000 | Early retreat | 1248 | 0 |

The width-612, 5000-gem target can now escape this warning with its existing walking speed. Remaining still costs substantial gems; direct-hit damage profiles were not reduced. A cornered, late-reacting or deliberately exposed player is not guaranteed an escape. These controls establish a concrete counterplay improvement in this geometry, not final human balance.

All five bolt/beam recipes were exercised through real update paths at 5000 gems. Center hits retain original amounts; outer grazes give 43 instead of 170 for Pinwheel, 29 instead of 114 for Sentinel/Ricochet/Ion, and 53 instead of 213 for Comet Battery. Builder damage and gem rewards match the actual loss. Both bot and human targets use the same outcomes. Pulsar has the separate expanding-core rule above.

A seeded ten-minute, 20-AI full-arena smoke with nine construction sets recorded 105 defeats, all six recipes deployed, a peak of two width-500+ giants and one at the end. This is a smoke for continued combat/assembly, not a before/after claim about long-term rarity or human enjoyment.

## Verification and human playtest

All 26 unit suites, 18 multiplayer scenarios and 60 browser cases across ten profiles pass. Types, synced schema and production builds pass; lint has zero errors and 171 warnings.

Server regressions cover all recipes, center-line first contact, outer grazes, outgoing shots from overlapping weapons, finite beam tips, shell-only/full Pulsar contact, simultaneous independent weapons, consumed blocked shots, non-extending guards, reward conservation, non-refreshing injury, cleanup and cannon damage during weapon protection. Existing protections and lethal small-player/direct-hit behavior remain covered by the previous suites.

Browser checks cover ordinary keyboard and joystick retreat by a giant, actual builder collection/deployment, direct pulse injury, synced guard rendering, and existing Pinwheel/Pulsar controls across desktop, phone, landscape and tablet profiles. Viewport/touch emulation does not establish physical Android/iOS performance. Ubuntu browser CI remains deferred.

Human checks next: dodge a spiral by moving its center line away from the face; compare a core hit with a graze; retreat when a Pulsar charges; try a wall/corner; expose a giant to two different assembled weapons; confirm the short protection feels useful without making standing in fire safe. Keep testing shot/theft/puff counterplay too, since the blue rim is not general invulnerability.
