#!/usr/bin/env bash
# Fetch only the immutable production AAB and proof from a successful CI run.
set -euo pipefail

run=$1
commit=$2
out=$3
[[ "$run" =~ ^[1-9][0-9]*$ && "$commit" =~ ^[a-f0-9]{40}$ ]]
[[ "${GITHUB_REPOSITORY:-}" == life423/ascend-avoid ]]
[[ "${GITHUB_REF:-}" == refs/heads/main && "${GITHUB_SHA:-}" == "$commit" ]]
[[ -n "${GH_TOKEN:-}" && ! -e "$out" ]]

repository=$GITHUB_REPOSITORY
workflow_id=$(gh api "repos/$repository/actions/workflows/ci.yml" --jq .id)
run_json=$(gh api "repos/$repository/actions/runs/$run")
jq -e --arg commit "$commit" --arg repository "$repository" --arg id "$run" --arg workflow "$workflow_id" '
  (.id|tostring) == $id and (.workflow_id|tostring) == $workflow and
  .event == "push" and .head_branch == "main" and .head_sha == $commit and
  .head_repository.full_name == $repository and .status == "completed" and .conclusion == "success"
' <<< "$run_json" > /dev/null
attempt=$(jq -er '.run_attempt | numbers' <<< "$run_json")
[[ "$attempt" =~ ^[1-9][0-9]*$ ]]
artifact_name="android-unsigned-$commit-$attempt"
artifact_json=$(gh api --method GET "repos/$repository/actions/runs/$run/artifacts" -f name="$artifact_name")
artifact=$(jq -cer --arg name "$artifact_name" '
  [.artifacts[] | select(.name == $name and .expired == false and (.digest | type) == "string")] | select(length == 1) | .[0]
' <<< "$artifact_json")
artifact_id=$(jq -er '.id | numbers' <<< "$artifact")
archive_digest=$(jq -er '.digest' <<< "$artifact")
[[ "$artifact_id" =~ ^[1-9][0-9]*$ && "$archive_digest" =~ ^sha256:[a-f0-9]{64}$ ]]

mkdir -- "$out"
archive=$(mktemp)
trap 'rm -f -- "$archive"' EXIT
gh api "repos/$repository/actions/artifacts/$artifact_id/zip" > "$archive"
printf '%s  %s\n' "${archive_digest#sha256:}" "$archive" | sha256sum --check --status
# Read two exact filenames, never extract arbitrary archive paths.
unzip -p "$archive" Ascend-Avoid-unsigned.aab > "$out/Ascend-Avoid-unsigned.aab"
unzip -p "$archive" proof.json > "$out/proof.json"
jq -n --arg attempt "$attempt" --arg artifactId "$artifact_id" --arg digest "$archive_digest" \
  '{attempt:$attempt, artifactId:$artifactId, archiveDigest:$digest}' > "$out/github-artifact.json"
