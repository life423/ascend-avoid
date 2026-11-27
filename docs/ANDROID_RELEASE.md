# Android build and release

## November 22 Google Play distribution correction

The user provided the correct existing Play Console account.
The `drewclark.io` Play Console account contains
`io.drewclark.ascendavoid` in **closed testing**. The earlier account-setup and
"no Play upload" notes below describe historical preparation, not current
distribution. Update this existing app and its tester track; do not create a new
package, replace its signing key or assume production access has been granted.

The code-2 build and Pixel checks below establish the direct-install fullscreen
fix. A Play update additionally needs an unused version code above the codes
already used in Console, a bundle signed with the accepted upload key, and
website associations for the **Play app-signing certificate**. The upload
certificate that verifies a locally installed APK can differ from the
certificate Google uses on players' installations. Confirm those identities
from the existing app's App integrity page before preparing its next release.

The user provided the correct existing Play Console account. The November 22
Console check found the **Alpha** closed-testing release **1 / 1.0.0**, and the
all-app-bundles list contained only code 1, leaving code 2 unused. Console's
upload certificate matches the existing local `99:2E:…:4F:BF` certificate.
Its authoritative app-signing certificate list has
three SHA-256 fingerprints, now recorded alongside that local certificate in
`public/.well-known/assetlinks.json`. These public values were copied from
Console, not inferred from the upload certificate. The code-2 AAB is the
candidate for the next closed-test update; publication remains a separate step.

Deploy the confirmed distribution fingerprints alongside the existing local
fingerprint at `/.well-known/assetlinks.json` on the apex, previous and www
production hosts before rolling out the Play update. Keep the staging/Test
association separate. A local APK playtest does not establish that the
Play-signed build has passed website verification.

Players on an eligible Play testing track can receive a published update through
Play according to their update settings. Website deployments continue to update
the online game; they do not publish native bundles to Play. Record Console
release state and an actual Play-installed update separately from local builds.

## November 22 fullscreen correction

The user reports the browser URL/share/close toolbar above the installed game
and explicitly requests its removal. This supersedes the November 21 acceptance
of browser chrome after the [domain migration](DOMAIN_MIGRATION.md).

Production version **1.0.1 / code 2** launches `https://ascendavoid.com/` directly.
It explicitly declares `https://ascend.drewclark.io` and
`https://www.ascendavoid.com` as additional trusted origins, with matching native
website associations. The package ID, existing signing key, immersive mode and
V12 artwork remain unchanged. Test stays at 1.0.0/code 1 on its separate staging
origin with no additional trusted origins.

All three production hosts serve direct 200 association JSON matching the
existing public APK certificate. The previous/www document redirects still
point to the canonical apex. Native launch/trust configuration, not page layout,
causes the pictured toolbar: an old APK leaves its validated origin when it
follows that redirect. The fix therefore requires installing the signed app
update; a website deployment cannot update an installed APK's trust list.

Signed production and Test APK/AAB builds and release lint pass. Artifact checks
verify signatures, Google bundle validation, matching website certificate,
launch/deep-link/manifest URLs, compiled native origin lists, immersive mode,
artwork and SDK bounds. Production APK SHA-256:
`E6A72A9CA9C249FBEADFCD197907F976D76B141AF4591D3DCA1ABA0E6AA7BFA0`.

Installed production 1.0.1/code 2 over version 1.0.0 on the Pixel 10 Pro XL
(Android API 37), using the same verified certificate and `adb install -r`.
Actual device screenshots confirm no URL/share/close toolbar on the launch
screen, live portrait gameplay (1344×2992), landscape gameplay (2992×1344), and
after returning through the Android launcher. Normal joystick and inhale touch
input collected seven gems; capture was also observed in landscape. The saved
player name remains. Original portrait rotation lock was restored. Sound and
other Android devices were not tested in this pass.

Local evidence: `.tmp/android-fullscreen-{build,verify,test-build,test-verify,install}.log`,
`.tmp/android-fullscreen-device-proof.json`, and the corresponding portrait,
touch, landscape and reopened PNGs. The signed APK is
`artifacts/android/Ascend-Avoid.apk`; the AAB is beside it. No new Play publication
or website deployment was required for the phone fix. The user subsequently
authorized committing, merging to main and running the production deployment;
the pull request and main workflow record the final release outcome. Historical
preparation follows.

## Historical preparation

October 31, 2026: prepared on `codex/android-store-build`, based on deployed main
`cf28d12`. The user requested an Android build while Google reviews the new
personal developer account. The user subsequently approved committing the work,
merging it into main and deploying the website verification file for phone
testing. GitHub's pull request and production workflow identify the published
revision and rollout result. At that preparation checkpoint, no app had been
uploaded to Google Play. The current closed-testing distribution is recorded
above; installed-phone testing remains a separate check.

