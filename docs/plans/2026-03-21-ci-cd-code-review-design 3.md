# CI/CD & Code Review Workflows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix broken CI, add GLM-powered PR review bot, and configure branch protection rules on `main`.

**Architecture:** Three deliverables — (1) a fixed CI workflow that passes typecheck/lint/build/test, (2) a PR review workflow that calls the GLM API to review diffs and posts comments, (3) branch protection rules enforced via GitHub API.

**Tech Stack:** GitHub Actions, pnpm 10, Node 20, GLM-4-Flash API (`https://open.bigmodel.cn/api/paas/v4`)

**Design doc:** `docs/plans/2026-03-21-ci-cd-code-review-design.md`

---

## Task 1: Regenerate Lockfile with pnpm 10

**Root cause:** Local pnpm is v10 but CI uses v9. The lockfile has drifted (6 insertions, 6 deletions). We need to align CI to pnpm 10 and commit the updated lockfile.

**Files:**
- Modify: `pnpm-lock.yaml` (already modified locally)
- Modify: `.github/workflows/ci.yml`

**Step 1: Verify local install works**

Run: `pnpm install`
Expected: "Already up to date" with no errors

**Step 2: Run full CI pipeline locally to confirm green**

Run: `pnpm typecheck && pnpm lint && pnpm build && pnpm test`
Expected: All pass with no errors

**Step 3: Commit the updated lockfile**

```bash
git add pnpm-lock.yaml
git commit -m "fix: update pnpm-lock.yaml for pnpm 10 compatibility"
```

**Step 4: Update CI workflow — pnpm 10, Node 20 only**

Replace `.github/workflows/ci.yml` with:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm build
      - run: pnpm test
```

**Step 5: Commit CI fix**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): upgrade to pnpm 10, drop Node 18 matrix"
```

---

## Task 2: Create GLM PR Review Script

**Files:**
- Create: `scripts/pr-review.mjs`

This is a standalone Node script that fetches a PR diff, calls the GLM API, and posts a review comment. It will be called by the GitHub Actions workflow.

**Step 1: Create the review script**

Create `scripts/pr-review.mjs`:

```js
#!/usr/bin/env node

import { readFile } from 'node:fs/promises';

// Config from environment
const {
  GITHUB_TOKEN,
  GLM_API_KEY,
  GITHUB_REPOSITORY,    // e.g. "owner/repo"
  PR_NUMBER,
  GLM_API_URL = 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  GLM_MODEL = 'glm-4-flash',
} = process.env;

if (!GITHUB_TOKEN || !GLM_API_KEY || !GITHUB_REPOSITORY || !PR_NUMBER) {
  console.error('Missing required env vars: GITHUB_TOKEN, GLM_API_KEY, GITHUB_REPOSITORY, PR_NUMBER');
  process.exit(1);
}

async function ghFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body}`);
  }
  return res.json();
}

async function getPrDiff() {
  const res = await fetch(
    `https://api.github.com/repos/${GITHUB_REPOSITORY}/pulls/${PR_NUMBER}`,
    { headers: { Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3.diff' } }
  );
  if (!res.ok) throw new Error(`Failed to fetch diff: ${res.status}`);
  return res.text();
}

async function callGLM(prompt) {
  const res = await fetch(GLM_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GLM_API_KEY}`,
    },
    body: JSON.stringify({
      model: GLM_MODEL,
      messages: [
        {
          role: 'system',
          content: `You are a code reviewer. Review the PR diff and provide actionable feedback.
Focus ONLY on:
- Bugs and logic errors
- Type safety issues
- Security vulnerabilities (injection, XSS, etc.)
- Missing error handling for user-facing code
- Breaking changes or API contract violations

Do NOT comment on:
- Code style or formatting
- Naming conventions
- Minor preferences

Format your review as markdown with ## headings for severity: ## Critical, ## Warning, ## Suggestion.
If the code looks good with no significant issues, say "LGTM" and briefly explain why.`,
        },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GLM API ${res.status}: ${body}`);
  }
  return res.json();
}

async function postComment(body) {
  const url = `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${PR_NUMBER}/comments`;
  return ghFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
}

async function main() {
  console.log(`Reviewing PR #${PR_NUMBER} in ${GITHUB_REPOSITORY}...`);

  const diff = await getPrDiff();
  if (!diff.trim()) {
    console.log('No diff found — skipping review');
    return;
  }

  console.log(`Diff size: ${diff.length} chars`);
  const truncated = diff.length > 30000 ? diff.slice(0, 30000) + '\n\n... (diff truncated)' : diff;

  const response = await callGLM(`Review this PR diff:\n\n${truncated}`);
  const review = response.choices?.[0]?.message?.content || 'GLM returned no review content';

  await postComment(`## 🤖 GLM Code Review\n\n${review}`);
  console.log('Review posted successfully');
}

main().catch((err) => {
  console.error('Review failed:', err.message);
  process.exit(1);
});
```

**Step 2: Make it executable**

Run: `chmod +x scripts/pr-review.mjs`

**Step 3: Commit**

```bash
git add scripts/pr-review.mjs
git commit -m "feat: add GLM-powered PR review script"
```

---

## Task 3: Create PR Review Workflow

**Files:**
- Create: `.github/workflows/pr-review.yml`

**Step 1: Create the workflow**

Create `.github/workflows/pr-review.yml`:

```yaml
name: PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
    branches: [main]

permissions:
  pull-requests: write
  issues: write

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Run GLM Code Review
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GLM_API_KEY: ${{ secrets.GLM_API_KEY }}
          GITHUB_REPOSITORY: ${{ github.repository }}
          PR_NUMBER: ${{ github.event.pull_request.number }}
        run: node scripts/pr-review.mjs
```

**Step 2: Commit**

```bash
git add .github/workflows/pr-review.yml
git commit -m "feat(ci): add GLM PR review workflow"
```

---

## Task 4: Add GLM_API_KEY Secret (manual step)

**This is a manual step the user must perform.**

**Step 1: Add the secret to GitHub**

Run:
```bash
gh secret set GLM_API_KEY --repo Pastorsimon1798/liminal
```
Then paste the API key when prompted.

---

## Task 5: Push, Verify CI, and Configure Branch Protection

**Step 1: Push all commits**

```bash
git push origin main
```

**Step 2: Verify CI passes**

Run: `gh run list --limit 1 --json status,conclusion,name`
Expected: status=completed, conclusion=success

If it fails, check logs with: `gh run view --log-failed`

**Step 3: Configure branch protection on main**

```bash
gh api repos/Pastorsimon1798/liminal/branches/main/protection \
  -X PUT \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["CI"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": true,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 1
  },
  "restrictions": null,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "block_creations": false
}
EOF
```

**Step 4: Verify branch protection**

Run: `gh api repos/Pastorsimon1798/liminal/branches/main/protection`
Expected: Returns the protection rules with required_status_checks and required_pull_request_reviews

**Step 5: Test PR review bot**

Create a test branch, make a small change, open a PR, and verify the review bot posts a comment.

---

## Summary

| Task | What | Files |
|------|------|-------|
| 1 | Fix CI (pnpm 10, Node 20, lockfile) | `ci.yml`, `pnpm-lock.yaml` |
| 2 | GLM review script | `scripts/pr-review.mjs` |
| 3 | PR review workflow | `.github/workflows/pr-review.yml` |
| 4 | Add GLM_API_KEY secret | Manual (gh secret set) |
| 5 | Push, verify, branch protection | Manual (gh api) |
