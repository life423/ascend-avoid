# Ascend Avoid

A real-time multiplayer browser arena: collect gems, grow your creature, steal from injured rivals, and fire captured players as living cannonballs.

- WASD, arrow keys, a touch joystick, or mouse-follow to move.
- Hold Space/the action button to inhale; tap to puff, or fire a captive.
- Capture a smaller healthy rival, release, aim, then tap to fire. Captives automatically eject when the hold expires; there is no escape minigame.
- Player-fired bullets have one 60-unit size. Capture immediately absorbs growth above that size; bullet-sized or smaller captives give no instant growth. See the local [standard-bullet rules](docs/STANDARD_BULLETS.md).
- Player-fired shots follow their launch direction. Injured smaller rivals finish only at an eligible mouth; lethal shots and black-hole eliminations directly reward the shooter.
- Follow gold markers to gem surges and contested jackpots.
- Use Help & settings for concise rules, sound controls and **Practice / Tutorials**. Start the full tutorial or choose any unlocked lesson.

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

## Android preparation

The Android wrapper uses the same live multiplayer game. On Windows with
PowerShell 7, run `npm run android:setup -- -AcceptLicenses`, then
`npm run android:build` to create a signed test APK and Play upload AAB under
`artifacts/android/`. [Android build and release](docs/ANDROID_RELEASE.md) covers
signing, website verification and remaining device/Play Console checks.

After pairing an Android phone over Wi-Fi, `npm run android:phone` builds,
verifies, installs and launches the signed app. `npm run android:devices` lists
available devices; the Android guide covers pairing and installing an existing APK.

`npm run android:backup` creates and restore-checks an encrypted signing-key backup
using a privately entered passphrase. The current [testing workflow and checklist](docs/ANDROID_TESTING_WORKFLOW.md)
tracks staging, device checks and Google Play preparation.

The separate **Ascend Avoid Test** app opens staging and can be installed beside
the regular app with `npm run android:test:phone`. Its build/verification commands
are `android:test:build` and `android:test:verify`; output stays under
`artifacts/android/test/`.

## Checks

```sh
npm run type-check
npm run lint
node scripts/gen-synced-types.mjs --check
npm test
```

Browser checks target production by default. To test a local build, set `E2E_URL` to its URL. Tests needing world fixtures also require `E2E_TEST_HOOKS=1` and a server started with `NODE_ENV=test`. Production disables test commands; ordinary weapon placement remains available. [Practice verification](docs/PRACTICE_TUTORIAL.md) uses real private production rooms without test hooks.

```sh
npm run test:browsers
node scripts/capture-balance.cjs 100
npm run sim:crowd
```

Current rules: [Game design](docs/GAME_DESIGN.md). Accepted scope: [Implementation plan](docs/FUN_PASS_PLAN.md). Product direction: [Our ten best ideas](docs/TOP_10_IDEAS.md).