The Android app is a Trusted Web Activity using Google's Android Browser Helper,
running the existing online game in a supporting browser engine. The Azure server,
gameplay rules and human/bot parity remain. The app launches the live website;
most gameplay updates continue to follow website deployments. It requires an
internet connection and does not add offline gameplay, advertising, purchases,
notifications or analytics SDKs.

| Setting | Value |
| --- | --- |
| App name | Ascend Avoid |
| Package/application ID | `io.drewclark.ascendavoid` |
| First version | `1.0.0`, version code `1` |
| Launch origin | `https://ascend.drewclark.io/` |
| Minimum Android | Android 7.0, API 24 (required by the browser helper) |
| Compile/target Android | Android 16, API 36 |
| Orientation | Portrait and landscape supported |
| Native dependency | `com.google.androidbrowserhelper:androidbrowserhelper:2.7.4` |

The existing Play package ID must be preserved. Future updates must increment
the production `versionCode` in `android/targets.json` above the codes already
used in Console.

November 1 selected artwork is now **V12**: supplied native adaptive foregrounds
and backgrounds, regular/round entry points, and legacy density exports for both
apps. All 28 original files per bundle are saved unchanged under
`android/branding/ascend-android-main-v12/` and `ascend-android-test-v12/`, including
store images and mask previews. The Test artwork has the red TEST ribbon.
V10 sources remain archived; its temporary flattened-art inset wrapper is removed.

Both V12 signed APK/AAB builds, package/origin/signature/bundle checks and modern
normal/round resource checks pass. All 15 packaged density images per target match
visible RGB and exact alpha; PNG crunch only normalizes invisible RGB. Both APKs
were installed and launched on the Pixel over Wi-Fi with installed hashes matching
the verified artifacts. Proof is in each local artifact folder (`verification.json`,
`icon-verification.json`, `device-installation.json`). Supplied mask previews were
inspected; actual V12 launcher/theme review remains. No hosted publication was made.
Web favicon, Apple bookmark, and standard PWA icons use the supplied web pack in
`branding/web/ascend-avoid-favicon-pack/`.
`npm run icons:sync` synchronizes the supplied web favicon pack and standard PWA icons; it regenerates the existing maskable-specific image separately. Native launcher artwork is unaffected.
The repository's web manifest adds install metadata without a service worker or
new game caching behavior.

## Build on this Windows machine

Requires Node/npm and PowerShell 7. From the repository root:

```powershell
npm run android:setup -- -AcceptLicenses
npm run android:build
npm run android:verify
```

Setup downloads a 64-bit Temurin JDK 17 and the official Android command-line
tools, verifies their published checksums, and installs SDK platform 36, build
tools 36.1.0 and platform-tools. `-AcceptLicenses` accepts the SDK license for
these required packages. Files remain under
`%USERPROFILE%\.android\ascend-avoid-build`; global PATH/JAVA settings are unchanged.
The Gradle 8.11.1 wrapper has its distribution SHA-256 pinned.

The release command builds the signed APK and AAB, runs Android release lint and
exports the public certificate/website association. Output:

- `artifacts/android/Ascend-Avoid.apk`: direct phone installation/testing.
- `artifacts/android/Ascend-Avoid.aab`: signed upload bundle for Play Console.
- `artifacts/android/upload-certificate.pem`: public upload-key certificate.
- `artifacts/android/upload-certificate.der`: the same public certificate in DER.

Build products and machine configuration are ignored by Git. Android tooling and
artifacts are also excluded from the website Docker build context. A debug APK
can be built with `npm run android:debug`; it uses Android's separate debug key
and does not inherit the release APK's website trust.

## Wireless phone installation

### Separate staging app

PR #65 was merged on November 1 as `97c9a35`. The follow-up adds a second signed
app, **Ascend Avoid Test** (`io.drewclark.ascendavoid.staging`), opening only
`https://ascend-avoid-staging.livelyisland-db4ad2db.eastus.azurecontainerapps.io/`.
It can coexist with the regular production app. Build and install from PC
PowerShell after deploying the corresponding feature commit to staging:

```powershell
npm run android:test:build
npm run android:test:verify
npm run android:test:phone
```

The phone command also builds and verifies; `-SkipBuild` installs an already
verified artifact. Output is isolated under `artifacts/android/test/` as
`Ascend-Avoid-Test.apk` and `.aab`. `android/targets.json` supplies each app's
package ID, name and exact origin to Gradle and the PowerShell tools. The verifier
checks compiled launch URL, label, package IDs, signatures and SDK bounds.
Existing `npm run android:phone` still targets production.

