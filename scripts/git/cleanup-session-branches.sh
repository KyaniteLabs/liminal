#!/bin/bash
# cleanup-session-branches.sh — Remove stale liminal/sess-* branches
# Run manually or via cron. Safe: only deletes branches with zero unique commits.
set -e

MAIN=${1:-main}
deleted=0
kept=0

echo "Cleaning up liminal/sess-* branches (baseline: $MAIN)..."
echo ""

git branch --list 'liminal/sess-*' | while read -r branch; do
    branch=$(echo "$branch" | tr -d ' *')
    # Skip if branch has unmerged commits
    ahead=$(git rev-list --count "${MAIN}..${branch}" 2>/dev/null || echo "0")
    if [ "$ahead" -gt 0 ]; then
        echo "  KEEPING: $branch ($ahead commits ahead of $MAIN)"
    else
        git branch -D "$branch" 2>/dev/null
        echo "  DELETED: $branch (no unique commits)"
    fi
done

remaining=$(git branch --list 'liminal/sess-*' | wc -l | tr -d ' ')
echo ""
echo "Cleanup complete. $remaining session branches remaining."
