# Android testing and release checklist

Agreed November 1, 2026: feature branches are tested separately. Merging to main
continues to deploy the live website and server. The regular Android app loads
that live game, so a fresh load picks up web changes. Native launcher, permission,
SDK or icon changes still require a new APK/Play release. There is no automatic
APK push from GitHub to the user's phone.

## Five work areas

1. **Git/GitHub and release traceability — started.** Wireless install support is
   committed as `f6605ef` and backed up in PR #65. Main already requires `CI Build
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
3. **Isolated staging — baseline live; candidate automation prepared.**
   <https://ascend-avoid-staging.livelyisland-db4ad2db.eastus.azurecontainerapps.io/>
   runs in its own Azure Container App, using the existing Consumption environment,
   0.5 CPU / 1 GiB and zero-to-one replicas. Its rooms and in-memory state are
   separate from production. It initially runs verified main `18ae56f`, rather
   than an untested feature. All nine existing Android website integration cases
   passed against this baseline on desktop Chrome, Android Chrome emulation and
   iPhone Safari emulation. This does not establish physical-phone testing.
   The new staging Actions workflow must first land on main to become dispatchable;
   it then checks an exact feature commit and deploys its image digest to staging
   only. GitHub's `staging` deployment environment has been created and restricts
   workflow controllers to protected branches. YAML parsing and embedded Bash
   syntax checks pass; the workflow itself has not run yet.
   **A separately named/package-isolated Test APK is not built yet.**
4. **Physical device and human play — partial.** The user's Pixel 10 Pro XL runs
   Android 17/API 37. The production APK was installed wirelessly and portrait
   full-screen launch inspected. Remaining: both orientations, aim/movement/puff,
   all five lessons, sound/mute, keyboard/name entry, Back, Home/resume, reconnect,
   repeat launch and a longer session for lag/heat/battery. The assistant handles
   reproducible technical checks; the user judges feel/fun. Fresh players are
   still needed to assess uncoached learning and enjoyment.
5. **Distribution and operating habits — pending store phase.** Use wireless
   debugging on trusted networks/computers while developing; turn it off when
   done. Play internal testing comes after account setup. Add the Play distribution
   certificate to website verification and test the Play-installed build. Complete
   privacy/Data safety from actual server logging, listing artwork and required
   real-human closed testing before production. None of this preparation publishes
   the app on Google Play.

## Candidate to release

- Work on a feature branch and open a PR targeting main. Required CI runs there.
- Once the staging workflow is on main, run **Test a candidate on staging** from
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
  APK, staging Digital Asset Links and CI native artifacts remain implementation work.

No public self-hosted Actions runner on the user's PC is planned. Wireless ADB
remains a local device-testing channel. Azure federation/OIDC and richer artifact
automation are follow-ups; current staging automation reuses existing repository
deployment secrets rather than claiming credential isolation is complete.
