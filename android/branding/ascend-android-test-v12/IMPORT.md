# V12 Test icon import — November 1, 2026

Saved all 28 supplied files unchanged from the user's Downloads ZIP after the
extracted source directory was removed. Archive paths and supplied validation
hashes were checked. import-manifest.json records the saved originals.

The Test target uses the supplied adaptive background and five transparent
foregrounds with the red TEST ribbon, separate normal/round XML and ten legacy
normal/round exports. Resources are copied unchanged to app/src/testApp/res;
the old flattened-master inset wrapper is removed. Production does not include
this target resource directory.

Signed APK/AAB, package/origin, signatures, both adaptive resources and Google
bundle validation pass. All 15 packaged density images preserve visible RGB and
exact alpha; Android crunch only normalizes fully transparent RGB. The installed
APK hash matches the verified artifact. Wireless Pixel installation/launch passed.
Supplied mask previews were inspected; actual V12 masks/themes remain manual review.

The Test package and staging origin remain separate from production. No web
deployment or Google Play publication was made. V10 sources remain archived.
