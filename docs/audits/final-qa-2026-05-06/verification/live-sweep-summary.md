# Live Sweep Summary

Date: 2026-05-06

This summary distinguishes deterministic local proof from live provider proof.

## Passing Deterministic Proofs

- `pnpm proof:visual-output-previews`: 13 fixture previews checked, 0 failures.
- `pnpm --filter liminal-studio-gui build`: GUI production build passed.
- `pnpm proof:gui-bundle-budget`: passed after GUI build.
- `pnpm proof:user-surface-controls`: bridge/GUI controls contract passed without a model call.
- `pnpm proof:user-surfaces`: prompt stream, stop, review, cancel, confirm, preview route, and CSP checks passed.
- `pnpm proof:user-surface-observability`: event contract passed, but the proof manually publishes generation/preview events and therefore does not prove real generation-originated observability.
- `pnpm proof:studio-smoke`: Studio smoke passed.

## Passing Live Provider Proofs

- `pnpm proof:live-provider-smoke`: GLM/GLM-5v-turbo generated a p5 artifact and wrote a passing receipt.
- `pnpm proof:live-creative-domains`: GLM/GLM-5v-turbo generated passing artifacts for p5, svg, strudel, tone, and revideo.

## Failed Or Limited Release Proofs

- `pnpm proof:route-performance`: remediated after audit. The restored proof now passes and writes `.omx/proof/route-performance-budget.json`.
- `pnpm verify:integration`: failed, with 86 failed tests across 4 integration files.
- `pnpm test:ci:slow`: failed, with 56 failed tests across 3 slow-suite files.
- `pnpm test:e2e`: exited 0, but 50 of 96 tests were skipped.
- `qa-creative-domains --no-serve`: originally wrote a cockpit bundle but reported missing live artifacts for glsl, three, hydra, hyperframes, ascii, kinetic, and textgen. Remediation update: `pnpm proof:live-creative-domains` now defaults to all 12 launch domains and passed with live GLM artifacts for p5, svg, glsl, three, hydra, strudel, tone, revideo, hyperframes, ascii, kinetic, and textgen; `pnpm qa:creative-domains:static` then wrote a cockpit bundle with no missing domains.

## Remediated Release-Control Proofs

- Package script target integrity: `pnpm check:script-targets` passes and writes `.omx/proof/package-script-targets.json`.
- Branch protection: live `gh api` readback now requires `build-and-test`, `browser-and-e2e-smoke`, `validate-docs`, one PR approval, stale-review dismissal, admin enforcement, conversation resolution, linear history, and no force pushes/deletions.
- PR review placeholder truth: `.github/workflows/pr-review.yml` is now informational only; the required review gate is GitHub branch protection.
- Release receipt hardening: market readiness and Level 6 live gates now reject stale, wrong-commit, missing-provider/model, missing-artifact, and missing-case-coverage receipts. `pnpm proof:model-assimilation` now writes `gitCommit` and case coverage.

## Audit Interpretation

Fast CI and several local product proofs are useful green evidence, but they do not override the red integration/slow lanes or missing all-domain live coverage. Release saturation is not achieved.