Staging serves the Test package's certificate at `/.well-known/assetlinks.json`
when `APP_ENV=staging`; production serves only its own package. Alternate files
inside that directory are explicitly blocked. Both run with `NODE_ENV=production`
so staging does not enable development monitors or test hooks. Local checks passed
for both modes: nine integration cases each, across desktop Chrome, Android Chrome
emulation and iPhone Safari emulation. Initial sandbox socket failures were resolved
by running previews and browsers in the same permitted context. The additional
alternate-file check exposed and fixed static serving of that file.

Android Wi-Fi can list one phone twice (IP and mDNS). The installer recognizes
duplicate transports only when both report the same nonempty hardware serial;
different/unknown phones still require explicit selection.

### Regular app shortcut

**Saved at the user's request, November 1, 2026:** when they ask for the command
to update Ascend Avoid on their Pixel over Wi-Fi, use this in **PowerShell on
their PC**, not on the phone:

```powershell
cd C:\Users\aiand\Documents\programming\ascend-avoid
npm run android:phone
```

The phone must be connected to the same Wi-Fi with Wireless debugging enabled.
This command builds, verifies, installs and launches the signed Android app.

The user requested Wi-Fi installation and a repeatable local build/test command
on November 1, 2026. The signed release APK is now paired, installed and launched
on the user's phone over Wi-Fi. Its first portrait game screen was inspected:
the arena fills the screen without browser chrome, with the leaderboard,
minimap, Menu, joystick and inhale control visible. This establishes initial
installation/full-screen launch, not a complete gameplay/performance test.

The user's test phone is a **Google Pixel 10 Pro XL**, verified through ADB as
running **Android 17 / API 37**. TalkBack's displayed app version is separate
from the OS version.

For Android 11 or newer, connect the phone and computer to the same Wi-Fi, enable
Developer options, then open **Wireless debugging > Pair device with pairing
code**. Keep that dialog open and use its IP address and pairing port:

```powershell
npm run android:pair -- -Address 192.168.1.50:37001
# Type the current six-digit pairing code when adb asks for it.
npm run android:devices
npm run android:phone
```

Addresses above are examples. After pairing, ADB usually discovers the phone
automatically. If it does not, use the different **IP address & port** shown on
the main Wireless debugging screen:

```powershell
npm run android:phone -- -Address 192.168.1.50:41001
```

`android:phone` selects a single connected device, builds the signed release,
verifies it, installs with `adb install -r` to retain data, then launches the app.
Multiple devices require an explicit `-Serial` from `android:devices`; an offline
or unauthorized device is refused. `-SkipBuild` verifies and installs the existing
APK/AAB instead of rebuilding. Pairing codes are prompted, not saved. Installation
and launch results go into ignored `artifacts/android/device-installation.json`;
full-screen and manual play checks start explicitly unverified there. The first
portrait screen has a separate visual verification record; a reinstall resets
those flags until the resulting screen is checked again.

This is a local deployment workflow. GitHub-hosted runners do not automatically
reach the phone. The TWA continues to load the deployed live website; native
launcher/SDK/icon changes need a new APK. The current website-arrow icon is usable
for device testing. The final game icon should be designed before store listing
artwork and release screenshots are finalized.

