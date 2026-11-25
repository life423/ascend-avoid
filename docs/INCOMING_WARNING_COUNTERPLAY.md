# Incoming-warning counterplay study — November 25, 2026

**Historical baseline, followed by a local fix:** the 177 encounters below
precede exact launch-event provenance. The later fix warns before impact in all
27 repeated near-edge idle controls; [its separate data](playtests/incoming-origin-fix-2026-11-25.json)
preserves the distinction. This does not supply missing dodge time. The user
subsequently rejected firing windup and approved bot shot visibility limits;
[the later bot/camera audit](BOT_SHOOTING_AND_CAMERA.md) records those changes and
isolated speed/range evidence. Nothing has been published.

The current local warning does **not reliably provide enough time to dodge**.
Visibility and counterplay remain separate requirements. This study changes no
runtime movement, flight, damage, injury, capture or bot rules, and publishes
nothing. The candidate is still local on `codex/mobile-bullet-warning-audit`.

[Per-encounter data, source/build hashes, summaries and physics comparisons](playtests/incoming-warning-dodge-2026-11-25.json)
record the tested revision and local candidate. The earlier released-code audit
is preserved in [MOBILE_PROJECTILE_AUDIT.md](MOBILE_PROJECTILE_AUDIT.md).

## Method and scope

177 controlled browser encounters used real captured ammunition, normal firing,
the standard 60-unit bullet and authoritative server collisions. Every recorded
launch was verified to start completely outside the actual camera view.
Defenders had physical widths **20, 101.5 and 196.5**; gem counts only prepared
those sizes. The main shooter was approximately 310 units wide, launching near
1847 units/s. A weaker 101.5-unit shooter launched near 1364 units/s, including
an equal-width rival matchup. No projectile was teleported through a flight.

The core matrix has 126 encounters: desktop Chromium at 1280×720, Android Chrome
portrait emulation at 412×839 and landscape at 839×412; left, above and diagonal
approaches; near-edge and distant launches; idle controls and a 250ms scripted
wait. Portrait also includes a 400ms wait. Near setups put the center 60 world
units beyond the ray/viewport intersection (radius 30 plus a 30-unit ray buffer);
normal edge clearance varies with direction. Distant centers start 1650 world
units from the defender. Actual launch positions and view bounds are retained.

The remaining 51 encounters cover zero added delay, fresh thumb acquisition,
50ms delay in **each** network direction, slower responses under that delay,
weaker shooters and already-moving joystick turns. The TCP relay delays actual
WebSocket traffic as well as HTTP. Measured game RTT was approximately 114–126ms.
It is not an HTTP-only network-throttling simulation.

The renderer's actual coral cue draw records the first painted warning command.
Impact messages identify contact; injury or gem loss alone is not used as a hit
proxy. Trusted Chromium touch events operate the real joystick, and keyboard
events operate desktop movement. Screenshots are taken only after the encounter
so capture work cannot block the dodge. All recorded movement inputs were trusted.

The response values are **chosen waiting periods**, not measured human reaction
statistics. Actual touch events in the core 250ms portrait cohort arrived about
282–314ms after the cue, including automation/input delivery. The study grants a
perfect perpendicular direction choice and open space. It does not measure
recognition, human success rates, physical Pixel behavior, walls or crossfire.
No physical Android device was attached. Negative replicated-movement times in
the already-moving group mean movement preceded the cue; in hit controls,
movement after impact can be knockback, not a successful voluntary dodge.

## Main results

These are the 250ms-wait core cohorts, not population success probabilities:

| Layout | Near-edge dodges | Distant dodges | Near-edge cases without a cue before impact |
| --- | ---: | ---: | ---: |
| Desktop | 0 / 9 | 6 / 9 | 4 / 9 |
| Phone portrait | 0 / 9 | 6 / 9 | 4 / 9 |
| Phone landscape | 0 / 9 | 6 / 9 | 4 / 9 |

The phone portrait results by physical size are:

| Defender width | Near-edge dodges | Distant dodges |
| ---: | ---: | ---: |
| 20 | 0 / 3 | 3 / 3 |
| 101.5 | 0 / 3 | 3 / 3 |
| 196.5 | 0 / 3 | 0 / 3 |

All nine near-edge phone trials with **zero added waiting time** also hit.
Their actual touch delivery still takes time; this is not an instantaneous human
response claim. Some no-cue cases are detection failures, and others visibly
warn but leave insufficient movement time. One landscape cue preceded impact
by only 93.5ms. The smallest defender also fails, so larger bodies are not the
only concern. Every idle control in all study groups was hit.

Distant strong-shot idle controls generally have approximately 0.91–1.04s from
warning paint to impact. Smaller and medium defenders can use that interval.
Fresh-thumb tests preserve their distant escapes; already-moving defenders
redirect successfully in all six distant tests. This does not certify every
joystick/tutorial transition.

With the weaker 101.5-unit shooter, both near-edge 250ms attempts hit, including
the equal-width rival. Both distant attempts escaped. Under the delayed network,
the 400ms-wait small defender escaped in both tested directions, while the
101.5-unit defender was hit in both; corresponding local core cases escaped.
Delivery and server movement consume part of the remaining margin.

## A remaining visibility defect

Across all 63 near-edge core trials, **32 had no cue painted before impact**.
This count includes repeated geometries with different responses and is not a
production incidence estimate. All 63 launches were actually off-screen.

