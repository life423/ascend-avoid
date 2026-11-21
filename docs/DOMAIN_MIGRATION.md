# Ascend Avoid domain migration — November 21, 2026

## Prepared, not deployed

The user approved making `https://ascendavoid.com/` the public game address,
keeping the previous address usable, then redirecting document visits from
`ascend.drewclark.io` and `www.ascendavoid.com` to the apex. The user explicitly
accepted that existing Android installations may show browser chrome after the
cross-origin redirect. This does not authorize changing the Android launcher or
publishing a new APK.

This branch prepares the game changes from main `1f12bb8`. DNS, managed
certificates, hostname bindings, hosted validation and deployment are still
pending. The user is entering the exact Azure-provided records in Squarespace;
do not substitute guessed addresses or change unrelated DNS records. Do not
merge/deploy this code or update the portfolio play links until both new
hostnames resolve to the existing game service and pass HTTPS and online-play
checks. Record the final Azure bindings, verified revision and release results
here when those steps finish.

## Runtime behavior

- The primary page and privacy page declare their new canonical URLs. The menu
  play link, visible hostname and static QR now use `https://ascendavoid.com/`.
  Regenerate the QR with the existing pinned generator:
  `npx --yes --package=qrcode@1.5.4 qrcode --type svg --error M --qzone 4 --output src/assets/play-qr.svg https://ascendavoid.com/`.
- Only GET/HEAD requests for `/`, `/index.html` or `/privacy-policy.html` on the exact previous
  hostname or `www.ascendavoid.com` receive a permanent 308 redirect. The target
  origin and document paths are fixed; `/index.html` maps to the primary root and
  original query text is preserved. Primary,
  staging, localhost and unrelated hostnames are not redirected.
- Health checks, manifests, static assets, Digital Asset Links, HTTP matchmaking
  and WebSocket upgrades remain available directly on the previous host. This
  preserves routes used by already-open clients. Keep the old DNS/HTTPS binding.
- CORS defaults include the apex, www, previous production site and the two
  localhost development origins. An explicit `CORS_ORIGINS` value still replaces
  those defaults. Inspect the live setting before release; a configured override
  will not automatically pick up the new defaults. Staging retains its separate
  app and its explicit staging-origin override.
- Production HTTP/WebSocket play already follows the page's origin. No gameplay,
  room rules, OAuth callback, service worker or new runtime dependency changes.

## Android and local data

`android/targets.json` and the Android launcher remain on the previous origin.
The redirect can cause a browser toolbar in an already-installed Trusted Web
Activity; the user accepted this tradeoff. A future native migration requires
separate launch/trust configuration, a version increment, signed artifact checks
and phone review. The production `/.well-known/assetlinks.json` must continue
returning the public association JSON directly on both hosts. Do not redirect it
or replace production association data with the Test app's file.

Browser storage belongs to each origin. Saved names, sound/steering preferences
and tutorial progress from the old address do not automatically transfer to the
apex or www address. Old stored data remains on-device; the privacy page explains
clearing either site's data. No account or cross-origin data transfer is added.

## Release verification

1. Keep both the old and new names bound to the same production Container App.
   Verify DNS and valid HTTPS independently for apex, www and the old hostname.
   Check `/health`, the game HTML, hashed assets, manifest and association JSON.
2. Before activating the redirect, join a normal room at the new apex using real
   matchmaking and secure WebSockets; verify advancing state, movement and a
   private lesson. Review phone/desktop loading and console/network errors.
3. After deployment, verify old/www root, index and privacy GET/HEAD responses are 308,
   their Location stays on the fixed apex, and encoded/repeated query parameters
   survive. Confirm primary and staging do not redirect or loop.
4. Confirm old health, static assets, association JSON, matchmaking and existing
   WebSocket connections remain direct. Check menu links/QR, privacy, canonical
   URLs and production package metadata. Update portfolio links only after the
   hosted new-domain checks pass.
5. If reviewing the installed Android app, distinguish successful gameplay from
   the accepted browser-toolbar tradeoff. Do not claim a new native release.

Focused code checks: `npx tsx server/tests/domain-migration.unit.ts` (also included
in `test:unit`), `npm run type-check`, `npm run build`, scoped lint, and the
domain-links, privacy-policy and Android website metadata browser tests against
an isolated local production server. Hosted DNS/HTTPS and physical-device
results cannot be inferred from these local checks.

Local preparation checks passed: complete client/server type checking, the
production build/package check, scoped source lint, HTTP redirect/origin
regressions, and 15 metadata/privacy/menu-link cases across desktop Chromium,
emulated Android Chromium and iPhone WebKit. The focused HTTP suite also covers
the index-to-root mapping and a health probe without a Host header. Menu
screenshots were reviewed at all three sizes. This is browser-engine emulation,
not physical Android/iPhone validation; hosted DNS/HTTPS is still pending.

## Rollback

Retain the old hostname, certificate and working routes throughout the migration.
If new-host validation fails before release, leave the current deployment and
portfolio links in place while fixing the new DNS/binding/certificate. Revert
only new DNS records if they were incorrect; preserve unrelated Squarespace
records and the old site.

After release, revert the migration PR through the normal deployment workflow
or route production traffic back to its previous healthy revision. Restore
previous portfolio links if the new hostname is unavailable. Keep both hostname
bindings and necessary CORS origins during recovery; cached permanent redirects
may persist in browsers, so DNS/certificate availability at the new host must be
maintained even while rolling back application changes. Record actual rollback
actions and verification here; this document is not evidence they were executed.