See [Android wireless debugging](https://developer.android.com/tools/adb#connect-to-a-device-over-wi-fi).

## Signing and backup

`npm run android:backup` prompts privately for a separate backup passphrase and
exports `artifacts/android/signing-backup.p12`. It verifies private-key recovery
by importing into a fresh keystore and comparing certificates. The user's real
backup/restore check passed on November 1; copying the encrypted file off this PC
and retaining its full password separately remain. See the current
[testing checklist](ANDROID_TESTING_WORKFLOW.md) for staging and release status.

The first release build creates a unique 3072-bit RSA upload key at
`%USERPROFILE%\.android\ascend-avoid-signing\upload.jks`. Its generated password is
stored in `password.xml` alongside it, encrypted with Windows DPAPI for the
current Windows user. Neither file belongs in Git or Docker. Build scripts pass
the password through a temporary process environment variable and restore that
environment afterward; passwords are not printed or placed in command arguments.

Keep the key and recoverable credentials securely backed up.
The DPAPI password file alone is not a portable password backup for a different
Windows installation/user. Do not regenerate or replace the key during routine
builds; the script refuses incomplete key/password pairs. Play App Signing manages
the distribution key; the local key must match the existing app's accepted upload
certificate. Confirm that match in Console rather than changing signing keys.

## Website verification required for full screen

The native application declares its association with the production origins.
The corresponding **public** `public/.well-known/assetlinks.json` must authorize
both the direct-install certificate and the confirmed Play distribution
certificates. The server exposes only the selected environment's association
at the exact public path; other dotfiles remain inaccessible.

**Until that file is deployed, the test APK may open with a browser address bar.**
This is the normal unverified Custom Tab fallback, not proof that a full-screen
TWA has been tested. No verification-bypass flags are used.

Google Play can sign distributed installations with a different app-signing
certificate. Get the existing app's **app signing key certificate SHA-256** from
Play Console's App integrity page, then run:

```powershell
npm run android:assetlinks -- -Target production -PlaySigningFingerprint 'AA:BB:...:FF'
```

Use the real full 32-byte fingerprint copied from Console; do not infer or
reconstruct it. The script preserves existing fingerprints for the selected
package and adds it alongside the direct-install certificate. A later release
build invokes the helper without the Play argument and retains those saved
fingerprints. The production target does not change the Test association.
If Console lists multiple distribution signing keys, verify and include each
key used for supported installations. Build, review and deploy the website
update, confirm direct 200 associations on all three production hosts, then
verify the Play-installed app's fullscreen launch. An upload certificate alone
does not verify a differently signed Play install.

## Historical initial validation and limits

The prepared release builds pass APK signature verification, AAB JAR signature
verification and Google bundletool 1.18.3 validation. Compiled metadata confirms
version 1.0.0/code 1, package `io.drewclark.ascendavoid`, minimum API 24 and target
API 36. The APK signer matches the staged website certificate. Repeated release
builds reuse the same upload key. Re-running toolchain setup also succeeds.

The production website build and client/server type checks pass. All nine
website integration browser cases pass across the three listed profiles, with
rendered phone and desktop screenshots reviewed. Android release lint has zero
errors and ten template/legacy-icon warnings (unused generated resources and
pre-adaptive launcher icon shape); web lint has zero errors and 185 existing
warnings. Native themed-icon support is included. The remaining native warnings
are recorded rather than presented as a clean lint run.

Signed release APK/AAB builds and Google bundletool validation are checked locally.
`npm run android:verify` verifies the actual APK and AAB signatures, runs Google's
pinned bundletool, inspects SDK/package values from the compiled bundle, compares
the APK certificate to the website association and writes artifact SHA-256s to
`artifacts/android/verification.json`.
APK verification checks its real signing certificate against the website file,
application ID, version and SDK bounds. Web integration checks cover manifest/icon
responses, exact dotfile exposure, actual game/tutorial launch and full viewport
layout on desktop Chromium, Android Chromium emulation and iPhone WebKit emulation.

Local browser checks:

```powershell
# In another terminal: serve the production build on an unused port.
npm run build
$env:NODE_ENV='production'; $env:PORT='3182'; node server/dist/index.js
```

```powershell
$env:ANDROID_E2E='1'; $env:E2E_START_SERVER='0'
$env:E2E_URL='http://127.0.0.1:3182'
npx playwright test tests/e2e/android-package.spec.mjs --project='Chrome (desktop)' --project='Android phone (Chrome)' --project='iPhone (Safari)' --retries=0
```

Initial preparation had no phone attached. On November 1, the signed APK was
installed and launched on the user's Pixel 10 Pro XL / Android 17 over wireless
ADB, and its actual first portrait game screenshot showed full-screen play with
no browser address bar. The APK certificate also matches the deployed website
association. Full physical-device checks remain for both orientations, touch aim,
all five tutorials, sound/mute, Back, Home/resume, name entry/keyboard, network
loss/reconnection and repeat launch. Compilation/browser emulation alone is not
evidence for these checks.

## Closed-test update and production release

1. Use the existing Ascend Avoid app and closed-testing track in Console. Inspect
   the latest used version codes, accepted upload certificate and distribution
   signing certificates before preparing an update.
2. Verify the actual privacy/Data safety declarations, audience, ads declaration,
   content rating and listing status in Console. Historical unchecked items are
   not evidence that current store setup is incomplete or complete.
3. Deploy and verify the matching production website associations, then upload
   the signed AAB with its new version code to the intended tester track. Record
   review/rollout state and verify an actual Play-installed update and fullscreen
   launch. A merged website change is not a published native release.
4. Inspect Console's current closed-testing and production-access requirements.
   Real tester participation and Google's review determine eligibility; bots,
   browser tests and a local APK installation do not establish it.

Sources: [TWA setup](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start),
[target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk),
[new personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).

The Android launcher requests sticky immersive display and allows the arena behind short-edge camera cutouts. HUD controls use the web safe-area insets. This launcher change requires a new APK.

On November 27 the updated launcher on a Pixel 10 Pro XL had a full 1344 × 2992
window, but Chrome 158 placed its web content at y=200. A document fullscreen
request on the affected phone moved the content to y=0 within the same session.
The local web client requests this recovery on Play or Tutorial when the installed
Android fullscreen view reports a short layout. A resumed room checks again on
the first arena gesture. This client change takes effect with a web deployment.
