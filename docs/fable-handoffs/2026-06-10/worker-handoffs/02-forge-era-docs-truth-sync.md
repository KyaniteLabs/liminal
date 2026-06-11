# Handoff 02 — Forge-era docs truth sync (CI truth matrix, README, AGENTS.md, investor register)

**Mode:** You may edit DOCS ONLY (files listed below). No code, no tests, no workflows.

## Purpose

Make the repo's operator-facing truth docs match reality after two events on 2026-06-10:
1. **Forgejo (git.kyanitelabs.tech) is now the source of truth; GitHub is a read-only mirror of `main`.** Forgejo CI is an infrastructure gap actively being fixed; until then the merge gate is local verification (typecheck, focused tests, leak audit) plus agent code review.
2. The investor-audit register fell behind merged fixes (#696, #697, #698).

## Why this matters

`docs/launch/test-ci-truth-matrix-2026-05-01.md` is the document agents cite before claiming anything is verified. It currently names GitHub checks and GitHub branch protection as the policy — on the source of truth those gates do not run. A stale truth matrix manufactures false confidence.

## Exact files to edit

1. `docs/launch/test-ci-truth-matrix-2026-05-01.md` — add a dated "2026-06-10 forge transition" section at the top stating: Forgejo is the source of truth; GitHub Actions gates listed below run only on the GitHub mirror; until Forgejo CI lands, the required local gate per PR is `pnpm typecheck` + focused tests for touched areas + `pnpm lint` + review-agent pass; the GitHub-check table is historical for the mirror. Do NOT delete the existing tables.
2. `README.md` — the CI badge (line ~5) points at GitHub Actions on the mirror. Add one sentence under it: primary development happens on Forgejo; the badge reflects the GitHub mirror.
3. `AGENTS.md` — "Issues are tracked in GitHub Issues" (§ Issue tracker): note the forge migration and that issue/PR flow is moving to Forgejo (confirm wording with Simon if unsure). Bump the Last-Updated date.
4. `docs/validation/investor-audit-register-2026-06.md` — in the G009 table and the Tier-2/3 remainder row: mark **F11 FIXED (#696)**, **F17 FIXED (#697)**, **F7 FIXED (#698 — AND verified live 2026-06-10: daemon restarted so the hourly `preferences train` step actually runs; 244 score-gap pairs from 0 human events, model persisted via SinterFS; note that `~/.sinter/taste/taste-weights.json` is a legacy artifact referenced nowhere in src/ — never use its mtime as evidence)**. Mark **F4 FIXED — merged to main (fast-forward to ce0b2011; GitHub PR #699 closed unmerged because review/merge moved to forge)**. Mark **F18 FIXED pending push — base-layer background contract, commit 92b8defc on `fix/f18-base-layer-background`** (root cause: `generateLayer` never passed `spec.background` to the base layer's prompt; live-compose receipt for paper-signal/dusk-bloom still owed). Remaining open: F5, F10, F19, F20, F12/#637 lane (design done — Handoff 06).

## Exact commands to run

```bash
pnpm check:doc-links
git diff --check
```

Both must exit 0.

## Definition of done

All four files updated; both commands green; diff contains only the four files.

## What not to touch

`.github/workflows/*` (CI changes are a separate decision), `docs/fable-handoffs/*`, anything under `src/` or `test/`.

## Final report format

```
FILES CHANGED: <list>
COMMANDS: <command + exit code>
OPEN QUESTIONS: <anything you flagged instead of guessing>
```

Stop and ask if: the register has been edited since ce0b2011 (re-read before writing), or you cannot phrase the AGENTS.md issue-tracker change without guessing the forge issue workflow.
