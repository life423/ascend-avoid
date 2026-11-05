# Overall population study — November 4, 2026

The compact, tracked data is [overall-population-2026-11-04.json](overall-population-2026-11-04.json).
It preserves selected time series, first milestones, body/projectile death counts,
leader and seeded-giant summaries, critical before/after impact states and hashes.
Full tick/event traces remain ignored local artifacts.

Release: `9344b163c1c5295a5b17435248d362c75e760995`.
Six ten-minute arenas (fresh and separately seeded giant mixes, seeds 11/73/218)
plus one thirty-minute continuation used full compiled GameState updates at 30 Hz.
Each had twenty actors: nineteen bots and one human-flagged actor driven by the
ordinary BotBrain. No balance settings were patched. Traffic, bombs and shifts
remained disabled under production defaults; fans, field gems, weapons and holes
retained their defaults. This is accelerated authoritative simulation, not human
play, networking, rendering, input latency or fun validation.

The thirty-minute case repeats the first ten minutes of fresh seed 11 exactly
(both five-second population snapshots and event histories). It is longer
evidence, not a fourth independent opening seed. Compiled-file and tuning hashes
are in the [tracked data](overall-population-2026-11-04.json) and ignored raw manifest; the compiled hash remained
`8e7bed250ce41d36ed0bc610eb719b121f8ea1ac4eeaece2742cd3c7cdda1b7d`.

## Natural progression

| Fresh seed | First width 100 / 300 / 500, arena seconds | Peak gems / width | Body / flight deaths | Captures / shots |
| --- | --- | --- | --- | --- |
| 11, 10 minutes | 48.90 / 176.97 / 326.63 | 6,950 / 704 | 21 / 53 | 64 / 60 |
| 73, 10 minutes | 45.33 / 169.10 / 309.83 | 5,676 / 646 | 30 / 63 | 73 / 71 |
| 218, 10 minutes | 54.87 / 167.97 / 438.97 | 5,625 / 643.5 | 24 / 42 | 50 / 50 |
| 11, 30 minutes | same opening | 11,473 / 868.5 | 65 / 162 | 183 / 178 |

These milestone times describe the first actor in the arena to reach a size,
not a typical new player's progress. Across the three ten-minute openings,
118 of 290 observed newborn lives reached width 100, 22 reached 300, and eight
reached 500. Some lives were still underway at the observation boundary, so these
counts are not estimated success probabilities. No actor reached width 1000 in
the natural thirty-minute case. Thus this study does not show the late size cap
limiting ordinary bot progression in thirty minutes.

The fresh arenas had 9/8/17 qualifying leader entries (minimum 100 gems), with
longest uninterrupted tenures of 182/416/137 seconds. The thirty-minute case had
34 entries and a longest tenure of 232 seconds. A leader can lose gems/rank before
eventually dying; a zero count of deaths while ranked first on the previous tick
must not be interpreted as former leaders never dying.

## Reproduced weak-impact injury cascade

The most actionable balance finding is that ordinary body projectiles can cause
the full injury opening even when their direct damage is tiny relative to a
giant. These are observed seeded episodes, not hypothetical formula comparisons.

* Giant mix, seed 11, 51.30 seconds: a shooter with snapshotted width **56.5**
  fired a width-60 captive carrying 12 gems. It hit an uninjured, unstunned,
  unprotected width-1380.5 target holding **95,562 gems**, spilling **91 gems**.
  The next state had a deadline at 58.30 seconds and **450 ms of stun**.
  Theft notices ending in those seven seconds credited **68,321 gems** to three
  successive attackers. The initial leader lost first place at 57 seconds.
* Giant mix, seed 218, 27.27 seconds: an **unowned turbine-launched player** of
  width **24.5**, carrying two gems, hit an uninjured, unstunned, unprotected
  width-1410.5 target holding **127,440 gems**. Its **nine-gem** spill created a
  deadline at 34.267 seconds and **450 ms of stun**. Theft notices ending in that
  seven-second opening credited **83,628 gems**; a further 9,878-gem cannon hit
  occurred at 31.50 seconds. At 35 seconds the target had 22,534 gems, width
  1084.5 and no injury, confirming the repeated hit did not refresh the window.

`cascade-reproductions.json` stores exact before/after states, physical positions,
velocities, projectile kind and shooter snapshot, plus injury and current defense
events. Focused replay population prefixes match the full runs. Theft credits are
end-of-run notices rather than per-tick transfer events; the raw notice timing is
preserved. The source applies injury for any positive surviving body-projectile
spill. This deserves a deliberate human review, not an unrequested balance fix.

## Established giants, weapons and defense

