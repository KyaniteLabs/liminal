# Repository Improvement Baseline — 2026-05-01

**Issue:** [#445](https://github.com/KyaniteLabs/liminal/issues/445)
**Roadmap:** [docs/plans/2026-05-01-repo-improvement-roadmap.md](../plans/2026-05-01-repo-improvement-roadmap.md)
**Baseline commit:** `6552ee3befc71327df78064951f074e25007c4cc`
**Remote:** `https://github.com/KyaniteLabs/liminal.git`

This is the current truth map that future roadmap issues should read before redoing discovery. It reconciles launch/product contract, ADRs, verification commands, proof scripts, stale docs, largest modules, and caveats.

## Current product and architecture truth

- **User-surface contract:** `docs/USER_SURFACE_CONTRACT.md` is the current product-surface contract. Studio is the artist-facing workbench; the Operator TUI is the diagnostics/control cockpit. Both must preserve the same run truth.
- **Finish-line contract:** `docs/FINISH_LINE.md` is the current broad product contract. Liminal V1 is a creative cognitive system, not a narrowed four-generator proof.
- **Provider/runtime ADR:** `docs/adr/0001-provider-runtime-truth.md` is accepted. Provider facts belong in `src/config/ProviderRuntime.ts`; future provider work should deepen around that seam, not duplicate defaults elsewhere.
- **Roadmap execution surface:** GitHub issues [#444](https://github.com/KyaniteLabs/liminal/issues/444)-[#457](https://github.com/KyaniteLabs/liminal/issues/457) plus `docs/plans/2026-05-01-repo-improvement-roadmap.md` are the durable execution system.
- **Launch proof anchor:** `docs/launch/launch-candidate-2026-04-30.md` is the latest shareable launch-candidate proof summary. It records Studio p5 preview and microphone preview proof, with caveats.

## Current source map

The repository currently has about **127k lines of TypeScript source** and **142k lines of tests**. The largest source modules are the highest-friction areas for future deepening work:

| Rank | File | Lines | Roadmap relevance |
| ---: | --- | ---: | --- |
| 1 | `src/tui-bridge/TuiBridgeService.ts` | 3406 | #449, #450: bridge event and endpoint seams |
| 2 | `src/harness/agent/LLMModeAgent.ts` | 1797 | #453 and later harness/provider provenance |
| 3 | `src/core/RalphLoop.ts` | 1680 | #451: creative iteration stages |
| 4 | `src/llm/LLMClient.ts` | 1617 | #453: request/retry/fallback provenance |
| 5 | `src/core/CreativeEvaluator.ts` | 1593 | #452: domain evaluator registry tracer |
| 6 | `src/brain/comprehensive-artistic-knowledge.ts` | 1150 | #455: repo archaeology / knowledge surface classification |
| 7 | `src/core/wrappers/GenericWrapper.ts` | 1078 | #452 / #456: render and validation proof surfaces |
| 8 | `src/compost/EventStore.ts` | 1007 | #448: cognitive loop write-back receipts |
| 9 | `src/core/parsing/CodeParser.ts` | 981 | #452 / #454: behavior-vs-structure test truth |
| 10 | `src/swarm/SwarmOrchestrator.ts` | 944 | #455: dormant/hardening classification before launch claims |

## Verification matrix

#454 promotes the durable command-to-claim policy into `docs/launch/test-ci-truth-matrix-2026-05-01.md`; keep this baseline section as historical seed evidence.


| Claim | Command | Current evidence | Notes |
| --- | --- | --- | --- |
| TypeScript type safety | `pnpm typecheck` | Passed locally on `6552ee3b`. | Uses `tsc --noEmit`. |
| Build correctness | `pnpm build` | Passed locally and in PR #459 CI. | Uses `tsc --incremental false`. |
| Lint release gate | `pnpm lint` | Passed locally and in PR #459 CI. | Warning budget is separate; see `docs/launch/warning-budget.md`. |
| Orphan source check | `pnpm check:orphans` | Passed locally with `No orphaned files found`; also runs in CI. | Complements, but does not replace, #455 archaeology. |
| Test quality static check | `pnpm test:quality` | Passed locally: scanned 655 test files. | Checks assertion quality, not runtime behavior coverage. |
| Docs validation | `npm run validate-docs --if-present` | Passed locally and PR #459 `validate-docs` check passed. | Script is absent/no-op locally except workflow version consistency; still safe to run. |
| Whitespace/diff hygiene | `git diff --check` | Passed locally. | Run before every commit. |
| Fast CI suite | `env -u ANTHROPIC_AUTH_TOKEN -u ANTHROPIC_BASE_URL -u ANTHROPIC_DEFAULT_HAIKU_MODEL -u ANTHROPIC_DEFAULT_OPUS_MODEL -u ANTHROPIC_DEFAULT_SONNET_MODEL -u MINIMAX_API_KEY -u OLLAMA_API_KEY pnpm test:ci:fast` | Passed locally: 625 files passed, 1 skipped; 10131 tests passed, 7 skipped; coverage all files 80.19% statements / 81.1% lines. | Sanitized env is required locally to avoid live-provider pollution. |
| Unsanitized local fast suite | `pnpm test:ci:fast` | Failed locally: 7 files failed, 618 passed, 1 skipped; 58 failed, 10073 passed, 7 skipped. | Failure was caused by local provider env vars and missing isolated Playwright browser cache causing live/timeout paths. Do not use unsanitized local result as repo-health proof. |
| CI fast gate | GitHub `build-and-test` workflow | PR #459 passed at `2026-05-01T01:55:59Z`. | CI runs install, audit, orphan check, lint, build, prompt surface audit, `pnpm test:ci:fast`, `pnpm test:quality`, and coverage checks. |
| Slow/browser CI gate | GitHub `slow-browser-and-e2e` workflow | Skipped by workflow config on PR #459. | Requires explicit slow/browser promotion before claiming broad browser/e2e coverage. |
| Local slow suite | `pnpm test:ci:slow` after `pnpm exec playwright install chromium` | Not run in this baseline. | #454 should define owner/reason/action for slow/browser gates. |
| Integration suite | `pnpm test:integration` / `pnpm verify:integration` | Not run in this baseline. | Use for integration-specific claims; `verify:integration` includes build. |
| E2E suite | `pnpm test:e2e` | Not run in this baseline. | Some tests are env/browser/provider gated. |
| Live cloud/provider suite | `RUN_CLOUD_MODEL_TESTS=1 pnpm test:cloud` | Not run in this baseline. | Requires explicit provider credentials and should be reported as live-provider evidence, not default CI. |
| User-surface proof | `pnpm proof:user-surfaces`, `pnpm proof:user-surface-observability`, `pnpm proof:user-surface-controls` | Not run in this baseline. | Relevant to #446-#448. |
| Studio launch proof | `pnpm proof:studio-launch-gauntlet` | Not run in this baseline. | Relevant to #457. |
| Studio smoke | `pnpm proof:studio-smoke` | Not run in this baseline. | Lightweight product smoke; prefer real GUI route when making product claims. |
| Live provider smoke | `pnpm proof:live-provider-smoke` | Not run in this baseline. | Relevant to #453, requires live provider setup. |
| Cognitive loop proof | `pnpm proof:cognitive-loop` | Not run in this baseline. | Relevant to #448. |
| Model assimilation proof | `pnpm proof:model-assimilation` / `pnpm proof:live-model-assimilation` | Not run in this baseline. | Live variant requires provider availability. |
| Creative domain execution proof | `pnpm proof:live-creative-domains` | Not run in this baseline. | Relevant before broad claims about creative domains. |
| Visual output preview proof | `pnpm proof:visual-output-previews` | Not run in this baseline. | Relevant for #456/#457. |
| GUI bundle budget | `pnpm proof:gui-bundle-budget` | Not run in this baseline. | Relevant for launch hardening #456. |

## Current skip and gate inventory

Static scan found these skip markers under `test/`:

- `describe.skip` / `describe.skipIf`: 17 occurrences.
- `it.skip` / `it.skipIf`: 6 occurrences.
- `test.skip` / `test.skipIf`: 2 occurrences.

Representative gates:

- Browser/CDN/sandbox: `test/integration/renderer.test.js`, `test/unit/sandbox.test.ts`, `test/render/render-and-score.test.ts`.
- CI-disabled e2e: `test/e2e/sandbox-self-improve.e2e.test.ts`.
- Provider/live model: `test/e2e/models/*`, `test/e2e/cloud-providers.test.ts`, `test/e2e/full-loop-cloud.test.ts`.
- Swarm hardening skips: `test/unit/swarm/SwarmOrchestrator.test.ts`.

Existing launch ledgers still matter:

- `docs/launch/skipped-test-ledger.md` records the owned swarm skips and states that gated slow/e2e slices are accepted only while intentionally environment-gated.
- `docs/launch/warning-budget.md` records warning classes as hardening debt while `pnpm lint` remains the zero-error release gate.
- `docs/launch/ml-feature-value-matrix.md` controls what ML/cognitive features may be claimed as proven versus experimental.

## Roadmap and audit doc classification

| Document | Classification | How to use it |
| --- | --- | --- |
| `docs/USER_SURFACE_CONTRACT.md` | Current authoritative | Product-surface rules for Studio, Operator TUI, wording, preview, receipts, cancel/confirm, and provider truth. |
| `docs/FINISH_LINE.md` | Current authoritative | Broad product scope: creative instrument plus self-improving organism. Do not shrink scope silently. |
| `docs/adr/0001-provider-runtime-truth.md` | Current authoritative | Provider/runtime truth decision. Must be respected by #453 and provider-related work. |
| `docs/plans/2026-05-01-repo-improvement-roadmap.md` | Current authoritative | Issue order, handoff contract, and skill routing for #444-#457. |
| `docs/launch/launch-candidate-2026-04-30.md` | Current proof summary | Latest shareable launch-candidate proof, but rerun commands before making new launch claims. |
| `docs/launch/skipped-test-ledger.md` | Current caveat ledger | Launch skip ownership, especially swarm and gated e2e/browser claims. |
| `docs/launch/warning-budget.md` | Current caveat ledger | Warning debt; lint errors remain release blockers. |
| `docs/launch/ml-feature-value-matrix.md` | Current caveat ledger | Marketing/proof rule for proven vs experimental ML features. |
| `docs/orphaned-module-catalog.md` | Stale-but-useful decision record | Contains a keep-all decision for zero-import infrastructure. Use as input to #455, not as a fresh orphan scan. |
| `docs/internal/ADVERSARIAL_REVIEW_AND_ROADMAP.md` | Stale-but-useful architecture audit | Still aligns with largest-module friction, but dates/line counts and some statuses are stale. Use for hypotheses, not current truth. |
| `docs/internal/LOOSE_ENDS.md` | Stale-but-useful issue catalog | Useful categories, but generated on 2026-04-02 and partially superseded by later PRs/docs. Verify every claim. |
| `docs/MASTER_PLAN.md` | Stale-but-useful historical roadmap | Has many complete phase claims; use for vocabulary/history, not current launch status. |
| `docs/ARCHITECTURE_AND_PHILOSOPHY.md` | Stale-but-useful architecture context | Good domain/context reading; verify implementation claims. |
| `docs/ARCHITECTURE_QUICKREF.md` | Historical / misleading if treated as current | The file itself says it is an outdated 2026-04-01 snapshot. Do not cite its test counts as current. |
| `docs/READY_TO_LAUNCH.md` | Historical / misleading if treated as current | Older launch preflight. Prefer `docs/launch/launch-candidate-2026-04-30.md` and current proof commands. |
| `docs/VERIFICATION_ALL_SYSTEMS_ONLINE.md` | Historical / misleading if treated as current | Treat as past proof narrative unless rerun. |
| `docs/COMPREHENSIVE_AUDIT_REPORT.md`, `docs/internal/*AUDIT*`, `docs/archive/*` | Historical | Use for archaeology and context only. Do not treat as current without revalidation. |
| `docs/plans/2026-04-*` and earlier plan files | Historical / task-specific | Useful to understand intent and past decisions; not current roadmap unless linked by an active issue. |

## Known caveats future issues should not rediscover

1. **Sanitize provider env vars for local fast CI.** Local `ANTHROPIC_*`, `MINIMAX_API_KEY`, and similar variables can make otherwise-fast tests attempt live provider paths and timeout. Use sanitized env when proving repo health locally.
2. **Do not infer slow/browser health from default PR checks.** `slow-browser-and-e2e` is skipped by current workflow config.
3. **Do not infer launch readiness from structure-only tests.** Product claims need Studio/TUI/proof route evidence.
4. **Do not delete zero-import infrastructure just because it is zero-import.** `docs/orphaned-module-catalog.md` records a keep-all decision; #455 should classify, not blindly delete.
5. **Do not re-litigate ProviderRuntime.** ADR-0001 is accepted.
6. **Do not let proof/harness language leak into the default artist-facing Studio path.** Use Details and Operator TUI diagnostics for receipts and provenance.

## How the next roadmap issues should use this baseline

- #446 should start from `docs/USER_SURFACE_CONTRACT.md`, this matrix, and the user-surface proof commands.
- #447 should reuse the event/proof caveats here and add cancellation/failure/revision-specific checks.
- #448 should reuse the cognitive-loop proof commands and finish-line contract.
- #449 and #450 should start from the largest-module map and preserve bridge event truth.
- #451 and #452 should start from the largest-module map and characterize behavior before refactoring.
- #453 should start from ADR-0001 and the provider-env caveat.
- #454 should promote this matrix into a stricter ongoing CI/test policy.
- #455 should use the doc classification table as seed input.
- #456 and #457 should use the launch proof/caveat ledgers and must rerun live/browser proof before making public claims.
