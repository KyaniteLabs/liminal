# Test and CI Truth Matrix — 2026-05-01

**Issue:** #454  
**Status:** Current verification policy. Update this file when CI workflows or proof commands change.

This matrix maps commands to the claims they actually prove. Do not use a narrower command as evidence for a broader launch or browser/live-provider claim.

## Default local gates

| Claim proved | Command | Scope | Does not prove |
| --- | --- | --- | --- |
| TypeScript contracts compile | `pnpm typecheck` | `tsc --noEmit` over the repo. | Runtime behavior, browser paths, provider availability. |
| Build artifact correctness | `pnpm build` | TypeScript build with `tsc --incremental false`. | GUI bundle health, live generation quality. |
| Source lint gate has zero errors | `pnpm lint` | ESLint over `src/`. | Tests, docs, generated artifacts. |
| Orphan-source scan is clean | `pnpm check:orphans` | Static import scan from `scripts/check-orphans.sh`. | Deletion authority; #455 archaeology owns keep/retire decisions. |
| Package-script target integrity | `pnpm check:script-targets` | Local package scripts point to existing local command targets. | Runtime behavior of those commands. |
| Test quality rules are respected | `pnpm test:quality` | Static test-quality scanner. | Runtime test success or coverage. |
| Final QA surface ledger is complete | `pnpm final-qa:surface` | Included/excluded product surfaces are printed, pending/skipped tests are classified, and live creative-domain receipt covers all launch domains. | It does not run every listed surface command itself; it checks their wiring/classification and the latest live-domain receipt. |
| Diff hygiene is clean | `git diff --check` | Whitespace/conflict marker check. | Build/test correctness. |

## CI gates

| GitHub check | Current expectation | Claim proved | Caveat |
| --- | --- | --- | --- |
| `probe / Blacksmith Probe` | Required lightweight runner probe. | PR runner can start. | Not code correctness. |
| `validate-docs` | Required docs/version validation. | Docs validator accepts the change. | Does not prove docs are semantically current. |
| GitHub branch protection PR review policy | Required repository policy, not a workflow job. | A PR approval is required before merging to `main`. | Does not inspect unresolved review comments by itself. |
| `metadata-summary` | Informational PR metadata. | Prints PR number and branch for operator context. | Not an automated review gate and not required for launch truth. |
| `build-and-test` | Required fast CI gate. | Install, audit, orphan check, script-target check, lint, build, prompt audit, route-performance proof, `pnpm test:ci:fast`, `pnpm test:quality`, and coverage checks. | Fast CI excludes slow/live-provider claims and broad launch-readiness claims. |
| `browser-and-e2e-smoke` | Required PR browser/e2e smoke. | Build, Chromium install, and `pnpm test:e2e` execute on PRs. | Current e2e suite still contains skipped tests; it is smoke proof, not exhaustive proof. |
| `slow-browser-and-e2e` | Scheduled/push exhaustive browser lane, skipped on PRs. | Slow/browser lane result on non-PR events. | Currently release-blocking when red; do not use skipped PR state as proof. |

## Expanded proof commands

| Claim proved | Command | When required |
| --- | --- | --- |
| Sanitized local fast suite health | `env -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL -u ANTHROPIC_DEFAULT_HAIKU_MODEL -u ANTHROPIC_DEFAULT_OPUS_MODEL -u ANTHROPIC_DEFAULT_SONNET_MODEL -u MINIMAX_API_KEY -u OLLAMA_API_KEY pnpm test:ci:fast` | Repo-health proof from a developer machine. |
| Integration behavior | `pnpm verify:integration` | Integration route/bridge/render claims. |
| Browser/e2e behavior | `pnpm test:e2e` or `pnpm test:ci:slow` after browser install | User journey, sandbox, and browser claims. |
| Route selection performance and correctness | `pnpm proof:route-performance` | Creative-domain route selection and preview-domain detection budget claims. |
| Studio product smoke | `pnpm proof:studio-smoke` | Public/user-facing Studio smoke claims. |
| Full Studio launch proof | `pnpm proof:studio-launch-gauntlet` | #457 shareable launch proof bundle. |
| User-surface parity | `pnpm proof:user-surfaces`, `pnpm proof:user-surface-observability`, `pnpm proof:user-surface-controls` | Studio/TUI parity, receipts, control-surface claims. |
| Live provider behavior | `pnpm proof:live-provider-smoke` or `RUN_CLOUD_MODEL_TESTS=1 pnpm test:cloud` | Provider/model availability and live API behavior. |
| Preview/render launch safety | `pnpm proof:visual-output-previews` | Preview artifact/render route claims. |
| GUI bundle budget | `pnpm proof:gui-bundle-budget` | Launch performance/bundle budget claims. |

## Policy

1. PRs may merge on green required fast checks unless the issue explicitly requires live/browser proof.
2. Product/launch claims require the proof command that exercises the user-facing path, not only `pnpm build` or unit tests.
3. Skipped tests are acceptable only when they are listed in `docs/launch/skipped-test-ledger.md` with owner, reason, and action.
4. Local `pnpm test:ci:fast` should be run with provider env sanitized unless the goal is explicitly to test live providers.
