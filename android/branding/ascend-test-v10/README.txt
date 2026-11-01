ASCEND — MARKED TEST-BUILD ICONS

Same approved Clean & Minimal V10 artwork with a muted coral TEST badge.
Production artwork remains unchanged. Use only for the test build.

play-store/ascend-test-512.png — 512 x 512 opaque 32-bit sRGB PNG.
source/ascend-test-master-1024.png — 1024 x 1024 opaque master.
res/mipmap-mdpi/ic_launcher_test.png — 48 x 48
res/mipmap-hdpi/ic_launcher_test.png — 72 x 72
res/mipmap-xhdpi/ic_launcher_test.png — 96 x 96
res/mipmap-xxhdpi/ic_launcher_test.png — 144 x 144
res/mipmap-xxxhdpi/ic_launcher_test.png — 192 x 192
licenses/Fredoka-OFL.txt — font license. Actual Fredoka Medium 500 is used.

Integrate with the test application's manifest/build-flavor resources after
checking existing naming. This archive does not change the app, application
ID, signing, build flavor or installed application. A different icon alone
does not allow two packages with the same application ID to coexist.

ADAPTIVE ICONS ARE NOT INCLUDED.
These are legacy raster exports, not separate foreground/background layers.
Existing mipmap-anydpi-v26 adaptive XML can override them. The test badge's
placement also needs mask/safe-zone review when preparing adaptive layers.
Do not use a full opaque square as the monochrome themed foreground.

Do not upload this TEST-marked asset as the production public-store icon.
No repository replacement, APK rebuild, installation or publishing performed.
