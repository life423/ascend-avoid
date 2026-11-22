# Android testing and release checklist

## November 22 current Play distribution

Ascend Avoid already exists in the drewclark.io Play Console account as
`io.drewclark.ascendavoid`, with an Alpha closed-testing release 1 / 1.0.0.
The user provided the correct existing Play Console account; Console confirms
the app is in closed testing. Its all-app-bundles list contains only code 1, so
the prepared code 2 is unused. Earlier "pending store phase" and account-creation
notes below are historical.

The fullscreen correction's signed 1.0.1/code-2 AAB is a native release candidate.
The existing upload certificate matches the local signing key. Play's three
confirmed app-signing fingerprints are authorized alongside the local fingerprint
in the production association file; deploy and verify those associations on all
three production hosts before the Play rollout. Test keeps its separate package,
staging origin and association. Record the Console review/rollout result and an
actual Play-installed fullscreen check separately from the successful direct-APK
Pixel test. Eligible Play testers receive published updates according to their
update settings; a website merge does not upload a native bundle to Play.

## Historical November 1 workflow

Agreed November 1, 2026: feature branches are tested separately. Merging to main
continues to deploy the live website and server. The regular Android app loads
that live game, so a fresh load picks up web changes. Native launcher, permission,
SDK or icon changes still require a new APK/Play release. There is no automatic
APK push from GitHub to the user's phone.

## Five work areas

1. **Git/GitHub and release traceability — started.** Wireless install support is
   committed as `f6605ef` and merged in PR #65 as `97c9a35`. Main already requires `CI Build
   and Test`; force pushes/deletion are blocked. Keep short-lived feature branches
   and pull requests rather than a second long-lived codebase. The explicitly
   deferred Ubuntu browser matrix stays deferred. Future work: expose both APK
   and web release identifiers in the menu and record physical test results on PRs.
2. **Recoverable signing backup — local restore verified.**
   `npm run android:backup` exports the private key into password-protected PKCS12,
   restores it into a fresh keystore and compares the public certificates. The
   user's real backup succeeded at `artifacts/android/signing-backup.p12`.
   **Copying it to secure storage outside this PC and retaining the full password
   separately remains user work.** Private keys/passwords never go into Git,
   Docker, GitHub artifacts or this document.
3. **Isolated staging and Test app — operational.**
   <https://ascend-avoid-staging.livelyisland-db4ad2db.eastus.azurecontainerapps.io/>
   runs in its own Azure Container App, using the existing Consumption environment,
   0.5 CPU / 1 GiB and zero-to-one replicas. Its rooms and in-memory state are
   separate from production. Candidate `68760b5` deployed through successful
   workflow `41325001817`, pinned to an immutable image digest. PR #67 subsequently
   merged as `884357e`; production workflow `41325948278` deployed that merge.
   All nine hosted Android website integration cases passed on each environment
   on desktop Chrome, Android Chrome emulation and iPhone Safari emulation.
   The staging Actions workflow is now on main and dispatchable;
   it checks an exact feature commit and deploys its image digest to staging
   only. GitHub's `staging` deployment environment has been created and restricts
   workflow controllers to protected branches. YAML parsing and embedded Bash
   syntax checks pass. The Test APK is built and signature/bundle verified with
   its own package, app name and compiled staging URL. Local production and staging
   modes each pass nine browser integration checks, including association isolation.
   Ascend Avoid Test is installed alongside the regular app on the Pixel; its
   actual staging URL and portrait full-screen launch were inspected. Full device
   playtesting remains. Results are recorded by the corresponding workflow run
   and ignored `artifacts/android/test/device-installation.json`.
4. **Physical device and human play — partial.** The user's Pixel 10 Pro XL runs
   Android 17/API 37. The production APK was installed wirelessly and portrait
   full-screen launch inspected. Remaining: both orientations, aim/movement/puff,
   all five lessons, sound/mute, keyboard/name entry, Back, Home/resume, reconnect,
   repeat launch and a longer session for lag/heat/battery. The assistant handles
   reproducible technical checks; the user judges feel/fun. Fresh players are
   still needed to assess uncoached learning and enjoyment.
   The user's November 1 Pixel feedback is tracked in #69 and
   [TODO.md](TODO.md#physical-device-checks): held tutorial input,
   thumb reach, injured escape, surprise shots, perceived stun and part/fan
   overlap. These are current device-readiness findings, not completed checks.
5. **Distribution and operating habits — November 1 preparation.** Use wireless
   debugging on trusted networks/computers while developing; turn it off when
   done. Play internal testing comes after account setup. Add the Play distribution
   certificate to website verification and test the Play-installed build. Complete
   privacy/Data safety from actual server logging, listing artwork and required
   real-human closed testing before production. This was the preparation status
   on November 1; the current Alpha track is recorded above.

## Candidate to release

- Work on a feature branch and open a PR targeting main. Required CI runs there.
- Run **Test a candidate on staging** from
  main, supplying the feature commit's full SHA. Credentials remain in GitHub
  secrets. Only the hardcoded staging app is targeted, and the deployment receipt
  records the actual digest/revision. Staging never updates production's latest tag.
- Review browser/device evidence and human feel before merging. A Git branch alone
  does not isolate a running backend; tests must use the staging address.
- Merge the approved PR to main. The existing production workflow deploys the live
  web game, including what regular Android users load. A staging-only feature is
  not released merely because it was pushed to GitHub.
- Native app changes additionally need the signed install command or a Play release.
  Keep the Test package separate so it can coexist with the regular app. The Test
  APK is built with `npm run android:test:build`; install it using
  `npm run android:test:phone`. CI native artifact distribution remains follow-up work.

No public self-hosted Actions runner on the user's PC is planned. Wireless ADB
remains a local device-testing channel. Azure federation/OIDC and richer artifact
automation are follow-ups; current staging automation reuses existing repository
deployment secrets rather than claiming credential isolation is complete.
