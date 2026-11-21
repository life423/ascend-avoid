import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const pkg = 'io.drewclark.ascendavoid';
const origin = 'https://ascend.drewclark.io';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const decimal = (x) => /^[1-9]\d*$/.test(String(x ?? ''));
const fullCommit = /^[a-f0-9]{40}$/;
const digest = /^[a-fA-F0-9]{64}$/;
const assert = (condition, message) => { if (!condition) throw new Error(message); };

export function checkArtifact({ proof, bytes, commit, ciRun, ciAttempt, versionCode }) {
  assert(fullCommit.test(commit ?? '') && decimal(ciRun) && decimal(ciAttempt), 'Expected a full main commit, CI run ID and attempt');
  assert(decimal(versionCode) && Number(versionCode) <= 2100000000, 'Invalid expected Android version code');
  assert(proof?.schema === 1 && proof.packageId === pkg && proof.targetSdk === 36 && proof.minSdk === 24,
    'Unexpected Android artifact schema, package, or SDK');
  assert(proof.signed === false && proof.lintPassed === true && proof.bundletoolValidated === true,
    'CI artifact must be linted, validated and unsigned');
  assert(proof.commit === commit && String(proof.ciRun) === String(ciRun) &&
    String(proof.ciAttempt) === String(ciAttempt) && String(proof.versionCode) === String(versionCode),
  'Artifact commit/run/attempt/version does not match dispatch');
  assert(digest.test(proof.sha256 ?? '') && proof.sha256.toLowerCase() === sha256(bytes), 'Android artifact SHA-256 mismatch');
  assert(/^[0-9A-Za-z][0-9A-Za-z.+-]{0,59}$/.test(proof.versionName ?? ''), 'Invalid version name');
  return { packageId: pkg, commit, ciRun: String(ciRun), ciAttempt: String(ciAttempt), versionCode: Number(versionCode),
    versionName: proof.versionName, unsignedSha256: sha256(bytes) };
}

export function checkDraftRequest(plan, track, confirmation) {
  assert(/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(track ?? '') &&
    !['production', 'internal', 'qa', 'beta', 'open'].includes(track.toLowerCase()),
  'Set the verified API identifier of the closed track in the protected environment');
  assert(plan.versionCode >= 2, 'Version 1 already exists; stage only a reviewed new version code');
  assert(confirmation === 'DRAFT ' + track + ' ' + plan.versionCode + ' ' + plan.commit,
    'Draft confirmation must exactly identify track, version code and full source commit');
}

export function checkAssociation(statements, fingerprint) {
  const normalized = String(fingerprint ?? '').replaceAll(':', '').toUpperCase();
  assert(digest.test(normalized), 'Set the verified Play App Signing certificate SHA-256');
  assert(Array.isArray(statements) && statements.some((s) => Array.isArray(s?.relation) && s.relation.includes('delegate_permission/common.handle_all_urls') &&
    s?.target?.namespace === 'android_app' && s.target.package_name === pkg &&
    Array.isArray(s.target.sha256_cert_fingerprints) && s.target.sha256_cert_fingerprints.some((f) =>
      typeof f === 'string' && f.replaceAll(':', '').toUpperCase() === normalized)),
  'Live Digital Asset Links does not trust this Play App Signing certificate');
}

