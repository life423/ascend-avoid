# HUD and award readability

November 4, 2026. Local changes preserve the original top-right Menu box and
minimap position, score/leaderboard layout, controls and gameplay values.

The score and leaderboard glass soften when they overlap the projected local
face or the first stretch of active airflow. Only glass and rim fade, down to
22% alpha at full overlap. Outlined text retains its original opacity. Continuous
overlap coverage, a 180ms clear-space grace period and smooth recovery prevent
edge flicker. No panel moves or extra button appears.

Gem awards use at most one positive and one negative counter. Live values sum
within their original display lifetime; this changes no actual gem accounting.
Labels stay above the existing name/crown area, have a 12 CSS-pixel minimum at
giant zoom, and stop rising under reduced motion. They still fade out.

Tutorial text now explains first-part radar guidance and the deployed Pulsar's
mint ownership shield. Help distinguishes harmless hollow gold hole warnings
from a dark closing core that remains dangerous until it disappears. Existing
weapon tracers and ownership cues remain unchanged; current minimum-sized
tracers, navy separation, hostile/friendly trails and charge cues were retained.

## Verification

- [Readability unit checks](../scripts/hud-readability-check.ts): face/airflow
  projection, CSS/DPR parity, continuous overlap, fade recovery, exact display
  totals, expiry, crown spacing, minimum font and reduced motion.
- [Real-game HUD browser test](../tests/e2e/hud-readability.spec.mjs): giant corner
  overlap, opaque score/name glyphs, ordinary active inhale, clear-space recovery
  and actual authoritative gem collection. Android Chromium, iPhone WebKit and
  Firefox portrait/landscape profiles pass; each also checks both orientations.
- The existing mobile drawer/dock/focus/placement cases pass across the same four
  profiles. The minimap test follows its single arena outline and rejects the
  obsolete extra frame.
- Desktop and emulated-phone screenshots were inspected. These checks do not
  establish that a newcomer understands the tutorial or that all crowded human
  fights remain readable. Physical Chrome checks and remaining device work are
  recorded in [DEVICE_VALIDATION_2026-11-04.md](DEVICE_VALIDATION_2026-11-04.md).
