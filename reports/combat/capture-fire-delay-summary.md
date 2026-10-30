# Capture-to-fire delay with 33% peer damage

User objective: keep knockouts frequent and rewarding. Survival alone is not a better result. See [method, interpretation and decision](../../docs/CAPTURE_FIRE_DELAY_STUDY.md).

21,870 conditional fight runs use the same server delay for players and bots. All timetables start at capture and overlap normal movement/aiming. Every opening shot is genuinely preloaded for the same three simulated seconds.

| Minimum wait | Side ammo / weave KOs | Side ammo / retreat KOs | Forward ammo / weave KOs | Fast side / weave KOs |
|---:|---:|---:|---:|---:|
| 0ms | 120/405 | 137/405 | 150/405 | 53/405 |
| 250ms | 120/405 | 137/405 | 150/405 | 53/405 |
| 500ms | 119/405 | 138/405 | 150/405 | 53/405 |
| 750ms | 120/405 | 139/405 | 147/405 | 53/405 |
| 1000ms | 120/405 | 139/405 | 138/405 | 53/405 |
| 1500ms | 117/405 | 149/405 | 141/405 | 45/405 |
| 2000ms | 117/405 | 149/405 | 134/405 | 44/405 |

Sources in that table use ordinary active bot brains. Fast means a primary knockout within five seconds after the guaranteed opening hit; it is not a failure grade. All body sizes and initial fighter/ammo distances are pooled; grouped results remain in JSON.

| Wait | Total population KOs | Body KOs | Flight KOs | KOs/min | Captures | Shots | Hits |
|---:|---:|---:|---:|---:|---:|---:|---:|
| 0ms | 260 | 157 | 103 | 8.667 | 125 | 117 | 80 |
| 1000ms | 260 | 157 | 103 | 8.667 | 125 | 117 | 80 |
| 1500ms | 238 | 150 | 88 | 7.933 | 106 | 102 | 75 |
| 2000ms | 270 | 157 | 113 | 9 | 130 | 126 | 99 |

Each population row combines three staged twenty-bot runs of ten minutes. Flight KOs classify actors flying in the preceding frame or launched as a captive in the death tick, including spent-missile burnup. Body KOs are the remaining deaths. These are not all giant or duel knockouts.

| Wait | Ordinary bot-policy primary KOs / 810 | Rear-ammo weaving primary KOs / 810 |
|---:|---:|---:|
| 0ms | 283 | 363 |
| 1000ms | 283 | 369 |
| 2000ms | 254 | 332 |

The last table pools active and explicitly idle ammo controls; use its paired timing comparison, not its absolute rate as a claim about normal earned ammo. Ordinary bot-policy primary KOs include both attacker and defender. Captures are counted separately.

See [full grouped results and source hashes](capture-fire-delay-summary.json) for size/distance breakdowns, rejection counts and matched-case 547 timing. These controlled observations do not prove human fun or settle the best delay.
