ASCEND — CLEAN & MINIMAL ANDROID RASTER EXPORTS

Selected artwork: Clean & Minimal V10. One blue player, one gold gem,
actual Fredoka Medium 500 lettering. No application files were replaced.

FILES
play-store/ascend-play-512.png — Google Play listing icon, 512 x 512,
32-bit RGBA PNG, sRGB, opaque, under 1 MB, full square.
source/ascend-master-1024.png — opaque 1024 x 1024 artwork master.
res/mipmap-mdpi/ic_launcher.png — 48 x 48
res/mipmap-hdpi/ic_launcher.png — 72 x 72
res/mipmap-xhdpi/ic_launcher.png — 96 x 96
res/mipmap-xxhdpi/ic_launcher.png — 144 x 144
res/mipmap-xxxhdpi/ic_launcher.png — 192 x 192
licenses/Fredoka-OFL.txt — font license.

USE
Use the 512 PNG for the Google Play store listing, not the AAB/APK itself.
The mipmap files are conventional legacy raster launcher resources.
Merge them into the appropriate Android module only after reviewing the
existing resource names and manifest. This package does not perform that edit.

ADAPTIVE ICON LIMITATION
This is a raster export package, NOT a complete adaptive-icon resource set.
The approved artwork is flattened; foreground/background layers and themed
monochrome artwork have not been independently prepared or validated.
Do not claim these legacy PNGs replace adaptive icons automatically. Existing
mipmap-anydpi-v26 XML may take precedence over them on Android 8 and later.
The adaptive version requires separate 108 dp foreground/background layers,
central safe-region composition and circular/squircle mask inspection.
Do not use the entire square image as a monochrome silhouette.

No iPhone packaging, adaptive XML, APK rebuilding or store publishing included.

OFFICIAL REFERENCES
https://developer.android.com/distribute/google-play/resources/icon-design-specifications
https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
https://developer.android.com/training/multiscreen/screendensities
