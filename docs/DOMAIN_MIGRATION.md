# Ascend Avoid: Domain configuration and release record

## November 21, 2026 pre-cutover checkpoint

The user approved making `https://ascendavoid.com/` the public game address,
keeping the previous address usable, then redirecting document visits from
`ascend.drewclark.io` and `www.ascendavoid.com` to the apex. The user explicitly
accepted that existing Android installations may show browser chrome after the
cross-origin redirect. This does not authorize changing the Android launcher or
publishing a new APK.

This dated checkpoint records configuration and checks for the game changes from
main `1f12bb8` in [PR #98](https://github.com/life423/ascend-avoid/pull/98).
At this checkpoint both new hostnames passed HTTPS and online play, while the
application merge, deployment and post-deployment redirect/metadata checks were
the remaining release gates. The migration code and redirects had not yet been
deployed. PR #98 and its linked production workflow provide the final live
rollout and verification record, including outcomes after this checkpoint.

### Squarespace DNS

These records were saved through Squarespace, with a configured TTL of **1 hour
(3,600 seconds)** on each. The authoritative records were checked against Azure's
production environment and domain verification value:

| Type | Host | Value | TTL |
| --- | --- | --- | --- |
| A | `@` | `4.157.37.196` | 1 hour |
| CNAME | `www` | `ascend-avoid.livelyisland-db4ad2db.eastus.azurecontainerapps.io` | 1 hour |
| TXT | `asuid` | `E9C98AB3BDD3D8CBC403384E496A4EB44F4F7A56EF137778B74ACB5732201196` | 1 hour |
| TXT | `asuid.www` | `E9C98AB3BDD3D8CBC403384E496A4EB44F4F7A56EF137778B74ACB5732201196` | 1 hour |

Preserve Squarespace's existing **Email Security** TXT records (`@`, `_dmarc` and
`_domainkey`) and **Domain Connect** `_domainconnect` record. The migration only
replaces website address records and adds Azure's two verification TXT records;
do not remove unrelated email/domain-management records or the old game's DNS.
Recursive resolvers can retain older Squarespace answers until their previous
cache entries expire; the one-hour value above is the new configured TTL.

### Verified hostname bindings and pre-cutover checks

Both managed certificates succeeded and were bound with `SniEnabled` to the
existing production Container App `ascend-avoid` in `ascend-avoid-rg`, environment
`ascend-avoid-env`. The old hostname binding was retained.

| Hostname | Managed certificate | Binding | Verified certificate expiry |
| --- | --- | --- | --- |
| `ascendavoid.com` | `mc-ascend-avoid-e-ascendavoid-com-7860` | `SniEnabled` | May 21, 2027 23:59:59 UTC |
| `www.ascendavoid.com` | `mc-ascend-avoid-e-www-ascendavoid--0207` | `SniEnabled` | May 21, 2027 23:59:59 UTC |

- Normal play passed **4/4**: apex and www, each on desktop Chromium and iPhone
  WebKit. Checks covered ordinary entry, real matchmaking/WebSockets, rendering,
  screen fit, movement and inhale. The apex's ordinary private combat tutorial
  also passed **2/2** on those profiles.
- An independent Node check at 19:35:01–19:35:12 UTC validated normal TLS
  authorization, matching SANs and certificate validity on apex, www and the old
  host. Each returned direct 200 responses for health, HTML, four compiled
  assets, the manifest, three manifest icons and production Digital Asset Links.
  The old certificate was valid through March 25, 2027 23:59:59 UTC.
- An old-host spectator used `joinOrCreate`, then an apex spectator used
  `joinById` for the same room `WVlQrUqdw`. Both received advancing room time
  `360144` to `360644` and left cleanly with code `4000`; neither spawned a player.
  Machine-local JSON proof is in the ignored
  `.tmp/domain-migration/live-domain-check-proof.json`.
- These checks exercised the existing production game before PR #98 deployment,
  with normal TLS verification and no production admin/test hooks. Phone results
  are browser-engine emulation, not physical-device certification.
- Required CI passed for the initial PR #98 preparation head `dc43bb4`, including
  desktop Firefox, Firefox on the Android emulator and **CI Build and Test**.
  At this checkpoint final-head checks, merge, production deployment and the
  new redirect/canonical/menu metadata checks remained gates recorded on PR #98.
  Portfolio links should change after the hosted cutover verification passes.

## Application behavior in PR #98

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

Historical local preparation checks passed before the DNS/HTTPS cutover:
complete client/server type checking, the production build/package check,
scoped source lint, HTTP redirect/origin
regressions, and 15 metadata/privacy/menu-link cases across desktop Chromium,
emulated Android Chromium and iPhone WebKit. The focused HTTP suite also covers
the index-to-root mapping and a health probe without a Host header. Menu
screenshots were reviewed at all three sizes. These results establish the local
candidate's behavior; current hosted readiness is recorded above. Physical
Android/iPhone validation remains a separate follow-up.

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
