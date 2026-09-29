# Game design

Working title: Ascend Avoid (a new name comes later).

## The pitch

One big open arena that everyone on the site shares. Hop around, grab gems, shove people into
traffic, and don't get caught when the arena closes in. Open the page and you're playing: no
lobby, no waiting, and you're back two seconds after a knockout.

## World and camera

- A big open arena about 3×3 screens across (2100×2100 world units), walled at the edges.
- The camera follows you. Every screen sees the same amount of world (`WORLD.VIEW_AREA`), shaped
  to the screen within limits (aspect 0.6–1.8), so a big monitor gets no extra warning.
- The canvas fills whatever space the page gives it, on desktop and on phones.
- A minimap in a corner shows you, everyone else, what your screen covers and, once gems exist,
  the leader's crown.

## Movement

- Tap a direction to hop once (60 units). Hold it to keep hopping: the first repeat comes after
  0.2 seconds, then six hops a second.
- Your browser decides when you hop and moves you on screen instantly; the server applies the
  same hops (one per direction every 60 ms at most, four queued at most) and decides hits.
- Hops grow with you as you collect gems, so one hop always clears your own body.

## Hazards

- Traffic crosses the arena in all four directions.
- The spawner always leaves gaps wide enough for the biggest possible player.
- Later: bouncing balls, spiky mines you can shove people into, and narrow gaps between posts that
  only small players fit through.

## Gems

- Scattered around the arena. They're your score and your weight.
- More gems make you bigger (square-root curve, capped around 1.5×; the hitbox grows less than
  the sprite), heavier (harder to push, and you push harder) and slower when holding a direction
  (six hops a second when small, about four at the cap).
- Very big players slowly shed gems, like Agar's mass decay, so sitting on a pile isn't safe.
- A live top-5 leaderboard; the leader wears a crown on everyone's minimap.

## Hits

- A hit sprays out half your gems, which burst physically outward and scatter, so everyone
  nearby abandons what they were doing and dives into the pile. This is a signature moment.
- You're only knocked out when you're hit with no gems left. Knocked out, you're back in about
  two seconds.

## Pushing

- Hop into someone to shove them. They slide about two hops: farther if you're heavier, less if
  they are (weight grows with size, from 1 to 2.25), and they can't hop until they stop.
- Two players shoving the same target add their pushes.
- Shoving the leader knocks a tenth of their gems loose (2 to 8, at most every 1.5 seconds), so
  small players can chip away at them.
- Players who just arrived can't be shoved, and shoving someone ends your own protection.

## The B button: dash and slingshot

- **Tap: dash.** A long hop that costs a gem.
- **Hold: slingshot.** Charge for 0.4–1.5 seconds, clearly telegraphed (a pull-back and a charge
  ring everyone can see), then release to launch several hops in a straight line without
  steering. The knockback ignores the victim's weight but not physics: a huge impulse that still
  slides and can be dodged, not a guaranteed yeet. It costs gems (more for heavier players) and
  has a 4-second cooldown after firing, so small players can't chain-launch the leader.

## Power-ups

- **Bubble Shield:** absorbs exactly one hit and visibly cracks when it does. No timed
  invincibility; one-hit protection builds confidence without removing the danger.
- Power-ups are map pickups, separate from gems.

## Respawning

- Respawn away from hazards and the leader, choosing the best of several candidate spots.
- About 1.5 seconds of translucent protection, which ends the moment you ram, dash or slingshot.

## The shrinking arena (an event, never permanent)

- Every few minutes the arena contracts to about half its size over 30–45 seconds, stays
  compressed for about 20 seconds of chaos with gems raining into the middle, then reopens. A
  long-running server never turns into one tiny arena.
- Warnings stack: about 15 seconds ahead, a banner and a sound, with the new boundary drawn as a
  dashed outline on the map and minimap. While it closes, the outside turns red and pulses, a
  countdown shows, and an arrow points to safety when it's off screen. Near or past the edge,
  the screen edges glow red and phones vibrate where supported.
- Outside the zone you drop a gem every half second, and after a few seconds you're knocked out,
  so there's a chance to run back instead of dying instantly.

## Always playable

- No rounds and no lobbies. Bots, marked with a robot, fill in until six are playing and make
  room as people arrive. They hop by the same rules as people, dodge the traffic they see
  coming, chase gems and shove now and then (always the leader).
- Solo becomes the same world offline with bots; until then it's the classic solo game.

## Build order

1. Big arena, following camera, canvas filling the page, instant respawn with protection. **Done.**
2. Gems: size, weight, pushing, hits that spray gems, leaderboard, minimap crown. **Done.**
3. Bots. **Done.**
4. The shrinking event and its warnings.
5. Dash, slingshot, Bubble Shield, new hazards.
