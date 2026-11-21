import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';
import { checkArtifact, checkAssociation, checkDraftRequest, stageDraft } from '../scripts/android-release.mjs';

const sha = 'a'.repeat(40);
const ci = '21710400421';
const attempt = '2';
const bytes = Buffer.from('fake validated unsigned bundle');
const signedBytes = Buffer.from('fake signed bundle');
const hash = (value) => createHash('sha256').update(value).digest('hex');
const proof = { schema: 1, packageId: 'io.drewclark.ascendavoid', targetSdk: 36, minSdk: 24, versionCode: 2,
  versionName: '1.0.1', commit: sha, ciRun: ci, ciAttempt: attempt, sha256: hash(bytes), signed: false,
  lintPassed: true, bundletoolValidated: true };
const matching = { proof, bytes, commit: sha, ciRun: ci, ciAttempt: attempt, versionCode: '2' };
const plan = checkArtifact(matching);
const confirmation = 'DRAFT alpha 2 ' + sha;
const old = { name: 'v1', status: 'completed', releaseNotes: [{ language: 'en-US', text: 'notes' }], versionCodes: ['1'] };
const published = { releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_PUBLISHED', activeArtifacts: [{ versionCode: 1 }] };
const draft = { releaseLifecycleState: 'RELEASE_LIFECYCLE_STATE_DRAFT', activeArtifacts: [{ versionCode: 2 }] };
const flow = { plan, track: 'alpha', confirmation, signedBytes };

test('accept only exact successful build provenance, digest, package and expected version', () => {
  assert.equal(plan.unsignedSha256, hash(bytes));
  for (const change of [{ bytes: signedBytes }, { commit: 'b'.repeat(40) }, { ciRun: '123' }, { ciAttempt: '1' }, { versionCode: '3' }]) {
    assert.throws(() => checkArtifact({ ...matching, ...change }));
  }
  for (const change of [{ packageId: 'io.drewclark.ascendavoid.staging' }, { signed: true }, { lintPassed: false }, { targetSdk: 35 }, { minSdk: 25 }]) {
    assert.throws(() => checkArtifact({ ...matching, proof: { ...proof, ...change } }));
  }
});

test('plan works as an offline CLI, with no credentials or publisher request', () => {
  const path = mkdtempSync(join(tmpdir(), 'ascend-plan-test-'));
  try {
    writeFileSync(join(path, 'proof.json'), JSON.stringify(proof));
    writeFileSync(join(path, 'Ascend-Avoid-unsigned.aab'), bytes);
    const result = spawnSync(process.execPath, ['scripts/android-release.mjs', 'plan', path, sha, ci, attempt, '2'],
      { encoding: 'utf8', timeout: 4000 });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { ...plan, mode: 'plan', contactedGooglePlay: false });
  } finally {
    rmSync(join(path, 'proof.json'));
    rmSync(join(path, 'Ascend-Avoid-unsigned.aab'));
    rmdirSync(path);
  }
});

test('require exact closed track, a new version and separate Play signing certificate', () => {
  assert.doesNotThrow(() => checkDraftRequest(plan, 'alpha', confirmation));
  for (const track of ['production', 'internal', 'qa', 'beta', 'open', '', '../../alpha']) {
    assert.throws(() => checkDraftRequest(plan, track, 'DRAFT ' + track + ' 2 ' + sha));
  }
  assert.throws(() => checkDraftRequest({ ...plan, versionCode: 1 }, 'alpha', 'DRAFT alpha 1 ' + sha));
  assert.throws(() => checkDraftRequest(plan, 'alpha', confirmation.slice(0, -1)));
  const fp = 'AB:'.repeat(31) + 'AB';
  const association = [{ relation: ['delegate_permission/common.handle_all_urls'], target: {
    namespace: 'android_app', package_name: proof.packageId, sha256_cert_fingerprints: [fp] } }];
  assert.doesNotThrow(() => checkAssociation(association, fp));
  assert.throws(() => checkAssociation(association, 'CD'.repeat(32)));
  assert.throws(() => checkAssociation([], fp));
});

function fake({ pre = [published], alpha = [old], used = [{ versionCode: 1 }], version = 2, updateChange, after = [published, draft], commitError } = {}) {
  const calls = [];
  const request = async (method, url, body) => {
    calls.push({ method, url, body });
    if (method === 'GET' && url.endsWith('/alpha/releases')) return { releases: calls.length === 1 ? pre : after };
    if (method === 'POST' && url.endsWith('/edits')) return { id: '123' };
    if (method === 'GET' && url.endsWith('/edits/123/tracks')) return { tracks: [{ track: 'alpha', releases: alpha }, { track: 'production', releases: [] }] };
    if (method === 'GET' && url.endsWith('/edits/123/bundles')) return { bundles: used };
    if (method === 'POST' && url.includes('/upload/')) return { versionCode: version, sha256: hash(signedBytes) };
    if (method === 'PUT' && url.endsWith('/tracks/alpha')) return updateChange ?? body;
    if (method === 'POST' && url.endsWith(':validate')) return { id: '123' };
    if (method === 'POST' && url.includes(':commit?')) {
      assert.match(url, /changesNotSentForReview=true/);
      assert.match(url, /changesInReviewBehavior=ERROR_IF_IN_REVIEW/);
      if (commitError) throw new Error('simulated unknown commit result');
      return { id: '123' };
    }
    if (method === 'DELETE' && url.endsWith('/edits/123')) return {};
    throw new Error('Unexpected mock endpoint: ' + method + ' ' + url);
  };
  return { request, calls };
}

test('controlled fake stage retains published Alpha, adds one draft, validates and confirms', async () => {
  const { request, calls } = fake();
  const receipt = await stageDraft({ ...flow, request });
  assert.equal(receipt.status, 'draft');
  assert.equal(receipt.signedSha256, hash(signedBytes));
  assert.deepEqual(receipt.activeReleaseVersionsPreserved, ['1']);
  assert.equal(calls.length, 9);
  assert.deepEqual(calls.find((x) => x.method === 'PUT').body, { track: 'alpha', releases: [old,
    { name: '1.0.1 (2)', versionCodes: ['2'], status: 'draft' }] });
  assert.ok(calls.every((x) => !x.url.endsWith('/production')));
});

test('existing draft is never replaced and opening a Play edit is skipped', async () => {
  const { request, calls } = fake({ pre: [draft] });
  await assert.rejects(stageDraft({ ...flow, request }), /existing draft/);
  assert.deepEqual(calls.map((x) => x.method), ['GET']);
});

test('version collisions, mismatched Play upload or refused active versions never commit', async () => {
  for (const input of [{ used: [{ versionCode: 2 }] }, { version: 3 }, { updateChange: { track: 'alpha', releases: [] } }]) {
    const { request, calls } = fake(input);
    await assert.rejects(stageDraft({ ...flow, request }));
    assert.ok(!calls.some((x) => x.url.includes(':commit?')));
    assert.equal(calls.at(-1).method, 'DELETE');
    if (input.used) assert.ok(!calls.some((x) => x.url.includes('/upload/')));
  }
});

test('uncertain commit or unconfirmed draft never retries or deletes the committed edit', async () => {
  for (const input of [{ commitError: true }, { after: [published] }, { after: [draft] }]) {
    const { request, calls } = fake(input);
    await assert.rejects(stageDraft({ ...flow, request }), /check Publishing overview before any retry/);
    assert.equal(calls.filter((x) => x.url.includes(':commit?')).length, 1);
    assert.ok(!calls.some((x) => x.method === 'DELETE'));
  }
});