export async function stageDraft({ request, plan, track, confirmation, signedBytes }) {
  checkDraftRequest(plan, track, confirmation);
  const signedSha256 = sha256(signedBytes);
  assert(signedSha256 !== plan.unsignedSha256, 'Refusing an unchanged unsigned bundle');
  const app = '/androidpublisher/v3/applications/' + pkg;
  // Lifecycle listing also sees unsent/in-review changes that the active-tracks edit view can omit.
  const lifecycle = await request('GET', app + '/tracks/' + encodeURIComponent(track) + '/releases');
  const history = lifecycle.releases ?? [];
  assert(Array.isArray(history) && history.length < 20 && history.every((r) => r.releaseLifecycleState === 'RELEASE_LIFECYCLE_STATE_PUBLISHED' ||
    r.releaseLifecycleState === 'RELEASE_LIFECYCLE_STATE_NOT_APPROVED'),
  'Closed track has an existing draft, pending release, or unknown lifecycle state; refusing to replace it');
  const edit = await request('POST', app + '/edits', {});
  assert(decimal(edit.id), 'Unexpected Google Play edit identifier');
  const path = app + '/edits/' + edit.id;
  let committing = false;
  try {
    const tracks = (await request('GET', path + '/tracks')).tracks;
    assert(Array.isArray(tracks), 'Cannot read all edit tracks');
    const current = tracks.find((t) => t.track === track);
    assert(current, 'Configured closed track was not found in Play');
    const active = current.releases ?? [];
    assert(Array.isArray(active) && active.every((release) => release.status === 'completed'),
      'Selected track has a draft, rollout, or halted release; no bundle was uploaded');
    const existing = await request('GET', path + '/bundles');
    const used = [...tracks.flatMap((t) => (t.releases ?? []).flatMap((release) => release.versionCodes ?? [])),
      ...(existing.bundles ?? []).map((bundle) => bundle.versionCode),
      ...history.flatMap((r) => (r.activeArtifacts ?? []).map((artifact) => artifact.versionCode))];
    assert(used.every(decimal) && used.every((code) => Number(code) < plan.versionCode),
      'Android version code must be higher than every bundle or release visible to this service account');
    const upload = await request('POST', '/upload' + path + '/bundles?uploadType=media', signedBytes);
    assert(String(upload.versionCode) === String(plan.versionCode) && String(upload.sha256).toLowerCase() === signedSha256,
      'Google Play bundle version or SHA-256 does not match the signed artifact');
    const draft = { name: plan.versionName + ' (' + plan.versionCode + ')',
      versionCodes: [String(plan.versionCode)], status: 'draft' };
    const updated = await request('PUT', path + '/tracks/' + encodeURIComponent(track), { track, releases: [...active, draft] });
    const returned = updated.releases;
    // Never commit if Google drops or replaces an active release or returns an unexpected status.
    const key = (r) => r.status + ':' + (r.versionCodes ?? []).map(String).sort().join(',');
    const expected = [...active, draft].map(key).sort();
    assert(updated.track === track && Array.isArray(returned) && JSON.stringify(returned.map(key).sort()) === JSON.stringify(expected),
      'Google Play did not preserve the existing releases and the new draft; not committing');
    await request('POST', path + ':validate');
    committing = true;
    const committed = await request('POST', path + ':commit?changesNotSentForReview=true&changesInReviewBehavior=ERROR_IF_IN_REVIEW');
    assert(String(committed.id) === String(edit.id), 'Unexpected commit receipt');
    const verified = await request('GET', app + '/tracks/' + encodeURIComponent(track) + '/releases');
    assert(Array.isArray(verified.releases) && verified.releases.some((r) =>
      r.releaseLifecycleState === 'RELEASE_LIFECYCLE_STATE_DRAFT' &&
      r.activeArtifacts?.some((a) => String(a.versionCode) === String(plan.versionCode))),
    'Draft commit returned, but the closed-track draft was not confirmed');
    const activeReleaseVersionsPreserved = active.flatMap((r) => r.versionCodes ?? []);
    const publishedAfter = verified.releases.filter((r) => r.releaseLifecycleState === 'RELEASE_LIFECYCLE_STATE_PUBLISHED')
      .flatMap((r) => (r.activeArtifacts ?? []).map((a) => String(a.versionCode)));
    assert(activeReleaseVersionsPreserved.every((code) => publishedAfter.includes(String(code))),
      'Draft response did not confirm existing published versions; check the track manually');
    return { ...plan, signedSha256, track, status: 'draft', playEditId: String(edit.id), activeReleaseVersionsPreserved };
  } catch (error) {
    if (committing) throw new Error('Commit attempted; check Publishing overview before any retry: ' + error.message);
    try { await request('DELETE', path); } catch { throw new Error('Uncommitted edit cleanup was not confirmed; check Play before retrying: ' + error.message); }
    throw error;
  }
}

async function httpsJson(url, { method = 'GET', token, body } = {}) {
  const binary = Buffer.isBuffer(body);
  const headers = token ? { Authorization: 'Bearer ' + token } : {};
  if (body !== undefined) headers['Content-Type'] = binary ? 'application/octet-stream' : 'application/json';
  const response = await fetch(url, { method, headers, body: body === undefined || binary ? body : JSON.stringify(body),
    redirect: 'error', signal: AbortSignal.timeout(binary ? 180_000 : 25_000) });
  if (!response.ok) throw new Error(method + ' ' + new URL(url).pathname + ': HTTP ' + response.status);
  return response.status === 204 || method === 'DELETE' ? {} : response.json();
}

async function main() {
  const [mode, sourceDir, commit, ciRun, ciAttempt, versionCode, signedFile, reportFile] = process.argv.slice(2);
  assert(['plan', 'check-draft', 'stage-draft'].includes(mode), 'Use plan, check-draft or stage-draft');
  const plan = checkArtifact({ proof: JSON.parse(readFileSync(resolve(sourceDir, 'proof.json'), 'utf8')),
    bytes: readFileSync(resolve(sourceDir, 'Ascend-Avoid-unsigned.aab')), commit, ciRun, ciAttempt, versionCode });
  if (mode === 'plan') {
    console.log(JSON.stringify({ ...plan, mode, contactedGooglePlay: false }, null, 2));
    return;
  }
  assert(process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    process.env.GITHUB_REPOSITORY === 'life423/ascend-avoid' && process.env.GITHUB_REF === 'refs/heads/main' &&
    process.env.GITHUB_SHA === commit, 'Staging only runs in the manually dispatched main workflow');
  const artifact = JSON.parse(readFileSync(resolve(sourceDir, 'github-artifact.json'), 'utf8'));
  assert(decimal(artifact.artifactId) && /^sha256:[a-f0-9]{64}$/.test(artifact.archiveDigest ?? '') &&
    artifact.attempt === ciAttempt, 'Missing verified GitHub artifact identity');
  const track = process.env.PLAY_CLOSED_TRACK_ID;
  const confirmation = process.env.PLAY_DRAFT_CONFIRMATION;
  checkDraftRequest(plan, track, confirmation);
  const statements = await httpsJson(origin + '/.well-known/assetlinks.json');
  checkAssociation(statements, process.env.PLAY_APP_SIGNING_SHA256);
  if (mode === 'check-draft') {
    console.log('Exact artifact, explicit closed-track intent and live Play signing association verified.');
    return;
  }
  const token = process.env.ANDROID_PUBLISHER_ACCESS_TOKEN;
  assert(token, 'Missing short-lived Android Publisher token');
  const request = (method, path, body) => httpsJson('https://androidpublisher.googleapis.com' + path, { method, token, body });
  const result = { ...(await stageDraft({ request, plan, track, confirmation, signedBytes: readFileSync(signedFile) })),
    githubArtifactId: artifact.artifactId, githubArchiveDigest: artifact.archiveDigest };
  writeFileSync(reportFile, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
