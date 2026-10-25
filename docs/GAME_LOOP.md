# Guiding game loop: lasting dominance

Approved and saved at the user's explicit request on October 25, 2026. This is the intended experience, not a claim that current balance achieves it. The user values becoming enormous, feeling almost untouchable and retaining that size for hours through good play. Frequent knockouts across the arena must coexist with rare, durable giants. Later explicit decisions take precedence.

1. **Start small and gather.** Crystals provide steady progress. You’re quick, vulnerable and watching for danger. Fans give you an escape route and a chance to make a risky attack.
2. **Become capable.** You can capture smaller opponents, survive more encounters and start choosing fights. Each increase in size gives you useful power.
3. **Build your advantage.** Win fights, collect valuable spills and assemble weapons. Growth takes enough effort that you become attached to your creature.
4. **Become enormous.** Most players give you space. Small attacks barely trouble you. You can hold territory, hunt and enjoy being the creature everyone notices.
5. **Maintain your reign.** Staying huge involves choosing pursuits, defending against serious threats and recovering from occasional damage. Ordinary encounters should leave your hard-earned size largely intact.
6. **Eventually fall—and want that power back.** Losing a giant should be memorable. A dangerous rival, a well-prepared attack or several mistakes can bring you down. Your next small spawn begins another climb.

## First balance pass — approved and implemented October 25

The user approved starting with missile damage and theft to reward giant growth while preserving small-player counterplay. The old 75–85% target damage floor is replaced with a smooth projectile/target mass curve and bounded speed modifier. Full theft strength now requires 85% relative width, and sustained contact peaks at 3x instead of 8x. Small fan shots still wound and spill gems, final-gem theft remains lethal and there is no shared theft quota. The missile player's own shrinkage/burnup rules, injury duration, crystal growth, movement, deployed-weapon damage and passive decay are unchanged. See GAME_DESIGN.md for exact initial tuning and controlled measurements. This is an initial pass, not evidence that giants can yet survive for hours.

## Remaining balance follow-up — proposals, not implemented or approved values

- Playtest the initial missile/theft pass before selecting further values. Keep small hits useful, near-peer threats meaningful, five-second injury-only theft, healing, defensive gust, final-gem knockout and no shared/per-injury theft allowance. Further theft tuning must change a rate, not add a quota or guaranteed surviving gem.
- Review all damaging sources against the same goal. Pulsar currently removes 25% per wave, so repeated waves can undermine a giant even after missile tuning. Compare the already sublinear Pinwheel damage before changing it. Prepared weapons should remain useful and lethal to weakened players, while giant losses require meaningful exposure.
- Measure human and bot passive decay before promising hours of sustainable size. Check spill recovery, knockout frequency, time to grow and leader tenure. Do not shorten the early climb or flatten it into tedious gathering to compensate for destructive damage.
- Validate tiny/medium/giant matchups, repeated damage plus multiple thieves, fan comeback shots and gust escapes. A giant should retain most progress after an ordinary small attack and have time to react; defeating one should require sustained commitment, a substantial rival or a carefully prepared threat. Do not add pinned vulnerability labels or new controls for these changes.

The initial missile/theft parameters are selected as described above. Additional damage, growth, deployed-weapon and decay changes remain proposals. See GAME_DESIGN.md for implemented rules and TODO.md for pending work.
