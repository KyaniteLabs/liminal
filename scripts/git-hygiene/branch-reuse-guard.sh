#!/usr/bin/env bash
# Branch Reuse Guard — prevents branch sprawl by reusing stale branches
# Usage: scripts/git-hygiene/branch-reuse-guard.sh <prefix>
# Example: scripts/git-hygiene/branch-reuse-guard.sh liminal/cli-test

set -euo pipefail

PREFIX="${1:-liminal/test}"
STALE_THRESHOLD_MINUTES=30

# Find existing branch with this prefix
existing=$(git branch --list "${PREFIX}-*" --format='%(refname:lstrip=2)' 2>/dev/null | head -1 || true)

if [[ -z "$existing" ]]; then
  echo "No existing branch with prefix '${PREFIX}-*' — will create new"
  exit 0
fi

# Check age of last commit
last_commit_time=$(git log -1 --format='%ct' "$existing" 2>/dev/null || echo 0)
now=$(date +%s)
age_minutes=$(( (now - last_commit_time) / 60 ))

if (( age_minutes > STALE_THRESHOLD_MINUTES )); then
  echo "Found stale branch '${existing}' (${age_minutes} min old) — deleting to reuse prefix"
  git branch -D "$existing" 2>/dev/null || git push origin --delete "$existing" 2>/dev/null || true
  echo "Deleted stale branch: $existing"
else
  echo "Existing branch '${existing}' is fresh (${age_minutes} min) — will reuse"
fi
