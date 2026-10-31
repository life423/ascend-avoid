# Tutorial remodel plan

October 31 follow-up: implementation and local verification are complete, and the
user authorized commit, merge and deployment after review. GitHub's PR and
production workflow record release completion. Human/device review remains a
follow-up, not a claim established by the automated checks.

October 31, 2026. The user approved implementing this plan for the new escape
wave, split-shell injury, soft contact and safer respawns. **Implemented locally
on `codex/wrap-wave-shell-spawns`; not merged or deployed.**
[PRACTICE_TUTORIAL.md](PRACTICE_TUTORIAL.md) records current behavior and verification.
The design/work-order sections below preserve the approved plan. They build on
the local gameplay work described in DEFENSE_CONTACT_RESPAWN.md.

The five-lesson completion matrix now passes on desktop, phone portrait and
landscape, tablet, and 320px reduced-motion layouts. Implementation and automated
verification are separate from the still-pending uncoached human/physical-phone
review described in the release criteria below.

## Direction

Use five short, playable lessons. Split the overloaded first lesson and bring
defense ahead of the advanced black-hole/assembled-weapon lessons. Each stage
has one immediate action and advances only after its actual gameplay result.
The main arena remains the destination; no compulsory tutorial or new permanent
live-game instruction panels are introduced.

Keep the user's existing decisions: first-visit Play tutorial / Not now;
Start full tutorial at the top of the menu; automatic progression through the
whole sequence; every individual lesson unlocked; Skip lesson and Exit tutorial
always available. Skipping stays unfinished. Retrying restores only the failed
attempt, retaining earlier learned steps. Repeated misses add one clearer hint.

## Current code problems this must resolve

1. Defense asks the learner to face the attacker and rewards an immediate front
   parry. PracticeController.observe fails any other exhale immediately, then
   resets in 100ms. The new rear wall forms at 220ms: a valid rear escape puff
   can be reset before it works. A cast must enter a resolution state, not fail
   merely because it has not already parried in the same tick.
2. PracticeController.afterTick treats all learner injury as failure. Wounded
   escape needs an explicit expected-injury stage, preserving the real breathing
   restrictions rather than bypassing them for the tutorial.
3. Basics combines growth, capture, shooting, theft and finishing. It asks for
   aiming without first teaching the mobile drag/lift/tap interaction. It also
   retains obsolete "a bump stopped your inhale" copy after bump stun removal.
4. Failures collapse to a generic restore message; first-time defense starts its
   timer after 1.4 seconds regardless of reading time. Capture-to-finish teaching
   and the injury disclosure are too dense for their small mobile panel.
5. Lesson order and local progress assume four fixed lessons. Changed mastery
   checks need explicit revision handling rather than silently granting credit
   for a new skill or discarding all previous progress.

## Proposed five-lesson sequence

| Lesson | Playable stages | Evidence of success |
| --- | --- | --- |
| 1. Move, grow & capture | Move through nearby gems; slide past a soft body; capture a visibly smaller healthy rival. Show the full cheeks and standardized captive body. | Real pickups/movement and capture of the identified target. Contact need not be mandatory if the learner walks around it. |
| 2. Aim, hit & finish | Teach aiming without time pressure; land a shot while at least 20% wider to see a decisive shatter. Then wound a rival that survives, see its split shell/worried eyes, steal to grow, and approach for a mouth finish. | Actual launch direction, identified impact/reward, real vulnerability/theft and the mouth-finish event. No completion from pressing a button alone. |
| 3. Escape & recover | While healthy, flee a pursuer behind you and tap a puff without turning back; keep moving beyond the fixed rear wall. In a separate stage, escape while injured until the shell heals, using movement because breathing is unavailable. | A real rear-wall suction interruption followed by separation; then survival/escape and genuine injury expiry. A front puff alone does not prove the rear-cover skill. |
| 4. Black-hole shot | Capture the ammunition first, release, aim across the existing longer gap, fire into the core and watch the gems return. | Real capture and once-only black-hole reward from that captive; preserve time to see the spatial return. |
| 5. Build a weapon | Gather matching parts, place the assembled Pulsar with E or Place weapon, watch its automatic attack land. | Actual assembly, placement and damage attribution. No invented fire/build controls. |

Use visible body-size matchups, never gemstone-count ratios, to teach combat.
The 20%-wider shooter finish is the active rule. Do not teach the experimental
33% rival damage or one-second loading delay while both remain disabled.
The existing healthy-capture and injured-mouth-finish size/contact requirements
remain authoritative. Shell styling communicates vulnerability, not a guaranteed
kill or invincibility. Movement, turn limits, breath cost/cooldown, injury length
and capture/shot mechanics are the ordinary shared bot/human rules.

