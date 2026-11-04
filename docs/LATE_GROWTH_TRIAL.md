# Later growth on the existing arena — local trial

November 4, 2026. The user wants continued **physical growth**, including a larger
maximum body, and explicitly wants the arena size retained for now. Bot count is
also retained. The user does not know the score at which growth feels unrewarding;
that is what this investigation is intended to help establish.

The user subsequently reviewed the local version, said it feels good, and
approved commit, main merge and live deployment on November 4. This review does
not establish broad human balance; the production workflow records the rollout.

## Measurement and initial change

The released extra taper began at width 630 and approached 1,260. It already
rounded away almost all further width gains in sufficiently long runs. Doubling
50,000 to 100,000 gems earned just 6.8% width; the next doubling earned 3.3%.

The initial local trial changes only two growth constants: extra taper starts at
**840** (20% of the shorter arena side), and maximum width approaches **1,470**
(35%). The arena remains **4,200 × 4,200**. Opening growth, the underlying mass
curve, gem rewards, upkeep, field supply and bot population are unchanged.

| Gems | Released width | Local trial width |
|---:|---:|---:|
| 1,000 | 301 | 301 |
| 5,000 | 612 | 612 |
| 10,000 | 794.5 | 820.5 |
| 20,000 | 958.5 | 1,049 |
| 50,000 | 1,123 | 1,279 |
| 100,000 | 1,199.5 | 1,386 |
| 200,000 | 1,239.5 | 1,441.5 |
| 1,000,000 | 1,259.5 | 1,469.5 |

Width gain below 5% per score doubling is an **analysis proxy**, not a measured
human preference. The released curve crosses it around 69,000 gems; this trial
around 83,000. Doubling 50,000 now earns 8.4%, but gains still eventually flatten.
Increasing a finite cap postpones that problem; it does not produce unlimited
rewarding growth. A maximum body is 16.7% wider and 36.1% heavier than the old one.

Reproduce after building with:

```sh
node scripts/growth-curve-study.mjs docs/playtests/growth-curve-2026-11-04.json
```

The [recorded measurements](playtests/growth-curve-2026-11-04.json) also include
physical mass, ordinary speed and inhale reach. No movement/capture/inhale formula
changed, but a larger width inherently means greater reach/mass, slower movement
and different capture matchups. Maximum walking speed falls from about 113.6 to
109.3 under the same formula. Those consequences need a human match review.

### Movement measurements

| Width | Units/second | Seconds per body width | 90° turn from rest |
|---:|---:|---:|---:|
| 301 | 162.5 | 1.9 | 0.73s |
| 612 | 136.1 | 4.5 | 0.83s |
| 1,049 | 118.9 | 8.8 | 0.97s |
| 1,279 | 113.2 | 11.3 | 1.00s |
| 1,470 | 109.3 | 13.5 | 1.03s |

Turns use the actual shared acceleration/turn helper at 30Hz. Walking values are
top speeds; starting/stopping and routes introduce additional time. A half-width
player remains 18.9% faster, and a player at the minimum healthy capture ratio
remains about 6.8% faster before suction/contact. The maximum giant needs roughly
25s to traverse the available straight arena span. Full authoritative routes
from corners to the middle take 18.7–20.7s in the revised hole-only layout.

The user's goal is **big and slow, without tedious movement**. Keep these speed
constants for the first human comparison, record actual camera-relative travel
and detours, then decide whether a speed-curve change is needed. A flat floor
would remove size-based escape advantages among players on that floor. These
measurements do not establish that 109 units/second feels right.

## Geometry, camera and known constraints

The existing boundary helper already handles bodies whose half-width exceeds the
700-unit wall radius by using inset straight edges. No collision formula change
was required. Tests now explicitly include the new maximum rather than assuming
all legal bodies are narrower than the corner radius. Both old 1,260-wide giants
and new 1,470-wide giants remain covered.

The original fixed upper holes formed corner pockets for the larger body.
Following the user's direction to accommodate growth through layout, the local
starting positions move those two holes from 30% to **40% arena height**:
`(1050,1680)` and `(3150,1680)`. The lower hole remains `(2100,3108)`.
Physical body/rim/core sizes and all damage rules are unchanged. The top corridor
now has 130 units of spare center clearance beyond the full 1,470-wide body.

An independent route search checks continuous segment/circle clearance, then
actual authoritative walking follows routes from every corner to the middle
for both actor roles. Full-body clearance holds at every tick, with no speed
bonus, teleport or gem damage beyond unchanged upkeep. The older hole layout
remains as a growth-overlap recovery regression, not the current starting layout.
Fans, other players and assembled weapons are excluded from this route proof;
crowded-match routing still needs review. Periodic relocation with safe placement
and warnings is a separate agreed future feature, not implemented by this static
starting-layout adjustment.

Camera tests verify the viewport stays inside the rounded arena and keeps the
player's central body visible across desktop, phone orientation changes and
growth/knockout/respawn. They do not promise the entire circumference at every
curved wall. Top-left HUD/face overlap remains an existing review item.

The user also requested attention to seeing the end of a giant's inhale. Current
body-proportional zoom already runs into the finite-arena portrait limit: at
maximum width the cone is 3,020 units beyond the mouth, often outside the map.
Full-cone visibility cannot be guaranteed alongside the visible-body/no-exterior
requirements. The subsequent [inhale framing](INHALE_CAMERA.md) implementation
adds a bounded, smooth forward pan. The user explicitly rejected inhale-driven
zoom; view scale still depends on body size and arena fitting alone.

Full 55 server suites plus multiplayer/build/type/schema/lint checks pass alongside the earned
weapon-injury work. The 21-case camera/injury browser run passes across desktop
Chrome, emulated Android Chrome and emulated iPhone Safari. Separate giant
corner movement checks cover all four corners through ordinary keyboard/joystick
input (12 cases). Four additional Firefox desktop/phone-viewport injury/camera
checks pass, as do four full-body live-hole corridor checks across Chrome desktop,
Android emulation, iPhone emulation and Firefox phone viewport: **41 browser cases
in total**. Actual phone hardware and broad human balance remain unvalidated.

Normal play: <http://localhost:3001/>. Controlled size/weapon review:
<http://localhost:3001/growth-review.html>, generated with
`node scripts/growth-injury-drill.mjs` after building. The normal feature requires
no opt-in flag. The disposable review page only prepares encounters.

## Next assessment

Compare 20k, 50k, 100k and maximum bodies in ordinary fights: visible progression,
small-player escape, giant-vs-giant combat, crowding, hole/fan routes, camera
readability and weapon injury. Observe recordings and width gains over time.
Do not raise the cap further solely because the score counter can keep climbing.
