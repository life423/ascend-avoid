# Full-layout giant navigation investigation

Captured against `9344b16`, using its existing compiled server. No movement, growth, fan or black-hole tuning was changed. This is a reproducible playtest instrument, not proof of human balance or a CI assertion that the current blockage should remain.

## Reproduce the confirmed barrier

Run from the repository using the existing `server/dist` output:

```sh
node scripts/playtest-giant-navigation.cjs
```

The [fixture](giant-navigation-fixture.json) contains exact world coordinates and active-phase deadlines. The harness writes `.tmp/giant-navigation-fixture-results.json`, including numeric body clearances and movement tracks. It uses real `GameState.update`, steering, walking, fan housing correction, intake/wind and upkeep. Other players, traffic and weapons are removed from this focused replay. Hole phases are held fixed so a fan's end can be isolated from hole relocation. Natural fan deadlines are a separate control.

- World time: **6.333 seconds**, seed **73**; body width **1,470**. The artificial billion-gem fixture reaches the legal cap and makes no claim about ordinary progression.
- Start center: **(743, 743)**. Goal center: **(2208.56, 1882.88)**. Both are physically clear. Start fan clearance is **225.53**; goal fan clearance is **4.019**, hole clearance **156.052**, and wall clearance **1139.88**.
- Active fan centers: **t1 (1754, 2540)**, **t2 (1582, 1324)**, **t3 (3446, 2202)**. Live holes: **(3150, 1680)** and **(2100, 3108)**. The hole at **(1680, 420)** is a harmless warning.
- Inflating the actual obstacles by the player's radius forms a continuous barrier from the north wall through **t2 → t1 → bottom hole → south wall**. The same clear start/goal are in different regions at both 200- and 300-division grids, with continuous segment checks.
- Holding every fan active: continuous authoritative steering toward the goal does not arrive in **100 seconds**; it remains about **1,043 units** away. This direct control alone would not prove a trap; the continuous barrier and finer connectivity checks provide the stronger evidence.
- Letting only **t1** naturally end at world **67.8 seconds** opens a clear route. Steering along that route arrives at **78.833 seconds**, **11.03 seconds after opening**, before t2's **82.008-second** deadline. Letting all fans keep their natural deadlines yields the same arrival.

The body remains 1,470 wide. It starts without overlap or a fan-spawn push. Minor per-tick housing penetration peaks at **3.63 world units** during contact resolution. The result is **temporary compartmentalization until a fan powers down**, rather than a permanent trap or failure of the existing holes-only route guarantee.

## Broader route sample

```sh
node scripts/playtest-giant-navigation.cjs --full
```

This runs three deterministic default worlds, seeds **11, 29, 73**, for **180 seconds at 30 Hz**, with **20 autonomous bots**, default field gems, fans and weapons. Traffic retains its default disabled state. It samples physical-layout changes, then analyzes the complete active-fan/live-hole geometry at four body sizes. It writes `.tmp/overall-balance-routes.json`; selected clear routes and coarse disconnected examples are replayed through authoritative movement in frozen layouts.

| Gems used for the body | Width | Ordinary speed | Selected clear-route travel times, seeds 11 / 29 / 73 |
| --- | --- | --- | --- |
| 20,000 | 1,049 | 118.91/s | 24.77 / 43.73 / 30.90 seconds |
| 50,000 | 1,279 | 113.16/s | 31.00 / 24.90 / 28.30 seconds |
| 100,000 | 1,386 | 110.91/s | 14.10 / 26.03 / 30.60 seconds |
| Cap fixture | 1,470 | 109.29/s | 26.93 / 28.17 / 30.20 seconds |

All **12 deliberately routed clear cases** arrived. Their selected path lengths were **1.20–2.42 times** the straight-line distance. These are selected detour examples, not matched routes proving that one size travels faster than another. Fan airflow, ordinary upkeep and gem stripping remain enabled during the movement replay, so some bodies shrink slightly.

Coarse static connectivity is conservative: two of twelve chosen coarse disconnected start/goal pairs reconnect at finer resolution, and three direct movement controls eventually arrive with slight shrink/contact overlap. A coarse grid alone must not be reported as players being trapped. Exact corner/center points can also lie inside an expanded fan housing; the analysis records this separately and uses nearby legal free points. Its disconnected-interval counts describe those test anchors, not a percentage of players trapped.

An additional full-default-combat insertion sample put a cap-sized actor into a clear location at 15 seconds. Seed 11 retained width 1,470 throughout the remaining 165 seconds and produced one cancelled hole opening attributable solely to that actor: at world **165 seconds**, actor center **(2035.07, 1235.01)** blocked warning location **(2520, 420)**. The authoritative check passed when only that actor was omitted. Actors in seeds 29 and 73 later died/shrank, so those runs do not establish sustained giant exposure or a reliable cancellation frequency.

Ordinary overlap recovery is a separate case: growing a stationary body inside one existing hole rim, without fans, cleared a 457-unit initial overlap in **2.53 seconds**, with a **6-unit maximum tick correction**. That expected gradual recovery does not explain the confirmed initially clear fan barrier above.

## Related late-entry fan opening check

```sh
node scripts/playtest-giant-navigation.cjs --fan-opening
```

A 1,470-wide late entrant at a warning fan's center remains there until activation, then receives a **795-unit correction in one tick**. Normal walking covers **3.643 units per tick**. The configured warning is **3 seconds**; this body can walk **327.87 units** during it, or **273.22 units in 2.5 seconds**. Clearing the 60-unit housing from its center requires **795 units**, approximately **7.27 seconds** at ordinary speed.

This is a controlled late-entry/growth/forced-position fixture, not evidence that the normal selector places a fan under an already-present giant. `turbineSpot` already reserves existing players by **450 + body radius**: 1,185 units here. A max-sized body starting at that valid reservation cannot reach the housing through ordinary walking during the three-second warning. The observed gap is that activation does not repeat the player clearance check after the location was selected.
