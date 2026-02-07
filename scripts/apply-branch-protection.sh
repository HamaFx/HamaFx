#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   GH_TOKEN=... scripts/apply-branch-protection.sh [owner] [repo] [branch]
#
# Defaults:
#   owner=HamaFx repo=HamaFx branch=main

OWNER="${1:-HamaFx}"
REPO="${2:-HamaFx}"
BRANCH="${3:-main}"

if [ -z "${GH_TOKEN:-}" ]; then
  echo "GH_TOKEN is required."
  exit 1
fi

payload='{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "Quality Gate" },
      { "context": "E2E Mobile Smoke" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1,
    "require_last_push_approval": false
  },
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false,
  "required_conversation_resolution": true,
  "lock_branch": false,
  "allow_fork_syncing": true
}'

curl -fsS -X PUT \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GH_TOKEN}" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  "https://api.github.com/repos/${OWNER}/${REPO}/branches/${BRANCH}/protection" \
  -d "${payload}" >/dev/null

echo "Branch protection updated: ${OWNER}/${REPO} (${BRANCH})"
