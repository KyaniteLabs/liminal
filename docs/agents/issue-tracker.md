# Issue tracker: Forgejo

Forgejo is the source of truth for this repo's issues, PRDs, and pull requests:

- Repo: `https://git.kyanitelabs.tech/KyaniteLabs/liminal`
- Git remote: `origin` should point at Forgejo.
- GitHub issue/PR state is historical mirror/legacy unless a current task explicitly says otherwise.

Do **not** create, update, or close GitHub issues for current Liminal/Sinter work unless Simon explicitly asks for GitHub.

## Authentication

Use one of these, in order:

1. A configured Forgejo CLI/session if present.
2. A scoped Forgejo API token with repo issue/PR permission.
3. The Forgejo web UI if API access is unavailable.

Never paste or commit a token. If the API returns `401`/`403`, report the auth gap and use a handoff/UI path; do not fall back to GitHub.

## API examples

Set these in your shell/session without printing the token:

```bash
FORGEJO_URL=https://git.kyanitelabs.tech
FORGEJO_REPO=KyaniteLabs/liminal
# FORGEJO_TOKEN must come from the operator environment or credential store.
```

Read an issue:

```bash
curl -fsS \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Accept: application/json" \
  "$FORGEJO_URL/api/v1/repos/$FORGEJO_REPO/issues/<number>"
```

List open issues:

```bash
curl -fsS \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Accept: application/json" \
  "$FORGEJO_URL/api/v1/repos/$FORGEJO_REPO/issues?state=open&limit=50"
```

Create an issue:

```bash
curl -fsS -X POST \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d @issue-body.json \
  "$FORGEJO_URL/api/v1/repos/$FORGEJO_REPO/issues"
```

Close or update an issue:

```bash
curl -fsS -X PATCH \
  -H "Authorization: token $FORGEJO_TOKEN" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{"state":"closed"}' \
  "$FORGEJO_URL/api/v1/repos/$FORGEJO_REPO/issues/<number>"
```

## Active skill scope

The active Matt Pocock skill subset in Codex is:

- `setup-matt-pocock-skills`
- `diagnose`
- `grill-with-docs`
- `improve-codebase-architecture`
- `zoom-out`
- `tdd`
- `to-issues`
- `to-prd`
- `triage`

Do not use still-quarantined Matt Pocock skills such as `caveman`, `git-guardrails-claude-code`, `grill-me`, `migrate-to-shoehorn`, `scaffold-exercises`, `setup-pre-commit`, or `write-a-skill` unless they are explicitly re-enabled.

## Roadmap issue handoff contract

For current Forgejo issues, an agent should follow this sequence:

1. Read the Forgejo issue body and comments.
2. Read `docs/plans/2026-05-01-repo-improvement-roadmap.md` when the issue references the repository-wide improvement roadmap.
3. Read relevant repo docs and ADRs before changing code.
4. Create an isolated worktree before implementation.
5. Implement only that issue; do not opportunistically broaden scope.
6. Verify through execution before claiming completion.
7. Open a Forgejo PR with evidence and link the issue.
8. Report the next high-leverage step after the PR lands or if blocked.

Historical GitHub roadmap issues `#444`-`#457` may still appear in May 2026 docs. Treat those links as archival context unless Simon explicitly reactivates GitHub issue operations.

## When a skill says "publish to the issue tracker"

Create a Forgejo issue only if the active skill explicitly asks for one and the user has requested issue creation. Otherwise, keep findings in the response or in the requested docs artifact.

If Forgejo API/CLI auth is unavailable, write a copy/paste Forgejo issue body or a durable handoff instead of creating a GitHub issue.

## When a skill says "fetch the relevant ticket"

Fetch the ticket from Forgejo. Use API/CLI if authenticated; otherwise use the Forgejo web UI or report the auth gap. Do not silently fetch the GitHub mirror.
