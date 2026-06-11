# Handoff 07 — Forge CI minimum viable gate (closes FAB-001)

**Mode:** Split task — steps 1–2 are Simon/infra (server-side); step 3 is agent-executable (repo-side) once a runner is registered.

## Purpose

Forgejo is the source of truth but has no CI: all workflows live in `.github/workflows/` and execute only on the GitHub mirror. The coverage ratchet, test-quality checker, and orphan gate are disconnected from the merge path. This installs the smallest gate that restores them.

## Why this matters

Every immune-system mechanism this repo built (ratchet `vitest.config.ts`, `test:quality`, `check:orphans`, lint) is currently advisory-only on the branch flow that actually merges.

## Step 1 (Simon, server): enable Forgejo Actions + register a runner

- In Forgejo admin: enable Actions for the instance and the `KyaniteLabs/liminal` repo.
- Register a Forgejo `act_runner` on the Mac (precedent: a GitHub self-hosted runner already runs on this machine as `actions.runner.simongonzalezdc-liminal`, label `mac-arm64-liminal-codex` — same host can carry both). Suggested labels: `macos-arm64`.
- Note: Forgejo Actions reads `.forgejo/workflows/` first, then `.gitea/workflows/`; relying on it executing `.github/workflows/` is fragile — step 3 creates an explicit `.forgejo/workflows/ci.yml` instead.

## Step 2 (Simon, server): restore/verify the forge SSH service

Port 2222 on nucbox stopped accepting connections mid-session on 2026-06-10 (~00:30Z) while HTTPS kept working. Agents fall back to the HTTPS remote, but it reportedly hangs on big pushes — SSH is the reliable path.

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

A test PR on forge shows the check running and failing when a deliberate `test:quality` violation is introduced (then revert it).

## Definition of done

Forge PRs block on the fast gate; truth matrix names it; the deliberate-failure probe was demonstrated and reverted.

## Final report format

```
RUNNER: <label + status>
WORKFLOW: <path + trigger proof (run link)>
PROBE: <failing run link + revert commit>
DOCS: <truth-matrix diff>
```
