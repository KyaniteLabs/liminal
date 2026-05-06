# Preflight Inventory

## Repository State

- Scope: Liminal only.
- Canonical worktree used for audit execution: `/Users/simongonzalezdecruz/workspaces/kyanite-labs/liminal/.worktrees/final-qa-persona-cluster-audit-20260506`
- Branch: `docs/final-qa-persona-cluster-audit-20260506`
- Starting commit: `d4cddb12104141fca57971690c60bba9b5659356`
- Starting subject: `Give Factory artists source anchors for future retrieval`
- Main worktree state at audit start: `main...origin/main [ahead 2]`
- Audit branch state at start: clean branch at `d4cddb12`

## Existing Launch Truth Inputs

- `docs/launch/test-ci-truth-matrix-2026-05-01.md`
- `docs/launch/skipped-test-ledger.md`
- `docs/launch/launch-candidate-2026-04-30.md`
- `docs/launch/repo-improvement-baseline-2026-05-01.md`
- `docs/USER_SURFACE_CONTRACT.md`
- `docs/FINISH_LINE.md`
- `docs/agents/factory-artists/rag/index.json`

## Package Verification Commands

Default gates:

- `pnpm typecheck`
- `pnpm build`
- `pnpm lint`
- `pnpm check:orphans`
- `pnpm test:quality`
- `git diff --check`

Expanded proof commands:

- sanitized `pnpm test:ci:fast`
- `pnpm verify:integration`
- `pnpm test:e2e`
- `pnpm test:ci:slow`
- `pnpm proof:studio-smoke`
- `pnpm proof:studio-launch-gauntlet`
- `pnpm proof:user-surfaces`
- `pnpm proof:user-surface-observability`
- `pnpm proof:user-surface-controls`
- `pnpm proof:live-provider-smoke`
- `pnpm proof:visual-output-previews`
- `pnpm proof:gui-bundle-budget`
- `pnpm proof:route-performance`

## Coverage Manifest

- Total tracked files at preflight: 5,229
- High-risk files requiring third review: 364
- Machine-readable manifest: `coverage-manifest.jsonl`
- Summary: `coverage-summary.json`

## Audit Boundary

The audit phase may create documentation artifacts and run verification commands. It must not change runtime behavior, wire personas into prompts, or implement remediations until saturation findings are integrated.
