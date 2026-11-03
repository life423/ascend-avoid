# Confirmed rear-hit wall slip — release approved November 3, 2026

Implemented at the user's request on top of released `8a9f04a`. The user tested
it locally, reported that it feels good, and authorized committing, merging and
production deployment. The protected [main deployment workflow](https://github.com/life423/ascend-avoid/actions/workflows/deploy.yml)
records the published revision and release result. The 75% breath cost, existing front/rear recipient shove,
140-degree rear arc, range, ordinary movement and capture rules are unchanged.

## Interaction and bounds

Move along the wall and tap the existing puff control. A valid rear player hit
can now produce a short slip along that wall in the direction of your movement
input. The existing delayed rear sweep still has to hit a body or cross valid
inhale airflow. Holding a button, a nearby enemy or artwork alone never qualifies.
The effect is authoritative and uses the same path for humans and bots.

Only confirmed, nonzero rear impulse funds movement. Funding is the actual rear
impulse spent divided by the caster's snapshotted physical mass and the existing
rear-only shove multiplier (3). Removing that multiplier prevents the stronger
rear shove from tripling caster movement. The existing remaining-impulse budget
already deducts front hits; no second replenishing recoil meter is introduced.
Across all front/rear hits and later arrivals, total caster contribution is at
most the existing **420 world units/s per cast**. Recipient push is calculated
and applied exactly as before. Growth between cast and hit does not refill or
rescale the cast's funding.

A rear hit banks its allowance against the closest arena wall, rather than
adding free forward recoil in open space. The same rounded-wall projection and
`wallPuffRecoil` helper choose the tangent. The existing **12/s drag** bounds
wall proximity and travel to allowance/12: at most **35 world units**, generally
less. Clearance from the wall reduces the slip smoothly; no motion pulls the
caster toward the wall. Deliberate tangent input must exceed the existing 0.2
threshold. The caster keeps normal walking and turning throughout.

This is a wall-assisted movement contribution, not an equal-and-opposite rear
kick in open space. Front recoil is unchanged. There is no empty-puff dash, wider
hit region, added stun, damage, shield, inhale cancellation, pressure reset or
capture immunity. A failed escape can still be caught. Invalid owner states
(capture, death, launch, disconnect, stun/recovery) cannot gain a rear slip; the
existing wave lifetime and lifecycle cleanup remain authoritative.

The existing pair of short airflow wisps now also appears when the rear slip
actually occurs. Its separate receipt does not replay the front pulse or spend
breath twice. No panel, button, sound or menu-layout change was added.

## Verification and results

- Production build/package verification, client/server types, synced-type check
  and lint pass (lint retains existing warnings).
- All **51 server unit suites** plus practice-progress and weapon-ownership
  checks pass. The new suite includes **168 wall/curve/size/direction cases**,
  exact recipient shove, 75% spending, no speculative movement, open-space and
  no-input rejection, front/rear and later-target budgets, growth snapshots,
  invalid targets, pressure retention, actor parity and respawn cleanup.
- **33 chase checks:** 11 scenarios on desktop Chrome, emulated Android Chrome
  and emulated iPhone Safari, using normal keyboard/thumb controls. All final
  scenarios pass. Three initial large rear setups were caught before inhaling
  state could be observed; the usable large-player rear scenario starts farther
  back and passes on all profiles. This was a fixture correction, not a change
  to collision or capture rules.
- **42 additional browser regression checks** pass for all four walls in both
  directions, the rear sweep, 75% spending/repeat rejection, retained inhale,
  steering during gusts, ordinary body contact and weapon pushes.
- The same **1,872 scripted chases** were repeated at 30Hz and 60Hz. Neither run
  recorded out-of-bounds bodies, unintended movement locks or equal-size capture.
  The original study and baseline results remain in
  [CORNER_DEFENSE_PLAYTEST.md](CORNER_DEFENSE_PLAYTEST.md).

The change fixes activation from genuine rear hits. It does **not yet establish
better overall escape balance**. In the paired 72 capture-eligible running,
first-puff cases per boundary, slips increased from 0 to 5 at the straight wall
and from 0 to 5 at the curve. Six-second captures stayed 65 and 69 respectively.
Repeated-puff capture totals also remained unchanged, at both simulation rates.
Many existing starts approach from the flank and still miss both hit bands;
this change intentionally does not grant them a dash.

In the new rear-hit browser scenarios, every profile observed one rear hit, one
slip, the airflow cue, zero front recoil and exactly 25% breath left. The wall
case stayed free for six seconds. The medium curve case was caught at about
3.15–3.31s; the large curve case at about 2.07–2.19s. These new scenarios are
activation checks, not paired evidence of improved survival relative to release.
Requested curve setup gaps can shorten when a large pursuer is constrained
inside the rounded wall.

UI-directed local drills also confirmed a medium rear-hit curve slip followed
by capture at 3.1s, and a large curve slip followed by capture at 2.2s. A two-rear-
pursuer wall run produced two hits and one slip; three rapid taps accepted only
one puff and the defender stayed free for six seconds. A running flank-miss
trial spent one puff, produced no hit or slip, and ended in capture at 1.7s.
The fixture supplies an
ordinary sidestep while I time the puff through its UI; this is not human
multiplayer or physical-phone validation.

[Compact comparison and browser records](playtests/rear-wall-slip-2026-11-03.json)
retain these results. Physical Android/Firefox, human match feel, free-choice
escape paths, production bot strategy, meaningful black-hole-rim chases and the
corner fight/leaderboard overlap still need work. Keep the original top-right
Menu and minimap placement.

## Local review

Ordinary game: <http://localhost:3001/>. For an isolated repeatable chase, open:

<http://localhost:3001/corner-defense.html?site=wall&count=1&gems=221&ratio=1.35&gap=80&stance=run&approach=rear>

Choose **Start + sidestep**, then **Puff** while the tracker follows. Use Configure
and Reset scenario to change sizes, pursuers, approach or curve. These controls
belong only to the disposable local drill, not the game UI. Build output for it
is ignored and is removed by a fresh build; regenerate with
`node scripts/corner-defense-drill.mjs` after `npm run build`.

Reproduce the scripted matrix with `node scripts/corner-defense-playtest.cjs`
and `CORNER_PLAYTEST_HZ=60 node scripts/corner-defense-playtest.cjs`. Full rows
and screenshots are ignored under `.tmp/rear-wall-slip-*`.
