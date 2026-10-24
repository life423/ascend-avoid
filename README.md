# Ascend Avoid

A real-time multiplayer browser arena: collect gems, grow your creature, steal from rivals, and fire captured players as steerable living cannonballs.

- WASD, arrow keys, a touch joystick, or hold the mouse button to move.
- Hold Space/the action button to inhale; tap to puff, or fire a captive.
- Follow the directional prompts to escape a capture. Larger captors require more inputs.
- Steer sideways in flight to hit another creature and collect spilled gems.
- Follow gold markers to gem surges and contested jackpots.
- Use Help & settings for the full rules, starter tips and sound controls.

## Local development

Requires Node.js 20+ and npm.

```sh
npm ci
npm --prefix server ci
npm run dev
```

Vite serves the client on port 5173; Colyseus runs on port 3000. For a production build:

```sh
npm run build
npm run start:prod
```

## Checks

```sh
npm run type-check
npm run lint
node scripts/gen-synced-types.mjs --check
npm test
```

Browser checks target production by default. To test a local build, set `E2E_URL` to its URL. The capture regression also requires `E2E_TEST_HOOKS=1` and a server started with `NODE_ENV=test`. Production disables placement and test hooks.

```sh
npm run test:browsers
node scripts/capture-balance.cjs 100
npm run sim:crowd
```

Current rules: [Game design](docs/GAME_DESIGN.md). Accepted scope: [Implementation plan](docs/FUN_PASS_PLAN.md). Product direction: [Our ten best ideas](docs/TOP_10_IDEAS.md).
