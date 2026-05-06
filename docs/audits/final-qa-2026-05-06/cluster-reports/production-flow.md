# Production Flow Cluster Report

Personas: Charity Majors, Don Reinertsen, Steve Yegge

Lens: observability, flow bottlenecks, orchestration, integration debt, production failure modes.

Status: first-pass white-box and live-control-plane review complete. This cluster found release-blocking branch protection, CI, evidence, cancellation, and observability gaps.

## Findings

### PF-001: Main branch protection has no required checks or reviews

- Severity: P1
- Material: yes
- Evidence: `docs/audits/final-qa-2026-05-06/verification/github-main-protection.json`, `.github/BRANCH_PROTECTION_NOTE.md:5`
- Failure mode: GitHub branch protection returns empty required status checks, no required pull-request reviews, and admin enforcement disabled.
- Customer impact: release-blocking checks are social convention, not enforced.
- Recommended proof: live GitHub branch protection readback with required checks and review policy present.

### PF-002: PR review workflow is a placeholder while docs frame it as a gate

- Severity: P1
- Material: yes
- Evidence: `.github/workflows/pr-review.yml:22`, `.github/workflows/pr-review.yml:26`, `docs/launch/test-ci-truth-matrix-2026-05-01.md:23`
- Failure mode: workflow only echoes placeholder review text, but launch truth matrix treats it as a required review check.
- Customer impact: false confidence in automated review coverage.
- Recommended proof: either implement a real review gate or mark the check as placeholder/non-blocking in launch truth.

### PF-003: Slow browser and e2e tests are skipped on PRs

- Severity: P1
- Material: yes
- Evidence: `.github/workflows/ci.yml:104`, `.github/workflows/ci.yml:122`, `docs/launch/skipped-test-ledger.md:18`, `docs/launch/test-ci-truth-matrix-2026-05-01.md:25`
- Failure mode: slow browser/e2e job is gated away on pull requests while launch claims need those surfaces.
- Customer impact: customer-facing regressions can merge without required proof.
- Recommended proof: required PR path for at least one browser/e2e smoke, with slow exhaustive jobs scheduled separately.

### PF-004: Route performance proof command is broken

- Severity: P1
- Material: yes
- Evidence: `package.json:69`, `docs/audits/final-qa-2026-05-06/verification/pnpm-proof-route-performance.log`
- Failure mode: final QA performance proof command points to a missing file.
- Customer impact: performance readiness cannot be claimed.
- Recommended proof: successful route performance budget run.

### PF-005: Level 6 and market readiness accept minimal receipts without freshness or artifact integrity

- Severity: P1
- Material: yes
- Evidence: `src/runtime-core/Level6ReleaseGate.ts:131`, `src/runtime-core/Level6ReleaseGate.ts:139`, `test/unit/runtime-core/Level6ReleaseGate.test.ts:48`, `src/market/MarketReadinessStatus.ts:95`, `README.md:78`
- Failure mode: release gates accept passing JSON receipts without enforcing commit SHA, freshness, artifact existence, provider identity, or case coverage.
- Customer impact: stale or narrow proof can unlock launch language.
- Recommended proof: receipt validation tests for stale SHA, missing artifact, wrong provider, and insufficient case matrix.

### PF-006: Draft generation timeout does not abort the provider request

- Severity: P2
- Material: yes
- Evidence: `src/tui-bridge/TuiBridgeService.ts:2269`, `src/tui-bridge/TuiBridgeService.ts:2277`, `src/tui-bridge/TuiBridgeService.ts:2463`, `src/tui-bridge/TuiBridgeService.ts:2485`
- Failure mode: timeout races the provider promise but does not abort underlying work.
- Customer impact: process leaks, wasted tokens, delayed shutdown, and confusing late events.
- Recommended proof: fake provider with AbortSignal assertion and no late event emission after timeout.

### PF-007: Retry sleeps ignore AbortSignal

- Severity: P2
- Material: yes
- Evidence: `src/llm/RetryManager.ts:21`, `src/llm/RetryManager.ts:57`, `src/llm/LLMClient.ts:756`, `src/llm/LLMClient.ts:1005`
- Failure mode: cancellation can wait through retry backoff sleeps up to 60 seconds.
- Customer impact: stop feels broken during provider retries.
- Recommended proof: retry cancellation test with immediate abort of sleep.

### PF-008: User-surface observability proof publishes manual success events

- Severity: P2
- Material: yes
- Evidence: `scripts/proof/user-surface-observability.ts:83`, `scripts/proof/user-surface-observability.ts:109`, `scripts/proof/user-surface-observability.ts:174`
- Failure mode: proof creates a bridge without an LLM and manually publishes success events instead of proving real generation emits them.
- Customer impact: observability proof can pass while real runs are invisible.
- Recommended proof: drive an actual generation path and assert observed events come from runtime execution.

### PF-009: SSE replay can evict lifecycle and provenance during long content streams

- Severity: P2
- Material: yes
- Evidence: `src/tui-bridge/TuiEventStream.ts:24`, `src/tui-bridge/TuiEventStream.ts:35`, `src/tui-bridge/TuiBridgeService.ts:2003`, `src/tui-bridge/TuiBridgeServer.ts:235`
- Failure mode: replay buffer stores only the last 500 events, so content deltas can evict lifecycle/provenance context.
- Customer impact: reconnecting clients lose the story of a run.
- Recommended proof: long stream replay test that preserves start, provenance, terminal status, and errors.

### PF-010: Bridge route logs are effectively hidden by default

- Severity: P3
- Material: no
- Evidence: `src/utils/Logger.ts:18`, `src/tui-bridge/TuiBridgeService.ts:131`, `scripts/start-bubbletea-tui.mjs:68`
- Failure mode: bridge route info logs are below default log level and not guaranteed to land in the bridge log path.
- Customer impact: operator debugging is weaker, but this is secondary to the observability proof issue.
- Recommended proof: operator log smoke after observability fixes.
