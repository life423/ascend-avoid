> Historical three-condition experiment. The current rule removes ammunition-size and speed gates; see docs/COMBAT_STUDY.md.

# Thirty actual missile-opened fights by body width

Authoritative 30 Hz world, ordinary capture/release/launch/hit, then fallible bot inputs; 45 seconds or first primary-fighter knockout. Ten body-size matchups × 80/360/800-unit body-edge gaps. Only the attacker starts with one captive; defender starts empty, no assembled weapons, parts or field gems. Scores are retained only as engine setup/debug values, not size comparisons. The living projectile retains normal rules without an independent third combat controller.

Simulation outcomes describe combat opportunities, not measured human fun or latency fairness. Width is body diameter in world units, independent of camera zoom. A 1.20× width ratio means 20% wider, not 20% more area or score.

| Fight | Shooter / target width | Width ratio | Ammo / target width | Gap | Opening shatter | Seconds | Outcome |
|---|---|---|---|---|---|---|---|
| 1 | 100 / 100 | 1.000× | 0.315× | close (80) | no | 4.53 | attacker wins |
| 2 | 100 / 100 | 1.000× | 0.315× | medium (360) | no | 6.2 | attacker wins |
| 3 | 100 / 100 | 1.000× | 0.315× | long (800) | no | 45 | unresolved |
| 4 | 200 / 200 | 1.000× | 0.502× | close (80) | no | 2.3 | attacker wins |
| 5 | 200 / 200 | 1.000× | 0.502× | medium (360) | no | 4.47 | attacker wins |
| 6 | 200 / 200 | 1.000× | 0.502× | long (800) | no | 45 | unresolved |
| 7 | 400 / 400 | 1.000× | 0.600× | close (80) | no | 45 | unresolved |
| 8 | 400 / 400 | 1.000× | 0.600× | medium (360) | no | 23.33 | attacker wins |
| 9 | 400 / 400 | 1.000× | 0.600× | long (800) | no | 17.33 | attacker wins |
| 10 | 650 / 650 | 1.000× | 0.616× | close (80) | no | 5.7 | attacker wins |
| 11 | 650 / 650 | 1.000× | 0.616× | medium (360) | no | 5.77 | attacker wins |
| 12 | 650 / 650 | 1.000× | 0.616× | long (800) | no | 37.63 | attacker wins |
| 13 | 900 / 900 | 1.000× | 0.639× | close (80) | no | 5.7 | attacker wins |
| 14 | 900 / 900 | 1.000× | 0.639× | medium (360) | no | 5.7 | attacker wins |
| 15 | 900 / 900 | 1.000× | 0.639× | long (800) | no | 5.77 | attacker wins |
| 16 | 200 / 250 | 0.800× | 0.482× | close (80) | no | 3.9 | attacker wins |
| 17 | 200 / 250 | 0.800× | 0.482× | medium (360) | no | 4.23 | attacker wins |
| 18 | 200 / 250 | 0.800× | 0.482× | long (800) | no | 45 | unresolved |
| 19 | 500 / 650 | 0.769× | 0.471× | close (80) | no | 20.77 | attacker wins |
| 20 | 500 / 650 | 0.769× | 0.471× | medium (360) | no | 15.13 | attacker wins |
| 21 | 500 / 650 | 0.769× | 0.471× | long (800) | no | 45 | unresolved |
| 22 | 300 / 240 | 1.250× | 0.650× | close (80) | yes | 0 | attacker wins |
| 23 | 300 / 240 | 1.250× | 0.650× | medium (360) | yes | 0 | attacker wins |
| 24 | 300 / 240 | 1.250× | 0.650× | long (800) | yes | 0 | attacker wins |
| 25 | 900 / 700 | 1.286× | 0.650× | close (80) | yes | 0 | attacker wins |
| 26 | 900 / 700 | 1.286× | 0.650× | medium (360) | yes | 0 | attacker wins |
| 27 | 900 / 700 | 1.286× | 0.650× | long (800) | yes | 0 | attacker wins |
| 28 | 100 / 150 | 0.667× | 0.407× | close (80) | no | 5.07 | attacker wins |
| 29 | 100 / 150 | 0.667× | 0.407× | medium (360) | no | 45 | unresolved |
| 30 | 100 / 150 | 0.667× | 0.407× | long (800) | no | 45 | unresolved |

```json
{
  "fights": 30,
  "openingHits": 30,
  "attackerWins": 23,
  "defenderWins": 0,
  "unresolved": 7,
  "openingShatters": 6,
  "sizeAdvantageFinishes": 6,
  "underTwoSeconds": 6,
  "medianSeconds": 5.73,
  "counterHitFights": 0,
  "theftFights": 20,
  "weaponHitFights": 0
}
```
