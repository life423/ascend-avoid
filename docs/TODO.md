# Current gameplay follow-up

- [x] Inhale weapon parts into persistent carried cargo; releasing inhale or turning must not drop them. Preserve the local collection feel approved by the user.
- [x] Mark each loose weapon part on the minimap and guide players to the nearest missing part.
- [x] Carry the completed weapon to a chosen location, then place with a visible phone/desktop button or E. Keep phone controls clear in portrait and landscape; no timed auto-placement.
- [x] Make player-missile hits shrink large targets dramatically and knock small targets out to a fresh spawn.
- [x] The missile player loses about 90% of their width on a player/wall impact, down to newborn size at minimum, once per flight. They survive and retain recapture protection.
- [x] Charge 35% of a full breath meter for a gust, with clear low-breath feedback.
- [x] Add brief collision staggering and separation without repeated contact stun-locks.
- [x] Remove the glowing blue Core orbs: delete their renderer, physics, simulation, spawn/placement hooks and old tuning. Purge leftover objects on server ticks.
- [ ] Bot cannonball shots need readable reaction time and imperfect aim; no instant, exact targeting.
- [ ] Later cleanup: retire legacy whole-swallow code after removing its dependencies and obsolete tests.

The existing 1.8–2.4-second capture loading, 18-second builder claim, and three-second post-flight suction shield remain requirements.
