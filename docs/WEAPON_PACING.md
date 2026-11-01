# Staggered weapon availability — November 1 local candidate

The user's audit identified nine builds across six recipes appearing at seconds
5–6.2. Bots can assemble/deploy too, and an active weapon does not prevent its
builder collecting another. The requested follow-up paces **component availability**,
without removing recipes, adding actor restrictions or imposing a deployment cap.

The local starting point releases one three-piece build at second **5**, then
**17, 29, 41, 53, 65, 77, 89 and 101**. Replacements use the same shared 12-second
minimum spacing, after their existing 20s/35s retirement delay. The oldest eligible
set goes first. Empty rooms and overdue/long ticks cannot release a catch-up pile.
No countdown, permanent status panel or new arena label was added.

The later [arena-spacing pass](ARENA_SPACING.md) can defer a blocked set, retaining
its queue priority and retrying after 250ms. Only a successful placement spends
the shared 12-second release interval; it still cannot release a catch-up pile.

Completed cargo may still be held and deployed together; this deliberately does
not promise a hard limit on simultaneous attacks. Bots and humans share all access,
collection, deployment, damage and defenses. Existing assembly restrictions remain.

## Comparison

Build the server, then run `node scripts/weapon-pacing-study.cjs --long`.
The [24 full-world runs](playtests/weapon-pacing-2026-11-01.json) compare three seeds
at three and ten minutes, using original timing and 8s/12s/16s release intervals.
Each room has a protected stationary observer plus 19 ordinary bots, all recipes,
normal collection, movement, combat, respawns and standard field/arena hazards.
The original timing control uses the **current local combat changes** in all arms;
it is not a recreation of an older deployed gameplay revision.

| Interval | 3-minute peak active, three seeds | 10-minute peak active | Mean active in 10-minute runs | Seconds at 4+ active, 10-minute runs |
| --- | --- | --- | --- | --- |
| Original 150ms opening; no shared spacing | 8 / 7 / 8 | 8 / 7 / 8 | 1.73 / 1.63 / 1.72 | 30.9 / 35.6 / 50.6 |
| 8 seconds | 3 / 3 / 3 | 5 / 4 / 4 | 1.33 / 1.29 / 1.26 | 16.8 / 5.1 / 6.9 |
| **12 seconds** | **2 / 3 / 2** | **3 / 4 / 3** | **0.91 / 0.90 / 0.93** | **0 / 1.6 / 0** |
| 16 seconds | 2 / 2 / 2 | 3 / 3 / 2 | 0.73 / 0.66 / 0.71 | 0 / 0 / 0 |

Twelve seconds is an initial compromise: appreciably less pressure than 8s while
preserving more opportunities than 16s. New-build component peaks drop from 27 to
6 in the three-minute samples and 9–12 in the longer samples. The candidate still
had one brief four-weapon overlap and occasional activations within half a second.
It does not make simultaneous deployments impossible.

Later fights diverge as timing changes, so seeds are reproducible samples rather
than identical paired fights. Three seeds, stationary observation and bot decisions
do not establish human fun, universal peak limits, fair visibility on every phone
or long-term giant balance. Inspect real human fights and multi-weapon readability
before further tightening. No bot-specific weakening or automatic owner limits.

Unit coverage checks exact first-release deadlines, one-at-a-time overdue releases,
oldest-request ordering, empty rooms and repeated calls within a tick. Normal
retirement and bot/human assembly/deployment tests remain. Two real synced-room
browser cases pass on desktop and Android phone emulation, checking first release,
the quiet interval and second release. Build/types pass, lint reports no errors,
all 42 server suites plus progress checks pass, and the final 18 multiplayer
scenarios pass. Publishing is paused.
The script's default is a shorter exploratory run with a separate output filename;
it cannot overwrite this complete long-run evidence.
