# ⚠️ Branch Protection Needs Configuration

## Current Issue

Branch protection rules are NOT properly configured. The following violations were bypassed:

```
- Changes must be made through a pull request
- Required status check "CI" is expected
```

This means:
- ❌ Direct pushes to `main` are currently allowed (bypassed)
- ❌ No PR review requirements
- ❌ No CI checks are enforced

## Why This Matters

1. **Safety**: Prevents accidental direct pushes that break production
2. **Review**: Ensures code review before merging
3. **CI/CD**: Runs tests/builds before allowing merge
4. **Audit Trail**: PRs create discussion history

## How to Fix (GitHub Web UI)

### Step 1: Go to Settings
1. Navigate to: `https://github.com/Pastorsimon1798/liminal/settings`
2. Click **"Branches"** in left sidebar

### Step 2: Add Rule for `main`
1. Click **"Add branch ruleset"** (or "Add rule" if using classic)
2. **Branch name pattern**: `main`
3. Enable these protections:

#### Required:
- [x] **Require a pull request before merging**
  - [x] Require approvals: `1` (or more)
  - [x] Dismiss stale PR approvals when new commits are pushed
  - [x] Require review from CODEOWNERS (if you have CODEOWNERS file)

- [x] **Require status checks to pass before merging**
  - [x] Require branches to be up to date before merging
  - Search for status check: `CI` (or whatever your workflow is named)

#### Recommended:
- [x] **Require linear history** (no merge commits, cleaner history)
- [x] **Include administrators** (rules apply to everyone)
- [x] **Require signed commits** (optional but good for security)

### Step 3: Save
Click **"Create"** or **"Save changes"**

## Alternative: Classic Branch Protection

If using classic protection (not rulesets):

1. Settings → Branches
2. "Add rule" button
3. Branch name pattern: `main`
4. Check the same options above

## Verify It Works

After setting up, try this:

```bash
git checkout main
echo "test" > test-file.txt
git add test-file.txt
git commit -m "test: should fail to push"
git push origin main
```

**Expected**: Push should FAIL with:
```
remote: error: GH006: Protected branch update failed for refs/heads/main
remote: error: Changes must be made through a pull request
```

If it succeeds, protection is NOT working.

## Future Workflow (After Protection)

```bash
# 1. Create feature branch
git checkout -b feat/my-feature

# 2. Make commits
git add .
git commit -m "feat: my feature"

# 3. Push branch
git push -u origin feat/my-feature

# 4. Create PR via GitHub CLI or web
gh pr create --title "feat: my feature" --body "Description"

# 5. Merge via PR (after review + CI passes)
# DO NOT: git push origin main (will be blocked)
```

## See Also

- [GitHub Docs: About protected branches](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [GitHub Docs: Managing rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/managing-rulesets-for-a-repository)

---

**Action Required**: Please configure branch protection soon to prevent accidental direct pushes.
