# Current gameplay follow-up

- [x] Replace the Drum with a space-themed Pulsar Array: plasma cell/field coil/emitter, visible inward charging and four damaging plasma waves. Double knockback, spill 25% of gems (minimum six), and allow low-mass knockouts. Preserve shared claims/carry/place controls and alternate with Pinwheel.
- [x] Keep compact/mobile views filled with playable map at all edges, during knockouts, rotation and extreme zoom. Wide desktops retain their centered camera and decorative surround.
- [x] Remove persistent weapon panels/pills, floating completed-weapon labels and waiting countdowns from every screen. Keep minimap markers, physical cargo and contextual placement; local collection gets one brief coalesced notice. Starter tips auto-close after four seconds.

- [x] Touch or inhale weapon parts into persistent carried cargo; releasing inhale or turning must not drop them. Preserve claims and the approved collection feel.
- [x] Mark each loose weapon part on the minimap; use those markers for navigation without a pinned direction/progress panel.
- [x] Carry the completed weapon to a chosen location, then place with a visible phone/desktop button or E. Keep phone controls clear in portrait and landscape; no timed auto-placement.
- [x] Make player-missile hits shrink large targets dramatically and knock small targets out to a fresh spawn.
- [x] The missile player spends about 90% of their width on a player/wall impact, once per flight. No growth remaining means knockout; larger survivors retain recapture protection.
- [x] Captor aim alone sets player-missile launch direction; disable captive steering before and during flight. Escape remains available before launch.
- [x] Give three/four/five-arrow escapes 2.2/2.5/2.8 usable seconds after the daze, with 2.8/3.1/3.4-second loading.
- [x] Reduce background gems about 25% (1,270 to 950); keep combat spills. Knock out missile targets below 12 remaining gems.
- [x] Charge 35% of a full breath meter for a gust, with clear low-breath feedback.
- [x] Add brief collision staggering and separation without repeated contact stun-locks.
- [x] Remove the glowing blue Core orbs: delete their renderer, physics, simulation, spawn/placement hooks and old tuning. Purge leftover objects on server ticks.
- [ ] Bot cannonball shots need readable reaction time and imperfect aim; no instant, exact targeting.
- [ ] Rewrite the Game Menu instructions to one quarter of their current length or less. Use short, easy-to-scan wording and keep them aligned with the latest gameplay rules. Do this in a later UI pass.
- [ ] Later cleanup: retire legacy whole-swallow code after removing its dependencies and obsolete tests.

The 18-second builder claim, two-second respawn, 1.5-second spawn protection and three-second post-flight suction shield for survivors remain requirements. The user clarified that dying was too hard, not returning after death.
