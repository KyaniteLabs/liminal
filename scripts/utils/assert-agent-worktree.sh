#!/bin/bash
# Assert that an agent is working from a safe, isolated git worktree.
# Usage: scripts/utils/assert-agent-worktree.sh [expected-branch]

set -euo pipefail

expected_branch="${1:-}"
repo_root=$(git rev-parse --show-toplevel 2>/dev/null || true)
common_dir=$(git rev-parse --git-common-dir 2>/dev/null || true)
git_dir=$(git rev-parse --git-dir 2>/dev/null || true)
branch=$(git symbolic-ref --short HEAD 2>/dev/null || true)

fail() {
  echo "❌ $1" >&2
  exit 1
}

warn() {
  echo "⚠️  $1" >&2
}

[ -n "$repo_root" ] || fail "Not inside a git repository"
[ -n "$branch" ] || fail "Detached HEAD; agents must work on named branches"

if [ -n "$expected_branch" ] && [ "$branch" != "$expected_branch" ]; then
  fail "Expected branch '$expected_branch' but current branch is '$branch'"
fi

if [ -e "$git_dir/index.lock" ] || [ -e "$common_dir/index.lock" ]; then
  fail "Git index lock exists; another git process may be active"
fi

if git diff --name-only --diff-filter=U | grep -q .; then
  fail "Merge conflicts are present"
fi

# Main checkout has .git as a directory. Linked worktrees normally use a .git file.
if [ -d "$repo_root/.git" ]; then
  fail "Current checkout is the repository root, not an isolated worktree. Create one with: git wt <branch>"
fi

if [[ "$repo_root" != *"/.worktrees/"* && "$repo_root" != *"/.claude/worktrees/"* ]]; then
  warn "Checkout is a linked worktree but not under .worktrees/ or .claude/worktrees/: $repo_root"
fi

matching=$(git worktree list --porcelain | awk -v b="refs/heads/$branch" '
  /^worktree / { wt=$2 }
  /^branch / && $2 == b { print wt }
')
count=$(printf "%s\n" "$matching" | sed '/^$/d' | wc -l | tr -d ' ')

if [ "$count" -gt 1 ]; then
  echo "$matching" >&2
  fail "Branch '$branch' is checked out in multiple worktrees"
fi

status_count=$(git status --porcelain | wc -l | tr -d ' ')
echo "✅ Agent worktree guard passed"
echo "   branch: $branch"
echo "   worktree: $repo_root"
echo "   uncommitted entries: $status_count"