The separate artificial mixes granted 20k/50k/100k gems once and used existing
safe-spawn placement. They add 170k gems to the economy and consume extra setup
RNG; their growth is not comparable to earned opening progression. The original
100k actor died at **385.53 / 38.53 / 39.10 seconds** across seeds 11/73/218;
five of the nine original seeded giants died within ten minutes. Giants were
therefore defeatable in these simulations, with substantial variation and strong
injury/theft cascades. Those observations do not establish human fairness.

Every weapon recipe activated in every ten-minute arena. Fresh runs averaged
0.90–0.94 active weapons and peaked at three or four; there was no observed recipe
starvation. Captive ammunition was available, with 187 captures and 181 player
launches across the fresh runs. Of those captures, 136 targeted bodies below
width 100; only ten were performed by captors already at width 500 or above.
Spent-ammunition deaths dominate total death counts and are kept separate from
ordinary-body defeats throughout the report.

Current defense events were counted directly, without an obsolete `parry`
dependency: fresh runs emitted 63/92/76 accepted `exhale` events, 34/52/43
`gustHit` events and 3/4/6 `wallSlip` events. Gust hits can have multiple recipients
and do not enumerate every front shove, so these are not accuracy percentages.
Focused replays retain their event timelines.

## Hole relocation and state checks

All slots repeatedly reopened. In the fresh ten-minute runs, each opened nine
times; there were no failed candidate-placement retries but 6/8/11 total aborted
warnings after their final safety revalidation. The longest completed continuous
absence of a rim, including dormant time, retries and repeated warnings, was
10.5–15.5 seconds in those fresh runs and **20.5 seconds** in the giant mixes and
thirty-minute continuation. One giant-mix slot was still absent for 19.5 seconds
at the observation boundary, so that interval is censored rather than called a
completed maximum. Nominal dormant-plus-warning time is 5.5 seconds; safety
revalidation can make the visible relocation cycle longer.

No finite/nonnegative/population assertion failed. No opening-case overdue spawn
wait was observed; the giant mixes contained two waits of approximately 0.53
seconds. These checks do not substitute for boundary, accounting, protection or
collision unit tests, or for manual warning/readability review.

## Evidence and regeneration

The tracked [compact JSON](overall-population-2026-11-04.json) retains the selected
case summaries, minute samples, giant first lives, critical cascade states and
source/compiled/tuning hashes. It contains no full tick traces. The data is a
historical November 4 result; a future run must use its actual checkout metadata.

The [driver](../../scripts/overall-balance-population.cjs) requires an existing
compiled server and never builds or changes tuning. It records actual Git HEAD,
authoritative source and compiled-file hashes, plus tuning and Node version.
`9344b163` remains the reference release, with explicit .25 rival floor, 60-unit
bullets, 1.2 shooter finisher, 7000-ms injury and 20-player assertions. Git HEAD
alone does not prove that a pre-existing build corresponds to the source; inspect
both hashes before comparing a new run with this report.

From the repository root, regenerate all full raw cases and their manifest:

```sh
node scripts/overall-balance-population.cjs
```

This runs three ten-minute openings, three separate ten-minute giant mixes and
one thirty-minute continuation with two isolated workers. Full population
snapshots every five seconds, events, deaths, lives, leaders, holes and hashes go
to `.tmp/overall-balance-population/`. The `.tmp` directory is intentionally ignored.
No live backend, browser or production deployment is involved.

Regenerate the short enriched cascade traces without rerunning the full study:

```sh
node scripts/overall-balance-population.cjs --case giant-mix 11 65 .tmp/overall-balance-population/cascade-giant-mix-11-65.json
node scripts/overall-balance-population.cjs --case giant-mix 218 45 .tmp/overall-balance-population/cascade-giant-mix-218-45.json
```

Their `impactDetails` and `injuryTransitions` preserve before/after positions,
physical sizes, velocities, injury, stun and protection. Their `events` retain
current `exhale`, `gustHit` and `wallSlip` timelines. The compact historical JSON
preserves the selected cascades even when raw files are regenerated or deleted.

The original local analysis also produced ignored `summary.json`,
`minute-timeseries.csv`, `cascade-reproductions.json` and `findings.md`; these are
convenient working artifacts, not prerequisites for the tracked report. Future
raw results need fresh analysis rather than overwriting this dated result as if
nothing changed. Syntax validation and a 61-second prefix replay checked the
metadata-only driver update; no full balance study was repeated for that change.

Legacy harness audit: `game-loop-followup.cjs` sets `PEER_HIT_SHARE=0` even in its
default `current` mode and optionally patches impact damage.
`rival-damage-population.cjs` deliberately runs 0/.25/.33 floor variants.
`balance-playtest.cjs` accepts growth/decay/hole overrides and labels a 1000-gem
case as a giant. `game-loop-review.cjs` accepts a floor override and its custom
visible-world policies use older threat heuristics. None was used as current-rule
population evidence here.
