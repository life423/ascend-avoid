ASCEND V12 — MAIN ANDROID ICON SET

Approved larger, text-free blue player and gold gem artwork. Main version has no text.

INCLUDED
play-store/: opaque 512x512 RGBA (32-bit) sRGB PNG under 1 MiB, full square.
source/: opaque 1024 master and transparent adaptive extraction source.
res/mipmap-mdpi, hdpi, xhdpi, xxhdpi, xxxhdpi: 48/72/96/144/192px legacy icons plus round variants.
res/drawable-*: transparent 108dp adaptive foreground at 108/162/216/324/432px.
res/drawable/: independent full-bleed navy vector background.
res/mipmap-anydpi-v26/: Android 8+ adaptive XML for normal and round names.
previews/: circle, rounded-square and squircle adaptive mask simulations.
AndroidManifest-snippet.xml: attributes to merge; not a complete manifest.
validation.json and SHA256SUMS.txt: checked dimensions, modes and content hashes.

INTEGRATION
Review existing resources before copying res/ into your Android module's appropriate source set. Use the supplied manifest icon names. For separate production/test flavors, place resources in the corresponding source sets and set each flavor's icon reference. TEST resources are separately named to avoid replacing main resources. Separate installable test and main apps also require distinct application IDs; icons alone do not accomplish that.

ADAPTIVE BEHAVIOR
These are real separated adaptive layers, not a flattened square labeled adaptive. The essential foreground (alpha above 50%) is inset into a conservative central 64dp-diameter disk on a 108dp canvas so the player, gem and TEST lettering survive masks. It will look smaller than the full-square store/legacy art. The background is solid navy rather than the original subtle navy gradient. For TEST the corner ribbon is inset with the composition to preserve its label under masking; it does not touch every launcher's outer edge. Extraction preserves the approved artwork with minor possible edge/glow differences.

CUSTOM MONOCHROME/THEMED ICON NOT INCLUDED. The attempted monochrome conversion did not meet quality requirements, so no failed asset or misleading monochrome declaration is shipped. Android/launcher automatic themed fallback may vary; color icons are supplied for legacy and adaptive use.

VALIDATION SCOPE
PNG dimensions, RGBA/alpha, sRGB metadata, store byte limit, XML syntax and local resource references validated; mask previews visually reviewed. No Android project was supplied, so no app build, emulator/device installation or OEM-launcher verification was performed. These are launcher/store icon resources, not a notification small icon, splash-screen implementation, feature graphic, APK or AAB. No repository files changed or store publishing performed.


REFERENCES
https://developer.android.com/develop/ui/compose/system/icon_design_adaptive
https://developer.android.com/distribute/google-play/resources/icon-design-specifications
