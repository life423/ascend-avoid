# Supplied Android icon artwork

Saved locally November 1, 2026, at the user's request, from
`C:/Users/aiand/Downloads/ascend-android-assets-v10/ascend-android-assets/`.
All ten supplied files were copied unchanged and SHA-256 checked against their
source copies. `import-manifest.json` records the independent copy verification.
PNG dimensions were read from the files: a 1024px master, a 512px store icon and
48/72/96/144/192px legacy launcher exports. The supplied license and validation
metadata are retained as provided.

The production build now selects the five unchanged launcher exports, copied to
`android/app/src/production/res/` as `ic_launcher_production.png`. Its distinct
resource name prevents the old adaptive launcher XML from overriding the selected
artwork. Test builds use their separately supplied TEST-marked assets.

After the user reported Android's white legacy wrapper, API 26+ now selects
adaptive XML with a dark background and the original 1024px master, unchanged,
inset to retain the lettering within the safe circle. Older Android still uses
the supplied density rasters. The corrected build was installed on the Pixel
over Wi-Fi; a launcher screenshot confirms the dark circular icon without the
white surround. Other masks and themed appearance remain checks. The 512px store
image is saved for the listing; nothing was published to the store or website.
