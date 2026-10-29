# Smaller bots around larger bots

630 seeded encounters in the authoritative 30 Hz world, seven physical size pairs × three body-edge gaps × front/side/rear orientation × healthy/injured larger opponent × five seeds. Both are ordinary bot brains with their usual delayed decisions, imperfect defense, movement, breath and turning. Neither starts with a captive or assembled weapon; no ambient gems or hazards. Stop at first small-player capture, either knockout or 12 seconds. Injury heals normally, after seven seconds. A separate shared-turnStep measurement isolates 90/180-degree turns; no bot-specific turn changes.

These are behavioral observations, not a human fairness or fun score. Capture ends the measured encounter; it is not a knockout. Injured means initially injured, not permanently unable to breathe. Theft/finish counts are emitted credits, so ongoing transfers without an end event are not counted. Finished clear means both are alive and body separation grew by at least 100 units.

| Small / large width | Body gap | Larger starts | Captured / 15 | First move retreats | First move approaches | Puffed | Theft/finish credit | Finished clear |
|---|---|---|---:|---:|---:|---:|---:|---:|
| 80 / 100 | 20 | healthy | 0 | 9 | 0 | 0 | 0 | 15 |
| 80 / 100 | 20 | injured | 0 | 0 | 15 | 0 | 15 | 3 |
| 80 / 100 | 100 | healthy | 0 | 9 | 0 | 0 | 0 | 15 |
| 80 / 100 | 100 | injured | 0 | 0 | 15 | 0 | 15 | 6 |
| 80 / 100 | 300 | healthy | 0 | 6 | 0 | 0 | 0 | 15 |
| 80 / 100 | 300 | injured | 0 | 0 | 15 | 0 | 9 | 9 |
| 100 / 130 | 20 | healthy | 15 | 2 | 0 | 0 | 0 | 0 |
| 100 / 130 | 20 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 100 / 130 | 100 | healthy | 15 | 2 | 0 | 0 | 0 | 0 |
| 100 / 130 | 100 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 100 / 130 | 300 | healthy | 9 | 6 | 0 | 6 | 0 | 6 |
| 100 / 130 | 300 | injured | 0 | 0 | 15 | 0 | 12 | 6 |
| 100 / 150 | 20 | healthy | 15 | 12 | 0 | 0 | 0 | 0 |
| 100 / 150 | 20 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 100 / 150 | 100 | healthy | 15 | 12 | 0 | 0 | 0 | 0 |
| 100 / 150 | 100 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 100 / 150 | 300 | healthy | 5 | 15 | 0 | 6 | 0 | 3 |
| 100 / 150 | 300 | injured | 0 | 0 | 15 | 0 | 12 | 6 |
| 200 / 300 | 20 | healthy | 15 | 12 | 0 | 0 | 0 | 0 |
| 200 / 300 | 20 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 200 / 300 | 100 | healthy | 15 | 12 | 0 | 0 | 0 | 0 |
| 200 / 300 | 100 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 200 / 300 | 300 | healthy | 12 | 12 | 0 | 9 | 0 | 2 |
| 200 / 300 | 300 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 400 / 600 | 20 | healthy | 15 | 2 | 0 | 0 | 0 | 0 |
| 400 / 600 | 20 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 400 / 600 | 100 | healthy | 15 | 2 | 0 | 0 | 0 | 0 |
| 400 / 600 | 100 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 400 / 600 | 300 | healthy | 11 | 0 | 0 | 9 | 0 | 2 |
| 400 / 600 | 300 | injured | 0 | 0 | 6 | 0 | 12 | 3 |
| 200 / 800 | 20 | healthy | 13 | 12 | 0 | 2 | 0 | 2 |
| 200 / 800 | 20 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 200 / 800 | 100 | healthy | 13 | 12 | 0 | 4 | 0 | 2 |
| 200 / 800 | 100 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 200 / 800 | 300 | healthy | 7 | 13 | 0 | 11 | 0 | 5 |
| 200 / 800 | 300 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 500 / 1000 | 20 | healthy | 14 | 13 | 0 | 1 | 0 | 1 |
| 500 / 1000 | 20 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 500 / 1000 | 100 | healthy | 15 | 13 | 0 | 0 | 0 | 0 |
| 500 / 1000 | 100 | injured | 0 | 0 | 15 | 0 | 15 | 0 |
| 500 / 1000 | 300 | healthy | 13 | 0 | 5 | 5 | 0 | 0 |
| 500 / 1000 | 300 | injured | 0 | 0 | 6 | 3 | 15 | 3 |

## Shared turning, while inhaling

| Body width | Maximum degrees/s | 90-degree turn | 180-degree turn |
|---|---:|---:|---:|
| 80 | 122.6 | 0.808s | 1.542s |
| 100 | 115.9 | 0.85s | 1.625s |
| 200 | 97.5 | 1.008s | 1.925s |
| 400 | 82 | 1.183s | 2.283s |
| 600 | 74.1 | 1.3s | 2.517s |
| 800 | 68.9 | 1.392s | 2.7s |
| 1000 | 65.2 | 1.475s | 2.85s |

```json
{
  "healthy": {
    "cases": 315,
    "captured": 232,
    "capturedUnderHalfSecond": 44,
    "capturedBeforeFirstMovement": 24,
    "captureMedianSeconds": 1.5,
    "initiallyRetreat": 176,
    "initiallyApproach": 5,
    "usedPuff": 53,
    "parried": 53,
    "theftOrFinishCredit": 0,
    "largerKnockedOut": 0,
    "endedClear": 68
  },
  "injured": {
    "cases": 315,
    "captured": 0,
    "capturedUnderHalfSecond": 0,
    "capturedBeforeFirstMovement": 0,
    "captureMedianSeconds": null,
    "initiallyRetreat": 0,
    "initiallyApproach": 297,
    "usedPuff": 3,
    "parried": 3,
    "theftOrFinishCredit": 300,
    "largerKnockedOut": 276,
    "endedClear": 36
  }
}
```
