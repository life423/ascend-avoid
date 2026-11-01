# Contact and impact control audit — November 1 local follow-up

The user reported feeling stunned when similarly sized creatures clash. The
audit traced both explicit `stun()` calls and other branches that disable
movement or turning. A false `stunned` flag alone does not establish control.
This work remains local; no commit, push, merge or hosted deployment is authorized.

## Finding and correction

Ordinary body contact in `server/systems/bodies.ts` applies compression,
separation and 15% tangential contact friction. It starts no stun, skid,
recovery timer or injury. Head-on movement can still be physically blocked by
another body; turning, sliding sideways and deliberately moving apart remain
available. The client uses the same friction setting. No collision damage or
new contact rule was added by this pass.

The shared assembled-weapon damage path still called `PlayerSchema.skid()`.
Pinwheel, Sentinel, Ricochet, Comet and Ion hits therefore disabled walking and
turning until their slide ended, despite never setting `stunned`. A normal
65-unit impact started at 455 units/s and took about 0.35 seconds to fall below
the slide's stop speed. Both server movement and client prediction respected
that lock.

That call now uses `pushWithControl()` with the same 455-unit/s initial impulse.
The existing shared air-drift integrator adds walking throughout the push and
uses drag 12/s instead of skid drag 7/s. An unobstructed push now travels about
38 units instead of roughly 60 before the old stop threshold. This deliberately
softens displacement while retaining an impact response. Damage, graze rules,
injury, builder credit, firing cadence and shared hit protection are unchanged.
The same function serves bots, humans and tutorial encounters.

Outdated comments and the browser fixture name that attributed stun to a gust
were corrected. A fixture that explicitly injects a hard stun still tests blocked
input and held-key recovery; it does not claim to reproduce a live gust.

This identifies a real source of lost control. It does not prove that every
previously perceived clash used that path, or certify physical-phone feel.

## Remaining intentional or dormant restrictions

| Source | Current behavior | Status in this pass |
| --- | --- | --- |
| Ordinary body contact | Compression/separation, immediate tangent or outward steering | No stun or skid |
| Gust and Pulsar | Brief additive push, steering and turning available | Preserved |
| Assembled-weapon direct hits | Brief additive push, steering and turning available | Hidden skid removed |
| Surviving player-missile or turbine-flight collision | 450ms impact stun plus existing impact skid | Preserved; not ordinary contact |
| Automatic living-captive release | Short separation skid with existing release protection | Preserved |
| Traffic damage or arena-shift recovery | 800ms recovery plus optional skid | Preserved; both modes are disabled in normal play |
| Bomb explosion | Legacy shove slide | Preserved; bombs are disabled in normal play |
| Capture, missile flight and tutorial preparation | Existing state-specific input handling | Preserved |

Explicit production stun calls occur in `server/systems/flights.ts`. The other
direct call is the development-only `test:stun` fixture. The ordinary contact
system contains neither. Dormant mode support was inspected, not deleted.

## Verification

- 48 complete-tick contact cases cover both role flags, three size stocks,
  equal/nearby opponents and four approach directions. Neither creature enters
  a control lock or injury; tangent input responds on the first tick and both
  can peel away immediately.
- 30 direct-hit cases cover the five affected weapons, both role flags and
  three target sizes. Actual damage/reward and injury remain; movement and
  rotation respond on the first tick, the push expires, and equal inputs produce
  identical bot/human outcomes. Outer grazes still have no push or injury.
- All 43 server unit scripts and tutorial progress checks pass. The build and
  client/server type checks pass; lint reports zero errors and 187 warnings.
- All 18 multiplayer scenarios pass, including actual gust input/recovery.
- Twenty distinct browser cases pass across desktop Chrome, Android Chrome,
  iPhone portrait/landscape Safari and iPad Safari profiles. These cover body
  squash/escape, a real Pinwheel bolt with ordinary keyboard/thumb movement,
  the steerable wrap gust and hard-stun recovery. The initial run passed 19;
  the remaining landscape gust case read a stale local clock after receiving
  the peer's interruption. It passes after explicitly waiting for the browser's
  wrap-phase update. No gameplay timing was changed for that fixture.

Browser profiles are emulation, not physical-device timing measurements. The
post-impact phone/tablet/desktop screenshots and phone contact squash were
inspected: the playfield and controls remain clear, with no extra panel or
control added. The injury-art redesign and overall fun review remain separate
open tasks. The current local audit preview is <http://127.0.0.1:3205/>.
