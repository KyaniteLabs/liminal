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
| 2026-05-06 remediation | `pnpm vitest run test/scripts/package-script-targets.test.ts --coverage=false` | pass | Package scripts no longer reference missing local command targets and route-performance proof remains wired. | 1 file passed, 2 tests passed. |
| 2026-05-06 remediation | `pnpm check:script-targets` | pass | Local package script target scan passes and writes a receipt. | Receipt: `.omx/proof/package-script-targets.json`. |
| 2026-05-06 remediation | `pnpm proof:route-performance` | pass | Creative-domain route selection and preview-domain detection proof executes and writes a receipt. | Receipt: `.omx/proof/route-performance-budget.json`. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/launch-claim-ledger.test.ts --coverage=false` | pass | Public claim surfaces now point to a launch-truth ledger and placeholder PR-review language is not represented as a required gate. | 1 file passed, 3 tests passed. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/harness-self-healing-docs.test.ts --coverage=false` | pass | HarnessUpdater docs now match the current manual-memory runtime behavior. | 1 file passed, 1 test passed. |
| 2026-05-06 remediation | `gh api repos/KyaniteLabs/liminal/branches/main/protection` | pass | Live `main` branch protection now requires status checks and PR review. | Required checks: `build-and-test`, `browser-and-e2e-smoke`, `validate-docs`; one approval; admin enforcement; conversation resolution; no force pushes/deletions. |
| 2026-05-06 remediation | `pnpm typecheck` | pass | New TS proof and regression tests typecheck under the root TypeScript gate. | Exit 0. |
| 2026-05-06 remediation | `pnpm build` | pass | Root build succeeds after Batch 0 remediation. | Exit 0. |
| 2026-05-06 remediation | `pnpm lint` | pass | Configured root lint gate still passes. | Exit 0. |
| 2026-05-06 remediation | `pnpm test:quality` | pass | Test quality scanner accepts the new regression tests. | 661 files scanned; all checks passed. |
| 2026-05-06 remediation | `pnpm test:e2e` | pass with known skip caveat | Local command behind the new `browser-and-e2e-smoke` PR job exits 0. | 5 files passed, 11 skipped; 46 tests passed, 50 skipped. FQA-009 remains fixed pending first GitHub PR run and skipped-test launch classification. |
| 2026-05-06 remediation | `git diff --check` | pass | Batch 0 diff has no whitespace errors. | Exit 0. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/llm/LLMClientExtended.test.ts --coverage=false` | pass | Fallback stream error events now reject with exhausted-fallback diagnostics instead of resolving as empty success. | 1 file passed, 78 tests passed. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/tui-bridge/stream-chat-failure.test.ts test/unit/tui-bridge/goalCommand.test.ts test/unit/tui-bridge/TuiBridgeService-swarm.test.ts --coverage=false` | pass | TUI bridge emits error events and avoids empty `response.completed` commits when chat streaming fails. | 3 files passed, 21 tests passed. |
| 2026-05-06 remediation | `pnpm typecheck` | pass | Batch 1 streaming fix typechecks. | Exit 0. |
| 2026-05-06 remediation | `pnpm build` | pass | Batch 1 streaming fix builds. | Exit 0. |
| 2026-05-06 remediation | `pnpm test:quality` | pass | Test quality scanner accepts the added streaming regression. | 662 files scanned; all checks passed. |
| 2026-05-06 remediation | `git diff --check` | pass | Batch 1 streaming diff has no whitespace errors. | Exit 0. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/market/MarketReadinessStatus.test.ts --coverage=false` | pass | Market readiness rejects passing live-provider receipts unless they are fresh, current-commit-bound, provider/model-identified, and artifact-backed. | 1 file passed, 6 tests passed. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/runtime-core/Level6ReleaseGate.test.ts --coverage=false` | pass | Level 6 gate rejects stale live receipts and requires hardened live receipt proof. | 1 file passed, 4 tests passed. |
| 2026-05-06 remediation | `pnpm vitest run test/scripts/model-assimilation-proof-script.test.ts --coverage=false` | pass | Model-assimilation report includes current git commit and complete case coverage. | 1 file passed, 1 test passed. |
| 2026-05-06 remediation | `pnpm proof:model-assimilation` | pass | Model-assimilation proof command writes a hardened fixture receipt/report. | Wrote `.omx/proof/model-assimilation/<timestamp>/report.md` and `report.json`. |
| 2026-05-06 remediation | `pnpm typecheck` | pass | Receipt hardening typechecks. | Exit 0. |
| 2026-05-06 remediation | `pnpm build` | pass | Receipt hardening builds. | Exit 0. |
| 2026-05-06 remediation | `pnpm test:quality` | pass | Test quality scanner accepts the receipt-hardening tests. | 662 files scanned; all checks passed. |
| 2026-05-06 remediation | `git diff --check` | pass | Receipt-hardening diff has no whitespace errors. | Exit 0. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/llm/RetryManager.test.ts --coverage=false --testNamePattern "aborts retry backoff"` | pass | Retry backoff sleeps abort immediately when the active signal aborts. | 1 file passed, 1 test passed, 14 skipped. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/llm/LLMClientExtended.test.ts --coverage=false --testNamePattern "passes generate AbortSignal"` | pass | `LLMClient.generate()` passes its AbortSignal into retry orchestration. | 1 file passed, 1 test passed, 78 skipped. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/llm/LLMClientExtended.test.ts --coverage=false --testNamePattern "passes complete AbortSignal"` | pass | `LLMClient.complete()` passes its AbortSignal into retry orchestration. | Red-first proof failed with retry options `undefined`, then passed after restoring `{ signal }`; 1 file passed, 1 test passed, 79 skipped. |
| 2026-05-06 remediation | `pnpm vitest run test/tui-bridge/tui-bridge-no-chat-lane.test.ts --coverage=false --testNamePattern "aborts the underlying draft generation signal"` | pass | Draft timeout aborts the underlying generation signal instead of only racing the promise. | 1 file passed, 1 test passed, 21 skipped. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/gui-workbench-accessibility.test.ts --coverage=false --testNamePattern "active-run stop"` | pass | Active runs expose a stop control beside the composer. | 1 file passed, 1 test passed, 9 skipped. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/llm/RetryManager.test.ts test/unit/llm/LLMClientExtended.test.ts test/tui-bridge/tui-bridge-no-chat-lane.test.ts test/tui-bridge/tui-bridge-service.test.ts test/unit/gui-workbench-accessibility.test.ts test/unit/gui-workbench-telemetry.test.ts test/unit/gui-operator-cockpit-state.test.ts --coverage=false` | pass | Adjacent cancellation, bridge, LLM, and GUI telemetry/accessibility regressions pass together. | 7 files passed; 192 tests passed. |
| 2026-05-06 remediation | `pnpm typecheck` | pass | Cancellation remediation typechecks. | Exit 0. |
| 2026-05-06 remediation | `pnpm build` | pass | Root build succeeds after cancellation remediation. | Exit 0. |
| 2026-05-06 remediation | `pnpm lint` | pass | Configured root lint gate passes after cancellation remediation. | Exit 0. |
| 2026-05-06 remediation | `pnpm --dir gui build` | pass | GUI production bundle builds with the composer stop affordance. | Vite built 35 modules. |
| 2026-05-06 remediation | `pnpm test:quality` | pass | Test quality scanner accepts the cancellation regression tests. | 663 files scanned; all checks passed. |
| 2026-05-06 remediation | `pnpm check:script-targets` | pass | Package script target scan still passes after cancellation remediation. | Receipt: `.omx/proof/package-script-targets.json`. |
| 2026-05-06 remediation | `node --check bin/liminal` | pass | CLI entrypoint syntax remains valid. | Exit 0. |
| 2026-05-06 remediation | `git diff --check` | pass | Cancellation remediation diff has no whitespace errors. | Exit 0. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/gui-create-modes.test.ts --coverage=false --testNamePattern "video and timeline"` | pass | Common video/timeline prompts route to Revideo and get the Revideo prompt hint. | Red-first proof failed with `null`, then passed; 1 file passed, 1 test passed, 5 skipped. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/gui-workbench-accessibility.test.ts --coverage=false --testNamePattern "image preview fails"` | pass | Broken inline image previews expose a visible error and do not hide the image without recovery. | Red-first proof failed on missing `failedPreviewSrc`, then passed; 1 file passed, 1 test passed, 10 skipped. |
| 2026-05-06 remediation | `pnpm vitest run test/unit/gui-create-modes.test.ts test/unit/gui-workbench-accessibility.test.ts test/unit/gui-workbench-telemetry.test.ts test/unit/gui-operator-cockpit-state.test.ts --coverage=false` | pass | Adjacent GUI routing, accessibility, telemetry, and cockpit state tests pass together. | 4 files passed; 52 tests passed. |
| 2026-05-06 remediation | `pnpm typecheck` | pass | Revideo routing and preview-failure UI typecheck. | Exit 0. |
| 2026-05-06 remediation | `pnpm lint` | pass | Configured root lint gate passes after Revideo/preview remediation. | Exit 0. |
| 2026-05-06 remediation | `pnpm build` | pass | Root build succeeds after Revideo/preview remediation. | Exit 0. |
| 2026-05-06 remediation | `pnpm --dir gui build` | pass | GUI production bundle builds with Revideo routing and visible preview failure state. | Vite built 35 modules. |
| 2026-05-06 remediation | `pnpm test:quality` | pass | Test quality scanner accepts the Revideo/preview regression tests. | 663 files scanned; all checks passed. |
| 2026-05-06 remediation | `pnpm check:script-targets` | pass | Package script target scan still passes after Revideo/preview remediation. | Receipt: `.omx/proof/package-script-targets.json`. |
| 2026-05-06 remediation | `node --check bin/liminal` | pass | CLI entrypoint syntax remains valid after Revideo/preview remediation. | Exit 0. |
| 2026-05-06 remediation | `git diff --check` | pass | Revideo/preview remediation diff has no whitespace errors. | Exit 0. |
