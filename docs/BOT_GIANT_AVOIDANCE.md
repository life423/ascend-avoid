# Bot giant awareness — release approved November 4, 2026

The user found that large players could collect smaller bots too easily. The
old proactive capture warning used a fixed 420-unit distance from a predator's
body edge, even though its inhale reaches `80 + 2 × physical width` from its mouth.
A 600-wide giant has 1,280 units of mouth reach.

## Behavior

`botCaptureThreat` preserves the existing nearby-body caution and additionally
uses the shared authoritative `airflowQuality` geometry to recognize a
capture-capable predator's mouth-facing reach, before that predator starts
inhaling. It accounts for the mouth offset, cone, physical body widths and the
bot's radius, with the existing 10-unit bot safety margin at the tip. It does not
assume that the visible body center is the mouth or that every size has the same
reach. Distant players behind or outside the mouth cone do not trigger the new
warning; the existing close-body warning still applies around nearby predators.

Only a healthy, alive player that meets normal capture eligibility can trigger
it. The extended warning does not apply while that player is captured, flying or
holding a captive. Existing close-body caution is preserved in those cases.
Ordinary injury expiry, size/facing changes and disconnects are read from current
authoritative state; there is no second injury timer or remembered danger expiry.

The nearest qualifying body keeps the existing threat ranking. Turbine intake
avoidance and active-suction lateral escape retain their previous checks.
A real capture threat can interrupt a stale crowd-dispersal destination, so that
destination cannot keep a bot walking into an otherwise recognized giant cone.
Bots still obey their ordinary think cadence, random mistakes, turning, movement,
breath and puff rules. They remain capturable at the mouth.

**No tuning constants changed.** Inhale reach, strength, capture eligibility,
ordinary speed, turning, injury, damage, 75% puff cost, shove, resource rates and
bot reaction/mistake settings are identical to the baseline. The user tested
the local build, reported that it feels good, and authorized committing, merging
and deploying it on November 4. The protected [main deployment workflow](https://github.com/life423/ascend-avoid/actions/workflows/deploy.yml)
records the published revision and release result.

## Verification

- Production build/package verification, client/server types, synced types and
  lint pass (existing repository lint warnings remain).
- All **52 server unit suites**, practice progress and weapon ownership checks
  pass. The focused suite checks **36 size/orientation combinations**, exact
  mouth-tip/body-radius boundaries, facing away, equal/uncapturable opponents,
  injury expiry, invalid long-range states, disconnects, nearest threat, crowd
  interruption, real brain decisions, normal reaction cadence, unchanged active
  escape, turbine precedence and an ordinary close-mouth capture.
- All **18 multiplayer scenarios** pass.
- **Six real-browser checks** pass: idle giants of widths 300 and 600 on desktop
  Chrome, emulated Android Chrome and emulated iPhone Safari. Each uses an actual
  production AI bot in a private local room, with no forced bot steering. Initial
  body-edge gaps were 528–974 units, beyond the former 420-unit trigger. With the
  giant remaining idle, the bots moved outward by at least 162–582 units during
  the 1.8-second observation. Bounds, capture/stun states and page errors pass.
- A UI-directed local room with 11 real bots and normal loose gems also showed
  a bot retreating 161 units while the giant remained idle, from approximately
  983 to 1,148 units from its body edge. The setup buttons position the giant;
  they never instruct a bot to flee.

## Paired scripted comparison

The same seeded **288 scenarios** were run against released `46cc5a0` and the
candidate. Physical predator widths 300/600/1000, bot widths 20/60/150, all four
cardinal orientations, eight seeds each. A stationary healthy giant faces a bot
for three seconds; then it starts a normal three-second aimed inhale pursuit.
A gem 500 units toward the giant competes for the bot's attention. Normal AI,
reaction timing, mistakes, movement, breath, puff and capture remain enabled.
Both reports contain deeply equal tuning constants.

| Six-second scenario metric | Baseline | Candidate |
| --- | ---: | ---: |
| Outward steering seen during the first second | 73 / 288 | 288 / 288 |
| Mean body-to-body gap before inhale begins | 640 | 1,230 |
| Captured during the short pursuit | 77 / 288 | 0 / 288 |
| Boundary violations | 0 | 0 |

This deliberately gives the bot three seconds to notice and retreat. **Zero
captures here is not invincibility or a human-match escape rate.** Close-mouth
capture still passes, and unchanged mistakes/defense rules still allow failure.
Crowded matches, surprise approaches, human balance and physical-device feel
need continued playtesting. Phone browser profiles are emulation, not hardware.

[Compact results](playtests/bot-giant-avoidance-2026-11-04.json) retain the
comparison, browser rows and limitations. Reproduce the current candidate with
`npm run build` then `node scripts/bot-giant-avoidance-playtest.cjs candidate`.
The ignored `.tmp` baseline was recorded before the production code was edited.

## Local review

Normal game: <http://localhost:3001/>.

For quick giant setup, run `node scripts/bot-giant-drill.mjs` after building and
open <http://localhost:3001/bot-giant.html>. It creates a private local room with
11 real bots. Use **Apply size**, then **Face a distant bot**; wait without
inhaling to observe early avoidance, or use ordinary controls to chase. **Turn
away** allows a facing comparison. The temporary controls are not product UI.
A fresh build removes this localhost-only drill page; it is not imported by the
game or included in a fresh production bundle. The server's existing production
checks disable the setup hooks.
