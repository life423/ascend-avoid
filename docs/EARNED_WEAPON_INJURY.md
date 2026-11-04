# Earned assembled-weapon injury — local trial

November 4, 2026. Reviewed locally and approved for commit, main merge and live
deployment. The production workflow records the published revision and result.

All six assembled weapons now earn injury through a meaningful accepted central
hit or concentrated damage. Existing damage, builder gem rewards/tallies,
knockouts, firing cadence, geometry, grazes, pushes and shared guards are retained.
Player cannonballs, turbine launches and other damage sources retain their injury
rules. Injury still lasts exactly seven seconds and active injury never refreshes.

## Provisional rule

- A hit contributes `actualLostGems × 0.5 / bodyMass(preHitWidth)`. The 0.5 is the
  existing gem-to-growth-mass conversion, not a new damage multiplier.
- Injury requires total contribution **0.05** within a rolling **2,000 ms**.
  One strong hit can qualify immediately. Otherwise each hit expires independently;
  trickling hits cannot keep old contributions alive indefinitely.
- Contributions belong to the victim and may combine accepted hits from different
  weapons/builders. Existing per-weapon and shared guards still reject damage;
  rejected hits add nothing and cannot refresh contribution lifetimes.
- Grazes cost the same gems as before but never contribute. Active injury does not
  bank the next burst. Capture, launch, other injury, protection, knockout,
  respawn and disconnect clear pending contributions. No new synchronized field
  or UI meter is added. The existing cracked shell appears only on earned injury.
- Weak damage leaves ordinary breathing and puff available. Once injured, the
  existing breathing/puff restrictions apply. This does not add injured puff.

This is **nominal impact credit**, not a calculation of actual visible shrink.
The nonlinear growth curve, late taper and half-unit rounding make those different.
Each hit snapshots its normalized share before damage; later growth/shrink never
rescales earlier credit. The tuning lives in `WEAPON_INJURY`.

## Numerical examples

Using the separate local growth trial (20% taper start / 35% maximum), with no
prior damage or contribution:

| Target gems / width | Weapon | Unchanged gem loss | Mass credit | Single-hit injury |
|---|---|---:|---:|---|
| 1,000 / 301 | Machine gun | 76 | 8.39% | Yes |
| 5,000 / 612 | Machine gun | 170 | 4.54% | No |
| 5,000 / 612 | Sentinel / Ricochet / Ion | 114 | 3.04% | No |
| 5,000 / 612 | Comet cannon | 213 | 5.69% | Yes |
| 20,000 / 1,049 | Machine gun | 340 | 3.09% | No |
| 20,000 / 1,049 | Comet cannon | 425 | 3.86% | No |
| 20,000 / 1,049 | Pulsar core | 3,000 | 27.26% | Yes |

Two accepted machine-gun hits at 5,000, or two comet hits at 20,000, earn injury
within the window. The 900ms large-body shared guard permits concentrated fire
to qualify without counting every machine-gun bullet. Sparse or very weak hits
may continue damaging without injury. A slow Sentinel alone cannot always reach
the threshold against the largest targets; this is part of the playtest.

Important remaining balance dependency: existing weapon gem damage grows with
target gem score while physical width is bounded. At an extreme 1,000,000 gems,
even a machine-gun hit removes 2,400 gems, which exceeds this mass threshold in
one hit. This change does **not** promise that light weapon models can never
injure a giant, and does not silently replace existing damage curves. Evaluate
whether nominal impact credit needs a separate upper bound in a later decision.

## Verification and local review

- New focused server suite covers single/burst thresholds, physical scaling,
  rolling expiry, shared guard rejection, grazes, no active refresh/banking,
  exact accounting, both actor roles and lifecycle/capture cleanup.
- Existing real-weapon fairness tests cover every recipe, direct/grazing contact,
  multiple builders, original pushes/rewards, protections and cannon separation.
- Full 55 server suites plus practice-progress/ownership checks pass. All 18
  multiplayer scenarios, build, types, synced-schema check and lint pass (161
  existing lint warnings, zero errors).
- Browser runs across desktop Chrome, emulated Android Chrome and emulated iPhone
  Safari verify real placed comet shots: first hit costs gems without injury,
  ordinary keyboard/touch puff still works, second hit earns injury, and a third
  does not refresh it. Pulsar warning/retreat/core-injury regressions also pass.
  The combined camera/injury run has 21 passing cases. See the growth report for
  the separate larger-body corner checks.

Normal local play includes the rule at <http://localhost:3001/>. For a controlled
review, build, run `node scripts/growth-injury-drill.mjs`, then open
<http://localhost:3001/growth-review.html> on the development server. Choose a
gem count, Apply, then Set up enemy weapon. Setup uses existing guarded hooks;
shots, damage, injury and controls run through ordinary server code. Collapse
the review panel for an unobstructed view. Fresh builds remove generated review
pages; no review panel is part of the shipped game.

These checks establish mechanics, not human enjoyment or final balance. Physical
Android Firefox performance and Ubuntu browser runs remain deferred.
