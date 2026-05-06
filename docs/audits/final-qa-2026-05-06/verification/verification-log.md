# Verification Log

Commands are logged here with the claim they prove, not broader launch claims they do not prove.

| Time | Command | Result | Claim Proved | Notes |
| --- | --- | --- | --- | --- |
| 2026-05-06 | `pnpm install --frozen-lockfile` | pass | Dependencies install in the audit worktree with the existing lockfile. | Postinstall built `dist`; ignored build-script warnings for media packages were unchanged. |
| 2026-05-06 | `git diff --check` | pass | Audit docs do not contain whitespace errors. | Reran after final ledger/live-sweep expansion. |
| 2026-05-06 | `pnpm typecheck` | pass | Root TypeScript gate passes for the files included by root `tsconfig.json`. | Does not prove excluded examples, GUI package, Bubble Tea, or pending tests. |
| 2026-05-06 | `pnpm build` | pass | Root package build succeeds from the audit worktree. | Does not prove clean git install with `CI=true`. |
| 2026-05-06 | `pnpm lint` | pass | Configured root lint gate passes. | Does not prove launch-readiness claims. |
| 2026-05-06 | `pnpm check:orphans` | pass | Repo orphan checker reports no orphaned files. | Scope limited to checker logic. |
| 2026-05-06 | `pnpm test:quality` | pass | Existing test-quality checker passes across scanned tests. | FQA-015 shows the checker itself misses weak assertions. |
| 2026-05-06 | `pnpm proof:route-performance` | fail | Proves the route-performance proof command is currently broken. | Exit 1: missing `scripts/proof/route-performance-budget.ts`. |
| 2026-05-06 | Package script target scan | fail | Proves at least one package script references a missing local target. | Missing target: `proof:route-performance` -> `scripts/proof/route-performance-budget.ts`. |
| 2026-05-06 | `gh api repos/KyaniteLabs/liminal/branches/main/protection ...` | pass-read, fail-policy | Proves live branch-protection state was readable and currently ineffective for release blocking. | Required status checks empty, PR reviews null, admin enforcement disabled. |
| 2026-05-06 | Credential-reduced `pnpm test:ci:fast` | fail, superseded | Proves incomplete sanitization is not trustworthy evidence. | Removed common keys but left Kimi/MiniMax keys; failed 50 tests. Superseded by fully sanitized run. |
| 2026-05-06 | Fully sanitized provider config probe | pass | Proves `LLMClient.isConfigured()` is false when all plain and `LIMINAL_` provider keys are removed under `NODE_ENV=test`. | Output: `{"configured":false,"nodeEnv":"test"}`. |
| 2026-05-06 | Fully sanitized `pnpm test:ci:fast` | pass | Fast CI lane passes when provider credentials are fully removed. | 628 test files passed, 1 skipped; 10,156 tests passed, 7 skipped; duration 63.50s. Does not prove live provider paths. |
| 2026-05-06 | `pnpm proof:ml-value` | pass | Existing ML value proof script executes and writes `.omx/proof/ml-value-proof.json`. | Some features are marked `experimental`; this is not launch-wide proof. |
| 2026-05-06 | `pnpm proof:launch-risk` | pass | Existing launch-risk proof script executes and writes `.omx/proof/launch-risk-proof.json`. | Script reports several risks as `mitigated`; FQA findings show mitigation claims need receipt hardening. |
| 2026-05-06 | `pnpm proof:gui-bundle-budget` before GUI build | fail, precondition | Proves the bundle-budget proof requires `gui/dist` first. | Exit 1: GUI dist assets not found. Superseded by GUI build plus rerun. |
| 2026-05-06 | `pnpm proof:visual-output-previews` | pass | Fixture-based visual-output preview contract renders/checks all expected preview fixtures. | 13 checked, 0 failures. This is not live model generation. |
| 2026-05-06 | `pnpm --filter liminal-studio-gui build` | pass | GUI production bundle builds. | Vite built 35 modules; largest JS asset 139.88 KiB. |
| 2026-05-06 | `pnpm proof:gui-bundle-budget` after GUI build | pass | GUI bundle-budget proof passes against built GUI assets. | Writes `.omx/proof/gui-bundle-budget.json`. |
| 2026-05-06 | `pnpm proof:user-surface-controls` | pass | Deterministic bridge/GUI controls contract passes. | Proves stop/review/confirm/missing-preview event contract without a model call. |
| 2026-05-06 | `pnpm proof:user-surfaces` | pass | Deterministic user-surface e2e proof passes. | Checks prompt stream, stop, review, cancel, confirm, preview run/html/CSP. |
| 2026-05-06 | `pnpm proof:user-surface-observability` | pass with limitation | Deterministic event contract passes. | The script manually publishes generation/preview events, so it does not prove real generation emits them; see FQA-025. |
| 2026-05-06 | `pnpm proof:studio-smoke` | pass | Studio smoke path loads GUI/backend and verifies Improve/session scan labels. | Does not prove real creative generation output. |
| 2026-05-06 | `pnpm proof:live-provider-smoke` | pass | Configured live provider can generate a p5 artifact. | GLM/GLM-5v-turbo, receipt `.omx/proof/live-provider-smoke.json`. |
| 2026-05-06 | `pnpm proof:live-creative-domains` | pass with coverage gap | Default live creative-domain receipt passes for p5, svg, strudel, tone, and revideo. | Emits config-drop warnings; does not cover all launch domains; see FQA-034. |
| 2026-05-06 | `node scripts/qa-creative-domains.mjs --input .omx/proof/domain-gauntlet-live.json --no-serve` | pass with missing domains | QA cockpit bundle is written for live artifacts. | Reports missing artifacts for glsl, three, hydra, hyperframes, ascii, kinetic, textgen. |
| 2026-05-06 | `pnpm verify:integration` | fail | Proves full integration lane is not release-ready. | 4 files failed, 28 passed; 86 tests failed, 239 passed, 1 skipped. Mostly empty-code generation plus run/approve API failure. |
| 2026-05-06 | `pnpm test:e2e` | pass with large skip count | E2E lane exits 0 for the enabled subset. | 5 files passed, 11 skipped; 46 tests passed, 50 skipped. Skips require launch-risk classification. |
| 2026-05-06 | `pnpm test:ci:slow` | fail | Proves slow CI lane is not release-ready. | 3 files failed, 13 passed, 11 skipped; 56 tests failed, 159 passed, 51 skipped. |
| 2026-05-06 | `jq` parse of `coverage-summary.json` | pass | Coverage summary JSON is syntactically valid and reports 5,229 tracked files plus 364 high-risk files. | Does not validate every `jsonl` row. |
