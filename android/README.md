# Ascend Avoid for Android

The Android app hosts the live arena in an edge-to-edge Android WebView. Its
activity owns fullscreen from launch. The game, including the title screen and
tutorials, still loads from the configured HTTPS origin and requires a connection.
Production 1.0.2/code 3 opens ascendavoid.com. The separate Test package
1.0.1/code 2 opens staging. Both use the same activity.

Updates retain the package, signing and icons. On the first update from a
Chrome-backed build the embedded browser starts with its own saved name, settings
and tutorial progress. The previous data stays in Chrome.

See [Android build and release](../docs/ANDROID_RELEASE.md) for setup, signed APK/AAB
builds, website verification, signing-key handling and remaining Play Console work.

The selected V12 bundles are saved under `branding/ascend-android-main-v12/` and
`branding/ascend-android-test-v12/`; earlier V10 sources remain archived there too.
Each target selects its own unchanged supplied adaptive foreground/background,
regular/round launcher XML and legacy density exports. The former flattened-art
inset wrapper is removed. Production resources are in `app/src/production/res/`;
Test resources are in `app/src/testApp/res/`. That artwork update preserved app
IDs, signing and the then-current origins.
Both V12 APKs were verified, installed and launched on the Pixel over Wi-Fi.
Supplied mask previews were inspected; actual V12 launcher/theme review remains.
Build/verify with `npm run android:test:build` / `npm run android:test:verify`;
update the installed apps using `android:phone` / `android:test:phone` (add
`-- -SkipBuild` to install an already verified build). No hosted release was made.
