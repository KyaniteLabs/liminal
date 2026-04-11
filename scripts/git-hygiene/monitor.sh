#!/usr/bin/env bash
# Git Hygiene Monitor - scans for convention violations every 5 min
#
# Only scans branches that matter: worktree branches, recently active
# branches (24h), and main. Skips the 2500+ stale historical branches.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
LOG_FILE="$REPO_ROOT/memory/git-monitor-log.md"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M')"
FINDINGS="$(mktemp)"
trap 'rm -f "$FINDINGS"' EXIT

violation() { echo "- **$1** — $2" >> "$FINDINGS"; }

branch_age_minutes() {
  local ts
  ts=$(git log -1 --format='%ct' "$1" 2>/dev/null || echo 0)
  echo $(( ($(date +%s) - ts) / 60 ))
}

cd "$REPO_ROOT"

# ── Collect branches worth scanning ──────────────────────────────────
# 1. Worktree branches (active agents)
# 2. Branches with commits in the last 24h
# 3. Main/master
SCAN_BRANCHES=$(mktemp)
git worktree list --porcelain 2>/dev/null | grep '^branch refs/heads/' | sed 's/^branch refs\/heads\///' >> "$SCAN_BRANCHES" 2>/dev/null || true
git for-each-ref --sort=-committerdate --format='%(refname:lstrip=2)' --since="24 hours ago" refs/heads/ 2>/dev/null >> "$SCAN_BRANCHES" || true
echo "main" >> "$SCAN_BRANCHES" 2>/dev/null || echo "master" >> "$SCAN_BRANCHES"
# Deduplicate
SORTED_BRANCHES=$(mktemp)
sort -u "$SCAN_BRANCHES" > "$SORTED_BRANCHES"
rm -f "$SCAN_BRANCHES"

# ── HIGH: Unpushed commits ───────────────────────────────────────────
while IFS= read -r branch; do
  [ -z "$branch" ] && continue
  [[ "$branch" == "main" || "$branch" == "master" ]] && continue
  if git rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
    ahead=$(git rev-list --count "origin/$branch..$branch" 2>/dev/null || echo 0)
    [ "$ahead" -gt 0 ] && violation "HIGH" "Branch \`${branch}\` has ${ahead} unpushed commit(s)"
  else
    count=$(git rev-list --count "$branch" 2>/dev/null || echo 0)
    [ "$count" -gt 0 ] && violation "HIGH" "Branch \`${branch}\` has no remote tracking - unpushed work"
  fi
done < "$SORTED_BRANCHES"

# ── HIGH: Diverged branches ──────────────────────────────────────────
while IFS= read -r branch; do
  [ -z "$branch" ] && continue
  [[ "$branch" == "main" || "$branch" == "master" ]] && continue
  if git rev-parse --verify "origin/$branch" >/dev/null 2>&1; then
    ahead=$(git rev-list --count "origin/$branch..$branch" 2>/dev/null || echo 0)
    behind=$(git rev-list --count "$branch..origin/$branch" 2>/dev/null || echo 0)
    [ "$ahead" -gt 0 ] && [ "$behind" -gt 0 ] && violation "HIGH" "Branch \`${branch}\` diverged (${ahead} ahead, ${behind} behind)"
  fi
done < "$SORTED_BRANCHES"

# ── MEDIUM: Idle worktrees (older than 1h) ───────────────────────────
wt_count=$(git worktree list --porcelain 2>/dev/null | grep -c '^worktree' || echo 1)
if [ "$wt_count" -gt 1 ]; then
  git worktree list --porcelain 2>/dev/null | grep '^branch refs/heads/' | sed 's/^branch refs\/heads\///' | while read -r branch; do
    [ -z "$branch" ] && continue
    [[ "$branch" == "main" || "$branch" == "master" ]] && continue
    age=$(branch_age_minutes "$branch")
    [ "$age" -gt 60 ] && violation "MEDIUM" "Worktree \`${branch}\` idle for $((age/60))h"
  done
fi

# ── MEDIUM: Main behind remote ───────────────────────────────────────
default_branch="main"
git rev-parse --verify "$default_branch" >/dev/null 2>&1 || default_branch="master"
if git rev-parse --verify "origin/$default_branch" >/dev/null 2>&1; then
  behind=$(git rev-list --count "${default_branch}..origin/${default_branch}" 2>/dev/null || echo 0)
  [ "$behind" -gt 0 ] && violation "MEDIUM" "Main is ${behind} commit(s) behind remote"
fi

# ── MEDIUM: Stash overflow ───────────────────────────────────────────
auto_stash=$(git stash list 2>/dev/null | grep -c "liminal: auto-stash" 2>/dev/null || echo 0)
auto_stash=$(echo "$auto_stash" | tr -d '[:space:]')
[ "${auto_stash:-0}" -gt 10 ] && violation "MEDIUM" "Auto-stash: ${auto_stash} entries (budget: 10)"

# ── LOW: Stale branches count (fast - no per-branch iteration) ──────
total_branches=$(git branch --format='%(refname:lstrip=2)' 2>/dev/null | wc -l | tr -d ' ')
if [ "$total_branches" -gt 100 ]; then
  violation "LOW" "${total_branches} total branches - consider cleanup if many are merged"
fi

rm -f "$SORTED_BRANCHES"

# ── Write results ────────────────────────────────────────────────────
{
  echo ""
  echo "## Scan - ${TIMESTAMP}"
  echo ""
  if [ -s "$FINDINGS" ]; then
    echo "Found $(wc -l < "$FINDINGS" | tr -d ' ') violation(s):"
    echo ""
    cat "$FINDINGS"
  else
    echo "No violations found."
  fi
} >> "$LOG_FILE"
