**Ascend Avoid — our ten strongest ideas**

Saved October 24, 2026. These ideas summarize this game discussion and its accepted changes. The implementation plan and current tuning live with the repository, so the next chat can pick them up.

1. **Turn captured players into living cannonballs.** Steal, capture, aim, fire, then scramble for the explosion of gems. This is the game's defining interaction.
2. **Make capture a tense escape-or-impact decision.** Solve the arrows before launch. Once fired, the captor controls the shot; an impact spends the missile's growth and can knock it out. Surviving a landing grants space to recover. This supersedes the earlier idea of captive steering.
3. **Make growth powerful without making movement painful.** Small creatures stay faster; large creatures retain useful speed, responsive turning, and room to maneuver. Current tuning uses a 0.3 speed exponent and a 130-unit/s floor.
4. **Make escapes depend on the captor's size advantage.** Three inputs near your size, four at twice your width, five at four times your width. Preserve a skill-based escape while giving the captor a real firing opportunity. Bots need reading time and imperfect attempts. Current human-playtest tuning uses a 2.8–3.4-second loading delay, leaving 2.2–2.8 seconds after the daze; an early FIRE press queues the shot.
5. **Bring people together with announced gem surges.** A gold marker and countdown lead to a short shower near a turbine exhaust, ending in a contested jackpot. This creates a reason to travel, ambush, defend, and fire.
6. **Give small creatures an effective defensive gust.** A broad, readable puff creates real separation even against larger creatures. A successful parry briefly breaks suction, with a cooldown that prevents constant shoving.
7. **Keep the arena readable on every screen.** Follow the creature through movement, growth, launches and hits. Wide desktops preserve exact centering with a thin boundary and lighter blue surround. Compact screens stop the camera at map edges so the playable map fills the phone, including during knockouts. The world never wraps.
8. **Let bots create encounters without creating a pileup.** Fill to a moderate population, cap pursuers per target, and have crowded bots withdraw toward less occupied areas. Bots should help the game feel alive while leaving space for human play.
9. **Make the controls clear and deliberate.** Labeled Help & settings, Focus view, Show controls, and Save name buttons; Enter still saves. Keep notifications away from controls, show Inhale/Loading/Queued/Fire states, and teach the first session with dismissible tips.
10. **Preserve expressive creatures and reward the big moments.** Keep the eyes visible during inhaling and capture. Put captive/loading information in a clean badge below the body, use readable aim feedback, and add restrained collection, capture, launch and impact sounds with a remembered mute setting.

All ten are approved directions for the current branch. Future tuning should follow actual playtesting rather than treating these numeric values as permanent. User authorization also covers merging the finished, verified branch to main.