The first lesson's actual captive can carry into Aim when following the full
sequence; selecting Aim directly can provide practice ammunition without marking
Capture completed. A missed Aim shot restores ammunition at that checkpoint.
Black-hole shot still explicitly requires its own initial capture, as requested.

## Teaching and presentation

- One short instruction at a time: for example, "Keep moving. Tap to leave cover
  behind you." On touch, teach right-thumb aiming, lifting and then tapping FIRE
  before requiring the first aimed hit. Retain the chosen direction after lift.
- Introduce the first timed threat only after a contextual Ready action. A retry
  restores the attempt immediately, with a brief visible setup; it does not
  restart collection/capture steps already passed or wait through a whole lesson.
- Show feedback for the actual outcome: "Your wave was early", "Aim missed the
  core", "The rear wall broke suction", or "The shell closed: you recovered."
  Keep the reason visible through restoration; after two misses add one hint.
- Keep the learner, target and escape route in view. Position the instruction
  outside the action/joystick reach; preserve dynamic viewport/safe-area handling
  in portrait, landscape and tablet layouts. Highlights stay on the one current
  world target, without duplicate floating text/countdowns.
- Teach injury through the split shell and worried expression. Briefly show
  "Injured: move to escape" while the action control reflects blocked breathing.
  Split "approach", "steal to grow" and "mouth finish" into distinct cues.
- Show normal spawn protection after a genuine knockout if it occurs. Safer
  spawning is system behavior being tested, not another exam or a reason to
  force a learner to die. Do not add a standalone respawn lesson or expose spawn
  search scores. "Finding clear space" is enough if selection must retry.
- Preserve readable eyes, no rapid blinking, sound access and reduced motion.
  Make About injury a comfortably reachable 44px disclosure; move detailed rules
  there instead of enlarging the active instruction panel.

## Implementation approach

Extend the existing private TutorialRoom and PracticeController, not a second
simulator or a tutorial-only combat implementation. Keep ordinary room input,
capture, exhale, injury, reward and respawn paths. Scenario NPCs may make simple
controlled decisions, but receive the same physical capabilities and restrictions.

Use stable stage identifiers with explicit readiness, action and resolution
states. In particular, separate the healthy rear-wave and expected-injury stages
from the current global injury failure. Track the intended attacker/captive and
current attempt; ignore stale/duplicate events. Permit the actual wrap interval
and subsequent movement before deciding a defense failure. Do not change live
cooldowns or make the wall form faster just to pass a lesson.

Reuse the current panel, camera framing, input-reset and checkpoint ownership.
Suppress setup-only gem awards from pickup celebrations without suppressing the
learner's real pickups, capture growth or earned rewards. This is presentation
bookkeeping, not different scoring or silent progress credit.

Version the saved lesson requirements. Preserve unchanged weapon/black-hole
completions and applicable old foundational completion. Keep historical defense
completion recorded, but label its new requirement "Updated — try rear cover";
the new Aim/combat requirements remain unproved until completed. Do not force a
new first-visit popup on returning players, erase achievements or lock lessons.
Blocked storage must still work with the existing in-memory fallback.

## Work order and release criteria

1. Fix the defense action/resolution model and remove obsolete bump guidance.
   Build the rear-cover exercise against the current, shared wave implementation.
2. Add the expected-injury escape stage and split the attack lesson into clear
   aiming, lethal hit, injury/theft and finish steps. Preserve actual event gates.
3. Reorder the five lessons, add revision-aware progress, and check full-sequence,
   direct selection, skip, replay and exit behavior.
4. Refine the mobile panel, reading-time start, failure reasons, injury disclosure
   and camera. Retain desktop mouse/keyboard equivalents and sound persistence.
5. Test all five lessons end to end on desktop, 320px portrait, ordinary phone,
   phone landscape and tablet. Use genuine two-thumb sequences where supported;
   report pointer simulation and physical-device limits separately.

The verification must deliberately include an early puff, a late puff, holding
instead of tapping, lifting the aiming thumb while walking, a missed shot/core,
an injured failed puff, healing, a knockout/safe respawn, and a reconnect/exit
during restoration. No failure may erase passed checkpoints or grant completion.
Confirm server-only mastery, private-room isolation, once-only rewards, no live
score migration, reduced motion, 44px actions, keyboard focus and no page errors.

Automated completion does not establish learnability. Before calling the remodel
finished, observe someone using the touch tutorial without coaching and identify
where they hesitate. Measure duration after implementation rather than promising
an untested completion time. Release the remodel only after these checks; no
remodel code, merge or deployment is performed by writing this plan.
