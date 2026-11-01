# Ascend Avoid for Android

Native Trusted Web Activity project, initially generated with Google's Bubblewrap
1.27.0 and Android Browser Helper 2.7.4. The checked-in Gradle project is the source
for subsequent builds. It opens the existing live game at
<https://ascend.drewclark.io/>; an internet connection is required.

See [Android build and release](../docs/ANDROID_RELEASE.md) for setup, signed APK/AAB
builds, website verification, signing-key handling and remaining Play Console work.

The selected V12 bundles are saved under `branding/ascend-android-main-v12/` and
`branding/ascend-android-test-v12/`; earlier V10 sources remain archived there too.
Each target selects its own unchanged supplied adaptive foreground/background,
regular/round launcher XML and legacy density exports. The former flattened-art
inset wrapper is removed. Production resources are in `app/src/production/res/`;
Test resources are in `app/src/testApp/res/`. App IDs, signing and origins remain.
Both V12 APKs were verified, installed and launched on the Pixel over Wi-Fi.
Supplied mask previews were inspected; actual V12 launcher/theme review remains.
Build/verify with `npm run android:test:build` / `npm run android:test:verify`;
update the installed apps using `android:phone` / `android:test:phone` (add
`-- -SkipBuild` to install an already verified build). No hosted release was made.
