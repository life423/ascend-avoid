# Thirty actual missile-opened fights by body width

All bullets have 60-unit bodies. Capture transfers excess growth immediately. A shooter at least 20% wider shatters on any player-missile hit.

Authoritative 30 Hz world, ordinary capture/release/launch/hit, then fallible bot inputs; 45 seconds or first primary-fighter knockout. Ten body-size matchups × 80/360/800-unit body-edge gaps. Only the attacker starts with one captive; defender starts empty, no assembled weapons, parts or field gems. Scores are retained only as engine setup/debug values, not size comparisons. The living projectile retains normal rules without an independent third combat controller.

Simulation outcomes describe combat opportunities, not measured human fun or latency fairness. Width is body diameter in world units, independent of camera zoom. A 1.20× width ratio means 20% wider, not 20% more area or score.

| Fight | Shooter / target width | Width ratio | Ammo / target width | Gap | Opening shatter | Seconds | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | 100 / 100 | 1.000× | 0.600× | close (80) | no | 45 | unresolved |
| 2 | 100 / 100 | 1.000× | 0.600× | medium (360) | no | 45 | unresolved |
| 3 | 100 / 100 | 1.000× | 0.600× | long (800) | no | 45 | unresolved |
| 4 | 200 / 200 | 1.000× | 0.300× | close (80) | no | 3.2 | attacker wins |
| 5 | 200 / 200 | 1.000× | 0.300× | medium (360) | no | 4.37 | attacker wins |
| 6 | 200 / 200 | 1.000× | 0.300× | long (800) | no | 45 | unresolved |
| 7 | 400 / 400 | 1.000× | 0.150× | close (80) | no | 3.1 | attacker wins |
| 8 | 400 / 400 | 1.000× | 0.150× | medium (360) | no | 3.47 | attacker wins |
| 9 | 400 / 400 | 1.000× | 0.150× | long (800) | no | 45 | unresolved |
| 10 | 650 / 650 | 1.000× | 0.092× | close (80) | no | 3.2 | attacker wins |
| 11 | 650 / 650 | 1.000× | 0.092× | medium (360) | no | 4.33 | attacker wins |
| 12 | 650 / 650 | 1.000× | 0.092× | long (800) | no | 45 | unresolved |
| 13 | 900 / 900 | 1.000× | 0.067× | close (80) | no | 3.83 | attacker wins |
| 14 | 900 / 900 | 1.000× | 0.067× | medium (360) | no | 4.27 | attacker wins |
| 15 | 900 / 900 | 1.000× | 0.067× | long (800) | no | 6.93 | attacker wins |
| 16 | 200 / 250 | 0.800× | 0.240× | close (80) | no | 4.33 | attacker wins |
| 17 | 200 / 250 | 0.800× | 0.240× | medium (360) | no | 6.1 | attacker wins |
| 18 | 200 / 250 | 0.800× | 0.240× | long (800) | no | 45 | unresolved |
| 19 | 500 / 650 | 0.769× | 0.092× | close (80) | no | 4 | attacker wins |
| 20 | 500 / 650 | 0.769× | 0.092× | medium (360) | no | 5.37 | attacker wins |
| 21 | 500 / 650 | 0.769× | 0.092× | long (800) | no | 45 | unresolved |
| 22 | 300 / 240 | 1.250× | 0.250× | close (80) | yes | 0 | attacker wins |
| 23 | 300 / 240 | 1.250× | 0.250× | medium (360) | yes | 0 | attacker wins |
| 24 | 300 / 240 | 1.250× | 0.250× | long (800) | yes | 0 | attacker wins |
| 25 | 900 / 700 | 1.286× | 0.086× | close (80) | yes | 0 | attacker wins |
| 26 | 900 / 700 | 1.286× | 0.086× | medium (360) | yes | 0 | attacker wins |
| 27 | 900 / 700 | 1.286× | 0.086× | long (800) | yes | 0 | attacker wins |
| 28 | 100 / 150 | 0.667× | 0.400× | close (80) | no | 4.4 | attacker wins |
| 29 | 100 / 150 | 0.667× | 0.400× | medium (360) | no | 45 | unresolved |
| 30 | 100 / 150 | 0.667× | 0.400× | long (800) | no | 26.07 | defender wins |

```json
{
  "fights": 30,
  "openingHits": 30,
  "attackerWins": 20,
  "defenderWins": 1,
  "unresolved": 9,
  "openingShatters": 6,
  "sizeAdvantageFinishes": 6,
  "underTwoSeconds": 6,
  "medianSeconds": 4.35,
  "counterHitFights": 2,
  "theftFights": 11,
  "weaponHitFights": 0
}
```