Two additional frame-trace reproductions verify a first-receipt origin failure.
For the small defender's above-edge shot, the public launch event places the
bullet center at y≈1449.60, with the viewport beginning at y≈1509.60. The entire
30-radius body is outside. Its first rendered/public sample is already at
y≈1535.01 with a reported flight age of 29ms. Reconstructing the origin from
that age and current velocity puts part of the inferred body inside the view.
The renderer consequently classifies it as an ordinary visible launch.

The launch event and first-step age/motion are not interchangeable origin
records. The current renderer checks the reconstructed origin only on fresh
receipt and then retains the false classification. Later samples can reconstruct
an outside origin without recovering the cue. The medium defender reproduces
the same effect. Raw frame traces are included with the data.

Use the actual public launch coordinates/history for this distinction rather
than relying solely on age/velocity reconstruction. Keep warnings conditional on
predicted contact and off-screen provenance; ordinary visible launches and clear
misses should continue to stay quiet. This fix has **not** been implemented by
this measurement task.

## Mechanical bounds

108 additional comparisons replay the 54 core idle geometries through the actual
`fireCaptive`, movement, flight and collision code at the configured 30Hz cadence
and an optimistic 120Hz integration. Binary searches find the latest successful
normal perpendicular input; their resolution is limited by the simulation tick.
There is no browser, network or human recognition delay in these comparisons.

For the phone's nearest left-side shots, an immediate perpendicular input at
launch still hits at **all three widths**, at both cadences. This is a bound for
the tested sidestep, not a proof about every possible action or anticipation.

For the distant left-side reference, approximate movement-only lead needed is
170ms at width 20, 400ms at width 101.5 and 690ms at width 196.5 in the finer model.
A 250ms response allowance raises those to roughly 420/650/940ms **before** input,
network and rendering margins. These values depend on the tested geometry and
impact speed; they are not universal constants or proposed final balance values.

## Next work

1. Exact off-screen launch history is now fixed locally, preserving quiet visible
   shots/misses. Keep that evidence separate from the baseline above.
2. Firing windup was rejected. Compare shared speed/range and camera exposure
   independently, checking ordinary visible attacks, damage/KO side effects,
   black-hole shots and tutorials. Initial isolated results are in the later audit.
3. Apply any selected gameplay rule equally to bots and humans. Preserve the
   size/speed hierarchy and standard bullet; do not promise every giant a dodge.
4. Validate recognition, thumb response, frame pacing and latency on the user's
   physical Pixel, then repeat with moving attackers, walls and crossfire.

All 177 experimental recordings and their setup assertions completed; that does
not mean 177 escapes. Two diagnostic traces completed, and the three existing
Android warning regressions still pass with the generalized test fixture. Runtime
code/balance is unchanged in this pass. Evidence and scripts remain local under
`.tmp/nov25-dodge-*`; the normal preview remains `http://127.0.0.1:3281/`.

## Local pre-fire warning for hidden shooters (November 25)

A hollow coral crescent beside the defender marks the direction of a loaded shooter completely outside that defender's camera. The line must remain on course for 100 ms of world updates. It must predict contact within 500 ms from the real muzzle at the current facing, accounting for player movement, projectile size and drag. A nearer body, a lethal black hole or the arena wall can disqualify the line. Losing the line clears the cue and restarts qualification. A real incoming shot takes priority and uses the existing filled arrow. Holding aim produces one steady cue with no sound or repeated pulse. Bots can observe the same geometry through their own camera and use their existing reaction delay.

These are provisional warning thresholds. They do not change firing, damage, player movement or camera rules. A shooter can hold a valid line and decide against firing. Conversely, someone who snaps onto the line and fires immediately can beat the 100 ms filter. Measure those cases separately from trajectories that would genuinely miss.

In two controlled portrait encounters on a physical Pixel 10 Pro XL, one fixed firing direction and a scripted release 650 ms after alignment made the comparison repeatable. The standing defender saw the cue 459 ms before release and was hit 231 ms after the launch event. On the second attempt, touch input arrived 289 ms after the cue, the defender cleared the line and the shot missed. These are automated responses on real hardware. The attacker's time spent aiming determines the advance notice in ordinary play.

Three four-minute, 20-bot simulations (seeds 174, 222 and 695, normal bullet settings) produced 44 launches. Sampling each defender with a size-based portrait view at 15 Hz produced eight distinct aim-warning episodes. In six episodes the same shooter fired that captive during the warning or within 300 ms of its last sample. Two ended without a matching launch in that interval. These counts describe cue frequency in this sample. They do not measure human intent or imply that every launch should receive an early cue.

## Smaller, slower local build

The 50-unit shell travels at 85% of the October launch speed. Its 2.6-second
maximum flight time shortens its open-arena reach by the same proportion.
Only an eligible incoming shot gets a coral outline in the defender's view.
Every living cannonball has its captive's color, an ivory leading rim and a
short pale-blue wake. The visible shell and swept collision circle share a
diameter. See the [ordinary shot](playtests/portrait-bullet-2026-11-25/ordinary-shot.png)
and [incoming shot](playtests/portrait-bullet-2026-11-25/incoming-shot.png) in portrait emulation.

In 1,080 controlled launches, held aim qualified for all 432 contacts inside
the 500 ms prediction window and stayed quiet in the other 648. Of those
648 trajectories, 208 hit later. The comparison used three shooter sizes,
two defender sizes, three distances, four headings, five offsets and three
lateral velocities. This measures trajectory prediction on a held line.

In six four-minute 20-bot simulations, 94 launches produced five distinct
aim cues. One was followed by a launch from that shooter with that captive
during the cue or within 300 ms afterward. Four expired without a matching
launch in that interval. An attacker can turn away after genuinely lining up
a shot. A snap shot can still arrive before a human can react.
