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
| Test quality rules are respected | `pnpm test:quality` | Static test-quality scanner. | Runtime test success or coverage. |
| Diff hygiene is clean | `git diff --check` | Whitespace/conflict marker check. | Build/test correctness. |

## CI gates

| GitHub check | Current expectation | Claim proved | Caveat |
| --- | --- | --- | --- |
| `probe / Blacksmith Probe` | Required lightweight runner probe. | PR runner can start. | Not code correctness. |
| `validate-docs` | Required docs/version validation. | Docs validator accepts the change. | Does not prove docs are semantically current. |
| `review` | Required automated PR review check. | Bot review workflow completed. | Review comments must still be inspected with `gh api repos/KyaniteLabs/liminal/pulls/<PR>/comments`. |
| `build-and-test` | Required fast CI gate. | Install, audit, orphan check, lint, build, prompt audit, `pnpm test:ci:fast`, `pnpm test:quality`, and coverage checks. | Fast CI excludes slow/browser/live-provider claims. |
| `slow-browser-and-e2e` | Currently skipped by workflow config on normal PRs. | Nothing when skipped. | Must be promoted or run manually before browser/e2e launch claims. |

## Expanded proof commands

| Claim proved | Command | When required |
| --- | --- | --- |
| Sanitized local fast suite health | `env -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL -u ANTHROPIC_DEFAULT_HAIKU_MODEL -u ANTHROPIC_DEFAULT_OPUS_MODEL -u ANTHROPIC_DEFAULT_SONNET_MODEL -u MINIMAX_API_KEY -u OLLAMA_API_KEY pnpm test:ci:fast` | Repo-health proof from a developer machine. |
| Integration behavior | `pnpm verify:integration` | Integration route/bridge/render claims. |
| Browser/e2e behavior | `pnpm test:e2e` or `pnpm test:ci:slow` after browser install | User journey, sandbox, and browser claims. |
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
