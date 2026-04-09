#!/usr/bin/env bash
# Stash Budget Enforcer — prevents stash flooding from auto-stash mechanism
# Usage: Call before each agent loop iteration
# Max auto-stash entries: 10

set -euo pipefail

MAX_AUTO_STASH=10

# Count auto-stash entries
auto_stash_count=$(git stash list | grep -c "liminal: auto-stash" || echo 0)

if (( auto_stash_count > MAX_AUTO_STASH )); then
  prune_count=$((auto_stash_count - MAX_AUTO_STASH))
  echo "Auto-stash budget exceeded: $auto_stash_count > $MAX_AUTO_STASH — pruning $prune_count oldest entries"

  # Get oldest auto-stash entries (by reflog order) and prune them
  git stash list | grep "liminal: auto-stash" | head -$prune_count | while read line; do
    stash_ref=$(echo "$line" | cut -d: -f1 | xargs)
    git stash drop "$stash_ref" 2>/dev/null && echo "Pruned: $stash_ref" || true
  done

  remaining=$(git stash list | grep -c "liminal: auto-stash" || echo 0)
  echo "Stash budget enforced — remaining auto-stash: $remaining"
else
  echo "Auto-stash count OK: $auto_stash_count <= $MAX_AUTO_STASH"
fi
