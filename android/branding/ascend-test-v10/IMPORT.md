# Supplied Test app artwork

Saved November 1, 2026 at the user's request from the supplied OneDrive Desktop
bundle. All ten source files were copied unchanged and independently SHA-256
verified; see `import-manifest.json`. The five legacy launcher PNGs are also
copied unchanged into `android/app/src/testApp/res/`.

The Gradle `ascendTarget=test` build includes that resource directory and selects
`@mipmap/ic_launcher_test` in the manifest. The production build selects
`@mipmap/ic_launcher_production` and does not include the Test resource directory.
The unique Test resource name prevents the existing production adaptive-icon XML
from overriding these supplied raster images.

After the white-wrapper report, API 26+ selects target-specific adaptive XML:
dark background and the unchanged 1024px master inset to keep the TEST badge and
lettering within the safe circle. Older Android retains the supplied density
rasters. The corrected build was installed and launched on the Pixel over Wi-Fi.
The TEST badge on its launcher, other masks and themed appearance remain manual
checks; only the regular icon was visually confirmed. The marked 512px store
artwork is never selected for production. No hosted publication was performed.
