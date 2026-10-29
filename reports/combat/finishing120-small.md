> Historical three-condition experiment. The current rule removes ammunition-size and speed gates; see docs/COMBAT_STUDY.md.

# Thirty actual missile-opened fights by body width

Authoritative 30 Hz world, ordinary capture/release/launch/hit, then fallible bot inputs; 45 seconds or first primary-fighter knockout. Five visible shooter widths (100/200/400/650/900 world units) × six shooter/target WIDTH ratios (1/1.1/1.15/1.2/1.3/1.5), with balanced close/medium/long spacing. Ammunition is selected by visible width and capped at what the shooter can legally capture before the normal growth transfer. Only the attacker starts with one captive; defender starts empty, no assembled weapons, parts or field gems. Scores are retained only as engine setup/debug values, not size comparisons. The living projectile retains normal rules without an independent third combat controller.

Simulation outcomes describe combat opportunities, not measured human fun or latency fairness. Width is body diameter in world units, independent of camera zoom. A 1.20× width ratio means 20% wider, not 20% more area or score.

| Fight | Shooter / target width | Width ratio | Ammo / target width | Gap | Opening shatter | Seconds | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | 100 / 100 | 1.000× | 0.470× | close (80) | no | 4.67 | attacker wins |
| 2 | 100 / 90.5 | 1.105× | 0.470× | medium (360) | no | 4.77 | attacker wins |
| 3 | 100 / 86.5 | 1.156× | 0.474× | long (800) | no | 45 | unresolved |
| 4 | 100 / 83 | 1.205× | 0.464× | close (80) | no | 45 | unresolved |
| 5 | 100 / 76 | 1.316× | 0.474× | medium (360) | no | 45 | unresolved |
| 6 | 100 / 66.5 | 1.504× | 0.474× | long (800) | yes | 0 | attacker wins |
| 7 | 200 / 200 | 1.000× | 0.450× | medium (360) | no | 5.37 | attacker wins |
| 8 | 200 / 181.5 | 1.102× | 0.452× | long (800) | no | 45 | unresolved |
| 9 | 200 / 173.5 | 1.153× | 0.458× | close (80) | no | 3.13 | attacker wins |
| 10 | 200 / 166.5 | 1.201× | 0.453× | medium (360) | no | 5.1 | attacker wins |
| 11 | 200 / 153.5 | 1.303× | 0.456× | long (800) | no | 11.73 | attacker wins |
| 12 | 200 / 133 | 1.504× | 0.459× | close (80) | no | 5.77 | attacker wins |
| 13 | 400 / 400 | 1.000× | 0.451× | long (800) | no | 21.03 | attacker wins |
| 14 | 400 / 363.5 | 1.100× | 0.451× | close (80) | no | 2.5 | attacker wins |
| 15 | 400 / 347.5 | 1.151× | 0.450× | medium (360) | no | 4.03 | attacker wins |
| 16 | 400 / 333 | 1.201× | 0.452× | long (800) | no | 28.1 | attacker wins |
| 17 | 400 / 307.5 | 1.301× | 0.450× | close (80) | no | 3.23 | attacker wins |
| 18 | 400 / 266.5 | 1.501× | 0.450× | medium (360) | no | 3.77 | attacker wins |
| 19 | 650 / 650 | 1.000× | 0.450× | close (80) | no | 3.37 | attacker wins |
| 20 | 650 / 590.5 | 1.101× | 0.450× | medium (360) | no | 45 | unresolved |
| 21 | 650 / 565 | 1.150× | 0.450× | long (800) | no | 45 | unresolved |
| 22 | 650 / 541.5 | 1.200× | 0.451× | close (80) | no | 2.6 | attacker wins |
| 23 | 650 / 500 | 1.300× | 0.450× | medium (360) | no | 45 | unresolved |
| 24 | 650 / 433 | 1.501× | 0.450× | long (800) | no | 45 | unresolved |
| 25 | 900 / 900 | 1.000× | 0.450× | medium (360) | no | 5.77 | attacker wins |
| 26 | 900 / 818 | 1.100× | 0.450× | long (800) | no | 22.4 | attacker wins |
| 27 | 900 / 782.5 | 1.150× | 0.450× | close (80) | no | 5.8 | attacker wins |
| 28 | 900 / 750 | 1.200× | 0.450× | medium (360) | no | 28.07 | attacker wins |
| 29 | 900 / 692 | 1.301× | 0.450× | long (800) | no | 6.03 | attacker wins |
| 30 | 900 / 600 | 1.500× | 0.450× | close (80) | no | 26.17 | attacker wins |

```json
{
  "fights": 30,
  "openingHits": 30,
  "attackerWins": 22,
  "defenderWins": 0,
  "unresolved": 8,
  "openingShatters": 1,
  "sizeAdvantageFinishes": 0,
  "underTwoSeconds": 1,
  "medianSeconds": 5.92,
  "counterHitFights": 0,
  "theftFights": 20,
  "weaponHitFights": 0
}
```
