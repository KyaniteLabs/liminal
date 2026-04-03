# Git Worktree Isolation System

A complete guide to implementing worktree-based development for safe, parallel collaboration.

---

## Table of Contents

1. [What & Why](#what--why)
2. [Quick Start](#quick-start)
3. [Global Configuration](#global-configuration)
4. [Project Setup](#project-setup)
5. [Multi-Agent Workflow](#multi-agent-workflow)
6. [Cleanup & Maintenance](#cleanup--maintenance)
7. [Troubleshooting](#troubleshooting)

---

## What & Why

### The Problem

Traditional git workflow has a critical flaw: **one working directory per repository**.

When you switch branches:
- Uncommitted changes must be stashed or committed
- Build artifacts from branch A interfere with branch B
- Multiple agents cannot work simultaneously without conflicts
- Context is lost when jumping between features

### The Solution: Git Worktrees

Git worktrees create **isolated working directories** that share the same git history:

```
Repository Root (.git/)
├── HEAD (main branch)
├── objects/ (shared history)
├── refs/ (all branches)
├── worktrees/
│   ├── feature-login/     ← Worktree 1
│   ├── fix-navbar/        ← Worktree 2
│   └── agent-task-123/    ← Agent worktree
└── main/                  ← Main worktree (optional)
```

### Benefits

| Benefit | Description |
|---------|-------------|
| **Parallel Development** | Work on multiple branches simultaneously |
| **No Stashing** | Each worktree has its own working directory |
| **Build Isolation** | `node_modules/`, build artifacts don't collide |
| **Multi-Agent Safety** | Each agent gets isolated workspace |
| **Fast Context Switch** | `cd` between worktrees vs `git stash && checkout` |
| **CI/CD Friendly** | Each worktree is an independent checkout |

### Real-World Example

```bash
# Without worktrees (painful)
git checkout feature-A
npm install  # 2 minutes
git checkout feature-B
npm install  # 2 minutes (different deps)
git checkout feature-A
# node_modules out of sync, rebuild needed

# With worktrees (fast)
cd .worktrees/feature-A  # Ready to go
cd .worktrees/feature-B  # Different node_modules, preserved
cd .worktrees/feature-A  # Instantly back, no rebuild
```

---

## Quick Start

### One-Line Setup (New Computer)

```bash
curl -sSL https://raw.githubusercontent.com/your-org/liminal/main/scripts/setup-worktree-defaults.sh | bash
```

This configures:
- Global git aliases (`git wt`, `git wtl`, `git wtc`)
- Shell integration functions (`gco`, `wt`)
- `git-worktree-init` command

### One-Line Setup (New Project)

```bash
cd your-project
git-worktree-init
```

This creates:
- `.worktrees/` directory
- `.worktrees/README.md` with rules
- Git hooks for worktree awareness

### Create First Worktree

```bash
# Create and switch to new worktree
git wt my-feature

# Or create from existing branch
git wt existing-branch

# You'll be at: .worktrees/my-feature/
```

---

## Global Configuration

### Git Aliases

After running `setup-worktree-defaults.sh`, these aliases are available:

| Alias | Command | Description |
|-------|---------|-------------|
| `git wt <branch>` | Worktree create/switch | Creates new worktree or switches to existing |
| `git wtl` | Worktree list | Shows all worktrees with branches |
| `git wtc` | Worktree clean | Removes merged worktrees and branches |
| `git wtr <name>` | Worktree remove | Removes specific worktree |
| `git wts` | Worktree switch | Jumps to first available feature worktree |

### Shell Integration

Add to your `~/.bashrc` or `~/.zshrc`:

```bash
source ~/.git-worktree-shell-integration

# Optional: Add worktree name to prompt
PS1='$(__git_worktree_prompt)'$PS1
```

**Functions provided:**

| Function | Usage | Description |
|----------|-------|-------------|
| `gco <branch>` | `gco feature-login` | Checkout with auto-worktree creation |
| `wt` | `wt` | Fuzzy-find worktree (or numbered selector) |
| `__git_worktree_prompt` | (in PS1) | Shows `[worktree-name] ` in prompt |

### Prompt Example

```bash
# Normal repo
~/projects/liminal (main) $

# In worktree
[feature-login] ~/projects/liminal/.worktrees/feature-login (feature-login) $
```

---

## Project Setup

### Initial Setup (Per Project)

```bash
cd your-project
git-worktree-init
```

### What It Creates

```
.worktrees/
├── README.md              # Documentation and rules
├── <feature-branches>/    # Your worktrees
└── agent-<ids>/           # Agent worktrees (auto-created)
```

### Directory Structure

**Recommended layout:**

```
project-root/
├── .git/                  # Git metadata
├── .gitignore             # Ignores .worktrees/
├── .worktrees/            # Worktree directory (gitignored)
│   ├── README.md
│   ├── feature-auth/      # Feature worktree
│   ├── fix-navbar/        # Bugfix worktree
│   └── agent-a7b13158/    # Agent worktree
├── src/                   # Source code
├── docs/                  # Documentation
└── README.md              # Project README
```

### .gitignore Entry

```gitignore
# Worktree isolation
.worktrees/
```

### Git Hook: Post-Checkout Warning

Installed by `git-worktree-init`, warns if you checkout a branch that's already in another worktree:

```bash
git checkout feature-login
# ⚠️  WARNING: Branch 'feature-login' is already checked out in:
#    /Users/you/project/.worktrees/feature-login
```

---

## Multi-Agent Workflow

### Agent Isolation Pattern

When multiple agents work on the same repository:

```bash
# Agent A creates worktree
git worktree add .worktrees/agent-a7b13158 feature-A
cd .worktrees/agent-a7b13158

# Agent B creates worktree  
git worktree add .worktrees/agent-ab731eb7 feature-B
cd .worktrees/agent-ab731eb7

# Both agents work independently
# No file conflicts, no git conflicts
```

### Agent Worktree Naming Convention

| Pattern | Example | Purpose |
|---------|---------|---------|
| `agent-<short-id>` | `agent-a7b13158` | Automated agent worktrees |
| `<issue-id>-<desc>` | `PROJ-123-fix-login` | Ticket-based work |
| `<type>/<desc>` | `feature/auth`, `fix/navbar` | Categorized work |

### Safety Rules

1. **Each agent stays in their worktree**
   ```bash
   # Agent A - correct
   cd .worktrees/agent-a7b13158
   
   # Agent A - WRONG (in Agent B's space)
   cd .worktrees/agent-ab731eb7
   ```

2. **Never modify another agent's files**
   - Don't edit files in other worktrees
   - Don't run git commands in other worktrees
   - Don't delete other worktrees

3. **Commit before switching**
   ```bash
   # Good: Agent A commits, then switches context
   git add .
   git commit -m "WIP: feature progress"
   cd ../agent-ab731eb7  # Safe to switch
   ```

4. **Use descriptive branch names**
   ```bash
   # Good
   git wt PROJ-456-add-oauth
   
   # Bad
   git wt fix-stuff
   ```

### Coordination Example

```bash
# Agent A starts feature work
git wt feature-oauth
cd .worktrees/feature-oauth
# ... works on OAuth implementation

# Agent B starts bugfix
git wt fix-login-redirect
cd .worktrees/fix-login-redirect
# ... works on bugfix

# Agent A finishes, pushes
git add .
git commit -m "feat: implement OAuth flow"
git push origin feature-oauth

# Agent B can see Agent A's branch
git fetch
git log origin/feature-oauth --oneline

# Main worktree merges Agent A's work
cd ../..  # Back to main
git merge origin/feature-oauth

# Agent B rebases on updated main
cd .worktrees/fix-login-redirect
git rebase origin/main
```

---

## Cleanup & Maintenance

### Daily Cleanup

```bash
# List all worktrees
git wtl

# Remove specific worktree (after merge)
git wtr feature-oauth

# Clean all merged worktrees
git wtc
```

### Weekly Maintenance

```bash
# Prune stale worktree metadata
git worktree prune

# List branches that might need cleanup
git branch -a --merged | grep -v main

# Remove old worktrees manually
rm -rf .worktrees/old-feature  # Only if committed!
```

### Monthly Review

```bash
# Find worktrees older than 30 days
find .worktrees -maxdepth 1 -type d -mtime +30

# Archive completed worktrees (optional)
tar czf archive/$(date +%Y%m%d)-worktrees.tar.gz .worktrees/
```

### Cleanup Safety

**Always verify before removing:**

```bash
# Check what's in the worktree
cd .worktrees/feature-X
git status  # Any uncommitted changes?
git log --oneline -5  # Recent commits pushed?

# Safe to remove if:
# - git status shows "nothing to commit, working tree clean"
# - git log shows commits are pushed to origin
```

---

## Troubleshooting

### "fatal: 'branch' is already checked out at ..."

**Cause:** The branch is already in another worktree.

**Solution:**
```bash
# Option 1: Switch to existing worktree
cd .worktrees/branch-name

# Option 2: Create new branch
git wt branch-name-v2

# Option 3: Remove old worktree first
git wtr branch-name
git wt branch-name
```

### "fatal: could not create worktree ... already exists"

**Cause:** Worktree directory exists but git doesn't know about it.

**Solution:**
```bash
# Remove stale directory
rm -rf .worktrees/branch-name

# Re-create worktree
git wt branch-name
```

### "error: Submodule 'xxx' cannot be ..."

**Cause:** Submodules need re-initialization in new worktree.

**Solution:**
```bash
cd .worktrees/new-feature
git submodule update --init --recursive
```

### Worktree not showing in `git wtl`

**Cause:** Worktree metadata corrupted.

**Solution:**
```bash
# Prune and re-add
git worktree prune
git worktree add .worktrees/branch-name branch-name
```

### Can't remove worktree: "is the main working tree"

**Cause:** You're trying to remove the main worktree.

**Solution:**
```bash
# Only remove feature worktrees
git wtr feature-name  # ✓ OK

# Never remove main worktree
git wtr main  # ✗ Will fail (and should!)
```

### Agent worktrees piling up

**Solution:** Automated cleanup in CI:

```yaml
# .github/workflows/worktree-cleanup.yml
name: Worktree Cleanup
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: |
          # Remove worktrees for merged PRs
          git worktree list --porcelain | \
            grep -E "\.worktrees/agent-" | \
            while read wt; do
              branch=$(git -C "$wt" rev-parse --abbrev-ref HEAD)
              if git branch -r --merged | grep -q "$branch"; then
                git worktree remove "$wt"
              fi
            done
```

### Slow `npm install` in every worktree

**Solution:** Use `pnpm` or share node_modules:

```bash
# Option 1: Use pnpm (recommended)
pnpm install  # Uses content-addressable store

# Option 2: Symlink node_modules from main
ln -s ../../node_modules .worktrees/feature/node_modules
```

---

## Advanced Usage

### Worktree + Docker

```dockerfile
# Dockerfile
COPY . /app
WORKDIR /app/.worktrees/${WORKTREE_NAME}
RUN npm install
CMD ["npm", "run", "dev"]
```

```bash
# Build for specific worktree
docker build --build-arg WORKTREE_NAME=feature-auth .
```

### Worktree + VS Code

```json
// .vscode/settings.json
{
  "git.enabled": true,
  "git.detectSubmodules": false
}
```

Open worktree directly:
```bash
code .worktrees/feature-name
```

### Worktree + CI Matrix

```yaml
strategy:
  matrix:
    worktree: [feature-a, feature-b, feature-c]
steps:
  - uses: actions/checkout@v4
  - run: git worktree add .worktrees/${{ matrix.worktree }} ${{ matrix.worktree }}
  - run: cd .worktrees/${{ matrix.worktree }} && npm test
```

---

## Migration Guide

### From Traditional Workflow

```bash
# Before: You have uncommitted changes on branch-X

# Step 1: Stash or commit
git stash push -m "WIP: branch-X work"

# Step 2: Create worktree
git wt branch-X

# Step 3: Apply stashed changes
cd .worktrees/branch-X
git stash pop

# Step 4: Continue work
# ...
```

### From Multiple Clones

```bash
# Before: Multiple full clones
~/project-main/
~/project-feature-a/
~/project-feature-b/

# After: One repo, multiple worktrees
~/project/.worktrees/feature-a/
~/project/.worktrees/feature-b/

# Cleanup old clones
rm -rf ~/project-feature-a ~/project-feature-b
```

---

## Reference

### Git Worktree Commands

```bash
# Create worktree from existing branch
git worktree add .worktrees/branch-name branch-name

# Create worktree with new branch
git worktree add -b new-branch .worktrees/new-branch base-branch

# List worktrees
git worktree list

# Remove worktree
git worktree remove .worktrees/branch-name

# Force remove (if dirty)
git worktree remove --force .worktrees/branch-name

# Prune stale metadata
git worktree prune

# Move worktree
git worktree move .worktrees/old-name .worktrees/new-name
```

### File Locations

| Component | Path |
|-----------|------|
| Main git metadata | `.git/` |
| Worktree metadata | `.git/worktrees/<name>/` |
| Worktree root | `.worktrees/<name>/` |
| Global config | `~/.gitconfig` |
| Shell integration | `~/.git-worktree-shell-integration` |
| Setup script | `scripts/setup-worktree-defaults.sh` |
| Project init | `git-worktree-init` |

---

## Summary

**Worktree isolation** enables:
- ✅ Parallel branch development
- ✅ Multi-agent collaboration
- ✅ Fast context switching
- ✅ Build artifact isolation

**Setup:**
1. Run `setup-worktree-defaults.sh` once per computer
2. Run `git-worktree-init` once per project
3. Use `git wt <branch>` for all feature work

**Safety:**
- Each agent has isolated working directory
- Git enforces boundaries at gitdir level
- No conflicts between simultaneous work

---

*Last updated: 2026-04-02*
*For issues: See Troubleshooting section or check git-worktree documentation*
