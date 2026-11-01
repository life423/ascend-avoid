# Android build and release

## Current preparation

October 31, 2026: prepared on `codex/android-store-build`, based on deployed main
`cf28d12`. The user requested an Android build while Google reviews the new
personal developer account. The user subsequently approved committing the work,
merging it into main and deploying the website verification file for phone
testing. GitHub's pull request and production workflow identify the published
revision and rollout result. No app has been uploaded to Google Play; installed
phone testing remains a separate check.

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

The package ID must be finalized before the first Play upload. Future updates
must keep it and increment `versionCode` in `android/app/build.gradle`.

The icons reuse the current website mark, with a separate maskable icon and an
Android monochrome icon. `node scripts/android-icons.mjs` regenerates the web PNGs
using the existing Playwright dependency. Native icon resources are checked in.
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

## Signing and backup

The first release build creates a unique 3072-bit RSA upload key at
`%USERPROFILE%\.android\ascend-avoid-signing\upload.jks`. Its generated password is
stored in `password.xml` alongside it, encrypted with Windows DPAPI for the
current Windows user. Neither file belongs in Git or Docker. Build scripts pass
the password through a temporary process environment variable and restore that
environment afterward; passwords are not printed or placed in command arguments.

Back up the key and recoverable credentials securely before the first Play upload.
The DPAPI password file alone is not a portable password backup for a different
Windows installation/user. Do not regenerate or replace the key during routine
builds; the script refuses incomplete key/password pairs. Play App Signing will
manage the distribution key after enrollment; this local key signs uploads.

## Website verification required for full screen

The native application already declares its association with the real production
origin. The corresponding **public** `public/.well-known/assetlinks.json` contains
the upload certificate SHA-256, enabling direct-install APK verification after
the website changes are deployed. The server exposes only that exact file;
other dotfiles remain inaccessible.

**Until that file is deployed, the test APK may open with a browser address bar.**
This is the normal unverified Custom Tab fallback, not proof that a full-screen
TWA has been tested. No verification-bypass flags are used.

Google Play normally signs distributed installations with a different app-signing
certificate. After enrolling in Play App Signing, get the **app signing key
certificate SHA-256** from Play Console's App integrity page, then run:

```powershell
npm run android:assetlinks -- -PlaySigningFingerprint 'AA:BB:...:FF'
```

Use the real full 32-byte fingerprint. The script preserves existing fingerprints
and adds it alongside the direct-install certificate. Build, review and deploy
the website update, then verify the Play-installed app's full-screen launch.
An upload certificate alone does not verify the differently signed Play install.

## Validation and limits

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

No Android phone was attached to ADB during preparation. Compilation, browser
emulation and bundle validation do not establish an installed-device result.
On a real phone, test launch/trusted full screen, both orientations, touch aim,
all five tutorials, sound/mute, Back, Home/resume, name entry/keyboard, network
loss/reconnection and repeat launch. The new website metadata must be deployed
before the trusted full-screen test can pass.

## Remaining Google Play steps

1. Finish account identity/device/phone verification, then create Ascend Avoid as
   a game in Play Console. Finalize the package ID before first upload.
2. Review actual hosting/logging and complete the privacy policy, Data safety,
   target audience, ads declaration, content rating and store listing. Prepare
   screenshots and a feature graphic. These declarations are not yet completed.
3. Upload the signed AAB to internal testing, enroll in Play App Signing, add its
   distribution certificate to the website and verify an actual Play installation.
4. This new personal account must meet Google's closed-test requirement before
   applying for production: at least 12 testers opted in continuously for at least
   14 days. Recruiting those testers remains work; bots and browser tests do not
   establish that requirement. Meeting the minimum permits an application for
   production access and is not a guarantee of approval.

Sources: [TWA setup](https://developer.chrome.com/docs/android/trusted-web-activity/quick-start),
[target SDK requirements](https://developer.android.com/google/play/requirements/target-sdk),
[new personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en).
