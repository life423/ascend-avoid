# Thirty actual missile-opened fights by body width

All bullets have 60-unit bodies. Capture transfers excess growth immediately. A shooter at least 20% wider shatters on any player-missile hit.

Authoritative 30 Hz world, ordinary capture/release/launch/hit, then fallible bot inputs; 45 seconds or first primary-fighter knockout. Five visible shooter widths (100/200/400/650/900 world units) × six shooter/target WIDTH ratios (1/1.1/1.15/1.2/1.3/1.5), with balanced close/medium/long spacing. Ammunition is selected by visible width and capped at what the shooter can legally capture before the normal growth transfer. Only the attacker starts with one captive; defender starts empty, no assembled weapons, parts or field gems. Scores are retained only as engine setup/debug values, not size comparisons. The living projectile retains normal rules without an independent third combat controller.

Simulation outcomes describe combat opportunities, not measured human fun or latency fairness. Width is body diameter in world units, independent of camera zoom. A 1.20× width ratio means 20% wider, not 20% more area or score.

| Fight | Shooter / target width | Width ratio | Ammo / target width | Gap | Opening shatter | Seconds | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | 100 / 100 | 1.000× | 0.600× | close (80) | no | 45 | unresolved |
| 2 | 100 / 90.5 | 1.105× | 0.663× | medium (360) | no | 45 | unresolved |
| 3 | 100 / 86.5 | 1.156× | 0.694× | long (800) | no | 45 | unresolved |
| 4 | 100 / 83 | 1.205× | 0.723× | close (80) | yes | 0 | attacker wins |
| 5 | 100 / 76 | 1.316× | 0.789× | medium (360) | yes | 0 | attacker wins |
| 6 | 100 / 66.5 | 1.504× | 0.902× | long (800) | yes | 0 | attacker wins |
| 7 | 200 / 200 | 1.000× | 0.300× | medium (360) | no | 5.3 | attacker wins |
| 8 | 200 / 181.5 | 1.102× | 0.331× | long (800) | no | 45 | unresolved |
| 9 | 200 / 173.5 | 1.153× | 0.346× | close (80) | no | 3.53 | attacker wins |
| 10 | 200 / 166.5 | 1.201× | 0.360× | medium (360) | yes | 0 | attacker wins |
| 11 | 200 / 153.5 | 1.303× | 0.391× | long (800) | yes | 0 | attacker wins |
| 12 | 200 / 133 | 1.504× | 0.451× | close (80) | yes | 0 | attacker wins |
| 13 | 400 / 400 | 1.000× | 0.150× | long (800) | no | 45 | unresolved |
| 14 | 400 / 363.5 | 1.100× | 0.165× | close (80) | no | 2.53 | attacker wins |
| 15 | 400 / 347.5 | 1.151× | 0.173× | medium (360) | no | 3.77 | attacker wins |
| 16 | 400 / 333 | 1.201× | 0.180× | long (800) | yes | 0 | attacker wins |
| 17 | 400 / 307.5 | 1.301× | 0.195× | close (80) | yes | 0 | attacker wins |
| 18 | 400 / 266.5 | 1.501× | 0.225× | medium (360) | yes | 0 | attacker wins |
| 19 | 650 / 650 | 1.000× | 0.092× | close (80) | no | 3.27 | attacker wins |
| 20 | 650 / 590.5 | 1.101× | 0.102× | medium (360) | no | 3.17 | attacker wins |
| 21 | 650 / 565 | 1.150× | 0.106× | long (800) | no | 5.63 | attacker wins |
| 22 | 650 / 541.5 | 1.200× | 0.111× | close (80) | yes | 0 | attacker wins |
| 23 | 650 / 500 | 1.300× | 0.120× | medium (360) | yes | 0 | attacker wins |
| 24 | 650 / 433 | 1.501× | 0.139× | long (800) | yes | 0 | attacker wins |
| 25 | 900 / 900 | 1.000× | 0.067× | medium (360) | no | 3.77 | attacker wins |
| 26 | 900 / 818 | 1.100× | 0.073× | long (800) | no | 10.6 | attacker wins |
| 27 | 900 / 782.5 | 1.150× | 0.077× | close (80) | no | 2.83 | attacker wins |
| 28 | 900 / 750 | 1.200× | 0.080× | medium (360) | yes | 0 | attacker wins |
| 29 | 900 / 692 | 1.301× | 0.087× | long (800) | yes | 0 | attacker wins |
| 30 | 900 / 600 | 1.500× | 0.100× | close (80) | yes | 0 | attacker wins |

```json
{
  "fights": 30,
  "openingHits": 30,
  "attackerWins": 25,
  "defenderWins": 0,
  "unresolved": 5,
  "openingShatters": 15,
  "sizeAdvantageFinishes": 15,
  "underTwoSeconds": 15,
  "medianSeconds": 1.26,
  "counterHitFights": 0,
  "theftFights": 3,
  "weaponHitFights": 0
}
```
