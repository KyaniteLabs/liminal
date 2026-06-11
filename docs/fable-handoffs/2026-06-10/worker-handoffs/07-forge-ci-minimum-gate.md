# Handoff 07 — Forge CI minimum viable gate (closes FAB-001)

**Status (2026-06-11):** Resolved for current operations. Forgejo `fast-gate` succeeded on `main` at `3b81a84a` (Actions task `440`). No further Handoff 07 validation is pending per Simon.

**Mode:** Historical split task — steps 1–2 were Simon/infra (server-side); step 3 was agent-executable (repo-side) once a runner was registered.

## Purpose

Forgejo is the source of truth. This handoff installed the smallest source-of-truth fast gate so the orphan scan, test-quality checker, lint, build, and fast test suite run on the merge path instead of only on the GitHub mirror.

## Why this matters

Every immune-system mechanism this repo built (ratchet `vitest.config.ts`, `test:quality`, `check:orphans`, lint) needs to fail closed on the branch flow that actually merges.

## Step 1 (Simon, server): enable Forgejo Actions + register a runner

- In Forgejo admin: enable Actions for the instance and the `KyaniteLabs/liminal` repo.
- Register a Forgejo runner. Current proven path is the VPS/host runner label `self-hosted`.
- Note: Forgejo Actions reads `.forgejo/workflows/` first, then `.gitea/workflows/`; relying on it executing `.github/workflows/` is fragile — step 3 creates an explicit `.forgejo/workflows/ci.yml` instead.

## Step 2 (Simon, server): restore/verify the forge SSH service

SSH has been restored after the VPS migration. Verify fresh before relying on it; use HTTPS only if SSH is unavailable.

## Step 3 (agent, repo): port the fast gate

Create `.forgejo/workflows/ci.yml` mirroring the essentials of `.github/workflows/ci.yml`'s `build-and-test` job, targeting the registered runner label:

- `pnpm install --frozen-lockfile`
- `pnpm check:orphans` + `pnpm check:script-targets`
- `pnpm lint`
- `pnpm build`
- `pnpm test:ci:fast` (with provider env sanitized per the truth matrix)
- `pnpm test:quality`

Trigger: `pull_request` + push to `main`. Do NOT port the browser/e2e lanes yet (separate decision). Update `docs/launch/test-ci-truth-matrix-2026-05-01.md`'s transition section (from Handoff 02) to point at the new check as the required gate.

## Verification

A live Forgejo Actions run shows `fast-gate` completing successfully on the source-of-truth repo. Current receipt: task `440` on `3b81a84a`, status `success`.

## Definition of done

Forgejo `fast-gate` is visible and green on the source-of-truth repo; the truth matrix names it as the source-of-truth gate. No additional destructive CI validation is owed.

## Final report format

```
RUNNER: <label + status>
WORKFLOW: <path + trigger proof (run link)>
RUN: <green run/task id + commit SHA>
DOCS: <truth-matrix diff>
```
