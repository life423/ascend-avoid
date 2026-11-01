# Parts, fans and black holes — November 1 local candidate

The user requested weapon parts clear of fans, then added that black holes and
fans should leave enough room for the arena to feel less cluttered. This pass
changes placement, not suction, collection, damage or actor capabilities.
Everything remains local; no commit, push, merge or deployment is authorized.

## Placement rules

- Keep an unobstructed three-part layout at its original location. If blocked,
  move the complete triangular set together, trying nearby anchors before a
  bounded fallback grid. Preserve all three kinds and their existing separation.
- Reserve a 48-unit radius for each component's artwork, claim badge and label,
  plus 16 units of clearance. Keep that reservation inside the arena and clear
  of fan housing, flared intake, swept outlet and the 190-unit inner intake
  sector. Outer wind remains usable; this is not a ban on parts in all airflow.
- Keep new components outside black-hole rings and other loose component
  artwork. Carried components do not reserve remote ground positions.
- Apply the same part/fan check when choosing a later fan position. A replacement
  fan cannot appear underneath an existing loose component.
- Fixed black-hole landmarks are created before automatic fans. Fan selection
  reserves the visible fan envelope, the hole's outer ring and a further
  **260-world-unit gap**: about **450 units between centers** at current sizes.
  Counts and the existing 1,150-unit fan-to-fan spacing are unchanged.
- Never force an overlapping fallback. A blocked component set keeps its queue
  priority and retries after 250ms, without spending the shared 12-second release
  interval. Fan searches retain their 40-candidate bound and existing 1s retry.

These checks apply to creation/replacement. They do not teleport cargo or loose
parts later moved by ordinary play, and do not remove wind or change pickup's
22-unit reach. Bots and humans share collection, ownership and placement rules;
bot assembly plans use the relocated physical coordinates. The development-only
forced fan fixture can still deliberately create a location for tests.

## Verification

`server/tests/arena-placement.unit.ts` covers all six recipes, eight headings and
three fan phases; inner-sector edge clearance; arena bounds; later fan rejection;
blocked retries and preserved state; contact/inhale collection and assembly for
both actor flags; and bot targeting of relocated pieces.

Its 128 seeded static crowded layouts place all nine builds (27 components) and
five fans, testing both spawn orders. All fit. Across those layouts, 54 bounded
fan searches needed a subsequent search rather than an unsafe fallback. That is
a count of failed search batches, not seconds of observed match delay.

The current local revision passes:

- Production build and client/server TypeScript checks.
- All 44 server unit scripts plus tutorial progress checks. The new placement
  script also passed after its final bot-targeting assertion was added.
- All 18 multiplayer scenarios.
- Ten browser cases across desktop Chrome, Android Chrome, iPhone Safari in
  portrait/landscape, and iPad Safari. They collect relocated parts using ordinary
  keyboard/touch movement, assemble and Place, then check normal fan arrivals and
  active replacements against black holes and staggered parts. No page errors.
- The Android browser weapon tutorial using ordinary controls.
- Lint: zero errors, 187 existing warnings.

Rendered active fans and hole rings were reviewed on phone and desktop; component
spacing and collection were reviewed on phone/tablet/desktop profiles. The final
screenshots and logs are under `.tmp/arena-spacing-final-browser` and
`.tmp/arena-spacing-*.log`. The local preview is `http://127.0.0.1:3209/` while its
server remains running. Browser profiles are emulation, not physical-phone tests.
Static fit and staged collection do not establish universal uncluttered gameplay
or final human fun; whole-loop and physical-device review remain on the backlog.

For another local browser run, build and start a local test-hook server, explicitly
set `E2E_URL` to that local address and `E2E_TEST_HOOKS=1`, then run Playwright for
`tests/e2e/arena-spacing.spec.mjs`. Do not use the browser config's live-site default
for these development fixtures.
