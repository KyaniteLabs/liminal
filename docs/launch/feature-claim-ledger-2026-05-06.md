# Feature Claim Ledger - 2026-05-06

This ledger maps public launch claims to current proof. It is intentionally stricter than implementation status: a feature can be implemented while still being unsafe to advertise as proven product value.

Launch rule: public copy may use `proven` only when the claim maps to a current passing command, live receipt, or branch-protection readback. Otherwise use `implemented`, `experimental`, `caveated`, or `blocked`.

Audited public claim surfaces:
- `docs/features.html`
- `docs/launch/ml-feature-value-matrix.md`
- `docs/launch/test-ci-truth-matrix-2026-05-01.md`
- `docs/SECURITY.md`
- `.github/workflows/ci.yml`
- `.github/workflows/pr-review.yml`

## Claim Ledger

| Claim Surface | Public Claim | Launch Label | Current Proof | Caveat / Next Proof |
| --- | --- | --- | --- | --- |
| `docs/features.html` | 12 creative domains are live-covered. | release-rerun required | `pnpm proof:live-creative-domains` passed all launch domains and `pnpm final-qa:surface` reported `Creative domains: 12/12 covered` during final QA remediation. | Public launch copy may call release output proven only after the live receipt is fresh, current-commit-bound, provider/model identified, and accepted by `pnpm final-qa:surface` on the release commit. |
| `docs/features.html` | Self-improving harness applies targeted fixes. | caveated | `src/harness/MetaHarnessIntegration.ts` records detected patterns as manual fixes. | Automatic HarnessUpdater runtime fixing is not active launch behavior. |
| `docs/features.html` | Multi-agent critique is complete. | implemented | Unit/product proof exists for critique components, but no final-QA live claim proof was recorded. | Public copy should say implemented, not broad proven launch value. |
| `docs/features.html` | Compost Mill product value. | experimental | `docs/launch/ml-feature-value-matrix.md` labels compost experimental. | Keep experimental until live value receipt is fresh and commit-bound. |
| `docs/features.html` | Aesthetic guardrails guarantee quality. | experimental | Unit coverage exists for guardrail components. | Do not promise blanket visual quality until decoded-pixel visual proof and live generation coverage are complete. |
| `docs/features.html` | Model-agnostic LLM support. | setup caveated | ProviderFactory exists and `pnpm proof:live-provider-smoke` passed for GLM/GLM-5v-turbo in the audit. | Setup docs and diagnostics still need provider-specific remediation; do not imply every provider is launch-proven. |
| `docs/features.html` | Circuit breaker gives automatic failover reliability. | evidence-limited | FQA-003 is verified: fallback stream errors now surface as failures instead of empty successful assistant responses. | Keep broad automatic failover reliability copy caveated until provider-specific live failover proof exists. |
| `docs/features.html` | Bubble Tea TUI is complete. | smoke-proven | `pnpm proof:user-surfaces`, `pnpm proof:user-surface-controls`, and `pnpm proof:studio-smoke` passed. | Does not prove live provider generation quality or slow/browser exhaustive coverage. |
| `docs/features.html` | Guardrails M1-M18 and security hardening are complete. | proof-limited | Unit/static proof exists for many guardrails; final QA found release controls and evidence gaps. | Public security claims remain gated by branch protection, browser/e2e smoke, decoded-pixel proof, and security-specific remediation. |
| `docs/launch/ml-feature-value-matrix.md` | ML features marked proven can be claimed as product value. | proof-hardened | Existing proof commands pass for some unit scopes; FQA-004 receipt validation now requires current commit, freshness, provider/model identity where live providers are involved, artifacts, and case coverage. | Broad launch claims still require fresh receipts generated on the release commit. |
| `docs/launch/test-ci-truth-matrix-2026-05-01.md` | Required checks prove release readiness. | caveated | `build-and-test` includes script-target and route-performance proof; `browser-and-e2e-smoke` runs on PRs; `pnpm verify:integration` and `pnpm test:ci:slow` passed during FQA-033 remediation. | Fast CI still must not be used as proof for live-provider, release-commit, scheduled slow-lane, or broad launch claims. |
| `docs/SECURITY.md` | Security headers are present across PreviewServer and Studio surfaces. | proof-hardened | `test/security/security-headers.test.ts` proves PreviewServer CSP, `X-Frame-Options: DENY`, nosniff, HSTS, and powered-by removal; `test/integration/gui-security-regression.test.js` proves Studio common headers and preview CSP boundaries. | Do not claim every HTTP response has CSP or `X-Frame-Options: DENY`; Studio `/preview` stays same-origin iframe compatible for live preview. |
| `.github/workflows/ci.yml` | PR browser/e2e surface is checked. | smoke-proven | `browser-and-e2e-smoke` runs `pnpm test:e2e` on PRs and passed on PR #497. | Existing e2e suite still has skipped tests; exhaustive slow/browser coverage remains a non-PR lane and must be checked for release-specific browser claims. |
| `.github/workflows/pr-review.yml` | Automated PR review is a release gate. | informational only | Workflow now prints PR metadata and states that it is not an automated review gate. | Real PR review enforcement belongs to GitHub branch protection policy, not this placeholder workflow. |

## Required Before Public Launch

- Fresh release receipts on the release commit: stale, wrong-commit, fixture-backed, or narrow receipts are rejected by release-proof validators and the final-QA surface gate.
- FQA-007 branch protection: require PR review and status checks on `main`, verified by live `gh api` readback.
- FQA-009 browser/e2e truth: keep PR smoke required and classify every skipped e2e test against launch risk.
- FQA-033 integration/slow CI: broad launch-readiness claims require fresh integration and slow/browser evidence for the release candidate, not only fast PR checks.
