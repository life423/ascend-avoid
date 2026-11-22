# Ascend Avoid for Android

Native Trusted Web Activity project, initially generated with Google's Bubblewrap
1.27.0 and Android Browser Helper 2.7.4. The checked-in Gradle project is the source
for subsequent builds. It opens the existing live game at
<https://ascendavoid.com/>; an internet connection is required.

The November 22 fullscreen correction updates production to version 1.0.1/code 2.
It launches the canonical origin directly and explicitly trusts the previous and
www origins. Install the signed update over the existing app; old APKs retain
their original trust configuration. Package, signing key and artwork stay the
same. The separate Test app still opens only staging.

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
